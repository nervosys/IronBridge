//! A minimal, dependency-free ZIP writer (store / no compression).
//!
//! An `.ipa` is just a ZIP archive with a particular directory layout, and the
//! store method is a valid ZIP that every unzipper — and Apple's installer —
//! accepts. Implementing it here keeps the crate dependency-free and, more
//! importantly, keeps the archive layout under our control (deterministic
//! ordering, no surprise metadata). Deflate is deliberately omitted: it buys
//! size, not correctness, and would pull in a dependency.

use std::io::{self, Write};

/// CRC-32 (IEEE 802.3 polynomial, reflected) — the checksum ZIP requires.
pub fn crc32(bytes: &[u8]) -> u32 {
    // Table-free bitwise form; fast enough for build artifacts and trivially
    // auditable against known test vectors.
    let mut crc: u32 = 0xFFFF_FFFF;
    for &b in bytes {
        crc ^= b as u32;
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

struct Entry {
    name: String,
    crc: u32,
    size: u32,
    offset: u32,
    is_dir: bool,
}

/// Accumulates entries and writes a valid store-method ZIP.
pub struct ZipWriter<W: Write> {
    inner: W,
    entries: Vec<Entry>,
    offset: u32,
}

impl<W: Write> ZipWriter<W> {
    /// Start a new archive over `inner`.
    pub fn new(inner: W) -> Self {
        ZipWriter {
            inner,
            entries: Vec::new(),
            offset: 0,
        }
    }

    /// Add a file entry. `name` uses forward slashes (ZIP convention).
    pub fn add_file(&mut self, name: &str, data: &[u8]) -> io::Result<()> {
        self.write_entry(name, data, false)
    }

    /// Add a directory entry (name should end in `/`).
    pub fn add_dir(&mut self, name: &str) -> io::Result<()> {
        let name = if name.ends_with('/') {
            name.to_string()
        } else {
            format!("{name}/")
        };
        self.write_entry(&name, &[], true)
    }

    fn write_entry(&mut self, name: &str, data: &[u8], is_dir: bool) -> io::Result<()> {
        let crc = crc32(data);
        let size = data.len() as u32;
        let name_bytes = name.as_bytes();

        // Local file header (signature 0x04034b50).
        let mut header = Vec::with_capacity(30 + name_bytes.len());
        header.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        header.extend_from_slice(&20u16.to_le_bytes()); // version needed
        header.extend_from_slice(&0u16.to_le_bytes()); // flags
        header.extend_from_slice(&0u16.to_le_bytes()); // method: store
        header.extend_from_slice(&0u16.to_le_bytes()); // mod time
        header.extend_from_slice(&0x21u16.to_le_bytes()); // mod date (1980-01-01)
        header.extend_from_slice(&crc.to_le_bytes());
        header.extend_from_slice(&size.to_le_bytes()); // compressed
        header.extend_from_slice(&size.to_le_bytes()); // uncompressed
        header.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        header.extend_from_slice(&0u16.to_le_bytes()); // extra len
        header.extend_from_slice(name_bytes);

        self.inner.write_all(&header)?;
        self.inner.write_all(data)?;

        self.entries.push(Entry {
            name: name.to_string(),
            crc,
            size,
            offset: self.offset,
            is_dir,
        });
        self.offset += header.len() as u32 + size;
        Ok(())
    }

    /// Write the central directory + end-of-central-directory record and return
    /// the wrapped writer.
    pub fn finish(mut self) -> io::Result<W> {
        let cd_start = self.offset;
        let mut cd = Vec::new();
        for e in &self.entries {
            let name_bytes = e.name.as_bytes();
            // External attrs: mark directories so unzippers recreate them.
            let external_attrs: u32 = if e.is_dir { 0x4000_0010 } else { 0 };
            cd.extend_from_slice(&0x0201_4b50u32.to_le_bytes()); // central header sig
            cd.extend_from_slice(&20u16.to_le_bytes()); // version made by
            cd.extend_from_slice(&20u16.to_le_bytes()); // version needed
            cd.extend_from_slice(&0u16.to_le_bytes()); // flags
            cd.extend_from_slice(&0u16.to_le_bytes()); // method: store
            cd.extend_from_slice(&0u16.to_le_bytes()); // mod time
            cd.extend_from_slice(&0x21u16.to_le_bytes()); // mod date
            cd.extend_from_slice(&e.crc.to_le_bytes());
            cd.extend_from_slice(&e.size.to_le_bytes()); // compressed
            cd.extend_from_slice(&e.size.to_le_bytes()); // uncompressed
            cd.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
            cd.extend_from_slice(&0u16.to_le_bytes()); // extra len
            cd.extend_from_slice(&0u16.to_le_bytes()); // comment len
            cd.extend_from_slice(&0u16.to_le_bytes()); // disk number
            cd.extend_from_slice(&0u16.to_le_bytes()); // internal attrs
            cd.extend_from_slice(&external_attrs.to_le_bytes());
            cd.extend_from_slice(&e.offset.to_le_bytes()); // local header offset
            cd.extend_from_slice(name_bytes);
        }
        self.inner.write_all(&cd)?;

        // End of central directory (signature 0x06054b50).
        let mut eocd = Vec::with_capacity(22);
        let count = self.entries.len() as u16;
        eocd.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
        eocd.extend_from_slice(&0u16.to_le_bytes()); // disk number
        eocd.extend_from_slice(&0u16.to_le_bytes()); // cd start disk
        eocd.extend_from_slice(&count.to_le_bytes()); // entries this disk
        eocd.extend_from_slice(&count.to_le_bytes()); // entries total
        eocd.extend_from_slice(&(cd.len() as u32).to_le_bytes()); // cd size
        eocd.extend_from_slice(&cd_start.to_le_bytes()); // cd offset
        eocd.extend_from_slice(&0u16.to_le_bytes()); // comment len
        self.inner.write_all(&eocd)?;

        Ok(self.inner)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc32_matches_the_canonical_vector() {
        // The well-known check value for the ASCII string "123456789".
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b""), 0);
    }

    #[test]
    fn a_finished_archive_has_the_eocd_signature_and_entry_count() {
        let mut buf = Vec::new();
        {
            let mut z = ZipWriter::new(&mut buf);
            z.add_dir("Payload/").unwrap();
            z.add_file("Payload/App.app/Info.plist", b"<plist/>").unwrap();
            z.finish().unwrap();
        }
        // Local header signatures present.
        assert_eq!(&buf[0..4], &0x0403_4b50u32.to_le_bytes());
        // The EOCD lives in the final 22 bytes here (no archive comment).
        let eocd = &buf[buf.len() - 22..];
        assert_eq!(&eocd[0..4], &0x0605_4b50u32.to_le_bytes());
        let total = u16::from_le_bytes([eocd[10], eocd[11]]);
        assert_eq!(total, 2, "one dir + one file");
    }
}

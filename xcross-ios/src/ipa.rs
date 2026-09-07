//! Packages a `.app` bundle into an `.ipa`.
//!
//! The `.ipa` layout is fixed by Apple: a ZIP whose single top-level directory
//! is `Payload/`, containing the `.app`. We walk the bundle deterministically
//! (directories before their contents, entries sorted) so the archive is
//! reproducible.

use crate::error::{Error, Result};
use crate::zip::ZipWriter;
use std::fs;
use std::path::Path;

/// Zip `app_dir` (a `.app`) into `ipa_path` under `Payload/`.
pub fn package(app_dir: &Path, ipa_path: &Path) -> Result<()> {
    if !app_dir.is_dir() {
        return Err(Error::InvalidInput(format!(
            "{} is not a .app directory",
            app_dir.display()
        )));
    }
    let app_name = app_dir
        .file_name()
        .ok_or_else(|| Error::InvalidInput("app bundle has no name".into()))?
        .to_string_lossy()
        .into_owned();

    if let Some(parent) = ipa_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| Error::io(format!("creating {}", parent.display()), e))?;
    }
    let file = fs::File::create(ipa_path)
        .map_err(|e| Error::io(format!("creating {}", ipa_path.display()), e))?;
    let mut zip = ZipWriter::new(std::io::BufWriter::new(file));

    zip.add_dir("Payload/")
        .map_err(|e| Error::io("writing Payload/", e))?;
    let root = format!("Payload/{app_name}");
    add_tree(&mut zip, app_dir, &root)?;

    zip.finish()
        .map_err(|e| Error::io("finalizing ipa", e))?
        .into_inner()
        .map_err(|e| Error::io("flushing ipa", e.into_error()))?;
    Ok(())
}

/// Recursively add `dir` to the zip under the archive path `prefix`.
fn add_tree<W: std::io::Write>(zip: &mut ZipWriter<W>, dir: &Path, prefix: &str) -> Result<()> {
    zip.add_dir(&format!("{prefix}/"))
        .map_err(|e| Error::io(format!("writing {prefix}/"), e))?;

    // Sort entries so the archive is deterministic across filesystems.
    let mut entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| Error::io(format!("reading {}", dir.display()), e))?
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let archive_path = format!("{prefix}/{name}");
        if path.is_dir() {
            add_tree(zip, &path, &archive_path)?;
        } else {
            let data = fs::read(&path)
                .map_err(|e| Error::io(format!("reading {}", path.display()), e))?;
            zip.add_file(&archive_path, &data)
                .map_err(|e| Error::io(format!("writing {archive_path}"), e))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Seek, SeekFrom};

    #[test]
    fn packaging_produces_an_ipa_with_a_payload_entry() {
        let tmp = std::env::temp_dir().join(format!("xcross_ipa_{}", std::process::id()));
        let app = tmp.join("Chasm.app");
        fs::create_dir_all(&app).unwrap();
        fs::write(app.join("Info.plist"), b"<plist/>").unwrap();
        fs::write(app.join("Chasm"), b"\xCA\xFE\xBA\xBE").unwrap(); // fake macho

        let ipa = tmp.join("Chasm.ipa");
        package(&app, &ipa).unwrap();

        let mut f = fs::File::open(&ipa).unwrap();
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).unwrap();
        // The archived path for the app's plist must appear verbatim.
        let hay = String::from_utf8_lossy(&buf);
        assert!(hay.contains("Payload/Chasm.app/Info.plist"));
        // And the file must end with an EOCD record.
        f.seek(SeekFrom::End(-22)).unwrap();
        let mut eocd = [0u8; 4];
        f.read_exact(&mut eocd).unwrap();
        assert_eq!(eocd, 0x0605_4b50u32.to_le_bytes());

        let _ = fs::remove_dir_all(&tmp);
    }
}

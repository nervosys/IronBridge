//! A minimal reader for the XML property-list subset Apple actually emits.
//!
//! Full `plist` crates pull in a large dependency; the crate stays dependency-
//! free by parsing the handful of element types that appear in the files this
//! tool reads (provisioning profiles, `Info.plist`s): `dict`, `array`,
//! `string`, `integer`, `real`, `true`/`false`, `date`, `data`. It is a
//! forgiving recursive-descent scanner — not a validating XML parser — which is
//! exactly right for well-formed Apple output and keeps the surface small.

use crate::error::{Error, Result};

/// A parsed plist value.
#[derive(Debug, Clone, PartialEq)]
pub enum Plist {
    /// `<dict>` — ordered key/value pairs (Apple preserves order).
    Dict(Vec<(String, Plist)>),
    /// `<array>`
    Array(Vec<Plist>),
    /// `<string>`
    String(String),
    /// `<integer>`
    Integer(i64),
    /// `<real>`
    Real(f64),
    /// `<true/>` / `<false/>`
    Bool(bool),
    /// `<date>` — kept as the raw ISO-8601 text.
    Date(String),
    /// `<data>` — kept as the raw base64 text.
    Data(String),
}

impl Plist {
    /// Parse a full plist document, returning its root value.
    pub fn parse(xml: &str) -> Result<Plist> {
        let mut p = Parser {
            b: xml.as_bytes(),
            i: 0,
        };
        p.skip_prologue()?;
        let v = p.parse_value()?;
        Ok(v)
    }

    /// For a `Dict`, the value under `key`.
    pub fn get(&self, key: &str) -> Option<&Plist> {
        match self {
            Plist::Dict(kvs) => kvs.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    /// As a string slice, if this is a `String`.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Plist::String(s) => Some(s),
            _ => None,
        }
    }

    /// As a bool, if this is a `Bool`.
    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Plist::Bool(b) => Some(*b),
            _ => None,
        }
    }

    /// As a slice, if this is an `Array`.
    pub fn as_array(&self) -> Option<&[Plist]> {
        match self {
            Plist::Array(a) => Some(a),
            _ => None,
        }
    }

    /// Collect an array of strings (ignoring non-string members).
    pub fn as_str_array(&self) -> Vec<String> {
        match self {
            Plist::Array(a) => a.iter().filter_map(|v| v.as_str().map(String::from)).collect(),
            _ => Vec::new(),
        }
    }
}

struct Parser<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Parser<'a> {
    fn skip_ws(&mut self) {
        while self.i < self.b.len() && self.b[self.i].is_ascii_whitespace() {
            self.i += 1;
        }
    }

    /// Skip the `<?xml …?>`, `<!DOCTYPE …>` and opening `<plist …>` if present,
    /// leaving the cursor at the root value.
    fn skip_prologue(&mut self) -> Result<()> {
        loop {
            self.skip_ws();
            if self.starts_with(b"<?") {
                self.skip_until(b"?>")?;
            } else if self.starts_with(b"<!") {
                self.skip_until(b">")?;
            } else if self.starts_with(b"<plist") {
                self.skip_until(b">")?;
            } else {
                return Ok(());
            }
        }
    }

    fn starts_with(&self, pat: &[u8]) -> bool {
        self.b[self.i..].starts_with(pat)
    }

    /// Advance past the next occurrence of `pat` (inclusive).
    fn skip_until(&mut self, pat: &[u8]) -> Result<()> {
        match find(&self.b[self.i..], pat) {
            Some(rel) => {
                self.i += rel + pat.len();
                Ok(())
            }
            None => Err(Error::InvalidInput(format!(
                "plist: expected `{}`",
                String::from_utf8_lossy(pat)
            ))),
        }
    }

    /// Read the next opening/self-closing tag name, returning
    /// `(name, self_closing)` and leaving the cursor just past `>`.
    fn read_tag(&mut self) -> Result<(String, bool)> {
        self.skip_ws();
        if !self.starts_with(b"<") {
            return Err(Error::InvalidInput("plist: expected a tag".into()));
        }
        let end = find(&self.b[self.i..], b">")
            .ok_or_else(|| Error::InvalidInput("plist: unterminated tag".into()))?;
        let raw = &self.b[self.i + 1..self.i + end];
        self.i += end + 1;
        let self_closing = raw.ends_with(b"/");
        let raw = if self_closing {
            &raw[..raw.len() - 1]
        } else {
            raw
        };
        // Name is up to the first whitespace (attributes ignored).
        let name_end = raw
            .iter()
            .position(|b| b.is_ascii_whitespace())
            .unwrap_or(raw.len());
        let name = String::from_utf8_lossy(&raw[..name_end]).into_owned();
        Ok((name, self_closing))
    }

    /// Read text up to `</name>`, unescape entities, and consume the close tag.
    fn read_text_until_close(&mut self, name: &str) -> Result<String> {
        let close = format!("</{name}>");
        let rel = find(&self.b[self.i..], close.as_bytes())
            .ok_or_else(|| Error::InvalidInput(format!("plist: missing </{name}>")))?;
        let text = String::from_utf8_lossy(&self.b[self.i..self.i + rel]).into_owned();
        self.i += rel + close.len();
        Ok(unescape(&text))
    }

    fn expect_close(&mut self, name: &str) -> Result<()> {
        self.skip_ws();
        let close = format!("</{name}>");
        if self.starts_with(close.as_bytes()) {
            self.i += close.len();
            Ok(())
        } else {
            Err(Error::InvalidInput(format!("plist: expected </{name}>")))
        }
    }

    fn parse_value(&mut self) -> Result<Plist> {
        let (name, self_closing) = self.read_tag()?;
        match name.as_str() {
            "true" if self_closing => Ok(Plist::Bool(true)),
            "false" if self_closing => Ok(Plist::Bool(false)),
            "true" => {
                self.expect_close("true")?;
                Ok(Plist::Bool(true))
            }
            "false" => {
                self.expect_close("false")?;
                Ok(Plist::Bool(false))
            }
            "string" => Ok(Plist::String(self.read_text_until_close("string")?)),
            "date" => Ok(Plist::Date(self.read_text_until_close("date")?)),
            "data" => Ok(Plist::Data(
                self.read_text_until_close("data")?
                    .split_whitespace()
                    .collect(),
            )),
            "integer" => {
                let t = self.read_text_until_close("integer")?;
                t.trim()
                    .parse::<i64>()
                    .map(Plist::Integer)
                    .map_err(|_| Error::InvalidInput(format!("plist: bad integer `{t}`")))
            }
            "real" => {
                let t = self.read_text_until_close("real")?;
                t.trim()
                    .parse::<f64>()
                    .map(Plist::Real)
                    .map_err(|_| Error::InvalidInput(format!("plist: bad real `{t}`")))
            }
            "array" => {
                let mut items = Vec::new();
                loop {
                    self.skip_ws();
                    if self.starts_with(b"</array>") {
                        self.i += "</array>".len();
                        break;
                    }
                    items.push(self.parse_value()?);
                }
                Ok(Plist::Array(items))
            }
            "dict" => {
                let mut kvs = Vec::new();
                loop {
                    self.skip_ws();
                    if self.starts_with(b"</dict>") {
                        self.i += "</dict>".len();
                        break;
                    }
                    // key
                    let (k, _) = self.read_tag()?;
                    if k != "key" {
                        return Err(Error::InvalidInput(format!(
                            "plist: expected <key> in dict, got <{k}>"
                        )));
                    }
                    let key = self.read_text_until_close("key")?;
                    let val = self.parse_value()?;
                    kvs.push((key, val));
                }
                Ok(Plist::Dict(kvs))
            }
            other => Err(Error::InvalidInput(format!("plist: unknown element <{other}>"))),
        }
    }
}

/// Find `needle` in `hay`, returning its start index.
fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || needle.len() > hay.len() {
        return None;
    }
    hay.windows(needle.len()).position(|w| w == needle)
}

/// Unescape the five XML entities.
fn unescape(s: &str) -> String {
    if !s.contains('&') {
        return s.to_string();
    }
    s.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
<plist version=\"1.0\">\n\
<dict>\n\
  <key>Name</key><string>Chasm &amp; Co</string>\n\
  <key>UUID</key><string>ABCD-1234</string>\n\
  <key>Count</key><integer>3</integer>\n\
  <key>IsXcodeManaged</key><true/>\n\
  <key>Platform</key><array><string>iOS</string><string>xrOS</string></array>\n\
  <key>Entitlements</key><dict><key>get-task-allow</key><true/></dict>\n\
</dict>\n\
</plist>";

    #[test]
    fn parses_a_representative_profile_plist() {
        let p = Plist::parse(SAMPLE).unwrap();
        assert_eq!(p.get("Name").and_then(Plist::as_str), Some("Chasm & Co"));
        assert_eq!(p.get("UUID").and_then(Plist::as_str), Some("ABCD-1234"));
        assert_eq!(p.get("Count"), Some(&Plist::Integer(3)));
        assert_eq!(p.get("IsXcodeManaged").and_then(Plist::as_bool), Some(true));
        assert_eq!(
            p.get("Platform").unwrap().as_str_array(),
            vec!["iOS".to_string(), "xrOS".to_string()]
        );
        let ent = p.get("Entitlements").unwrap();
        assert_eq!(ent.get("get-task-allow").and_then(Plist::as_bool), Some(true));
    }

    #[test]
    fn empty_array_and_dict_parse() {
        assert_eq!(
            Plist::parse("<plist version=\"1.0\"><array></array></plist>").unwrap(),
            Plist::Array(vec![])
        );
        assert_eq!(
            Plist::parse("<dict></dict>").unwrap(),
            Plist::Dict(vec![])
        );
    }
}

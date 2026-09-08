//! A minimal, dependency-free JSON reader.
//!
//! Several Apple tools emit JSON — `simctl list --json`, `notarytool
//! --output-format json`, `xcresulttool get --format json`, SwiftPM's
//! `Package.resolved`. Parsing their *structured* output is more robust than
//! scraping the human-readable form (no ambiguity around names containing
//! parentheses, quotes, or newlines). A full serde stack would be a large
//! dependency for that, so this parses the JSON grammar directly against std.
//!
//! It is a reader only: there is no serializer, and numbers are kept as `f64`
//! (adequate for the counts and versions Apple's tools emit).

use crate::error::{Error, Result};

/// A parsed JSON value.
#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    /// `null`
    Null,
    /// `true` / `false`
    Bool(bool),
    /// Any JSON number.
    Number(f64),
    /// A string, with escapes already decoded.
    String(String),
    /// An array.
    Array(Vec<Json>),
    /// An object; insertion order is preserved.
    Object(Vec<(String, Json)>),
}

impl Json {
    /// Parse a complete JSON document.
    pub fn parse(text: &str) -> Result<Json> {
        let b = text.as_bytes();
        let mut p = Parser { b, i: 0 };
        p.skip_ws();
        let v = p.value()?;
        p.skip_ws();
        if p.i != b.len() {
            return Err(Error::InvalidInput(format!(
                "json: trailing input at byte {}",
                p.i
            )));
        }
        Ok(v)
    }

    /// For an `Object`, the value under `key`.
    pub fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Object(kvs) => kvs.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    /// The string, if this is a `String`.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Json::String(s) => Some(s),
            _ => None,
        }
    }

    /// The bool, if this is a `Bool`.
    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Json::Bool(b) => Some(*b),
            _ => None,
        }
    }

    /// The number, if this is a `Number`.
    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Json::Number(n) => Some(*n),
            _ => None,
        }
    }

    /// The elements, if this is an `Array`.
    pub fn as_array(&self) -> Option<&[Json]> {
        match self {
            Json::Array(a) => Some(a),
            _ => None,
        }
    }

    /// The entries, if this is an `Object`.
    pub fn as_object(&self) -> Option<&[(String, Json)]> {
        match self {
            Json::Object(kvs) => Some(kvs),
            _ => None,
        }
    }
}

struct Parser<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Parser<'a> {
    fn skip_ws(&mut self) {
        while self.i < self.b.len() && matches!(self.b[self.i], b' ' | b'\t' | b'\n' | b'\r') {
            self.i += 1;
        }
    }

    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).copied()
    }

    fn err<T>(&self, msg: &str) -> Result<T> {
        Err(Error::InvalidInput(format!("json: {msg} at byte {}", self.i)))
    }

    fn value(&mut self) -> Result<Json> {
        self.skip_ws();
        match self.peek() {
            Some(b'{') => self.object(),
            Some(b'[') => self.array(),
            Some(b'"') => Ok(Json::String(self.string()?)),
            Some(b't') => self.literal("true", Json::Bool(true)),
            Some(b'f') => self.literal("false", Json::Bool(false)),
            Some(b'n') => self.literal("null", Json::Null),
            Some(c) if c == b'-' || c.is_ascii_digit() => self.number(),
            Some(_) => self.err("unexpected character"),
            None => self.err("unexpected end of input"),
        }
    }

    fn literal(&mut self, word: &str, v: Json) -> Result<Json> {
        if self.b[self.i..].starts_with(word.as_bytes()) {
            self.i += word.len();
            Ok(v)
        } else {
            self.err("invalid literal")
        }
    }

    fn object(&mut self) -> Result<Json> {
        self.i += 1; // '{'
        let mut kvs = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b'}') {
            self.i += 1;
            return Ok(Json::Object(kvs));
        }
        loop {
            self.skip_ws();
            if self.peek() != Some(b'"') {
                return self.err("expected object key");
            }
            let k = self.string()?;
            self.skip_ws();
            if self.peek() != Some(b':') {
                return self.err("expected ':'");
            }
            self.i += 1;
            let v = self.value()?;
            kvs.push((k, v));
            self.skip_ws();
            match self.peek() {
                Some(b',') => {
                    self.i += 1;
                }
                Some(b'}') => {
                    self.i += 1;
                    return Ok(Json::Object(kvs));
                }
                _ => return self.err("expected ',' or '}'"),
            }
        }
    }

    fn array(&mut self) -> Result<Json> {
        self.i += 1; // '['
        let mut items = Vec::new();
        self.skip_ws();
        if self.peek() == Some(b']') {
            self.i += 1;
            return Ok(Json::Array(items));
        }
        loop {
            items.push(self.value()?);
            self.skip_ws();
            match self.peek() {
                Some(b',') => {
                    self.i += 1;
                }
                Some(b']') => {
                    self.i += 1;
                    return Ok(Json::Array(items));
                }
                _ => return self.err("expected ',' or ']'"),
            }
        }
    }

    fn string(&mut self) -> Result<String> {
        self.i += 1; // opening quote
        let mut out = String::new();
        loop {
            let c = match self.peek() {
                Some(c) => c,
                None => return self.err("unterminated string"),
            };
            match c {
                b'"' => {
                    self.i += 1;
                    return Ok(out);
                }
                b'\\' => {
                    self.i += 1;
                    let e = match self.peek() {
                        Some(e) => e,
                        None => return self.err("unterminated escape"),
                    };
                    self.i += 1;
                    match e {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'b' => out.push('\u{0008}'),
                        b'f' => out.push('\u{000C}'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        b'u' => {
                            let cp = self.hex4()?;
                            // Handle a surrogate pair when present.
                            if (0xD800..0xDC00).contains(&cp) {
                                if self.b[self.i..].starts_with(b"\\u") {
                                    self.i += 2;
                                    let lo = self.hex4()?;
                                    if (0xDC00..0xE000).contains(&lo) {
                                        let c = 0x10000
                                            + (((cp - 0xD800) as u32) << 10)
                                            + (lo - 0xDC00) as u32;
                                        out.push(char::from_u32(c).unwrap_or('\u{FFFD}'));
                                    } else {
                                        out.push('\u{FFFD}');
                                    }
                                } else {
                                    out.push('\u{FFFD}');
                                }
                            } else {
                                out.push(char::from_u32(cp as u32).unwrap_or('\u{FFFD}'));
                            }
                        }
                        _ => return self.err("invalid escape"),
                    }
                }
                _ => {
                    // Copy the whole UTF-8 sequence.
                    let start = self.i;
                    let len = utf8_len(c);
                    self.i = (self.i + len).min(self.b.len());
                    out.push_str(&String::from_utf8_lossy(&self.b[start..self.i]));
                }
            }
        }
    }

    fn hex4(&mut self) -> Result<u16> {
        if self.i + 4 > self.b.len() {
            return self.err("truncated \\u escape");
        }
        let s = std::str::from_utf8(&self.b[self.i..self.i + 4])
            .map_err(|_| Error::InvalidInput("json: bad \\u escape".into()))?;
        let v = u16::from_str_radix(s, 16)
            .map_err(|_| Error::InvalidInput("json: bad \\u escape".into()))?;
        self.i += 4;
        Ok(v)
    }

    fn number(&mut self) -> Result<Json> {
        let start = self.i;
        if self.peek() == Some(b'-') {
            self.i += 1;
        }
        while matches!(self.peek(), Some(c) if c.is_ascii_digit()) {
            self.i += 1;
        }
        if self.peek() == Some(b'.') {
            self.i += 1;
            while matches!(self.peek(), Some(c) if c.is_ascii_digit()) {
                self.i += 1;
            }
        }
        if matches!(self.peek(), Some(b'e') | Some(b'E')) {
            self.i += 1;
            if matches!(self.peek(), Some(b'+') | Some(b'-')) {
                self.i += 1;
            }
            while matches!(self.peek(), Some(c) if c.is_ascii_digit()) {
                self.i += 1;
            }
        }
        let s = std::str::from_utf8(&self.b[start..self.i])
            .map_err(|_| Error::InvalidInput("json: bad number".into()))?;
        s.parse::<f64>()
            .map(Json::Number)
            .map_err(|_| Error::InvalidInput(format!("json: bad number `{s}`")))
    }
}

/// Byte length of a UTF-8 sequence from its leading byte.
fn utf8_len(b: u8) -> usize {
    if b < 0x80 {
        1
    } else if b >> 5 == 0b110 {
        2
    } else if b >> 4 == 0b1110 {
        3
    } else if b >> 3 == 0b11110 {
        4
    } else {
        1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_objects_and_arrays() {
        let v = Json::parse(
            r#"{ "a": 1, "b": [true, false, null], "c": { "d": "x" } }"#,
        )
        .unwrap();
        assert_eq!(v.get("a").and_then(Json::as_f64), Some(1.0));
        let b = v.get("b").unwrap().as_array().unwrap();
        assert_eq!(b.len(), 3);
        assert_eq!(b[0], Json::Bool(true));
        assert_eq!(b[2], Json::Null);
        assert_eq!(
            v.get("c").and_then(|c| c.get("d")).and_then(Json::as_str),
            Some("x")
        );
    }

    #[test]
    fn decodes_string_escapes_including_unicode() {
        // Built with doubled backslashes so the *parser* sees real JSON
        // escapes, including a \u codepoint and a surrogate pair.
        let input = "\"a\\nb\\tc\\\"d\\/e\\u0041f\\ud83d\\ude00\"";
        let s = Json::parse(input).unwrap();
        assert_eq!(s.as_str().unwrap(), "a\nb\tc\"d/eAf\u{1F600}");
    }

    #[test]
    fn handles_numbers_and_empty_containers() {
        assert_eq!(Json::parse("-12.5e2").unwrap(), Json::Number(-1250.0));
        assert_eq!(Json::parse("{}").unwrap(), Json::Object(vec![]));
        assert_eq!(Json::parse("[]").unwrap(), Json::Array(vec![]));
    }

    #[test]
    fn rejects_malformed_input() {
        assert!(Json::parse("{\"a\": }").is_err());
        assert!(Json::parse("[1, 2").is_err());
        assert!(Json::parse("{} trailing").is_err());
        assert!(Json::parse("\"unterminated").is_err());
    }

    #[test]
    fn non_ascii_text_survives_intact() {
        let v = Json::parse(r#"{"name":"iPhone SE (3ª geração) — café"}"#).unwrap();
        assert_eq!(
            v.get("name").and_then(Json::as_str),
            Some("iPhone SE (3ª geração) — café")
        );
    }
}

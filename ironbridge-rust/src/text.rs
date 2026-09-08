// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

//! Text helpers for display.
//!
//! # Why this exists
//!
//! Rust's `&s[..n]` slices **bytes**, and panics if `n` lands inside a
//! multi-byte character or past the end. The obvious-looking idiom
//!
//! ```ignore
//! if s.len() > 60 { format!("{}...", &s[..57]) } else { s.clone() }
//! ```
//!
//! guards the *length* and then slices *bytes*, so it is correct for ASCII
//! and crashes on anything else. Chat session titles, JSON values and file
//! paths are exactly the strings most likely to contain non-ASCII, and this
//! pattern had been copied to several places.

/// Shorten `s` to at most `max_chars` characters, appending an ellipsis.
///
/// Counts characters, not bytes, so it never splits one. `max_chars` is the
/// budget for the **whole** result including the `...`, which is what callers
/// laying out a fixed-width column actually want.
///
/// A `max_chars` below 4 leaves no room for both an ellipsis and content, so
/// the result is just the first `max_chars` characters.
pub fn truncate(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        return s.to_string();
    }
    if max_chars < 4 {
        return s.chars().take(max_chars).collect();
    }
    let head: String = s.chars().take(max_chars - 3).collect();
    head + "..."
}

/// The first `max_chars` characters of `s`, with no ellipsis.
///
/// For identifiers and hashes, where a trailing `...` is noise and the caller
/// usually adds its own. Never panics on a short string -- it yields whatever
/// is there, which beats crashing a listing because one id was unusually
/// short.
pub fn head(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_strings_are_returned_unchanged() {
        assert_eq!(truncate("hello", 60), "hello");
        assert_eq!(truncate("", 60), "");
    }

    #[test]
    fn a_string_exactly_at_the_limit_is_not_truncated() {
        let s = "a".repeat(60);
        assert_eq!(truncate(&s, 60), s);
    }

    #[test]
    fn a_long_string_is_cut_and_marked() {
        let out = truncate(&"a".repeat(100), 60);
        assert_eq!(out.chars().count(), 60);
        assert!(out.ends_with("..."));
    }

    /// The bug this module exists for: the old `&s[..57]` panicked here,
    /// because byte 57 of a run of 3-byte characters is not a boundary.
    #[test]
    fn multibyte_text_is_truncated_without_panicking() {
        let cjk = "日".repeat(100);
        let out = truncate(&cjk, 60);
        assert_eq!(out.chars().count(), 60);
        assert!(out.ends_with("..."));

        let emoji = "🎉".repeat(100);
        assert_eq!(truncate(&emoji, 20).chars().count(), 20);
    }

    /// Mixed-width text is where an off-by-one in the char/byte distinction
    /// hides: the byte length and the character count differ, but only for
    /// part of the string.
    #[test]
    fn mixed_ascii_and_multibyte_text_is_counted_in_characters() {
        let s = format!("{}{}", "a".repeat(30), "日".repeat(30));
        assert!(s.len() > s.chars().count(), "fixture should be mixed-width");
        assert_eq!(truncate(&s, 40).chars().count(), 40);
    }

    #[test]
    fn a_budget_too_small_for_an_ellipsis_still_returns_something() {
        for n in 0..4 {
            let out = truncate("abcdefgh", n);
            assert_eq!(out.chars().count(), n, "n={n}");
        }
    }

    /// `head` must not panic when the string is shorter than asked for --
    /// that is what crashed the `basic_usage` example on a 9-character
    /// workspace hash.
    #[test]
    fn head_of_a_short_string_is_the_whole_string() {
        assert_eq!(head("abc", 12), "abc");
        assert_eq!(head("", 8), "");
        assert_eq!(head("abcdefghijklmno", 12).chars().count(), 12);
    }

    #[test]
    fn head_does_not_split_a_multibyte_character() {
        assert_eq!(head(&"日".repeat(20), 5), "日".repeat(5));
    }
}

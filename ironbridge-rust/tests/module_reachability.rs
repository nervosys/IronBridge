// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

//! Every `.rs` file under `src/` must be reachable from a crate root.
//!
//! # Why this test exists
//!
//! A `.rs` file that no `mod` declaration names is not compiled. rustc never
//! reads it, so `cargo build`, `cargo clippy` and `cargo test` all pass while
//! the file rots: it keeps calling functions that were renamed, reading struct
//! fields that were deleted, and importing crates that were dropped from
//! `Cargo.toml`. Nothing complains, because nothing is looking.
//!
//! It has happened three times here. `api/handlers.rs` carried 24 `"not yet
//! implemented"` stubs for endpoints that were live elsewhere. Seven provider
//! files -- 2,728 lines advertising GPT4All, Jan, Llamafile, LM Studio,
//! LocalAI, Text Generation WebUI and vLLM -- turned out to produce 137 compile
//! errors the moment they were declared, having been written against a
//! `ChatSession` model that no longer existed. And `src/enterprise/` is 2,044
//! lines that the README describes as shipped features.
//!
//! The first two were found by hand, long after the fact. The third was found
//! by the first run of this test. That is the argument for it.
//!
//! # Scope
//!
//! All three crates -- `ironbridge-rust`, `ironbridge-sso` and `ironbridge-desktop`. The other
//! two were clean when they were added here, and are covered so they stay that
//! way; this failure mode is not a property of a large crate, only of nobody
//! looking.
//!
//! # What it does not check
//!
//! Reachability, not usefulness. A module that is declared but whose functions
//! are never called is dead in a different sense, and `dead_code` warnings are
//! the tool for that. This test only asserts that the compiler has an opinion
//! about every file in the tree.

use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};

/// Every crate in the repository, and the roots each one compiles from.
///
/// Paths are relative to the repository root. The roots are the `[lib]` and
/// `[[bin]]` targets in each `Cargo.toml`; keep them in step with that file.
///
/// `ironbridge-sso` and `ironbridge-desktop` were clean when this test was extended to
/// cover them, and are listed so they stay that way. Rot of this kind is not a
/// property of a large crate -- it is a property of nobody looking.
const CRATES: &[(&str, &[&str])] = &[
    (
        "ironbridge-rust",
        &["src/lib.rs", "src/main.rs", "src/mcp/main.rs"],
    ),
    ("ironbridge-sso", &["src/lib.rs"]),
    ("ironbridge-desktop", &["src/main.rs"]),
];

/// Orphans that are known, deliberate, and waiting on a decision.
///
/// This list is a holding pen, not an exemption. Anything in it is still not
/// compiled; it is here so the test can guard against *new* orphans without
/// pretending the existing ones are fine.
///
/// It is currently empty, and the guard below is what keeps it honest.
///
/// `src/enterprise/` used to be its only occupant: four files, 2,250 lines of
/// multi-tenancy, white-labelling and a compliance framework, left orphaned
/// because wiring them means routes and persistence while deleting them
/// throws away working code -- a product call, deliberately deferred.
///
/// That call is still open, and declaring `pub mod enterprise` behind the
/// `enterprise` feature does not make it. Nothing routes, persists or calls
/// any of it. What changed is only that rustc, clippy and rustfmt can now see
/// it, and its eleven tests run.
///
/// Leaving it out had a cost that is easy to miss: an orphan cannot rot
/// *detectably*. Appending `this is not valid rust at all !!!` to
/// `compliance.rs` and building both feature sets produced no error, because
/// no `mod` declaration reached the file. Two thousand lines the compiler has
/// never read are not preserved work; they are work nobody can any longer
/// vouch for. Declaring the module is the cheapest way to keep the option
/// open while the decision waits.
///
/// Note that `README.md` documents all three as Enterprise Features.
const KNOWN_ORPHANS: &[&str] = &[];

/// The repository root, reached from this crate's manifest directory.
///
/// The test lives in `ironbridge-rust` but covers every crate, because there is no
/// workspace `Cargo.toml` to hang a shared test off and one guard that sees
/// everything beats three that each see a third.
fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("ironbridge-rust has a parent directory")
        .to_path_buf()
}

/// Strip `//` comments and the contents of string literals.
///
/// Without this, a commented-out `// mod jan;` would read as a declaration and
/// the test would report the file as reachable -- failing in the one direction
/// that matters. Block comments are left alone: `/* mod x; */` is rare enough,
/// and treating it as a declaration is the same false-negative, so if it ever
/// shows up it should be deleted rather than accommodated.
fn strip_noise(source: &str) -> String {
    let mut out = String::with_capacity(source.len());

    for line in source.lines() {
        let mut in_string = false;
        let mut prev = '\0';

        for (i, c) in line.char_indices() {
            if c == '"' && prev != '\\' {
                in_string = !in_string;
            }
            if !in_string && c == '/' && line[i..].starts_with("//") {
                break;
            }
            out.push(c);
            prev = c;
        }
        out.push('\n');
    }

    out
}

/// The module names declared by one file, in declaration order.
///
/// Matches `mod foo;` and `pub mod foo;`, with or without a visibility
/// qualifier or leading attributes. An inline `mod tests { ... }` has no
/// semicolon and so is correctly ignored -- it declares no separate file.
fn declared_mods(source: &str) -> Vec<String> {
    let cleaned = strip_noise(source);
    let mut names = Vec::new();

    for stmt in cleaned.split(';') {
        // The declaration is the last `mod <name>` before the semicolon.
        let Some(idx) = stmt.rfind("mod ") else {
            continue;
        };

        // `mod` must be a word, not the tail of an identifier such as
        // `checked_mod ` -- and the character before it must not make this a
        // `use` path segment.
        let before = stmt[..idx].chars().next_back().unwrap_or(' ');
        if before.is_alphanumeric() || before == '_' || before == ':' {
            continue;
        }

        let rest = stmt[idx + 4..].trim();
        if rest.is_empty() || !rest.chars().all(|c| c.is_alphanumeric() || c == '_') {
            continue;
        }
        // `use std::mod ...` never happens, but a `use` line reaching here
        // would be a false positive; declarations are statements, so reject
        // anything whose statement contains a `use` keyword.
        if stmt.contains("use ") {
            continue;
        }

        names.push(rest.to_string());
    }

    names
}

/// Where a `mod name;` inside `parent` resolves on disk.
///
/// Rust looks in two places: `dir/name.rs`, and `dir/name/mod.rs`. `dir` is the
/// directory holding `parent`, unless `parent` is itself a root or a `mod.rs`,
/// which is the same thing here.
fn resolve(parent: &Path, name: &str) -> Option<PathBuf> {
    let dir = if parent.file_name()? == "lib.rs"
        || parent.file_name()? == "main.rs"
        || parent.file_name()? == "mod.rs"
    {
        parent.parent()?.to_path_buf()
    } else {
        // `foo.rs` owns the directory `foo/`.
        parent.with_extension("")
    };

    let flat = dir.join(format!("{name}.rs"));
    if flat.is_file() {
        return Some(flat);
    }

    let nested = dir.join(name).join("mod.rs");
    if nested.is_file() {
        return Some(nested);
    }

    None
}

/// Walk out from every crate's roots, collecting the files rustc would read.
fn reachable_files() -> HashSet<PathBuf> {
    let repo = repo_root();
    let mut seen: HashSet<PathBuf> = HashSet::new();
    let mut queue: VecDeque<PathBuf> = VecDeque::new();

    for (krate, roots) in CRATES {
        for root in *roots {
            let path = repo.join(krate).join(root);
            assert!(
                path.is_file(),
                "declared root {krate}/{root} does not exist; \
                 CRATES is out of step with {krate}/Cargo.toml"
            );
            queue.push_back(path);
        }
    }

    while let Some(file) = queue.pop_front() {
        if !seen.insert(file.clone()) {
            continue;
        }

        let source = std::fs::read_to_string(&file)
            .unwrap_or_else(|e| panic!("reading {}: {e}", file.display()));

        for name in declared_mods(&source) {
            if let Some(child) = resolve(&file, &name) {
                queue.push_back(child);
            }
            // A `mod` that resolves to nothing is either `#[path = "..."]` or a
            // genuine error. rustc catches the second, so silence is right
            // here -- this test is about files with no declaration, not
            // declarations with no file.
        }
    }

    seen
}

/// Every `.rs` file physically present under any crate's `src/`.
fn files_on_disk() -> HashSet<PathBuf> {
    fn walk(dir: &Path, out: &mut HashSet<PathBuf>) {
        for entry in std::fs::read_dir(dir).unwrap_or_else(|e| panic!("{}: {e}", dir.display())) {
            let path = entry.expect("readable dir entry").path();
            if path.is_dir() {
                walk(&path, out);
            } else if path.extension().is_some_and(|e| e == "rs") {
                out.insert(path);
            }
        }
    }

    let repo = repo_root();
    let mut out = HashSet::new();
    for (krate, _) in CRATES {
        walk(&repo.join(krate).join("src"), &mut out);
    }
    out
}

/// A repo-relative, forward-slashed path, so failure messages and the
/// `KNOWN_ORPHANS` entries they tell you to write look the same on every OS.
fn display_path(path: &Path) -> String {
    path.strip_prefix(repo_root())
        .unwrap_or(path)
        .display()
        .to_string()
        .replace('\\', "/")
}

#[test]
fn every_source_file_is_compiled() {
    let reachable = reachable_files();
    let on_disk = files_on_disk();

    let known: HashSet<&str> = KNOWN_ORPHANS.iter().copied().collect();

    let mut orphans: Vec<String> = on_disk
        .difference(&reachable)
        .map(|p| display_path(p))
        .filter(|p| !known.contains(p.as_str()))
        .collect();
    orphans.sort();

    assert!(
        orphans.is_empty(),
        "{} source file(s) are never compiled -- no `mod` declaration reaches them, \
         so rustc has never checked a line of them:\n  {}\n\n\
         Either declare them in the parent module or delete them. A file the compiler \
         cannot see will drift out of sync with the code around it and nothing will say so.",
        orphans.len(),
        orphans.join("\n  ")
    );
}

#[test]
fn the_holding_pen_does_not_outlive_its_contents() {
    // Once an orphan is wired in or deleted, its entry here is stale and would
    // silently excuse a future file of the same name. Resolving one means
    // shortening this list.
    let repo = repo_root();
    let reachable = reachable_files();

    for entry in KNOWN_ORPHANS {
        let path = repo.join(entry);
        assert!(
            path.is_file(),
            "{entry} is listed in KNOWN_ORPHANS but no longer exists -- remove the entry"
        );
        assert!(
            !reachable.contains(&path),
            "{entry} is listed in KNOWN_ORPHANS but is now compiled -- remove the entry"
        );
    }
}

#[test]
fn the_walker_finds_something_to_walk() {
    // A guard on the test above: if `resolve` broke and returned `None` for
    // everything, `reachable` would hold only the roots, `orphans` would list
    // the whole crate, and the failure would be obvious. But if `files_on_disk`
    // broke and returned nothing, the difference would be empty and the test
    // would pass while checking nothing at all.
    let on_disk = files_on_disk();
    assert!(
        on_disk.len() > 100,
        "only {} source files found; the directory walk is broken",
        on_disk.len()
    );

    let reachable = reachable_files();
    assert!(
        reachable.len() > 100,
        "only {} reachable files found; the module walk is broken",
        reachable.len()
    );
}

#[test]
fn a_commented_out_declaration_does_not_count() {
    assert_eq!(declared_mods("// mod ghost;\nmod real;"), vec!["real"]);
}

#[test]
fn an_inline_module_is_not_a_file() {
    let source = "mod real;\n#[cfg(test)]\nmod tests {\n    fn helper() {}\n}\n";
    assert_eq!(declared_mods(source), vec!["real"]);
}

#[test]
fn attributes_and_visibility_do_not_hide_a_declaration() {
    let source =
        "#[cfg(feature = \"enterprise\")]\npub mod gated;\n#[allow(dead_code)]\nmod plain;";
    assert_eq!(declared_mods(source), vec!["gated", "plain"]);
}

#[test]
fn a_use_path_is_not_a_declaration() {
    let source = "use crate::mod_helper::thing;\nuse std::fmt;\nmod real;";
    assert_eq!(declared_mods(source), vec!["real"]);
}

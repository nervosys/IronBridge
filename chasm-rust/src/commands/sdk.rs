// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Command implementations for `chasm sdk` subcommands.

use crate::api::sdk::{SdkConfig, SdkGenerator, SdkLanguage};
use anyhow::{bail, Context, Result};
use colored::*;
use std::path::{Path, PathBuf};

/// What each generated client is built against, so `list` and `generate`
/// cannot drift on the version or API version they report.
fn config(base_url: &str) -> SdkConfig {
    SdkConfig {
        version: env!("CARGO_PKG_VERSION").to_string(),
        base_url: base_url.trim_end_matches('/').to_string(),
        languages: SdkLanguage::ALL.to_vec(),
        api_version: "v1".to_string(),
    }
}

/// `chasm sdk list` — Show the languages a client can be generated for
pub fn sdk_list(json: bool) -> Result<()> {
    let generator = SdkGenerator::new(config("http://localhost:8787"));

    if json {
        let rows: Vec<_> = SdkLanguage::ALL
            .iter()
            .map(|lang| {
                serde_json::json!({
                    "language": lang.to_string(),
                    "filename": generator.get_filename(lang),
                })
            })
            .collect();
        println!("{}", serde_json::to_string_pretty(&rows)?);
        return Ok(());
    }

    println!(
        "{} {} languages\n",
        "SDK generator:".bold(),
        SdkLanguage::ALL.len()
    );

    for lang in &SdkLanguage::ALL {
        println!(
            "  {:<8} {}",
            lang.to_string().bold().cyan(),
            generator.get_filename(lang).dimmed()
        );
    }

    println!(
        "\nEach client reads {} and {} from the environment, falling back to\nthe base URL baked in at generation time.",
        "CHASM_BASE_URL".yellow(),
        "CHASM_API_KEY".yellow()
    );

    Ok(())
}

/// `chasm sdk generate` — Write a client for one language, or for all of them
pub fn sdk_generate(
    language: Option<SdkLanguage>,
    all: bool,
    output: Option<&str>,
    stdout: bool,
    base_url: &str,
    force: bool,
) -> Result<()> {
    let targets: Vec<SdkLanguage> = match (all, language) {
        (true, _) => SdkLanguage::ALL.to_vec(),
        (false, Some(lang)) => vec![lang],
        // clap cannot express "one of these two is required" for a positional
        // and a flag, so it is checked here rather than left to produce an
        // empty run that looks like success.
        (false, None) => bail!("specify a language, or --all for every language"),
    };

    let generator = SdkGenerator::new(config(base_url));

    if stdout {
        if targets.len() > 1 {
            bail!("--stdout writes one client; drop --all or pick a language");
        }
        print!("{}", generator.generate(targets[0].clone()));
        return Ok(());
    }

    let dir = PathBuf::from(output.unwrap_or("."));
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .with_context(|| format!("creating output directory {}", dir.display()))?;
    } else if !dir.is_dir() {
        bail!("{} exists and is not a directory", dir.display());
    }

    // Refuse the whole batch before writing any of it, so a collision halfway
    // through does not leave a half-generated directory behind.
    if !force {
        // Names, not full paths: they all share one directory, and eight
        // absolute Windows paths on one line is not a readable error.
        let existing: Vec<String> = targets
            .iter()
            .map(|lang| generator.get_filename(lang))
            .filter(|name| dir.join(name).exists())
            .collect();

        if !existing.is_empty() {
            bail!(
                "refusing to overwrite {} existing file(s) in {}: {}\nre-run with --force to replace them",
                existing.len(),
                dir.display(),
                existing.join(", ")
            );
        }
    }

    for lang in &targets {
        let path = dir.join(generator.get_filename(lang));
        let source = generator.generate(lang.clone());
        write_client(&path, &source)?;
        println!(
            "  {} {:<8} {} ({} bytes)",
            "wrote".green(),
            lang.to_string().bold(),
            path.display(),
            source.len()
        );
    }

    println!(
        "\n{} client(s) generated against {}",
        targets.len(),
        base_url.trim_end_matches('/').bold()
    );

    Ok(())
}

fn write_client(path: &Path, source: &str) -> Result<()> {
    std::fs::write(path, source).with_context(|| format!("writing {}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    /// Generating every language must produce eight distinct, non-empty files.
    /// The bug this guards is the one the generator used to have: a caller got
    /// a file back and had no way to tell it was a one-line placeholder.
    #[test]
    fn generate_all_writes_every_language() {
        let dir = tempdir().unwrap();
        let out = dir.path().to_str().unwrap();

        sdk_generate(None, true, Some(out), false, "http://localhost:8787", false).unwrap();

        let generator = SdkGenerator::new(config("http://localhost:8787"));
        for lang in &SdkLanguage::ALL {
            let path = dir.path().join(generator.get_filename(lang));
            let body = std::fs::read_to_string(&path)
                .unwrap_or_else(|_| panic!("{lang} was not written to {}", path.display()));
            assert!(
                body.len() > 1000,
                "{lang} produced only {} bytes",
                body.len()
            );
            assert!(
                !body.contains("not yet implemented"),
                "{lang} still emits placeholder text"
            );
        }
    }

    /// A second run must not silently clobber hand-edited files.
    #[test]
    fn generate_refuses_to_overwrite_without_force() {
        let dir = tempdir().unwrap();
        let out = dir.path().to_str().unwrap();
        let path = dir.path().join("chasm.go");

        sdk_generate(
            Some(SdkLanguage::Go),
            false,
            Some(out),
            false,
            "http://localhost:8787",
            false,
        )
        .unwrap();
        std::fs::write(&path, "// edited by hand").unwrap();

        let err = sdk_generate(
            Some(SdkLanguage::Go),
            false,
            Some(out),
            false,
            "http://localhost:8787",
            false,
        )
        .unwrap_err();
        assert!(err.to_string().contains("refusing to overwrite"));
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "// edited by hand",
            "the refusal must leave the file untouched"
        );

        sdk_generate(
            Some(SdkLanguage::Go),
            false,
            Some(out),
            false,
            "http://localhost:8787",
            true,
        )
        .unwrap();
        assert!(std::fs::read_to_string(&path)
            .unwrap()
            .contains("package chasm"));
    }

    /// A collision anywhere in a batch must abort before anything is written.
    #[test]
    fn a_batch_collision_writes_nothing() {
        let dir = tempdir().unwrap();
        let out = dir.path().to_str().unwrap();
        std::fs::write(dir.path().join("Chasm.java"), "// mine").unwrap();

        let err =
            sdk_generate(None, true, Some(out), false, "http://localhost:8787", false).unwrap_err();
        assert!(err.to_string().contains("refusing to overwrite"));

        assert!(
            !dir.path().join("chasm.py").exists(),
            "the batch wrote a file despite aborting"
        );
        assert_eq!(
            std::fs::read_to_string(dir.path().join("Chasm.java")).unwrap(),
            "// mine"
        );
    }

    /// The base URL reaches the generated source, and a trailing slash does
    /// not survive into a client that concatenates paths onto it.
    #[test]
    fn base_url_is_baked_in_without_a_trailing_slash() {
        let dir = tempdir().unwrap();
        let out = dir.path().to_str().unwrap();

        sdk_generate(
            Some(SdkLanguage::Ruby),
            false,
            Some(out),
            false,
            "https://chasm.example.com/",
            false,
        )
        .unwrap();

        let body = std::fs::read_to_string(dir.path().join("chasm.rb")).unwrap();
        assert!(body.contains("https://chasm.example.com'"));
        assert!(!body.contains("chasm.example.com/'"));
    }

    /// Neither a language nor --all must fail loudly rather than no-op.
    #[test]
    fn generate_without_a_target_is_an_error() {
        let err =
            sdk_generate(None, false, None, true, "http://localhost:8787", false).unwrap_err();
        assert!(err.to_string().contains("specify a language"));
    }

    /// --stdout cannot mean eight files on one stream.
    #[test]
    fn stdout_refuses_a_batch() {
        let err = sdk_generate(None, true, None, true, "http://localhost:8787", false).unwrap_err();
        assert!(err.to_string().contains("--stdout writes one client"));
    }

    /// Every `--value-enum` name must match what Display prints, or the docs
    /// and the CLI disagree about what to type.
    #[test]
    fn value_enum_names_match_display() {
        use clap::ValueEnum;
        for lang in &SdkLanguage::ALL {
            let name = lang.to_possible_value().unwrap();
            assert_eq!(name.get_name(), lang.to_string());
        }
    }
}

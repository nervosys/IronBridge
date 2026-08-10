// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Conversation analysis command.

use anyhow::{Context, Result};
use colored::*;
use std::path::Path;

use crate::intelligence::{AnalysisSource, Analyzer, SessionAnalysis};
use crate::storage::parse_session_file;

/// Analyze one session file.
///
/// `require_model` turns the usual heuristic fallback into an error. Scripts
/// that treat the summary as meaningful need to know they got inference and
/// not a keyword count, and the two are indistinguishable once the text is
/// printed.
pub async fn analyze_session_file(file: &str, json: bool, require_model: bool) -> Result<()> {
    let path = Path::new(file);
    let session = parse_session_file(path)
        .with_context(|| format!("could not parse session file: {}", file))?;

    let analyzer = Analyzer::from_env();

    let analysis: SessionAnalysis = if require_model {
        analyzer.analyze_with_model(&session).await.map_err(|e| {
            anyhow::anyhow!(
                "{}\n\nSet OPENAI_API_KEY, or drop --require-model to fall back \
                 to offline heuristics.",
                e
            )
        })?
    } else {
        analyzer.analyze(&session).await
    };

    if json {
        println!("{}", serde_json::to_string_pretty(&analysis)?);
        return Ok(());
    }

    print_analysis(&analysis);
    Ok(())
}

fn print_analysis(analysis: &SessionAnalysis) {
    println!("\n{} Session Analysis", "[A]".blue().bold());
    println!("{}", "=".repeat(60));

    // Stated up front rather than buried: heuristic output looks like real
    // analysis until you know it only recognises two languages.
    match analysis.source {
        AnalysisSource::Model => {
            println!("   Source: {}", "language model".green());
        }
        AnalysisSource::Heuristic => {
            println!("   Source: {}", "offline heuristics".yellow());
            println!(
                "           {}",
                "keyword matching only - set OPENAI_API_KEY for real analysis".dimmed()
            );
        }
    }

    if !analysis.summary.is_empty() {
        println!("\n{}", "Summary".bold());
        println!("   {}", analysis.summary);
    }

    println!("\n{}", "Sentiment".bold());
    println!(
        "   {} (score {:.2}, confidence {:.2})",
        analysis.sentiment.label, analysis.sentiment.score, analysis.sentiment.confidence
    );

    println!("\n{}", "Topics".bold());
    if analysis.topics.is_empty() {
        println!("   {}", "none identified".dimmed());
    } else {
        for topic in &analysis.topics {
            println!("   * {} ({:.0}%)", topic.name, topic.confidence * 100.0);
            if !topic.keywords.is_empty() {
                println!("     {}", topic.keywords.join(", ").dimmed());
            }
        }
    }

    println!("\n{}", "Key Points".bold());
    if analysis.key_points.is_empty() {
        println!("   {}", "none identified".dimmed());
    } else {
        for point in &analysis.key_points {
            println!(
                "   * [{}] {} ({:.0}%)",
                point.category,
                point.summary,
                point.importance * 100.0
            );
        }
    }
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_missing_file_is_an_error_not_an_empty_analysis() {
        let err = analyze_session_file("does-not-exist.json", true, false)
            .await
            .unwrap_err();
        assert!(err.to_string().contains("could not parse session file"));
    }

    #[tokio::test]
    async fn require_model_without_a_key_explains_the_fix() {
        // Guard against a key in the developer's environment turning this
        // into a live API call.
        if std::env::var("OPENAI_API_KEY").is_ok_and(|k| !k.trim().is_empty()) {
            return;
        }
        // A fresh directory per run, not a fixed name under the system temp:
        // the shared path outlives the test, and once anything leaves it in a
        // bad state -- a crashed run, a lock, a stray permission -- every
        // later run of this test fails for a reason that has nothing to do
        // with what it is testing.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.json");
        std::fs::write(&path, r#"{"requests":[{"message":{"text":"hi"}}]}"#).unwrap();

        let err = analyze_session_file(path.to_str().unwrap(), true, true)
            .await
            .unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("OPENAI_API_KEY"), "unhelpful error: {}", msg);
    }
}

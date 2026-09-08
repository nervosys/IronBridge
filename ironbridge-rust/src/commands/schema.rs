// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Command implementations for `ironbridge schema` subcommands.

use crate::schema::{Ontology, RelationshipKind, SchemaRegistry, SemanticTag};
use crate::workspace;
use anyhow::{Context, Result};
use colored::*;
use std::path::Path;

/// `ironbridge schema list` — List all known provider schemas
pub fn schema_list(provider: Option<&str>, json: bool) -> Result<()> {
    let registry = SchemaRegistry::new();
    let schemas = match provider {
        Some(p) => registry.schemas_for_provider(p),
        None => registry.list_schemas(),
    };

    if json {
        let json_schemas: Vec<_> = schemas
            .iter()
            .map(|s: &&crate::schema::ProviderSchema| {
                serde_json::json!({
                    "id": s.id(),
                    "provider": s.version.provider,
                    "format": s.version.format.as_str(),
                    "version": s.version.version,
                    "label": s.version.label,
                    "fields": s.field_count(),
                    "db_keys": s.db_keys.len(),
                    "extension_min": s.extension_version_min,
                    "extension_max": s.extension_version_max,
                    "host_min": s.host_version_min,
                    "introduced": s.introduced,
                    "deprecated": s.deprecated,
                    "tags": s.tags,
                })
            })
            .collect();

        println!("{}", serde_json::to_string_pretty(&json_schemas)?);
        return Ok(());
    }

    println!(
        "{} {} registered schemas\n",
        "Schema Registry:".bold(),
        schemas.len()
    );

    for schema in &schemas {
        let status = if schema.deprecated.is_some() {
            "DEPRECATED".red()
        } else {
            "ACTIVE".green()
        };

        println!(
            "  {} {} [{}]",
            schema.id().bold().cyan(),
            schema.version.label.dimmed(),
            status
        );

        // Version range
        if let (Some(min), Some(max)) =
            (&schema.extension_version_min, &schema.extension_version_max)
        {
            println!("    Extension: {} – {}", min, max);
        } else if let Some(min) = &schema.extension_version_min {
            println!("    Extension: {}+", min);
        }

        if let Some(host) = &schema.host_version_min {
            println!("    Host:      VS Code {}", host);
        }

        println!(
            "    Format:    {} | {} fields | {} DB keys",
            schema.version.format.as_str(),
            schema.field_count(),
            schema.db_keys.len()
        );

        if let Some(intro) = &schema.introduced {
            print!("    Introduced: {}", intro);
            if let Some(dep) = &schema.deprecated {
                print!(" | Deprecated: {}", dep);
            }
            println!();
        }

        println!("    Tags:      {}", schema.tags.join(", ").dimmed());
        println!();
    }

    Ok(())
}

/// `ironbridge schema show` — Show detailed schema for a specific version
pub fn schema_show(schema_id: &str, json: bool) -> Result<()> {
    let registry = SchemaRegistry::new();

    let schema = registry.get_schema(schema_id).ok_or_else(|| {
        anyhow::anyhow!(
            "Unknown schema: '{}'. Use 'ironbridge schema list' to see available schemas.",
            schema_id
        )
    })?;

    if json {
        println!("{}", serde_json::to_string_pretty(schema)?);
        return Ok(());
    }

    println!("{}", format!("Schema: {}", schema.id()).bold().cyan());
    println!("{}", "=".repeat(60));
    println!("  Label:   {}", schema.version.label);
    println!("  Provider: {}", schema.version.provider);
    println!("  Format:  {}", schema.version.format);
    println!("  Version: {}", schema.version.version);

    if let (Some(min), Some(max)) = (&schema.extension_version_min, &schema.extension_version_max) {
        println!("  Extension Range: {} – {}", min, max);
    } else if let Some(min) = &schema.extension_version_min {
        println!("  Extension: {}+", min);
    }

    if let Some(host) = &schema.host_version_min {
        println!("  Host Min: VS Code {}", host);
    }

    // Storage
    println!("\n{}", "Storage".bold());
    println!("  {}", schema.storage.description);
    println!("  Pattern: {}", schema.storage.path_pattern.dimmed());
    for (platform, path) in &schema.storage.platform_paths {
        println!("    {}: {}", platform, path.as_str().dimmed());
    }

    // Session fields
    println!(
        "\n{} ({} fields)",
        "Session Fields".bold(),
        schema.session_schema.fields.len()
    );
    for field in &schema.session_schema.fields {
        let req = if field.required { "*" } else { " " };
        let tag = field
            .semantic_tag
            .as_deref()
            .map(|t| format!(" [{}]", t))
            .unwrap_or_default();

        println!(
            "  {} {} : {}{}",
            req,
            field.name.bold(),
            field.data_type,
            tag.dimmed()
        );
        println!("    {}", field.description.dimmed());
    }

    // Nested objects
    for (name, fields) in &schema.session_schema.nested_objects {
        println!(
            "\n{} ({} fields)",
            format!("  {}", name).bold(),
            fields.len()
        );
        for field in fields {
            let req = if field.required { "*" } else { " " };
            println!("    {} {} : {}", req, field.name.bold(), field.data_type);
            println!("      {}", field.description.dimmed());
        }
    }

    // DB keys
    if !schema.db_keys.is_empty() {
        println!(
            "\n{} ({} keys)",
            "Database Keys".bold(),
            schema.db_keys.len()
        );
        for key in &schema.db_keys {
            let req = if key.required { "*" } else { " " };
            println!("  {} {}", req, key.key.bold().yellow());
            println!("    {}", key.description.dimmed());
            if !key.value_fields.is_empty() {
                for vf in &key.value_fields {
                    println!("    • {} : {}", vf.name, vf.data_type);
                }
            }
        }
    }

    // Notes
    if !schema.notes.is_empty() {
        println!("\n{}", "Notes".bold());
        for note in &schema.notes {
            println!("  • {}", note);
        }
    }

    // Breaking changes
    if !schema.breaking_changes.is_empty() {
        println!("\n{}", "Breaking Changes".bold().red());
        for change in &schema.breaking_changes {
            println!("  \u{26a0} {}", change.as_str().yellow());
        }
    }

    // Example
    if let Some(example) = &schema.session_schema.example {
        println!("\n{}", "Example".bold());
        println!("{}", serde_json::to_string_pretty(example)?);
    }

    Ok(())
}

/// `ironbridge schema detect` — Auto-detect schema for a workspace or file
pub fn schema_detect(path: Option<&str>, workspace_id: Option<&str>, json: bool) -> Result<()> {
    let registry = SchemaRegistry::new();

    let detected = if let Some(ws_id) = workspace_id {
        // Resolve by workspace hash
        let storage_path = workspace::get_workspace_storage_path()?;
        let ws_dir = storage_path.join(ws_id);
        if !ws_dir.exists() {
            anyhow::bail!("Workspace directory not found: {}", ws_dir.display());
        }
        registry.detect_schema_from_workspace(&ws_dir)?
    } else {
        // Resolve by path
        let resolved_path = resolve_detect_path(path)?;
        let p = Path::new(&resolved_path);

        if p.is_dir() {
            // Check if this is a workspace storage dir or project path
            if p.join("chatSessions").exists() {
                registry.detect_schema_from_workspace(p)?
            } else {
                // Try to find the workspace for this project path
                if let Some((_hash, ws_path, _title)) =
                    workspace::find_workspace_by_path(&resolved_path)?
                {
                    registry.detect_schema_from_workspace(&ws_path)?
                } else {
                    anyhow::bail!(
                        "No workspace found for project path: {}. Use --workspace-id instead.",
                        resolved_path
                    );
                }
            }
        } else {
            // Single file
            registry.detect_schema_from_file(p)?
        }
    };

    if json {
        println!("{}", serde_json::to_string_pretty(&detected)?);
        return Ok(());
    }

    let confidence_color = if detected.confidence >= 0.9 {
        "green"
    } else if detected.confidence >= 0.7 {
        "yellow"
    } else {
        "red"
    };

    println!("{}", "Schema Detection Result".bold());
    println!("{}", "-".repeat(40));
    println!("  Schema:     {}", detected.schema_id.bold().cyan());
    let pct_str = format!("{:.0}%", detected.confidence * 100.0);
    let colored_confidence = match confidence_color {
        "green" => pct_str.green(),
        "yellow" => pct_str.yellow(),
        _ => pct_str.red(),
    };
    println!("  Confidence: {}", colored_confidence);

    if let Some(ver) = &detected.detected_version {
        println!("  Extension:  {}", ver);
    }

    println!("\n  {}", "Evidence:".bold());
    for ev in &detected.evidence {
        println!("    • {}", ev);
    }

    // Show schema summary if found
    if let Some(schema) = registry.get_schema(&detected.schema_id) {
        println!("\n  {}", "Schema Details:".bold());
        println!("    Label:  {}", schema.version.label);
        println!("    Format: {}", schema.version.format);
        println!("    Fields: {}", schema.field_count());
        if !schema.db_keys.is_empty() {
            println!("    DB Keys: {}", schema.db_keys.len());
        }
    }

    Ok(())
}

/// `ironbridge schema export` — Export full registry + ontology as JSON
pub fn schema_export(compact: bool, output: Option<&str>) -> Result<()> {
    let registry = SchemaRegistry::new();

    let json = if compact {
        registry.to_json_compact()?
    } else {
        registry.to_json()?
    };

    if let Some(output_path) = output {
        std::fs::write(output_path, &json)?;
        println!("Schema registry exported to {}", output_path);
    } else {
        println!("{}", json);
    }

    Ok(())
}

/// `ironbridge schema ontology` — Show the ontology (entity types, relationships, semantic tags)
pub fn schema_ontology(json_output: bool) -> Result<()> {
    let ontology = Ontology::build();

    if json_output {
        println!("{}", serde_json::to_string_pretty(&ontology)?);
        return Ok(());
    }

    println!(
        "{}",
        format!("Ontology v{}", ontology.version).bold().cyan()
    );
    println!("{}", "=".repeat(60));

    // Entity types
    let entity_types = ontology.entity_types();
    println!("\n{} ({})", "Entity Types".bold(), entity_types.len());
    for et in &entity_types {
        println!("  • {}", et);
    }

    // Relationships
    println!(
        "\n{} ({})",
        "Relationships".bold(),
        ontology.relationships.len()
    );
    for rel in &ontology.relationships {
        let arrow = match rel.kind {
            RelationshipKind::Contains => "──contains──▶",
            RelationshipKind::BelongsTo => "──belongs_to──▶",
            RelationshipKind::References => "──references──▶",
            RelationshipKind::MapsTo => "──maps_to──▶",
        };
        println!("  {} {} {}", rel.from, arrow, rel.to);
    }

    // Semantic tags by entity
    println!(
        "\n{} ({})",
        "Semantic Tags".bold(),
        ontology.semantic_tags.len()
    );
    let mut tags_by_entity: std::collections::HashMap<String, Vec<&SemanticTag>> =
        std::collections::HashMap::new();
    for tag in &ontology.semantic_tags {
        tags_by_entity
            .entry(format!("{}", tag.entity))
            .or_default()
            .push(tag);
    }
    let mut entity_keys: Vec<_> = tags_by_entity.keys().cloned().collect();
    entity_keys.sort();
    for entity in &entity_keys {
        println!("\n  {}:", entity.as_str().bold());
        for tag in &tags_by_entity[entity] {
            println!(
                "    {} : {} — {}",
                tag.tag.cyan(),
                tag.canonical_type,
                tag.description.dimmed()
            );
        }
    }

    // Cross-provider mappings summary
    println!(
        "\n{} ({})",
        "Cross-Provider Mappings".bold(),
        ontology.mappings.len()
    );
    // Group by source→target pair
    let mut mapping_groups: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();
    for m in &ontology.mappings {
        let key = format!("{} → {}", m.source_schema, m.target_schema);
        *mapping_groups.entry(key).or_default() += 1;
    }
    for (pair, count) in &mapping_groups {
        println!("  {} ({} field mappings)", pair, count);
    }

    // Migration paths
    println!(
        "\n{} ({})",
        "Migration Paths".bold(),
        ontology.migration_paths.len()
    );
    for path in &ontology.migration_paths {
        let lossless = if path.lossless {
            "lossless".green()
        } else {
            "lossy".yellow()
        };
        println!("  {} → {} [{}]", path.from_schema, path.to_schema, lossless);
        if !path.data_loss.is_empty() {
            for loss in &path.data_loss {
                println!("    \u{26a0} {}", loss.as_str().dimmed());
            }
        }
    }

    // Capability matrix
    println!("\n{}", "Provider Capabilities".bold());
    for (provider, caps) in &ontology.capabilities {
        println!(
            "  {}: {}",
            provider.as_str().bold(),
            caps.join(", ").dimmed()
        );
    }

    Ok(())
}

/// `ironbridge schema mappings` — Show cross-provider field mappings
pub fn schema_mappings(
    source: Option<&str>,
    target: Option<&str>,
    tag: Option<&str>,
    json_output: bool,
) -> Result<()> {
    let ontology = Ontology::build();

    let mappings: Vec<_> = if let (Some(s), Some(t)) = (source, target) {
        ontology.cross_provider_mappings(s, t)
    } else if let Some(tag_name) = tag {
        ontology.find_by_semantic_tag(tag_name)
    } else {
        ontology.mappings.iter().collect()
    };

    if json_output {
        println!("{}", serde_json::to_string_pretty(&mappings)?);
        return Ok(());
    }

    println!(
        "{} {} mappings\n",
        "Cross-Provider Field Mappings:".bold(),
        mappings.len()
    );

    for m in &mappings {
        let confidence = format!("{:.0}%", m.confidence * 100.0);
        let conf_color = if m.confidence >= 0.9 {
            confidence.green()
        } else if m.confidence >= 0.7 {
            confidence.yellow()
        } else {
            confidence.red()
        };

        println!(
            "  {} → {}",
            format!("{}.{}", m.source_schema, m.source_field).cyan(),
            format!("{}.{}", m.target_schema, m.target_field).green(),
        );
        println!(
            "    Tag: {} | Confidence: {} | Transform: {}",
            m.semantic_tag.bold(),
            conf_color,
            match &m.transform {
                Some(t) => format!("{:?}", t),
                None => "none".into(),
            }
            .dimmed()
        );
    }

    Ok(())
}

// ============================================================================
// Helpers
// ============================================================================

fn resolve_detect_path(path: Option<&str>) -> Result<String> {
    match path {
        Some(p) => Ok(p.to_string()),
        None => {
            let cwd = std::env::current_dir().context("Failed to get current directory")?;
            Ok(cwd.to_string_lossy().to_string())
        }
    }
}

// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Chat System Manager (csm) - Main entry point
//!
//! A CLI tool to manage and merge chat sessions across workspaces.

#![allow(clippy::upper_case_acronyms)]
#![allow(clippy::type_complexity)]
#![allow(dead_code)]
#![allow(unused_imports)]

// These come from the library crate rather than being re-declared with
// `mod`. Declaring them here compiled a second, independent copy of every
// module into the binary: slower builds, and unit tests inside them ran twice
// (once under `lib.rs`, once under `main.rs`), inflating the reported test
// count. `crate::` paths inside the modules resolve against the library
// either way.
use chasm::{
    agency, api, browser, cli, commands, copilot_version, database, error, mcp, models, providers,
    schema, storage, telemetry, tui, workspace,
};

use anyhow::Result;
use clap::Parser;
use cli::{
    AgencyCommands, ApiCommands, Cli, Commands, CompletionShell, DetectCommands, ExportCommands,
    FetchCommands, FindCommands, GitCommands, HarvestCommands, HarvestGitCommands, ImportCommands,
    ListCommands, MergeCommands, MigrationCommands, MoveCommands, ProviderCommands, RunCommands,
    ShardCommands, ShowCommands, TelemetryCommands,
};

/// Get the current directory name as a default pattern
fn get_current_dir_name() -> String {
    std::env::current_dir()
        .ok()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_else(|| ".".to_string())
}

fn main() -> Result<()> {
    let _otel_guard = telemetry::init_otel();
    let cli = Cli::parse();

    match cli.command {
        // ====================================================================
        // List Commands
        // ====================================================================
        Commands::List { command } => match command {
            Some(ListCommands::Workspaces) => commands::list_workspaces(),
            Some(ListCommands::Sessions {
                project_path,
                size,
                provider,
                all_providers,
            }) => commands::list_sessions(
                project_path.as_deref(),
                size,
                provider.as_deref(),
                all_providers,
            ),
            Some(ListCommands::Agents) => commands::list_agents_cli(),
            Some(ListCommands::Edits {
                project_path,
                size,
                provider,
            }) => {
                commands::list_agents_sessions(project_path.as_deref(), size, provider.as_deref())
            }
            Some(ListCommands::Path { project_path }) => {
                commands::list_sessions(project_path.as_deref(), false, None, false)
            }
            Some(ListCommands::Orphaned { path }) => commands::list_orphaned(path.as_deref()),
            None => commands::list_workspaces(), // Default to workspaces
        },

        // ====================================================================
        // Find Commands
        // ====================================================================
        Commands::Find { command } => match command {
            Some(FindCommands::Workspace { pattern }) => {
                let pattern = pattern.unwrap_or_else(get_current_dir_name);
                commands::find_workspaces(&pattern)
            }
            Some(FindCommands::Session {
                pattern,
                workspace,
                title_only,
                content,
                after,
                before,
                date,
                all,
                provider,
                all_providers,
                limit,
            }) => {
                let pattern = pattern.unwrap_or_else(get_current_dir_name);
                commands::find_sessions_filtered(
                    &pattern,
                    workspace.as_deref(),
                    title_only,
                    content,
                    after.as_deref(),
                    before.as_deref(),
                    date.as_deref(),
                    all,
                    provider.as_deref(),
                    all_providers,
                    limit,
                )
            }
            Some(FindCommands::Path {
                pattern,
                project_path,
            }) => {
                let pattern = pattern.unwrap_or_else(get_current_dir_name);
                // Use title-only search by default for path-based search (faster)
                commands::find_sessions_filtered(
                    &pattern,
                    project_path.as_deref(),
                    false,
                    false,
                    None,
                    None,
                    None,
                    false,
                    None,  // provider
                    false, // all_providers
                    50,
                )
            }
            None => {
                // Default to finding workspaces matching current directory
                let pattern = get_current_dir_name();
                commands::find_workspaces(&pattern)
            }
        },

        // ====================================================================
        // Show Commands
        // ====================================================================
        Commands::Show { command } => match command {
            Some(ShowCommands::Workspace { workspace }) => commands::show_workspace(&workspace),
            Some(ShowCommands::Session {
                session_id,
                project_path,
            }) => commands::show_session(&session_id, project_path.as_deref()),
            Some(ShowCommands::Agent {
                session_id,
                project_path,
            }) => commands::show_agent_session(&session_id, project_path.as_deref()),
            Some(ShowCommands::Index { path, all }) => commands::show_index(path.as_deref(), all),
            Some(ShowCommands::Path { project_path }) => {
                commands::history_show(project_path.as_deref())
            }
            Some(ShowCommands::Timeline {
                project_path,
                agents,
                provider,
                all_providers,
            }) => commands::show_timeline(
                project_path.as_deref(),
                agents,
                provider.as_deref(),
                all_providers,
            ),
            None => commands::history_show(None), // Default to current directory
        },

        // ====================================================================
        // Fetch Commands
        // ====================================================================
        Commands::Fetch { command } => match command {
            Some(FetchCommands::Workspace {
                workspace_name,
                target_path,
                force,
                no_register,
            }) => commands::fetch_by_workspace(
                &workspace_name,
                target_path.as_deref(),
                force,
                no_register,
            ),
            Some(FetchCommands::Session {
                session_ids,
                target_path,
                force,
                no_register,
            }) => {
                commands::fetch_sessions(&session_ids, target_path.as_deref(), force, no_register)
            }
            Some(FetchCommands::Path {
                project_path,
                force,
                no_register,
            }) => commands::history_fetch(project_path.as_deref(), force, no_register),
            None => {
                eprintln!("Usage: csm fetch <workspace|session|path> ...");
                eprintln!("Run 'csm fetch --help' for more information.");
                Ok(())
            }
        },

        // ====================================================================
        // Merge Commands
        // ====================================================================
        Commands::Merge { command } => match command {
            Some(MergeCommands::Workspace {
                workspace_name,
                title,
                target_path,
                force,
                no_backup,
            }) => commands::merge_by_workspace_name(
                &workspace_name,
                title.as_deref(),
                target_path.as_deref(),
                force,
                no_backup,
            ),
            Some(MergeCommands::Workspaces {
                workspace_names,
                title,
                target_path,
                force,
                no_backup,
            }) => commands::merge_by_workspace_names(
                &workspace_names,
                title.as_deref(),
                target_path.as_deref(),
                force,
                no_backup,
            ),
            Some(MergeCommands::Sessions {
                sessions,
                title,
                target_path,
                force,
                no_backup,
            }) => commands::merge_sessions_by_list(
                &sessions,
                title.as_deref(),
                target_path.as_deref(),
                force,
                no_backup,
            ),
            Some(MergeCommands::Path {
                project_path,
                title,
                force,
                no_backup,
            }) => {
                commands::history_merge(project_path.as_deref(), title.as_deref(), force, no_backup)
            }
            Some(MergeCommands::Provider {
                provider_name,
                title,
                target_path,
                sessions,
                force,
                no_backup,
            }) => commands::merge_from_provider(
                &provider_name,
                title.as_deref(),
                target_path.as_deref(),
                sessions.as_deref(),
                force,
                no_backup,
            ),
            Some(MergeCommands::Providers {
                providers,
                title,
                target_path,
                workspace,
                force,
                no_backup,
            }) => commands::merge_cross_provider(
                &providers,
                title.as_deref(),
                target_path.as_deref(),
                workspace.as_deref(),
                force,
                no_backup,
            ),
            Some(MergeCommands::All {
                title,
                target_path,
                workspace,
                force,
                no_backup,
            }) => commands::merge_all_providers(
                title.as_deref(),
                target_path.as_deref(),
                workspace.as_deref(),
                force,
                no_backup,
            ),
            None => {
                eprintln!("Usage: csm merge <workspace|workspaces|sessions|path|provider|providers|all> ...");
                eprintln!("Run 'csm merge --help' for more information.");
                Ok(())
            }
        },

        // ====================================================================
        // Export Commands
        // ====================================================================
        Commands::Export { command } => match command {
            Some(ExportCommands::Workspace { destination, hash }) => {
                commands::export_sessions(&destination, Some(&hash), None)
            }
            Some(ExportCommands::Sessions {
                destination,
                session_ids,
                project_path,
            }) => commands::export_specific_sessions(
                &destination,
                &session_ids,
                project_path.as_deref(),
            ),
            Some(ExportCommands::Path {
                destination,
                project_path,
            }) => commands::export_sessions(&destination, None, project_path.as_deref()),
            Some(ExportCommands::Batch {
                destination,
                project_paths,
            }) => commands::export_batch(&destination, &project_paths),
            None => {
                eprintln!("Usage: csm export <workspace|sessions|path|batch> ...");
                eprintln!("Run 'csm export --help' for more information.");
                Ok(())
            }
        },

        // ====================================================================
        // Import Commands
        // ====================================================================
        Commands::Import { command } => match command {
            Some(ImportCommands::Workspace {
                source,
                hash,
                force,
            }) => commands::import_sessions(&source, Some(&hash), None, force),
            Some(ImportCommands::Sessions {
                session_files,
                target_path,
                force,
            }) => commands::import_specific_sessions(&session_files, target_path.as_deref(), force),
            Some(ImportCommands::Path {
                source,
                target_path,
                force,
            }) => commands::import_sessions(&source, None, target_path.as_deref(), force),
            None => {
                eprintln!("Usage: csm import <workspace|sessions|path> ...");
                eprintln!("Run 'csm import --help' for more information.");
                Ok(())
            }
        },

        // ====================================================================
        // Move Commands
        // ====================================================================
        Commands::Move { command } => match command {
            Some(MoveCommands::Workspace {
                source_hash,
                target,
            }) => commands::move_workspace(&source_hash, &target),
            Some(MoveCommands::Sessions {
                session_ids,
                target_path,
            }) => commands::move_specific_sessions(&session_ids, &target_path),
            Some(MoveCommands::Path {
                source_path,
                target_path,
            }) => commands::move_by_path(&source_path, &target_path),
            None => {
                eprintln!("Usage: csm move <workspace|sessions|path> ...");
                eprintln!("Run 'csm move --help' for more information.");
                Ok(())
            }
        },

        // ====================================================================
        // Git Commands
        // ====================================================================
        Commands::Git { command } => match command {
            GitCommands::Config { name, email, path } => {
                commands::git_config(name.as_deref(), email.as_deref(), path.as_deref())
            }
            GitCommands::Init { path } => commands::git_init(&path),
            GitCommands::Add {
                path,
                commit,
                message,
            } => commands::git_add(&path, commit, message.as_deref()),
            GitCommands::Status { path } => commands::git_status(&path),
            GitCommands::Snapshot { path, tag, message } => {
                commands::git_snapshot(&path, tag.as_deref(), message.as_deref())
            }
            GitCommands::Track {
                path,
                message,
                all,
                files,
                tag,
            } => commands::git_track(
                &path,
                message.as_deref(),
                all,
                files.as_deref(),
                tag.as_deref(),
            ),
            GitCommands::Log {
                path,
                count,
                sessions_only,
            } => commands::git_log(&path, count, sessions_only),
            GitCommands::Diff {
                path,
                from,
                to,
                with_files,
            } => commands::git_diff(&path, from.as_deref(), to.as_deref(), with_files),
            GitCommands::Restore {
                path,
                commit,
                with_files,
                backup,
            } => commands::git_restore(&path, &commit, with_files, backup),
        },

        // ====================================================================
        // Migration Commands
        // ====================================================================
        Commands::Migration { command } => match command {
            MigrationCommands::Create {
                output,
                projects,
                all,
            } => commands::create_migration(&output, projects.as_deref(), all),
            MigrationCommands::Restore {
                package,
                mapping,
                dry_run,
            } => commands::restore_migration(&package, mapping.as_deref(), dry_run),
        },

        // ====================================================================
        // Run Commands (Agent Launcher + TUI)
        // ====================================================================
        Commands::Run { command } => match command {
            RunCommands::Tui => tui::run_tui(),
            RunCommands::Claude {
                args,
                no_save,
                verbose,
            } => commands::run_agent_cli(Some("claude"), &args, no_save, verbose),
            RunCommands::Open {
                args,
                no_save,
                verbose,
            } => commands::run_agent_cli(Some("open"), &args, no_save, verbose),
            RunCommands::Claw {
                args,
                no_save,
                verbose,
            } => commands::run_agent_cli(Some("claw"), &args, no_save, verbose),
            RunCommands::Cursor {
                args,
                no_save,
                verbose,
            } => commands::run_agent_cli(Some("cursor"), &args, no_save, verbose),
            RunCommands::Codex {
                args,
                no_save,
                verbose,
            } => commands::run_agent_cli(Some("codex"), &args, no_save, verbose),
            RunCommands::Droid {
                args,
                no_save,
                verbose,
            } => commands::run_agent_cli(Some("droid"), &args, no_save, verbose),
            RunCommands::Gemini {
                args,
                no_save,
                verbose,
            } => commands::run_agent_cli(Some("gemini"), &args, no_save, verbose),
        },

        // ====================================================================
        // Watch Command (File-System Monitor)
        // ====================================================================
        Commands::Watch {
            agent,
            path,
            debounce,
            no_harvest,
            verbose,
        } => commands::watch_cli(
            agent.as_deref(),
            path.as_deref(),
            debounce,
            no_harvest,
            verbose,
        ),

        // ====================================================================
        // Provider Commands
        // ====================================================================
        Commands::Provider { command } => match command {
            ProviderCommands::List => commands::list_providers(),
            ProviderCommands::Info { provider } => commands::provider_info(&provider),
            ProviderCommands::Config {
                provider,
                endpoint,
                api_key,
                model,
                enabled,
            } => commands::configure_provider(
                &provider,
                endpoint.as_deref(),
                api_key.as_deref(),
                model.as_deref(),
                enabled,
            ),
            ProviderCommands::Import {
                from,
                path,
                session,
            } => commands::import_from_provider(&from, path.as_deref(), session.as_deref()),
            ProviderCommands::Test { provider } => commands::test_provider(&provider),
        },

        // ====================================================================
        // Detect Commands
        // ====================================================================
        Commands::Analyze {
            file,
            json,
            require_model,
        } => {
            // `main` is sync; the analyzer is async because it may call out
            // to a model. Same runtime pattern as `api serve` below.
            let rt = tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()?;
            rt.block_on(commands::analyze_session_file(&file, json, require_model))
        }

        Commands::Detect { command } => match command {
            Some(DetectCommands::Workspace { path }) => commands::detect_workspace(path.as_deref()),
            Some(DetectCommands::Providers { with_sessions }) => {
                commands::detect_providers(with_sessions)
            }
            Some(DetectCommands::Session { session_id, path }) => {
                commands::detect_session(&session_id, path.as_deref())
            }
            Some(DetectCommands::All { path, verbose }) => {
                commands::detect_all(path.as_deref(), verbose)
            }
            Some(DetectCommands::Orphaned { path, recover }) => {
                commands::detect_orphaned(path.as_deref(), recover)
            }
            None => {
                // Default to detect all for current directory
                commands::detect_all(None, false)
            }
        },

        // ====================================================================
        // Harvest Commands
        // ====================================================================
        Commands::Harvest { command } => match command {
            HarvestCommands::Init { path, git } => commands::harvest_init(path.as_deref(), git),
            HarvestCommands::Scan {
                sessions,
                web,
                timeout,
                verbose,
            } => commands::harvest_scan(sessions, web, timeout, verbose),
            HarvestCommands::Run {
                path,
                providers,
                exclude,
                incremental,
                commit,
                message,
                with_files,
            } => commands::harvest_run(
                path.as_deref(),
                providers.as_deref(),
                exclude.as_deref(),
                incremental,
                commit,
                message.as_deref(),
                with_files,
            ),
            HarvestCommands::Status { path } => commands::harvest_status(path.as_deref()),
            HarvestCommands::List {
                path,
                provider,
                limit,
                search,
            } => commands::harvest_list(
                path.as_deref(),
                provider.as_deref(),
                limit,
                search.as_deref(),
            ),
            HarvestCommands::Export {
                output,
                path,
                format,
                provider,
                sessions,
            } => commands::harvest_export(
                path.as_deref(),
                &output,
                &format,
                provider.as_deref(),
                sessions.as_deref(),
            ),
            HarvestCommands::Share {
                url,
                path,
                name,
                workspace,
            } => commands::harvest_share(
                path.as_deref(),
                &url,
                name.as_deref(),
                workspace.as_deref(),
            ),
            HarvestCommands::Pull {
                url,
                output,
                path,
                workspace,
                pretty,
                with_files,
                bundle,
            } => commands::harvest_pull(
                &url,
                output.as_deref(),
                path.as_deref(),
                workspace.as_deref(),
                pretty,
                with_files,
                bundle,
            ),
            HarvestCommands::Shares {
                path,
                status,
                limit,
            } => commands::harvest_shares(path.as_deref(), status.as_deref(), limit),
            HarvestCommands::Checkpoint {
                session,
                path,
                message,
            } => commands::harvest_checkpoint(path.as_deref(), &session, message.as_deref()),
            HarvestCommands::Checkpoints { session, path } => {
                commands::harvest_checkpoints(path.as_deref(), &session)
            }
            HarvestCommands::Revert {
                session,
                checkpoint,
                path,
            } => commands::harvest_restore_checkpoint(path.as_deref(), &session, checkpoint),
            HarvestCommands::Sync {
                path,
                push,
                pull,
                provider,
                workspace,
                sessions,
                format,
                force,
                dry_run,
            } => commands::harvest_sync(
                path.as_deref(),
                push,
                pull,
                provider.as_deref(),
                workspace.as_deref(),
                sessions.as_deref(),
                Some(&format),
                force,
                dry_run,
            ),
            HarvestCommands::Compact { path, dry_run } => {
                commands::harvest_compact(path.as_deref(), dry_run)
            }
            HarvestCommands::Rebuild { path } => commands::harvest_rebuild_fts(path.as_deref()),
            HarvestCommands::Search {
                query,
                path,
                provider,
                limit,
            } => commands::harvest_search(path.as_deref(), &query, provider.as_deref(), limit),
            HarvestCommands::Git { command: git_cmd } => match git_cmd {
                HarvestGitCommands::Init { path } => commands::harvest_git_init(path.as_deref()),
                HarvestGitCommands::Commit { path, message } => {
                    commands::harvest_git_commit(path.as_deref(), message.as_deref())
                }
                HarvestGitCommands::Log { path, count } => {
                    commands::harvest_git_log(path.as_deref(), count)
                }
                HarvestGitCommands::Diff { path, commit } => {
                    commands::harvest_git_diff(path.as_deref(), commit.as_deref())
                }
                HarvestGitCommands::Restore { commit, path } => {
                    commands::harvest_git_restore(path.as_deref(), &commit)
                }
            },
        },

        // ====================================================================
        // Recover Commands
        // ====================================================================
        Commands::Recover { command } => match command {
            cli::RecoverCommands::Scan {
                provider,
                verbose,
                include_old,
            } => commands::recover_scan(&provider, verbose, include_old),
            cli::RecoverCommands::Recording {
                server,
                session,
                output,
            } => commands::recover_from_recording(&server, session.as_deref(), output.as_deref()),
            cli::RecoverCommands::Database {
                backup,
                session,
                output,
                format,
            } => commands::recover_from_database(
                &backup,
                session.as_deref(),
                output.as_deref(),
                &format,
            ),
            cli::RecoverCommands::Jsonl {
                file,
                output,
                aggressive,
            } => commands::recover_jsonl(&file, output.as_deref(), aggressive),
            cli::RecoverCommands::Orphans {
                provider,
                unindexed,
                verify,
            } => commands::recover_orphans(&provider, unindexed, verify),
            cli::RecoverCommands::Repair {
                path,
                backup,
                dry_run,
            } => commands::recover_repair(&path, backup, dry_run),
            cli::RecoverCommands::Status { provider, system } => {
                commands::recover_status(&provider, system)
            }
            cli::RecoverCommands::Convert {
                input,
                output,
                format,
                compat,
            } => commands::recover_convert(&input, output.as_deref(), format.as_deref(), &compat),
            cli::RecoverCommands::Extract {
                path,
                output,
                all_formats,
                include_edits,
            } => commands::recover_extract(&path, output.as_deref(), all_formats, include_edits),
            cli::RecoverCommands::Detect {
                file,
                verbose,
                json,
            } => commands::recover_detect(&file, verbose, json),
            cli::RecoverCommands::Upgrade {
                project_paths,
                provider,
                target_format,
                no_backup,
                dry_run,
            } => commands::recover_upgrade(
                &project_paths,
                &provider,
                &target_format,
                no_backup,
                dry_run,
            ),
            cli::RecoverCommands::CopilotInfo { session_dir, json } => {
                commands::recover_copilot_info(session_dir.as_deref(), json)
            }
            cli::RecoverCommands::Backups {
                path,
                dry_run,
                force,
            } => commands::recover_backups(path.as_deref(), dry_run, force),
            cli::RecoverCommands::Recursive {
                path,
                depth,
                force,
                dry_run,
                exclude,
                register,
            } => commands::recover_recursive(
                path.as_deref(),
                depth,
                force,
                dry_run,
                &exclude,
                register,
            ),
        },

        // ====================================================================
        // Register Commands
        // ====================================================================
        Commands::Register { command } => match command {
            cli::RegisterCommands::All {
                path,
                merge,
                force,
                close_vscode,
                reopen,
                write_only,
            } => commands::register_all(
                path.as_deref(),
                merge,
                force,
                close_vscode,
                reopen,
                write_only,
            ),
            cli::RegisterCommands::Session {
                ids,
                title,
                path,
                force,
            } => commands::register_sessions(&ids, title.as_deref(), path.as_deref(), force),
            cli::RegisterCommands::Recursive {
                path,
                depth,
                force,
                dry_run,
                exclude,
            } => commands::register_recursive(path.as_deref(), depth, force, dry_run, &exclude),
            cli::RegisterCommands::Repair {
                path,
                all,
                recursive,
                depth,
                exclude,
                dry_run,
                force,
                close_vscode,
                reopen,
            } => commands::register_repair(
                path.as_deref(),
                all,
                recursive,
                depth,
                &exclude,
                dry_run,
                force,
                close_vscode,
                reopen,
            ),
            cli::RegisterCommands::Trim {
                path,
                keep,
                session,
                all,
                threshold_mb,
                force,
            } => commands::register_trim(
                path.as_deref(),
                keep,
                session.as_deref(),
                all,
                threshold_mb,
                force,
            ),
        },

        // ====================================================================
        // Sync Commands (shortcut to harvest sync)
        // ====================================================================
        Commands::Sync {
            path,
            push,
            pull,
            provider,
            workspace,
            sessions,
            format,
            force,
            dry_run,
        } => commands::harvest_sync(
            path.as_deref(),
            push,
            pull,
            provider.as_deref(),
            workspace.as_deref(),
            sessions.as_deref(),
            Some(&format),
            force,
            dry_run,
        ),

        // ====================================================================
        // API Server
        // ====================================================================
        Commands::Api { command } => match command {
            ApiCommands::Serve {
                host,
                port,
                database,
            } => {
                let config = api::ServerConfig {
                    host,
                    port,
                    database_path: database.unwrap_or_else(|| {
                        dirs::data_local_dir()
                            .map(|p| p.join("csm").join("csm.db").to_string_lossy().to_string())
                            .unwrap_or_else(|| "csm.db".to_string())
                    }),
                    ..Default::default()
                };

                // Create tokio runtime and run the server
                let rt = tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()?;
                rt.block_on(api::start_server(config))
            }
        },

        // ====================================================================
        // Agency (Agent Development Kit)
        // ====================================================================
        Commands::Agency { command } => match command {
            AgencyCommands::List { verbose } => commands::list_agents(verbose),
            AgencyCommands::Info { name } => commands::show_agent_info(&name),
            AgencyCommands::Modes => commands::list_modes(),
            AgencyCommands::Run {
                agent,
                prompt,
                model,
                orchestration,
                verbose,
            } => commands::run_agent(&agent, &prompt, model.as_deref(), &orchestration, verbose),
            AgencyCommands::Create {
                name,
                role,
                instruction,
                model,
            } => commands::create_agent(&name, &role, instruction.as_deref(), model.as_deref()),
            AgencyCommands::Tools => commands::list_tools(),
            AgencyCommands::Templates => commands::list_templates(),
        },

        // ====================================================================
        // Telemetry (User Data Collection)
        // ====================================================================
        Commands::Telemetry { command } => match command {
            Some(TelemetryCommands::Info) | None => commands::telemetry_info(),
            Some(TelemetryCommands::OptIn) => commands::telemetry_opt_in(),
            Some(TelemetryCommands::OptOut) => commands::telemetry_opt_out(),
            Some(TelemetryCommands::Reset) => commands::telemetry_reset(),
            Some(TelemetryCommands::Record {
                category,
                event,
                data,
                kv,
                tags,
                context,
                verbose,
            }) => commands::telemetry_record(
                &category,
                &event,
                data.as_deref(),
                &kv,
                tags,
                context.as_deref(),
                verbose,
            ),
            Some(TelemetryCommands::Show {
                category,
                event,
                tag,
                limit,
                format,
                after,
                before,
            }) => commands::telemetry_show(
                category.as_deref(),
                event.as_deref(),
                tag.as_deref(),
                limit,
                &format,
                after.as_deref(),
                before.as_deref(),
            ),
            Some(TelemetryCommands::Export {
                output,
                format,
                category,
                with_metadata,
            }) => commands::telemetry_export(&output, &format, category.as_deref(), with_metadata),
            Some(TelemetryCommands::Clear { force, older_than }) => {
                commands::telemetry_clear(force, older_than)
            }
            Some(TelemetryCommands::Config {
                endpoint,
                api_key,
                enable_remote,
                disable_remote,
            }) => commands::telemetry_config(
                endpoint.as_deref(),
                api_key.as_deref(),
                enable_remote,
                disable_remote,
            ),
            Some(TelemetryCommands::Sync { limit, clear_after }) => {
                commands::telemetry_sync(limit, clear_after)
            }
            Some(TelemetryCommands::Test) => commands::telemetry_test(),
            Some(TelemetryCommands::Setup {
                endpoint,
                protocol,
                headers,
                service_name,
            }) => commands::telemetry_otel_setup(
                endpoint.as_deref(),
                &protocol,
                headers.as_deref(),
                &service_name,
            ),
        },

        // ====================================================================
        // Shard Commands
        // ====================================================================
        Commands::Shard { command } => match command {
            cli::ShardCommands::Session {
                file,
                max_requests,
                max_size,
                output,
                update_index,
                workspace,
                dry_run,
                no_backup,
            } => commands::shard_session(
                &file,
                max_requests,
                max_size,
                output.as_deref(),
                update_index,
                workspace.as_deref(),
                dry_run,
                no_backup,
            ),
            cli::ShardCommands::Workspace {
                workspace,
                max_requests,
                max_size,
                dry_run,
                no_backup,
            } => commands::shard_workspace(
                workspace.as_deref(),
                max_requests,
                max_size,
                dry_run,
                no_backup,
            ),
            cli::ShardCommands::Info { file } => commands::shard_info(&file),
        },

        // ====================================================================
        // Completions
        // ====================================================================
        Commands::Completions { shell } => {
            generate_completions(shell);
            Ok(())
        }

        // ====================================================================
        // Doctor
        // ====================================================================
        Commands::Doctor { full, format, fix } => commands::doctor(full, &format, fix),

        // ====================================================================
        // Inspect Commands
        // ====================================================================
        Commands::Inspect { command } => match command {
            cli::InspectCommands::Index {
                path,
                workspace_id,
                json,
            } => commands::inspect_index(path.as_deref(), workspace_id.as_deref(), json),
            cli::InspectCommands::Memento {
                path,
                workspace_id,
                json,
            } => commands::inspect_memento(path.as_deref(), workspace_id.as_deref(), json),
            cli::InspectCommands::Cache {
                path,
                workspace_id,
                json,
            } => commands::inspect_cache(path.as_deref(), workspace_id.as_deref(), json),
            cli::InspectCommands::Validate {
                path,
                workspace_id,
                json,
            } => commands::inspect_validate(path.as_deref(), workspace_id.as_deref(), json),
            cli::InspectCommands::Keys {
                path,
                workspace_id,
                all,
                json,
            } => commands::inspect_keys(path.as_deref(), workspace_id.as_deref(), all, json),
            cli::InspectCommands::Files {
                path,
                workspace_id,
                json,
            } => commands::inspect_files(path.as_deref(), workspace_id.as_deref(), json),
            cli::InspectCommands::Rebuild {
                path,
                workspace_id,
                dry_run,
                json,
            } => commands::inspect_rebuild(path.as_deref(), workspace_id.as_deref(), dry_run, json),
        },

        // ====================================================================
        // Schema Commands
        // ====================================================================
        Commands::Schema { command } => match command {
            cli::SchemaCommands::List { provider, json } => {
                commands::schema_list(provider.as_deref(), json)
            }
            cli::SchemaCommands::Show { schema_id, json } => {
                commands::schema_show(&schema_id, json)
            }
            cli::SchemaCommands::Detect {
                path,
                workspace_id,
                json,
            } => commands::schema_detect(path.as_deref(), workspace_id.as_deref(), json),
            cli::SchemaCommands::Export { compact, output } => {
                commands::schema_export(compact, output.as_deref())
            }
            cli::SchemaCommands::Ontology { json } => commands::schema_ontology(json),
            cli::SchemaCommands::Mappings {
                source,
                target,
                tag,
                json,
            } => commands::schema_mappings(
                source.as_deref(),
                target.as_deref(),
                tag.as_deref(),
                json,
            ),
        },

        // ====================================================================
        // Internal Commands (background processes)
        // ====================================================================
        Commands::Internal { command } => match command {
            cli::InternalCommands::ApplyPending { pending_file } => {
                commands::apply_pending_index(&pending_file)
            }
        },

        // ====================================================================
        // Easter Egg
        // ====================================================================
        Commands::Banner => {
            print_banner();
            Ok(())
        }
    }
}

fn generate_completions(shell: CompletionShell) {
    use clap::CommandFactory;
    use clap_complete::{generate, Shell};

    let mut cmd = Cli::command();
    let shell = match shell {
        CompletionShell::Bash => Shell::Bash,
        CompletionShell::Zsh => Shell::Zsh,
        CompletionShell::Fish => Shell::Fish,
        CompletionShell::Powershell => Shell::PowerShell,
        CompletionShell::Elvish => Shell::Elvish,
    };
    generate(shell, &mut cmd, "chasm", &mut std::io::stdout());
}

fn print_banner() {
    use colored::Colorize;

    let banner = r#"
     .d8888b.  888    888        d8888  .d8888b.  888b     d888
    d88P  Y88b 888    888       d88888 d88P  Y88b 8888b   d8888
    888    888 888    888      d88P888 Y88b.      88888b.d88888
    888        8888888888     d88P 888  "Y888b.   888Y88888P888
    888        888    888    d88P  888     "Y88b. 888 Y888P 888
    888    888 888    888   d88P   888       "888 888  Y8P  888
    Y88b  d88P 888    888  d8888888888 Y88b  d88P 888   "   888
     "Y8888P"  888    888 d88P     888  "Y8888P"  888       888
    "#;

    let subtitle = "CHAt System Manager (Chasm) for Bridging LLM Providers";
    let tagline = "     Your AI providers and chat sessions, unified";
    let version = format!("                       v{}", env!("CARGO_PKG_VERSION"));

    println!("{}", banner.cyan().bold());
    println!("{}", subtitle.white().bold());
    println!("{}", tagline.bright_black());
    println!("{}", version.bright_black());
    println!();

    // Random fun messages
    let messages = [
        "[*] Managing your AI memories since 2024",
        "[*] Where conversations never get lost",
        "[*] Because context switching shouldn't mean losing context",
        "[*] Unifying the chaos of multi-LLM life",
        "[*] One tool to find them all",
        "[*] Faster than scrolling through old chats",
        "[*] From VS Code to the cloud and back",
        "[*] Built with Rust, powered by caffeine",
        "[*] Bridging the chasm between your chat sessions",
    ];

    let idx = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as usize % messages.len())
        .unwrap_or(0);

    println!("    {}", messages[idx].bright_yellow());
    println!();
}

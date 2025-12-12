//! Chat Session Manager (csm) - Main entry point
//!
//! A CLI tool to manage and merge chat sessions across workspaces.

mod browser;
mod cli;
mod commands;
mod database;
mod error;
mod models;
mod providers;
mod storage;
mod tui;
mod workspace;

use anyhow::Result;
use clap::Parser;
use cli::{
    Cli, Commands, DetectCommands, ExportCommands, FetchCommands, FindCommands, GitCommands,
    HarvestCommands, HarvestGitCommands, ImportCommands, ListCommands, MergeCommands,
    MigrationCommands, MoveCommands, ProviderCommands, RunCommands, ShowCommands,
};

/// Get the current directory name as a default pattern
fn get_current_dir_name() -> String {
    std::env::current_dir()
        .ok()
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_else(|| ".".to_string())
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        // ====================================================================
        // List Commands
        // ====================================================================
        Commands::List { command } => match command {
            Some(ListCommands::Workspaces) => commands::list_workspaces(),
            Some(ListCommands::Sessions { project_path }) => {
                commands::list_sessions(project_path.as_deref())
            }
            Some(ListCommands::Path { project_path }) => {
                commands::list_sessions(project_path.as_deref())
            }
            None => commands::list_workspaces(), // Default to workspaces
        },

        // ====================================================================
        // Find Commands
        // ====================================================================
        Commands::Find { command } => match command {
            Some(FindCommands::Workspace { pattern }) => {
                let pattern = pattern.unwrap_or_else(|| get_current_dir_name());
                commands::find_workspaces(&pattern)
            }
            Some(FindCommands::Session {
                pattern,
                project_path,
            }) => {
                let pattern = pattern.unwrap_or_else(|| get_current_dir_name());
                commands::find_sessions(&pattern, project_path.as_deref())
            }
            Some(FindCommands::Path {
                pattern,
                project_path,
            }) => {
                let pattern = pattern.unwrap_or_else(|| get_current_dir_name());
                commands::find_sessions(&pattern, project_path.as_deref())
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
            Some(ShowCommands::Path { project_path }) => {
                commands::history_show(project_path.as_deref())
            }
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
            None => {
                eprintln!("Usage: csm export <workspace|sessions|path> ...");
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
        // Run Commands (TUI)
        // ====================================================================
        Commands::Run { command } => match command {
            RunCommands::Tui => tui::run_tui(),
        },

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
            } => commands::harvest_run(
                path.as_deref(),
                providers.as_deref(),
                exclude.as_deref(),
                incremental,
                commit,
                message.as_deref(),
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
            HarvestCommands::Restore {
                session,
                checkpoint,
                path,
            } => commands::harvest_restore_checkpoint(path.as_deref(), &session, checkpoint),
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
        // Easter Egg
        // ====================================================================
        Commands::Banner => {
            print_banner();
            Ok(())
        }
    }
}

fn print_banner() {
    use colored::Colorize;
    
    let banner = r#"
     ██████╗███████╗███╗   ███╗
    ██╔════╝██╔════╝████╗ ████║
    ██║     ███████╗██╔████╔██║
    ██║     ╚════██║██║╚██╔╝██║
    ╚██████╗███████║██║ ╚═╝ ██║
     ╚═════╝╚══════╝╚═╝     ╚═╝
    "#;
    
    let subtitle = "   Chat Session Manager";
    let tagline = "  Your AI conversations, unified.";
    let version = format!("          v{}", env!("CARGO_PKG_VERSION"));
    
    println!("{}", banner.cyan().bold());
    println!("{}", subtitle.white().bold());
    println!("{}", tagline.bright_black());
    println!("{}", version.bright_black());
    println!();
    
    // Random fun messages
    let messages = [
        "🧠 Managing your AI memories since 2024",
        "🔮 Where conversations never get lost",
        "🚀 Because context switching shouldn't mean losing context",
        "💬 Unifying the chaos of multi-LLM life",
        "🎯 One tool to find them all",
        "⚡ Faster than scrolling through old chats",
        "🌐 From VS Code to the cloud and back",
        "🔧 Built with Rust, powered by caffeine",
    ];
    
    let idx = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as usize % messages.len())
        .unwrap_or(0);
    
    println!("    {}", messages[idx].bright_yellow());
    println!();
}

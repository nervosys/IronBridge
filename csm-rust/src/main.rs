//! Chat Session Manager (csm) - Main entry point
//!
//! A CLI tool to manage and merge chat sessions across workspaces.

mod cli;
mod commands;
mod error;
mod models;
mod providers;
mod storage;
mod tui;
mod workspace;

use anyhow::Result;
use clap::Parser;
use cli::{
    Cli, Commands, RunCommands, ListCommands, FindCommands, 
    HistoryCommands, ExportCommands, ImportCommands, MoveCommands, GitCommands,
    ProviderCommands
};

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        // ====================================================================
        // Run Commands (TUI)
        // ====================================================================
        Commands::Run { command } => match command {
            RunCommands::Tui => tui::run_tui(),
        },

        // ====================================================================
        // List Commands
        // ====================================================================
        Commands::List { command } => match command {
            Some(ListCommands::Workspaces) => commands::list_workspaces(),
            Some(ListCommands::Sessions { project_path }) => {
                commands::list_sessions(project_path.as_deref())
            }
            None => commands::list_workspaces(), // Default to workspaces
        },

        // ====================================================================
        // Find Commands
        // ====================================================================
        Commands::Find { command } => match command {
            Some(FindCommands::Workspace { pattern }) => commands::find_workspaces(&pattern),
            Some(FindCommands::Session { pattern, project_path }) => {
                commands::find_sessions(&pattern, project_path.as_deref())
            }
            None => {
                eprintln!("Usage: csm find <workspace|session> <pattern>");
                eprintln!("Run 'csm find --help' for more information.");
                Ok(())
            }
        },

        // ====================================================================
        // History Commands
        // ====================================================================
        Commands::History { command } => match command {
            Some(HistoryCommands::Show { project_path }) => {
                commands::history_show(project_path.as_deref())
            }
            Some(HistoryCommands::Fetch { project_path, force, no_register }) => {
                commands::history_fetch(project_path.as_deref(), force, no_register)
            }
            Some(HistoryCommands::Merge { project_path, title, force, no_backup }) => {
                commands::history_merge(project_path.as_deref(), title.as_deref(), force, no_backup)
            }
            None => commands::history_show(None), // Default to show
        },

        // Shorthand aliases for history commands
        Commands::Fetch { project_path, force, no_register } => {
            commands::history_fetch(project_path.as_deref(), force, no_register)
        }
        Commands::Merge { project_path, title, force, no_backup } => {
            commands::history_merge(project_path.as_deref(), title.as_deref(), force, no_backup)
        }
        Commands::Show { project_path } => {
            commands::history_show(project_path.as_deref())
        }

        // ====================================================================
        // Export Commands
        // ====================================================================
        Commands::Export { command } => match command {
            Some(ExportCommands::Sessions { destination, hash, path }) => {
                commands::export_sessions(&destination, hash.as_deref(), path.as_deref())
            }
            None => {
                eprintln!("Usage: csm export sessions <destination> [--hash <hash> | --path <path>]");
                eprintln!("Run 'csm export --help' for more information.");
                Ok(())
            }
        },

        // ====================================================================
        // Import Commands
        // ====================================================================
        Commands::Import { command } => match command {
            Some(ImportCommands::Sessions { source, hash, path, force }) => {
                commands::import_sessions(&source, hash.as_deref(), path.as_deref(), force)
            }
            None => {
                eprintln!("Usage: csm import sessions <source> [--hash <hash> | --path <path>]");
                eprintln!("Run 'csm import --help' for more information.");
                Ok(())
            }
        },

        // ====================================================================
        // Move Commands
        // ====================================================================
        Commands::Move { command } => match command {
            Some(MoveCommands::Sessions { source_hash, target_path }) => {
                commands::move_sessions(&source_hash, &target_path)
            }
            None => {
                eprintln!("Usage: csm move sessions <source_hash> <target_path>");
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
            GitCommands::Add { path, commit, message } => {
                commands::git_add(&path, commit, message.as_deref())
            }
            GitCommands::Status { path } => commands::git_status(&path),
            GitCommands::Snapshot { path, tag, message } => {
                commands::git_snapshot(&path, tag.as_deref(), message.as_deref())
            }
        },

        // ====================================================================
        // Migration Commands
        // ====================================================================
        Commands::CreateMigration { output, projects, all } => {
            commands::create_migration(&output, projects.as_deref(), all)
        }
        Commands::RestoreMigration { package, mapping, dry_run } => {
            commands::restore_migration(&package, mapping.as_deref(), dry_run)
        }

        // ====================================================================
        // Provider Commands
        // ====================================================================
        Commands::Provider { command } => match command {
            ProviderCommands::List => commands::list_providers(),
            ProviderCommands::Info { provider } => commands::provider_info(&provider),
            ProviderCommands::Config { provider, endpoint, api_key, model, enabled } => {
                commands::configure_provider(
                    &provider,
                    endpoint.as_deref(),
                    api_key.as_deref(),
                    model.as_deref(),
                    enabled,
                )
            }
            ProviderCommands::Import { from, path, session } => {
                commands::import_from_provider(&from, path.as_deref(), session.as_deref())
            }
            ProviderCommands::Test { provider } => commands::test_provider(&provider),
        },
    }
}

//! CLI argument definitions using clap derive macros

use clap::{Parser, Subcommand};

/// Chat Session Manager (csm) - Manage and merge chat sessions across workspaces
#[derive(Parser)]
#[command(name = "csm")]
#[command(author = "Nervosys")]
#[command(version)]
#[command(about = "Manage and merge chat sessions across workspaces", long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    // ============================================================================
    // Interactive TUI
    // ============================================================================
    
    /// Launch interactive TUI for browsing chat sessions
    Run {
        #[command(subcommand)]
        command: RunCommands,
    },

    // ============================================================================
    // List Commands
    // ============================================================================
    
    /// List workspaces or sessions
    List {
        #[command(subcommand)]
        command: Option<ListCommands>,
    },

    // ============================================================================
    // Find Commands
    // ============================================================================
    
    /// Find workspaces or sessions by search pattern
    Find {
        #[command(subcommand)]
        command: Option<FindCommands>,
    },

    // ============================================================================
    // History Commands
    // ============================================================================
    
    /// Manage chat history across workspaces
    History {
        #[command(subcommand)]
        command: Option<HistoryCommands>,
    },
    
    /// Fetch chat sessions from other workspaces (shorthand for 'history fetch')
    Fetch {
        /// Path to the project (default: current directory)
        project_path: Option<String>,
        
        /// Overwrite existing sessions and skip VS Code running check
        #[arg(long)]
        force: bool,
        
        /// Don't register sessions in VS Code index
        #[arg(long)]
        no_register: bool,
    },
    
    /// Merge all chat sessions into unified chat (shorthand for 'history merge')
    Merge {
        /// Path to the project (default: current directory)
        project_path: Option<String>,
        
        /// Title for the merged session
        #[arg(short, long)]
        title: Option<String>,
        
        /// Skip VS Code running check
        #[arg(long)]
        force: bool,
        
        /// Don't create backup of current sessions
        #[arg(long)]
        no_backup: bool,
    },
    
    /// Show chat history for current project (shorthand for 'history show')
    Show {
        /// Path to the project (default: current directory)
        project_path: Option<String>,
    },

    // ============================================================================
    // Export Commands
    // ============================================================================
    
    /// Export chat sessions from a workspace
    Export {
        #[command(subcommand)]
        command: Option<ExportCommands>,
    },

    // ============================================================================
    // Import Commands
    // ============================================================================
    
    /// Import chat sessions into a workspace
    Import {
        #[command(subcommand)]
        command: Option<ImportCommands>,
    },

    // ============================================================================
    // Move Commands
    // ============================================================================
    
    /// Move chat sessions between workspaces
    Move {
        #[command(subcommand)]
        command: Option<MoveCommands>,
    },

    // ============================================================================
    // Git Integration Commands
    // ============================================================================
    
    /// Git integration for chat session versioning
    Git {
        #[command(subcommand)]
        command: GitCommands,
    },

    // ============================================================================
    // Migration Commands
    // ============================================================================
    
    /// Create a migration package for moving to a new machine
    #[command(name = "create-migration")]
    CreateMigration {
        /// Output directory for migration package
        output: String,
        
        /// Comma-separated list of project paths to include
        #[arg(long)]
        projects: Option<String>,
        
        /// Include all workspaces with chat sessions
        #[arg(long)]
        all: bool,
    },
    
    /// Restore a migration package on a new machine
    #[command(name = "restore-migration")]
    RestoreMigration {
        /// Path to migration package directory
        package: String,
        
        /// Project path mapping: 'old1:new1;old2:new2'
        #[arg(long)]
        mapping: Option<String>,
        
        /// Show what would be done without doing it
        #[arg(long)]
        dry_run: bool,
    },

    // ============================================================================
    // Provider Commands
    // ============================================================================
    
    /// Manage LLM providers (Ollama, vLLM, Foundry, Cursor, etc.)
    Provider {
        #[command(subcommand)]
        command: ProviderCommands,
    },
}

// ============================================================================
// Run Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum RunCommands {
    /// Launch interactive TUI (Text User Interface)
    Tui,
}

// ============================================================================
// List Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum ListCommands {
    /// List all VS Code workspaces
    Workspaces,
    
    /// List all chat sessions
    Sessions {
        /// Filter by project path
        #[arg(long)]
        project_path: Option<String>,
    },
}

// ============================================================================
// Find Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum FindCommands {
    /// Find workspaces by search pattern
    Workspace {
        /// Search pattern (case-insensitive)
        pattern: String,
    },
    
    /// Find sessions by search pattern
    Session {
        /// Search pattern (case-insensitive)
        pattern: String,
        
        /// Filter by project path
        #[arg(long)]
        project_path: Option<String>,
    },
}

// ============================================================================
// History Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum HistoryCommands {
    /// Show all chat sessions across workspaces for current project
    Show {
        /// Path to the project (default: current directory)
        project_path: Option<String>,
    },
    
    /// Fetch chat sessions from other workspaces into current workspace
    Fetch {
        /// Path to the project (default: current directory)
        project_path: Option<String>,
        
        /// Overwrite existing sessions and skip VS Code running check
        #[arg(long)]
        force: bool,
        
        /// Don't register sessions in VS Code index
        #[arg(long)]
        no_register: bool,
    },
    
    /// Merge all sessions into a single unified chat ordered by timestamp
    Merge {
        /// Path to the project (default: current directory)
        project_path: Option<String>,
        
        /// Title for the merged session
        #[arg(short, long)]
        title: Option<String>,
        
        /// Skip VS Code running check
        #[arg(long)]
        force: bool,
        
        /// Don't create backup of current sessions
        #[arg(long)]
        no_backup: bool,
    },
}

// ============================================================================
// Export Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum ExportCommands {
    /// Export chat sessions from a workspace
    Sessions {
        /// Destination directory for exported sessions
        destination: String,
        
        /// Source workspace hash
        #[arg(long, group = "source")]
        hash: Option<String>,
        
        /// Source project path
        #[arg(long, group = "source")]
        path: Option<String>,
    },
}

// ============================================================================
// Import Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum ImportCommands {
    /// Import chat sessions into a workspace
    Sessions {
        /// Source directory containing session JSON files
        source: String,
        
        /// Target workspace hash
        #[arg(long, group = "target")]
        hash: Option<String>,
        
        /// Target project path
        #[arg(long, group = "target")]
        path: Option<String>,
        
        /// Overwrite existing sessions
        #[arg(long)]
        force: bool,
    },
}

// ============================================================================
// Move Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum MoveCommands {
    /// Move chat sessions from one workspace to another
    Sessions {
        /// Source workspace hash
        source_hash: String,
        
        /// Target project path
        target_path: String,
    },
}

// ============================================================================
// Git Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum GitCommands {
    /// Configure git settings for chat sessions
    Config {
        /// Git user name
        #[arg(long)]
        name: Option<String>,
        
        /// Git user email
        #[arg(long)]
        email: Option<String>,
        
        /// Project path
        #[arg(long)]
        path: Option<String>,
    },
    
    /// Initialize git versioning for chat sessions
    Init {
        /// Project path
        path: String,
    },
    
    /// Add chat sessions to git (stage and optionally commit)
    Add {
        /// Project path
        path: String,
        
        /// Also commit the changes
        #[arg(long)]
        commit: bool,
        
        /// Commit message (requires --commit)
        #[arg(short, long)]
        message: Option<String>,
    },
    
    /// Show git status of chat sessions
    Status {
        /// Project path
        path: String,
    },
    
    /// Create a git tag snapshot of chat sessions
    Snapshot {
        /// Project path
        path: String,
        
        /// Tag name (auto-generated if not provided)
        #[arg(long)]
        tag: Option<String>,
        
        /// Snapshot message
        #[arg(short, long)]
        message: Option<String>,
    },
}

// ============================================================================
// Provider Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum ProviderCommands {
    /// List all discovered LLM providers
    List,
    
    /// Show detailed info about a specific provider
    Info {
        /// Provider name (copilot, cursor, ollama, vllm, foundry, lm-studio, etc.)
        provider: String,
    },
    
    /// Configure a provider
    Config {
        /// Provider name
        provider: String,
        
        /// API endpoint URL
        #[arg(long)]
        endpoint: Option<String>,
        
        /// API key
        #[arg(long)]
        api_key: Option<String>,
        
        /// Default model
        #[arg(long)]
        model: Option<String>,
        
        /// Enable or disable the provider
        #[arg(long)]
        enabled: Option<bool>,
    },
    
    /// Import sessions from another provider
    Import {
        /// Source provider name
        #[arg(long)]
        from: String,
        
        /// Target project path (or current directory)
        #[arg(long)]
        path: Option<String>,
        
        /// Session ID to import (omit for all)
        #[arg(long)]
        session: Option<String>,
    },
    
    /// Test connection to a provider
    Test {
        /// Provider name
        provider: String,
    },
}

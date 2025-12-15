//! CLI argument definitions using clap derive macros

use clap::{Parser, Subcommand};

/// Chat System Manager (csm) - Manage and merge chat sessions across workspaces
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
    // List Commands
    // ============================================================================
    /// List workspaces, sessions, or paths
    List {
        #[command(subcommand)]
        command: Option<ListCommands>,
    },

    // ============================================================================
    // Find Commands
    // ============================================================================
    /// Find workspaces, sessions, or paths by search pattern
    Find {
        #[command(subcommand)]
        command: Option<FindCommands>,
    },

    // ============================================================================
    // Show Commands
    // ============================================================================
    /// Show workspaces, sessions, or paths
    Show {
        #[command(subcommand)]
        command: Option<ShowCommands>,
    },

    // ============================================================================
    // Fetch Commands
    // ============================================================================
    /// Fetch chat sessions from workspaces, sessions, or paths
    Fetch {
        #[command(subcommand)]
        command: Option<FetchCommands>,
    },

    // ============================================================================
    // Merge Commands
    // ============================================================================
    /// Merge chat sessions from workspaces, sessions, or paths
    Merge {
        #[command(subcommand)]
        command: Option<MergeCommands>,
    },

    // ============================================================================
    // Export Commands
    // ============================================================================
    /// Export chat sessions from workspaces, sessions, or paths
    Export {
        #[command(subcommand)]
        command: Option<ExportCommands>,
    },

    // ============================================================================
    // Import Commands
    // ============================================================================
    /// Import chat sessions into workspaces, sessions, or paths
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
    /// Migration commands for moving chat sessions between machines
    Migration {
        #[command(subcommand)]
        command: MigrationCommands,
    },

    // ============================================================================
    // Run Commands (TUI)
    // ============================================================================
    /// Run interactive tools
    Run {
        #[command(subcommand)]
        command: RunCommands,
    },

    // ============================================================================
    // Provider Commands
    // ============================================================================
    /// Manage LLM providers (Ollama, vLLM, Foundry, Cursor, etc.)
    Provider {
        #[command(subcommand)]
        command: ProviderCommands,
    },

    // ============================================================================
    // Detect Commands
    // ============================================================================
    /// Auto-detect workspace and provider information
    Detect {
        #[command(subcommand)]
        command: Option<DetectCommands>,
    },

    // ============================================================================
    // Harvest Commands
    // ============================================================================
    /// Harvest chat sessions from all providers into a unified database
    Harvest {
        #[command(subcommand)]
        command: HarvestCommands,
    },

    // ============================================================================
    // Easter Egg
    // ============================================================================
    /// 🎨
    #[command(hide = true)]
    Banner,
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

    /// List sessions for a specific project path
    Path {
        /// Project path (default: current directory)
        project_path: Option<String>,
    },
}

// ============================================================================
// Find Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum FindCommands {
    /// Find workspaces by search pattern (defaults to current directory name)
    Workspace {
        /// Search pattern (case-insensitive, defaults to current directory name)
        pattern: Option<String>,
    },

    /// Find sessions by search pattern (defaults to current directory name)
    Session {
        /// Search pattern (case-insensitive, defaults to current directory name)
        pattern: Option<String>,

        /// Filter by project path
        #[arg(long)]
        project_path: Option<String>,
    },

    /// Find sessions in a specific project path (defaults to current directory)
    Path {
        /// Search pattern (case-insensitive, defaults to current directory name)
        pattern: Option<String>,

        /// Project path (default: current directory)
        #[arg(long)]
        project_path: Option<String>,
    },
}

// ============================================================================
// Show Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum ShowCommands {
    /// Show workspace details
    Workspace {
        /// Workspace name or hash
        workspace: String,
    },

    /// Show session details
    Session {
        /// Session ID or filename
        session_id: String,

        /// Project path to search in
        #[arg(long)]
        project_path: Option<String>,
    },

    /// Show chat history timeline for a project path
    Path {
        /// Path to the project (default: current directory)
        project_path: Option<String>,
    },
}

// ============================================================================
// Fetch Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum FetchCommands {
    /// Fetch sessions from workspaces matching a pattern
    Workspace {
        /// Workspace name pattern (case-insensitive)
        workspace_name: String,

        /// Target project path (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Overwrite existing sessions
        #[arg(long)]
        force: bool,

        /// Don't register sessions in VS Code index
        #[arg(long)]
        no_register: bool,
    },

    /// Fetch specific sessions by ID
    Session {
        /// Session IDs to fetch (space-separated)
        #[arg(required = true, num_args = 1..)]
        session_ids: Vec<String>,

        /// Target project path (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Overwrite existing sessions
        #[arg(long)]
        force: bool,

        /// Don't register sessions in VS Code index
        #[arg(long)]
        no_register: bool,
    },

    /// Fetch chat sessions from other workspaces by project path
    Path {
        /// Path to the project (default: current directory)
        project_path: Option<String>,

        /// Overwrite existing sessions and skip VS Code running check
        #[arg(long)]
        force: bool,

        /// Don't register sessions in VS Code index
        #[arg(long)]
        no_register: bool,
    },
}

// ============================================================================
// Merge Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum MergeCommands {
    /// Merge sessions from workspaces matching a name pattern
    Workspace {
        /// Workspace name pattern to search for (case-insensitive)
        workspace_name: String,

        /// Title for the merged session
        #[arg(short, long)]
        title: Option<String>,

        /// Target project path to save the merged session (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Skip VS Code running check
        #[arg(long)]
        force: bool,

        /// Don't create backup of current sessions
        #[arg(long)]
        no_backup: bool,
    },

    /// Merge sessions from multiple workspace name patterns
    Workspaces {
        /// Workspace name patterns to search for (space-separated, case-insensitive)
        #[arg(required = true, num_args = 1..)]
        workspace_names: Vec<String>,

        /// Title for the merged session
        #[arg(short, long)]
        title: Option<String>,

        /// Target project path to save the merged session (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Skip VS Code running check
        #[arg(long)]
        force: bool,

        /// Don't create backup of current sessions
        #[arg(long)]
        no_backup: bool,
    },

    /// Merge specific sessions by their IDs or filenames
    Sessions {
        /// Session IDs or filenames (comma-separated or space-separated)
        #[arg(required = true, num_args = 1..)]
        sessions: Vec<String>,

        /// Title for the merged session
        #[arg(short, long)]
        title: Option<String>,

        /// Target project path to save the merged session (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Skip VS Code running check
        #[arg(long)]
        force: bool,

        /// Don't create backup of current sessions
        #[arg(long)]
        no_backup: bool,
    },

    /// Merge all sessions for a project path into one unified chat
    Path {
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

    /// Merge sessions from an LLM provider (Ollama, Cursor, etc.)
    Provider {
        /// Provider name (copilot, cursor, ollama, vllm, foundry, etc.)
        provider_name: String,

        /// Title for the merged session
        #[arg(short, long)]
        title: Option<String>,

        /// Target project path to save the merged session (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Session IDs from the provider to include (omit for all)
        #[arg(long)]
        sessions: Option<Vec<String>>,

        /// Skip VS Code running check
        #[arg(long)]
        force: bool,

        /// Don't create backup of current sessions
        #[arg(long)]
        no_backup: bool,
    },

    /// Merge sessions from multiple providers
    #[command(name = "providers")]
    Providers {
        /// Provider names (space-separated: copilot cursor ollama)
        #[arg(required = true, num_args = 1..)]
        providers: Vec<String>,

        /// Title for the merged session
        #[arg(short, long)]
        title: Option<String>,

        /// Target project path to save the merged session (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Filter by workspace name pattern (applies to providers that support workspaces)
        #[arg(long)]
        workspace: Option<String>,

        /// Skip VS Code running check
        #[arg(long)]
        force: bool,

        /// Don't create backup of current sessions
        #[arg(long)]
        no_backup: bool,
    },

    /// Merge all sessions across all available providers
    All {
        /// Title for the merged session
        #[arg(short, long)]
        title: Option<String>,

        /// Target project path to save the merged session (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Filter by workspace name pattern (applies to providers that support workspaces)
        #[arg(long)]
        workspace: Option<String>,

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
    /// Export sessions from a workspace by hash
    Workspace {
        /// Destination directory for exported sessions
        destination: String,

        /// Source workspace hash
        hash: String,
    },

    /// Export specific sessions by ID
    Sessions {
        /// Destination directory for exported sessions
        destination: String,

        /// Session IDs to export (space-separated)
        #[arg(required = true, num_args = 1..)]
        session_ids: Vec<String>,

        /// Source project path
        #[arg(long)]
        project_path: Option<String>,
    },

    /// Export chat sessions from a project path
    Path {
        /// Destination directory for exported sessions
        destination: String,

        /// Source project path (default: current directory)
        project_path: Option<String>,
    },
}

// ============================================================================
// Import Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum ImportCommands {
    /// Import sessions into a workspace by hash
    Workspace {
        /// Source directory containing session JSON files
        source: String,

        /// Target workspace hash
        hash: String,

        /// Overwrite existing sessions
        #[arg(long)]
        force: bool,
    },

    /// Import specific session files
    Sessions {
        /// Session files to import (space-separated paths)
        #[arg(required = true, num_args = 1..)]
        session_files: Vec<String>,

        /// Target project path (default: current directory)
        #[arg(long)]
        target_path: Option<String>,

        /// Overwrite existing sessions
        #[arg(long)]
        force: bool,
    },

    /// Import chat sessions into a project path
    Path {
        /// Source directory containing session JSON files
        source: String,

        /// Target project path (default: current directory)
        target_path: Option<String>,

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
    /// Move all sessions from one workspace to another
    Workspace {
        /// Source workspace hash
        source_hash: String,

        /// Target workspace hash or project path
        target: String,
    },

    /// Move specific sessions by ID
    Sessions {
        /// Session IDs to move (space-separated)
        #[arg(required = true, num_args = 1..)]
        session_ids: Vec<String>,

        /// Target project path
        target_path: String,
    },

    /// Move sessions from a source path to target path
    Path {
        /// Source project path
        source_path: String,

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

    /// Track chat sessions together with associated file changes
    Track {
        /// Project path
        path: String,

        /// Commit message describing the changes
        #[arg(short, long)]
        message: Option<String>,

        /// Include all staged and unstaged file changes
        #[arg(long)]
        all: bool,

        /// Include specific files in addition to chat sessions
        #[arg(long)]
        files: Option<Vec<String>>,

        /// Create a tag for this tracked state
        #[arg(long)]
        tag: Option<String>,
    },

    /// Show history of chat session commits with associated file changes
    Log {
        /// Project path
        path: String,

        /// Number of commits to show
        #[arg(short = 'n', long, default_value = "10")]
        count: usize,

        /// Show only commits that include chat session changes
        #[arg(long)]
        sessions_only: bool,
    },

    /// Diff chat sessions between commits or current state
    Diff {
        /// Project path
        path: String,

        /// First commit (default: HEAD)
        #[arg(long)]
        from: Option<String>,

        /// Second commit (default: working directory)
        #[arg(long)]
        to: Option<String>,

        /// Show associated file changes alongside chat diffs
        #[arg(long)]
        with_files: bool,
    },

    /// Restore chat sessions from a specific commit
    Restore {
        /// Project path
        path: String,

        /// Commit hash, tag, or reference to restore from
        commit: String,

        /// Also restore associated files from the same commit
        #[arg(long)]
        with_files: bool,

        /// Create a backup before restoring
        #[arg(long)]
        backup: bool,
    },
}

// ============================================================================
// Migration Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum MigrationCommands {
    /// Create a migration package for moving to a new machine
    Create {
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
    Restore {
        /// Path to migration package directory
        package: String,

        /// Project path mapping: 'old1:new1;old2:new2'
        #[arg(long)]
        mapping: Option<String>,

        /// Show what would be done without doing it
        #[arg(long)]
        dry_run: bool,
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

// ============================================================================
// Detect Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum DetectCommands {
    /// Detect workspace for a path
    Workspace {
        /// Project path (default: current directory)
        path: Option<String>,
    },

    /// Detect available providers
    Providers {
        /// Only show providers with sessions
        #[arg(long)]
        with_sessions: bool,
    },

    /// Detect which provider a session belongs to
    Session {
        /// Session ID or filename
        session_id: String,

        /// Project path to search in
        #[arg(long)]
        path: Option<String>,
    },

    /// Detect everything (workspace, providers, sessions) for a path
    All {
        /// Project path (default: current directory)
        path: Option<String>,

        /// Show detailed information
        #[arg(long)]
        verbose: bool,
    },
}

// ============================================================================
// Harvest Subcommands
// ============================================================================

#[derive(Subcommand)]
pub enum HarvestCommands {
    /// Initialize a harvest database
    Init {
        /// Path to the database file (default: ./chat_sessions.db)
        #[arg(long)]
        path: Option<String>,

        /// Initialize git tracking for the database
        #[arg(long)]
        git: bool,
    },

    /// Scan for available providers and sessions
    Scan {
        /// Show individual sessions
        #[arg(long)]
        sessions: bool,

        /// Scan for web-based LLM providers (ChatGPT, Claude, etc.)
        #[arg(long)]
        web: bool,

        /// Timeout in seconds for web provider checks (default: 5)
        #[arg(long, default_value = "5")]
        timeout: u64,

        /// Show verbose debug output for browser scanning
        #[arg(long, short)]
        verbose: bool,
    },

    /// Run the harvest to collect sessions from all providers
    Run {
        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Only include specific providers (comma-separated: copilot,cursor,ollama)
        #[arg(long, value_delimiter = ',')]
        providers: Option<Vec<String>>,

        /// Exclude specific providers (comma-separated)
        #[arg(long, value_delimiter = ',')]
        exclude: Option<Vec<String>>,

        /// Only harvest sessions changed since last run
        #[arg(long)]
        incremental: bool,

        /// Auto-commit changes to git after harvest
        #[arg(long)]
        commit: bool,

        /// Commit message (requires --commit)
        #[arg(short, long)]
        message: Option<String>,
    },

    /// Show harvest database status
    Status {
        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,
    },

    /// List sessions in the harvest database
    List {
        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Filter by provider name
        #[arg(long)]
        provider: Option<String>,

        /// Maximum number of sessions to show
        #[arg(long, default_value = "20")]
        limit: usize,

        /// Search sessions by title or ID
        #[arg(long)]
        search: Option<String>,
    },

    /// Export sessions from the harvest database
    Export {
        /// Output file path
        output: String,

        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Export format: json, jsonl, md (markdown)
        #[arg(long, default_value = "json")]
        format: String,

        /// Filter by provider name
        #[arg(long)]
        provider: Option<String>,

        /// Export specific sessions by ID (comma-separated)
        #[arg(long, value_delimiter = ',')]
        sessions: Option<Vec<String>>,
    },

    /// Import a shared chat session from a URL
    Share {
        /// Share link URL (ChatGPT, Claude, etc.)
        url: String,

        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Custom name for the imported session
        #[arg(long)]
        name: Option<String>,

        /// Associate with a workspace path
        #[arg(long)]
        workspace: Option<String>,
    },

    /// List pending or imported share links
    Shares {
        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Filter by status: pending, imported, failed, expired
        #[arg(long)]
        status: Option<String>,

        /// Maximum number of links to show
        #[arg(long, default_value = "20")]
        limit: usize,
    },

    /// Create a checkpoint (version snapshot) of a session
    Checkpoint {
        /// Session ID to checkpoint
        session: String,

        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Checkpoint description message
        #[arg(short, long)]
        message: Option<String>,
    },

    /// List checkpoints for a session
    Checkpoints {
        /// Session ID to list checkpoints for
        session: String,

        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,
    },

    /// Restore a session to a previous checkpoint
    Restore {
        /// Session ID to restore
        session: String,

        /// Checkpoint number to restore to
        checkpoint: i64,

        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,
    },

    /// Search messages across all sessions (full-text search)
    Search {
        /// Search query
        query: String,

        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Filter by provider
        #[arg(long)]
        provider: Option<String>,

        /// Maximum results to show
        #[arg(long, default_value = "20")]
        limit: usize,
    },

    /// Git operations for the harvest database
    Git {
        #[command(subcommand)]
        command: HarvestGitCommands,
    },
}

#[derive(Subcommand)]
pub enum HarvestGitCommands {
    /// Initialize git tracking for the harvest database
    Init {
        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,
    },

    /// Commit changes to the harvest database
    Commit {
        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Commit message
        #[arg(short, long)]
        message: Option<String>,
    },

    /// Show git log for the harvest database
    Log {
        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Number of commits to show
        #[arg(short = 'n', long, default_value = "10")]
        count: usize,
    },

    /// Show changes to the harvest database
    Diff {
        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,

        /// Compare against specific commit
        #[arg(long)]
        commit: Option<String>,
    },

    /// Restore harvest database from a commit
    Restore {
        /// Commit hash to restore from
        commit: String,

        /// Path to the harvest database
        #[arg(long)]
        path: Option<String>,
    },
}

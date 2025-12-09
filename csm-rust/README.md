# Chat Session Manager (csm) - Rust Edition

A fast, cross-platform CLI tool to manage and merge VS Code Copilot Chat sessions across workspaces.

## Features

- **Discover workspaces** - Find all VS Code workspaces and their chat sessions
- **Fetch history** - Copy chat sessions from historical workspaces
- **Merge history** - Combine all sessions into a single unified chat ordered by timestamp
- **Export/Import** - Move chat sessions between machines
- **Git integration** - Version control your chat history
- **Fast** - Written in Rust for maximum performance

## Installation

### From Source

```bash
cd csm-rust
cargo build --release
```

The binary will be at `target/release/csm` (or `csm.exe` on Windows).

### Add to PATH

```bash
# Linux/macOS
cp target/release/csm ~/.local/bin/

# Windows (PowerShell)
Copy-Item target\release\csm.exe $env:USERPROFILE\.local\bin\
```

## Usage

### History Commands

```bash
# Show all chat sessions across workspaces for current project
csm history show

# Fetch sessions from other workspaces (keeps them separate)
csm history fetch

# Merge ALL sessions into ONE unified chat with timestamps
csm history merge --title "Complete Project History"

# Shorthand aliases
csm fetch history
csm merge-history --title "My Project Timeline"
```

### Workspace Commands

```bash
# List all workspaces
csm list

# Find workspaces by pattern
csm find myproject

# List all chat sessions
csm sessions
```

### Export/Import

```bash
# Export sessions from a workspace
csm export ./backup --path /path/to/project

# Import sessions into a workspace
csm import ./backup --path /path/to/project --force
```

### Git Integration

```bash
# Initialize git versioning for chat sessions
csm init /path/to/project

# Add and commit chat sessions
csm add /path/to/project --commit -m "Update chat history"

# Check status
csm status /path/to/project

# Create a tagged snapshot
csm tag /path/to/project --tag "v1.0-chat"
```

### Migration

```bash
# Create migration package for all workspaces
csm create-migration ./migration-package --all

# Restore on new machine
csm restore-migration ./migration-package

# With path mapping (if project moved)
csm restore-migration ./migration-package --mapping "/old/path:/new/path"
```

## How It Works

VS Code stores Copilot Chat sessions in:
- **Windows**: `%APPDATA%\Code\User\workspaceStorage\<workspace-id>\chatSessions\`
- **macOS**: `~/Library/Application Support/Code/User/workspaceStorage/<workspace-id>/chatSessions/`
- **Linux**: `~/.config/Code/User/workspaceStorage/<workspace-id>/chatSessions/`

Each workspace has a unique ID based on the project path. When you open the same project from different locations (or after reinstalling VS Code), a new workspace ID is created, orphaning your old chat history.

csm solves this by:

1. Finding all workspace instances for your project
2. Collecting chat sessions from all instances
3. Merging them chronologically into a single session
4. Registering the merged session in VS Code's index

## Requirements

- VS Code (any recent version)
- Rust 1.70+ (for building from source)

## License

MIT

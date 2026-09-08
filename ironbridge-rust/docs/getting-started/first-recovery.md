# First Recovery

Let's walk through recovering lost VS Code chat sessions step by step.

## Scenario

You've been using GitHub Copilot Chat in VS Code for weeks. After a VS Code update (or crash), your Chat history dropdown is empty. Your conversations are gone — or so it seems.

IronBridge can recover them.

## Step 1: Install IronBridge

```bash
cargo install ironbridge
ironbridge --version
```

## Step 2: Detect Your Workspace

First, let IronBridge analyze your project:

```bash
ironbridge detect all /path/to/your/project --verbose
```

**Example output:**

```
[<] Detecting workspace for: /path/to/your/project
======================================================================
Workspace ID: abc12345-def6-7890-abcd-ef1234567890
Status: active
Provider: copilot

Available sessions:
  [1] "Implementing authentication system" (2026-01-15)
  [2] "Debugging API endpoints" (2026-01-12)
  [3] "Setting up CI/CD pipeline" (2026-01-08)

Recommendations:
  - 3 sessions available for recovery
  - Run: ironbridge fetch path /path/to/your/project
======================================================================
```

## Step 3: Recover Sessions

```bash
ironbridge fetch path /path/to/your/project
```

**Example output:**

```
[<] Fetching Chat History for: my-project
======================================================================
Found 3 historical workspace(s)

   [OK] Fetched: Implementing authentication system... (abc12345-...)
   [OK] Fetched: Debugging API endpoints... (def67890-...)
   [OK] Fetched: Setting up CI/CD pipeline... (ghi24680-...)

======================================================================
Fetched: 3 sessions

[i] Reload VS Code (Ctrl+R) and check Chat history dropdown
```

## Step 4: Reload VS Code

Press `Ctrl+R` (or `Cmd+R` on macOS) to reload VS Code.

Open the **Chat** panel and check the history dropdown — your sessions should now appear.

## Step 5: Check for Orphaned Sessions

Some sessions may be orphaned (left behind by old workspaces):

```bash
# Scan for orphaned workspaces
ironbridge detect orphaned /path/to/your/project

# Automatically recover them
ironbridge detect orphaned --recover /path/to/your/project

# Register them into VS Code's index
ironbridge register all --force --path /path/to/your/project
```

## Step 6: Back Up Your Sessions

Now that you've recovered everything, create a backup:

```bash
# Export to a directory
ironbridge export path ./session-backup /path/to/your/project

# Or harvest into the unified database
ironbridge harvest run
```

## Step 7: Search Across History

Now you can search across all recovered sessions:

```bash
# Full-text search
ironbridge harvest search "authentication"
ironbridge harvest search "react component"

# List all sessions for this project
ironbridge list sessions --project-path /path/to/your/project

# View a specific session
ironbridge show session <session-id>
```

## Prevention: Real-time Recording

To prevent future data loss, enable real-time recording:

```bash
# Start the recording API server
ironbridge api serve --port 8787
```

The recording API captures sessions as they happen via WebSocket or REST, so even if VS Code crashes, your conversation is safe in the database.

## Troubleshooting

### No sessions found

1. Make sure the project path is correct (it should be the root of your project)
2. Try scanning for all workspaces: `ironbridge list workspaces`
3. Check if the VS Code workspace storage exists on your machine

### Sessions not appearing in VS Code

1. Make sure you reloaded VS Code (`Ctrl+R`)
2. Try registering explicitly: `ironbridge register all --force --path /path/to/project`
3. Check the Chat panel's history dropdown (not the main chat input)

### Wrong provider detected

```bash
# Specify the provider explicitly
ironbridge detect all /path/to/project --verbose

# Fetch from a specific provider
ironbridge harvest run --providers copilot
```

## What's Next?

<div class="grid cards" markdown>

-   :material-console: **CLI Reference**

    ---

    Explore all recovery and fetch commands.

    [:octicons-arrow-right-24: CLI Reference](../api/cli.md)

-   :material-database-search: **Recovery Guide**

    ---

    Comprehensive guide to all recovery strategies.

    [:octicons-arrow-right-24: Recovery Guide](../guides/recovery.md)

-   :material-robot: **Agentic Coding**

    ---

    Use IronBridge as a provider-agnostic coding agent.

    [:octicons-arrow-right-24: Agency Guide](../guides/agency.md)

</div>

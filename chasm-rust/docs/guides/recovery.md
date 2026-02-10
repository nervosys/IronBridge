# Session Recovery Guide

A comprehensive guide to recovering chat sessions that have gone missing, been orphaned by workspace changes, or survived a VS Code crash.

## Why Sessions Disappear

Chat sessions can become inaccessible for several reasons:

| Cause | What Happens | Fix |
|---|---|---|
| VS Code update | New workspace hash generated | `chasm detect orphaned` |
| Project path change | Old hash no longer matches | `chasm detect orphaned` |
| VS Code crash | Session index corrupted | `chasm register all` |
| Editor reinstall | Workspace storage cleared | `chasm recover extract` |
| Multiple VS Code instances | Race condition on index | `chasm sync --pull` |

## Recovery Strategies

### Strategy 1: Quick Fetch

The fastest path. Works when sessions exist on disk but aren't visible in VS Code's Chat dropdown.

```bash
# Fetch and register sessions for a specific project
chasm fetch path /path/to/your/project --verbose
```

After running, reload VS Code (`Ctrl+R`) and check the Chat history dropdown.

### Strategy 2: Orphan Detection

When workspace hashes have changed (e.g., after a path rename or VS Code update):

```bash
# Step 1: Find orphaned sessions
chasm detect orphaned /path/to/project

# Step 2: Review what was found
# (The output shows old and new workspace hashes)

# Step 3: Recover (copy sessions from old hash to new hash)
chasm detect orphaned --recover /path/to/project

# Step 4: Register in VS Code's index
chasm register all --force --path /path/to/project

# Step 5: Reload VS Code
```

### Strategy 3: Full Harvest

When you want to recover everything across all projects and providers:

```bash
# Scan for all available data
chasm harvest scan

# Collect everything
chasm harvest run

# Check what was found
chasm harvest status
```

After harvesting, all sessions are in Chasm's unified database and searchable:

```bash
chasm harvest search "that bug fix from last week"
```

### Strategy 4: Extract from Recording State

If VS Code's workspace state database is intact but the session index is corrupted:

```bash
chasm recover extract /path/to/project
```

This reads the raw VS Code state database directly and reconstructs sessions from it.

### Strategy 5: Format Upgrade

If sessions are in an old format (pre-JSONL):

```bash
chasm recover upgrade /path/to/project
```

## Bulk Recovery Workflow

For recovering sessions across many projects at once:

```bash
# 1. List all workspaces Chasm can find
chasm list workspaces

# 2. Harvest from all providers
chasm harvest run --verbose

# 3. Check for orphaned sessions everywhere
chasm list orphaned

# 4. Export everything as a backup
chasm export batch ./backup /project1 /project2 /project3
```

## Verifying Recovery

After any recovery operation:

1. **Check the database**: `chasm harvest status` — shows total sessions and messages
2. **Search for content**: `chasm harvest search "something you remember"` — confirms data is queryable
3. **Browse interactively**: `chasm tui` or `chasm browse` — visual inspection
4. **Reload VS Code**: `Ctrl+R` — check the Chat history dropdown

## Preventing Future Loss

### Enable Real-time Recording

The most reliable prevention method. Sessions are captured as they happen:

```bash
chasm api serve --port 8787
```

With the VS Code extension installed, every conversation is recorded to the database in real time.

### Regular Harvesting

Set up a periodic harvest (e.g., via cron or Task Scheduler):

```bash
# Harvest daily
chasm harvest run --quiet
```

### Git Versioning

Version your sessions alongside your code:

```bash
chasm git init /path/to/project
# Sessions are now tracked in git
```

### Export Backups

Regular exports provide an additional safety net:

```bash
chasm export batch ./weekly-backup /project1 /project2
```

## Troubleshooting

### "No sessions found"

- Verify the project path is correct
- Check that VS Code has been used for AI chat in that project
- Try `chasm list workspaces` to see all known workspaces
- Try `chasm harvest scan` to discover providers

### "Sessions recovered but not visible in VS Code"

- Make sure you ran `chasm register all --force --path /path/to/project`
- Reload VS Code (`Ctrl+R`)
- Check the Chat panel's **history dropdown** (click the clock icon)

### "Duplicate sessions after recovery"

- This is generally harmless — Chasm deduplicates on harvest
- To clean up: `chasm sync --pull` (re-normalizes everything)

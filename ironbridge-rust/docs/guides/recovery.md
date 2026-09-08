# Session Recovery Guide

A comprehensive guide to recovering chat sessions that have gone missing, been orphaned by workspace changes, or survived a VS Code crash.

## Why Sessions Disappear

Chat sessions can become inaccessible for several reasons:

| Cause | What Happens | Fix |
|---|---|---|
| VS Code update | New workspace hash generated | `ironbridge detect orphaned` |
| Project path change | Old hash no longer matches | `ironbridge detect orphaned` |
| VS Code crash | Session index corrupted | `ironbridge register all` |
| Editor reinstall | Workspace storage cleared | `ironbridge recover extract` |
| Multiple VS Code instances | Race condition on index | `ironbridge sync --pull` |

## Recovery Strategies

### Strategy 1: Quick Fetch

The fastest path. Works when sessions exist on disk but aren't visible in VS Code's Chat dropdown.

```bash
# Fetch and register sessions for a specific project
ironbridge fetch path /path/to/your/project --verbose
```

After running, reload VS Code (`Ctrl+R`) and check the Chat history dropdown.

### Strategy 2: Orphan Detection

When workspace hashes have changed (e.g., after a path rename or VS Code update):

```bash
# Step 1: Find orphaned sessions
ironbridge detect orphaned /path/to/project

# Step 2: Review what was found
# (The output shows old and new workspace hashes)

# Step 3: Recover (copy sessions from old hash to new hash)
ironbridge detect orphaned --recover /path/to/project

# Step 4: Register in VS Code's index
ironbridge register all --force --path /path/to/project

# Step 5: Reload VS Code
```

### Strategy 3: Full Harvest

When you want to recover everything across all projects and providers:

```bash
# Scan for all available data
ironbridge harvest scan

# Collect everything
ironbridge harvest run

# Check what was found
ironbridge harvest status
```

After harvesting, all sessions are in IronBridge's unified database and searchable:

```bash
ironbridge harvest search "that bug fix from last week"
```

### Strategy 4: Extract from Recording State

If VS Code's workspace state database is intact but the session index is corrupted:

```bash
ironbridge recover extract /path/to/project
```

This reads the raw VS Code state database directly and reconstructs sessions from it.

### Strategy 5: Format Upgrade

If sessions are in an old format (pre-JSONL):

```bash
ironbridge recover upgrade /path/to/project
```

## Bulk Recovery Workflow

For recovering sessions across many projects at once:

```bash
# 1. List all workspaces IronBridge can find
ironbridge list workspaces

# 2. Harvest from all providers
ironbridge harvest run --verbose

# 3. Check for orphaned sessions everywhere
ironbridge list orphaned

# 4. Export everything as a backup
ironbridge export batch ./backup /project1 /project2 /project3
```

## Verifying Recovery

After any recovery operation:

1. **Check the database**: `ironbridge harvest status` — shows total sessions and messages
2. **Search for content**: `ironbridge harvest search "something you remember"` — confirms data is queryable
3. **Browse interactively**: `ironbridge tui` or `ironbridge browse` — visual inspection
4. **Reload VS Code**: `Ctrl+R` — check the Chat history dropdown

## Preventing Future Loss

### Enable Real-time Recording

The most reliable prevention method. Sessions are captured as they happen:

```bash
ironbridge api serve --port 8787
```

With the VS Code extension installed, every conversation is recorded to the database in real time.

### Regular Harvesting

Set up a periodic harvest (e.g., via cron or Task Scheduler):

```bash
# Harvest daily
ironbridge harvest run --quiet
```

### Git Versioning

Version your sessions alongside your code:

```bash
ironbridge git init /path/to/project
# Sessions are now tracked in git
```

### Export Backups

Regular exports provide an additional safety net:

```bash
ironbridge export batch ./weekly-backup /project1 /project2
```

## Troubleshooting

### "No sessions found"

- Verify the project path is correct
- Check that VS Code has been used for AI chat in that project
- Try `ironbridge list workspaces` to see all known workspaces
- Try `ironbridge harvest scan` to discover providers

### "Sessions recovered but not visible in VS Code"

- Make sure you ran `ironbridge register all --force --path /path/to/project`
- Reload VS Code (`Ctrl+R`)
- Check the Chat panel's **history dropdown** (click the clock icon)

### "Duplicate sessions after recovery"

- This is generally harmless — IronBridge deduplicates on harvest
- To clean up: `ironbridge sync --pull` (re-normalizes everything)

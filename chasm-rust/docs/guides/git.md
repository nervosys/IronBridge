# Git Versioning

Version-control your AI chat sessions alongside your code. Track how conversations evolve, diff between versions, and maintain a complete history.

## Why Version Sessions?

Chat sessions are development artifacts — just like code, tests, and documentation. Versioning them provides:

- **History**: See how a conversation evolved over time
- **Diffs**: Compare session versions to see what changed
- **Rollback**: Restore a previous session state
- **Collaboration**: Share session history via git remotes
- **Audit trail**: Prove when decisions were made

## Getting Started

### Initialize Git Tracking

```bash
# Initialize git versioning for a project's sessions
chasm git init /path/to/your/project
```

This creates a `.chasm/` directory in your project with a git repository tracking session data.

### Commit Session State

```bash
# Commit the current session state
chasm git commit /path/to/project -m "After implementing auth system"
```

### View History

```bash
# View commit log
chasm git log /path/to/project
```

**Example output:**

```
commit a1b2c3d (HEAD)
Date:   2026-01-15 14:30:00
Message: After implementing auth system
Sessions: 5 (+2 new, 47 new messages)

commit e4f5g6h
Date:   2026-01-14 10:15:00
Message: Initial session capture
Sessions: 3 (initial)
```

### Compare Versions

```bash
# Diff between commits
chasm git diff /path/to/project

# Diff specific commits
chasm git diff /path/to/project --from e4f5g6h --to a1b2c3d
```

## Workflow

### Daily Workflow

```bash
# Morning: harvest latest sessions
chasm harvest run

# Work throughout the day with AI assistants...

# End of day: commit session state
chasm git commit /path/to/project -m "End of day - auth feature complete"
```

### Sprint Workflow

```bash
# Start of sprint
chasm git commit /path/to/project -m "Sprint 12 start"

# During sprint: regular commits
chasm git commit /path/to/project -m "Implemented user registration"
chasm git commit /path/to/project -m "Fixed login bug with help from Copilot"
chasm git commit /path/to/project -m "Refactored auth middleware"

# End of sprint
chasm git commit /path/to/project -m "Sprint 12 complete"
chasm git log /path/to/project  # Review all session changes
```

### Code Review Workflow

When reviewing a PR, check what AI conversations shaped the code:

```bash
# See what AI sessions were involved in recent changes
chasm git log /path/to/project --since "2026-01-10"

# Diff to see new conversations
chasm git diff /path/to/project --from sprint-11 --to sprint-12
```

## Integration with Code Git

Session git and code git are independent — your regular `git` workflow is unaffected. But they complement each other:

```bash
# In your project directory:

# Regular code commit
git add -A && git commit -m "feat: add user authentication"

# Session commit (tracks the AI conversations that led to this code)
chasm git commit . -m "feat: add user authentication"
```

## Best Practices

1. **Commit after milestones** — When you complete a feature or fix a bug, commit your session state
2. **Use descriptive messages** — Future-you will thank present-you
3. **Commit before destructive operations** — Before running `chasm sync --push` or `chasm merge`
4. **Review diffs periodically** — Spot patterns in how AI sessions evolve
5. **Don't commit too frequently** — Daily or per-feature is usually sufficient

## Storage

Session git data is stored in `.chasm/git/` within your project directory. This directory can be:

- **Ignored** in your main `.gitignore` (if sessions are private)
- **Tracked** in your main git repo (if you want sessions versioned with code)

```bash
# To include session history in your code repo:
# (Add to .gitignore to exclude, or don't add to include)
echo ".chasm/" >> .gitignore  # Exclude
# Or: leave .gitignore as-is to include session history
```

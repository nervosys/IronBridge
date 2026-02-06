# Session Organizer Skill

Organize AI coding sessions by project, topic, and outcome. Apply tags,
create summaries, and maintain a clean session history.

## When to Use

Run when the user says:
- "Organize my sessions"
- "Tag my sessions by topic"
- "Clean up my session history"
- "Categorize my recent work"

## How It Works

### Step 1: Inventory Sessions

```sql
SELECT
    s.id,
    s.title,
    s.provider,
    s.workspace_name,
    s.created_at,
    s.message_count,
    s.model,
    (SELECT content FROM messages_v2
     WHERE session_id = s.id AND role = 'user'
     ORDER BY timestamp ASC LIMIT 1) as first_message,
    (SELECT GROUP_CONCAT(DISTINCT file_path)
     FROM file_changes WHERE session_id = s.id) as files_changed
FROM sessions s
ORDER BY s.created_at DESC
LIMIT 100;
```

### Step 2: Auto-Categorize

Based on the first user message and files changed, assign categories:

- **Feature** — "add", "implement", "create", "build"
- **Bug Fix** — "fix", "bug", "error", "broken", "debug"
- **Refactor** — "refactor", "restructure", "cleanup", "reorganize"
- **Documentation** — "docs", "readme", "comment", "explain"
- **Configuration** — "config", "setup", "install", "deploy"
- **Testing** — "test", "spec", "assert", "validate"
- **Research** — "how to", "what is", "compare", "evaluate"
- **Style** — "format", "lint", "style", "color", "theme"

### Step 3: Group by Project

```sql
SELECT
    COALESCE(s.workspace_name, 'Unknown') as project,
    COUNT(*) as session_count,
    SUM(s.message_count) as total_messages,
    MIN(s.created_at) as first_session,
    MAX(s.created_at) as last_session
FROM sessions s
GROUP BY COALESCE(s.workspace_name, 'Unknown')
ORDER BY last_session DESC;
```

### Step 4: Generate Organized View

```markdown
## Session Organization Report

### By Project
#### [Project Name] (N sessions)
- Feature: N sessions
- Bug Fix: N sessions
- Refactor: N sessions

### By Time Period
#### This Week
- [Session title] — [Category] — [Provider/Model]

#### Last Week
- [Session title] — [Category] — [Provider/Model]

### Suggestions
- Sessions without titles: N (consider adding titles)
- Very short sessions (<3 messages): N (consider merging)
- Sessions older than 90 days: N (consider archiving)
```

## CLI Alternative

```bash
# List sessions sorted by workspace
chasm harvest list --sort-by workspace

# Export for organization
chasm harvest export --format json

# Use git versioning to snapshot organized state
chasm harvest git init
chasm harvest git commit -m "Organized sessions"
```

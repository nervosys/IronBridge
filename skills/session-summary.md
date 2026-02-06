# Session Summary Skill

Generate standup-ready summaries of recent AI coding sessions from the chasm
harvest database. Produces concise, actionable summaries grouped by project.

## When to Use

Run when the user says:
- "Summarize my coding sessions"
- "What did I work on today/this week?"
- "Generate a standup summary"
- "Show my recent activity"

## How It Works

Query the chasm harvest database for recent sessions, extract key information
from messages, and generate a structured summary.

### Step 1: Query Recent Sessions

```sql
SELECT
    s.id,
    s.title,
    s.provider,
    s.workspace_name,
    s.created_at,
    s.message_count,
    s.model,
    GROUP_CONCAT(DISTINCT fc.file_path) as files_changed
FROM sessions s
LEFT JOIN messages_v2 m ON m.session_id = s.id
LEFT JOIN file_changes fc ON fc.session_id = s.id
WHERE s.created_at >= datetime('now', '-7 days')
GROUP BY s.id
ORDER BY s.created_at DESC;
```

### Step 2: Get Message Highlights

For each session, extract the first user message (intent) and key assistant
responses:

```sql
SELECT role, content
FROM messages_v2
WHERE session_id = ?
ORDER BY timestamp ASC
LIMIT 10;
```

### Step 3: Get Tool Usage

```sql
SELECT tool_name, COUNT(*) as invocation_count
FROM tool_invocations
WHERE session_id = ?
GROUP BY tool_name
ORDER BY invocation_count DESC;
```

### Step 4: Generate Summary

Format the output as:

```markdown
## Coding Session Summary — [Date Range]

### [Project Name]
- **Session:** [Title] ([Provider], [Model])
  - **Intent:** [First user message, truncated to 100 chars]
  - **Files changed:** [file1.ts, file2.rs, ...]
  - **Tools used:** [tool1 (3x), tool2 (1x)]
  - **Duration:** [Estimated from timestamps]

### Statistics
- Total sessions: N
- Total messages: N
- Most active project: [Project]
- Most used model: [Model]
```

## CLI Alternative

```bash
# Quick summary via chasm CLI
chasm harvest search --query "recent" --limit 20

# Export recent sessions
chasm harvest export --format md --since "7 days ago"
```

## API Alternative

```bash
# Via the chasm API server
curl http://localhost:3000/api/v1/stats/overview
curl http://localhost:3000/api/v1/sessions?since=7d&limit=50
```

# Code Insight Skill

Analyze tool invocations and file changes across AI coding sessions to extract
code quality insights, development patterns, and improvement opportunities.
This skill is **unique to Chasm** — it leverages the normalized `tool_invocations`
and `file_changes` tables that no markdown-only system can provide.

## When to Use

Run when the user says:
- "What files did I change the most?"
- "Show my development patterns"
- "Analyze my tool usage"
- "Which files need attention?"
- "Show code churn across sessions"

## How It Works

### Step 1: File Change Hotspots

Identify files that are changed most frequently across sessions (high churn
indicates complexity or instability):

```sql
SELECT
    fc.file_path,
    COUNT(DISTINCT fc.session_id) as sessions_touched,
    COUNT(*) as total_changes,
    GROUP_CONCAT(DISTINCT s.provider) as providers
FROM file_changes fc
JOIN sessions s ON s.id = fc.session_id
WHERE s.created_at >= datetime('now', '-30 days')
GROUP BY fc.file_path
ORDER BY sessions_touched DESC
LIMIT 20;
```

### Step 2: Tool Usage Patterns

Analyze which tools are used most and how effectively:

```sql
SELECT
    ti.tool_name,
    COUNT(*) as total_invocations,
    COUNT(DISTINCT ti.session_id) as sessions_used,
    SUM(CASE WHEN ti.result LIKE '%error%' OR ti.result LIKE '%failed%'
        THEN 1 ELSE 0 END) as error_count,
    ROUND(
        100.0 * SUM(CASE WHEN ti.result LIKE '%error%' OR ti.result LIKE '%failed%'
            THEN 1 ELSE 0 END) / COUNT(*), 1
    ) as error_rate_pct
FROM tool_invocations ti
JOIN sessions s ON s.id = ti.session_id
WHERE s.created_at >= datetime('now', '-30 days')
GROUP BY ti.tool_name
ORDER BY total_invocations DESC;
```

### Step 3: Provider & Model Effectiveness

Compare how different models/providers perform on similar tasks:

```sql
SELECT
    s.provider,
    s.model,
    COUNT(*) as session_count,
    AVG(s.message_count) as avg_messages,
    AVG(
        (SELECT COUNT(*) FROM tool_invocations ti WHERE ti.session_id = s.id)
    ) as avg_tools_per_session,
    AVG(
        (SELECT COUNT(*) FROM file_changes fc WHERE fc.session_id = s.id)
    ) as avg_files_changed
FROM sessions s
WHERE s.created_at >= datetime('now', '-30 days')
GROUP BY s.provider, s.model
ORDER BY session_count DESC;
```

### Step 4: Development Velocity

Track session frequency and productivity over time:

```sql
SELECT
    DATE(s.created_at) as date,
    COUNT(*) as sessions,
    SUM(s.message_count) as total_messages,
    (SELECT COUNT(DISTINCT fc.file_path) FROM file_changes fc
     JOIN sessions s2 ON s2.id = fc.session_id
     WHERE DATE(s2.created_at) = DATE(s.created_at)) as files_changed
FROM sessions s
WHERE s.created_at >= datetime('now', '-30 days')
GROUP BY DATE(s.created_at)
ORDER BY date DESC;
```

### Step 5: Generate Report

```markdown
## Code Insight Report — Last 30 Days

### File Hotspots (Most Changed)
| File | Sessions | Changes | Providers |
|------|----------|---------|-----------|
| src/main.rs | 12 | 45 | copilot, cursor |
| ...

### Tool Effectiveness
| Tool | Uses | Error Rate | Sessions |
|------|------|-----------|----------|
| file_edit | 234 | 3.2% | 45 |
| ...

### Model Comparison
| Provider/Model | Sessions | Avg Messages | Avg Files |
|----------------|----------|-------------|-----------|
| copilot/gpt-4o | 30 | 15.2 | 4.1 |
| ...

### Recommendations
- **High churn files** that may need refactoring: [list]
- **Most effective model** for your workflow: [model]
- **Tools with high error rates** to investigate: [list]
```

## CLI Alternative

```bash
# Search across all sessions
chasm harvest search --query "refactor OR restructure OR cleanup"

# Export for external analysis
chasm harvest export --format jsonl
```

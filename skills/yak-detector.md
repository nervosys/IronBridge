# Yak-Shaving Detector Skill

Analyze AI coding sessions for scope creep, rabbit holes, and yak-shaving
patterns — when the original goal gets derailed by increasingly tangential
sub-tasks.

## When to Use

Run when the user says:
- "Am I yak-shaving?"
- "Check for scope creep"
- "Did I get sidetracked?"
- "Analyze my session focus"

## How It Works

### Step 1: Extract Session Intent

Get the first user message (the original goal) and track how the conversation
diverges:

```sql
SELECT
    s.id,
    s.title,
    s.created_at,
    s.message_count,
    (SELECT content FROM messages_v2
     WHERE session_id = s.id AND role = 'user'
     ORDER BY timestamp ASC LIMIT 1) as original_intent,
    (SELECT content FROM messages_v2
     WHERE session_id = s.id AND role = 'user'
     ORDER BY timestamp DESC LIMIT 1) as final_message
FROM sessions s
WHERE s.created_at >= datetime('now', '-7 days')
ORDER BY s.created_at DESC;
```

### Step 2: Analyze Topic Drift

For each session, compare the semantic distance between the original intent
and subsequent user messages. Use keyword extraction:

```sql
SELECT
    m.role,
    m.content,
    m.timestamp,
    ROW_NUMBER() OVER (ORDER BY m.timestamp) as msg_order
FROM messages_v2 m
WHERE m.session_id = ?
AND m.role = 'user'
ORDER BY m.timestamp ASC;
```

### Step 3: Detect Yak-Shaving Patterns

Look for these signals:
1. **Topic divergence** — Later messages contain different keywords than the
   first message
2. **Tool chain depth** — Excessive tool invocations suggest deep rabbit holes
3. **File scatter** — Changes to many unrelated files suggest scope creep
4. **Session length** — Very long sessions (>50 messages) often indicate
   yak-shaving

```sql
-- File scatter score: how many distinct directories were touched?
SELECT
    COUNT(DISTINCT
        CASE
            WHEN INSTR(file_path, '/') > 0
            THEN SUBSTR(file_path, 1, INSTR(file_path, '/'))
            ELSE file_path
        END
    ) as directory_scatter,
    COUNT(DISTINCT file_path) as files_changed
FROM file_changes
WHERE session_id = ?;

-- Tool chain depth
SELECT COUNT(*) as tool_invocations
FROM tool_invocations
WHERE session_id = ?;
```

### Step 4: Score and Report

Calculate a yak-shaving score (0-10) based on:
- Topic divergence (0-3 points)
- File scatter vs original intent (0-3 points)
- Session length relative to complexity (0-2 points)
- Tool chain depth (0-2 points)

```markdown
## Yak-Shaving Analysis — [Date Range]

### Session: [Title]
- **Original goal:** [First user message]
- **Yak score:** 🐃 7/10
- **What happened:**
  1. Started with: [original intent]
  2. Diverted to: [list of tangential topics]
  3. Ended up: [final state]
- **Files touched:** N across M directories
- **Recommendation:** Consider breaking this into separate sessions

### Overall Score
- Average yak score: N/10
- Worst offender: [Session title]
- Most focused session: [Session title]
```

## CLI Alternative

```bash
# Search for long sessions (potential yak-shaving)
chasm harvest search --query "debug OR fix OR workaround" --limit 10

# Check session message counts
chasm harvest list --sort-by messages --limit 10
```

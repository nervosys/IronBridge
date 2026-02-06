# Link Trail Skill

Track and catalog all URLs fetched, referenced, or discussed during AI coding
sessions. Build a knowledge map of external resources used during development.

## When to Use

Run when the user says:
- "Show my link trail"
- "What URLs did I visit?"
- "List references from my sessions"
- "Build a resource map"

## How It Works

### Step 1: Extract URLs from Messages

```sql
SELECT
    s.id as session_id,
    s.title,
    s.provider,
    s.created_at,
    m.role,
    m.content
FROM messages_v2 m
JOIN sessions s ON s.id = m.session_id
WHERE m.content LIKE '%http://%'
   OR m.content LIKE '%https://%'
ORDER BY s.created_at DESC;
```

For each message, extract URLs using this regex pattern:
`https?://[^\s\)\]\>\"\'\`]+`

### Step 2: Extract URLs from Tool Invocations

```sql
SELECT
    ti.tool_name,
    ti.arguments,
    ti.result,
    s.title,
    s.created_at
FROM tool_invocations ti
JOIN sessions s ON s.id = ti.session_id
WHERE ti.arguments LIKE '%http%'
   OR ti.result LIKE '%http%'
ORDER BY s.created_at DESC;
```

### Step 3: FTS5 Search for URL Contexts

```sql
SELECT
    s.title,
    snippet(messages_fts, 0, '>>>', '<<<', '...', 30) as context
FROM messages_fts
JOIN sessions s ON s.id = messages_fts.session_id
WHERE messages_fts MATCH 'github.com OR stackoverflow.com OR docs OR documentation'
ORDER BY rank
LIMIT 50;
```

### Step 4: Categorize and Report

Group URLs by domain and type:

```markdown
## Link Trail — [Date Range]

### Most Referenced Domains
| Domain | Count | Sessions |
|--------|-------|----------|
| github.com | 23 | 8 |
| stackoverflow.com | 15 | 6 |
| docs.rs | 12 | 5 |

### By Category

#### Documentation
- https://docs.rs/tokio/latest/ (3 sessions)
- https://doc.rust-lang.org/std/ (2 sessions)

#### Stack Overflow
- https://stackoverflow.com/questions/... (referenced in [session])

#### GitHub
- https://github.com/owner/repo/issues/123 (referenced in [session])

#### Package Registries
- https://crates.io/crates/serde (1 session)
- https://www.npmjs.com/package/react (1 session)

### Session Link Map
#### [Session Title] — [Date]
- [url1] — mentioned by [user/assistant]  
- [url2] — used in tool invocation

### Statistics
- Total unique URLs: N
- Total domains: N
- Most linked session: [title] (N URLs)
- Most common domain: [domain] (N references)
```

## CLI Alternative

```bash
# Search for URLs in sessions
chasm harvest search --query "github.com OR stackoverflow.com OR docs"

# Export sessions with URLs for external analysis
chasm harvest export --format jsonl
```

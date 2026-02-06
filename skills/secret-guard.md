# Secret Guard Skill

Scan AI coding session history for accidentally leaked secrets, API keys,
tokens, passwords, and other sensitive data. Can be used as a pre-commit
hook or on-demand audit.

## When to Use

Run when the user says:
- "Scan for secrets"
- "Check for leaked API keys"
- "Set up secret scanning"
- "Audit my session history for sensitive data"

## How It Works

### Step 1: Scan Messages for Secrets

Search the harvest database for common secret patterns:

```sql
-- API keys and tokens
SELECT
    s.id as session_id,
    s.title,
    s.provider,
    m.role,
    m.content,
    s.created_at
FROM messages_v2 m
JOIN sessions s ON s.id = m.session_id
WHERE m.content REGEXP '(sk-[a-zA-Z0-9]{20,})'           -- OpenAI keys
   OR m.content REGEXP '(ghp_[a-zA-Z0-9]{36})'           -- GitHub PATs
   OR m.content REGEXP '(gho_[a-zA-Z0-9]{36})'           -- GitHub OAuth
   OR m.content REGEXP '(github_pat_[a-zA-Z0-9_]{82})'   -- GitHub fine-grained PATs
   OR m.content REGEXP '(xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24})'  -- Slack bot tokens
   OR m.content REGEXP '(AKIA[0-9A-Z]{16})'              -- AWS access keys
   OR m.content REGEXP '(AIza[0-9A-Za-z_-]{35})'         -- Google API keys
   OR m.content REGEXP '(ya29\.[0-9A-Za-z_-]+)'          -- Google OAuth
   OR m.content LIKE '%-----BEGIN RSA PRIVATE KEY-----%'  -- RSA private keys
   OR m.content LIKE '%-----BEGIN OPENSSH PRIVATE KEY-----%'  -- SSH keys
   OR m.content LIKE '%password%=%'                       -- Passwords in config
   OR m.content LIKE '%secret_key%=%'                     -- Secret keys
   OR m.content LIKE '%api_key%=%'                        -- API keys
   OR m.content LIKE '%DATABASE_URL%=%'                   -- Database URLs
ORDER BY s.created_at DESC;
```

### Step 2: FTS5 Search for Sensitive Terms

```sql
SELECT
    s.id,
    s.title,
    s.provider,
    snippet(messages_fts, 0, '>>>', '<<<', '...', 20) as context
FROM messages_fts
JOIN sessions s ON s.id = messages_fts.session_id
WHERE messages_fts MATCH 'password OR secret OR token OR api_key OR private_key OR credentials'
ORDER BY rank
LIMIT 50;
```

### Step 3: Check Tool Invocations for exposed secrets

```sql
SELECT
    ti.tool_name,
    ti.arguments,
    ti.result,
    s.title,
    s.created_at
FROM tool_invocations ti
JOIN sessions s ON s.id = ti.session_id
WHERE ti.arguments LIKE '%key%'
   OR ti.arguments LIKE '%token%'
   OR ti.arguments LIKE '%secret%'
   OR ti.result LIKE '%sk-%'
   OR ti.result LIKE '%ghp_%'
ORDER BY s.created_at DESC;
```

### Step 4: Generate Report

```markdown
## Secret Scan Report — [Date]

### 🚨 Secrets Found: N

#### Critical (immediate action required)
| Session | Provider | Type | Context |
|---------|----------|------|---------|
| [title] | copilot | AWS Key | AKIA... found in message |

#### Warning (potential exposure)
| Session | Provider | Type | Context |
|---------|----------|------|---------|
| [title] | cursor | Password | password= in config snippet |

### Recommendations
1. Rotate any exposed keys immediately
2. Add patterns to .gitignore to prevent session file commits
3. Consider using environment variables instead of hardcoded values
4. Run `chasm harvest git commit` to checkpoint before cleanup
```

## Pre-Commit Hook Setup

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Scan staged files for secrets in session history
if git diff --cached --name-only | grep -q '.specstory\|chatSessions'; then
    echo "⚠️  Session history files staged for commit"
    echo "Running secret scan..."
    chasm harvest search --query "password OR secret OR token OR api_key" --limit 5
    if [ $? -eq 0 ]; then
        echo "⚠️  Potential secrets found. Review before committing."
        echo "Use 'git commit --no-verify' to skip this check."
        exit 1
    fi
fi
```

## CLI Alternative

```bash
# Quick search for secret patterns
chasm harvest search --query "api_key OR password OR token OR secret"

# Full-text search
chasm harvest search --query "sk- OR ghp_ OR AKIA"
```

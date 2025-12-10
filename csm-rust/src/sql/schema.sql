-- CSM Universal Intermediate Database Schema
-- Version: 2.0
-- 
-- This schema provides a universal representation for chat sessions
-- from multiple providers (VS Code Copilot, web providers, local LLMs)
-- with support for version tracking via checkpoints.

-- Schema version tracking
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert schema version if not exists
INSERT OR IGNORE INTO metadata (key, value) VALUES ('schema_version', '2.0');

-- Workspaces represent project directories or logical groupings
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,                    -- UUID
    name TEXT NOT NULL,
    path TEXT,                              -- Local filesystem path if applicable
    provider TEXT NOT NULL,                 -- 'copilot', 'chatgpt', 'claude', etc.
    provider_workspace_id TEXT,             -- Provider-specific workspace ID
    created_at INTEGER NOT NULL,            -- Unix timestamp
    updated_at INTEGER NOT NULL,            -- Unix timestamp
    metadata TEXT                           -- JSON blob for provider-specific data
);

-- Sessions represent individual chat conversations
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                    -- UUID
    workspace_id TEXT,                      -- FK to workspaces.id
    provider TEXT NOT NULL,                 -- Source provider
    provider_session_id TEXT,               -- Provider's session ID
    title TEXT NOT NULL DEFAULT '',         -- User-friendly session name
    model TEXT,                             -- LLM model used (if known)
    message_count INTEGER DEFAULT 0,
    token_count INTEGER,                    -- Estimated token count
    created_at INTEGER NOT NULL,            -- Unix timestamp
    updated_at INTEGER NOT NULL,            -- Unix timestamp
    archived INTEGER DEFAULT 0,             -- Boolean: 1 = archived
    metadata TEXT,                          -- JSON blob for provider-specific data
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- Messages store individual conversation turns
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,                    -- UUID
    session_id TEXT NOT NULL,               -- FK to sessions.id
    role TEXT NOT NULL,                     -- 'user', 'assistant', 'system', 'tool'
    content TEXT NOT NULL,                  -- Message content (may be large)
    model TEXT,                             -- Model used for this specific message
    token_count INTEGER,                    -- Estimated tokens for this message
    created_at INTEGER NOT NULL,            -- Unix timestamp
    parent_id TEXT,                         -- For branching conversations
    metadata TEXT,                          -- JSON blob (tool calls, annotations, etc.)
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Checkpoints provide version history snapshots
CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,                    -- UUID
    session_id TEXT NOT NULL,               -- FK to sessions.id
    name TEXT NOT NULL,                     -- Version name (e.g., "v1.0")
    description TEXT,                       -- User-provided checkpoint description
    message_count INTEGER NOT NULL,         -- Number of messages at checkpoint
    session_snapshot TEXT NOT NULL,         -- JSON snapshot of session state
    created_at INTEGER NOT NULL,            -- Unix timestamp
    git_commit TEXT,                        -- Git commit hash if version-controlled
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Share links track imported shared conversations
CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,                    -- UUID
    session_id TEXT,                        -- Linked session after import (FK to sessions.id)
    provider TEXT NOT NULL,                 -- 'chatgpt', 'claude', 'gemini', etc.
    url TEXT NOT NULL UNIQUE,               -- Original share URL
    share_id TEXT NOT NULL,                 -- Provider's share identifier extracted from URL
    title TEXT,                             -- Extracted title if available
    imported INTEGER DEFAULT 0,             -- Boolean: 1 = imported
    imported_at INTEGER,                    -- Unix timestamp when imported
    created_at INTEGER NOT NULL,            -- Unix timestamp
    metadata TEXT,                          -- JSON blob for provider-specific data
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Import sources track where data came from
CREATE TABLE IF NOT EXISTS import_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,               -- FK to sessions.id
    source_type TEXT NOT NULL,              -- 'file', 'database', 'api', 'share_link', 'export'
    source_path TEXT,                       -- File path or URL
    source_provider TEXT,                   -- Original provider
    import_version INTEGER DEFAULT 1,       -- Track re-imports
    checksum TEXT,                          -- Source content hash
    imported_at INTEGER NOT NULL,           -- Unix timestamp
    metadata TEXT,                          -- JSON blob for import details
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Tags for organizing sessions
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,                             -- Optional hex color
    created_at INTEGER NOT NULL             -- Unix timestamp
);

-- Many-to-many relationship between sessions and tags
CREATE TABLE IF NOT EXISTS session_tags (
    session_id TEXT NOT NULL,               -- FK to sessions.id
    tag_id INTEGER NOT NULL,                -- FK to tags.id
    created_at INTEGER NOT NULL,            -- Unix timestamp
    PRIMARY KEY (session_id, tag_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_provider ON sessions(provider);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON checkpoints(created_at);

CREATE INDEX IF NOT EXISTS idx_share_links_provider ON share_links(provider);
CREATE INDEX IF NOT EXISTS idx_share_links_imported ON share_links(imported);

CREATE INDEX IF NOT EXISTS idx_import_sources_session ON import_sources(session_id);
CREATE INDEX IF NOT EXISTS idx_import_sources_type ON import_sources(source_type);

CREATE INDEX IF NOT EXISTS idx_workspaces_provider ON workspaces(provider);
CREATE INDEX IF NOT EXISTS idx_workspaces_path ON workspaces(path);

-- Full-text search support for message content
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content,
    content='messages',
    content_rowid='rowid'
);

-- Views for common queries

-- Active sessions with workspace info
CREATE VIEW IF NOT EXISTS v_sessions_with_workspace AS
SELECT 
    s.id,
    s.title AS session_name,
    s.provider,
    s.model,
    s.created_at,
    s.updated_at,
    s.message_count,
    s.token_count,
    w.name AS workspace_name,
    w.path AS workspace_path
FROM sessions s
LEFT JOIN workspaces w ON s.workspace_id = w.id
ORDER BY s.updated_at DESC;

-- Session summary with checkpoint count
CREATE VIEW IF NOT EXISTS v_session_summary AS
SELECT 
    s.id,
    s.title AS name,
    s.provider,
    s.model,
    s.message_count,
    s.token_count,
    s.created_at,
    s.updated_at,
    COUNT(c.id) AS checkpoint_count,
    MAX(c.created_at) AS last_checkpoint
FROM sessions s
LEFT JOIN checkpoints c ON s.id = c.session_id
GROUP BY s.id;

-- Pending share links
CREATE VIEW IF NOT EXISTS v_pending_shares AS
SELECT 
    id,
    url,
    provider,
    share_id,
    created_at
FROM share_links
WHERE imported = 0
ORDER BY created_at DESC;

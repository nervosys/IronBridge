// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { CodeBlock, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function HarvestPage() {
    return (
        <div className="content-wrapper">
            <h1>Harvest System</h1>
            <p className="page-description">
                The harvest system collects and normalizes chat sessions from 30+
                providers into a unified SQLite database with full-text search.
            </p>

            <h2>Initialize</h2>
            <CodeBlock language="bash">
                {`ironbridge harvest init               # Create database
ironbridge harvest init --git         # Also initialize git tracking`}
            </CodeBlock>

            <h2>Scan &amp; Run</h2>
            <CodeBlock language="bash">
                {`ironbridge harvest scan               # Discover available providers
ironbridge harvest run                # Collect all sessions
ironbridge harvest run --incremental  # Only new/modified sessions
ironbridge harvest status             # Database statistics`}
            </CodeBlock>

            <h2>Full-Text Search</h2>
            <p>
                Search across all harvested messages using SQLite FTS5 with ranked results
                and contextual snippets:
            </p>
            <CodeBlock language="bash">
                {`ironbridge harvest search "authentication middleware"
ironbridge harvest search "how to deploy" --limit 20`}
            </CodeBlock>

            <h2>Share Link Import</h2>
            <p>Import shared conversations from cloud AI services:</p>
            <CodeBlock language="bash">
                {`ironbridge harvest share https://chatgpt.com/share/abc123
ironbridge harvest share https://claude.ai/share/xyz789`}
            </CodeBlock>

            <h2>Provider Filtering</h2>
            <CodeBlock language="bash">
                {`# Only harvest from specific providers
ironbridge harvest run --providers copilot,cursor

# Exclude certain providers
ironbridge harvest run --exclude ollama,vllm`}
            </CodeBlock>

            <h2>Database Schema</h2>
            <p>
                The harvest database stores sessions in a normalized schema with
                provider metadata, messages, tool invocations, and file changes:
            </p>
            <CodeBlock language="sql" filename="Core Tables">
                {`sessions      — id, title, provider, workspace, created_at, updated_at
messages      — id, session_id, role, content, timestamp
tool_uses     — id, message_id, tool_name, input, output
file_changes  — id, session_id, path, action, diff`}
            </CodeBlock>

            <Callout type="info" title="Search Optimization">
                IronBridge uses FTS5 <code>snippet()</code> and <code>rank</code> ordering
                with session deduplication. Title-only searches use 4KB header reads
                for 10-100x faster performance.
            </Callout>

            <PageNav currentPath="/docs/harvest" />
        </div>
    );
}

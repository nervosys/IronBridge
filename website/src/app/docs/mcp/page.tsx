// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CodeBlock, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function McpPage() {
    return (
        <div className="content-wrapper">
            <h1>MCP Server</h1>
            <p className="page-description">
                Chasm provides a{' '}
                <a href="https://modelcontextprotocol.io/" target="_blank" rel="noopener noreferrer">
                    Model Context Protocol
                </a>{' '}
                server for AI agent integration.
            </p>

            <h2>Configuration</h2>
            <p>Add Chasm to your AI agent&apos;s MCP configuration:</p>
            <CodeBlock language="json" filename="mcp_config.json">
                {`{
  "mcpServers": {
    "chasm": {
      "command": "csm-mcp"
    }
  }
}`}
            </CodeBlock>

            <h2>Available Tools</h2>
            <table>
                <thead>
                    <tr><th>Tool</th><th>Description</th></tr>
                </thead>
                <tbody>
                    <tr><td><code>chasm_list_workspaces</code></td><td>List all discovered workspaces</td></tr>
                    <tr><td><code>chasm_list_sessions</code></td><td>List sessions in a workspace</td></tr>
                    <tr><td><code>chasm_get_session</code></td><td>Get full session content with messages</td></tr>
                    <tr><td><code>chasm_search_sessions</code></td><td>Full-text search across all sessions</td></tr>
                    <tr><td><code>chasm_get_stats</code></td><td>Get database statistics</td></tr>
                </tbody>
            </table>

            <h2>Usage with Claude Code</h2>
            <CodeBlock language="bash">
                {`# Install the MCP binary
cargo install chasm --bin csm-mcp

# Add to Claude Code config
echo '{"mcpServers":{"chasm":{"command":"csm-mcp"}}}' > ~/.claude/mcp_config.json`}
            </CodeBlock>

            <h2>Usage with VS Code Copilot</h2>
            <CodeBlock language="json" filename=".vscode/mcp.json">
                {`{
  "servers": {
    "chasm": {
      "command": "csm-mcp",
      "args": []
    }
  }
}`}
            </CodeBlock>

            <Callout type="tip" title="What can agents do?">
                With MCP, AI agents can search your conversation history, find relevant
                past sessions, and use prior context to improve their responses.
            </Callout>

            <PageNav currentPath="/docs/mcp" />
        </div>
    );
}

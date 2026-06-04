// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CodeBlock, Callout, Badge } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function AgentsPage() {
  return (
    <div className="content-wrapper">
      <h1>Agent Launcher</h1>
      <p className="page-description">
        Launch terminal AI coding agents with automatic session capture and
        harvesting via <code>chasm run &lt;agent&gt;</code>.
      </p>

      <h2>Supported Agents</h2>
      <table>
        <thead>
          <tr><th>Alias</th><th>Agent</th><th>Storage Path</th></tr>
        </thead>
        <tbody>
          <tr><td><code>claude</code></td><td>Claude Code</td><td><code>~/.claude/projects/</code></td></tr>
          <tr><td><code>open</code></td><td>OpenCode</td><td><code>~/.opencode/conversations/</code></td></tr>
          <tr><td><code>claw</code></td><td>OpenClaw (ClawdBot)</td><td><code>~/.openclaw/chat-history/</code></td></tr>
          <tr><td><code>cursor</code></td><td>Cursor CLI</td><td><code>~/.cursor/chats/</code></td></tr>
          <tr><td><code>codex</code></td><td>Codex CLI (OpenAI)</td><td><code>~/.codex/sessions/</code></td></tr>
          <tr><td><code>droid</code></td><td>Droid CLI (Factory)</td><td><code>~/.factory/sessions/</code></td></tr>
          <tr><td><code>gemini</code></td><td>Gemini CLI (Google)</td><td><code>~/.gemini/tmp/</code></td></tr>
        </tbody>
      </table>

      <h2>Usage</h2>
      <CodeBlock language="bash">
{`# Launch with default (Claude Code)
chasm run claude

# Launch Gemini CLI with extra arguments
chasm run gemini -- --model gemini-2.0-flash

# Skip auto-save
chasm run codex --no-save

# With verbose output
chasm run droid --verbose`}
      </CodeBlock>

      <h2>How It Works</h2>
      <ol>
        <li><strong>Snapshot</strong> — Before launch, Chasm snapshots the agent&apos;s session directory (file list + timestamps).</li>
        <li><strong>Launch</strong> — The agent binary is executed with inherited stdio for interactive use.</li>
        <li><strong>Detect</strong> — When the agent exits, Chasm diffs the snapshot to find new/modified session files.</li>
        <li><strong>Harvest</strong> — New sessions are automatically ingested into the harvest database.</li>
      </ol>

      <h2>Check Agent Status</h2>
      <CodeBlock language="bash">
        {`chasm list agents`}
      </CodeBlock>
      <p>Shows all agents with their installation status (<Badge variant="stable">installed</Badge> or missing) and storage paths.</p>

      <Callout type="info" title="Cross-Platform">
        Agent binary discovery uses <code>where</code> (Windows) or{' '}
        <code>which</code> (Unix) and also checks for <code>.cmd</code> wrappers
        from npm global installs.
      </Callout>

      <PageNav currentPath="/docs/agents" />
    </div>
  );
}

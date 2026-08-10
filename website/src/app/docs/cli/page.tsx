// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { CodeBlock } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function CliPage() {
  return (
    <div className="content-wrapper">
      <h1>CLI Reference</h1>
      <p className="page-description">
        Complete reference for all Chasm CLI commands.
      </p>

      <h2>List &amp; Find</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>chasm list workspaces</code></td><td>List all discovered workspaces</td></tr>
          <tr><td><code>chasm list sessions</code></td><td>List sessions (optionally filtered)</td></tr>
          <tr><td><code>chasm list agents</code></td><td>List available terminal agents</td></tr>
          <tr><td><code>chasm list edits</code></td><td>List Copilot Edits sessions</td></tr>
          <tr><td><code>chasm list orphaned</code></td><td>List unregistered sessions on disk</td></tr>
          <tr><td><code>chasm find workspace &lt;pattern&gt;</code></td><td>Search workspaces by name</td></tr>
          <tr><td><code>chasm find session &lt;pattern&gt;</code></td><td>Search sessions by content</td></tr>
        </tbody>
      </table>

      <h2>Show &amp; Detect</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>chasm show session &lt;id&gt;</code></td><td>Display full session content</td></tr>
          <tr><td><code>chasm show path &lt;path&gt;</code></td><td>Show sessions for a project path</td></tr>
          <tr><td><code>chasm detect</code></td><td>Full detection report</td></tr>
          <tr><td><code>chasm detect workspace [path]</code></td><td>Workspace info for path</td></tr>
          <tr><td><code>chasm detect providers</code></td><td>Available LLM providers</td></tr>
          <tr><td><code>chasm detect orphaned [path]</code></td><td>Find orphaned sessions</td></tr>
        </tbody>
      </table>

      <h2>Data Management</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>chasm merge workspace &lt;name&gt;</code></td><td>Merge sessions from a workspace</td></tr>
          <tr><td><code>chasm export session &lt;id&gt;</code></td><td>Export session to file</td></tr>
          <tr><td><code>chasm import &lt;file&gt;</code></td><td>Import sessions from file</td></tr>
          <tr><td><code>chasm sync --pull</code></td><td>Pull sessions from workspaces to database</td></tr>
          <tr><td><code>chasm sync --push</code></td><td>Push sessions from database to workspaces</td></tr>
        </tbody>
      </table>

      <h2>Session Recovery</h2>
      <p>Recover orphaned sessions when VS Code creates a new workspace hash:</p>
      <CodeBlock language="bash" filename="Recovery workflow">
{`# 1. Scan for orphaned sessions
chasm detect orphaned /path/to/project

# 2. Recover them (copy to active workspace)
chasm detect orphaned --recover /path/to/project

# 3. Register in VS Code's database
chasm register all --force --path /path/to/project

# 4. Reload VS Code (Ctrl+Shift+P → Developer: Reload Window)`}
      </CodeBlock>

      <h2>Server &amp; Tools</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>chasm api serve</code></td><td>Start the REST/GraphQL API server</td></tr>
          <tr><td><code>chasm run tui</code></td><td>Interactive terminal browser</td></tr>
          <tr><td><code>chasm run &lt;agent&gt;</code></td><td>Launch an AI agent with auto-save</td></tr>
          <tr><td><code>chasm watch</code></td><td>Watch directories for changes</td></tr>
        </tbody>
      </table>

      <h2>Global Options</h2>
      <CodeBlock language="bash">
{`chasm --help          # Show all commands
chasm <cmd> --help    # Show help for a specific command
chasm --version       # Show version`}
      </CodeBlock>

      <PageNav currentPath="/docs/cli" />
    </div>
  );
}

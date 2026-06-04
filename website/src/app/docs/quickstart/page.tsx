// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CodeBlock, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function QuickStartPage() {
    return (
        <div className="content-wrapper">
            <h1>Quick Start</h1>
            <p className="page-description">
                Get up and running with Chasm in 5 minutes.
            </p>

            <h2>1. Discover Workspaces</h2>
            <p>List all VS Code workspaces on your system:</p>
            <CodeBlock language="bash">
                {`chasm list workspaces`}
            </CodeBlock>

            <h2>2. Show Sessions for a Project</h2>
            <CodeBlock language="bash">
                {`chasm show path /path/to/your/project`}
            </CodeBlock>

            <h2>3. Search Session Content</h2>
            <CodeBlock language="bash">
                {`chasm find session "authentication"
chasm find workspace "my-project"`}
            </CodeBlock>

            <h2>4. Harvest All Sessions</h2>
            <p>Initialize the harvest database and collect sessions from all providers:</p>
            <CodeBlock language="bash">
                {`chasm harvest init
chasm harvest scan      # See available providers
chasm harvest run       # Collect everything`}
            </CodeBlock>

            <h2>5. Full-Text Search</h2>
            <CodeBlock language="bash">
                {`chasm harvest search "how to fix the auth bug"`}
            </CodeBlock>

            <h2>6. Launch an Agent</h2>
            <p>Run a terminal AI agent with automatic session capture:</p>
            <CodeBlock language="bash">
                {`chasm run claude           # Launch Claude Code
chasm run gemini           # Launch Gemini CLI
chasm list agents          # See all available agents`}
            </CodeBlock>

            <h2>7. Watch for Changes</h2>
            <p>Monitor session directories for changes in real-time:</p>
            <CodeBlock language="bash">
                {`chasm watch                # Watch all agent directories
chasm watch -a claude      # Watch only Claude Code sessions`}
            </CodeBlock>

            <Callout type="tip" title="Next Steps">
                Explore the <a href="/docs/cli">CLI Reference</a> for all commands, or
                set up the <a href="/docs/api">API Server</a> for custom integrations.
            </Callout>

            <PageNav currentPath="/docs/quickstart" />
        </div>
    );
}

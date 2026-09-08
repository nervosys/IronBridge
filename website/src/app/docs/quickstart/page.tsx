// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { CodeBlock, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function QuickStartPage() {
    return (
        <div className="content-wrapper">
            <h1>Quick Start</h1>
            <p className="page-description">
                Get up and running with IronBridge in 5 minutes.
            </p>

            <h2>1. Discover Workspaces</h2>
            <p>List all VS Code workspaces on your system:</p>
            <CodeBlock language="bash">
                {`ironbridge list workspaces`}
            </CodeBlock>

            <h2>2. Show Sessions for a Project</h2>
            <CodeBlock language="bash">
                {`ironbridge show path /path/to/your/project`}
            </CodeBlock>

            <h2>3. Search Session Content</h2>
            <CodeBlock language="bash">
                {`ironbridge find session "authentication"
ironbridge find workspace "my-project"`}
            </CodeBlock>

            <h2>4. Harvest All Sessions</h2>
            <p>Initialize the harvest database and collect sessions from all providers:</p>
            <CodeBlock language="bash">
                {`ironbridge harvest init
ironbridge harvest scan      # See available providers
ironbridge harvest run       # Collect everything`}
            </CodeBlock>

            <h2>5. Full-Text Search</h2>
            <CodeBlock language="bash">
                {`ironbridge harvest search "how to fix the auth bug"`}
            </CodeBlock>

            <h2>6. Launch an Agent</h2>
            <p>Run a terminal AI agent with automatic session capture:</p>
            <CodeBlock language="bash">
                {`ironbridge run claude           # Launch Claude Code
ironbridge run gemini           # Launch Gemini CLI
ironbridge list agents          # See all available agents`}
            </CodeBlock>

            <h2>7. Watch for Changes</h2>
            <p>Monitor session directories for changes in real-time:</p>
            <CodeBlock language="bash">
                {`ironbridge watch                # Watch all agent directories
ironbridge watch -a claude      # Watch only Claude Code sessions`}
            </CodeBlock>

            <Callout type="tip" title="Next Steps">
                Explore the <a href="/docs/cli">CLI Reference</a> for all commands, or
                set up the <a href="/docs/api">API Server</a> for custom integrations.
            </Callout>

            <PageNav currentPath="/docs/quickstart" />
        </div>
    );
}

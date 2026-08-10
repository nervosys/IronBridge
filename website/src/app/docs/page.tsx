// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { CodeBlock, Callout, Card } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function DocsIntroPage() {
    return (
        <div className="content-wrapper">
            <h1>Introduction</h1>
            <p className="page-description">
                Chasm is a universal chat session manager that harvests, merges, and
                analyzes AI chat history across workspaces and providers.
            </p>

            <Callout type="tip" title="Why Chasm?">
                AI coding assistants produce valuable conversations that are scattered
                across editors, local files, and cloud services. Chasm unifies them into
                a single, searchable database you fully control.
            </Callout>

            <h2>Key Features</h2>

            <div className="card-grid">
                <Card
                    icon="🔍"
                    title="30+ Providers"
                    description="GitHub Copilot, Cursor, Claude Code, Ollama, ChatGPT, and many more."
                />
                <Card
                    icon="🗃️"
                    title="SQLite Database"
                    description="Structured, relational storage with full-text search via FTS5."
                />
                <Card
                    icon="🤖"
                    title="Agent Launcher"
                    description="Launch terminal agents with automatic session capture on exit."
                />
                <Card
                    icon="👁️"
                    title="Watch Mode"
                    description="Real-time filesystem monitoring with debounced auto-harvest."
                />
                <Card
                    icon="🌐"
                    title="Full API"
                    description="REST, GraphQL, and WebSocket endpoints for custom integrations."
                />
                <Card
                    icon="🔐"
                    title="Self-Hosted"
                    description="100% local. Your data never leaves your machine."
                />
            </div>

            <h2>Project Structure</h2>

            <CodeBlock language="bash" filename="Monorepo Layout">
                {`chasm/
├── chasm-rust/          # Core CLI and API server (Rust)
├── chasm-web/           # Web dashboard (React + Vite)
├── chasm-app/           # Mobile app (React Native)
├── chasm-desktop/       # Desktop app (Tauri)
├── chasm-shared/        # Shared TypeScript types
├── vscode-extension/    # VS Code extension
├── browser-extension/   # Chrome/Firefox extension
├── jetbrains-plugin/    # JetBrains IDEs plugin
├── vim-plugin/          # Vim plugin
├── neovim-plugin/       # Neovim plugin
├── docs-site/           # This documentation (Next.js)
└── examples/            # Provider examples`}
            </CodeBlock>

            <h2>How It Works</h2>

            <ol>
                <li>
                    <strong>Discover</strong> — Chasm scans your system for VS Code
                    workspaces, local LLM providers, and editor extensions.
                </li>
                <li>
                    <strong>Harvest</strong> — Sessions are extracted from each provider
                    and normalized into a unified SQLite database.
                </li>
                <li>
                    <strong>Search &amp; Analyze</strong> — Full-text search across all
                    messages, timeline views, statistics, and export.
                </li>
                <li>
                    <strong>Integrate</strong> — Use the REST/GraphQL API, MCP server,
                    or any of the native clients to build on top of your data.
                </li>
            </ol>

            <PageNav currentPath="/docs" />
        </div>
    );
}

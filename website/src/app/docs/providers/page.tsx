// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { Card } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function ProvidersPage() {
    return (
        <div className="content-wrapper">
            <h1>Supported Providers</h1>
            <p className="page-description">
                Chasm harvests sessions from 30+ AI providers across editors, local LLMs,
                and cloud services.
            </p>

            <h2>Editor Extensions</h2>
            <div className="card-grid">
                <Card icon="🐙" title="GitHub Copilot" description="VS Code, JetBrains, Neovim sessions" />
                <Card icon="🔮" title="Cursor" description="AI-first editor sessions and chats" />
                <Card icon="🌊" title="Windsurf" description="Codeium's AI editor sessions" />
                <Card icon="🔄" title="Continue.dev" description="Open-source AI coding assistant" />
                <Card icon="🧠" title="Claude Code" description="Anthropic's terminal coding agent" />
                <Card icon="📝" title="OpenCode" description="Open-source AI code editor" />
                <Card icon="🐾" title="OpenClaw" description="ClawdBot terminal agent" />
                <Card icon="🚀" title="Antigravity" description="AI pair programming extension" />
            </div>

            <h2>Terminal Agents</h2>
            <div className="card-grid">
                <Card icon="🧠" title="Claude Code" description="claude — ~/.claude/projects/" />
                <Card icon="📝" title="OpenCode" description="opencode — ~/.opencode/conversations/" />
                <Card icon="🐾" title="OpenClaw" description="openclaw — ~/.openclaw/chat-history/" />
                <Card icon="🔮" title="Cursor CLI" description="cursor — ~/.cursor/chats/" />
                <Card icon="📦" title="Codex CLI" description="codex — ~/.codex/sessions/" />
                <Card icon="🤖" title="Droid CLI" description="droid — ~/.factory/sessions/" />
                <Card icon="💎" title="Gemini CLI" description="gemini — ~/.gemini/tmp/" />
            </div>

            <h2>Local LLM Servers</h2>
            <div className="card-grid">
                <Card icon="🦙" title="Ollama" description="Local model runner" />
                <Card icon="⚡" title="vLLM" description="High-throughput serving" />
                <Card icon="🔬" title="LM Studio" description="Desktop model manager" />
                <Card icon="🏠" title="LocalAI" description="Self-hosted AI API" />
                <Card icon="💬" title="Jan" description="Offline AI assistant" />
                <Card icon="🤝" title="GPT4All" description="Local large language models" />
                <Card icon="🗂️" title="Llamafile" description="Single-file LLM runner" />
            </div>

            <h2>Cloud Services (via Share Links)</h2>
            <div className="card-grid">
                <Card icon="🟢" title="ChatGPT" description="OpenAI shared conversations" />
                <Card icon="🟤" title="Claude" description="Anthropic shared conversations" />
                <Card icon="🔵" title="Gemini" description="Google shared conversations" />
                <Card icon="🟣" title="Perplexity" description="AI search conversations" />
                <Card icon="🔷" title="DeepSeek" description="Open-source AI conversations" />
            </div>

            <PageNav currentPath="/docs/providers" />
        </div>
    );
}

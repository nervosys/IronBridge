// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CodeBlock, Card } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function ArchitecturePage() {
  return (
    <div className="content-wrapper">
      <h1>Architecture</h1>
      <p className="page-description">
        Chasm uses a hub-and-spoke architecture where the Rust core serves as the
        single source of truth for all data.
      </p>

      <h2>System Overview</h2>
      <CodeBlock language="text" filename="Architecture Diagram">
{`                    ┌─────────────────┐
                    │   chasm-rust    │
                    │  (Backend API)  │
                    │                 │
                    │  SQLite DB      │
                    │  SSE Publisher  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ chasm-web │   │ chasm-app│   │ desktop  │
       │ (React)  │   │(iOS/And) │   │ (Tauri)  │
       └──────────┘   └──────────┘   └──────────┘`}
      </CodeBlock>

      <h2>Components</h2>
      <div className="card-grid">
        <Card icon="⚙️" title="chasm-rust" description="Core CLI, API server, SQLite database, harvest engine" />
        <Card icon="🌐" title="chasm-web" description="React + Vite web dashboard with real-time sync" />
        <Card icon="📱" title="chasm-app" description="React Native mobile app for iOS and Android" />
        <Card icon="🖥️" title="chasm-desktop" description="Tauri native desktop app" />
        <Card icon="📦" title="chasm-shared" description="Shared TypeScript types and sync utilities" />
        <Card icon="🧩" title="vscode-extension" description="VS Code extension with session recording" />
        <Card icon="🔗" title="browser-extension" description="Chrome/Firefox extension for web AI chat" />
        <Card icon="🔧" title="jetbrains-plugin" description="IntelliJ/PyCharm/WebStorm plugin" />
      </div>

      <h2>Data Flow</h2>
      <h3>Read Path</h3>
      <ol>
        <li>Client connects to SSE or WebSocket endpoint</li>
        <li>Server sends current version number</li>
        <li>If client version &lt; server version, server sends delta</li>
        <li>Client applies delta to local state</li>
        <li>Subsequent changes arrive as real-time events</li>
      </ol>

      <h3>Write Path</h3>
      <ol>
        <li>Client sends mutation via REST API</li>
        <li>Server validates and persists to SQLite</li>
        <li>Server increments version and broadcasts SSE event</li>
        <li>All connected clients receive the update</li>
      </ol>

      <h2>Technology Stack</h2>
      <table>
        <thead>
          <tr><th>Layer</th><th>Technology</th></tr>
        </thead>
        <tbody>
          <tr><td>Core CLI</td><td>Rust, Clap 4.4, Tokio</td></tr>
          <tr><td>Database</td><td>SQLite (rusqlite, bundled FTS5)</td></tr>
          <tr><td>HTTP Server</td><td>Actix-web 4 (rustls)</td></tr>
          <tr><td>GraphQL</td><td>async-graphql 7</td></tr>
          <tr><td>TUI</td><td>Ratatui 0.29 + Crossterm</td></tr>
          <tr><td>File Watching</td><td>notify 7.0 (cross-platform)</td></tr>
          <tr><td>Web Frontend</td><td>React 19 + Vite</td></tr>
          <tr><td>Mobile</td><td>React Native + Expo</td></tr>
          <tr><td>Desktop</td><td>Tauri 2 (Rust + WebView)</td></tr>
        </tbody>
      </table>

      <PageNav currentPath="/docs/architecture" />
    </div>
  );
}

import { Card, Callout, Badge } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function FeaturesPage() {
  return (
    <div className="content-wrapper">
      <h1>Features</h1>
      <p className="page-description">
        A complete overview of Chasm&apos;s capabilities — from session harvesting
        to enterprise-grade collaboration.
      </p>

      <h2>Core Engine</h2>
      <div className="card-grid">
        <Card
          icon="🔍"
          title="Workspace Discovery"
          description="Automatically find all VS Code, Cursor, Windsurf, and Claude Code workspaces with chat sessions."
        />
        <Card
          icon="🔄"
          title="Session Recovery"
          description="Detect and recover orphaned sessions from old workspace hashes and migrated projects."
        />
        <Card
          icon="🔀"
          title="History Merging"
          description="Combine sessions across workspaces chronologically with deduplication and conflict resolution."
        />
        <Card
          icon="📥"
          title="Harvest System"
          description="Unified SQLite database collecting sessions from 30+ AI providers with FTS5 full-text search."
        />
        <Card
          icon="🔗"
          title="Share Link Import"
          description="Import shared conversations from ChatGPT, Claude, and Gemini via URL."
        />
        <Card
          icon="🔎"
          title="Full-Text Search"
          description="Optimized FTS5 search across all messages with snippet extraction, ranking, and 4KB header optimization."
        />
      </div>

      <h2>CLI &amp; Automation</h2>
      <div className="card-grid">
        <Card
          icon="⌨️"
          title="20+ Commands"
          description="List, show, find, search, harvest, detect, register, export, import, watch, run, and more."
        />
        <Card
          icon="🤖"
          title="Agent Launcher"
          description="Launch 7 terminal AI agents (Aider, Claude Code, Codex, Goose, etc.) with automatic session capture."
        />
        <Card
          icon="👁️"
          title="Watch Mode"
          description="Monitor session directories with cross-platform filesystem events, debounced auto-harvest, and filters."
        />
        <Card
          icon="🎛️"
          title="Interactive TUI"
          description="Ratatui-powered terminal UI for browsing workspaces, sessions, and messages with keyboard navigation."
        />
        <Card
          icon="📦"
          title="Git Integration"
          description="Version control your chat histories with built-in export and import workflows."
        />
        <Card
          icon="🔌"
          title="Plugin System"
          description="Extensible architecture with event hooks for custom harvest, transform, and export pipelines."
        />
      </div>

      <h2>APIs &amp; Protocols</h2>
      <div className="card-grid">
        <Card
          icon="🌐"
          title="REST API"
          description="Full CRUD endpoints for workspaces, sessions, messages, providers, and search."
        />
        <Card
          icon="📊"
          title="GraphQL"
          description="Flexible query API with nested resolver support, filtering, and pagination."
        />
        <Card
          icon="📡"
          title="WebSocket & SSE"
          description="Real-time streaming for live session updates and cross-device synchronization."
        />
        <Card
          icon="🔌"
          title="MCP Server"
          description="Model Context Protocol integration exposing harvest, search, and session tools to AI agents."
        />
      </div>

      <h2>AI Intelligence <Badge variant="beta">Beta</Badge></h2>
      <div className="card-grid">
        <Card
          icon="🧠"
          title="Topic Extraction"
          description="Automatic categorization and tagging of session content by subject matter."
        />
        <Card
          icon="📝"
          title="Summarization"
          description="AI-powered conversation summaries for quick review and knowledge retrieval."
        />
        <Card
          icon="⭐"
          title="Quality Scoring"
          description="Score sessions by depth, code ratio, tool usage, and conversation quality metrics."
        />
        <Card
          icon="🔄"
          title="Recommendations"
          description="Personalized session suggestions based on usage patterns and content similarity."
        />
        <Card
          icon="🔗"
          title="Similarity Detection"
          description="Find related sessions using Jaccard similarity and vector embeddings."
        />
        <Card
          icon="🧭"
          title="Multi-Model Routing"
          description="Route prompts to the optimal model based on task type, cost, and latency requirements."
        />
      </div>

      <h2>Multi-Platform Deployment</h2>
      <div className="card-grid">
        <Card
          icon="⌨️"
          title="CLI"
          description="High-performance Rust binary — single static executable, no runtime dependencies."
        />
        <Card
          icon="🖥️"
          title="Desktop"
          description="Tauri native application for Windows, macOS, and Linux with system tray integration."
        />
        <Card
          icon="📱"
          title="Mobile"
          description="React Native app for iOS and Android with offline caching and biometric auth."
        />
        <Card
          icon="🌐"
          title="Web Dashboard"
          description="React + Vite web app with session replay, diff view, and real-time sync."
        />
        <Card
          icon="🧩"
          title="VS Code Extension"
          description="Session recording, workspace browser, and inline chat history within the editor."
        />
        <Card
          icon="🔗"
          title="Browser Extension"
          description="Chrome and Firefox extension for capturing web-based AI chat sessions."
        />
        <Card
          icon="🔧"
          title="JetBrains Plugin"
          description="IntelliJ, PyCharm, WebStorm, and other JetBrains IDE integration."
        />
        <Card
          icon="📟"
          title="Vim & Neovim"
          description="Native plugins for Vim and Neovim with command-mode integration."
        />
      </div>

      <h2>Enterprise &amp; Security</h2>
      <div className="card-grid">
        <Card
          icon="🔐"
          title="Encryption at Rest"
          description="AES-256-GCM encryption for all stored session data."
        />
        <Card
          icon="🔑"
          title="SSO / SAML"
          description="Single sign-on with Okta, Azure AD, Google Workspace, Auth0, and OneLogin."
        />
        <Card
          icon="👥"
          title="Team Workspaces"
          description="Shared workspaces with RBAC — Owner, Admin, Member, and Viewer roles."
        />
        <Card
          icon="📋"
          title="Audit Logging"
          description="Comprehensive event tracking with data classification and retention policies."
        />
        <Card
          icon="🛡️"
          title="Compliance"
          description="SOC 2 Type II, HIPAA, GDPR, CCPA, ISO 27001, and FedRAMP frameworks."
        />
        <Card
          icon="🏷️"
          title="White-Labeling"
          description="Custom branding, themes, domains, and email templates for your organization."
        />
      </div>

      <Callout type="tip" title="Self-Hosted">
        Every feature runs entirely on your infrastructure. Chasm never sends
        data to external servers — your conversations remain fully private.
      </Callout>

      <PageNav currentPath="/docs/features" />
    </div>
  );
}

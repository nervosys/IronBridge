import Link from 'next/link';
import { Header } from '@/components/Nav';
import { Card } from '@/components/Ui';

export default function HomePage() {
  return (
    <>
      <Header />
      <main style={{ marginTop: 'var(--header-height)' }}>
        <section className="hero">
          <h1>CHASM</h1>
          <p className="hero-subtitle">
            [ CHAT SESSION MANAGER ] Bridging the divide between AI providers.
          </p>
          <div className="hero-actions">
            <Link href="/docs" className="btn btn-primary">
              Get Started →
            </Link>
            <Link href="/docs/cli" className="btn btn-secondary">
              CLI Reference
            </Link>
            <a
              href="https://github.com/nervosys/chasm"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              GitHub ↗
            </a>
          </div>
        </section>

        <section className="features-section">
          <h2>Systems Online</h2>
          <div className="card-grid">
            <Card
              icon="🔍"
              title="Harvest"
              description="Extract chat sessions from VS Code, Cursor, Windsurf, Claude Code, and 30+ providers."
              href="/docs/harvest"
            />
            <Card
              icon="🤖"
              title="Agent Launcher"
              description="Launch 7 terminal AI agents with automatic session capture and harvesting."
              href="/docs/agents"
            />
            <Card
              icon="👁️"
              title="Watch Mode"
              description="Monitor session directories in real-time with debounced auto-harvest."
              href="/docs/watch"
            />
            <Card
              icon="🌐"
              title="API Server"
              description="REST + GraphQL + WebSocket API for building custom integrations."
              href="/docs/api"
            />
            <Card
              icon="🔌"
              title="MCP Server"
              description="Model Context Protocol integration for AI agent workflows."
              href="/docs/mcp"
            />
            <Card
              icon="🏢"
              title="Enterprise"
              description="SSO, audit logging, compliance (SOC2, HIPAA, GDPR), multi-tenancy."
              href="/docs/enterprise"
            />
          </div>
        </section>

        <section className="features-section" style={{ paddingTop: 0 }}>
          <h2>Deployment Matrix</h2>
          <div className="card-grid">
            <Card icon="⌨️" title="CLI" description="Powerful Rust binary with 20+ commands" />
            <Card icon="🖥️" title="Desktop" description="Tauri native app for Windows, macOS, Linux" />
            <Card icon="📱" title="Mobile" description="React Native app for iOS and Android" />
            <Card icon="🌐" title="Web" description="React dashboard with real-time sync" />
            <Card icon="🧩" title="VS Code" description="Extension with session recording" />
            <Card icon="🔗" title="Browser" description="Chrome/Firefox extension for web AI chat" />
          </div>
        </section>

        <footer className="footer">
          © {new Date().getFullYear()} Nervosys LLC — Apache 2.0 License
        </footer>
      </main>
    </>
  );
}

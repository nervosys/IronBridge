// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { CodeBlock, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function ApiPage() {
  return (
    <div className="content-wrapper">
      <h1>API Server</h1>
      <p className="page-description">
        Chasm includes a full REST + GraphQL + WebSocket API server built with
        Actix-web for high-performance integrations.
      </p>

      <h2>Start the Server</h2>
      <CodeBlock language="bash">
{`chasm api serve --port 8787
chasm api serve --host 0.0.0.0 --port 8787  # Listen on all interfaces`}
      </CodeBlock>

      <h2>REST Endpoints</h2>
      <table>
        <thead>
          <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/health</code></td><td>Health check</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/workspaces</code></td><td>List workspaces</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/workspaces/:id</code></td><td>Get workspace details</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/sessions</code></td><td>List sessions</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/sessions/:id</code></td><td>Get session with messages</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/sessions/search?q=</code></td><td>Search sessions</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/stats</code></td><td>Database statistics</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/providers</code></td><td>List supported providers</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/agents</code></td><td>List available agents</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/recording/events</code></td><td>Send recording events</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/recording/snapshot</code></td><td>Store session snapshot</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/recording/sessions</code></td><td>List active recordings</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/recording/recovery</code></td><td>Recover crash sessions</td></tr>
        </tbody>
      </table>

      <h2>Example</h2>
      <CodeBlock language="bash" filename="Terminal">
        {`curl http://localhost:8787/api/stats`}
      </CodeBlock>
      <CodeBlock language="json" filename="Response">
{`{
  "success": true,
  "data": {
    "totalSessions": 330,
    "totalMessages": 19068,
    "totalWorkspaces": 138,
    "totalToolInvocations": 122712
  }
}`}
      </CodeBlock>

      <h2>GraphQL</h2>
      <CodeBlock language="bash">
{`# Query
curl -X POST http://localhost:8787/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query": "{ sessions { id title provider } }"}'

# Playground
open http://localhost:8787/graphql/playground`}
      </CodeBlock>

      <h2>WebSocket</h2>
      <p>
        Real-time updates are available via WebSocket at{' '}
        <code>ws://localhost:8787/ws</code>. Events include session creation,
        updates, harvest completion, and agent activity.
      </p>

      <Callout type="info" title="TLS Support">
        The server uses <code>rustls</code> for TLS support without requiring
        OpenSSL to be installed on the system.
      </Callout>

      <PageNav currentPath="/docs/api" />
    </div>
  );
}

// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { CodeBlock, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function InstallationPage() {
  return (
    <div className="content-wrapper">
      <h1>Installation</h1>
      <p className="page-description">
        Install IronBridge on Windows, macOS, or Linux in under a minute.
      </p>

      <h2>From crates.io</h2>
      <CodeBlock language="bash">
        {`cargo install ironbridge`}
      </CodeBlock>

      <h2>From Source</h2>
      <CodeBlock language="bash" filename="Terminal">
{`git clone https://github.com/nervosys/ironbridge.git
cd ironbridge/ironbridge-rust
cargo install --path .`}
      </CodeBlock>

      <h2>Pre-Built Binaries</h2>
      <p>
        Download from{' '}
        <a href="https://github.com/nervosys/ironbridge/releases" target="_blank" rel="noopener noreferrer">
          GitHub Releases
        </a>:
      </p>

      <table>
        <thead>
          <tr>
            <th>Platform</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Windows x64</td><td><code>ironbridge-windows-x64.zip</code></td></tr>
          <tr><td>macOS x64</td><td><code>ironbridge-darwin-x64.tar.gz</code></td></tr>
          <tr><td>macOS ARM</td><td><code>ironbridge-darwin-arm64.tar.gz</code></td></tr>
          <tr><td>Linux x64</td><td><code>ironbridge-linux-x64.tar.gz</code></td></tr>
        </tbody>
      </table>

      <h2>Docker</h2>
      <CodeBlock language="bash">
{`docker pull ghcr.io/nervosys/ironbridge:latest
docker run -v ~/.ironbridge:/data ghcr.io/nervosys/ironbridge list workspaces`}
      </CodeBlock>

      <h2>Verify Installation</h2>
      <CodeBlock language="bash">
{`ironbridge --version
ironbridge --help`}
      </CodeBlock>

      <Callout type="info" title="System Requirements">
        Rust 1.75+ (for building from source). No runtime dependencies — the
        binary is fully self-contained with a bundled SQLite engine.
      </Callout>

      <PageNav currentPath="/docs/installation" />
    </div>
  );
}

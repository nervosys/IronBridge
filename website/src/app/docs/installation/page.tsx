// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { CodeBlock, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function InstallationPage() {
  return (
    <div className="content-wrapper">
      <h1>Installation</h1>
      <p className="page-description">
        Install Chasm on Windows, macOS, or Linux in under a minute.
      </p>

      <h2>From crates.io</h2>
      <CodeBlock language="bash">
        {`cargo install chasm`}
      </CodeBlock>

      <h2>From Source</h2>
      <CodeBlock language="bash" filename="Terminal">
{`git clone https://github.com/nervosys/chasm.git
cd chasm/chasm-rust
cargo install --path .`}
      </CodeBlock>

      <h2>Pre-Built Binaries</h2>
      <p>
        Download from{' '}
        <a href="https://github.com/nervosys/chasm/releases" target="_blank" rel="noopener noreferrer">
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
          <tr><td>Windows x64</td><td><code>chasm-windows-x64.zip</code></td></tr>
          <tr><td>macOS x64</td><td><code>chasm-darwin-x64.tar.gz</code></td></tr>
          <tr><td>macOS ARM</td><td><code>chasm-darwin-arm64.tar.gz</code></td></tr>
          <tr><td>Linux x64</td><td><code>chasm-linux-x64.tar.gz</code></td></tr>
        </tbody>
      </table>

      <h2>Docker</h2>
      <CodeBlock language="bash">
{`docker pull ghcr.io/nervosys/chasm:latest
docker run -v ~/.chasm:/data ghcr.io/nervosys/chasm list workspaces`}
      </CodeBlock>

      <h2>Verify Installation</h2>
      <CodeBlock language="bash">
{`chasm --version
chasm --help`}
      </CodeBlock>

      <Callout type="info" title="System Requirements">
        Rust 1.75+ (for building from source). No runtime dependencies — the
        binary is fully self-contained with a bundled SQLite engine.
      </Callout>

      <PageNav currentPath="/docs/installation" />
    </div>
  );
}

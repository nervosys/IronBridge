// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { CodeBlock, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function ContributingPage() {
  return (
    <div className="content-wrapper">
      <h1>Contributing</h1>
      <p className="page-description">
        Contributions are welcome! Here&apos;s how to get started.
      </p>

      <h2>Getting Started</h2>
      <CodeBlock language="bash">
{`# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/chasm.git
cd chasm

# 3. Add upstream remote
git remote add upstream https://github.com/nervosys/chasm.git

# 4. Build the CLI
cd chasm-rust
cargo build`}
      </CodeBlock>

      <h2>Development Setup</h2>
      <table>
        <thead>
          <tr><th>Component</th><th>Requirements</th></tr>
        </thead>
        <tbody>
          <tr><td><code>chasm-rust</code></td><td>Rust 1.75+, cargo</td></tr>
          <tr><td><code>chasm-web</code></td><td>Node.js 18+, npm</td></tr>
          <tr><td><code>chasm-app</code></td><td>Node.js 18+, React Native CLI</td></tr>
          <tr><td><code>chasm-desktop</code></td><td>Rust 1.75+, Tauri CLI</td></tr>
          <tr><td><code>docs-site</code></td><td>Node.js 18+, npm</td></tr>
        </tbody>
      </table>

      <h2>Coding Standards</h2>
      <ul>
        <li>Follow existing code style and conventions</li>
        <li>Write descriptive commit messages</li>
        <li>Add tests for new functionality</li>
        <li>Update documentation for user-facing changes</li>
        <li>Keep PRs focused on a single feature or fix</li>
      </ul>

      <h2>Commit Messages</h2>
      <p>Use conventional commit format:</p>
      <CodeBlock language="text">
{`feat: add watch mode for file-system monitoring
fix: correct FTS5 snippet extraction for long messages
docs: update CLI reference with new commands
refactor: extract agent config to shared module
test: add integration tests for harvest system`}
      </CodeBlock>

      <h2>Pull Request Process</h2>
      <ol>
        <li>Create a feature branch from <code>master</code></li>
        <li>Make your changes with clear, atomic commits</li>
        <li>Run <code>cargo test</code> and <code>cargo clippy</code></li>
        <li>Open a PR with a description of the changes</li>
        <li>Address any review feedback</li>
      </ol>

      <Callout type="tip" title="First Contribution?">
        Look for issues labeled <code>good first issue</code> on GitHub.
        These are specifically chosen to be approachable for new contributors.
      </Callout>

      <PageNav currentPath="/docs/contributing" />
    </div>
  );
}

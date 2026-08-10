// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { CodeBlock, Card, Callout } from '@/components/Ui';
import { PageNav } from '@/components/PageNav';

export default function AgencyPage() {
  return (
    <div className="content-wrapper">
      <h1>Agency (Agent Development Kit)</h1>
      <p className="page-description">
        Agency is Chasm&apos;s Rust-native framework for building, orchestrating,
        and deploying AI agents with multi-agent workflows.
      </p>

      <h2>Capabilities</h2>
      <div className="card-grid">
        <Card icon="🏗️" title="Code-First Agents" description="Define agents in Rust with type safety and performance" />
        <Card icon="🔧" title="Tool Ecosystem" description="Built-in tools + custom function registration" />
        <Card icon="🎭" title="Multi-Agent" description="Sequential, parallel, hierarchical, and swarm patterns" />
        <Card icon="🧠" title="Memory & RAG" description="Vector store, knowledge base, context management" />
        <Card icon="📡" title="Streaming" description="Real-time response streaming via SSE" />
        <Card icon="🌐" title="Distributed" description="Remote task monitoring across machines" />
      </div>

      <h2>CLI Commands</h2>
      <CodeBlock language="bash">
{`# List available agents
chasm agency list
chasm agency list --verbose

# Run an agent with a prompt
chasm agency run --agent researcher "What are the latest AI trends?"
chasm agency run --agent coder --model gpt-4o "Write a REST API in Rust"

# Multi-agent orchestration
chasm agency run --orchestration sequential "Build and test a web scraper"
chasm agency run --orchestration parallel "Research AI, blockchain, quantum"
chasm agency run --orchestration swarm "Design a microservices architecture"

# Create a custom agent
chasm agency create my-agent --role coder --instruction "You are a Rust expert"`}
      </CodeBlock>

      <h2>Agent Roles</h2>
      <table>
        <thead>
          <tr><th>Role</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>coordinator</code></td><td>Manages and delegates tasks to other agents</td></tr>
          <tr><td><code>researcher</code></td><td>Gathers information and analyzes data</td></tr>
          <tr><td><code>coder</code></td><td>Writes and modifies code</td></tr>
          <tr><td><code>reviewer</code></td><td>Reviews code and provides feedback</td></tr>
          <tr><td><code>executor</code></td><td>Executes commands and tools</td></tr>
          <tr><td><code>writer</code></td><td>Creates documentation and content</td></tr>
          <tr><td><code>tester</code></td><td>Writes and runs tests</td></tr>
          <tr><td><code>analyst</code></td><td>Data analysis and insights</td></tr>
          <tr><td><code>custom</code></td><td>User-defined behavior</td></tr>
        </tbody>
      </table>

      <h2>Orchestration Modes</h2>
      <table>
        <thead>
          <tr><th>Mode</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>single</code></td><td>Traditional single-agent response</td></tr>
          <tr><td><code>sequential</code></td><td>Agents execute one after another, passing results</td></tr>
          <tr><td><code>parallel</code></td><td>Multiple agents work simultaneously on subtasks</td></tr>
          <tr><td><code>loop</code></td><td>Agent repeats until a condition is met</td></tr>
          <tr><td><code>hierarchical</code></td><td>Lead agent delegates to specialized sub-agents</td></tr>
          <tr><td><code>swarm</code></td><td>Multiple agents collaborate with a coordinator</td></tr>
        </tbody>
      </table>

      <h2>Example: Research Agent</h2>
      <CodeBlock language="rust" filename="research_agent.rs">
{`use chasm::agency::{AgentBuilder, Runtime, Tool};

let researcher = AgentBuilder::new("researcher")
    .model("gemini-2.0-flash")
    .instruction("Search for information, analyze sources,
                  and provide summaries with citations.")
    .tool(Tool::web_search())
    .tool(Tool::file_write())
    .temperature(0.5)
    .build();

let runtime = Runtime::new();
let result = runtime
    .run(&researcher, "Latest breakthroughs in fusion energy?")
    .await?;`}
      </CodeBlock>

      <Callout type="info" title="Extensible">
        The Agency framework supports custom tools, memory backends, and
        execution strategies. Agents can be composed into complex workflows
        with type-safe Rust APIs.
      </Callout>

      <PageNav currentPath="/docs/agency" />
    </div>
  );
}

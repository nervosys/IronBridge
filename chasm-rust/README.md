<p align="center">
  <h1 align="center">🗄️ Chasm</h1>
  <p align="center">
    <strong>Chat Session Manager (Chasm)</strong><br>
    Bridging the divide between AI providers
  </p>
</p>

<p align="center">
  <a href="https://crates.io/crates/chasm"><img src="https://img.shields.io/crates/v/chasm.svg" alt="Crates.io"></a>
  <a href="https://docs.rs/chasm"><img src="https://docs.rs/chasm/badge.svg" alt="Documentation"></a>
  <a href="https://github.com/nervosys/chasm/actions"><img src="https://github.com/nervosys/chasm/workflows/CI/badge.svg" alt="CI Status"></a>
  <a href="https://codecov.io/gh/nervosys/chasm"><img src="https://codecov.io/gh/nervosys/chasm/branch/main/graph/badge.svg" alt="Coverage"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL_3.0-blue.svg" alt="License"></a>
</p>

<p align="center">
  <video src="https://github.com/nervosys/chasm/raw/master/videos/out/getting-started.mp4" width="800" autoplay loop muted playsinline>
    Your browser does not support the video tag. <a href="../videos/out/getting-started.mp4">Watch the demo</a>.
  </video>
</p>

---

**Chasm** extracts and unifies chat sessions from AI coding assistants like GitHub Copilot, Cursor, and more. Never lose your AI conversations again.

## ✨ Features

- 🔍 **Harvest** - Extract chat sessions from VS Code, Cursor, Windsurf, and other editors
- 🔀 **Merge** - Combine sessions across workspaces and time periods
- 📊 **Analyze** - Get statistics on your AI assistant usage
- 🔌 **API Server** - REST API for building custom integrations
- 🤖 **MCP Tools** - Model Context Protocol support for AI agent integration
- 🗃️ **Universal Database** - SQLite-based storage that normalizes all providers

## 📦 Installation

### From crates.io

```bash
cargo install chasm
```

### From source

```bash
git clone https://github.com/nervosys/chasm.git
cd chasm
cargo install --path .
```

### Pre-built binaries

Download from [GitHub Releases](https://github.com/nervosys/chasm/releases):

| Platform    | Download                                                                       |
| ----------- | ------------------------------------------------------------------------------ |
| Windows x64 | [chasm-windows-x64.zip](https://github.com/nervosys/chasm/releases/latest)     |
| macOS x64   | [chasm-darwin-x64.tar.gz](https://github.com/nervosys/chasm/releases/latest)   |
| macOS ARM   | [chasm-darwin-arm64.tar.gz](https://github.com/nervosys/chasm/releases/latest) |
| Linux x64   | [chasm-linux-x64.tar.gz](https://github.com/nervosys/chasm/releases/latest)    |

### Docker

```bash
docker pull ghcr.io/nervosys/chasm:latest
docker run -v ~/.chasm:/data ghcr.io/nervosys/chasm list workspaces
```

## 🚀 Quick Start

### List discovered workspaces

```bash
chasm list workspaces
```

```
┌────────────────────────┬──────────────────┬──────────┬────────────┐
│ Name                   │ Provider         │ Sessions │ Updated    │
├────────────────────────┼──────────────────┼──────────┼────────────┤
│ my-project             │ GitHub Copilot   │ 15       │ 2026-01-08 │
│ another-project        │ Cursor           │ 8        │ 2026-01-07 │
│ open-source-contrib    │ GitHub Copilot   │ 23       │ 2026-01-06 │
└────────────────────────┴──────────────────┴──────────┴────────────┘
```

### Show sessions for a project

```bash
chasm show path /path/to/your/project
```

### Harvest sessions from VS Code

```bash
chasm harvest
```

### Export a session to Markdown

```bash
chasm export session abc123 --format markdown --output chat.md
```

### Start the API server

```bash
chasm api serve --port 8787
```

## 📖 CLI Reference

### Core Commands

| Command                          | Description                                      |
| -------------------------------- | ------------------------------------------------ |
| `chasm list workspaces`          | List all discovered workspaces                   |
| `chasm list sessions`            | List sessions (optionally filtered by workspace) |
| `chasm list orphaned`            | List unregistered sessions on disk               |
| `chasm show session <id>`        | Display full session content                     |
| `chasm show path <path>`         | Show sessions for a project path                 |
| `chasm find workspace <pattern>` | Search workspaces by name                        |
| `chasm find session <pattern>`   | Search sessions by content                       |

### Data Management

| Command                        | Description                               |
| ------------------------------ | ----------------------------------------- |
| `chasm harvest scan`           | Scan for available providers and sessions |
| `chasm harvest run`            | Collect sessions from all providers       |
| `chasm harvest status`         | Show harvest database status              |
| `chasm sync --pull`            | Pull sessions from workspaces to database |
| `chasm sync --push`            | Push sessions from database to workspaces |
| `chasm merge workspace <name>` | Merge sessions from a workspace           |
| `chasm export session <id>`    | Export session to file                    |
| `chasm export batch <dest> <paths...>` | Batch export from multiple projects |
| `chasm import <file>`          | Import sessions from file                 |

### Session Recovery

| Command                            | Description                                    |
| ---------------------------------- | ---------------------------------------------- |
| `chasm detect orphaned <path>`     | Find orphaned sessions in old workspace hashes |
| `chasm detect orphaned -r <path>`  | Recover orphaned sessions to active workspace  |
| `chasm register all --path <path>` | Register on-disk sessions in VS Code's index   |
| `chasm recover extract <path>`     | Extract sessions from VS Code recording state  |
| `chasm recover upgrade <path>`     | Upgrade session format from JSON to JSONL      |

#### Recovering Lost Chat History

When VS Code creates a new workspace hash (e.g., after reinstall or path change), your chat sessions may become "orphaned" in the old workspace folder. Use these commands to recover them:

```bash
# 1. Scan for orphaned sessions
chasm detect orphaned /path/to/project

# 2. Recover them (copy to active workspace)
chasm detect orphaned --recover /path/to/project

# 3. Register in VS Code's database
chasm register all --force --path /path/to/project

# 4. Reload VS Code (Ctrl+Shift+P -> Developer: Reload Window)
```

### Server

| Command           | Description               |
| ----------------- | ------------------------- |
| `chasm api serve` | Start the REST API server |
| `chasm mcp serve` | Start the MCP tool server |

### Options

```bash
chasm --help          # Show all commands
chasm <cmd> --help    # Show help for a specific command
chasm --version       # Show version
```

## 🔌 API Server

Start the REST API server for integration with web/mobile apps:

```bash
chasm api serve --host 0.0.0.0 --port 8787
```

### Endpoints

| Method | Endpoint                      | Description                   |
| ------ | ----------------------------- | ----------------------------- |
| GET    | `/api/health`                 | Health check                  |
| GET    | `/api/workspaces`             | List workspaces               |
| GET    | `/api/workspaces/:id`         | Get workspace details         |
| GET    | `/api/sessions`               | List sessions                 |
| GET    | `/api/sessions/:id`           | Get session with messages     |
| GET    | `/api/sessions/search?q=`     | Search sessions               |
| GET    | `/api/stats`                  | Database statistics           |
| GET    | `/api/providers`              | List supported providers      |
| GET    | `/api/agents`                 | List available agents         |
| POST   | `/api/recording/events`       | Send recording events         |
| POST   | `/api/recording/snapshot`     | Store session snapshot        |
| GET    | `/api/recording/sessions`     | List active recording sessions|
| GET    | `/api/recording/sessions/:id` | Get recorded session          |
| GET    | `/api/recording/recovery`     | Recover sessions after crash  |
| GET    | `/api/recording/status`       | Recording service status      |

### Example

```bash
curl http://localhost:8787/api/stats
```

```json
{
  "success": true,
  "data": {
    "totalSessions": 330,
    "totalMessages": 19068,
    "totalWorkspaces": 138,
    "totalToolInvocations": 122712
  }
}
```

## 🤖 MCP Integration

Chasm provides [Model Context Protocol](https://modelcontextprotocol.io/) tools for AI agent integration:

```bash
chasm mcp serve
```

### Available Tools

- `chasm_list_workspaces` - List all workspaces
- `chasm_list_sessions` - List sessions in a workspace
- `chasm_get_session` - Get full session content
- `chasm_search_sessions` - Search across all sessions
- `chasm_get_stats` - Get database statistics

## 🏢 Enterprise Features

### Multi-Tenancy

Support for multiple isolated tenants with subscription tiers:

| Tier         | Users  | Storage | Features                              |
| ------------ | ------ | ------- | ------------------------------------- |
| Free         | 5      | 1 GB    | Basic harvest, local storage          |
| Starter      | 25     | 10 GB   | Cloud sync, API access                |
| Professional | 100    | 100 GB  | SSO, advanced analytics, priority     |
| Enterprise   | Custom | Custom  | Audit logs, compliance, white-label   |

### Compliance Frameworks

- SOC 2 Type II
- HIPAA
- GDPR
- CCPA
- ISO 27001
- FedRAMP
- PCI DSS

### White-Labeling

Custom branding support including logos, themes, domains, and email templates.

## 👥 Team Features

- **Team Workspaces**: Shared workspaces with role-based access
- **RBAC**: Owner, Admin, Member, Viewer roles with granular permissions
- **Activity Feeds**: Real-time team activity tracking
- **Session Sharing**: Share sessions with permissions (view, comment, edit)

## 🧠 AI Intelligence

- **Topic Extraction**: Automatic categorization of session content
- **Session Summarization**: AI-powered conversation summaries
- **Quality Scoring**: Score sessions by depth, code ratio, tool usage
- **Recommendations**: Personalized session suggestions based on usage
- **Similarity Detection**: Find related sessions using Jaccard similarity

## 🔀 Multi-Model Routing

Intelligent routing across AI providers:

```rust
use chasm::routing::{ModelRouter, TaskType, RoutingStrategy};

let router = ModelRouter::new(RoutingStrategy::Balanced);

// Automatic model selection based on task
let response = router.route(TaskType::Coding, "Fix this bug...").await?;
let response = router.route(TaskType::Creative, "Write a story...").await?;
```

### Supported Task Types

Coding, CodeReview, Debugging, Writing, Creative, Math, Analysis, Research, Translation, Summarization, QuestionAnswering, Vision, Reasoning, Quick

## 🤖 Agency (Agent Development Kit)

**Agency** is Chasm's Rust-native framework for building, orchestrating, and deploying AI agents. It provides a complete toolkit for creating autonomous agents that can reason, use tools, and collaborate in multi-agent workflows.

### Key Capabilities

| Feature                         | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| 🏗️ **Code-First Agents**         | Define agents in Rust with type safety and performance  |
| 🔧 **Tool Ecosystem**            | Built-in tools + custom function registration           |
| 🎭 **Multi-Agent Orchestration** | Sequential, parallel, hierarchical, and swarm patterns  |
| 🧠 **Memory & RAG**              | Vector store, knowledge base, context window management |
| 📡 **Streaming**                 | Real-time response streaming via SSE                    |
| 🏠 **Proactive Agents**          | Autonomous household and business agents                |
| 🌐 **Distributed Execution**     | Remote task monitoring across machines                  |
| 🎨 **Multimodal**                | VLM/VLA support for vision and robotics                 |

### CLI Commands

```bash
# List available agents and roles
chasm agency list
chasm agency list --verbose

# Get detailed agent information
chasm agency info researcher

# Run an agent with a prompt
chasm agency run --agent researcher "What are the latest trends in AI?"
chasm agency run --agent coder --model gpt-4o "Write a REST API in Rust"

# Multi-agent orchestration
chasm agency run --orchestration sequential "Build and test a web scraper"
chasm agency run --orchestration parallel "Research AI, blockchain, and quantum computing"
chasm agency run --orchestration swarm "Design a microservices architecture"

# Create a custom agent
chasm agency create my-agent --role coder --instruction "You are a Rust expert"

# List available tools and templates
chasm agency tools
chasm agency templates
chasm agency modes
```

### Agent Roles

| Role          | Icon | Description                                 |
| ------------- | ---- | ------------------------------------------- |
| `coordinator` | [C]  | Manages and delegates tasks to other agents |
| `researcher`  | [R]  | Gathers information and analyzes data       |
| `coder`       | [D]  | Writes and modifies code                    |
| `reviewer`    | [V]  | Reviews code and provides feedback          |
| `executor`    | [E]  | Executes commands and tools                 |
| `writer`      | [W]  | Creates documentation and content           |
| `tester`      | [T]  | Writes and runs tests                       |
| `analyst`     | [A]  | Data analysis and insights                  |
| `household`   | [H]  | Home automation and management              |
| `business`    | [B]  | Business process automation                 |
| `custom`      | [X]  | User-defined agent with custom behavior     |

### Orchestration Modes

| Mode           | Pattern | Description                                       |
| -------------- | ------- | ------------------------------------------------- |
| `single`       | `[1]`   | Traditional single-agent response                 |
| `sequential`   | `[>]`   | Agents execute one after another, passing results |
| `parallel`     | `[‖]`   | Multiple agents work simultaneously on subtasks   |
| `loop`         | `[O]`   | Agent repeats until a condition is met            |
| `hierarchical` | `[H]`   | Lead agent delegates to specialized sub-agents    |
| `swarm`        | `[S]`   | Multiple agents collaborate with a coordinator    |

---

## 📚 Agency Use Cases

### 1. Research Assistant

Build an agent that searches the web, analyzes sources, and synthesizes findings:

```rust
use chasm::agency::{AgentBuilder, Runtime, Tool};

let researcher = AgentBuilder::new("researcher")
    .model("gemini-2.0-flash")
    .instruction("You are a research assistant. Search for information, 
                  analyze multiple sources, and provide comprehensive summaries 
                  with citations.")
    .tool(Tool::web_search())
    .tool(Tool::file_write())
    .temperature(0.5)
    .build();

let runtime = Runtime::new();
let result = runtime.run(&researcher, "What are the latest breakthroughs in fusion energy?").await?;
```

**CLI equivalent:**
```bash
chasm agency run --agent researcher "What are the latest breakthroughs in fusion energy?"
```

### 2. Code Review Pipeline

Chain multiple agents for thorough code review:

```rust
use chasm::agency::{Pipeline, AgentBuilder, OrchestrationType};

// Security reviewer
let security = AgentBuilder::new("security-reviewer")
    .role(AgentRole::Reviewer)
    .instruction("Review code for security vulnerabilities: injection, XSS, 
                  authentication issues, secrets exposure.")
    .build();

// Performance reviewer
let performance = AgentBuilder::new("perf-reviewer")
    .role(AgentRole::Reviewer)
    .instruction("Analyze code for performance issues: N+1 queries, 
                  memory leaks, inefficient algorithms.")
    .build();

// Style reviewer
let style = AgentBuilder::new("style-reviewer")
    .role(AgentRole::Reviewer)
    .instruction("Check code style, naming conventions, and documentation.")
    .build();

// Sequential pipeline: security → performance → style
let pipeline = Pipeline::sequential(vec![security, performance, style]);
let result = runtime.run_pipeline(&pipeline, code_to_review).await?;
```

**CLI equivalent:**
```bash
chasm agency run --orchestration sequential "Review this code: [paste code]"
```

### 3. Full-Stack Development Swarm

A coordinator delegates to specialized agents:

```rust
use chasm::agency::{Swarm, AgentBuilder, AgentRole};

// Coordinator
let coordinator = AgentBuilder::new("lead-dev")
    .role(AgentRole::Coordinator)
    .instruction("You are a tech lead. Break down tasks and delegate to:
                  - frontend-dev: React/TypeScript UI work
                  - backend-dev: Rust API development
                  - devops: Docker, CI/CD, deployment")
    .build();

// Specialist agents
let frontend = AgentBuilder::new("frontend-dev")
    .role(AgentRole::Coder)
    .instruction("Expert in React, TypeScript, TailwindCSS")
    .tool(Tool::file_read())
    .tool(Tool::file_write())
    .build();

let backend = AgentBuilder::new("backend-dev")
    .role(AgentRole::Coder)
    .instruction("Expert in Rust, Actix-web, SQLite")
    .tool(Tool::file_read())
    .tool(Tool::file_write())
    .tool(Tool::terminal())
    .build();

let devops = AgentBuilder::new("devops")
    .role(AgentRole::Executor)
    .instruction("Expert in Docker, GitHub Actions, cloud deployment")
    .tool(Tool::terminal())
    .build();

let swarm = Swarm::new(coordinator, vec![frontend, backend, devops]);
let result = runtime.run_swarm(&swarm, "Build a user authentication system").await?;
```

**CLI equivalent:**
```bash
chasm agency run --orchestration swarm "Build a user authentication system"
```

### 4. Automated Testing Agent

An agent that writes and runs tests:

```rust
use chasm::agency::{AgentBuilder, AgentRole, Tool};

let tester = AgentBuilder::new("test-writer")
    .role(AgentRole::Tester)
    .instruction("You write comprehensive tests. For each function:
                  1. Identify edge cases and boundary conditions
                  2. Write unit tests with clear assertions
                  3. Add integration tests where appropriate
                  4. Run tests and fix failures")
    .tool(Tool::file_read())
    .tool(Tool::file_write())
    .tool(Tool::terminal())  // For running tests
    .max_tool_calls(20)
    .build();

let result = runtime.run(&tester, "Write tests for src/auth/login.rs").await?;
```

### 5. Proactive Household Agent

An autonomous agent that monitors and manages home tasks:

```rust
use chasm::agency::{ProactiveMonitor, household_agent_config, PermissionLevel};

let config = household_agent_config()
    .permission_level(PermissionLevel::MediumRisk)  // Can take moderate actions
    .scan_interval(Duration::from_secs(3600))       // Check hourly
    .notifications_enabled(true)
    .integrations(vec!["google_calendar", "todoist", "smart_home"]);

let monitor = ProactiveMonitor::new(config);

// Monitor detects problems and takes action based on permission level:
// - NotifyOnly: Just alerts (bills due, maintenance needed)
// - LowRisk: Safe actions (add reminders, reorder supplies)
// - MediumRisk: Moderate actions (adjust thermostat, schedule services)
// - HighAutonomy: Full automation (pay bills, control devices)

monitor.start().await?;
```

### 6. RAG-Enhanced Agent

Agent with access to a knowledge base:

```rust
use chasm::agency::{AgentBuilder, KnowledgeBase, VectorStore, EmbeddingModel};

// Create knowledge base from documents
let mut kb = KnowledgeBase::new();
kb.add_documents_from_directory("./docs").await?;

// Vector store for semantic search
let store = VectorStore::new(VectorStoreConfig {
    embedding_model: EmbeddingModel::TextEmbedding3Small,
    similarity_metric: SimilarityMetric::Cosine,
    ..Default::default()
});

let expert = AgentBuilder::new("domain-expert")
    .instruction("Answer questions using the provided knowledge base. 
                  Always cite sources.")
    .knowledge_base(kb)
    .vector_store(store)
    .build();

let result = runtime.run(&expert, "What is our refund policy?").await?;
```

### 7. Multimodal Vision Agent (VLM)

Agent that can understand images:

```rust
use chasm::agency::{AgentBuilder, MultimodalMessage, ImageContent, ModelCategory};

let vision_agent = AgentBuilder::new("vision-analyst")
    .model("gemini-2.0-flash")  // VLM model
    .instruction("Analyze images and provide detailed descriptions.")
    .modality(ModelCategory::VLM)
    .build();

// Send image with text
let message = MultimodalMessage::new()
    .text("What's in this image?")
    .image(ImageContent::from_file("screenshot.png")?);

let result = runtime.run(&vision_agent, message).await?;
```

### 8. Distributed Task Monitoring

Track agent tasks across multiple machines:

```rust
use chasm::agency::{RemoteMonitor, RemoteTask, TaskPriority};

let monitor = RemoteMonitor::new(RemoteMonitorConfig {
    heartbeat_interval: Duration::from_secs(30),
    ..Default::default()
});

// Register remote nodes
monitor.register_node("gpu-server-1", "192.168.1.100:8080").await?;
monitor.register_node("gpu-server-2", "192.168.1.101:8080").await?;

// Submit task to best available node
let task = RemoteTask::builder()
    .title("Train classification model")
    .agent("ml-trainer")
    .priority(TaskPriority::High)
    .build();

let task_id = monitor.submit_task(task).await?;

// Stream progress updates
let mut events = monitor.subscribe_task(task_id);
while let Some(event) = events.recv().await {
    println!("Progress: {}% - {}", event.progress * 100.0, event.message);
}
```

---

## 🔌 Agency REST API

The API server provides full CRUD operations for agents:

```bash
chasm api serve --port 3000
```

### Endpoints

| Method | Endpoint                     | Description           |
| ------ | ---------------------------- | --------------------- |
| GET    | `/api/v1/agents`             | List all agents       |
| POST   | `/api/v1/agents`             | Create an agent       |
| GET    | `/api/v1/agents/{id}`        | Get agent details     |
| PUT    | `/api/v1/agents/{id}`        | Update an agent       |
| DELETE | `/api/v1/agents/{id}`        | Delete an agent       |
| POST   | `/api/v1/agents/{id}/clone`  | Clone an agent        |
| GET    | `/api/v1/swarms`             | List all swarms       |
| POST   | `/api/v1/swarms`             | Create a swarm        |
| POST   | `/api/v1/swarms/{id}/start`  | Start swarm execution |
| POST   | `/api/v1/swarms/{id}/pause`  | Pause swarm           |
| POST   | `/api/v1/swarms/{id}/resume` | Resume swarm          |
| POST   | `/api/v1/swarms/{id}/stop`   | Stop swarm            |

### Example: Create an Agent via API

```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "code-assistant",
    "instruction": "You are a helpful coding assistant specializing in Rust.",
    "role": "coder",
    "model": "gemini-2.0-flash",
    "temperature": 0.3,
    "tools": ["file_read", "file_write", "terminal"]
  }'
```

### Example: Run a Swarm

```bash
# Create a swarm
curl -X POST http://localhost:3000/api/v1/swarms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "dev-team",
    "coordinator": "tech-lead",
    "workers": ["frontend-dev", "backend-dev", "tester"],
    "description": "Full-stack development team"
  }'

# Start the swarm with a task
curl -X POST http://localhost:3000/api/v1/swarms/{id}/start \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Build a todo app with user authentication"}'
```

## 🗃️ Supported Providers

### Editor-based
- ✅ GitHub Copilot (VS Code)
- ✅ Cursor
- ✅ Windsurf
- ✅ Continue.dev
- ✅ ClaudeCode
- ✅ OpenCode
- ✅ OpenClaw
- ✅ Antigravity

### Local LLMs
- ✅ Ollama
- ✅ LM Studio
- ✅ GPT4All
- ✅ LocalAI
- ✅ llama.cpp / llamafile

### Cloud APIs
- ✅ OpenAI / ChatGPT
- ✅ Anthropic / Claude
- ✅ Google / Gemini
- ✅ Perplexity

## 📁 Database

Chasm stores all data in a local SQLite database:

| Platform | Location                                   |
| -------- | ------------------------------------------ |
| Windows  | `%LOCALAPPDATA%\csm\csm.db`                |
| macOS    | `~/Library/Application Support/csm/csm.db` |
| Linux    | `~/.local/share/csm/csm.db`                |

### Schema

```
Workspaces ──< Sessions ──< Messages
                  │
                  ├──< Checkpoints
                  └──< ShareLinks
```

## 🛠️ Development

### Prerequisites

- Rust 1.75+
- Git

### Building

```bash
git clone https://github.com/nervosys/chasm.git
cd chasm
cargo build --release
```

### Running tests

```bash
cargo test
```

### Running the TUI

```bash
cargo run -- tui
```

## 📜 License

Licensed under the [GNU Affero General Public License v3.0](LICENSE) with a
[commercial dual-license](../COMMERCIAL_LICENSE.md) option.

- **Open source users**: Full AGPL-3.0 freedoms — use, modify, distribute
- **Network use**: Must provide source to users interacting over a network
- **Proprietary use**: Requires a [commercial license](../COMMERCIAL_LICENSE.md)

Contributions require signing the [CLA](../CLA.md).

For commercial licensing inquiries, contact [hello@nervosys.ai](mailto:hello@nervosys.ai).

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## 🔒 Security

For security issues, please see our [Security Policy](SECURITY.md).

## 📞 Support

- 📖 [Documentation](https://docs.rs/chasm)
- 💬 [GitHub Discussions](https://github.com/nervosys/chasm/discussions)
- 🐛 [Issue Tracker](https://github.com/nervosys/chasm/issues)

---

<p align="center">
  Made with ❤️ by <a href="https://nervosys.ai">Nervosys</a>
</p>

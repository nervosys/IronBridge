<p align="center">
  <h1 align="center">🗄️ IronBridge</h1>
  <p align="center">
    <strong>Chat Session Manager (IronBridge)</strong><br>
    Bridging the divide between AI providers
  </p>
</p>

<p align="center">
  <a href="https://crates.io/crates/ironbridge"><img src="https://img.shields.io/crates/v/ironbridge.svg" alt="Crates.io"></a>
  <a href="https://docs.rs/ironbridge"><img src="https://docs.rs/ironbridge/badge.svg" alt="Documentation"></a>
  <a href="https://github.com/nervosys/ironbridge/actions"><img src="https://github.com/nervosys/ironbridge/workflows/CI/badge.svg" alt="CI Status"></a>
  <a href="https://codecov.io/gh/nervosys/ironbridge"><img src="https://codecov.io/gh/nervosys/ironbridge/branch/main/graph/badge.svg" alt="Coverage"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL_3.0-blue.svg" alt="License"></a>
</p>

<p align="center">
  <video src="https://github.com/nervosys/ironbridge/raw/master/videos/out/getting-started.mp4" width="800" autoplay loop muted playsinline>
    Your browser does not support the video tag. <a href="../videos/out/getting-started.mp4">Watch the demo</a>.
  </video>
</p>

---

**IronBridge** extracts and unifies chat sessions from AI coding assistants like GitHub Copilot, Cursor, and more. Never lose your AI conversations again.

## ✨ Features

- 🔍 **Harvest** - Extract chat sessions from VS Code, Cursor, Windsurf, and 30+ providers
- 🔀 **Merge** - Combine sessions across workspaces and time periods
- 🔧 **Recover** - Detect and recover orphaned sessions across all projects recursively
- 📊 **Analyze** - Get statistics on your AI assistant usage
- 🔌 **API Server** - REST API for building custom integrations
- 🤖 **MCP Tools** - Model Context Protocol support for AI agent integration
- 🗃️ **Universal Database** - SQLite-based storage that normalizes all providers
- 🤖 **Agency** - Rust-native agent development kit with multi-agent orchestration
- 🩺 **Doctor** - System health checks with auto-fix capabilities
- ✂️ **Shard** - Split oversized sessions into linked, manageable parts

## 📦 Installation

### From crates.io

```bash
cargo install ironbridge
```

### From source

```bash
git clone https://github.com/nervosys/ironbridge.git
cd ironbridge
cargo install --path .
```

### Pre-built binaries

Download from [GitHub Releases](https://github.com/nervosys/ironbridge/releases):

| Platform    | Download                                                                       |
| ----------- | ------------------------------------------------------------------------------ |
| Windows x64 | [ironbridge-windows-x64.zip](https://github.com/nervosys/ironbridge/releases/latest)     |
| macOS x64   | [ironbridge-darwin-x64.tar.gz](https://github.com/nervosys/ironbridge/releases/latest)   |
| macOS ARM   | [ironbridge-darwin-arm64.tar.gz](https://github.com/nervosys/ironbridge/releases/latest) |
| Linux x64   | [ironbridge-linux-x64.tar.gz](https://github.com/nervosys/ironbridge/releases/latest)    |

### Docker

```bash
docker pull ghcr.io/nervosys/ironbridge:latest
docker run -v ~/.ironbridge:/data ghcr.io/nervosys/ironbridge list workspaces
```

## 🚀 Quick Start

### List discovered workspaces

```bash
ironbridge list workspaces
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
ironbridge show path /path/to/your/project
```

### Harvest sessions from VS Code

```bash
ironbridge harvest run
```

### Recover orphaned sessions across all projects

```bash
ironbridge recover recursive --force --register /path/to/projects
```

### Export a session to Markdown

```bash
ironbridge export session abc123 --format markdown --output chat.md
```

### Start the API server

```bash
ironbridge api serve --port 8787
```

## 📖 CLI Reference

### Core Commands

| Command                          | Description                                       |
| -------------------------------- | ------------------------------------------------- |
| `ironbridge list workspaces`          | List all discovered workspaces                    |
| `ironbridge list sessions`            | List sessions (optionally filtered by workspace)  |
| `ironbridge list orphaned`            | List unregistered sessions on disk                |
| `ironbridge show session <id>`        | Display full session content                      |
| `ironbridge show path <path>`         | Show sessions for a project path                  |
| `ironbridge find workspace <pattern>` | Search workspaces by name                         |
| `ironbridge find session <pattern>`   | Search sessions by content                        |
| `ironbridge fetch <path>`             | Fetch chat sessions from a workspace              |
| `ironbridge detect all <path>`        | Detect workspace, providers, sessions for a path  |
| `ironbridge detect providers`         | Detect available AI providers                     |
| `ironbridge watch`                    | Watch agent sessions for changes and auto-harvest |

### Data Management

| Command                                | Description                                    |
| -------------------------------------- | ---------------------------------------------- |
| `ironbridge harvest scan`                   | Scan for available providers and sessions      |
| `ironbridge harvest run`                    | Collect sessions from all providers            |
| `ironbridge harvest status`                 | Show harvest database status                   |
| `ironbridge sync --pull`                    | Pull sessions from workspaces to database      |
| `ironbridge sync --push`                    | Push sessions from database to workspaces      |
| `ironbridge merge workspace <name>`         | Merge sessions from a workspace                |
| `ironbridge export session <id>`            | Export session to file                         |
| `ironbridge export batch <dest> <paths...>` | Batch export from multiple projects            |
| `ironbridge import <file>`                  | Import sessions from file                      |
| `ironbridge move <session> <dest>`          | Move sessions between workspaces               |
| `ironbridge git`                            | Git integration for session versioning         |
| `ironbridge migration`                      | Migration commands for moving between machines |

### Session Recovery

| Command                             | Description                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| `ironbridge detect orphaned <path>`      | Find orphaned sessions in old workspace hashes                |
| `ironbridge detect orphaned -r <path>`   | Recover orphaned sessions to active workspace                 |
| `ironbridge recover recursive <path>`    | Recursively recover orphaned sessions for all projects        |
| `ironbridge recover extract <path>`      | Extract sessions from a VS Code workspace by project path     |
| `ironbridge recover scan`                | Scan for recoverable sessions from various sources            |
| `ironbridge recover status`              | Show recovery status and recommendations                      |
| `ironbridge recover upgrade <paths...>`  | Upgrade session format from JSON to JSONL                     |
| `ironbridge recover convert <file>`      | Convert between JSON and JSONL formats                        |
| `ironbridge recover copilot-info`        | Show Copilot Chat extension version and compatibility         |
| `ironbridge register all --path <path>`  | Register on-disk sessions in VS Code's index                  |
| `ironbridge register recursive <path>`   | Recursively register sessions for all workspaces under a path |
| `ironbridge register repair --recursive` | Repair and rebuild index for all discovered workspaces        |
| `ironbridge register trim --all`         | Trim oversized sessions to keep recent requests               |
| `ironbridge shard workspace`             | Split oversized sessions into linked shards                   |

#### Recovering Lost Chat History

When VS Code creates a new workspace hash (e.g., after reinstall or path change), your chat sessions may become "orphaned" in the old workspace folder. Use these commands to recover them:

```bash
# Recover a single project
ironbridge detect orphaned /path/to/project          # 1. Scan for orphans
ironbridge detect orphaned --recover /path/to/project # 2. Copy to active workspace
ironbridge register all --force --path /path/to/project # 3. Register in VS Code's index
# 4. Reload VS Code (Ctrl+Shift+P -> Developer: Reload Window)
```

#### Bulk Recovery (All Projects)

Recover orphaned sessions across an entire directory tree in one command:

```bash
# Dry run first to see what would be recovered
ironbridge recover recursive --dry-run /path/to/projects

# Recover and register in one step
ironbridge recover recursive --force --register /path/to/projects

# Or recover then register separately
ironbridge recover recursive --force /path/to/projects
ironbridge register recursive --force /path/to/projects
```

### Maintenance

| Command                       | Description                                            |
| ----------------------------- | ------------------------------------------------------ |
| `ironbridge doctor`                | Check system environment, providers, and config health |
| `ironbridge doctor --quick`        | Same, minus the session-file scan (the slow part)      |
| `ironbridge doctor --fix`          | Auto-fix detected issues                               |
| `ironbridge register repair --all` | Repair and rebuild session index for all workspaces    |
| `ironbridge register trim --all`   | Trim sessions over 10MB to keep recent requests        |
| `ironbridge shard session <file>`  | Split a session into linked shards by request count    |
| `ironbridge shard workspace`       | Shard all oversized sessions in a workspace            |
| `ironbridge telemetry`             | Record events locally; nothing is sent without your own endpoint |

### Server

| Command           | Description               |
| ----------------- | ------------------------- |
| `ironbridge api serve` | Start the REST API server |
| `ironbridge mcp serve` | Start the MCP tool server |

### Options

```bash
ironbridge --help          # Show all commands
ironbridge <cmd> --help    # Show help for a specific command
ironbridge --version       # Show version
```

## 🔌 API Server

Start the REST API server for integration with web/mobile apps:

```bash
ironbridge api serve --host 0.0.0.0 --port 8787
```

### Endpoints

| Method | Endpoint                      | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| GET    | `/api/health`                 | Health check                   |
| GET    | `/api/workspaces`             | List workspaces                |
| GET    | `/api/workspaces/:id`         | Get workspace details          |
| GET    | `/api/sessions`               | List sessions                  |
| GET    | `/api/sessions/:id`           | Get session with messages      |
| GET    | `/api/sessions/search?q=`     | Search sessions                |
| GET    | `/api/stats`                  | Database statistics            |
| GET    | `/api/providers`              | List supported providers       |
| GET    | `/api/agents`                 | List available agents          |
| POST   | `/api/recording/events`       | Send recording events          |
| POST   | `/api/recording/snapshot`     | Store session snapshot         |
| GET    | `/api/recording/sessions`     | List active recording sessions |
| GET    | `/api/recording/sessions/:id` | Get recorded session           |
| GET    | `/api/recording/recovery`     | Recover sessions after crash   |
| GET    | `/api/recording/status`       | Recording service status       |

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

IronBridge provides [Model Context Protocol](https://modelcontextprotocol.io/) tools for AI agent integration:

```bash
ironbridge-mcp
```

`ironbridge-mcp` is a separate binary. There is no `ironbridge mcp` subcommand.

### Available Tools

Sixteen, all prefixed `ironbridge_`. The `ironbridge_*` tools read VS Code's on-disk
workspace storage; the `ironbridge_db_*` tools read the harvested IronBridge database.

- `ironbridge_list_workspaces` - List VS Code workspaces with chat sessions
- `ironbridge_find_workspace` - Find workspaces matching a pattern
- `ironbridge_list_sessions` - List sessions, optionally filtered by project path
- `ironbridge_list_orphaned` - Sessions on disk that VS Code's index has dropped
- `ironbridge_show_session` - Show one session
- `ironbridge_show_history` - Chat history timeline for a project
- `ironbridge_search` - Full-text search across harvested sessions
- `ironbridge_detect` - Detect workspace and providers for a path
- `ironbridge_register_all` / `ironbridge_register_sessions` - Write sessions back into
  VS Code's index
- `ironbridge_merge_sessions` - Merge sessions into one history
- `ironbridge_db_list_workspaces` / `ironbridge_db_list_sessions` / `ironbridge_db_get_session` /
  `ironbridge_db_search` / `ironbridge_db_stats` - Read the IronBridge database

See [MCP Server](docs/api/mcp.md) for parameters. A test in
`src/api/docs.rs` keeps that page and the tool registry in step.

## 🏢 Enterprise Features

> **⚠️ The two sections below describe code that compiles but is not routed.**
> `src/enterprise/` — multi-tenancy and white-labelling, 1,389 lines — is
> declared behind the `enterprise` feature, so rustc, clippy and rustfmt see
> it and its tests run. Nothing calls it: there are no routes, no persistence
> and no CLI surface. Read what follows as a design that exists in source
> form, not as behaviour you can invoke.
>
> It is compiled rather than deleted because an orphan cannot rot *detectably*
> — while these files had no `mod` declaration, appending invalid Rust to one
> of them broke no build. Wiring them is a product decision and a substantial
> one: every table here is single-tenant today, so tenancy touches all of them.
>
> What *is* built and served under `--features enterprise` is SSO (`/sso`,
> `/oidc`), audit logging (`/audit`) and retention policy (`/retention`) —
> see [REST API](docs/api/rest.md).
>
> `tests/module_reachability.rs` fails on any *new* unreachable file.

### Multi-Tenancy

Support for multiple isolated tenants with subscription tiers:

| Tier         | Users  | Storage | Features                            |
| ------------ | ------ | ------- | ----------------------------------- |
| Free         | 5      | 1 GB    | Basic harvest, local storage        |
| Starter      | 25     | 10 GB   | Cloud sync, API access              |
| Professional | 100    | 100 GB  | SSO, advanced analytics, priority   |
| Enterprise   | Custom | Custom  | Audit logs, compliance, white-label |

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
use ironbridge::routing::{ModelRouter, TaskType, RoutingStrategy};

let router = ModelRouter::new(RoutingStrategy::Balanced);

// Automatic model selection based on task
let response = router.route(TaskType::Coding, "Fix this bug...").await?;
let response = router.route(TaskType::Creative, "Write a story...").await?;
```

### Supported Task Types

Coding, CodeReview, Debugging, Writing, Creative, Math, Analysis, Research, Translation, Summarization, QuestionAnswering, Vision, Reasoning, Quick

## 🤖 Agency (Agent Development Kit)

**Agency** is IronBridge's Rust-native framework for building, orchestrating, and deploying AI agents. It provides a complete toolkit for creating autonomous agents that can reason, use tools, and collaborate in multi-agent workflows.

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
ironbridge agency list
ironbridge agency list --verbose

# Get detailed agent information
ironbridge agency info researcher

# Run an agent with a prompt
ironbridge agency run --agent researcher "What are the latest trends in AI?"
ironbridge agency run --agent coder --model gpt-4o "Write a REST API in Rust"

# Multi-agent orchestration
ironbridge agency run --orchestration sequential "Build and test a web scraper"
ironbridge agency run --orchestration parallel "Research AI, blockchain, and quantum computing"
ironbridge agency run --orchestration swarm "Design a microservices architecture"

# Create a custom agent
ironbridge agency create my-agent --role coder --instruction "You are a Rust expert"

# List available tools and templates
ironbridge agency tools
ironbridge agency templates
ironbridge agency modes
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
use ironbridge::agency::{AgentBuilder, Runtime, Tool};

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
ironbridge agency run --agent researcher "What are the latest breakthroughs in fusion energy?"
```

### 2. Code Review Pipeline

Chain multiple agents for thorough code review:

```rust
use ironbridge::agency::{Pipeline, AgentBuilder, OrchestrationType};

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
ironbridge agency run --orchestration sequential "Review this code: [paste code]"
```

### 3. Full-Stack Development Swarm

A coordinator delegates to specialized agents:

```rust
use ironbridge::agency::{Swarm, AgentBuilder, AgentRole};

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
ironbridge agency run --orchestration swarm "Build a user authentication system"
```

### 4. Automated Testing Agent

An agent that writes and runs tests:

```rust
use ironbridge::agency::{AgentBuilder, AgentRole, Tool};

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
use ironbridge::agency::{ProactiveMonitor, household_agent_config, PermissionLevel};

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
use ironbridge::agency::{AgentBuilder, KnowledgeBase, VectorStore, EmbeddingModel};

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
use ironbridge::agency::{AgentBuilder, MultimodalMessage, ImageContent, ModelCategory};

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
use ironbridge::agency::{RemoteMonitor, RemoteTask, TaskPriority};

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
ironbridge api serve --port 3000
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
- ✅ vLLM
- ✅ Azure AI Foundry
- ✅ Text Generation WebUI
- ✅ Jan.ai

### Cloud APIs
- ✅ OpenAI / ChatGPT
- ✅ Anthropic / Claude
- ✅ Google / Gemini
- ✅ Perplexity

## 📁 Database

IronBridge stores all data in a local SQLite database:

| Platform | Location                                   |
| -------- | ------------------------------------------ |
| Windows  | `%LOCALAPPDATA%\ironbridge\ironbridge.db`                |
| macOS    | `~/Library/Application Support/ironbridge/ironbridge.db` |
| Linux    | `~/.local/share/ironbridge/ironbridge.db`                |

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
git clone https://github.com/nervosys/ironbridge.git
cd ironbridge
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

- 📖 [Documentation](https://docs.rs/ironbridge)
- 💬 [GitHub Discussions](https://github.com/nervosys/ironbridge/discussions)
- 🐛 [Issue Tracker](https://github.com/nervosys/ironbridge/issues)

---

<p align="center">
  Made with ❤️ by <a href="https://nervosys.ai">Nervosys</a>
</p>

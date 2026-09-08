# Agentic Coding Guide

Use IronBridge's Agency framework to build AI-powered coding workflows — from single agents to multi-agent swarms.

## Prerequisites

- IronBridge installed (`cargo install ironbridge`)
- At least one AI provider configured (local or cloud)

## Single Agent

The simplest setup — one agent, one task:

```bash
# Use a researcher agent
ironbridge agency run --agent researcher "What are the latest trends in AI safety?"

# Use a coder agent with a specific model
ironbridge agency run --agent coder --model gpt-4o "Write a REST API in Rust"

# Use a reviewer agent
ironbridge agency run --agent reviewer "Review the error handling in src/api/"
```

### Available Roles

```bash
# List all available roles
ironbridge agency list

# Get details on a specific role
ironbridge agency info coder
```

| Role | Best For |
|---|---|
| `researcher` | Information gathering, analysis |
| `coder` | Writing and modifying code |
| `reviewer` | Code review, quality checks |
| `tester` | Writing and running tests |
| `writer` | Documentation, content |
| `executor` | Running commands, DevOps |
| `analyst` | Data analysis |

## Custom Agents

Create agents tailored to your workflow:

```bash
# Create a Rust expert
ironbridge agency create rust-expert \
  --role coder \
  --instruction "You are a Rust expert. Write idiomatic, safe, performant code. \
                 Always use proper error handling with Result types."

# Create a security reviewer
ironbridge agency create sec-reviewer \
  --role reviewer \
  --instruction "Review code for security vulnerabilities: injection, XSS, \
                 authentication issues, secrets exposure, OWASP Top 10."

# Use your custom agent
ironbridge agency run --agent rust-expert "Implement a rate limiter middleware"
ironbridge agency run --agent sec-reviewer "Review src/auth/login.rs"
```

## Multi-Agent Orchestration

### Sequential Pipeline

Agents execute in order, each building on the previous output. Great for review workflows:

```bash
ironbridge agency run --orchestration sequential \
  "Write a user authentication system with tests"
```

**What happens:**

1. **Coder** writes the implementation
2. **Reviewer** reviews the code
3. **Tester** writes and runs tests

### Parallel Execution

Multiple agents work simultaneously on independent tasks:

```bash
ironbridge agency run --orchestration parallel \
  "Research the best practices for: Rust error handling, API design, database schema"
```

**What happens:**

- **Agent 1** researches Rust error handling
- **Agent 2** researches API design
- **Agent 3** researches database schema
- Results are merged into a unified output

### Swarm

A coordinator delegates to specialized workers:

```bash
ironbridge agency run --orchestration swarm \
  "Build a full-stack web application with authentication"
```

**What happens:**

1. **Coordinator** analyzes the task and creates a plan
2. **Frontend developer** builds the UI
3. **Backend developer** builds the API
4. **Tester** writes integration tests
5. **Coordinator** reviews and integrates results

### Hierarchical

A lead agent delegates to sub-agents, who may further delegate:

```bash
ironbridge agency run --orchestration hierarchical \
  "Design and implement a microservices architecture"
```

### Loop

An agent repeats until a condition is met:

```bash
ironbridge agency run --orchestration loop \
  "Fix all failing tests in the project"
```

The agent runs tests, fixes failures, and repeats until all tests pass.

## Tools

Agents can use tools to interact with the environment:

```bash
# List available tools
ironbridge agency tools
```

| Tool | Description | Used By |
|---|---|---|
| `file_read` | Read file contents | coder, reviewer, tester |
| `file_write` | Create/modify files | coder, writer |
| `terminal` | Execute shell commands | executor, tester |
| `web_search` | Search the web | researcher |
| `delegation` | Delegate to sub-agents | coordinator |

## Programmatic Usage (Rust API)

For more control, use the Rust API directly:

```rust
use ironbridge::agency::{AgentBuilder, AgentRole, Tool, Runtime};

// Build an agent
let agent = AgentBuilder::new("my-agent")
    .role(AgentRole::Coder)
    .model("gemini-2.0-flash")
    .instruction("Write clean, well-documented Rust code")
    .tool(Tool::file_read())
    .tool(Tool::file_write())
    .tool(Tool::terminal())
    .temperature(0.3)
    .build();

// Run it
let runtime = Runtime::new();
let result = runtime.run(&agent, "Implement a CLI argument parser").await?;
println!("{}", result);
```

### Multi-Agent Pipeline

```rust
use ironbridge::agency::{Pipeline, AgentBuilder, OrchestrationType};

let security = AgentBuilder::new("security")
    .role(AgentRole::Reviewer)
    .instruction("Check for security vulnerabilities")
    .build();

let performance = AgentBuilder::new("performance")
    .role(AgentRole::Reviewer)
    .instruction("Check for performance issues")
    .build();

let pipeline = Pipeline::sequential(vec![security, performance]);
let result = runtime.run_pipeline(&pipeline, code).await?;
```

## Best Practices

1. **Start simple** — Use single agents before moving to orchestration
2. **Be specific in instructions** — Detailed instructions produce better results
3. **Choose the right model** — Use cheaper/faster models for simple tasks, powerful models for complex ones
4. **Limit tool calls** — Set `max_tool_calls` to prevent runaway agents
5. **Review agent output** — Always review code changes before committing
6. **Use sequential for quality** — Sequential pipelines catch more issues than single agents
7. **Use parallel for speed** — When tasks are independent, parallelize

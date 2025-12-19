# CSM Ecosystem Alignment

This document describes how the CSM (Chat Session Manager) ecosystem maintains consistency across all modules.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CSM Ecosystem                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   csm-web    │    │   csm-app    │    │  vscode-ext  │       │
│  │  (React)     │    │ (RN Mobile)  │    │  (VS Code)   │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └─────────┬─────────┴─────────┬─────────┘                │
│                   │                   │                          │
│           ┌───────▼───────┐   ┌───────▼───────┐                 │
│           │  csm-shared   │   │   csm-rust    │                 │
│           │  (TypeScript) │   │    (Rust)     │                 │
│           └───────────────┘   └───────────────┘                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### csm-rust (Rust Backend)
- **Location**: `csm-rust/`
- **Purpose**: High-performance backend with ADK (Agent Development Kit)
- **Key Features**:
  - CLI tool (`csm`, `chasm`)
  - Agent orchestration (Sequential, Parallel, Loop, Hierarchical, Swarm)
  - Multi-provider support (12+ providers)
  - SQLite session storage
  - MCP server integration

### csm-shared (TypeScript Shared Library)
- **Location**: `csm-shared/`
- **Purpose**: Shared types, constants, and utilities
- **Key Exports**:
  - `types/` - Core interfaces (Session, Message, Agent, Swarm, etc.)
  - `constants/` - Provider configs, agent roles, orchestration modes
  - `api/` - API client for csm-rust backend
  - `utils/` - Common utilities

### csm-web (React Web App)
- **Location**: `csm-web/`
- **Purpose**: Web-based chat interface
- **Uses from csm-shared**:
  - `PROVIDERS`, `AGENT_ROLES`, `ORCHESTRATION_MODES`
  - All core types

### csm-app (React Native Mobile App)
- **Location**: `csm-app/`
- **Purpose**: Mobile chat interface
- **Uses from csm-shared**:
  - `AGENT_ROLES`, `SWARM_TEMPLATES`
  - Provider and session types

### vscode-extension (VS Code Extension)
- **Location**: `vscode-extension/`
- **Purpose**: VS Code integrated chat panel
- **Uses**:
  - Own `constants.ts` (mirrors csm-shared for VS Code compatibility)
  - Bundles `csm-rust` binary for CLI operations

## Aligned Constants

### Providers
All modules use the same provider definitions:
- copilot, ollama, openai, anthropic, azure, google
- lmstudio, jan, gpt4all, llamafile, localai, vllm
- text-gen-webui, cursor, google-adk

### Agent Roles
```typescript
coordinator | researcher | coder | reviewer | executor | writer | tester | custom
```

### Orchestration Types
```typescript
single | sequential | parallel | loop | hierarchical | swarm | debate
```
Maps to Rust ADK `OrchestrationType` enum.

### Agent Statuses
```typescript
idle | thinking | executing | waiting | completed | failed | paused
```

### Task Statuses
```typescript
pending | in_progress | completed | failed | cancelled
```

## Type Alignment

### Session Types
| TypeScript (csm-shared) | Rust (csm-rust) |
| ----------------------- | --------------- |
| `Session`               | `ChatSession`   |
| `Message`               | `ChatMessage`   |
| `Workspace`             | `Workspace`     |

### Agent Types
| TypeScript (csm-shared) | Rust (csm-rust) |
| ----------------------- | --------------- |
| `Agent`                 | `Agent`         |
| `AgentTask`             | `Task`          |
| `Swarm`                 | `Swarm`         |
| `Pipeline`              | `Pipeline`      |

### ADK Event Types
| TypeScript (csm-shared) | Rust (csm-rust)      |
| ----------------------- | -------------------- |
| `AdkEvent`              | `AdkEvent`           |
| `AdkEventType`          | `EventType`          |
| `ExecutionResult`       | `ExecutionResult`    |
| `OrchestratorResult`    | `OrchestratorResult` |

## API Endpoints

All TypeScript modules use the same API configuration:
```typescript
const API_CONFIG = {
    baseUrl: 'http://localhost:3000',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
};

const API_ENDPOINTS = {
    sessions: '/api/v1/sessions',
    workspaces: '/api/v1/workspaces',
    providers: '/api/v1/providers',
    agents: '/api/v1/agents',
    swarms: '/api/v1/swarms',
    runs: '/api/v1/runs',
    chat: '/api/v1/chat',
    mcp: '/api/v1/mcp',
};
```

## Build Status

| Module           | Build Command           | Status        |
| ---------------- | ----------------------- | ------------- |
| csm-rust         | `cargo build --release` | ✅ 36/36 tests |
| csm-shared       | `npm run build`         | ✅ ESM+CJS+DTS |
| csm-web          | `npm run build`         | ✅ ~2MB bundle |
| csm-app          | `npx tsc --noEmit`      | ✅ Type-checks |
| vscode-extension | `npx vsce package`      | ✅ 4.22MB VSIX |

## Adding New Features

When adding a new feature (e.g., new agent role):

1. **csm-rust**: Add to `AgentRole` enum in `adk/agent.rs`
2. **csm-shared**: Add to `AgentRole` type and `AGENT_ROLES` constant
3. **csm-web**: Will automatically get from csm-shared
4. **csm-app**: Add to `ROLE_ICONS`, `ROLE_COLORS` in screens
5. **vscode-extension**: Add to `AGENT_ROLES` in `constants.ts`

## Swarm Management UI

The VS Code extension includes a swarm management UI:

### Features
- Orchestration mode selector (single, sequential, parallel, swarm, etc.)
- Swarm visualization with agent chips
- Task plan display with status icons
- Swarm controls (start, pause, cancel)

### Event Handling
```typescript
// Webview → Extension
selectOrchestration(mode)  // Change orchestration mode
swarmAction(action)        // start, pause, cancel

// Extension → Webview
swarmUpdate(swarm)         // Update swarm state
taskUpdate(tasks)          // Update task list
```

## Future Alignment

- [ ] Add WebSocket support for real-time swarm updates
- [ ] Implement MCP tool registry in TypeScript
- [ ] Add agent capability negotiation
- [ ] Sync provider health status across modules

# IRONBRIDGE Web Interface

A reactive GUI web interface for Chat System Manager (IRONBRIDGE) built with React, TypeScript, Vite, and Recharts. Connects to the IRONBRIDGE Rust backend via REST API.

## Features

### Core Pages

- **Chat** - Interactive chat interface with model selection, conversation history, syntax highlighting, and git commit/checkpoint tracking
- **Agents** - Create and manage AI agents with custom system prompts and tool configurations
- **Swarms** - Multi-agent orchestration with visual workflow builder and execution monitoring
- **Harvest** - Unified database management, import share links, full-text search
- **Overview** - Dashboard with session statistics, activity charts, and provider distribution

### Management

- **Workspaces** - Browse and manage VS Code workspaces with linked chat sessions
- **Sessions** - View, search, and filter chat sessions with timeline visualization
- **Protocols** - Multi-agent protocols (NANDA, A2A, MCP, swarm intelligence, PGMs, consensus) and MCP server management
- **Comparison** - Side-by-side model comparison with response quality metrics

### Developer Tools

- **Developer** - Comprehensive ML/AI development pipeline:
  - **Models** - Pre-trained model management and downloads
  - **Datasets** - Dataset browser and download manager
  - **Simulation** - Photorealistic simulator hooks for synthetic data generation (Unreal Engine 5, NVIDIA Omniverse, CARLA, AirSim, Isaac Sim, Habitat-Sim, BlenderProc, Gazebo)
  - **Training** - Fine-tuning, LoRA, QLoRA with live metrics
  - **Optimization** - Quantization, pruning, distillation, low-rank factorization
  - **Deployment** - Multi-target deployment (MCU, CPU, GPU, NPU, Edge)
  - **RAG** - Vector database connections, embedding models, retrieval pipelines
  - **Tool Use** - Function calling definitions with multi-format schema export
  - **Multi-Modal** - Vision, audio, and video model configuration and playground

### Research & Settings

- **Research** - AI research tracking with alphaXiv integration, SOTA benchmarks, and trending papers
- **Providers** - Local and cloud LLM provider status and configuration
- **Accounts** - OAuth 2.0 authentication for provider accounts (GitHub, Google, Microsoft, OpenAI, Anthropic)

### UI/UX

- **Theme Modes** - Light, neutral, and dark themes
- **Syntax Themes** - Multiple code highlighting themes (Monokai, GitHub, Dracula, Solarized, Ayu, One Light, VS Light)
- **Keyboard Shortcuts** - Quick navigation and actions
- **Syntax Highlighting** - Code blocks with highlight.js
- **Real-time Updates** - WebSocket connection for live data

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool and dev server
- **Tailwind CSS 4** - Utility-first styling
- **Recharts** - Data visualization
- **React Router** - Client-side routing
- **Lucide React** - Icon library
- **highlight.js** - Syntax highlighting

## Backend Integration

IRONBRIDGE Web connects to the IRONBRIDGE Rust backend API server for all data operations:

### API Architecture

```
┌─────────────────┐    REST API     ┌─────────────────┐
│   IRONBRIDGE Web GUI   │◄──────────────► │  IRONBRIDGE Backend    │
│   (React)       │    WebSocket    │  (Actix-web)    │
└─────────────────┘                 └─────────────────┘
         │                                  │
         │                                  │
         ▼                                  ▼
     src/api/                        SQLite Database
     src/hooks/                      VS Code Storage
     src/context/                    Provider APIs
```

### API Client

The frontend includes a complete TypeScript API client:

```typescript
import { api } from './api';

// Fetch workspaces
const workspaces = await api.workspaces.list();

// Get sessions for a workspace
const sessions = await api.sessions.list({ workspaceId: 'ws-123' });

// Create a checkpoint
await api.sessions.createCheckpoint('session-id', {
  name: 'Before refactor',
  gitCommit: 'abc123',
});

// Stream chat completion
for await (const chunk of api.chat.stream({ provider: 'ollama', model: 'llama3.3', messages })) {
  console.log(chunk.delta);
}
```

### React Hooks

Custom hooks for data fetching with caching and auto-refresh:

```typescript
import { useSessions, useWorkspaces, useProviderHealth } from './hooks';

function MyComponent() {
  const { data: sessions, isLoading, refetch } = useSessions({ workspaceId });
  const { data: workspaces } = useWorkspaces();
  const { data: health } = useProviderHealth();
  // ...
}
```

### API Context

Global state management via React Context:

```typescript
import { useApi } from './context';

function Dashboard() {
  const { workspaces, sessions, statistics, isConnected } = useApi();
  // Access all data and connection status
}
```

## Development

```bash
# Install dependencies
npm install

# Start dev server (frontend only)
npm run dev

# Start with backend
cd ../ironbridge-rust && cargo run -- serve &
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:8787
VITE_WS_BASE_URL=ws://localhost:8787

# Feature Flags
VITE_ENABLE_WEBSOCKET=true
VITE_ENABLE_OFFLINE_MODE=false

# UI Defaults
VITE_DEFAULT_THEME=dark
VITE_DEFAULT_SYNTAX_THEME=monokai
```

## Project Structure

```bash
ironbridge-web/
├── src/
│   ├── api/
│   │   ├── client.ts         # HTTP/WebSocket client
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── index.ts          # Exports
│   ├── hooks/
│   │   ├── useApi.ts         # Data fetching hooks
│   │   └── index.ts          # Exports
│   ├── context/
│   │   ├── ApiContext.tsx    # Global API state
│   │   └── index.ts          # Exports
│   ├── config/
│   │   ├── env.ts            # Environment config
│   │   └── index.ts          # Exports
│   ├── components/
│   │   └── Layout.tsx        # Sidebar navigation and layout
│   ├── pages/
│   │   ├── Chat.tsx          # Interactive chat interface
│   │   ├── Agents.tsx        # Agent management
│   │   ├── Swarms.tsx        # Multi-agent orchestration
│   │   ├── Harvest.tsx       # Harvest database UI
│   │   ├── Overview.tsx      # Dashboard with charts
│   │   ├── Workspaces.tsx    # Workspace management
│   │   ├── Sessions.tsx      # Session browser
│   │   ├── Protocols.tsx     # Multi-agent protocols & MCP
│   │   ├── Developer.tsx     # ML/AI development tools
│   │   ├── Research.tsx      # AI research tracking
│   │   ├── Comparison.tsx    # Model comparison
│   │   ├── Providers.tsx     # Provider status
│   │   └── Accounts.tsx      # OAuth account management
│   ├── styles/
│   │   └── syntax-themes.css # Code highlighting themes
│   ├── App.tsx               # Routes, theme, and API provider
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind imports
├── .env.example              # Environment template
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Deployment

### Static Build

```bash
# Build production assets
npm run build

# Output in dist/ - serve with any static file server
npx serve dist
```

### Production Server

Serve the `dist/` folder with any web server (nginx, Apache, Caddy, IIS):

```bash
# Example: serve with Node.js
npx serve -s dist -l 3000

# Example: Python
cd dist && python -m http.server 3000
```

### Environment Configuration

Set at build time via `.env.production`:

```bash
VITE_API_BASE_URL=https://api.example.com
VITE_WS_BASE_URL=wss://api.example.com
VITE_ENABLE_WEBSOCKET=true
VITE_DEFAULT_THEME=dark
```

## Integration with IRONBRIDGE CLI

The web interface works alongside the IRONBRIDGE CLI tool. Run `ironbridge serve` to start the backend API.

## License

Copyright 2025 Nervosys LLC

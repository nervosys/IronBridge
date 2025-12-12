# CSM Web Interface

A reactive GUI web interface for Chat Session Manager (CSM) built with React, TypeScript, Vite, and Recharts.

## Features

### Core Pages

- **Chat** - Interactive chat interface with model selection, conversation history, and syntax highlighting
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

- **Dark Mode** - Toggle between light and dark themes
- **Keyboard Shortcuts** - Quick navigation and actions
- **Syntax Highlighting** - Code blocks with highlight.js

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool and dev server
- **Tailwind CSS 4** - Utility-first styling
- **Recharts** - Data visualization
- **React Router** - Client-side routing
- **Lucide React** - Icon library
- **highlight.js** - Syntax highlighting

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```bash
csm-web/
├── src/
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
│   ├── App.tsx               # Routes and theme
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind imports
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Integration with CSM CLI

This web interface is designed to work with the CSM CLI tool. Currently displays mock data - future versions will integrate with the CSM backend API.

## License

Copyright 2025 Nervosys LLC

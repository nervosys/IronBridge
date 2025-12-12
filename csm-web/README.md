# CSM Web Interface

A reactive GUI web interface for Chat Session Manager (CSM) built with React, TypeScript, Vite, and Recharts.

## Features

- **Dashboard** - Overview with session statistics, activity charts, provider distribution
- **Workspaces** - Browse and manage VS Code workspaces with chat sessions
- **Sessions** - View, search, and filter chat sessions with timeline visualization
- **Providers** - Monitor local and cloud LLM provider status
- **Harvest** - Manage the unified database, import share links, full-text search
- **Dark Mode** - Toggle between light and dark themes

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization
- **React Router** - Client-side routing
- **Lucide React** - Icon library

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

```
csm-web/
├── src/
│   ├── components/
│   │   └── Layout.tsx      # Sidebar navigation and layout
│   ├── pages/
│   │   ├── Dashboard.tsx   # Main dashboard with charts
│   │   ├── Workspaces.tsx  # Workspace management
│   │   ├── Sessions.tsx    # Session browser
│   │   ├── Providers.tsx   # Provider status
│   │   └── Harvest.tsx     # Harvest database UI
│   ├── App.tsx             # Routes and theme
│   ├── main.tsx            # Entry point
│   └── index.css           # Tailwind imports
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Integration with CSM CLI

This web interface is designed to work with the CSM CLI tool. Currently displays mock data - future versions will integrate with the CSM backend API.

## License

Apache 2.0

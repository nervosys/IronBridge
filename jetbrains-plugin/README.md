# IronBridge JetBrains Plugin

A plugin for JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, etc.) that integrates with the IronBridge AI session management system.

## Features

- **Session Management**: Browse, search, and manage AI chat sessions directly from your IDE
- **Harvest Sessions**: Collect sessions from various AI providers (GitHub Copilot, Cursor, etc.)
- **Search**: Full-text search across all your AI sessions
- **Auto-Sync**: Automatic synchronization with the IronBridge server
- **Code Integration**: Save selected code to sessions for context preservation

## Installation

### From JetBrains Marketplace

1. Open your JetBrains IDE
2. Go to **Settings/Preferences** → **Plugins** → **Marketplace**
3. Search for "IronBridge"
4. Click **Install**

### From Source

```bash
cd jetbrains-plugin
./gradlew buildPlugin
```

The plugin ZIP will be in `build/distributions/`.

## Configuration

1. Go to **Settings/Preferences** → **Tools** → **IronBridge**
2. Set the **Server URL** (default: `http://localhost:8787`)
3. Click **Test Connection** to verify
4. Configure additional options:
   - **Auto-sync**: Automatically sync sessions at regular intervals
   - **Harvest on startup**: Collect new sessions when opening a project
   - **Show notifications**: Display notifications for harvest/sync operations

## Usage

### Tool Window

The IronBridge tool window provides a central interface for managing sessions:

1. Open **View** → **Tool Windows** → **IronBridge**
2. Browse your sessions in the list
3. Use the search bar to filter sessions
4. Click **Harvest** to collect new sessions
5. Click **Sync** to synchronize with the server

### Actions

Access IronBridge actions from:
- **Tools** → **IronBridge** menu
- Right-click context menu (for code-related actions)
- Keyboard shortcuts (customizable)

Available actions:
- **Harvest Sessions**: Collect sessions from AI providers
- **Search Sessions**: Open search dialog
- **Sync Sessions**: Synchronize with server
- **Settings**: Open IronBridge settings
- **Save to Session**: Save selected code to a session

### Keyboard Shortcuts

Configure shortcuts in **Settings** → **Keymap** → search for "IronBridge"

## Requirements

- JetBrains IDE 2023.3 or later
- IronBridge server running (default: localhost:8787)
- Java 17 or later

## Development

### Building

```bash
./gradlew build
```

### Running in development

```bash
./gradlew runIde
```

### Testing

```bash
./gradlew test
```

## Architecture

```
jetbrains-plugin/
├── src/main/kotlin/io/ironbridge/plugin/
│   ├── actions/           # Action handlers
│   │   ├── HarvestAction.kt
│   │   ├── SearchAction.kt
│   │   ├── SyncAction.kt
│   │   ├── OpenSettingsAction.kt
│   │   └── SaveToSessionAction.kt
│   ├── services/          # Application and project services
│   │   ├── IronBridgeService.kt        # HTTP client
│   │   └── IronBridgeProjectService.kt # Project-level service
│   ├── settings/          # Plugin settings
│   │   ├── IronBridgeSettings.kt
│   │   └── IronBridgeSettingsConfigurable.kt
│   └── ui/               # UI components
│       ├── IronBridgeToolWindowFactory.kt
│       └── IronBridgeToolWindowPanel.kt
├── src/main/resources/
│   └── META-INF/
│       └── plugin.xml    # Plugin descriptor
└── build.gradle.kts      # Build configuration
```

## API Integration

The plugin communicates with the IronBridge server via HTTP REST API:

| Endpoint             | Method | Description         |
| -------------------- | ------ | ------------------- |
| `/health`            | GET    | Check server health |
| `/api/workspaces`    | GET    | List workspaces     |
| `/api/sessions`      | GET    | List sessions       |
| `/api/sessions/{id}` | GET    | Get session details |
| `/api/search`        | GET    | Search sessions     |
| `/api/harvest`       | POST   | Trigger harvest     |
| `/api/stats`         | GET    | Get statistics      |

## License

Apache License 2.0

Copyright (c) 2024-2027 Nervosys LLC

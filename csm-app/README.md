# CSM Mobile App

Cross-platform mobile app for Chat Session Manager (CSM). View and search your AI chat sessions from any device.

## Features

- 📱 **Cross-platform**: iOS, Android, and Web support via Expo
- 🗂️ **Workspaces**: Browse sessions organized by workspace/project
- 💬 **Sessions**: View all chat sessions with full conversation history
- 🔍 **Search**: Full-text search across all sessions
- 📊 **Statistics**: Session counts by provider, total messages
- 🔄 **Pull-to-refresh**: Real-time data synchronization

## Screenshots

| Workspaces        | Sessions          | Search               | Settings     |
| ----------------- | ----------------- | -------------------- | ------------ |
| Browse workspaces | View all sessions | Search conversations | Stats & info |

## Tech Stack

- **React Native** with **Expo** for cross-platform development
- **TypeScript** for type safety
- **React Navigation** for routing (stack + bottom tabs)
- **TanStack Query** (React Query) for data fetching & caching
- **Axios** for HTTP requests
- **Expo Vector Icons** (Ionicons)

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI (`npx expo`)
- CSM API server running on `localhost:8787`

## Getting Started

### 1. Install dependencies

```bash
cd csm-app
npm install
```

### 2. Start the CSM API server

```bash
# From csm-rust directory
cargo run --bin csm -- api serve
```

### 3. Run the app

```bash
# Start Expo development server
npm start

# Or run directly on platform:
npm run web      # Web browser
npm run ios      # iOS Simulator (macOS only)
npm run android  # Android Emulator
```

## Project Structure

```
csm-app/
├── App.tsx                 # Main entry point
├── src/
│   ├── api/
│   │   ├── client.ts       # Axios instance with interceptors
│   │   ├── sessions.ts     # API functions & types
│   │   └── index.ts
│   ├── navigation/
│   │   ├── AppNavigator.tsx # Tab + Stack navigation
│   │   ├── types.ts        # Navigation param types
│   │   └── index.ts
│   └── screens/
│       ├── WorkspacesScreen.tsx
│       ├── SessionsScreen.tsx
│       ├── SessionDetailScreen.tsx
│       ├── WorkspaceSessionsScreen.tsx
│       ├── SearchScreen.tsx
│       ├── SettingsScreen.tsx
│       └── index.ts
├── app.json                # Expo configuration
├── package.json
└── tsconfig.json
```

## API Configuration

The app connects to the CSM API server. The base URL is configured in `src/api/client.ts`:

| Platform         | API URL                 |
| ---------------- | ----------------------- |
| Web              | `http://localhost:8787` |
| iOS Simulator    | `http://localhost:8787` |
| Android Emulator | `http://10.0.2.2:8787`  |

For physical devices, update the URL to your machine's IP address.

## Available Scripts

| Command           | Description                   |
| ----------------- | ----------------------------- |
| `npm start`       | Start Expo development server |
| `npm run web`     | Run in web browser            |
| `npm run ios`     | Run on iOS Simulator          |
| `npm run android` | Run on Android Emulator       |
| `npm run lint`    | Run ESLint                    |

## Building for Production

### Web

```bash
npx expo export --platform web
```

### iOS (requires macOS + Xcode)

```bash
npx expo run:ios --configuration Release
```

### Android

```bash
npx expo run:android --variant release
```

### EAS Build (recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure builds
eas build:configure

# Build for all platforms
eas build --platform all
```

## API Endpoints Used

| Endpoint                   | Description                  |
| -------------------------- | ---------------------------- |
| `GET /api/workspaces`      | List all workspaces          |
| `GET /api/workspaces/:id`  | Get workspace details        |
| `GET /api/sessions`        | List sessions (with filters) |
| `GET /api/sessions/:id`    | Get session with messages    |
| `GET /api/sessions/search` | Search sessions              |
| `GET /api/providers`       | List connected providers     |
| `GET /api/stats`           | Database statistics          |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file in the root directory.

# Chasm Desktop

Native desktop application for Chat Session Manager built with Tauri (Rust + WebView).

## Features

- 🖥️ **Native Performance** - Rust backend with system WebView (no Chromium)
- 📦 **Small Binary** - ~10MB vs 150MB+ for Electron apps
- 🔒 **Secure** - Sandboxed WebView with explicit permission model
- 🖱️ **System Tray** - Minimize to tray, quick access menu
- 🔔 **Notifications** - Native OS notifications
- 📋 **Clipboard** - Full clipboard integration
- 📁 **File System** - Native file dialogs and access

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 18+
- Platform-specific dependencies:
  - **Windows**: Visual Studio Build Tools with C++ workload
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `webkit2gtk-4.1`, `libayatana-appindicator3-dev`

## Development

```bash
# Install dependencies
npm install

# Start dev server (hot-reload)
npm run dev

# Or use cargo directly
cargo tauri dev
```

## Build

```bash
# Build release binary
npm run build

# Output locations:
# Windows: target/release/chasm-desktop.exe
# macOS:   target/release/bundle/macos/Chasm.app
# Linux:   target/release/bundle/appimage/chasm-desktop.AppImage
```

## Architecture

```bash
chasm-desktop/
├── src/
│   ├── main.rs         # Tauri app entry, tray, window management
│   └── commands.rs     # Rust commands callable from frontend
├── icons/              # Generated app icons (all platforms)
├── Cargo.toml          # Rust dependencies
├── tauri.conf.json     # Tauri configuration
└── package.json        # npm scripts
```

### Frontend

Uses chasm-web as the frontend:
- Dev: Connects to Vite dev server at `localhost:5173`
- Prod: Bundles `chasm-web/dist` into the binary

### Tauri Commands

```typescript
// Get app info
const info = await invoke('get_app_info');

// Check API health
const health = await invoke('check_api_health', { apiUrl: 'http://localhost:8787' });

// Minimize to tray
await invoke('minimize_to_tray');
```

## Configuration

Edit `tauri.conf.json` for:
- Window size/behavior
- Bundle settings (icons, installer)
- Security policies (CSP)
- Plugin permissions

## License

Copyright 2025 Nervosys LLC

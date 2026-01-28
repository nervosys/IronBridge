# Screenshots for Chasm Sales Presentation

Place the following screenshots in this directory:

## Required Screenshots

| Filename                | Description                          | Source                     | Dimensions |
| ----------------------- | ------------------------------------ | -------------------------- | ---------- |
| `cli-output.png`        | CLI showing `chasm show path` output | Terminal                   | 1200x600   |
| `web-dashboard.png`     | Web app dashboard with sessions      | chasm-web (localhost:5173) | 1200x700   |
| `desktop-app.png`       | Desktop app window                   | chasm-desktop              | 1200x700   |
| `mobile-workspaces.png` | Mobile app workspaces screen         | chasm-app / Expo           | 400x800    |
| `mobile-search.png`     | Mobile app search screen             | chasm-app / Expo           | 400x800    |
| `vscode-sidebar.png`    | VS Code with Chasm sidebar           | VS Code                    | 1200x700   |

## Capture Instructions

### CLI Screenshot
```bash
# Run this command and screenshot the terminal
chasm show path /project/example
```

### Web App
```bash
cd chasm-web
pnpm dev
# Navigate to http://localhost:5173
# Screenshot the dashboard
```

### Desktop App  
```bash
cd chasm-desktop
pnpm tauri dev
# Screenshot the main window
```

### Mobile App
```bash
cd chasm-app
npx expo start
# Use iOS Simulator or Android Emulator
# Screenshot workspaces and search screens
```

### VS Code Extension
1. Install the extension in VS Code
2. Open the Chasm sidebar
3. Screenshot the full window

## Image Requirements

- Format: PNG (preferred) or JPG
- Dark theme matching presentation (#0a0a0a background)
- No personal/sensitive data visible
- Clean, representative state

# IronBridge Browser Extension

A Chrome/Firefox extension for capturing and managing AI chat sessions from web-based AI tools.

## Features

- **One-click export** - Export current chat session to IronBridge
- **Multi-provider support** - Works with ChatGPT, Claude, Gemini, Copilot, Poe, Perplexity
- **Context menu integration** - Right-click to export or save selections
- **Auto-harvest** - Optionally auto-sync sessions on a schedule
- **Markdown conversion** - Copy conversations as formatted markdown

## Supported Providers

| Provider   | Status  | Notes                        |
| ---------- | ------- | ---------------------------- |
| ChatGPT    | ✅ Full  | chat.openai.com, chatgpt.com |
| Claude     | ✅ Full  | claude.ai                    |
| Gemini     | ✅ Full  | gemini.google.com            |
| Copilot    | 🔄 Basic | copilot.microsoft.com        |
| Poe        | 🔄 Basic | poe.com                      |
| Perplexity | 🔄 Basic | perplexity.ai                |

## Installation

### Chrome Web Store (Recommended)

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-blue?logo=googlechrome)](https://chrome.google.com/webstore)

> Store listing pending review. Manual install available below.

### Firefox Add-ons

[![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-Install-orange?logo=firefox)](https://addons.mozilla.org)

> Store listing pending review. Manual install available below.

### Manual Installation (Development)

**Chrome / Edge / Brave:**

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `browser-extension` folder

**Firefox:**

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.firefox.json` from the `browser-extension` folder

## Usage

### Quick Export
1. Navigate to a supported AI chat (e.g., chat.openai.com)
2. Click the IronBridge extension icon in your toolbar
3. Click "Export Current" to save the conversation

### Context Menu
- Right-click on any AI chat page and select "Export to IronBridge"
- Select text and right-click to "Save selection to IronBridge"
- Select text and right-click to "Copy as Markdown"

### Settings
Click the gear icon in the popup or right-click the extension icon and select "Options" to configure:

- **API URL** - Your IronBridge server address (default: http://localhost:8787)
- **Auto Harvest** - Enable periodic session syncing
- **Notifications** - Toggle browser notifications
- **Providers** - Select which AI providers to monitor

## Requirements

- IronBridge API server running (default: http://localhost:8787)
- Chrome 88+ or Firefox 89+ (Manifest V3 support)

## Development

### Project Structure

```
browser-extension/
├── manifest.json              # Chrome Manifest V3
├── manifest.firefox.json      # Firefox Manifest V2
├── build.ps1                  # Build & package script
├── PRIVACY_POLICY.md          # Privacy policy (required for stores)
├── STORE_LISTING.md           # Store listing metadata
├── background/
│   └── service-worker.js      # Background script
├── content/
│   ├── chatgpt.js             # ChatGPT content script
│   ├── claude.js              # Claude content script
│   ├── gemini.js              # Gemini content script
│   ├── copilot.js             # Copilot content script
│   ├── poe.js                 # Poe content script
│   ├── perplexity.js          # Perplexity content script
│   └── styles.css             # Injected styles
├── popup/
│   ├── popup.html             # Popup UI
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup logic
├── options/
│   ├── options.html           # Settings page
│   ├── options.css            # Settings styles
│   └── options.js             # Settings logic
├── icons/
│   ├── icon.svg               # Source icon (SVG)
│   ├── icon16.png             # 16×16 (generated)
│   ├── icon32.png             # 32×32 (generated)
│   ├── icon48.png             # 48×48 (generated)
│   └── icon128.png            # 128×128 (generated)
└── dist/                      # Build output (gitignored)
    ├── ironbridge-chrome.zip
    └── ironbridge-firefox.zip
```

## Building for Store Submission

1. Generate PNG icons from SVG:
   ```powershell
   ./build.ps1 -GenerateIcons
   ```

2. Package for both stores:
   ```powershell
   ./build.ps1 -Target all
   ```

3. Or build for a specific store:
   ```powershell
   ./build.ps1 -Target chrome
   ./build.ps1 -Target firefox
   ```

Output files:
- `dist/ironbridge-chrome.zip` — Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- `dist/ironbridge-firefox.zip` — Upload to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)

## Permissions

This extension requires the following permissions:

- **storage** - Save settings and cache
- **activeTab** - Access current tab for export
- **scripting** - Inject content scripts
- **contextMenus** - Right-click menu integration
- **notifications** - Show status notifications
- **host_permissions** - Access to supported AI chat sites

## Privacy

- All data is stored locally or sent to your self-hosted IronBridge server
- No data is sent to third parties
- No analytics or tracking
- See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for the full privacy policy

## License

AGPL-3.0-only — Copyright 2025-2026 Nervosys LLC

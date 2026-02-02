# Chasm Browser Extension

A Chrome/Firefox extension for capturing and managing AI chat sessions from web-based AI tools.

## Features

- **One-click export** - Export current chat session to Chasm
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
*Coming soon*

### Manual Installation (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `browser-extension` folder

### Firefox
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` from the `browser-extension` folder

## Usage

### Quick Export
1. Navigate to a supported AI chat (e.g., chat.openai.com)
2. Click the Chasm extension icon in your toolbar
3. Click "Export Current" to save the conversation

### Context Menu
- Right-click on any AI chat page and select "Export to Chasm"
- Select text and right-click to "Save selection to Chasm"
- Select text and right-click to "Copy as Markdown"

### Settings
Click the gear icon in the popup or right-click the extension icon and select "Options" to configure:

- **API URL** - Your Chasm server address (default: http://localhost:8787)
- **Auto Harvest** - Enable periodic session syncing
- **Notifications** - Toggle browser notifications
- **Providers** - Select which AI providers to monitor

## Requirements

- Chasm API server running (default: http://localhost:8787)
- Chrome 88+ or Firefox 89+ (Manifest V3 support)

## Development

### Project Structure

```
browser-extension/
├── manifest.json          # Extension manifest
├── background/
│   └── service-worker.js  # Background script
├── content/
│   ├── chatgpt.js         # ChatGPT content script
│   ├── claude.js          # Claude content script
│   ├── gemini.js          # Gemini content script
│   └── styles.css         # Injected styles
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── options/
│   ├── options.html       # Settings page
│   ├── options.css        # Settings styles
│   └── options.js         # Settings logic
└── icons/
    └── icon.svg           # Extension icon
```

### Building for Production

1. Generate PNG icons from SVG:
   ```bash
   # Using ImageMagick
   convert -background none icons/icon.svg -resize 16x16 icons/icon16.png
   convert -background none icons/icon.svg -resize 32x32 icons/icon32.png
   convert -background none icons/icon.svg -resize 48x48 icons/icon48.png
   convert -background none icons/icon.svg -resize 128x128 icons/icon128.png
   ```

2. Package the extension:
   ```bash
   # Chrome
   zip -r chasm-extension.zip . -x "*.git*" "*.md"
   
   # Firefox
   web-ext build
   ```

## Permissions

This extension requires the following permissions:

- **storage** - Save settings and cache
- **activeTab** - Access current tab for export
- **scripting** - Inject content scripts
- **contextMenus** - Right-click menu integration
- **notifications** - Show status notifications
- **host_permissions** - Access to supported AI chat sites

## Privacy

- All data is stored locally or sent to your self-hosted Chasm server
- No data is sent to third parties
- No analytics or tracking

## License

MIT License - Copyright 2025-2026 Nervosys LLC

# Store Listing — Chasm Browser Extension

> Reference document for Chrome Web Store and Firefox Add-on Store submissions.

---

## Chrome Web Store

### Extension Name

Chasm — Chat Session Manager

### Summary (132 chars max)

Capture, export, and manage your AI chat sessions from ChatGPT, Claude, Gemini, Copilot, and more. Self-hosted, private by design.

### Description

Chasm is a privacy-first browser extension that lets you capture and manage your AI chat sessions from popular web-based AI tools.

**Key Features:**
• One-click session export — Save any AI conversation with a single click
• Multi-provider support — Works with ChatGPT, Claude, Gemini, Copilot, Poe, and Perplexity
• Context menu integration — Right-click to export sessions or copy as Markdown
• Auto-harvest — Optionally auto-sync your sessions on a schedule
• Markdown conversion — Copy conversations as formatted Markdown
• Self-hosted — All data stays on your machine or your own server

**Supported AI Providers:**
• ChatGPT (chat.openai.com, chatgpt.com)
• Claude (claude.ai)
• Google Gemini (gemini.google.com)
• Microsoft Copilot (copilot.microsoft.com)
• Poe (poe.com)
• Perplexity (perplexity.ai)

**Privacy First:**
Chasm sends your data only to your self-hosted Chasm API server (default: localhost). No analytics, no tracking, no third-party data sharing. You own your data.

**Open Source:**
Chasm is fully open source under the AGPL-3.0-only license. Review the code, contribute, or self-host.

Learn more: https://github.com/nervosys/chasm

### Category

Productivity

### Language

English

### Website

https://github.com/nervosys/chasm

### Support URL

https://github.com/nervosys/chasm/issues

### Privacy Policy URL

https://github.com/nervosys/chasm/blob/master/browser-extension/PRIVACY_POLICY.md

---

## Firefox Add-on Store

### Add-on Name

Chasm — Chat Session Manager

### Summary (250 chars max)

Capture and manage AI chat sessions from ChatGPT, Claude, Gemini, Copilot, Poe, and Perplexity. Export conversations, auto-harvest sessions, and copy as Markdown. Self-hosted, open source, privacy-first. Your data stays on your machine.

### Description

(Same as Chrome Web Store description above)

### Category

Privacy & Security

### Tags

ai, chat, export, privacy, session-manager, chatgpt, claude, productivity

### License

AGPL-3.0-only

### Homepage

https://github.com/nervosys/chasm

### Support Email

support@nervosys.com

### Support URL

https://github.com/nervosys/chasm/issues

---

## Screenshots Guidance

Prepare the following screenshots for store submission (1280×800 or 640×400 recommended):

1. **Popup UI** — Show the extension popup on a ChatGPT page with connection status active
2. **Export in Action** — Demonstrate one-click export with a success notification
3. **Context Menu** — Show the right-click context menu with Chasm options
4. **Settings Page** — Display the options/settings panel with configuration fields
5. **Multi-Provider** — Show the extension working on Claude or Gemini to demonstrate breadth

### Promotional Tile (440×280)

Include the Chasm logo, tagline "Capture Your AI Conversations," and a preview of the popup UI.

---

## Review Notes for Store Reviewers

- The extension requires a local Chasm API server running at the configured URL (default: http://localhost:8787) to function fully. Without the server, the extension will show "Disconnected" status but will not error.
- All network requests go exclusively to the user-configured API URL. No external services are contacted.
- The extension uses Manifest V3 (Chrome) / Manifest V2 (Firefox).
- Content scripts are injected only on the specific AI chat sites listed in the manifest.
- The `host_permissions` are limited to the supported AI provider domains plus localhost.

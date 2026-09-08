# Privacy Policy — IronBridge Browser Extension

**Last Updated:** February 10, 2026
**Extension Name:** IronBridge — Chat Session Manager
**Publisher:** Nervosys LLC

## Overview

The IronBridge browser extension ("Extension") is designed to help you capture and manage your AI chat sessions from supported web-based AI tools. We are committed to protecting your privacy. This policy explains what data the Extension handles and how.

## Data Collection

**We do not collect, transmit, or store any of your personal data on external servers.**

The Extension does not:

- Track your browsing activity
- Send analytics or telemetry data to any third party
- Collect personally identifiable information (PII)
- Use cookies for tracking purposes
- Share any data with advertisers or data brokers

## Data Handling

### What the Extension Accesses

The Extension accesses content on the following supported AI chat websites only when you are actively using them:

- `chat.openai.com` / `chatgpt.com` (ChatGPT)
- `claude.ai` (Anthropic Claude)
- `gemini.google.com` (Google Gemini)
- `copilot.microsoft.com` (Microsoft Copilot)
- `poe.com` (Poe)
- `perplexity.ai` / `www.perplexity.ai` (Perplexity)

### How Data Is Used

- **Session export:** When you explicitly click "Export" or "Harvest," the Extension reads the chat conversation from the current page and sends it to **your self-hosted IronBridge API server** (default: `http://localhost:8787`).
- **Local storage:** Extension settings (API URL, auto-harvest preferences, notification preferences) are stored locally in your browser using the `chrome.storage.local` API.
- **Auto-harvest:** If enabled by you, the Extension will periodically request your local IronBridge server to harvest sessions. No data leaves your network.

### Where Data Goes

All exported session data is sent exclusively to the IronBridge API server URL that **you** configure. By default, this is `http://localhost:8787` — your own machine. The Extension never sends data to Nervosys servers or any other third party.

## Permissions Explained

| Permission       | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `storage`        | Save your extension settings locally                   |
| `activeTab`      | Access the current tab to read chat content on export   |
| `scripting`      | Inject content scripts into supported AI chat pages     |
| `contextMenus`   | Add right-click menu options for quick export           |
| `notifications`  | Show status notifications (e.g., "Export complete")     |
| `alarms`         | Schedule auto-harvest intervals                        |
| `host_permissions` | Access supported AI chat sites listed above            |

## Third-Party Services

The Extension does **not** integrate with or send data to any third-party services, APIs, or analytics platforms. The only network requests made are to your configured IronBridge API server.

## Data Retention

- **Local storage:** Settings persist until you uninstall the Extension or clear browser data.
- **Exported sessions:** Stored on your IronBridge server under your control. Retention is determined by your server configuration.

## Children's Privacy

The Extension is not directed at children under 13 and does not knowingly collect data from children.

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be reflected by updating the "Last Updated" date above. Continued use of the Extension after changes constitutes acceptance.

## Open Source

The IronBridge browser extension is open source under the AGPL-3.0-only license. You can review the complete source code at:

- **Repository:** [github.com/nervosys/IronBridge](https://github.com/nervosys/IronBridge)

## Contact

If you have questions about this Privacy Policy, please contact:

- **Email:** privacy@nervosys.com
- **GitHub:** [github.com/nervosys/IronBridge/issues](https://github.com/nervosys/IronBridge/issues)

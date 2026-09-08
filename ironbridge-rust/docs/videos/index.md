# Video Tutorials

Programmatic video tutorials built with [Remotion](https://remotion.dev/), rendered as React components.

## Available Videos

| Video                | Duration | Description                                         |
| -------------------- | -------- | --------------------------------------------------- |
| **Getting Started**  | ~90s     | Overview of IronBridge, installation, and first commands |
| **CLI Walkthrough**  | ~120s    | Full tour of CLI commands with live terminal demos  |
| **Session Recovery** | ~90s     | Recovering lost sessions from orphaned workspaces   |
| **Provider Setup**   | ~60s     | Configuring AI providers (Ollama, Claude, Copilot)  |
| **TUI Browser**      | ~60s     | Using the interactive terminal UI                   |

## Building Videos

The video source lives in the [`videos/`](https://github.com/nervosys/ironbridge/tree/master/videos) directory at the project root.

```bash
cd videos

# Install dependencies
npm install

# Preview in Remotion Studio
npm start

# Render a specific video
npx remotion render GettingStarted out/getting-started.mp4

# Render all videos
npm run render:all
```

## Embedding

Videos are rendered to MP4 and can be embedded in documentation, GitHub README, or shared directly.

!!! tip "Customization"
    Each video is a React component — edit the source in `videos/src/compositions/` to update content, styling, or timing.

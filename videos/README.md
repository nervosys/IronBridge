# IronBridge Video Tutorials

Programmatic video tutorials for [IronBridge](https://github.com/nervosys/IronBridge), built with [Remotion](https://remotion.dev/).

## Videos

| Composition       | Description                                       |
| ----------------- | ------------------------------------------------- |
| `GettingStarted`  | Overview, installation, and first commands        |
| `CLIWalkthrough`  | Full tour of CLI commands with terminal demos     |
| `SessionRecovery` | Recovering lost sessions from orphaned workspaces |
| `ProviderSetup`   | Configuring AI providers                          |
| `TUIBrowser`      | Interactive terminal UI walkthrough               |

## Setup

```bash
npm install
```

## Development

Preview compositions in [Remotion Studio](https://www.remotion.dev/docs/studio):

```bash
npm start
```

## Rendering

Render a single video:

```bash
npx remotion render GettingStarted out/getting-started.mp4
```

Render all videos:

```bash
npm run render:all
```

## Project Structure

```
src/
  index.ts              # Remotion entry point
  Root.tsx               # Composition registry
  constants.ts           # Colors, fonts, dimensions
  components/
    shared.tsx           # Reusable components (Terminal, Logo, etc.)
  compositions/
    GettingStarted.tsx   # Getting started tutorial
    CLIWalkthrough.tsx   # CLI command tour
    SessionRecovery.tsx  # Session recovery workflow
    ProviderSetup.tsx    # Provider configuration
    TUIBrowser.tsx       # TUI interactive browser
```

## Customization

Each video is a React component. Edit compositions in `src/compositions/` to update content, timing, or styling. The shared theme in `src/constants.ts` matches the IronBridge MkDocs Abyss dark theme.

// Chasm video constants — shared across all compositions

// Video dimensions (1080p landscape)
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;

// Branding colors (matching MkDocs Abyss theme)
export const COLORS = {
  bg: "#010408",
  bgCard: "#0d1117",
  bgTerminal: "#0a0e14",
  primary: "#00d4ff",
  secondary: "#7c3aed",
  accent: "#00c9a7",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDim: "#484f58",
  success: "#3fb950",
  warning: "#d29922",
  error: "#f85149",
  border: "#21262d",
  white: "#ffffff",
} as const;

// Typography
export const FONTS = {
  heading: "Inter, system-ui, sans-serif",
  code: "JetBrains Mono, Fira Code, Consolas, monospace",
} as const;

// Composition durations (in frames at 30fps)
export const DURATIONS = {
  gettingStarted: 90 * VIDEO_FPS, // 90s
  cliWalkthrough: 120 * VIDEO_FPS, // 120s
  sessionRecovery: 90 * VIDEO_FPS, // 90s
  providerSetup: 60 * VIDEO_FPS, // 60s
  tuiBrowser: 60 * VIDEO_FPS, // 60s
} as const;

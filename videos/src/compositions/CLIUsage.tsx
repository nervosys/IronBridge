import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  Background,
  Logo,
  TitleSlide,
  Terminal,
  SectionBadge,
  FeatureCard,
  OutroSlide,
} from "../components/shared";
import { COLORS, VIDEO_FPS } from "../constants";

/**
 * CLIUsage — A concise usage video for the chasm-cli README.
 *
 * Scenes (total ≈ 60s):
 *   0–4s    Intro / title
 *   4–10s   Install + version check
 *  10–18s   Discover workspaces & sessions
 *  18–28s   Harvest from all providers
 *  28–38s   Recover & register lost sessions
 *  38–48s   Export, search & stats
 *  48–54s   Provider matrix overview
 *  54–60s   Outro / CTA
 */
export const CLIUsage: React.FC = () => {
  return (
    <Background>
      {/* ── Intro ────────────────────────────────────────────────── */}
      <Sequence from={0} durationInFrames={4 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <Logo size={72} />
          <TitleSlide
            title="Chasm CLI Usage"
            subtitle="Never lose an AI conversation again"
          />
        </AbsoluteFill>
      </Sequence>

      {/* ── 1. Install ───────────────────────────────────────────── */}
      <Sequence from={4 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={1} label="Install" />
          <Terminal
            title="bash — Install & verify"
            startFrame={10}
            lines={[
              { prompt: true, text: "cargo install chasm-cli", delay: 0 },
              {
                text: "  Installing chasm-cli v1.3.2",
                color: COLORS.textMuted,
                delay: 20,
              },
              {
                text: "  Compiling chasm-cli v1.3.2",
                color: COLORS.textMuted,
                delay: 35,
              },
              {
                text: "   Installed chasm-cli v1.3.2",
                color: COLORS.success,
                delay: 55,
              },
              { text: "", delay: 65 },
              { prompt: true, text: "chasm --version", delay: 70 },
              {
                text: "chasm 1.3.2",
                color: COLORS.primary,
                delay: 90,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ── 2. Discover ──────────────────────────────────────────── */}
      <Sequence from={10 * VIDEO_FPS} durationInFrames={8 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={2} label="Discover" />
          <Terminal
            title="bash — Find workspaces & sessions"
            startFrame={10}
            lines={[
              { prompt: true, text: "chasm list workspaces", delay: 0 },
              {
                text: "┌────────────────────────┬──────────────────┬──────────┐",
                color: COLORS.textDim,
                delay: 20,
              },
              {
                text: "│ Name                   │ Provider         │ Sessions │",
                color: COLORS.textDim,
                delay: 22,
              },
              {
                text: "├────────────────────────┼──────────────────┼──────────┤",
                color: COLORS.textDim,
                delay: 24,
              },
              {
                text: "│ IronWorks              │ GitHub Copilot   │ 9        │",
                color: COLORS.text,
                delay: 26,
              },
              {
                text: "│ my-web-app             │ Cursor           │ 14       │",
                color: COLORS.text,
                delay: 28,
              },
              {
                text: "│ data-pipeline          │ Claude Code      │ 6        │",
                color: COLORS.text,
                delay: 30,
              },
              {
                text: "└────────────────────────┴──────────────────┴──────────┘",
                color: COLORS.textDim,
                delay: 32,
              },
              { text: "", delay: 45 },
              { prompt: true, text: "chasm show path .", delay: 55 },
              {
                text: "Current project: 9 sessions, 249 messages",
                color: COLORS.primary,
                delay: 80,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ── 3. Harvest ───────────────────────────────────────────── */}
      <Sequence from={18 * VIDEO_FPS} durationInFrames={10 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={3} label="Harvest" />
          <Terminal
            title="bash — Collect from all providers"
            startFrame={10}
            lines={[
              { prompt: true, text: "chasm harvest scan", delay: 0 },
              {
                text: "Detected providers:",
                color: COLORS.textMuted,
                delay: 20,
              },
              {
                text: "  ✓ GitHub Copilot   (VS Code)",
                color: COLORS.success,
                delay: 28,
              },
              {
                text: "  ✓ Cursor           (Cursor IDE)",
                color: COLORS.success,
                delay: 34,
              },
              {
                text: "  ✓ Claude Code      (CLI)",
                color: COLORS.success,
                delay: 40,
              },
              {
                text: "  ✓ Ollama           (Local)",
                color: COLORS.success,
                delay: 46,
              },
              {
                text: "Sessions available: 1,847",
                color: COLORS.primary,
                delay: 56,
              },
              { text: "", delay: 68 },
              { prompt: true, text: "chasm harvest run", delay: 78 },
              {
                text: "Harvesting ████████████████████ 100%",
                color: COLORS.accent,
                delay: 100,
              },
              {
                text: "Stored 1,847 sessions in chat_sessions.db",
                color: COLORS.success,
                delay: 120,
              },
              { text: "", delay: 130 },
              {
                prompt: true,
                text: "chasm harvest search \"authentication flow\"",
                delay: 140,
              },
              {
                text: "Found 7 sessions matching 'authentication flow'",
                color: COLORS.primary,
                delay: 170,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ── 4. Recover ───────────────────────────────────────────── */}
      <Sequence from={28 * VIDEO_FPS} durationInFrames={10 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={4} label="Recover" />
          <Terminal
            title="bash — Recover lost sessions"
            startFrame={10}
            lines={[
              {
                prompt: true,
                text: "chasm detect orphaned /proj/IronWorks",
                delay: 0,
              },
              {
                text: "Found 8 orphaned sessions in 2 old workspace hashes",
                color: COLORS.warning,
                delay: 25,
              },
              { text: "", delay: 38 },
              {
                prompt: true,
                text: "chasm detect orphaned --recover /proj/IronWorks",
                delay: 48,
              },
              {
                text: "[OK] Copied 8 sessions to active workspace",
                color: COLORS.success,
                delay: 75,
              },
              { text: "", delay: 88 },
              {
                prompt: true,
                text: "chasm register all --path /proj/IronWorks --close-vscode --reopen",
                delay: 98,
              },
              {
                text: "[OK] Closed VS Code (saved state)",
                color: COLORS.success,
                delay: 120,
              },
              {
                text: "[OK] Registered 8 sessions in index",
                color: COLORS.success,
                delay: 135,
              },
              {
                text: "[OK] Reopened VS Code",
                color: COLORS.success,
                delay: 150,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ── 5. Export & Stats ─────────────────────────────────────── */}
      <Sequence from={38 * VIDEO_FPS} durationInFrames={10 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={5} label="Export & Analyze" />
          <Terminal
            title="bash — Export and insights"
            startFrame={10}
            lines={[
              {
                prompt: true,
                text: "chasm export session ac554459 --format markdown",
                delay: 0,
              },
              {
                text: "Exported 249 messages → session_ac554459.md",
                color: COLORS.success,
                delay: 28,
              },
              { text: "", delay: 40 },
              {
                prompt: true,
                text: "chasm export batch ./backup /proj1 /proj2",
                delay: 50,
              },
              {
                text: "Exported 47 sessions to ./backup/",
                color: COLORS.success,
                delay: 78,
              },
              { text: "", delay: 90 },
              { prompt: true, text: "chasm harvest status", delay: 100 },
              {
                text: "Database: chat_sessions.db (23 MB)",
                color: COLORS.text,
                delay: 118,
              },
              {
                text: "Sessions: 1,847  Messages: 19,068",
                color: COLORS.primary,
                delay: 126,
              },
              {
                text: "Providers: 4  Workspaces: 138",
                color: COLORS.primary,
                delay: 134,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* ── 6. Provider Matrix ────────────────────────────────────── */}
      <Sequence from={48 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            padding: "0 100px",
          }}
        >
          <SectionBadge number={6} label="20 Providers Supported" />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
              marginTop: 16,
            }}
          >
            {[
              { icon: "🤖", title: "GitHub Copilot" },
              { icon: "📝", title: "Cursor" },
              { icon: "🌊", title: "Windsurf" },
              { icon: "🧠", title: "Claude Code" },
              { icon: "🔮", title: "Continue" },
              { icon: "🦙", title: "Ollama" },
              { icon: "💬", title: "ChatGPT" },
              { icon: "🗂️", title: "LM Studio" },
              { icon: "🛠️", title: "OpenCode" },
              { icon: "🐉", title: "OpenClaw" },
            ].map((p, i) => (
              <FeatureCard
                key={p.title}
                icon={p.icon}
                title={p.title}
                description=""
                startFrame={10}
                index={i}
              />
            ))}
          </div>
          <div
            style={{
              fontSize: 22,
              color: COLORS.textMuted,
              marginTop: 8,
            }}
          >
            + Antigravity, Gemini CLI, Jan, GPT4All, vLLM, LocalAI,
            text-gen-webui, llamafile, Codex CLI, Droid CLI
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* ── Outro ─────────────────────────────────────────────────── */}
      <Sequence from={54 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <OutroSlide />
      </Sequence>
    </Background>
  );
};

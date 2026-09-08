import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  Background,
  Logo,
  TitleSlide,
  Terminal,
  SectionBadge,
  OutroSlide,
} from "../components/shared";
import { COLORS, VIDEO_FPS } from "../constants";

export const CLIWalkthrough: React.FC = () => {
  return (
    <Background>
      {/* Intro */}
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
          <Logo size={64} />
          <TitleSlide
            title="CLI Walkthrough"
            subtitle="Every command at your fingertips"
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 1: List & Find */}
      <Sequence from={4 * VIDEO_FPS} durationInFrames={8 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={1} label="List & Discover" />
          <Terminal
            title="bash — Browse sessions"
            startFrame={10}
            lines={[
              { prompt: true, text: "ironbridge list workspaces", delay: 0 },
              {
                text: "Found 42 workspaces",
                color: COLORS.primary,
                delay: 25,
              },
              { text: "", delay: 30 },
              { prompt: true, text: "ironbridge list sessions --all-providers", delay: 40 },
              {
                text: "1,722 sessions across Copilot, Cursor, Claude Code",
                color: COLORS.primary,
                delay: 65,
              },
              { text: "", delay: 75 },
              { prompt: true, text: "ironbridge show path .", delay: 85 },
              {
                text: "Current project: 8 sessions, 241 messages",
                color: COLORS.text,
                delay: 110,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 2: Export & Import */}
      <Sequence from={12 * VIDEO_FPS} durationInFrames={8 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={2} label="Export & Import" />
          <Terminal
            title="bash — Data portability"
            startFrame={10}
            lines={[
              {
                prompt: true,
                text: "ironbridge export session abc123 --format markdown",
                delay: 0,
              },
              {
                text: "Exported to session_abc123.md (28 messages)",
                color: COLORS.success,
                delay: 30,
              },
              { text: "", delay: 40 },
              {
                prompt: true,
                text: "ironbridge export batch ./backup /proj1 /proj2 /proj3",
                delay: 50,
              },
              {
                text: "Exported 47 sessions to ./backup/",
                color: COLORS.success,
                delay: 80,
              },
              { text: "", delay: 90 },
              {
                prompt: true,
                text: "ironbridge import ./backup/session.json",
                delay: 100,
              },
              {
                text: "Imported 1 session (28 messages)",
                color: COLORS.success,
                delay: 125,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 3: Harvest */}
      <Sequence from={20 * VIDEO_FPS} durationInFrames={8 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={3} label="Harvest & Sync" />
          <Terminal
            title="bash — Unified harvesting"
            startFrame={10}
            lines={[
              { prompt: true, text: "ironbridge harvest scan", delay: 0 },
              {
                text: "Providers: copilot, cursor, claude-code, ollama",
                color: COLORS.text,
                delay: 25,
              },
              {
                text: "Sessions available: 1,847",
                color: COLORS.primary,
                delay: 35,
              },
              { text: "", delay: 45 },
              { prompt: true, text: "ironbridge harvest run", delay: 55 },
              {
                text: "Harvesting... ████████████████████ 100%",
                color: COLORS.success,
                delay: 80,
              },
              {
                text: "Stored 1,847 sessions in harvest.db",
                color: COLORS.success,
                delay: 100,
              },
              { text: "", delay: 110 },
              {
                prompt: true,
                text: 'ironbridge harvest search "react hooks"',
                delay: 120,
              },
              {
                text: "Found 14 sessions mentioning 'react hooks'",
                color: COLORS.primary,
                delay: 145,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 4: Watch & Run */}
      <Sequence from={28 * VIDEO_FPS} durationInFrames={8 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={4} label="Watch & Run" />
          <Terminal
            title="bash — Auto-harvest & agent launcher"
            startFrame={10}
            lines={[
              { prompt: true, text: "ironbridge watch --agent claude", delay: 0 },
              {
                text: "Watching Claude Code sessions for changes...",
                color: COLORS.textMuted,
                delay: 25,
              },
              {
                text: "[+] New session detected, harvesting...",
                color: COLORS.warning,
                delay: 55,
              },
              {
                text: "[✓] Harvested session (12 messages)",
                color: COLORS.success,
                delay: 75,
              },
              { text: "", delay: 90 },
              {
                prompt: true,
                text: "ironbridge run claude",
                delay: 100,
              },
              {
                text: "Launching Claude Code with auto-save enabled...",
                color: COLORS.primary,
                delay: 125,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 5: Doctor & Completions */}
      <Sequence from={36 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={5} label="Diagnostics" />
          <Terminal
            title="bash — Health check"
            startFrame={10}
            lines={[
              { prompt: true, text: "ironbridge doctor --full", delay: 0 },
              {
                text: "✓ IronBridge v1.3.2",
                color: COLORS.success,
                delay: 20,
              },
              {
                text: "✓ VS Code storage found",
                color: COLORS.success,
                delay: 30,
              },
              {
                text: "✓ Cursor storage found",
                color: COLORS.success,
                delay: 38,
              },
              {
                text: "✓ Claude Code CLI detected",
                color: COLORS.success,
                delay: 46,
              },
              {
                text: "⚠ Ollama not running (optional)",
                color: COLORS.warning,
                delay: 54,
              },
              {
                text: "✓ Git available",
                color: COLORS.success,
                delay: 62,
              },
              { text: "", delay: 70 },
              {
                text: "Results: 12 passed, 1 warning, 0 failed",
                color: COLORS.success,
                delay: 80,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Outro */}
      <Sequence from={42 * VIDEO_FPS} durationInFrames={5 * VIDEO_FPS}>
        <OutroSlide />
      </Sequence>
    </Background>
  );
};

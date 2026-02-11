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

export const SessionRecovery: React.FC = () => {
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
            title="Session Recovery"
            subtitle="Never lose a conversation again"
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 1: The Problem */}
      <Sequence from={4 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
            padding: "0 100px",
          }}
        >
          <SectionBadge number={1} label="The Problem" />
          <div
            style={{
              fontSize: 28,
              color: COLORS.textMuted,
              textAlign: "center",
              lineHeight: 1.6,
              maxWidth: 900,
              marginTop: 20,
            }}
          >
            When VS Code updates, reinstalls, or crashes — workspace hashes
            change and your chat sessions become invisible. They're still on
            disk, but VS Code can't find them anymore.
          </div>
          <div
            style={{
              fontSize: 48,
              marginTop: 10,
            }}
          >
            😱
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Section 2: Detect */}
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
          <SectionBadge number={2} label="Detect Orphans" />
          <Terminal
            title="bash — Find lost sessions"
            startFrame={10}
            lines={[
              {
                prompt: true,
                text: "chasm detect orphaned /path/to/project",
                delay: 0,
              },
              { text: "", delay: 25 },
              {
                text: "Scanning workspace hashes...",
                color: COLORS.textMuted,
                delay: 30,
              },
              {
                text: "Found 3 orphaned workspaces:",
                color: COLORS.warning,
                delay: 50,
              },
              {
                text: "  [!] abc123  (2 sessions, 47 messages)",
                color: COLORS.warning,
                delay: 60,
              },
              {
                text: "  [!] def456  (5 sessions, 183 messages)",
                color: COLORS.warning,
                delay: 70,
              },
              {
                text: "  [!] ghi789  (1 session, 12 messages)",
                color: COLORS.warning,
                delay: 80,
              },
              { text: "", delay: 90 },
              {
                text: "8 sessions at risk — run with --recover to restore",
                color: COLORS.error,
                delay: 100,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 3: Recover */}
      <Sequence from={18 * VIDEO_FPS} durationInFrames={8 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={3} label="Recover & Register" />
          <Terminal
            title="bash — Restore sessions"
            startFrame={10}
            lines={[
              {
                prompt: true,
                text: "chasm detect orphaned --recover /path/to/project",
                delay: 0,
              },
              {
                text: "Recovering 8 sessions...",
                color: COLORS.textMuted,
                delay: 30,
              },
              {
                text: "  ✓ Copied 8 sessions to active workspace",
                color: COLORS.success,
                delay: 55,
              },
              { text: "", delay: 65 },
              {
                prompt: true,
                text: "chasm register all --force --path /path/to/project",
                delay: 75,
              },
              {
                text: "Registering sessions in VS Code index...",
                color: COLORS.textMuted,
                delay: 100,
              },
              {
                text: "  ✓ Registered 8 sessions — now visible in VS Code",
                color: COLORS.success,
                delay: 120,
              },
              { text: "", delay: 130 },
              {
                text: "🎉  All sessions recovered successfully!",
                color: COLORS.primary,
                delay: 140,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Outro */}
      <Sequence from={26 * VIDEO_FPS} durationInFrames={4 * VIDEO_FPS}>
        <OutroSlide />
      </Sequence>
    </Background>
  );
};

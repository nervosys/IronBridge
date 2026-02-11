import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  Background,
  Logo,
  TitleSlide,
  Terminal,
  FeatureCard,
  SectionBadge,
  OutroSlide,
} from "../components/shared";
import { COLORS, FONTS, VIDEO_FPS } from "../constants";

export const GettingStarted: React.FC = () => {
  return (
    <Background>
      {/* Intro: Logo + Title */}
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
            title="Getting Started with Chasm"
            subtitle="Unify your AI chat sessions across every provider"
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 1: What is Chasm? */}
      <Sequence from={4 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            padding: "0 100px",
          }}
        >
          <SectionBadge number={1} label="What is Chasm?" />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              justifyContent: "center",
              marginTop: 20,
            }}
          >
            <FeatureCard
              icon="🔍"
              title="Discover"
              description="Automatically find sessions across VS Code, Cursor, Claude Code, and 15+ providers"
              startFrame={15}
              index={0}
            />
            <FeatureCard
              icon="🔄"
              title="Recover"
              description="Rescue orphaned and lost sessions from old workspaces"
              startFrame={15}
              index={1}
            />
            <FeatureCard
              icon="📊"
              title="Analyze"
              description="Search, compare, and export your conversation history"
              startFrame={15}
              index={2}
            />
            <FeatureCard
              icon="🤖"
              title="Orchestrate"
              description="Run agents, manage providers, and automate harvesting"
              startFrame={15}
              index={3}
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Section 2: Install */}
      <Sequence from={10 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={2} label="Installation" />
          <Terminal
            title="bash — Install Chasm"
            startFrame={10}
            lines={[
              { prompt: true, text: "cargo install chasm-cli", delay: 0 },
              {
                text: "    Compiling chasm-cli v1.3.2",
                color: COLORS.textMuted,
                delay: 30,
              },
              {
                text: "    Finished release target(s) in 42.3s",
                color: COLORS.success,
                delay: 50,
              },
              {
                text: "   Installed chasm-cli v1.3.2",
                color: COLORS.success,
                delay: 65,
              },
              { prompt: true, text: "chasm --version", delay: 85 },
              { text: "chasm 1.3.2", color: COLORS.primary, delay: 105 },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 3: First commands */}
      <Sequence from={16 * VIDEO_FPS} durationInFrames={8 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={3} label="First Commands" />
          <Terminal
            title="bash — Discover your sessions"
            startFrame={10}
            lines={[
              { prompt: true, text: "chasm list workspaces", delay: 0 },
              {
                text: "Found 42 workspaces across 3 providers",
                color: COLORS.primary,
                delay: 30,
              },
              { text: "", delay: 40 },
              {
                text: "  Copilot Chat    28 workspaces   1,247 sessions",
                color: COLORS.text,
                delay: 45,
              },
              {
                text: "  Cursor          11 workspaces     389 sessions",
                color: COLORS.text,
                delay: 55,
              },
              {
                text: "  Claude Code      3 workspaces      86 sessions",
                color: COLORS.text,
                delay: 65,
              },
              { text: "", delay: 75 },
              { prompt: true, text: "chasm doctor", delay: 85 },
              {
                text: "✓ System checks passed (13/13)",
                color: COLORS.success,
                delay: 110,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 4: Search */}
      <Sequence from={24 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={4} label="Search Everything" />
          <Terminal
            title="bash — Full-text search"
            startFrame={10}
            lines={[
              {
                prompt: true,
                text: 'chasm find session "authentication"',
                delay: 0,
              },
              { text: "", delay: 25 },
              {
                text: "  [copilot] Auth middleware refactor     12 msgs  Jan 15",
                color: COLORS.text,
                delay: 30,
              },
              {
                text: "  [cursor]  JWT token implementation     28 msgs  Jan 22",
                color: COLORS.text,
                delay: 40,
              },
              {
                text: "  [claude]  OAuth2 flow debugging         8 msgs  Feb 01",
                color: COLORS.text,
                delay: 50,
              },
              { text: "", delay: 60 },
              {
                text: "3 sessions found across 3 providers",
                color: COLORS.primary,
                delay: 65,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Outro */}
      <Sequence from={30 * VIDEO_FPS} durationInFrames={5 * VIDEO_FPS}>
        <OutroSlide />
      </Sequence>
    </Background>
  );
};

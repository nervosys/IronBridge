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

export const ProviderSetup: React.FC = () => {
  return (
    <Background>
      {/* Intro */}
      <Sequence from={0} durationInFrames={3 * VIDEO_FPS}>
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
            title="Provider Setup"
            subtitle="15+ AI providers, one unified interface"
          />
        </AbsoluteFill>
      </Sequence>

      {/* Section 1: Providers overview */}
      <Sequence from={3 * VIDEO_FPS} durationInFrames={6 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
          }}
        >
          <SectionBadge number={1} label="Supported Providers" />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              justifyContent: "center",
              maxWidth: 1200,
              marginTop: 10,
            }}
          >
            <FeatureCard
              icon="🤖"
              title="GitHub Copilot"
              description="VS Code Copilot Chat sessions"
              startFrame={10}
              index={0}
            />
            <FeatureCard
              icon="⚡"
              title="Cursor"
              description="Cursor IDE composer & chat"
              startFrame={10}
              index={1}
            />
            <FeatureCard
              icon="🧠"
              title="Claude Code"
              description="Anthropic's coding agent"
              startFrame={10}
              index={2}
            />
            <FeatureCard
              icon="🦙"
              title="Ollama"
              description="Local LLM inference"
              startFrame={10}
              index={3}
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Section 2: Detect & Config */}
      <Sequence from={9 * VIDEO_FPS} durationInFrames={7 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <SectionBadge number={2} label="Auto-Detection" />
          <Terminal
            title="bash — Provider management"
            startFrame={10}
            lines={[
              { prompt: true, text: "ironbridge provider list", delay: 0 },
              { text: "", delay: 20 },
              {
                text: "  ✓ copilot     VS Code Copilot Chat",
                color: COLORS.success,
                delay: 25,
              },
              {
                text: "  ✓ cursor      Cursor IDE",
                color: COLORS.success,
                delay: 33,
              },
              {
                text: "  ✓ claude-code Anthropic Claude Code",
                color: COLORS.success,
                delay: 41,
              },
              {
                text: "  ✓ ollama      Local (running)",
                color: COLORS.success,
                delay: 49,
              },
              {
                text: "  ○ lm-studio   Not detected",
                color: COLORS.textDim,
                delay: 57,
              },
              { text: "", delay: 65 },
              {
                prompt: true,
                text: "ironbridge provider test ollama",
                delay: 75,
              },
              {
                text: "✓ Ollama responding at localhost:11434",
                color: COLORS.success,
                delay: 100,
              },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Outro */}
      <Sequence from={16 * VIDEO_FPS} durationInFrames={4 * VIDEO_FPS}>
        <OutroSlide />
      </Sequence>
    </Background>
  );
};

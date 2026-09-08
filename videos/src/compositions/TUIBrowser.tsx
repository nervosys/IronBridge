import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import {
  Background,
  Logo,
  TitleSlide,
  SectionBadge,
  OutroSlide,
} from "../components/shared";
import { COLORS, FONTS, VIDEO_FPS } from "../constants";

/**
 * Mock TUI rendering component
 */
const TUIScreen: React.FC<{
  startFrame?: number;
  activeRow?: number;
  mode: "workspaces" | "sessions" | "detail";
}> = ({ startFrame = 0, activeRow = 0, mode }) => {
  const frame = useCurrentFrame();
  const f = frame - startFrame;
  if (f < 0) return null;

  const opacity = interpolate(f, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const workspaces = [
    { name: "ironbridge", sessions: 14, msgs: 847 },
    { name: "my-webapp", sessions: 8, msgs: 312 },
    { name: "rust-api", sessions: 22, msgs: 1503 },
    { name: "mobile-app", sessions: 5, msgs: 89 },
    { name: "infra-deploy", sessions: 3, msgs: 41 },
  ];

  const sessions = [
    { title: "Implement auth middleware", msgs: 28, date: "Feb 09" },
    { title: "Debug CORS issues", msgs: 12, date: "Feb 08" },
    { title: "Refactor API routes", msgs: 45, date: "Feb 07" },
    { title: "Add rate limiting", msgs: 8, date: "Feb 06" },
  ];

  return (
    <div
      style={{
        width: "85%",
        maxWidth: 1400,
        opacity,
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        fontFamily: FONTS.code,
        fontSize: 18,
      }}
    >
      {/* TUI header */}
      <div
        style={{
          background: "#161b22",
          padding: "8px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <span style={{ color: COLORS.primary, fontWeight: 700 }}>
          ◆ IronBridge TUI
        </span>
        <span style={{ color: COLORS.textDim, fontSize: 14 }}>
          Press ? for help | q to quit
        </span>
      </div>

      {/* TUI body */}
      <div
        style={{
          background: COLORS.bgTerminal,
          padding: "12px 0",
          minHeight: 400,
        }}
      >
        {mode === "workspaces" && (
          <>
            <div
              style={{
                padding: "4px 16px",
                color: COLORS.textMuted,
                fontSize: 14,
                borderBottom: `1px solid ${COLORS.border}`,
                marginBottom: 4,
              }}
            >
              Workspaces ({workspaces.length})
            </div>
            {workspaces.map((ws, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 16px",
                  background:
                    i === activeRow ? "rgba(0,212,255,0.12)" : "transparent",
                  borderLeft:
                    i === activeRow
                      ? `3px solid ${COLORS.primary}`
                      : "3px solid transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  color: i === activeRow ? COLORS.text : COLORS.textMuted,
                }}
              >
                <span>{ws.name}/</span>
                <span style={{ color: COLORS.textDim }}>
                  {ws.sessions} sessions · {ws.msgs} msgs
                </span>
              </div>
            ))}
          </>
        )}

        {mode === "sessions" && (
          <>
            <div
              style={{
                padding: "4px 16px",
                color: COLORS.textMuted,
                fontSize: 14,
                borderBottom: `1px solid ${COLORS.border}`,
                marginBottom: 4,
              }}
            >
              ironbridge/ → Sessions ({sessions.length})
            </div>
            {sessions.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 16px",
                  background:
                    i === activeRow ? "rgba(0,212,255,0.12)" : "transparent",
                  borderLeft:
                    i === activeRow
                      ? `3px solid ${COLORS.primary}`
                      : "3px solid transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  color: i === activeRow ? COLORS.text : COLORS.textMuted,
                }}
              >
                <span>{s.title}</span>
                <span style={{ color: COLORS.textDim }}>
                  {s.msgs} msgs · {s.date}
                </span>
              </div>
            ))}
          </>
        )}

        {mode === "detail" && (
          <>
            <div
              style={{
                padding: "4px 16px",
                color: COLORS.primary,
                fontSize: 14,
                borderBottom: `1px solid ${COLORS.border}`,
                marginBottom: 8,
              }}
            >
              Implement auth middleware — 28 messages
            </div>
            <div style={{ padding: "8px 16px" }}>
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(0,212,255,0.06)",
                  borderRadius: 8,
                  marginBottom: 12,
                  borderLeft: `3px solid ${COLORS.primary}`,
                }}
              >
                <div
                  style={{
                    color: COLORS.primary,
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  User
                </div>
                <div style={{ color: COLORS.text }}>
                  How do I add JWT authentication to my Express API?
                </div>
              </div>
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(124,58,237,0.06)",
                  borderRadius: 8,
                  borderLeft: `3px solid ${COLORS.secondary}`,
                }}
              >
                <div
                  style={{
                    color: COLORS.secondary,
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  Assistant
                </div>
                <div style={{ color: COLORS.text }}>
                  Here's how to implement JWT auth middleware...
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* TUI footer */}
      <div
        style={{
          background: "#161b22",
          padding: "6px 16px",
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex",
          gap: 20,
          fontSize: 13,
          color: COLORS.textDim,
        }}
      >
        <span>
          <span style={{ color: COLORS.primary }}>↑↓</span> navigate
        </span>
        <span>
          <span style={{ color: COLORS.primary }}>Enter</span> select
        </span>
        <span>
          <span style={{ color: COLORS.primary }}>/</span> filter
        </span>
        <span>
          <span style={{ color: COLORS.primary }}>e</span> export
        </span>
        <span>
          <span style={{ color: COLORS.primary }}>r</span> refresh
        </span>
      </div>
    </div>
  );
};

export const TUIBrowser: React.FC = () => {
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
            title="Interactive TUI"
            subtitle="Browse sessions without leaving the terminal"
          />
        </AbsoluteFill>
      </Sequence>

      {/* Step 1: Workspaces view */}
      <Sequence from={3 * VIDEO_FPS} durationInFrames={5 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <SectionBadge number={1} label="Browse Workspaces" />
          <TUIScreen mode="workspaces" activeRow={0} startFrame={10} />
        </AbsoluteFill>
      </Sequence>

      {/* Step 2: Sessions view */}
      <Sequence from={8 * VIDEO_FPS} durationInFrames={5 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <SectionBadge number={2} label="View Sessions" />
          <TUIScreen mode="sessions" activeRow={0} startFrame={10} />
        </AbsoluteFill>
      </Sequence>

      {/* Step 3: Session detail */}
      <Sequence from={13 * VIDEO_FPS} durationInFrames={5 * VIDEO_FPS}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <SectionBadge number={3} label="Read Conversations" />
          <TUIScreen mode="detail" activeRow={0} startFrame={10} />
        </AbsoluteFill>
      </Sequence>

      {/* Outro */}
      <Sequence from={18 * VIDEO_FPS} durationInFrames={2 * VIDEO_FPS}>
        <OutroSlide />
      </Sequence>
    </Background>
  );
};

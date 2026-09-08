import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS } from "../constants";

/**
 * Full-screen background with gradient and subtle grid
 */
export const Background: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.bg} 0%, #0a0e17 40%, #111827 100%)`,
        fontFamily: FONTS.heading,
        color: COLORS.text,
      }}
    >
      {/* Subtle grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />
      {/* Accent glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(circle at 50% 0%, rgba(0,212,255,0.06) 0%, transparent 60%),
            radial-gradient(circle at 20% 80%, rgba(124,58,237,0.04) 0%, transparent 50%)
          `,
          pointerEvents: "none",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/**
 * Logo + wordmark header
 */
export const Logo: React.FC<{ size?: number }> = ({ size = 48 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Simple bridge icon */}
      <svg width={size} height={size} viewBox="0 0 128 128">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={COLORS.primary} />
            <stop offset="100%" stopColor={COLORS.secondary} />
          </linearGradient>
        </defs>
        <rect width="128" height="128" rx="24" fill="url(#logoGrad)" />
        <path
          d="M32 64 C32 48 48 32 64 32 C80 32 96 48 96 64 C96 80 80 96 64 96 C48 96 32 80 32 64"
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="64" cy="50" r="8" fill="white" />
        <path
          d="M48 70 L80 70"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M56 82 L72 82"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          fontSize: size * 0.75,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        IRONBRIDGE
      </span>
    </div>
  );
};

/**
 * Animated title slide with tagline
 */
export const TitleSlide: React.FC<{
  title: string;
  subtitle?: string;
  startFrame?: number;
}> = ({ title, subtitle, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - startFrame;

  if (f < 0) return null;

  const titleY = spring({
    frame: f,
    fps,
    config: { damping: 15 },
    from: 40,
    to: 0,
  });

  const titleOp = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subOp = interpolate(f, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        textAlign: "center",
        padding: "0 120px",
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          lineHeight: 1.1,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 32,
            color: COLORS.textMuted,
            opacity: subOp,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};

/**
 * Fake terminal window for CLI demos
 */
export const Terminal: React.FC<{
  lines: Array<{
    prompt?: boolean;
    text: string;
    color?: string;
    delay?: number;
  }>;
  title?: string;
  startFrame?: number;
  fullScreen?: boolean;
}> = ({ lines, title = "Terminal", startFrame = 0, fullScreen = false }) => {
  const frame = useCurrentFrame();
  const f = frame - startFrame;

  if (f < 0) return null;

  const containerOp = interpolate(f, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        ...(fullScreen
          ? { width: "100%", height: "100%" }
          : { width: "85%", maxWidth: 1400, borderRadius: 12 }),
        opacity: containerOp,
        overflow: "hidden",
        border: fullScreen ? "none" : `1px solid ${COLORS.border}`,
        boxShadow: fullScreen ? "none" : "0 20px 60px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column" as const,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: "#161b22",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: COLORS.error,
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: COLORS.warning,
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: COLORS.success,
          }}
        />
        <span
          style={{
            marginLeft: 12,
            fontSize: 13,
            color: COLORS.textDim,
            fontFamily: FONTS.code,
          }}
        >
          {title}
        </span>
      </div>

      {/* Terminal body */}
      <div
        style={{
          background: COLORS.bgTerminal,
          padding: fullScreen ? "32px 40px" : "20px 24px",
          fontFamily: FONTS.code,
          fontSize: fullScreen ? 24 : 20,
          lineHeight: 1.6,
          ...(fullScreen ? { flex: 1 } : { minHeight: 300 }),
        }}
      >
        {lines.map((line, i) => {
          const lineDelay = line.delay ?? i * 15;
          const lineF = f - lineDelay;
          if (lineF < 0) return null;

          const lineOp = interpolate(lineF, [0, 8], [0, 1], {
            extrapolateRight: "clamp",
          });

          const charCount = Math.floor(
            interpolate(lineF, [0, Math.max(line.text.length * 0.5, 10)], [0, line.text.length], {
              extrapolateRight: "clamp",
            })
          );

          const displayText = line.prompt
            ? line.text.substring(0, charCount)
            : line.text;

          return (
            <div key={i} style={{ opacity: lineOp }}>
              {line.prompt && (
                <span style={{ color: COLORS.success }}>❯ </span>
              )}
              <span style={{ color: line.color ?? COLORS.text }}>
                {displayText}
              </span>
              {line.prompt && charCount < line.text.length && (
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 20,
                    background: COLORS.primary,
                    marginLeft: 2,
                    opacity: Math.sin(lineF * 0.3) > 0 ? 1 : 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Section transition with number badge
 */
export const SectionBadge: React.FC<{
  number: number;
  label: string;
  startFrame?: number;
}> = ({ number, label, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - startFrame;

  if (f < 0) return null;

  const scale = spring({ frame: f, fps, config: { damping: 12 } });
  const opacity = interpolate(f, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.secondary})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          fontWeight: 800,
          color: COLORS.white,
        }}
      >
        {number}
      </div>
      <span
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: COLORS.text,
        }}
      >
        {label}
      </span>
    </div>
  );
};

/**
 * Feature card for listing capabilities
 */
export const FeatureCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  startFrame?: number;
  index?: number;
}> = ({ icon, title, description, startFrame = 0, index = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - startFrame - index * 8;

  if (f < 0) return null;

  const slideX = spring({
    frame: f,
    fps,
    config: { damping: 14 },
    from: 60,
    to: 0,
  });

  const opacity = interpolate(f, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 20,
        padding: "20px 28px",
        background: COLORS.bgCard,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        opacity,
        transform: `translateX(${slideX}px)`,
        width: 520,
      }}
    >
      <span style={{ fontSize: 36 }}>{icon}</span>
      <div>
        <div
          style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}
        >
          {title}
        </div>
        <div style={{ fontSize: 16, color: COLORS.textMuted, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </div>
  );
};

/**
 * Outro/CTA slide
 */
export const OutroSlide: React.FC<{ startFrame?: number }> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - startFrame;

  if (f < 0) return null;

  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame: f,
    fps,
    config: { damping: 12 },
    from: 0.9,
    to: 1,
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <Logo size={64} />
      <div style={{ fontSize: 40, fontWeight: 700 }}>Get Started</div>
      <div
        style={{
          fontFamily: FONTS.code,
          fontSize: 28,
          padding: "16px 40px",
          background: COLORS.bgCard,
          borderRadius: 12,
          border: `1px solid ${COLORS.border}`,
          color: COLORS.primary,
        }}
      >
        cargo install ironbridge-cli
      </div>
      <div style={{ fontSize: 20, color: COLORS.textMuted }}>
        github.com/nervosys/IronBridge
      </div>
    </AbsoluteFill>
  );
};

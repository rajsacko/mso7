import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { BrandKit, CaptionSegment } from "../../lib/types";
import { captionChrome } from "../../lib/overlayChrome";

export function fadeInOut(
  frame: number,
  durationInFrames: number,
  fade = 12,
) {
  const opacity = interpolate(
    frame,
    [0, fade, Math.max(fade + 1, durationInFrames - fade), durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return opacity;
}

export function IntroCard({
  brand,
  title,
  subtitle,
  durationInFrames,
}: {
  brand: BrandKit;
  title: string;
  subtitle: string;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const opacity = fadeInOut(frame, durationInFrames, 15);
  const y = interpolate(frame, [0, 20], [18, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.background,
        color: brand.foreground,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "8%",
        opacity,
      }}
    >
      <p
        style={{
          fontFamily: brand.bodyFont,
          fontSize: 28,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: brand.muted,
          marginBottom: 36,
        }}
      >
        {brand.atelierLine}
      </p>
      <h1
        style={{
          fontFamily: brand.displayFont,
          fontWeight: 400,
          fontSize: 92,
          lineHeight: 1.05,
          textAlign: "center",
          transform: `translateY(${y}px)`,
          maxWidth: "90%",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontFamily: brand.bodyFont,
          fontSize: 32,
          marginTop: 28,
          color: brand.accent,
          letterSpacing: "0.04em",
        }}
      >
        {subtitle}
      </p>
    </AbsoluteFill>
  );
}

export function OutroCard({
  brand,
  bilingual = false,
  durationInFrames,
}: {
  brand: BrandKit;
  bilingual?: boolean;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const opacity = fadeInOut(frame, durationInFrames, 15);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.foreground,
        color: brand.background,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "10%",
        opacity,
      }}
    >
      <h2
        style={{
          fontFamily: brand.displayFont,
          fontSize: 76,
          fontWeight: 400,
          letterSpacing: "-0.02em",
        }}
      >
        {brand.wordmark}
      </h2>
      <p
        style={{
          fontFamily: brand.bodyFont,
          marginTop: 24,
          fontSize: 28,
          color: "rgba(250,250,248,0.7)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {brand.atelierLine}
      </p>
      {bilingual ? (
        <p
          style={{
            fontFamily: brand.bodyFont,
            marginTop: 48,
            fontSize: 26,
            textAlign: "center",
            lineHeight: 1.6,
            maxWidth: 720,
            color: "rgba(250,250,248,0.85)",
          }}
        >
          The Designer&apos;s Lens
          <br />
          L&apos;Objectif du Designer
        </p>
      ) : null}
    </AbsoluteFill>
  );
}

export function LowerThird({
  brand,
  text,
}: {
  brand: BrandKit;
  text: string;
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "6%",
        bottom: "10%",
        opacity,
        backgroundColor: "rgba(250,250,248,0.92)",
        color: brand.foreground,
        padding: "18px 28px",
        borderLeft: `3px solid ${brand.accent}`,
        maxWidth: "70%",
      }}
    >
      <p
        style={{
          fontFamily: brand.bodyFont,
          fontSize: 28,
          letterSpacing: "0.02em",
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

export function PrincipleCard({
  brand,
  text,
  durationInFrames,
}: {
  brand: BrandKit;
  text: string;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const opacity = fadeInOut(frame, durationInFrames, 12);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.background,
        color: brand.foreground,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12%",
        opacity,
      }}
    >
      <p
        style={{
          fontFamily: brand.displayFont,
          fontSize: 68,
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: 900,
        }}
      >
        {text}
      </p>
    </AbsoluteFill>
  );
}

export function ChapterCard({
  brand,
  label,
  index,
  durationInFrames,
}: {
  brand: BrandKit;
  label: string;
  index: number;
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const opacity = fadeInOut(frame, durationInFrames, 10);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.background,
        color: brand.foreground,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "10%",
        opacity,
      }}
    >
      <p
        style={{
          fontFamily: brand.bodyFont,
          fontSize: 24,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: brand.muted,
          marginBottom: 20,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </p>
      <h2
        style={{
          fontFamily: brand.displayFont,
          fontSize: 88,
          fontWeight: 400,
        }}
      >
        {label}
      </h2>
    </AbsoluteFill>
  );
}

export function CaptionOverlay({
  brand,
  text,
  segment,
  ms,
}: {
  brand: BrandKit;
  text?: string;
  segment?: CaptionSegment | null;
  ms?: number;
}) {
  const display = (segment?.text || text || "").trim();
  if (!display) return null;
  const { wrap, plate } = captionChrome(brand);
  const words = segment?.words;
  const hasWords = Boolean(words && words.length > 0 && ms != null);

  return (
    <div style={wrap}>
      <span style={{ ...plate, pointerEvents: "auto" }}>
        {hasWords
          ? words!.map((w, i) => {
              const active = ms! >= w.startMs && ms! <= w.endMs;
              const spoken = ms! >= w.startMs;
              const label = w.word.replace(/^\s+/, "");
              return (
                <span
                  key={`${w.startMs}-${i}`}
                  style={{
                    color: active ? brand.accent || "#ffffff" : "#ffffff",
                    opacity: spoken ? 1 : 0.42,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {i > 0 && !/^[.,!?']/.test(label) ? " " : ""}
                  {label}
                </span>
              );
            })
          : display}
      </span>
    </div>
  );
}

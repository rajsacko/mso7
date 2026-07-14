import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type {
  BrandKit,
  CaptionSegment,
  LookId,
  ProjectClip,
  ProjectOverlay,
  TransitionId,
} from "../../lib/types";
import { TRANSITION_META } from "../../lib/types";
import {
  FPS,
  clipsTimelineFrames,
  usableClipDurationMs,
} from "../../lib/timeline";
import { CaptionOverlay, LowerThird } from "./OverlayElements";
import { LookGrade, lookFilter } from "./LookGrade";
import { RemotionFontLoader } from "./RemotionFontLoader";
import { getCaptionAtMs } from "../types";

export { clipsTimelineFrames };

/** True fade-through-black (crossfade labels use plain fade). */
function FadeThroughBlackPresentation({
  children,
  presentationDirection,
  presentationProgress,
}: {
  children: ReactNode;
  presentationDirection: "entering" | "exiting";
  presentationProgress: number;
  passedProps?: unknown;
}) {
  const black =
    presentationProgress <= 0.5
      ? presentationProgress * 2
      : (1 - presentationProgress) * 2;
  const opacity =
    presentationDirection === "exiting"
      ? 1 - Math.min(1, presentationProgress * 2)
      : Math.max(0, presentationProgress * 2 - 1);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{ backgroundColor: "#000", opacity: black, pointerEvents: "none" }}
      />
    </AbsoluteFill>
  );
}

function presentationFor(
  id: TransitionId,
): TransitionPresentation<Record<string, unknown>> {
  switch (id) {
    case "slide":
      return slide({ direction: "from-right" }) as TransitionPresentation<
        Record<string, unknown>
      >;
    case "wipe":
      return wipe({ direction: "from-left" }) as TransitionPresentation<
        Record<string, unknown>
      >;
    case "fade-black":
      return {
        component: FadeThroughBlackPresentation,
        props: {},
      };
    case "crossfade":
      return fade() as TransitionPresentation<Record<string, unknown>>;
    default:
      return fade() as TransitionPresentation<Record<string, unknown>>;
  }
}

export function ClipReel({
  clips,
  brand,
  lowerThird,
  captions,
  showLowerThird = false,
  musicUrl,
  voiceOverUrl,
  lookId = "none",
  overlays = [],
  defaultTransition = "none",
  musicStartMs = 0,
  musicEndMs = 0,
  musicVolume = 0.22,
}: {
  clips: ProjectClip[];
  brand: BrandKit;
  lowerThird: string;
  captions: CaptionSegment[];
  showLowerThird?: boolean;
  musicUrl?: string;
  voiceOverUrl?: string;
  lookId?: LookId;
  overlays?: ProjectOverlay[];
  defaultTransition?: TransitionId;
  musicStartMs?: number;
  musicEndMs?: number;
  musicVolume?: number;
}) {
  const sorted = [...clips].sort((a, b) => a.order - b.order);
  const timelineFrames = clipsTimelineFrames(sorted, defaultTransition);

  if (!sorted.length) {
    return <AbsoluteFill style={{ backgroundColor: "#111" }} />;
  }

  const seriesChildren: ReactNode[] = [];
  sorted.forEach((clip, index) => {
    const durationInFrames = Math.max(
      1,
      Math.round((usableClipDurationMs(clip) / 1000) * FPS),
    );
    seriesChildren.push(
      <TransitionSeries.Sequence
        key={`seq-${clip.id}`}
        durationInFrames={durationInFrames}
      >
        <ClipShot
          clip={clip}
          brand={brand}
          lowerThird={lowerThird}
          showLowerThird={showLowerThird}
          lookId={lookId}
        />
      </TransitionSeries.Sequence>,
    );

    if (index < sorted.length - 1) {
      const nextTransition = clip.transitionOut || defaultTransition;
      const transFrames =
        nextTransition === "none"
          ? 0
          : Math.min(
              TRANSITION_META[nextTransition]?.frames ?? 18,
              Math.floor(durationInFrames / 2),
            );
      if (transFrames > 0) {
        seriesChildren.push(
          <TransitionSeries.Transition
            key={`tr-${clip.id}`}
            presentation={presentationFor(nextTransition)}
            timing={linearTiming({ durationInFrames: transFrames })}
          />,
        );
      }
    }
  });

  const musicFrom = Math.max(0, Math.round((musicStartMs / 1000) * FPS));
  const musicToMs =
    musicEndMs > musicStartMs
      ? musicEndMs
      : (timelineFrames / FPS) * 1000;
  const musicDur = Math.max(
    1,
    Math.round(((musicToMs - musicStartMs) / 1000) * FPS),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <RemotionFontLoader fonts={brand.customFonts} />
      <TransitionSeries>{seriesChildren}</TransitionSeries>

      <Sequence from={0} durationInFrames={timelineFrames}>
        <TimedCaptions brand={brand} captions={captions} />
        <OverlayStack overlays={overlays} brand={brand} />
      </Sequence>

      {musicUrl ? (
        <Sequence from={musicFrom} durationInFrames={musicDur}>
          <Audio src={musicUrl} volume={Math.min(1, Math.max(0, musicVolume))} />
        </Sequence>
      ) : null}
      {voiceOverUrl ? <Audio src={voiceOverUrl} volume={1} /> : null}
    </AbsoluteFill>
  );
}

function TimedCaptions({
  brand,
  captions,
}: {
  brand: BrandKit;
  captions: CaptionSegment[];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const caption = getCaptionAtMs(captions, ms);
  return <CaptionOverlay brand={brand} text={caption} />;
}

function OverlayStack({
  overlays,
  brand,
}: {
  overlays: ProjectOverlay[];
  brand: BrandKit;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {overlays
        .filter((o) => ms >= o.startMs && ms <= o.endMs)
        .map((overlay) => (
          <OverlayItem key={overlay.id} overlay={overlay} brand={brand} />
        ))}
    </AbsoluteFill>
  );
}

function OverlayItem({
  overlay,
  brand,
}: {
  overlay: ProjectOverlay;
  brand: BrandKit;
}) {
  // Free placement: offsetX/Y are % from frame center. Drag in studio edits these.
  const boxStyle: CSSProperties = {
    position: "absolute",
    left: `${50 + overlay.offsetX}%`,
    top: `${50 + overlay.offsetY}%`,
    transform: `translate(-50%, -50%) scale(${overlay.scale})`,
    transformOrigin: "center center",
    opacity: overlay.opacity,
  };

  if (overlay.kind === "video" && overlay.videoUrl) {
    return (
      <div style={boxStyle}>
        <Video
          src={overlay.videoUrl}
          muted
          style={{
            width: 420,
            maxWidth: "78%",
            height: "auto",
            objectFit: "cover",
            borderRadius: 4,
          }}
        />
      </div>
    );
  }

  if (
    (overlay.kind === "image" || overlay.kind === "logo") &&
    overlay.imageUrl
  ) {
    return (
      <div style={boxStyle}>
        <Img
          src={overlay.imageUrl}
          style={{
            width: overlay.kind === "logo" ? 200 : 420,
            maxWidth: overlay.kind === "logo" ? "42%" : "78%",
            height: "auto",
            objectFit: "contain",
            borderRadius: overlay.kind === "image" ? 4 : 0,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...boxStyle,
        fontFamily: brand.bodyFont,
        color: brand.background,
        background:
          overlay.kind === "badge" ? brand.foreground : "rgba(26,26,26,0.55)",
        padding: overlay.kind === "badge" ? "14px 22px" : "10px 16px",
        fontSize: overlay.kind === "badge" ? 34 : 40,
        letterSpacing: "0.02em",
        maxWidth: "70%",
        textAlign: "center",
      }}
    >
      {overlay.text || brand.wordmark}
    </div>
  );
}

function ClipShot({
  clip,
  brand,
  lowerThird,
  showLowerThird,
  lookId,
}: {
  clip: ProjectClip;
  brand: BrandKit;
  lowerThird: string;
  showLowerThird: boolean;
  lookId: LookId;
}) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          filter: lookFilter(lookId),
          transform: "scale(1.02)",
          transformOrigin: "center center",
        }}
      >
        <Video
          src={clip.url}
          startFrom={Math.round((clip.trimStartMs / 1000) * FPS)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
          }}
        />
      </AbsoluteFill>
      <LookGrade lookId={lookId} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.4) 100%)",
        }}
      />
      {showLowerThird && lowerThird ? (
        <LowerThird brand={brand} text={lowerThird} />
      ) : null}
    </AbsoluteFill>
  );
}

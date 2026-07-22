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
import { textOverlayChrome } from "../../lib/overlayChrome";
import {
  FPS,
  clipsTimelineFrames,
  usableClipDurationMs,
} from "../../lib/timeline";
import { duckedMusicVolume } from "../../lib/audioMix";
import { CaptionOverlay, LowerThird } from "./OverlayElements";
import { LookGrade, lookFilter } from "./LookGrade";
import { RemotionFontLoader } from "./RemotionFontLoader";
import { getCaptionSegmentAtMs } from "../types";

export { clipsTimelineFrames };

function MusicBed({
  src,
  musicFrom,
  musicVolume,
  voiceOverUrl,
  voiceOverStartMs,
  voiceOverEndMs,
  timelineFrames,
}: {
  src: string;
  musicFrom: number;
  musicVolume: number;
  voiceOverUrl?: string;
  voiceOverStartMs: number;
  voiceOverEndMs: number;
  timelineFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absMs = ((musicFrom + frame) / fps) * 1000;
  const voEnd =
    voiceOverEndMs > voiceOverStartMs
      ? voiceOverEndMs
      : (timelineFrames / fps) * 1000;
  return (
    <Audio
      src={src}
      volume={duckedMusicVolume(
        absMs,
        musicVolume,
        voiceOverStartMs,
        voEnd,
        Boolean(voiceOverUrl),
      )}
    />
  );
}

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
  showCaptions = true,
  showLowerThird = false,
  musicUrl,
  voiceOverUrl,
  lookId = "none",
  overlays = [],
  defaultTransition = "none",
  musicStartMs = 0,
  musicEndMs = 0,
  musicVolume = 0.22,
  voiceOverStartMs = 0,
  voiceOverEndMs = 0,
  voiceOverVolume = 1,
  hook = "",
  showTitle = false,
}: {
  clips: ProjectClip[];
  brand: BrandKit;
  lowerThird: string;
  captions: CaptionSegment[];
  showCaptions?: boolean;
  showLowerThird?: boolean;
  musicUrl?: string;
  voiceOverUrl?: string;
  lookId?: LookId;
  overlays?: ProjectOverlay[];
  defaultTransition?: TransitionId;
  musicStartMs?: number;
  musicEndMs?: number;
  musicVolume?: number;
  voiceOverStartMs?: number;
  voiceOverEndMs?: number;
  voiceOverVolume?: number;
  hook?: string;
  showTitle?: boolean;
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
        {showCaptions && captions.length ? (
          <TimedCaptions brand={brand} captions={captions} />
        ) : null}
        <OverlayStack overlays={overlays} brand={brand} />
        {showTitle && hook.trim() ? (
          <AbsoluteFill style={{ pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                top: "11%",
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: brand.displayFont,
                fontSize: 42,
                fontWeight: 500,
                color: "#ffffff",
                textAlign: "center",
                maxWidth: "78%",
                textShadow:
                  "0 1px 3px rgba(0,0,0,0.7), 0 0 28px rgba(0,0,0,0.35)",
              }}
            >
              {hook}
            </div>
          </AbsoluteFill>
        ) : null}
      </Sequence>

      {musicUrl ? (
        <Sequence from={musicFrom} durationInFrames={musicDur}>
          <MusicBed
            src={musicUrl}
            musicFrom={musicFrom}
            musicVolume={Math.min(1, Math.max(0, musicVolume))}
            voiceOverUrl={voiceOverUrl}
            voiceOverStartMs={voiceOverStartMs}
            voiceOverEndMs={voiceOverEndMs}
            timelineFrames={timelineFrames}
          />
        </Sequence>
      ) : null}
      {voiceOverUrl ? (
        <Sequence
          from={Math.max(0, Math.round((voiceOverStartMs / 1000) * FPS))}
          durationInFrames={Math.max(
            1,
            Math.round(
              ((Math.max(
                voiceOverEndMs > voiceOverStartMs
                  ? voiceOverEndMs
                  : (timelineFrames / FPS) * 1000,
                voiceOverStartMs + 200,
              ) -
                voiceOverStartMs) /
                1000) *
                FPS,
            ),
          )}
        >
          <Audio
            src={voiceOverUrl}
            volume={Math.min(1, Math.max(0, voiceOverVolume))}
          />
        </Sequence>
      ) : null}
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
  const segment = getCaptionSegmentAtMs(captions, ms);
  return (
    <CaptionOverlay brand={brand} segment={segment} text={segment?.text} ms={ms} />
  );
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
    const w = overlay.kind === "logo" ? 200 : 420;
    const maxW = overlay.kind === "logo" ? "42%" : "78%";
    const tint = overlay.fillColor;
    if (tint && overlay.kind === "logo") {
      return (
        <div style={boxStyle}>
          <div
            style={{
              width: w,
              maxWidth: maxW,
              aspectRatio: "3 / 1",
              minHeight: 48,
              backgroundColor: tint,
              WebkitMaskImage: `url(${overlay.imageUrl})`,
              maskImage: `url(${overlay.imageUrl})`,
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
            }}
          />
        </div>
      );
    }
    return (
      <div style={boxStyle}>
        <Img
          src={overlay.imageUrl}
          style={{
            width: w,
            maxWidth: maxW,
            height: "auto",
            objectFit: "contain",
            borderRadius: overlay.kind === "image" ? 4 : 0,
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ ...boxStyle, ...textOverlayChrome(overlay, brand) }}>
      {overlay.text || "Type here"}
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

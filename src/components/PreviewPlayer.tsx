"use client";

import { Player, type PlayerRef } from "@remotion/player";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { BrandKit, Project, ProjectOverlay } from "@/lib/types";
import { DEFAULT_BRAND, FORMAT_SIZES } from "@/lib/types";
import { captionAtMs } from "@/lib/captions";
import {
  StudioPreview,
  studioPreviewDuration,
} from "@/remotion/compositions/StudioPreview";
import type { CompositionProps } from "@/remotion/types";

/** Free placement: offsetX/Y are % from the center of the frame. */
function overlayCssPos(offsetX: number, offsetY: number): CSSProperties {
  return {
    left: `${50 + offsetX}%`,
    top: `${50 + offsetY}%`,
    transform: "translate(-50%, -50%)",
  };
}

export function PreviewPlayer({
  project,
  brand,
  playerRef,
  selectedOverlay,
  onSelectOverlay,
  onChangeHook,
  onChangeCaption,
  activeCaptionIndex,
  onActiveCaptionChange,
  onProgress,
  onPlayingChange,
  showTitle,
  showCaptionOverlay,
  selectedOverlayId,
  onSelectOverlayId,
  onMoveOverlay,
  onScaleOverlay,
}: {
  project: Project;
  brand: BrandKit;
  playerRef: RefObject<PlayerRef | null>;
  selectedOverlay: "title" | "caption" | null;
  onSelectOverlay: (which: "title" | "caption" | null) => void;
  onChangeHook: (value: string) => void;
  onChangeCaption: (index: number, value: string) => void;
  activeCaptionIndex: number;
  onActiveCaptionChange: (index: number) => void;
  onProgress: (ratio: number, ms: number) => void;
  onPlayingChange: (playing: boolean) => void;
  showTitle: boolean;
  showCaptionOverlay: boolean;
  selectedOverlayId: string | null;
  onSelectOverlayId: (id: string | null) => void;
  onMoveOverlay: (id: string, offsetX: number, offsetY: number) => void;
  onScaleOverlay?: (id: string, scale: number) => void;
}) {
  const size = FORMAT_SIZES[project.format];
  const [progress, setProgress] = useState(0);
  const [liveCaption, setLiveCaption] = useState("");
  const titleRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<"title" | "caption" | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    w: number;
    h: number;
  } | null>(null);

  const inputProps: CompositionProps = useMemo(
    () => ({
      brand: brand || DEFAULT_BRAND,
      format: project.format,
      preset: project.preset,
      clips: project.clips.map((c) => ({
        ...c,
        transitionOut: c.transitionOut || project.defaultTransition || "none",
      })),
      overlays: project.overlays || [],
      hook: project.hook,
      subtitle: project.subtitle,
      lowerThird: "",
      principle: project.principle,
      chapterLabels: project.chapterLabels,
      question: project.question,
      answer: project.answer,
      captions: project.showCaptionOverlay ? project.captions : [],
      captionLanguage: project.captionLanguage,
      voiceOverUrl: project.voiceOver.url,
      musicUrl: project.musicUrl || brand.musicUrl,
      lookId: project.lookId || "none",
      defaultTransition: project.defaultTransition || "crossfade",
      previewPreset: false,
      musicStartMs: project.musicStartMs || 0,
      musicEndMs: project.musicEndMs || 0,
      musicVolume: project.musicVolume ?? 0.22,
    }),
    [project, brand],
  );

  const durationInFrames = Math.max(90, studioPreviewDuration(inputProps));
  const isReel = project.format === "reel" || project.format === "story";
  const fps = size.fps;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({
    w: isReel ? 297 : 880,
    h: isReel ? 528 : 495,
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const fit = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const maxW = Math.max(120, parent.clientWidth);
      const maxH = Math.max(160, parent.clientHeight);
      const ratio = isReel ? 9 / 16 : 16 / 9;

      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }

      w = Math.floor(w);
      h = Math.round(w / ratio);
      if (h > maxH) {
        h = Math.floor(maxH);
        w = Math.round(h * ratio);
      }
      setFrameSize({ w, h });
    };

    fit();
    const ro = new ResizeObserver(fit);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [isReel]);

  const onProgressRef = useRef(onProgress);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const onActiveCaptionChangeRef = useRef(onActiveCaptionChange);
  onProgressRef.current = onProgress;
  onPlayingChangeRef.current = onPlayingChange;
  onActiveCaptionChangeRef.current = onActiveCaptionChange;

  useEffect(() => {
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const frame = player.getCurrentFrame() ?? 0;
      const ratio = Math.min(1, frame / durationInFrames);
      const ms = Math.round((frame / fps) * 1000);
      setProgress(ratio);
      onProgressRef.current(ratio, ms);
      onPlayingChangeRef.current(Boolean(player.isPlaying()));

      const hit = captionAtMs(project.captions, ms);
      if (hit.index >= 0) {
        onActiveCaptionChangeRef.current(hit.index);
        setLiveCaption(hit.text);
      } else if (!editingRef.current) {
        setLiveCaption("");
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [playerRef, durationInFrames, fps, project.captions]);

  useEffect(() => {
    if (editingRef.current === "title") return;
    if (titleRef.current && titleRef.current.textContent !== project.hook) {
      titleRef.current.textContent = project.hook || "Add header";
    }
  }, [project.hook]);

  const captionFallback =
    liveCaption ||
    (activeCaptionIndex >= 0 && project.captions[activeCaptionIndex]
      ? project.captions[activeCaptionIndex].text
      : project.captions[0]?.text || "Add caption");

  useEffect(() => {
    if (editingRef.current === "caption") return;
    if (
      captionRef.current &&
      captionRef.current.textContent !== captionFallback
    ) {
      captionRef.current.textContent = captionFallback;
    }
  }, [captionFallback]);

  function seek(ratio: number) {
    const frame = Math.round(ratio * durationInFrames);
    playerRef.current?.seekTo(frame);
  }

  function onOverlayPointerDown(e: ReactPointerEvent, overlay: ProjectOverlay) {
    e.preventDefault();
    e.stopPropagation();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    onSelectOverlayId(overlay.id);
    dragRef.current = {
      id: overlay.id,
      startX: e.clientX,
      startY: e.clientY,
      ox: overlay.offsetX,
      oy: overlay.offsetY,
      w: rect.width,
      h: rect.height,
    };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ((ev.clientX - d.startX) / d.w) * 100;
      const dy = ((ev.clientY - d.startY) / d.h) * 100;
      onMoveOverlay(
        d.id,
        Math.round((d.ox + dx) * 10) / 10,
        Math.round((d.oy + dy) * 10) / 10,
      );
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const liveOverlays = (project.overlays || []).filter((o) => {
    if (o.id === selectedOverlayId) return true;
    const ms = Math.round(progress * (durationInFrames / fps) * 1000);
    return ms >= o.startMs && ms <= o.endMs;
  });

  return (
    <div
      ref={wrapRef}
      className={`mso-preview-wrap${isReel ? " is-reel" : ""}`}
      style={{
        width: frameSize.w,
        height: frameSize.h,
        aspectRatio: "unset",
        maxWidth: "none",
        maxHeight: "none",
        ["--mso-title-font" as string]: brand.displayFont || "Cabinet Grotesk",
        ["--mso-caption-font" as string]: brand.bodyFont || "Cabinet Grotesk",
      }}
    >
      <div className="mso-preview-inner">
        <div className="preview-frame">
          {project.clips.length > 0 ? (
            <Player
              ref={playerRef}
              component={
                StudioPreview as unknown as ComponentType<
                  Record<string, unknown>
                >
              }
              inputProps={inputProps as unknown as Record<string, unknown>}
              durationInFrames={durationInFrames}
              compositionWidth={size.width}
              compositionHeight={size.height}
              fps={fps}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "#111",
              }}
              controls={false}
              loop
              acknowledgeRemotionLicense
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#111",
                display: "grid",
                placeItems: "center",
                color: "#888",
                fontSize: "0.9rem",
              }}
            >
              Add clips to preview
            </div>
          )}
        </div>
      </div>

      {/* Interaction layer only — Remotion paints overlays for true WYSIWYG. */}
      <div className="mso-overlay-handles" aria-hidden={false}>
        {liveOverlays.map((o) => {
          const isMedia =
            (o.kind === "logo" || o.kind === "image" || o.kind === "video") &&
            Boolean(o.imageUrl || o.videoUrl);
          return (
            <button
              key={o.id}
              type="button"
              className={`mso-overlay-handle is-hit${selectedOverlayId === o.id ? " is-active" : ""}${isMedia ? " is-media" : ""}${o.kind === "logo" ? " is-logo" : ""}`}
              style={{
                ...overlayCssPos(o.offsetX, o.offsetY),
                transform: `translate(-50%, -50%) scale(${o.scale || 1})`,
              }}
              onPointerDown={(e) => onOverlayPointerDown(e, o)}
              onWheel={(e) => {
                if (!onScaleOverlay) return;
                e.preventDefault();
                e.stopPropagation();
                const next = Math.min(
                  3,
                  Math.max(0.25, (o.scale || 1) + (e.deltaY > 0 ? -0.08 : 0.08)),
                );
                onScaleOverlay(o.id, Math.round(next * 100) / 100);
              }}
              title="Drag to place · scroll to scale"
              aria-label={o.text || o.kind}
            >
              <span className="mso-overlay-hitbox" />
            </button>
          );
        })}
      </div>

      <div className="mso-overlay-layer">
        <div
          ref={titleRef}
          className={`mso-editable mso-editable-title${selectedOverlay === "title" ? " is-active" : ""}${showTitle ? "" : " hidden-layer"}`}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Edit title on video"
          onFocus={() => {
            editingRef.current = "title";
            onSelectOverlay("title");
          }}
          onBlur={(e) => {
            editingRef.current = null;
            onChangeHook(e.currentTarget.textContent?.trim() || "");
            onSelectOverlay(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectOverlay("title");
          }}
        />

        <div
          ref={captionRef}
          className={`mso-editable mso-editable-caption${selectedOverlay === "caption" ? " is-active" : ""}${showCaptionOverlay && selectedOverlay === "caption" ? "" : " hidden-layer"}`}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Edit caption on video"
          onFocus={() => {
            editingRef.current = "caption";
            onSelectOverlay("caption");
          }}
          onBlur={(e) => {
            editingRef.current = null;
            const idx = Math.max(0, activeCaptionIndex);
            onChangeCaption(
              idx,
              e.currentTarget.textContent?.trim() || captionFallback,
            );
            onSelectOverlay(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectOverlay("caption");
          }}
        />
      </div>

      <div
        className="mso-scrub"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek((e.clientX - rect.left) / rect.width);
        }}
      >
        <div
          className="mso-scrub-fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

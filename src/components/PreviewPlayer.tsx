"use client";

import { Player, type PlayerRef } from "@remotion/player";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from "react";
import type { BrandKit, Project } from "@/lib/types";
import { DEFAULT_BRAND, FORMAT_SIZES } from "@/lib/types";
import { captionAtMs } from "@/lib/captions";
import {
  clipsTimelineMs,
  clipPositionsOnTimeline,
  magnetizeTimelineRatio,
} from "@/lib/timeline";
import { captionChrome } from "@/lib/overlayChrome";
import { OverlayCanvas } from "@/components/studio/OverlayCanvas";
import {
  StudioPreview,
  studioPreviewDuration,
} from "@/remotion/compositions/StudioPreview";
import type { CompositionProps } from "@/remotion/types";

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
  onOpacityOverlay,
  opacityHud,
  onChangeOverlayText,
  editRequestId,
  onEditRequestConsumed,
  onAddClips,
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
  onOpacityOverlay?: (id: string, opacity: number) => void;
  opacityHud?: number | null;
  onChangeOverlayText?: (id: string, text: string) => void;
  editRequestId?: string | null;
  onEditRequestConsumed?: () => void;
  onAddClips?: () => void;
}) {
  const size = FORMAT_SIZES[project.format];
  const [progress, setProgress] = useState(0);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [liveCaption, setLiveCaption] = useState("");
  const [liveCaptionWords, setLiveCaptionWords] = useState<
    { word: string; startMs: number; endMs: number }[] | null
  >(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [editingLayer, setEditingLayer] = useState<"title" | "caption" | null>(
    null,
  );
  const titleRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const editingRef = useRef<"title" | "caption" | null>(null);

  /* Remotion paints footage only — overlays live on the DOM canvas for instant edit. */
  const inputProps: CompositionProps = useMemo(
    () => ({
      brand: brand || DEFAULT_BRAND,
      format: project.format,
      preset: project.preset,
      clips: project.clips.map((c) => ({
        ...c,
        transitionOut: c.transitionOut || project.defaultTransition || "none",
      })),
      overlays: [],
      hook: project.hook,
      subtitle: project.subtitle,
      lowerThird: "",
      principle: project.principle,
      chapterLabels: project.chapterLabels,
      question: project.question,
      answer: project.answer,
      /* Captions + overlays paint on DOM for instant edit; Remotion = footage/audio. */
      captions: [],
      captionLanguage: project.captionLanguage,
      voiceOverUrl: project.voiceOver.url,
      musicUrl: project.musicUrl || brand.musicUrl,
      lookId: project.lookId || "none",
      defaultTransition: project.defaultTransition || "crossfade",
      previewPreset: false,
      musicStartMs: project.musicStartMs || 0,
      musicEndMs: project.musicEndMs || 0,
      musicVolume: project.musicVolume ?? 0.22,
      voiceOverStartMs: project.voiceOverStartMs || 0,
      voiceOverEndMs: project.voiceOverEndMs || 0,
      voiceOverVolume: project.voiceOverVolume ?? 1,
      showTitle: false,
    }),
    [project, brand],
  );

  const durationInFrames = Math.max(1, studioPreviewDuration(inputProps));
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
        h = Math.round(maxH);
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
      setPlayheadMs(ms);
      onProgressRef.current(ratio, ms);
      onPlayingChangeRef.current(Boolean(player.isPlaying()));

      const hit = captionAtMs(project.captions, ms);
      if (hit.index >= 0) {
        onActiveCaptionChangeRef.current(hit.index);
        setLiveCaption(hit.text);
        setLiveCaptionWords(hit.segment?.words?.length ? hit.segment.words : null);
      } else if (!editingRef.current) {
        setLiveCaption("");
        setLiveCaptionWords(null);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [playerRef, durationInFrames, fps, project.captions]);

  useEffect(() => {
    if (editingLayer === "title") return;
    if (titleRef.current && titleRef.current.textContent !== project.hook) {
      titleRef.current.textContent = project.hook || "Add header";
    }
  }, [project.hook, editingLayer]);

  const captionText =
    liveCaption ||
    (activeCaptionIndex >= 0 && project.captions[activeCaptionIndex]
      ? project.captions[activeCaptionIndex].text
      : project.captions[0]?.text || "");
  const captionVisible =
    showCaptionOverlay &&
    (Boolean(captionText) || selectedOverlay === "caption");

  useEffect(() => {
    if (editingLayer === "caption") return;
    if (liveCaptionWords?.length) return;
    if (
      captionRef.current &&
      captionRef.current.textContent !== (captionText || "Add caption")
    ) {
      captionRef.current.textContent = captionText || "Add caption";
    }
  }, [captionText, editingLayer, liveCaptionWords]);

  useEffect(() => {
    if (!editingLayer) return;
    const el = editingLayer === "title" ? titleRef.current : captionRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, [editingLayer]);

  function beginLayerEdit(which: "title" | "caption") {
    const el = which === "title" ? titleRef.current : captionRef.current;
    if (el) {
      el.textContent =
        which === "title"
          ? project.hook || "Add header"
          : captionText || "Add caption";
    }
    editingRef.current = which;
    setEditingLayer(which);
    onSelectOverlay(which);
  }

  function seek(ratio: number) {
    const timelineMs = Math.max(
      1000,
      clipsTimelineMs(
        project.clips,
        project.defaultTransition || "crossfade",
      ),
    );
    const snapped = magnetizeTimelineRatio(
      ratio,
      timelineMs,
      project.clips,
      project.defaultTransition || "crossfade",
    );
    const frame = Math.round(snapped * durationInFrames);
    playerRef.current?.seekTo(frame);
  }

  const scrubTicks = useMemo(() => {
    const timelineMs = Math.max(
      1000,
      clipsTimelineMs(
        project.clips,
        project.defaultTransition || "crossfade",
      ),
    );
    const pts = new Set<number>([0, 1]);
    for (const p of clipPositionsOnTimeline(
      project.clips,
      project.defaultTransition || "crossfade",
    )) {
      pts.add(p.startMs / timelineMs);
      pts.add(Math.min(1, (p.startMs + p.durationMs) / timelineMs));
    }
    return [...pts].sort((a, b) => a - b);
  }, [project.clips, project.defaultTransition]);

  const captionStyle = useMemo(() => {
    const { wrap, plate } = captionChrome(brand);
    const scale = Math.max(0.25, frameSize.h / size.height);
    return {
      wrap: {
        ...wrap,
        pointerEvents: "none" as const,
      },
      plate: {
        ...plate,
        fontSize: Math.max(11, Math.round(36 * scale)),
        padding: `${Math.max(4, Math.round(14 * scale))}px ${Math.max(8, Math.round(22 * scale))}px`,
        borderRadius: Math.max(4, Math.round(8 * scale)),
        pointerEvents: "auto" as const,
        cursor: "text" as const,
        fontFamily: brand.bodyFont || "Cabinet Grotesk",
      },
    };
  }, [brand, frameSize.h, size.height]);

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
        ["--mso-accent" as string]: brand.accent || "#c4a574",
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
            <div className="mso-preview-empty">
              <p>Drop footage onto the cut</p>
              {onAddClips ? (
                <button type="button" className="mso-btn" onClick={onAddClips}>
                  Add clips
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <OverlayCanvas
        overlays={project.overlays || []}
        brand={brand}
        selectedId={selectedOverlayId}
        playheadMs={playheadMs}
        editRequestId={editRequestId}
        onEditRequestConsumed={onEditRequestConsumed}
        onSelect={onSelectOverlayId}
        onMove={onMoveOverlay}
        onScale={(id, scale) => onScaleOverlay?.(id, scale)}
        onOpacity={(id, opacity) => onOpacityOverlay?.(id, opacity)}
        opacityHud={opacityHud}
        onChangeText={(id, text) => onChangeOverlayText?.(id, text)}
      />

      <div className="mso-overlay-layer">
        <div
          ref={titleRef}
          className={`mso-editable mso-editable-title${selectedOverlay === "title" ? " is-active" : ""}${editingLayer === "title" ? " is-editing" : ""}${showTitle ? "" : " hidden-layer"}`}
          contentEditable={editingLayer === "title"}
          suppressContentEditableWarning
          role="textbox"
          aria-label="Edit title on video"
          title={
            selectedOverlay === "title"
              ? "Click again to type"
              : "Click to select"
          }
          onBlur={(e) => {
            editingRef.current = null;
            setEditingLayer(null);
            onChangeHook(e.currentTarget.textContent?.trim() || "");
            onSelectOverlay(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (selectedOverlay === "title") {
              beginLayerEdit("title");
            } else {
              onSelectOverlay("title");
              setEditingLayer(null);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            beginLayerEdit("title");
          }}
        >
          {editingLayer === "title" ? null : project.hook || "Add header"}
        </div>

        <div
          className={`mso-caption-wrap${captionVisible ? "" : " hidden-layer"}`}
          style={captionStyle.wrap}
        >
          <div
            ref={captionRef}
            className={`mso-editable mso-editable-caption${selectedOverlay === "caption" ? " is-active" : ""}${editingLayer === "caption" ? " is-editing" : ""}`}
            style={captionStyle.plate}
            contentEditable={editingLayer === "caption"}
            suppressContentEditableWarning
            role="textbox"
            aria-label="Edit caption on video"
            title={
              selectedOverlay === "caption"
                ? "Click again to type"
                : "Click to select"
            }
            onBlur={(e) => {
              editingRef.current = null;
              setEditingLayer(null);
              const idx = Math.max(0, activeCaptionIndex);
              onChangeCaption(
                idx,
                e.currentTarget.textContent?.trim() || captionText || "",
              );
              onSelectOverlay(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (selectedOverlay === "caption") {
                beginLayerEdit("caption");
              } else {
                onSelectOverlay("caption");
                setEditingLayer(null);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              beginLayerEdit("caption");
            }}
          >
            {editingLayer === "caption" ? null : liveCaptionWords?.length ? (
              liveCaptionWords.map((w, i) => {
                const active =
                  playheadMs >= w.startMs && playheadMs <= w.endMs;
                const spoken = playheadMs >= w.startMs;
                const label = w.word.replace(/^\s+/, "");
                return (
                  <span
                    key={`${w.startMs}-${i}`}
                    className={`mso-cap-word${active ? " is-active" : ""}${spoken ? " is-spoken" : ""}`}
                  >
                    {i > 0 && !/^[.,!?']/.test(label) ? " " : ""}
                    {label}
                  </span>
                );
              })
            ) : (
              captionText || "Add caption"
            )}
          </div>
        </div>
      </div>

      <div
        className={`mso-scrub${scrubbing ? " is-scrubbing" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          const el = e.currentTarget;
          const seekFromEvent = (clientX: number) => {
            const rect = el.getBoundingClientRect();
            seek(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
          };
          setScrubbing(true);
          seekFromEvent(e.clientX);
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          const onMove = (ev: PointerEvent) => seekFromEvent(ev.clientX);
          const onUp = (ev: PointerEvent) => {
            setScrubbing(false);
            try {
              el.releasePointerCapture(ev.pointerId);
            } catch {
              /* ignore */
            }
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        <div className="mso-scrub-track">
          <div
            className="mso-scrub-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {scrubTicks.map((r) => (
          <span
            key={`st-${r}`}
            className={`mso-scrub-tick${r === 0 || r === 1 ? " is-edge" : ""}`}
            style={{ left: `${r * 100}%` }}
          />
        ))}
        <span
          className="mso-scrub-thumb"
          style={{ left: `${progress * 100}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

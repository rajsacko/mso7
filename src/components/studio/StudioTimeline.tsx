"use client";

import type { PlayerRef } from "@remotion/player";
import type { RefObject } from "react";
import type {
  CaptionSegment,
  Project,
  ProjectClip,
  ProjectOverlay,
  TransitionId,
} from "@/lib/types";
import { TRANSITION_META } from "@/lib/types";

const TRANSITION_IDS = Object.keys(TRANSITION_META) as TransitionId[];

type Props = {
  project: Project;
  sortedClips: ProjectClip[];
  timelineMs: number;
  playheadRatio: number;
  selectedClipId: string | null;
  selectedOverlayId: string | null;
  activeCaptionIndex: number;
  playerRef: RefObject<PlayerRef | null>;
  onSeekClip: (id: string) => void;
  onSplit: () => void;
  onSetClipTransition: (clipId: string, id: TransitionId) => void;
  onTrimPointerDown: (
    e: React.PointerEvent,
    clipId: string,
    edge: "in" | "out",
  ) => void;
  onMusicRangeChange: (startMs: number, endMs: number) => void;
  onSelectOverlay: (id: string) => void;
  onOverlayRangeChange: (id: string, startMs: number, endMs: number) => void;
  onSelectCaption: (index: number) => void;
  onCaptionRangeChange: (
    index: number,
    startMs: number,
    endMs: number,
  ) => void;
};

function dragEdgeOnTrack(
  e: React.PointerEvent,
  trackEl: HTMLElement | null,
  timelineMs: number,
  startMs: number,
  endMs: number,
  edge: "in" | "out",
  onChange: (start: number, end: number) => void,
  onCommit: (start: number, end: number) => void,
) {
  e.preventDefault();
  e.stopPropagation();
  if (!trackEl) return;
  const width = trackEl.getBoundingClientRect().width;
  const startX = e.clientX;
  const pxToMs = timelineMs / Math.max(1, width);
  let nextStart = startMs;
  let nextEnd = endMs;

  const onMove = (ev: PointerEvent) => {
    const delta = (ev.clientX - startX) * pxToMs;
    if (edge === "in") {
      nextStart = Math.max(0, Math.min(endMs - 200, Math.round(startMs + delta)));
    } else {
      nextEnd = Math.max(
        startMs + 200,
        Math.min(timelineMs, Math.round(endMs + delta)),
      );
    }
    onChange(nextStart, nextEnd);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    onCommit(nextStart, nextEnd);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

export function StudioTimeline({
  project,
  sortedClips,
  timelineMs,
  playheadRatio,
  selectedClipId,
  selectedOverlayId,
  activeCaptionIndex,
  playerRef,
  onSeekClip,
  onSplit,
  onSetClipTransition,
  onTrimPointerDown,
  onMusicRangeChange,
  onSelectOverlay,
  onOverlayRangeChange,
  onSelectCaption,
  onCaptionRangeChange,
}: Props) {
  const playheadLeft = `${playheadRatio * 100}%`;
  const selectedClip =
    sortedClips.find((c) => c.id === selectedClipId) ?? null;
  const overlays = project.overlays || [];
  const musicStart = project.musicStartMs || 0;
  const musicEnd =
    project.musicEndMs > 0 ? project.musicEndMs : timelineMs;

  return (
    <div className="mso-timeline-wrap">
      <div className="mso-timeline-tools">
        <button
          type="button"
          className="mso-tl-btn"
          onClick={onSplit}
          disabled={!selectedClip}
        >
          Split
        </button>
        <select
          className="mso-tl-select"
          disabled={!selectedClip}
          value={
            selectedClip?.transitionOut ||
            project.defaultTransition ||
            "crossfade"
          }
          onChange={(e) => {
            if (!selectedClip) return;
            onSetClipTransition(
              selectedClip.id,
              e.target.value as TransitionId,
            );
          }}
          aria-label="Transition out"
        >
          {TRANSITION_IDS.map((id) => (
            <option key={id} value={id}>
              {TRANSITION_META[id].name}
            </option>
          ))}
        </select>
        <span className="mso-tl-hint">
          {selectedClip
            ? "Drag edges to trim · overlays & captions on lower tracks"
            : "Select a clip to edit"}
        </span>
      </div>

      <div className="mso-timeline">
        <img className="mso-timeline-icon" src="/icons/video.svg" alt="" />
        <div className="mso-track-clips">
          <div className="mso-playhead" style={{ left: playheadLeft }} />
          {sortedClips.length ? (
            sortedClips.map((clip) => {
              const end =
                clip.trimEndMs > 0 ? clip.trimEndMs : clip.durationMs;
              const dur = Math.max(500, end - clip.trimStartMs);
              const width = `${(dur / timelineMs) * 100}%`;
              const selected = selectedClipId === clip.id;
              return (
                <div
                  key={clip.id}
                  className={`seg${selected ? " selected" : ""}`}
                  style={{ width }}
                  title={clip.name}
                  onClick={() => onSeekClip(clip.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSeekClip(clip.id);
                  }}
                >
                  <video src={clip.url} muted preload="metadata" />
                  {selected ? (
                    <>
                      <span
                        className="trim-h left"
                        onPointerDown={(e) =>
                          onTrimPointerDown(e, clip.id, "in")
                        }
                      />
                      <span
                        className="trim-h right"
                        onPointerDown={(e) =>
                          onTrimPointerDown(e, clip.id, "out")
                        }
                      />
                    </>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="seg" style={{ width: "100%", background: "#ddd" }} />
          )}
        </div>

        <img className="mso-timeline-icon" src="/icons/music.svg" alt="" />
        <div
          className={`mso-track-music${project.musicUrl ? "" : " empty"}`}
        >
          <div className="mso-playhead" style={{ left: playheadLeft }} />
          {project.musicUrl ? (
            <div
              className="mso-lane-seg music"
              style={{
                left: `${(musicStart / timelineMs) * 100}%`,
                width: `${(Math.max(200, musicEnd - musicStart) / timelineMs) * 100}%`,
              }}
              title={project.musicName || "Music"}
            >
              <span
                className="trim-h left"
                onPointerDown={(e) =>
                  dragEdgeOnTrack(
                    e,
                    e.currentTarget.closest(".mso-track-music"),
                    timelineMs,
                    musicStart,
                    musicEnd,
                    "in",
                    (s, en) => onMusicRangeChange(s, en),
                    (s, en) => onMusicRangeChange(s, en),
                  )
                }
              />
              <span
                className="trim-h right"
                onPointerDown={(e) =>
                  dragEdgeOnTrack(
                    e,
                    e.currentTarget.closest(".mso-track-music"),
                    timelineMs,
                    musicStart,
                    musicEnd,
                    "out",
                    (s, en) => onMusicRangeChange(s, en),
                    (s, en) => onMusicRangeChange(s, en),
                  )
                }
              />
            </div>
          ) : null}
        </div>

        <span className="mso-timeline-glyph" aria-hidden>
          ◆
        </span>
        <div className="mso-track-overlays">
          <div className="mso-playhead" style={{ left: playheadLeft }} />
          {overlays.map((o: ProjectOverlay) => {
            const span = Math.max(200, o.endMs - o.startMs);
            return (
              <button
                key={o.id}
                type="button"
                className={`mso-lane-seg overlay${selectedOverlayId === o.id ? " selected" : ""}`}
                style={{
                  left: `${(o.startMs / timelineMs) * 100}%`,
                  width: `${(span / timelineMs) * 100}%`,
                }}
                title={`${o.kind}: ${o.text || "layer"}`}
                onClick={() => onSelectOverlay(o.id)}
              >
                <span
                  className="trim-h left"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragEdgeOnTrack(
                      e,
                      e.currentTarget.closest(".mso-track-overlays"),
                      timelineMs,
                      o.startMs,
                      o.endMs,
                      "in",
                      (s, en) => onOverlayRangeChange(o.id, s, en),
                      (s, en) => onOverlayRangeChange(o.id, s, en),
                    );
                  }}
                />
                <span
                  className="trim-h right"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragEdgeOnTrack(
                      e,
                      e.currentTarget.closest(".mso-track-overlays"),
                      timelineMs,
                      o.startMs,
                      o.endMs,
                      "out",
                      (s, en) => onOverlayRangeChange(o.id, s, en),
                      (s, en) => onOverlayRangeChange(o.id, s, en),
                    );
                  }}
                />
              </button>
            );
          })}
        </div>

        <img
          className="mso-timeline-icon"
          src="/icons/captions.svg"
          alt=""
        />
        <div className="mso-track-captions">
          <div className="mso-playhead" style={{ left: playheadLeft }} />
          {project.captions.length ? (
            project.captions.map((cap: CaptionSegment, index: number) => {
              const span = Math.max(200, cap.endMs - cap.startMs);
              return (
                <button
                  key={`${cap.startMs}-${index}`}
                  type="button"
                  className={`cap mso-lane-seg${activeCaptionIndex === index ? " active" : ""}`}
                  style={{
                    width: `${(span / timelineMs) * 100}%`,
                    left: `${(cap.startMs / timelineMs) * 100}%`,
                  }}
                  title={cap.text}
                  onClick={() => {
                    onSelectCaption(index);
                    const frame = Math.round((cap.startMs / 1000) * 30);
                    playerRef.current?.seekTo(frame);
                  }}
                >
                  <span
                    className="trim-h left"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      dragEdgeOnTrack(
                        e,
                        e.currentTarget.closest(".mso-track-captions"),
                        timelineMs,
                        cap.startMs,
                        cap.endMs,
                        "in",
                        (s, en) => onCaptionRangeChange(index, s, en),
                        (s, en) => onCaptionRangeChange(index, s, en),
                      );
                    }}
                  />
                  <span
                    className="trim-h right"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      dragEdgeOnTrack(
                        e,
                        e.currentTarget.closest(".mso-track-captions"),
                        timelineMs,
                        cap.startMs,
                        cap.endMs,
                        "out",
                        (s, en) => onCaptionRangeChange(index, s, en),
                        (s, en) => onCaptionRangeChange(index, s, en),
                      );
                    }}
                  />
                </button>
              );
            })
          ) : (
            <div style={{ display: "flex", gap: "0.25rem", width: "100%" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="cap placeholder" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

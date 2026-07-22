"use client";

import type { PlayerRef } from "@remotion/player";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  CaptionSegment,
  Project,
  ProjectClip,
  ProjectOverlay,
  TransitionId,
} from "@/lib/types";
import { TRANSITION_META } from "@/lib/types";
import { clipPositionsOnTimeline, formatTimecode } from "@/lib/timeline";
import { ClipFilmstrip } from "./ClipFilmstrip";

const TRANSITION_IDS = Object.keys(TRANSITION_META) as TransitionId[];

function formatClipDur(ms: number) {
  if (ms < 10000) return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
  return formatTimecode(ms);
}

type Props = {
  project: Project;
  sortedClips: ProjectClip[];
  timelineMs: number;
  playheadRatio: number;
  playheadMs: number;
  selectedClipId: string | null;
  selectedOverlayId: string | null;
  activeCaptionIndex: number;
  playerRef: RefObject<PlayerRef | null>;
  onSeekRatio: (ratio: number) => void;
  onSeekClip: (id: string) => void;
  onSplit: () => void;
  onSetClipTransition: (clipId: string, id: TransitionId) => void;
  onTrimPointerDown: (
    e: React.PointerEvent,
    clipId: string,
    edge: "in" | "out",
  ) => void;
  onMusicRangeLive: (startMs: number, endMs: number) => void;
  onMusicRangeCommit: (startMs: number, endMs: number) => void;
  onVoiceRangeLive: (startMs: number, endMs: number) => void;
  onVoiceRangeCommit: (startMs: number, endMs: number) => void;
  onSelectOverlay: (id: string) => void;
  onOverlayRangeChange: (id: string, startMs: number, endMs: number) => void;
  onSelectCaption: (index: number) => void;
  onCaptionRangeLive: (index: number, startMs: number, endMs: number) => void;
  onCaptionRangeCommit: (
    index: number,
    startMs: number,
    endMs: number,
  ) => void;
  timelineZoom: number;
  onTimelineZoom: (zoom: number) => void;
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

function seekFromTrackClick(
  e: React.MouseEvent,
  onSeekRatio: (ratio: number) => void,
) {
  const track = e.currentTarget as HTMLElement;
  if ((e.target as HTMLElement).closest(
    ".seg, .mso-lane-seg, .cap, .trim-h, .mso-tl-join",
  )) {
    return;
  }
  const rect = track.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  onSeekRatio(ratio);
}

export function StudioTimeline({
  project,
  sortedClips,
  timelineMs,
  playheadRatio,
  playheadMs,
  selectedClipId,
  selectedOverlayId,
  activeCaptionIndex,
  playerRef,
  onSeekRatio,
  onSeekClip,
  onSplit,
  onSetClipTransition,
  onTrimPointerDown,
  onMusicRangeLive,
  onMusicRangeCommit,
  onVoiceRangeLive,
  onVoiceRangeCommit,
  onSelectOverlay,
  onOverlayRangeChange,
  onSelectCaption,
  onCaptionRangeLive,
  onCaptionRangeCommit,
  timelineZoom,
  onTimelineZoom,
}: Props) {
  const playheadLeft = `${playheadRatio * 100}%`;
  const selectedClip =
    sortedClips.find((c) => c.id === selectedClipId) ?? null;
  const overlays = project.overlays || [];
  const musicStart = project.musicStartMs || 0;
  const musicEnd =
    project.musicEndMs > 0 ? project.musicEndMs : timelineMs;
  const hasVo = Boolean(
    project.voiceOver?.url && project.voiceOver.status === "ready",
  );
  const voStart = project.voiceOverStartMs || 0;
  const voEnd =
    project.voiceOverEndMs > 0 ? project.voiceOverEndMs : timelineMs;
  const [joinMenuId, setJoinMenuId] = useState<string | null>(null);
  const joinMenuRef = useRef<HTMLDivElement>(null);
  const [edgeHud, setEdgeHud] = useState<{
    key: string;
    startMs: number;
    endMs: number;
  } | null>(null);

  function laneTrim(
    e: React.PointerEvent,
    trackEl: HTMLElement | null,
    key: string,
    startMs: number,
    endMs: number,
    edge: "in" | "out",
    onLive: (s: number, en: number) => void,
    onCommit: (s: number, en: number) => void,
  ) {
    setEdgeHud({ key, startMs, endMs });
    dragEdgeOnTrack(
      e,
      trackEl,
      timelineMs,
      startMs,
      endMs,
      edge,
      (s, en) => {
        setEdgeHud({ key, startMs: s, endMs: en });
        onLive(s, en);
      },
      (s, en) => {
        setEdgeHud(null);
        onCommit(s, en);
      },
    );
  }

  const clipLayout = useMemo(
    () =>
      clipPositionsOnTimeline(
        sortedClips,
        project.defaultTransition || "crossfade",
      ),
    [sortedClips, project.defaultTransition],
  );

  const layoutById = useMemo(() => {
    return new Map(clipLayout.map((c) => [c.id, c]));
  }, [clipLayout]);

  const joinTicks = useMemo(() => {
    const pts = new Set<number>([0, 1]);
    for (const p of clipLayout) {
      pts.add(p.startMs / Math.max(1, timelineMs));
      pts.add(
        Math.min(1, (p.startMs + p.durationMs) / Math.max(1, timelineMs)),
      );
    }
    return [...pts].sort((a, b) => a - b);
  }, [clipLayout, timelineMs]);

  useEffect(() => {
    if (!joinMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (joinMenuRef.current && !joinMenuRef.current.contains(t)) {
        setJoinMenuId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setJoinMenuId(null);
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [joinMenuId]);

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
          aria-label="Transition at join"
        >
          {TRANSITION_IDS.map((id) => (
            <option key={id} value={id}>
              {TRANSITION_META[id].name}
            </option>
          ))}
        </select>
        <span className="mso-tl-time" aria-live="polite">
          {formatTimecode(playheadMs)}
          <span className="mso-tl-time-sep">/</span>
          {formatTimecode(timelineMs)}
        </span>
        <div className="mso-tl-zoom" role="group" aria-label="Timeline zoom">
          <button
            type="button"
            className="mso-tl-btn"
            disabled={timelineZoom <= 1}
            onClick={() =>
              onTimelineZoom(
                Math.max(1, Math.round((timelineZoom - 0.25) * 100) / 100),
              )
            }
            title="Zoom out (Ctrl+-)"
          >
            −
          </button>
          <button
            type="button"
            className="mso-tl-btn mso-tl-zoom-label"
            onClick={() => onTimelineZoom(1)}
            title="Fit (Ctrl+0)"
          >
            {Math.round(timelineZoom * 100)}%
          </button>
          <button
            type="button"
            className="mso-tl-btn"
            disabled={timelineZoom >= 4}
            onClick={() =>
              onTimelineZoom(
                Math.min(4, Math.round((timelineZoom + 0.25) * 100) / 100),
              )
            }
            title="Zoom in (Ctrl+=)"
          >
            +
          </button>
        </div>
        <span className="mso-tl-hint">
          {selectedClip
            ? "Space play · Ctrl+B split · Shift+Del ripple · ←→ snap"
            : "Select a clip · Space play · Ctrl± zoom"}
        </span>
      </div>

      <div className="mso-timeline">
        <div className="mso-timeline-icons" aria-hidden>
          <img src="/icons/video.svg" alt="" />
          <img src="/icons/music.svg" alt="" />
          <img src="/icons/mic.svg" alt="" />
          <img src="/icons/layers.svg" alt="" />
          <img src="/icons/captions.svg" alt="" />
        </div>

        <div
          className="mso-timeline-scroll"
          onWheel={(e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const next =
              e.deltaY < 0
                ? Math.min(4, Math.round((timelineZoom + 0.25) * 100) / 100)
                : Math.max(1, Math.round((timelineZoom - 0.25) * 100) / 100);
            onTimelineZoom(next);
          }}
        >
          <div
            className="mso-timeline-stack"
            style={{ width: `${Math.max(100, timelineZoom * 100)}%` }}
          >
          <div
            className="mso-playhead-spine"
            style={{ left: playheadLeft }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const stack = e.currentTarget.parentElement;
              if (!stack) return;
              const seekFrom = (clientX: number) => {
                const rect = stack.getBoundingClientRect();
                onSeekRatio(
                  Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
                );
              };
              seekFrom(e.clientX);
              const spine = e.currentTarget;
              spine.classList.add("is-dragging");
              try {
                spine.setPointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              const onMove = (ev: PointerEvent) => seekFrom(ev.clientX);
              const onUp = (ev: PointerEvent) => {
                spine.classList.remove("is-dragging");
                try {
                  spine.releasePointerCapture(ev.pointerId);
                } catch {
                  /* ignore */
                }
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
            role="slider"
            aria-label="Playhead"
            aria-valuemin={0}
            aria-valuemax={Math.round(timelineMs)}
            aria-valuenow={Math.round(playheadMs)}
            tabIndex={0}
          >
            <span className="mso-playhead-knob" aria-hidden />
          </div>
          <div className="mso-tl-ticks" aria-hidden>
            {joinTicks.map((r) => (
              <span
                key={`tick-${r}`}
                className="mso-tl-tick"
                style={{ left: `${r * 100}%` }}
              />
            ))}
          </div>

          <div
            className="mso-track-clips"
            onClick={(e) => seekFromTrackClick(e, onSeekRatio)}
          >
            {sortedClips.length ? (
              sortedClips.map((clip) => {
                const layout = layoutById.get(clip.id);
                const dur = layout?.durationMs || 1000;
                const start = layout?.startMs || 0;
                const selected = selectedClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    className={`seg${selected ? " selected" : ""}`}
                    style={{
                      left: `${(start / Math.max(1, timelineMs)) * 100}%`,
                      width: `${(dur / Math.max(1, timelineMs)) * 100}%`,
                    }}
                    title={clip.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeekClip(clip.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSeekClip(clip.id);
                    }}
                  >
                    <ClipFilmstrip
                      src={clip.url}
                      trimStartMs={clip.trimStartMs}
                      trimEndMs={
                        clip.trimEndMs > 0 ? clip.trimEndMs : clip.durationMs
                      }
                      durationMs={clip.durationMs}
                      widthPx={Math.max(
                        60,
                        Math.round(
                          (dur / Math.max(1, timelineMs)) *
                            (typeof window !== "undefined"
                              ? window.innerWidth * 0.55
                              : 400),
                        ),
                      )}
                    />
                    {selected ? (
                      <>
                        <span className="mso-seg-name" title={clip.name}>
                          {clip.name || "Clip"}
                        </span>
                        <span className="mso-seg-dur">{formatClipDur(dur)}</span>
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
              <div className="mso-track-empty">Add clips</div>
            )}
            {clipLayout.slice(0, -1).map((layout, index) => {
              const clip = sortedClips.find((c) => c.id === layout.id);
              if (!clip) return null;
              const tid =
                clip.transitionOut ||
                project.defaultTransition ||
                "crossfade";
              const next = clipLayout[index + 1];
              if (!next) return null;
              const left = (next.startMs / Math.max(1, timelineMs)) * 100;
              const open = joinMenuId === clip.id;
              return (
                <div
                  key={`x-${clip.id}`}
                  className={`mso-tl-join${open ? " is-open" : ""}`}
                  style={{ left: `${left}%` }}
                  ref={open ? joinMenuRef : undefined}
                >
                  <button
                    type="button"
                    className="mso-tl-join-hit"
                    title={`${TRANSITION_META[tid].name} · change transition`}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setJoinMenuId(open ? null : clip.id);
                    }}
                  >
                    <span className="mso-tl-join-mark" data-kind={tid} />
                  </button>
                  {open ? (
                    <div className="mso-tl-join-menu" role="menu">
                      <p className="mso-tl-join-menu-title">Transition</p>
                      {TRANSITION_IDS.map((id) => (
                        <button
                          key={id}
                          type="button"
                          role="menuitem"
                          className={`mso-tl-join-opt${tid === id ? " is-active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSetClipTransition(clip.id, id);
                            setJoinMenuId(null);
                          }}
                        >
                          {TRANSITION_META[id].name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div
            className={`mso-track-music${project.musicUrl ? "" : " empty"}`}
            onClick={(e) => seekFromTrackClick(e, onSeekRatio)}
          >
            {project.musicUrl ? (
              <div
                className="mso-lane-seg music"
                style={{
                  left: `${(musicStart / Math.max(1, timelineMs)) * 100}%`,
                  width: `${(Math.max(200, musicEnd - musicStart) / Math.max(1, timelineMs)) * 100}%`,
                }}
                title={project.musicName || "Music"}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="mso-audio-label">
                  {project.musicName || "Music"}
                </span>
                {edgeHud?.key === "music" ? (
                  <span className="mso-seg-dur">
                    {formatClipDur(edgeHud.endMs - edgeHud.startMs)}
                  </span>
                ) : null}
                <span
                  className="trim-h left"
                  onPointerDown={(e) =>
                    laneTrim(
                      e,
                      e.currentTarget.closest(".mso-track-music"),
                      "music",
                      musicStart,
                      musicEnd,
                      "in",
                      onMusicRangeLive,
                      onMusicRangeCommit,
                    )
                  }
                />
                <span
                  className="trim-h right"
                  onPointerDown={(e) =>
                    laneTrim(
                      e,
                      e.currentTarget.closest(".mso-track-music"),
                      "music",
                      musicStart,
                      musicEnd,
                      "out",
                      onMusicRangeLive,
                      onMusicRangeCommit,
                    )
                  }
                />
              </div>
            ) : (
              <div className="mso-track-empty soft">Music</div>
            )}
          </div>

          <div
            className={`mso-track-voice${hasVo ? "" : " empty"}`}
            onClick={(e) => seekFromTrackClick(e, onSeekRatio)}
          >
            {hasVo ? (
              <div
                className="mso-lane-seg voice"
                style={{
                  left: `${(voStart / Math.max(1, timelineMs)) * 100}%`,
                  width: `${(Math.max(200, voEnd - voStart) / Math.max(1, timelineMs)) * 100}%`,
                }}
                title="Voiceover"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="mso-audio-label">Voiceover</span>
                {edgeHud?.key === "voice" ? (
                  <span className="mso-seg-dur">
                    {formatClipDur(edgeHud.endMs - edgeHud.startMs)}
                  </span>
                ) : null}
                <span
                  className="trim-h left"
                  onPointerDown={(e) =>
                    laneTrim(
                      e,
                      e.currentTarget.closest(".mso-track-voice"),
                      "voice",
                      voStart,
                      voEnd,
                      "in",
                      onVoiceRangeLive,
                      onVoiceRangeCommit,
                    )
                  }
                />
                <span
                  className="trim-h right"
                  onPointerDown={(e) =>
                    laneTrim(
                      e,
                      e.currentTarget.closest(".mso-track-voice"),
                      "voice",
                      voStart,
                      voEnd,
                      "out",
                      onVoiceRangeLive,
                      onVoiceRangeCommit,
                    )
                  }
                />
              </div>
            ) : (
              <div className="mso-track-empty soft">Voice</div>
            )}
          </div>

          <div
            className="mso-track-overlays"
            onClick={(e) => seekFromTrackClick(e, onSeekRatio)}
          >
            {overlays.length ? (
              overlays.map((o: ProjectOverlay) => {
                const span = Math.max(200, o.endMs - o.startMs);
                const label =
                  o.kind === "text" || o.kind === "badge"
                    ? (o.text || "").trim() || "Text"
                    : o.kind === "logo"
                      ? "Logo"
                      : o.kind === "image"
                        ? "Image"
                        : o.kind === "video"
                          ? "Clip"
                          : o.kind;
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`mso-lane-seg overlay kind-${o.kind}${selectedOverlayId === o.id ? " selected" : ""}`}
                    style={{
                      left: `${(o.startMs / Math.max(1, timelineMs)) * 100}%`,
                      width: `${(span / Math.max(1, timelineMs)) * 100}%`,
                    }}
                    title={`${o.kind}: ${label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOverlay(o.id);
                    }}
                  >
                    <span className="mso-ov-label">{label}</span>
                    {edgeHud?.key === o.id ? (
                      <span className="mso-seg-dur">
                        {formatClipDur(edgeHud.endMs - edgeHud.startMs)}
                      </span>
                    ) : null}
                    <span
                      className="trim-h left"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        laneTrim(
                          e,
                          e.currentTarget.closest(".mso-track-overlays"),
                          o.id,
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
                        laneTrim(
                          e,
                          e.currentTarget.closest(".mso-track-overlays"),
                          o.id,
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
              })
            ) : (
              <div className="mso-track-empty soft">Text · logo</div>
            )}
          </div>

          <div
            className="mso-track-captions"
            onClick={(e) => seekFromTrackClick(e, onSeekRatio)}
          >
            {project.captions.length ? (
              project.captions.map((cap: CaptionSegment, index: number) => {
                const span = Math.max(200, cap.endMs - cap.startMs);
                const label =
                  (cap.text || "").trim() || `Caption ${index + 1}`;
                return (
                  <button
                    key={`${cap.startMs}-${index}`}
                    type="button"
                    className={`cap mso-lane-seg${activeCaptionIndex === index ? " active" : ""}`}
                    style={{
                      width: `${(span / Math.max(1, timelineMs)) * 100}%`,
                      left: `${(cap.startMs / Math.max(1, timelineMs)) * 100}%`,
                    }}
                    title={label}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCaption(index);
                      const frame = Math.round((cap.startMs / 1000) * 30);
                      playerRef.current?.seekTo(frame);
                    }}
                  >
                    <span className="mso-cap-label">{label}</span>
                    {edgeHud?.key === `cap-${index}` ? (
                      <span className="mso-seg-dur">
                        {formatClipDur(edgeHud.endMs - edgeHud.startMs)}
                      </span>
                    ) : null}
                    <span
                      className="trim-h left"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        laneTrim(
                          e,
                          e.currentTarget.closest(".mso-track-captions"),
                          `cap-${index}`,
                          cap.startMs,
                          cap.endMs,
                          "in",
                          (s, en) => onCaptionRangeLive(index, s, en),
                          (s, en) => onCaptionRangeCommit(index, s, en),
                        );
                      }}
                    />
                    <span
                      className="trim-h right"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        laneTrim(
                          e,
                          e.currentTarget.closest(".mso-track-captions"),
                          `cap-${index}`,
                          cap.startMs,
                          cap.endMs,
                          "out",
                          (s, en) => onCaptionRangeLive(index, s, en),
                          (s, en) => onCaptionRangeCommit(index, s, en),
                        );
                      }}
                    />
                  </button>
                );
              })
            ) : (
              <div className="mso-track-empty soft">Captions</div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

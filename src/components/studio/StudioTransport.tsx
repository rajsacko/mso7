"use client";

import { formatTimecode } from "@/lib/timeline";

export function StudioTransport({
  muted,
  playing,
  isFullscreen,
  playheadMs,
  timelineMs,
  onToggleMute,
  onTogglePlay,
  onToggleFullscreen,
}: {
  muted: boolean;
  playing: boolean;
  isFullscreen: boolean;
  playheadMs: number;
  timelineMs: number;
  onToggleMute: () => void;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="mso-transport">
      <button
        type="button"
        className={`mso-icon-btn${muted ? " is-active" : ""}`}
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={onToggleMute}
      >
        <img src={muted ? "/icons/mute.svg" : "/icons/speaker.svg"} alt="" />
      </button>
      <button
        type="button"
        className={`mso-icon-btn${playing ? " is-active" : ""}`}
        aria-label={playing ? "Pause" : "Play"}
        onClick={onTogglePlay}
      >
        <img src={playing ? "/icons/pause.svg" : "/icons/play.svg"} alt="" />
      </button>
      <span className="mso-transport-time" aria-live="polite">
        {formatTimecode(playheadMs)}
        <span className="mso-tl-time-sep">/</span>
        {formatTimecode(timelineMs)}
      </span>
      <button
        type="button"
        className="mso-icon-btn"
        aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        onClick={onToggleFullscreen}
      >
        <img
          src={
            isFullscreen
              ? "/icons/exit-fullscreen.svg"
              : "/icons/fullscreen.svg"
          }
          alt=""
        />
      </button>
    </div>
  );
}

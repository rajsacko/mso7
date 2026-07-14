"use client";

export function StudioTransport({
  muted,
  playing,
  isFullscreen,
  onToggleMute,
  onTogglePlay,
  onToggleFullscreen,
}: {
  muted: boolean;
  playing: boolean;
  isFullscreen: boolean;
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

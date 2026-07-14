import type { ProjectClip, TransitionId } from "./types";
import { TRANSITION_META } from "./types";

export const FPS = 30;

export function usableClipDurationMs(clip: ProjectClip) {
  const end =
    clip.trimEndMs > 0 ? clip.trimEndMs : clip.durationMs || 5000;
  return Math.max(500, end - clip.trimStartMs);
}

export function clipsTimelineFrames(
  clips: ProjectClip[],
  fallbackTransition: TransitionId = "none",
) {
  const sorted = [...clips].sort((a, b) => a.order - b.order);
  if (!sorted.length) return 1;
  let total = 0;
  sorted.forEach((clip, index) => {
    total += Math.max(
      1,
      Math.round((usableClipDurationMs(clip) / 1000) * FPS),
    );
    if (index < sorted.length - 1) {
      const tid = clip.transitionOut || fallbackTransition;
      const frames =
        tid === "none" ? 0 : (TRANSITION_META[tid]?.frames ?? 18);
      total -= frames;
    }
  });
  return Math.max(1, total);
}

/** Transition-aware timeline length in ms (matches Remotion playhead). */
export function clipsTimelineMs(
  clips: ProjectClip[],
  fallbackTransition: TransitionId = "none",
) {
  return Math.round(
    (clipsTimelineFrames(clips, fallbackTransition) / FPS) * 1000,
  );
}

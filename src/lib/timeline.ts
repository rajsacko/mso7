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

/** Absolute start times for clips on the transition-aware timeline. */
export function clipPositionsOnTimeline(
  clips: ProjectClip[],
  fallbackTransition: TransitionId = "none",
): { id: string; startMs: number; durationMs: number }[] {
  const sorted = [...clips].sort((a, b) => a.order - b.order);
  let cursorFrames = 0;
  return sorted.map((clip, index) => {
    const durationMs = usableClipDurationMs(clip);
    const durFrames = Math.max(1, Math.round((durationMs / 1000) * FPS));
    const startMs = Math.round((cursorFrames / FPS) * 1000);
    cursorFrames += durFrames;
    if (index < sorted.length - 1) {
      const tid = clip.transitionOut || fallbackTransition;
      const frames =
        tid === "none" ? 0 : (TRANSITION_META[tid]?.frames ?? 18);
      cursorFrames -= frames;
    }
    return { id: clip.id, startMs, durationMs };
  });
}

export function formatTimecode(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Absolute join / edge times on the transition-aware timeline. */
export function timelineJoinPointsMs(
  clips: ProjectClip[],
  timelineMs: number,
  fallbackTransition: TransitionId = "none",
): number[] {
  const total = Math.max(1, timelineMs);
  const pts = new Set<number>([0, total]);
  for (const p of clipPositionsOnTimeline(clips, fallbackTransition)) {
    pts.add(p.startMs);
    pts.add(Math.min(total, p.startMs + p.durationMs));
  }
  return [...pts].sort((a, b) => a - b);
}

/** Step playhead to previous/next clip join (for ←→ without an overlay selected). */
export function stepPlayheadToJoin(
  currentMs: number,
  direction: -1 | 1,
  clips: ProjectClip[],
  timelineMs: number,
  fallbackTransition: TransitionId = "none",
  epsilonMs = 40,
): number {
  const points = timelineJoinPointsMs(clips, timelineMs, fallbackTransition);
  if (direction > 0) {
    return points.find((p) => p > currentMs + epsilonMs) ?? points[points.length - 1];
  }
  return (
    [...points].reverse().find((p) => p < currentMs - epsilonMs) ?? 0
  );
}

/** Snap scrub ratio to clip joins / ends when within threshold. */
export function magnetizeTimelineRatio(
  ratio: number,
  timelineMs: number,
  clips: ProjectClip[],
  fallbackTransition: TransitionId = "none",
  thresholdMs = 140,
): number {
  const total = Math.max(1, timelineMs);
  const ms = Math.min(total, Math.max(0, ratio * total));
  const points = [0, total];
  for (const p of clipPositionsOnTimeline(clips, fallbackTransition)) {
    points.push(p.startMs, Math.min(total, p.startMs + p.durationMs));
  }
  let best = ms;
  let bestDist = thresholdMs;
  for (const p of points) {
    const d = Math.abs(ms - p);
    if (d <= bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best / total;
}

/** Shift timed layers left after a cut so the edit closes the gap. */
export function rippleShiftTimedLayers<
  T extends {
    overlays?: { startMs: number; endMs: number }[];
    captions?: { startMs: number; endMs: number }[];
    musicStartMs?: number;
    musicEndMs?: number;
    voiceOverStartMs?: number;
    voiceOverEndMs?: number;
  },
>(project: T, cutStartMs: number, shrinkMs: number): T {
  if (shrinkMs <= 0) return project;
  const shift = (start: number, end: number) => {
    if (end <= cutStartMs) return { startMs: start, endMs: end };
    if (start >= cutStartMs) {
      return {
        startMs: Math.max(0, start - shrinkMs),
        endMs: Math.max(200, end - shrinkMs),
      };
    }
    return { startMs: start, endMs: Math.max(start + 200, end - shrinkMs) };
  };

  const overlays = (project.overlays || []).map((o) => ({
    ...o,
    ...shift(o.startMs, o.endMs),
  }));
  const captions = (project.captions || []).map((c) => ({
    ...c,
    ...shift(c.startMs, c.endMs),
  }));

  let musicStartMs = project.musicStartMs || 0;
  let musicEndMs =
    project.musicEndMs && project.musicEndMs > 0
      ? project.musicEndMs
      : musicStartMs;
  if (musicEndMs > cutStartMs) {
    if (musicStartMs >= cutStartMs) {
      musicStartMs = Math.max(0, musicStartMs - shrinkMs);
      musicEndMs = Math.max(musicStartMs + 200, musicEndMs - shrinkMs);
    } else {
      musicEndMs = Math.max(musicStartMs + 200, musicEndMs - shrinkMs);
    }
  }

  let voiceOverStartMs = project.voiceOverStartMs || 0;
  let voiceOverEndMs =
    project.voiceOverEndMs && project.voiceOverEndMs > 0
      ? project.voiceOverEndMs
      : voiceOverStartMs;
  if (voiceOverEndMs > cutStartMs) {
    if (voiceOverStartMs >= cutStartMs) {
      voiceOverStartMs = Math.max(0, voiceOverStartMs - shrinkMs);
      voiceOverEndMs = Math.max(
        voiceOverStartMs + 200,
        voiceOverEndMs - shrinkMs,
      );
    } else {
      voiceOverEndMs = Math.max(
        voiceOverStartMs + 200,
        voiceOverEndMs - shrinkMs,
      );
    }
  }

  return {
    ...project,
    overlays,
    captions,
    musicStartMs,
    musicEndMs,
    voiceOverStartMs,
    voiceOverEndMs,
  };
}

/** Keep overlay / music / caption ranges inside the current cut. */
export function clampLayersToTimeline<
  T extends {
    overlays?: { startMs: number; endMs: number }[];
    captions?: { startMs: number; endMs: number }[];
    musicStartMs?: number;
    musicEndMs?: number;
    voiceOverStartMs?: number;
    voiceOverEndMs?: number;
  },
>(project: T, timelineMs: number): T {
  const max = Math.max(1000, timelineMs);
  const overlays = (project.overlays || []).map((o) => ({
    ...o,
    startMs: Math.max(0, Math.min(o.startMs, max - 200)),
    endMs: Math.max(
      Math.min(o.startMs, max - 200) + 200,
      Math.min(o.endMs, max),
    ),
  }));
  const captions = (project.captions || []).map((c) => ({
    ...c,
    startMs: Math.max(0, Math.min(c.startMs, max - 200)),
    endMs: Math.max(
      Math.min(c.startMs, max - 200) + 200,
      Math.min(c.endMs, max),
    ),
  }));
  const musicStartMs = Math.max(0, Math.min(project.musicStartMs || 0, max));
  let musicEndMs =
    project.musicEndMs && project.musicEndMs > 0
      ? project.musicEndMs
      : max;
  musicEndMs = Math.max(musicStartMs + 200, Math.min(musicEndMs, max));

  const voiceOverStartMs = Math.max(
    0,
    Math.min(project.voiceOverStartMs || 0, max),
  );
  let voiceOverEndMs =
    project.voiceOverEndMs && project.voiceOverEndMs > 0
      ? project.voiceOverEndMs
      : max;
  voiceOverEndMs = Math.max(
    voiceOverStartMs + 200,
    Math.min(voiceOverEndMs, max),
  );

  return {
    ...project,
    overlays,
    captions,
    musicStartMs,
    musicEndMs,
    voiceOverStartMs,
    voiceOverEndMs,
  };
}

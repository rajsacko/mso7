import { v4 as uuid } from "uuid";
import type {
  OverlayAnchor,
  OverlayKind,
  ProjectClip,
  ProjectOverlay,
  TransitionId,
} from "./types";
import { TRANSITION_META } from "./types";
import { usableClipDurationMs } from "./timeline";

export function normalizeClip(clip: ProjectClip): ProjectClip {
  return {
    ...clip,
    transitionOut: clip.transitionOut || "none",
    trimStartMs: clip.trimStartMs ?? 0,
    trimEndMs: clip.trimEndMs || clip.durationMs,
  };
}

/** Split a clip at ms relative to the clip's usable (trimmed) range. */
export function splitClipAt(
  clip: ProjectClip,
  localMs: number,
): [ProjectClip, ProjectClip] | null {
  const start = clip.trimStartMs;
  const end = clip.trimEndMs > 0 ? clip.trimEndMs : clip.durationMs;
  const cut = start + localMs;
  if (cut <= start + 400 || cut >= end - 400) return null;

  const left: ProjectClip = {
    ...clip,
    id: uuid(),
    name: `${clip.name} · A`,
    trimStartMs: start,
    trimEndMs: cut,
    transitionOut: clip.transitionOut || "none",
  };
  const right: ProjectClip = {
    ...clip,
    id: uuid(),
    name: `${clip.name} · B`,
    trimStartMs: cut,
    trimEndMs: end,
    transitionOut: clip.transitionOut || "none",
  };
  return [left, right];
}

export function createOverlay(input: {
  kind: OverlayKind;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  anchor?: OverlayAnchor;
  durationMs?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
}): ProjectOverlay {
  const defaults =
    input.kind === "logo"
      ? { offsetX: 34, offsetY: -40, scale: 1, anchor: "top-right" as OverlayAnchor }
      : input.kind === "image" || input.kind === "video"
        ? { offsetX: 0, offsetY: 0, scale: 1, anchor: "center" as OverlayAnchor }
        : input.kind === "badge"
          ? { offsetX: 0, offsetY: 36, scale: 1, anchor: "bottom-center" as OverlayAnchor }
          : { offsetX: 0, offsetY: -28, scale: 1, anchor: "top-center" as OverlayAnchor };

  return {
    id: uuid(),
    kind: input.kind,
    text:
      input.text ||
      (input.kind === "logo" || input.kind === "image" || input.kind === "video"
        ? ""
        : "Type here"),
    imageUrl: input.imageUrl,
    videoUrl: input.videoUrl,
    anchor: input.anchor || defaults.anchor,
    offsetX: input.offsetX ?? defaults.offsetX,
    offsetY: input.offsetY ?? defaults.offsetY,
    scale: input.scale ?? defaults.scale,
    opacity: 1,
    startMs: 0,
    endMs: input.durationMs || 12000,
    fontFamily: input.kind === "text" || input.kind === "badge" ? "Cabinet Grotesk" : undefined,
    fontSize: input.kind === "badge" ? 28 : input.kind === "text" ? 36 : undefined,
    color: input.kind === "text" || input.kind === "badge" ? "#ffffff" : undefined,
    hasPlate: input.kind === "badge",
    fillColor: input.kind === "logo" ? "#ffffff" : undefined,
  };
}

export function setClipTransition(
  clips: ProjectClip[],
  clipId: string,
  transitionOut: TransitionId,
) {
  return clips.map((c) => (c.id === clipId ? { ...c, transitionOut } : c));
}

/** Intro packing removed — timeline ms starts at 0. */
export function presetLeadInMs(_previewPreset?: boolean) {
  return 0;
}

/** Map absolute playhead ms → local ms within a clip’s trimmed range. */
export function playheadToClipLocalMs(
  clips: ProjectClip[],
  clipId: string,
  playheadMs: number,
  leadInMs: number,
  fallbackTransition: TransitionId = "none",
): number | null {
  let cursor = leadInMs;
  const sorted = [...clips].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sorted.length; i++) {
    const clip = sorted[i];
    const dur = usableClipDurationMs(clip);
    if (clip.id === clipId) {
      return playheadMs - cursor;
    }
    cursor += dur;
    if (i < sorted.length - 1) {
      const tid = clip.transitionOut || fallbackTransition;
      const frames =
        tid === "none" ? 0 : (TRANSITION_META[tid]?.frames ?? 18);
      cursor -= (frames / 30) * 1000;
    }
  }
  return null;
}

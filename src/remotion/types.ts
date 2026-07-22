import type {
  BrandKit,
  CaptionSegment,
  FormatId,
  LookId,
  PresetId,
  ProjectClip,
  ProjectOverlay,
  TransitionId,
} from "../lib/types";
import {
  clipsTimelineFrames,
  usableClipDurationMs as usableMs,
} from "../lib/timeline";

export interface CompositionProps {
  brand: BrandKit;
  format: FormatId;
  preset: PresetId;
  clips: ProjectClip[];
  overlays?: ProjectOverlay[];
  hook: string;
  subtitle: string;
  lowerThird: string;
  principle: string;
  chapterLabels: string[];
  question: string;
  answer: string;
  captions: CaptionSegment[];
  captionLanguage: "en" | "fr" | "bilingual";
  voiceOverUrl?: string;
  musicUrl?: string;
  lookId?: LookId;
  defaultTransition?: TransitionId;
  /** When false, preview/render clips only (no intro/outro cards). */
  previewPreset?: boolean;
  musicStartMs?: number;
  musicEndMs?: number;
  musicVolume?: number;
  voiceOverStartMs?: number;
  voiceOverEndMs?: number;
  voiceOverVolume?: number;
  showTitle?: boolean;
  showCaptionOverlay?: boolean;
  [key: string]: unknown;
}

export const FPS = 30;
export const INTRO_FRAMES = 75;
export const OUTRO_FRAMES = 75;
export const PRINCIPLE_FRAMES = 60;
export const CHAPTER_FRAMES = 45;
export const HERITAGE_FRAMES = 60;
export const QA_FRAMES = 90;

export function usableClipDurationMs(clip: ProjectClip) {
  return usableMs(clip);
}

export function clipsDurationFrames(
  clips: ProjectClip[],
  fallbackTransition: TransitionId = "none",
) {
  return clipsTimelineFrames(clips, fallbackTransition);
}

export function getCaptionAtMs(captions: CaptionSegment[], ms: number) {
  const hit = captions.find((c) => ms >= c.startMs && ms <= c.endMs);
  return hit?.text ?? "";
}

export function getCaptionSegmentAtMs(
  captions: CaptionSegment[],
  ms: number,
): CaptionSegment | null {
  return captions.find((c) => ms >= c.startMs && ms <= c.endMs) ?? null;
}

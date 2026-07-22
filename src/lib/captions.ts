import type { CaptionSegment } from "./types";

const MOCK_LINES = [
  "Light finds the edge first.",
  "Material decides the tempo.",
  "Restraint is the luxury.",
  "Craft asks for patience.",
];

/** Detect old decorative captions that were never extracted from speech. */
export function isMockCaptionSet(captions: CaptionSegment[]) {
  if (!captions.length) return false;
  const texts = captions.map((c) => c.text.trim());
  return (
    texts.length === MOCK_LINES.length &&
    MOCK_LINES.every((line, i) => texts[i] === line)
  );
}

/** Prefer `clipsTimelineMs` from `@/lib/timeline` for studio UI (transition-aware). */
export function totalTimelineMs(
  clips: { trimStartMs: number; trimEndMs: number; durationMs: number }[],
) {
  return clips.reduce((sum, clip) => {
    const end = clip.trimEndMs > 0 ? clip.trimEndMs : clip.durationMs;
    return sum + Math.max(500, end - clip.trimStartMs);
  }, 0);
}

export function captionAtMs(captions: CaptionSegment[], ms: number) {
  const index = captions.findIndex((c) => ms >= c.startMs && ms <= c.endMs);
  if (index < 0) return { index: -1, text: "", segment: null as CaptionSegment | null };
  return { index, text: captions[index].text, segment: captions[index] };
}

/** Karaoke-style active word index within a segment (-1 if none). */
export function activeCaptionWordIndex(
  segment: CaptionSegment | null | undefined,
  ms: number,
) {
  const words = segment?.words;
  if (!words?.length) return -1;
  return words.findIndex((w) => ms >= w.startMs && ms <= w.endMs);
}

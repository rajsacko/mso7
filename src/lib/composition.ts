import type { FormatId } from "./types";

/** Single Remotion composition path — no packed preset intros. */
export function compositionIdFor(_preset: string | undefined, format: FormatId) {
  return `ClipReel-${format}`;
}

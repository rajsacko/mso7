/** Soften music under an overlapping voiceover (CapCut-style duck). */

export function duckedMusicVolume(
  timeMs: number,
  musicVolume: number,
  voiceStartMs: number,
  voiceEndMs: number,
  hasVoice: boolean,
  duckRatio = 0.28,
  fadeMs = 280,
): number {
  const base = Math.min(1, Math.max(0, musicVolume));
  if (!hasVoice || voiceEndMs <= voiceStartMs || base <= 0) return base;
  const ducked = base * duckRatio;
  if (timeMs >= voiceStartMs && timeMs <= voiceEndMs) return ducked;
  if (timeMs >= voiceStartMs - fadeMs && timeMs < voiceStartMs) {
    const t = (voiceStartMs - timeMs) / fadeMs; // 1 → 0 approaching VO
    return ducked + (base - ducked) * t;
  }
  if (timeMs > voiceEndMs && timeMs <= voiceEndMs + fadeMs) {
    const t = (timeMs - voiceEndMs) / fadeMs; // 0 → 1 leaving VO
    return ducked + (base - ducked) * t;
  }
  return base;
}

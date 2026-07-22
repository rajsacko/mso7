"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipThumb } from "./ClipThumb";

/** Filmstrip of stills across the trimmed clip range. */
export function ClipFilmstrip({
  src,
  trimStartMs,
  trimEndMs,
  durationMs,
  widthPx,
}: {
  src: string;
  trimStartMs: number;
  trimEndMs: number;
  durationMs: number;
  /** Optional seed width; ResizeObserver overrides when available. */
  widthPx?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measuredW, setMeasuredW] = useState(widthPx || 120);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 8) setMeasuredW(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const end =
    trimEndMs > trimStartMs ? trimEndMs : durationMs || trimStartMs + 1000;
  const usable = Math.max(500, end - trimStartMs);

  const frames = useMemo(() => {
    const n = Math.min(
      24,
      Math.max(4, Math.round(measuredW / 22)),
    );
    return Array.from({ length: n }, (_, i) => {
      const t = trimStartMs + ((i + 0.5) / n) * usable;
      return Math.round(t);
    });
  }, [trimStartMs, usable, measuredW]);

  return (
    <div ref={rootRef} className="mso-filmstrip" aria-hidden>
      {frames.map((ms, i) => (
        <ClipThumb key={`${ms}-${i}`} src={src} trimStartMs={ms} />
      ))}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/** Quiet filmstrip thumbnail — seeks to trim in-point, no autoplay noise. */
export function ClipThumb({
  src,
  trimStartMs = 0,
  className,
}: {
  src: string;
  trimStartMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src || failed) return;
    const t = Math.max(0, trimStartMs / 1000);

    const apply = () => {
      try {
        if (Math.abs(el.currentTime - t) > 0.08) {
          el.currentTime = t;
        }
      } catch {
        /* seek may fail before metadata */
      }
    };

    if (el.readyState >= 1) apply();
    else el.addEventListener("loadedmetadata", apply, { once: true });

    return () => el.removeEventListener("loadedmetadata", apply);
  }, [src, trimStartMs, failed]);

  if (!src || failed) {
    return (
      <span
        className={`mso-clip-thumb-fallback${className ? ` ${className}` : ""}`}
        aria-hidden
      />
    );
  }

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      muted
      playsInline
      preload="metadata"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

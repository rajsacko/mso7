import type { CSSProperties } from "react";
import type { BrandKit, ProjectOverlay } from "./types";

/** Shared caption plate — studio DOM + Remotion export. */
export function captionChrome(brand: BrandKit): {
  wrap: CSSProperties;
  plate: CSSProperties;
} {
  return {
    wrap: {
      position: "absolute",
      left: "8%",
      right: "8%",
      bottom: "18%",
      textAlign: "center",
      pointerEvents: "none",
    },
    plate: {
      display: "inline-block",
      fontFamily: brand.bodyFont || "Cabinet Grotesk",
      fontSize: 36,
      fontWeight: 400,
      lineHeight: 1.35,
      color: "#ffffff",
      backgroundColor: "rgba(26,26,26,0.72)",
      padding: "14px 22px",
      borderRadius: 8,
      maxWidth: "100%",
      textShadow: "none",
    },
  };
}

export function overlayUsesPlate(o: ProjectOverlay): boolean {
  return (
    o.hasPlate === true || (o.hasPlate !== false && o.kind === "badge")
  );
}

/** Shared free-text overlay chrome — studio + export. */
export function textOverlayChrome(
  o: ProjectOverlay,
  brand: BrandKit,
): CSSProperties {
  const usePlate = overlayUsesPlate(o);
  return {
    fontFamily: o.fontFamily || brand.displayFont || brand.bodyFont,
    fontSize: o.fontSize || (o.kind === "badge" ? 34 : 36),
    fontWeight: 500,
    color: o.color || "#ffffff",
    background: usePlate ? "rgba(26,26,26,0.72)" : "transparent",
    padding: usePlate
      ? o.kind === "badge"
        ? "14px 22px"
        : "10px 16px"
      : 0,
    borderRadius: usePlate ? 8 : 0,
    letterSpacing: "0.02em",
    maxWidth: "70%",
    textAlign: "center",
    whiteSpace: "pre-wrap",
    textShadow: usePlate
      ? "none"
      : "0 1px 3px rgba(0,0,0,0.7), 0 0 28px rgba(0,0,0,0.35)",
  };
}

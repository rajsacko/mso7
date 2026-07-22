/** Nudge/snap helpers — offsetX/Y are % from frame center (−50…50). */

const SNAP_POINTS = [0, -20, 20, -35, 35, -42, 42];

export type SnapGuides = {
  /** X offset % from center where a vertical guide should show */
  vertical: number | null;
  /** Y offset % from center where a horizontal guide should show */
  horizontal: number | null;
};

export function snapOverlayAxis(value: number, threshold = 1.2): number {
  const clamped = Math.max(-48, Math.min(48, value));
  for (const point of SNAP_POINTS) {
    if (Math.abs(clamped - point) <= threshold) return point;
  }
  return Math.round(clamped * 10) / 10;
}

/** Live drag snap + guide lines (slightly looser threshold than keyboard nudge). */
export function snapOverlayPosition(
  x: number,
  y: number,
  threshold = 2,
): { x: number; y: number; guides: SnapGuides } {
  const cx = Math.max(-48, Math.min(48, x));
  const cy = Math.max(-48, Math.min(48, y));
  let nearX: number | null = null;
  let nearY: number | null = null;
  let bestXd = threshold;
  let bestYd = threshold;
  for (const point of SNAP_POINTS) {
    const dx = Math.abs(cx - point);
    if (dx <= bestXd) {
      bestXd = dx;
      nearX = point;
    }
    const dy = Math.abs(cy - point);
    if (dy <= bestYd) {
      bestYd = dy;
      nearY = point;
    }
  }
  return {
    x: nearX ?? Math.round(cx * 10) / 10,
    y: nearY ?? Math.round(cy * 10) / 10,
    guides: { vertical: nearX, horizontal: nearY },
  };
}

export function nudgeOverlayOffset(current: number, delta: number): number {
  return snapOverlayAxis(current + delta);
}

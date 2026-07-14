import { AbsoluteFill } from "remotion";
import { LOOKS, type LookId } from "../../lib/looks";

export function LookGrade({ lookId }: { lookId?: LookId }) {
  const look = LOOKS[lookId || "none"];
  if (!look || look.id === "none") return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {look.wash ? (
        <AbsoluteFill
          style={{
            background: look.wash.background,
            mixBlendMode: look.wash.mixBlendMode,
            opacity: look.wash.opacity,
          }}
        />
      ) : null}
      {look.vignette ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${look.vignette}) 100%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}

export function lookFilter(lookId?: LookId) {
  return LOOKS[lookId || "none"]?.filter || "none";
}

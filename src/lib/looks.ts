import type { LookId } from "./types";

export type { LookId };

export interface LookDef {
  id: LookId;
  name: string;
  description: string;
  filter: string;
  wash?: {
    background: string;
    mixBlendMode:
      | "soft-light"
      | "multiply"
      | "overlay"
      | "screen"
      | "normal";
    opacity: number;
  };
  vignette?: number;
}

export const LOOKS: Record<LookId, LookDef> = {
  none: {
    id: "none",
    name: "Natural",
    description: "No grade",
    filter: "none",
  },
  porcelain: {
    id: "porcelain",
    name: "Porcelain",
    description: "Lifted soft whites, cool calm",
    filter: "contrast(0.94) brightness(1.06) saturate(0.88)",
    wash: {
      background:
        "linear-gradient(180deg, rgba(220,230,240,0.18), rgba(255,255,255,0.06))",
      mixBlendMode: "soft-light",
      opacity: 1,
    },
    vignette: 0.22,
  },
  swiss: {
    id: "swiss",
    name: "Swiss Contrast",
    description: "Crisp, restrained, slightly desaturated",
    filter: "contrast(1.12) brightness(1.02) saturate(0.78)",
    wash: {
      background: "rgba(20, 24, 28, 0.08)",
      mixBlendMode: "multiply",
      opacity: 1,
    },
    vignette: 0.28,
  },
  atelier: {
    id: "atelier",
    name: "Warm Atelier",
    description: "Soft amber light, studio warmth",
    filter: "contrast(1.04) brightness(1.03) saturate(1.05) sepia(0.12)",
    wash: {
      background:
        "linear-gradient(145deg, rgba(180,120,60,0.14), rgba(40,28,18,0.1))",
      mixBlendMode: "soft-light",
      opacity: 1,
    },
    vignette: 0.3,
  },
  stone: {
    id: "stone",
    name: "Evening Stone",
    description: "Muted earth, low saturation luxury",
    filter: "contrast(1.08) brightness(0.97) saturate(0.7) hue-rotate(-6deg)",
    wash: {
      background:
        "linear-gradient(180deg, rgba(90,75,60,0.16), rgba(25,22,20,0.2))",
      mixBlendMode: "overlay",
      opacity: 0.85,
    },
    vignette: 0.35,
  },
  film: {
    id: "film",
    name: "Film Soft",
    description: "Gentle fade, cinematic breath",
    filter: "contrast(0.92) brightness(1.04) saturate(0.9)",
    wash: {
      background:
        "linear-gradient(180deg, rgba(255,250,240,0.12), rgba(30,30,30,0.18))",
      mixBlendMode: "soft-light",
      opacity: 1,
    },
    vignette: 0.4,
  },
};

export const LOOK_LIST = Object.values(LOOKS);

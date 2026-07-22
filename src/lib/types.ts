export type FormatId = "reel" | "youtube" | "story";
export type PresetId =
  | "designers-diary"
  | "heritage-design"
  | "founders-journey"
  | "design-dialogues";

export type CaptionLanguage = "en" | "fr" | "bilingual";

export type LookId =
  | "none"
  | "porcelain"
  | "swiss"
  | "atelier"
  | "stone"
  | "film";

export type TransitionId =
  | "none"
  | "crossfade"
  | "fade-black"
  | "slide"
  | "wipe";

export type OverlayKind = "text" | "logo" | "badge" | "image" | "video";

export type OverlayAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface CustomFont {
  id: string;
  name: string;
  /** CSS font-family token used in @font-face */
  family: string;
  url: string;
}

export interface BrandKit {
  wordmark: string;
  atelierLine: string;
  displayFont: string;
  bodyFont: string;
  background: string;
  foreground: string;
  accent: string;
  muted: string;
  logoUrl?: string;
  musicUrl?: string;
  /** Uploaded typefaces available for titles / captions */
  customFonts: CustomFont[];
  updatedAt: string;
}

export interface CaptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface CaptionSegment {
  text: string;
  startMs: number;
  endMs: number;
  words?: CaptionWord[];
}

export interface ProjectClip {
  id: string;
  name: string;
  url: string;
  /** Pre-enhance media URL — restore original camera audio from this */
  originalUrl?: string;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  order: number;
  /** Transition used when leaving this clip into the next */
  transitionOut: TransitionId;
  /** True when url points at noise-reduced remux */
  audioEnhanced?: boolean;
  enhanceStrength?: "light" | "medium" | "strong";
}

export interface ProjectOverlay {
  id: string;
  kind: OverlayKind;
  text: string;
  /** Image or video media for visual overlays */
  imageUrl?: string;
  videoUrl?: string;
  anchor: OverlayAnchor;
  /** Fine offset from anchor, 0–100 of frame */
  offsetX: number;
  offsetY: number;
  scale: number;
  opacity: number;
  startMs: number;
  endMs: number;
  /** Text styling */
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  /** Soft chip behind text (off by default — luxury type uses shadow only) */
  hasPlate?: boolean;
  /** SVG / logo tint (CSS color; applied as fill / filter) */
  fillColor?: string;
}

export interface VoiceOver {
  text: string;
  url?: string;
  /** Pre-enhance VO file for restore */
  originalUrl?: string;
  audioEnhanced?: boolean;
  voiceId?: string;
  status: "idle" | "generating" | "ready" | "error";
  error?: string;
}

export interface Project {
  id: string;
  title: string;
  format: FormatId;
  preset: PresetId;
  clips: ProjectClip[];
  overlays: ProjectOverlay[];
  hook: string;
  subtitle: string;
  lowerThird: string;
  principle: string;
  chapterLabels: string[];
  question: string;
  answer: string;
  captions: CaptionSegment[];
  captionLanguage: CaptionLanguage;
  showTitle: boolean;
  showCaptionOverlay: boolean;
  /** Unused — kept for older project JSON. Preview/export are always clips-only. */
  previewPreset: boolean;
  lookId: LookId;
  defaultTransition: TransitionId;
  voiceOver: VoiceOver;
  /** Voice take placement on timeline */
  voiceOverStartMs: number;
  voiceOverEndMs: number;
  /** 0–1 */
  voiceOverVolume: number;
  musicUrl?: string;
  musicName?: string;
  /** Music bed placement on timeline */
  musicStartMs: number;
  musicEndMs: number;
  /** 0–1 */
  musicVolume: number;
  createdAt: string;
  updatedAt: string;
  lastRenderId?: string;
}

export interface RenderJob {
  id: string;
  projectId: string;
  status: "queued" | "rendering" | "ready" | "error" | "cancelled";
  progress: number;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const FORMAT_SIZES: Record<
  FormatId,
  { width: number; height: number; label: string; fps: number }
> = {
  reel: { width: 1080, height: 1920, label: "Reel 9:16", fps: 30 },
  youtube: { width: 1920, height: 1080, label: "YouTube 16:9", fps: 30 },
  story: { width: 1080, height: 1920, label: "Story 9:16", fps: 30 },
};

export const PRESET_META: Record<
  PresetId,
  {
    name: string;
    pillar: string;
    description: string;
    compositionId: string;
  }
> = {
  "designers-diary": {
    name: "Designer's Diary",
    pillar: "The Art of Luxury Design",
    description: "Hook → behind-the-scenes → principle → soft outro",
    compositionId: "DesignersDiary",
  },
  "heritage-design": {
    name: "Heritage & Design",
    pillar: "Cultural Fusion",
    description: "Story title → heritage card → craft shots → bilingual close",
    compositionId: "HeritageDesign",
  },
  "founders-journey": {
    name: "Founder's Journey",
    pillar: "Luxury Lifestyle & Entrepreneurship",
    description: "Chapter cards for studio, client, and lesson",
    compositionId: "FoundersJourney",
  },
  "design-dialogues": {
    name: "Design Dialogues",
    pillar: "Bilingual Communication",
    description: "Question on screen → answer → bilingual end card",
    compositionId: "DesignDialogues",
  },
};

export const TRANSITION_META: Record<
  TransitionId,
  { name: string; frames: number }
> = {
  none: { name: "Cut", frames: 0 },
  crossfade: { name: "Crossfade", frames: 18 },
  "fade-black": { name: "Fade black", frames: 20 },
  slide: { name: "Slide", frames: 18 },
  wipe: { name: "Wipe", frames: 16 },
};

export const DEFAULT_BRAND: BrandKit = {
  wordmark: "Maison Sacko",
  atelierLine: "Atelier · MMXXVI",
  displayFont: "Cabinet Grotesk",
  bodyFont: "Cabinet Grotesk",
  background: "#FFFFFF",
  foreground: "#000000",
  accent: "#5C5C5C",
  muted: "#C2C2C2",
  customFonts: [],
  updatedAt: new Date().toISOString(),
};

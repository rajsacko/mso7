import type { LookId, PresetId, Project } from "./types";
import { PRESET_META } from "./types";

export type PresetDefaults = Pick<
  Project,
  | "hook"
  | "subtitle"
  | "lowerThird"
  | "principle"
  | "chapterLabels"
  | "question"
  | "answer"
  | "lookId"
>;

export const PRESET_DEFAULTS: Record<PresetId, PresetDefaults> = {
  "designers-diary": {
    hook: "When the work has to be right.",
    subtitle: "A Designer's Diary",
    lowerThird: "Raj Sacko · Creative Director",
    principle: "Form follows patience.",
    chapterLabels: ["Studio", "Client", "Lesson"],
    question: "What makes a space feel inevitable?",
    answer: "Restraint. Material truth. Time.",
    lookId: "atelier",
  },
  "heritage-design": {
    hook: "Craft carried across continents.",
    subtitle: "Heritage & Design",
    lowerThird: "Maison Sacko · Cultural Fusion",
    principle: "Memory is a material.",
    chapterLabels: ["Origin", "Craft", "Place"],
    question: "Where does heritage live in a modern room?",
    answer: "In the hand, the grain, the silence between forms.",
    lookId: "stone",
  },
  "founders-journey": {
    hook: "Building an atelier in public.",
    subtitle: "Founder's Journey",
    lowerThird: "Raj Sacko · Founder",
    principle: "Taste is a discipline.",
    chapterLabels: ["Studio", "Client", "Lesson"],
    question: "What did this week teach the practice?",
    answer: "Protect the process. Ship with restraint.",
    lookId: "swiss",
  },
  "design-dialogues": {
    hook: "A question worth sitting with.",
    subtitle: "Design Dialogues",
    lowerThird: "Maison Sacko · EN / FR",
    principle: "Clarity is luxury.",
    chapterLabels: ["Question", "Answer", "Close"],
    question: "What makes a space feel inevitable?",
    answer: "Restraint. Material truth. Time.",
    lookId: "porcelain",
  },
};

/** Apply a preset without blindly wiping custom copy the user typed. */
export function applyPresetChange(
  project: Project,
  preset: PresetId,
): Partial<Project> {
  const next = PRESET_DEFAULTS[preset];
  const prev = PRESET_DEFAULTS[project.preset];
  const prevMeta = PRESET_META[project.preset];

  const keepIfCustom = <K extends keyof PresetDefaults>(
    key: K,
    current: Project[K],
    previousDefault: PresetDefaults[K],
    nextDefault: PresetDefaults[K],
  ): Project[K] => {
    if (
      current == null ||
      current === "" ||
      (Array.isArray(current) && current.length === 0) ||
      JSON.stringify(current) === JSON.stringify(previousDefault) ||
      (key === "subtitle" && current === prevMeta.name)
    ) {
      return nextDefault as Project[K];
    }
    return current;
  };

  return {
    preset,
    previewPreset: true,
    subtitle: keepIfCustom(
      "subtitle",
      project.subtitle,
      prev.subtitle,
      next.subtitle,
    ),
    hook: keepIfCustom("hook", project.hook, prev.hook, next.hook),
    lowerThird: keepIfCustom(
      "lowerThird",
      project.lowerThird,
      prev.lowerThird,
      next.lowerThird,
    ),
    principle: keepIfCustom(
      "principle",
      project.principle,
      prev.principle,
      next.principle,
    ),
    chapterLabels: keepIfCustom(
      "chapterLabels",
      project.chapterLabels,
      prev.chapterLabels,
      next.chapterLabels,
    ),
    question: keepIfCustom(
      "question",
      project.question,
      prev.question,
      next.question,
    ),
    answer: keepIfCustom("answer", project.answer, prev.answer, next.answer),
    lookId: keepIfCustom(
      "lookId",
      project.lookId,
      prev.lookId,
      next.lookId,
    ) as LookId,
  };
}

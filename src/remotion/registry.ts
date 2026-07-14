"use client";

import type { FormatId, PresetId } from "@/lib/types";
import { PRESET_META } from "@/lib/types";
import { designersDiaryDuration } from "./compositions/DesignersDiary";
import { heritageDesignDuration } from "./compositions/HeritageDesign";
import { foundersJourneyDuration } from "./compositions/FoundersJourney";
import { designDialoguesDuration } from "./compositions/DesignDialogues";
import { DesignersDiary } from "./compositions/DesignersDiary";
import { HeritageDesign } from "./compositions/HeritageDesign";
import { FoundersJourney } from "./compositions/FoundersJourney";
import { DesignDialogues } from "./compositions/DesignDialogues";
import type { CompositionProps } from "./types";

export function compositionIdFor(preset: PresetId, format: FormatId) {
  return `${PRESET_META[preset].compositionId}-${format}`;
}

export function durationForPreset(props: CompositionProps) {
  switch (props.preset) {
    case "heritage-design":
      return heritageDesignDuration(props);
    case "founders-journey":
      return foundersJourneyDuration(props);
    case "design-dialogues":
      return designDialoguesDuration(props);
    case "designers-diary":
    default:
      return designersDiaryDuration(props);
  }
}

export function componentForPreset(preset: PresetId) {
  switch (preset) {
    case "heritage-design":
      return HeritageDesign;
    case "founders-journey":
      return FoundersJourney;
    case "design-dialogues":
      return DesignDialogues;
    case "designers-diary":
    default:
      return DesignersDiary;
  }
}

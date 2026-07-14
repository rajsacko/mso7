"use client";

import type { FC } from "react";
import {
  ClipReelExport,
  clipReelExportDuration,
} from "./ClipReelExport";
import type { CompositionProps } from "../types";

/** Studio preview = export path: ClipReel only. */
export const StudioPreview: FC<CompositionProps> = (props) => {
  return <ClipReelExport {...props} />;
};

export function studioPreviewDuration(props: CompositionProps) {
  return clipReelExportDuration(props);
}

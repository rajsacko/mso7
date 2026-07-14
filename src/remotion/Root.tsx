import React from "react";
import { Composition } from "remotion";
import { DEFAULT_BRAND, FORMAT_SIZES } from "../lib/types";
import {
  ClipReelExport,
  clipReelExportDuration,
} from "./compositions/ClipReelExport";
import type { CompositionProps } from "./types";
import { FPS } from "./types";

const defaultProps: CompositionProps = {
  brand: DEFAULT_BRAND,
  format: "reel",
  preset: "designers-diary",
  clips: [],
  hook: "",
  subtitle: "",
  lowerThird: "",
  principle: "",
  chapterLabels: [],
  question: "",
  answer: "",
  captions: [],
  captionLanguage: "en",
  lookId: "none",
  defaultTransition: "crossfade",
  overlays: [],
  previewPreset: false,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {(["reel", "youtube", "story"] as const).map((format) => {
        const size = FORMAT_SIZES[format];
        return (
          <Composition
            key={format}
            id={`ClipReel-${format}`}
            component={ClipReelExport}
            durationInFrames={300}
            fps={FPS}
            width={size.width}
            height={size.height}
            defaultProps={{ ...defaultProps, format }}
            calculateMetadata={async ({ props }) => ({
              durationInFrames: clipReelExportDuration(props),
              fps: FPS,
              width: size.width,
              height: size.height,
            })}
          />
        );
      })}
    </>
  );
};

import type { FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  IntroCard,
  OutroCard,
  PrincipleCard,
} from "../components/OverlayElements";
import { ClipReel } from "../components/ClipReel";
import {
  clipsDurationFrames,
  CompositionProps,
  INTRO_FRAMES,
  OUTRO_FRAMES,
  PRINCIPLE_FRAMES,
} from "../types";

export const DesignersDiary: FC<CompositionProps> = (props) => {
  const clipsFrames = clipsDurationFrames(
    props.clips,
    props.defaultTransition || "crossfade",
  );
  let cursor = 0;
  const introFrom = cursor;
  cursor += INTRO_FRAMES;
  const clipsFrom = cursor;
  cursor += clipsFrames;
  const principleFrom = cursor;
  cursor += PRINCIPLE_FRAMES;
  const outroFrom = cursor;

  return (
    <AbsoluteFill style={{ backgroundColor: props.brand.background }}>
      <Sequence from={introFrom} durationInFrames={INTRO_FRAMES}>
        <IntroCard
          brand={props.brand}
          title={props.hook}
          subtitle={props.subtitle || "A Designer's Diary"}
          durationInFrames={INTRO_FRAMES}
        />
      </Sequence>
      <Sequence from={clipsFrom} durationInFrames={Math.max(1, clipsFrames)}>
        <ClipReel
          clips={props.clips}
          brand={props.brand}
          lowerThird={props.lowerThird}
          captions={props.captions}
          musicUrl={props.musicUrl}
          voiceOverUrl={props.voiceOverUrl}
          lookId={props.lookId || "none"}
          overlays={props.overlays || []}
          defaultTransition={props.defaultTransition || "crossfade"}
          musicStartMs={props.musicStartMs || 0}
          musicEndMs={props.musicEndMs || 0}
          musicVolume={props.musicVolume ?? 0.22}
        />
      </Sequence>
      <Sequence from={principleFrom} durationInFrames={PRINCIPLE_FRAMES}>
        <PrincipleCard
          brand={props.brand}
          text={props.principle}
          durationInFrames={PRINCIPLE_FRAMES}
        />
      </Sequence>
      <Sequence from={outroFrom} durationInFrames={OUTRO_FRAMES}>
        <OutroCard brand={props.brand} durationInFrames={OUTRO_FRAMES} />
      </Sequence>
    </AbsoluteFill>
  );
};

export function designersDiaryDuration(props: CompositionProps) {
  return (
    INTRO_FRAMES +
    clipsDurationFrames(props.clips, props.defaultTransition || "crossfade") +
    PRINCIPLE_FRAMES +
    OUTRO_FRAMES
  );
}

import { Fragment, type FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  ChapterCard,
  IntroCard,
  OutroCard,
} from "../components/OverlayElements";
import { ClipReel } from "../components/ClipReel";
import {
  CHAPTER_FRAMES,
  clipsDurationFrames,
  CompositionProps,
  INTRO_FRAMES,
  OUTRO_FRAMES,
} from "../types";

export const FoundersJourney: FC<CompositionProps> = (props) => {
  const clips = [...props.clips].sort((a, b) => a.order - b.order);
  const labels =
    props.chapterLabels.length > 0
      ? props.chapterLabels
      : ["Studio", "Client", "Lesson"];

  const chunkSize = Math.max(1, Math.ceil(Math.max(clips.length, 1) / labels.length));
  const chapters = labels.map((label, index) => {
    const slice = clips.slice(index * chunkSize, (index + 1) * chunkSize);
    return { label, clips: slice.length ? slice : clips.slice(0, 1) };
  });

  let cursor = 0;
  const introFrom = cursor;
  cursor += INTRO_FRAMES;

  const parts = chapters.map((chapter) => {
    const cardFrom = cursor;
    cursor += CHAPTER_FRAMES;
    const clipFrames = Math.max(
      1,
      clipsDurationFrames(
        chapter.clips,
        props.defaultTransition || "crossfade",
      ),
    );
    const clipsFrom = cursor;
    cursor += clipFrames;
    return { chapter, cardFrom, clipsFrom, clipFrames };
  });

  const outroFrom = cursor;

  return (
    <AbsoluteFill style={{ backgroundColor: props.brand.background }}>
      <Sequence from={introFrom} durationInFrames={INTRO_FRAMES}>
        <IntroCard
          brand={props.brand}
          title={props.hook}
          subtitle={props.subtitle || "Founder's Journey"}
          durationInFrames={INTRO_FRAMES}
        />
      </Sequence>
      {parts.map(({ chapter, cardFrom, clipsFrom, clipFrames }, index) => (
        <Fragment key={`${chapter.label}-${index}`}>
          <Sequence from={cardFrom} durationInFrames={CHAPTER_FRAMES}>
            <ChapterCard
              brand={props.brand}
              label={chapter.label}
              index={index}
              durationInFrames={CHAPTER_FRAMES}
            />
          </Sequence>
          <Sequence from={clipsFrom} durationInFrames={clipFrames}>
            <ClipReel
              clips={chapter.clips}
              brand={props.brand}
              lowerThird={props.lowerThird}
              captions={index === 0 ? props.captions : []}
              musicUrl={index === 0 ? props.musicUrl : undefined}
              voiceOverUrl={index === 0 ? props.voiceOverUrl : undefined}
              lookId={props.lookId || "none"}
              overlays={index === 0 ? props.overlays || [] : []}
              defaultTransition={props.defaultTransition || "crossfade"}
              musicStartMs={index === 0 ? props.musicStartMs || 0 : 0}
              musicEndMs={index === 0 ? props.musicEndMs || 0 : 0}
              musicVolume={props.musicVolume ?? 0.22}
            />
          </Sequence>
        </Fragment>
      ))}
      <Sequence from={outroFrom} durationInFrames={OUTRO_FRAMES}>
        <OutroCard brand={props.brand} durationInFrames={OUTRO_FRAMES} />
      </Sequence>
    </AbsoluteFill>
  );
};

export function foundersJourneyDuration(props: CompositionProps) {
  const clips = [...props.clips].sort((a, b) => a.order - b.order);
  const labels =
    props.chapterLabels.length > 0
      ? props.chapterLabels
      : ["Studio", "Client", "Lesson"];
  const chunkSize = Math.max(
    1,
    Math.ceil(Math.max(clips.length, 1) / labels.length),
  );
  let total = INTRO_FRAMES + OUTRO_FRAMES;
  labels.forEach((_, index) => {
    const slice = clips.slice(index * chunkSize, (index + 1) * chunkSize);
    total +=
      CHAPTER_FRAMES +
      Math.max(
        1,
        clipsDurationFrames(
          slice.length ? slice : clips,
          props.defaultTransition || "crossfade",
        ),
      );
  });
  return Math.max(total, INTRO_FRAMES + CHAPTER_FRAMES + OUTRO_FRAMES);
}

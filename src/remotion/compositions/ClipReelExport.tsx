import type { FC } from "react";
import { ClipReel } from "../components/ClipReel";
import { clipsDurationFrames, type CompositionProps } from "../types";

/** Single export / preview path — clips with overlays, no packed intro cards. */
export const ClipReelExport: FC<CompositionProps> = (props) => {
  return (
    <ClipReel
      clips={props.clips}
      brand={props.brand}
      lowerThird={props.lowerThird}
      showLowerThird={Boolean(props.lowerThird?.trim())}
      captions={props.captions}
      showCaptions={props.showCaptionOverlay !== false}
      musicUrl={props.musicUrl}
      voiceOverUrl={props.voiceOverUrl}
      lookId={props.lookId || "none"}
      overlays={props.overlays || []}
      defaultTransition={props.defaultTransition || "crossfade"}
      musicStartMs={props.musicStartMs || 0}
      musicEndMs={props.musicEndMs || 0}
      musicVolume={props.musicVolume ?? 0.22}
      voiceOverStartMs={props.voiceOverStartMs || 0}
      voiceOverEndMs={props.voiceOverEndMs || 0}
      voiceOverVolume={props.voiceOverVolume ?? 1}
      hook={props.hook}
      showTitle={Boolean(props.showTitle)}
    />
  );
};

export function clipReelExportDuration(props: CompositionProps) {
  /* Must match studio timelineMs — no padded 90-frame floor (desyncs playhead). */
  return Math.max(
    1,
    clipsDurationFrames(props.clips, props.defaultTransition || "crossfade"),
  );
}

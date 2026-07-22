import path from "path";
import { promises as fs } from "fs";
import { v4 as uuid } from "uuid";
import { runFfmpeg } from "./ffmpegRun";
import { UPLOADS_DIR } from "./storage";

export type EnhanceStrength = "light" | "medium" | "strong";

const NR: Record<EnhanceStrength, { nr: number; nf: number; hp: number }> = {
  light: { nr: 8, nf: -22, hp: 70 },
  medium: { nr: 14, nf: -25, hp: 80 },
  strong: { nr: 20, nf: -28, hp: 100 },
};

function speechFilter(strength: EnhanceStrength) {
  const { nr, nf, hp } = NR[strength];
  // CapCut-like chain: cut rumble → spectral denoise → tame peaks → broadcast loudness
  return [
    `highpass=f=${hp}`,
    `lowpass=f=14000`,
    `afftdn=nr=${nr}:nf=${nf}:tn=1`,
    `acompressor=threshold=-18dB:ratio=2.8:attack=12:release=180:makeup=2`,
    `loudnorm=I=-16:TP=-1.5:LRA=11`,
  ].join(",");
}

export function mediaPathFromUrl(url: string) {
  return path.join(UPLOADS_DIR, path.basename(url));
}

export function publicMediaUrl(filename: string) {
  return `/api/media/${filename}`;
}

/** Mono 16 kHz WAV — ideal for Whisper (smaller + clearer). */
export async function extractWhisperWav(
  inputPath: string,
  outputPath: string,
  opts?: { startMs?: number; durationMs?: number; enhance?: boolean },
): Promise<void> {
  const args = ["-y"];
  if (opts?.startMs != null && opts.startMs > 0) {
    args.push("-ss", (opts.startMs / 1000).toFixed(3));
  }
  args.push("-i", inputPath);
  if (opts?.durationMs != null && opts.durationMs > 0) {
    args.push("-t", (opts.durationMs / 1000).toFixed(3));
  }
  const af = opts?.enhance
    ? `${speechFilter("light")},aresample=16000`
    : "aresample=16000";
  args.push(
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    "-af",
    af,
    outputPath,
  );
  await runFfmpeg(args, "Audio extract");
}

/** Enhance speech in place → AAC temp, then remux onto video (or rewrite audio file). */
export async function enhanceMediaFile(
  inputPath: string,
  outputPath: string,
  strength: EnhanceStrength = "medium",
): Promise<"video" | "audio"> {
  const ext = path.extname(inputPath).toLowerCase();
  const isAudioOnly = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"].includes(
    ext,
  );
  const filter = speechFilter(strength);

  if (isAudioOnly) {
    const dest = outputPath.replace(/\.\w+$/, ".m4a");
    await runFfmpeg(
      [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-af",
        filter,
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        dest,
      ],
      "Voice enhance",
    );
    if (dest !== outputPath) {
      await fs.rename(dest, outputPath).catch(async () => {
        await fs.copyFile(dest, outputPath);
        await fs.unlink(dest).catch(() => undefined);
      });
    }
    return "audio";
  }

  const tmpAudio = path.join(
    path.dirname(outputPath),
    `enh-${uuid()}.m4a`,
  );
  try {
    await runFfmpeg(
      [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-af",
        filter,
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        tmpAudio,
      ],
      "Noise reduction",
    );
    await runFfmpeg(
      [
        "-y",
        "-i",
        inputPath,
        "-i",
        tmpAudio,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        "-shortest",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      "Audio remux",
    );
    return "video";
  } finally {
    await fs.unlink(tmpAudio).catch(() => undefined);
  }
}

export async function withTempFile(
  suffix: string,
  fn: (tmpPath: string) => Promise<void>,
): Promise<void> {
  const tmp = path.join(UPLOADS_DIR, `tmp-${uuid()}${suffix}`);
  try {
    await fn(tmp);
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}

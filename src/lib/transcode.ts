import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

const NEEDS_TRANSCODE = new Set([
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
  ".hevc",
  ".mts",
  ".m2ts",
]);

export function needsVideoTranscode(filename: string) {
  return NEEDS_TRANSCODE.has(path.extname(filename).toLowerCase());
}

/** Re-encode phone/camera files to seekable H.264 MP4 for Chrome + Remotion. */
export function transcodeToH264Mp4(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ];
    const proc = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", (err) => {
      reject(
        new Error(
          `ffmpeg not available (${err.message}). Install ffmpeg or upload H.264 MP4.`,
        ),
      );
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Could not convert video (ffmpeg exit ${code}). Prefer H.264 .mp4 from your phone/camera.`,
          ),
        );
    });
  });
}

export async function removeQuiet(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

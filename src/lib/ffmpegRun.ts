import { spawn } from "child_process";

/** Run ffmpeg; reject with a short, user-facing message on failure. */
export function runFfmpeg(
  args: string[],
  label = "ffmpeg",
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    proc.on("error", (err) => {
      reject(
        new Error(
          `ffmpeg not available (${err.message}). Install ffmpeg, then retry.`,
        ),
      );
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else {
        const tip = stderr
          .split("\n")
          .filter((l) => /error|invalid|failed/i.test(l))
          .slice(-2)
          .join(" ");
        reject(
          new Error(
            `${label} failed${tip ? `: ${tip.slice(0, 220)}` : ` (exit ${code})`}.`,
          ),
        );
      }
    });
  });
}

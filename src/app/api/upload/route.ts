import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { ensureDataDirs, UPLOADS_DIR } from "@/lib/storage";
import {
  needsVideoTranscode,
  removeQuiet,
  transcodeToH264Mp4,
} from "@/lib/transcode";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  await ensureDataDirs();
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const originalExt = (path.extname(file.name) || ".mp4").toLowerCase();
  const id = uuid();
  const rawName = `${id}${originalExt}`;
  const rawPath = path.join(UPLOADS_DIR, rawName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(rawPath, buffer);

  let finalName = rawName;
  let converted = false;
  const durationMs = Number(form.get("durationMs") || 5000);
  const isVideo =
    file.type.startsWith("video/") ||
    [".mp4", ".mov", ".webm", ".m4v", ".mkv", ".avi"].includes(originalExt);

  if (isVideo && needsVideoTranscode(rawName)) {
    const mp4Name = `${id}.mp4`;
    const mp4Path = path.join(UPLOADS_DIR, mp4Name);
    try {
      await transcodeToH264Mp4(rawPath, mp4Path);
      await removeQuiet(rawPath);
      finalName = mp4Name;
      converted = true;
    } catch (err) {
      await removeQuiet(mp4Path);
      // Keep original so upload isn’t lost; client may still black-screen
      console.error("transcode failed", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not convert .MOV — export as H.264 MP4 and retry.",
        },
        { status: 422 },
      );
    }
  }

  return NextResponse.json({
    clip: {
      id,
      name: converted
        ? file.name.replace(/\.[^.]+$/, ".mp4")
        : file.name,
      url: `/api/media/${finalName}`,
      durationMs: Number.isFinite(durationMs) ? durationMs : 5000,
      trimStartMs: 0,
      trimEndMs: Number.isFinite(durationMs) ? durationMs : 5000,
      order: 0,
      transitionOut: "crossfade",
    },
    converted,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { ensureDataDirs, UPLOADS_DIR } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await ensureDataDirs();
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = path.extname(file.name) || ".mp4";
  const id = uuid();
  const filename = `${id}${ext}`;
  const diskPath = path.join(UPLOADS_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(diskPath, buffer);

  const durationMs = Number(form.get("durationMs") || 5000);

  return NextResponse.json({
    clip: {
      id,
      name: file.name,
      url: `/api/media/${filename}`,
      durationMs: Number.isFinite(durationMs) ? durationMs : 5000,
      trimStartMs: 0,
      trimEndMs: Number.isFinite(durationMs) ? durationMs : 5000,
      order: 0,
      transitionOut: "crossfade",
    },
  });
}

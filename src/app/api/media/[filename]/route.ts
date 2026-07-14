import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { UPLOADS_DIR, RENDERS_DIR, BRAND_DIR } from "@/lib/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".json": "application/json",
};

type Ctx = { params: Promise<{ filename: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { filename } = await ctx.params;
  const safe = path.basename(filename);

  const candidates = [
    path.join(UPLOADS_DIR, safe),
    path.join(RENDERS_DIR, safe),
    path.join(BRAND_DIR, safe),
  ];

  for (const filePath of candidates) {
    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(safe).toLowerCase();
      return new NextResponse(data, {
        headers: {
          "Content-Type": MIME[ext] || "application/octet-stream",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      // try next
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

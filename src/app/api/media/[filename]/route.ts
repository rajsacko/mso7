import { NextRequest, NextResponse } from "next/server";
import { createReadStream, promises as fs, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
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

async function resolvePath(safe: string) {
  const candidates = [
    path.join(UPLOADS_DIR, safe),
    path.join(RENDERS_DIR, safe),
    path.join(BRAND_DIR, safe),
  ];
  for (const filePath of candidates) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // try next
    }
  }
  return null;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { filename } = await ctx.params;
  const safe = path.basename(filename);
  const filePath = await resolvePath(safe);
  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(safe).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const stat = statSync(filePath);
  const size = stat.size;
  const range = req.headers.get("range");

  const common = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };

  // Byte-range support — required for Remotion seeking / scrubbing
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...common, "Content-Range": `bytes */${size}` },
      });
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      end >= size ||
      start > end
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...common, "Content-Range": `bytes */${size}` },
      });
    }
    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new NextResponse(webStream, {
      status: 206,
      headers: {
        ...common,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      ...common,
      "Content-Length": String(size),
    },
  });
}

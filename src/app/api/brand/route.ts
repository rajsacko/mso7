import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { getBrandKit, saveBrandKit } from "@/lib/projects";
import { BRAND_DIR, ensureDataDirs } from "@/lib/storage";
import type { BrandKit } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const brand = await getBrandKit();
  return NextResponse.json({ brand });
}

export async function PUT(req: NextRequest) {
  await ensureDataDirs();
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const partial: Record<string, string> = {};
    for (const key of [
      "wordmark",
      "atelierLine",
      "displayFont",
      "bodyFont",
      "background",
      "foreground",
      "accent",
      "muted",
    ]) {
      const value = form.get(key);
      if (typeof value === "string" && value.trim()) {
        partial[key] = value.trim();
      }
    }

    const logo = form.get("logo");
    if (logo instanceof File && logo.size > 0) {
      const ext = path.extname(logo.name) || ".png";
      const filename = `logo-${uuid()}${ext}`;
      await fs.writeFile(
        path.join(BRAND_DIR, filename),
        Buffer.from(await logo.arrayBuffer()),
      );
      partial.logoUrl = `/api/media/${filename}`;
    }

    const music = form.get("music");
    if (music instanceof File && music.size > 0) {
      const ext = path.extname(music.name) || ".mp3";
      const filename = `music-${uuid()}${ext}`;
      await fs.writeFile(
        path.join(BRAND_DIR, filename),
        Buffer.from(await music.arrayBuffer()),
      );
      partial.musicUrl = `/api/media/${filename}`;
    }

    const font = form.get("font");
    let customFontsUpdate: BrandKit["customFonts"] | undefined;
    if (font instanceof File && font.size > 0) {
      const ext = path.extname(font.name).toLowerCase() || ".woff2";
      const allowed = [".woff2", ".woff", ".ttf", ".otf"];
      if (!allowed.includes(ext)) {
        return NextResponse.json(
          { error: "Use .woff2, .woff, .ttf, or .otf" },
          { status: 400 },
        );
      }
      const id = uuid();
      const filename = `font-${id}${ext}`;
      await fs.writeFile(
        path.join(BRAND_DIR, filename),
        Buffer.from(await font.arrayBuffer()),
      );
      const baseName = font.name.replace(/\.[^.]+$/, "").trim() || "Custom";
      const family = `MSO-${id.slice(0, 8)}`;
      const current = await getBrandKit();
      customFontsUpdate = [
        ...(current.customFonts || []),
        {
          id,
          name: baseName,
          family,
          url: `/api/media/${filename}`,
        },
      ];
    }

    const brand = await saveBrandKit({
      ...partial,
      ...(customFontsUpdate ? { customFonts: customFontsUpdate } : {}),
    });
    return NextResponse.json({ brand });
  }

  const body = await req.json();
  const brand = await saveBrandKit(body);
  return NextResponse.json({ brand });
}

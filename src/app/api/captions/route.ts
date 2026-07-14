import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getProject, saveProject } from "@/lib/projects";
import { UPLOADS_DIR } from "@/lib/storage";
import type { CaptionLanguage, CaptionSegment, ProjectClip } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function mimeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  return "video/mp4";
}

async function whisperTranscribeFile(
  filePath: string,
  language: CaptionLanguage,
): Promise<CaptionSegment[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Add OPENAI_API_KEY to .env.local to extract captions from your video audio.",
    );
  }

  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeFor(filePath) }),
    path.basename(filePath),
  );
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  // Whisper language: bilingual keeps auto-detect for spoken language
  if (language === "en") form.append("language", "en");
  if (language === "fr") form.append("language", "fr");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper failed: ${err.slice(0, 400)}`);
  }

  const data = await res.json();
  const segments = (data.segments || []) as Array<{
    text: string;
    start: number;
    end: number;
  }>;

  if (!segments.length && data.text) {
    return [
      {
        text: String(data.text).trim(),
        startMs: 0,
        endMs: 4000,
      },
    ];
  }

  return segments
    .map((s) => ({
      text: s.text.trim(),
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
    }))
    .filter((s) => s.text.length > 0);
}

function usableMs(clip: ProjectClip) {
  const end = clip.trimEndMs > 0 ? clip.trimEndMs : clip.durationMs;
  return Math.max(500, end - clip.trimStartMs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const projectId = body.projectId as string;
  const language = (body.language || "en") as CaptionLanguage;

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const clips = [...project.clips].sort((a, b) => a.order - b.order);
  if (!clips.length) {
    return NextResponse.json(
      { error: "Upload at least one clip before extracting captions." },
      { status: 400 },
    );
  }

  try {
    const all: CaptionSegment[] = [];
    let offsetMs = 0;

    for (const clip of clips) {
      const filename = path.basename(clip.url);
      const filePath = path.join(UPLOADS_DIR, filename);
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Missing media file for clip “${clip.name}”.`);
      }

      const segments = await whisperTranscribeFile(filePath, language);
      for (const seg of segments) {
        // Map into timeline of trimmed clip (approximate — Whisper sees full file)
        const localStart = Math.max(0, seg.startMs - clip.trimStartMs);
        const localEnd = Math.min(usableMs(clip), seg.endMs - clip.trimStartMs);
        if (localEnd <= 0 || localStart >= usableMs(clip)) continue;
        all.push({
          text: seg.text,
          startMs: offsetMs + localStart,
          endMs: offsetMs + Math.max(localStart + 200, localEnd),
        });
      }
      offsetMs += usableMs(clip);
    }

    if (!all.length) {
      return NextResponse.json(
        {
          error:
            "No speech detected in the uploaded clips. Try a clearer voice recording.",
        },
        { status: 422 },
      );
    }

    const updated = await saveProject({
      ...project,
      captions: all,
      captionLanguage: language,
    });

    return NextResponse.json({ project: updated, source: "whisper" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Caption extraction failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

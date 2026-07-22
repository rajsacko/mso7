import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import {
  extractWhisperWav,
  mediaPathFromUrl,
} from "@/lib/audioEnhance";
import { getProject, saveProject } from "@/lib/projects";
import { ensureDataDirs, UPLOADS_DIR } from "@/lib/storage";
import {
  clipPositionsOnTimeline,
  usableClipDurationMs,
} from "@/lib/timeline";
import type {
  CaptionLanguage,
  CaptionSegment,
  CaptionWord,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

type WhisperWord = { word: string; start: number; end: number };
type WhisperSeg = {
  text: string;
  start: number;
  end: number;
  words?: WhisperWord[];
};

async function whisperTranscribeWav(
  filePath: string,
  language: CaptionLanguage,
): Promise<{ segments: CaptionSegment[]; words: CaptionWord[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Add OPENAI_API_KEY to .env.local to generate captions from your video.",
    );
  }

  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "audio/wav" }),
    path.basename(filePath) || "speech.wav",
  );
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  form.append("timestamp_granularities[]", "word");

  if (language === "en") form.append("language", "en");
  if (language === "fr") form.append("language", "fr");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Speech recognition failed: ${err.slice(0, 400)}`);
  }

  const data = await res.json();
  const rawSegs = (data.segments || []) as WhisperSeg[];
  const rawWords = (data.words || []) as WhisperWord[];

  const words: CaptionWord[] = rawWords
    .map((w) => ({
      word: String(w.word || "").trim(),
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
    }))
    .filter((w) => w.word.length > 0);

  let segments: CaptionSegment[] = rawSegs
    .map((s) => {
      const startMs = Math.round(s.start * 1000);
      const endMs = Math.round(s.end * 1000);
      const segWords =
        s.words?.map((w) => ({
          word: String(w.word || "").trim(),
          startMs: Math.round(w.start * 1000),
          endMs: Math.round(w.end * 1000),
        })) ||
        words.filter((w) => w.startMs >= startMs - 40 && w.endMs <= endMs + 40);
      return {
        text: s.text.trim(),
        startMs,
        endMs,
        words: segWords.filter((w) => w.word.length > 0),
      };
    })
    .filter((s) => s.text.length > 0);

  if (!segments.length && data.text) {
    const text = String(data.text).trim();
    if (text) {
      segments = [
        {
          text,
          startMs: 0,
          endMs: Math.max(
            2000,
            words.length ? words[words.length - 1].endMs : 4000,
          ),
          words: words.length ? words : undefined,
        },
      ];
    }
  }

  return { segments, words };
}

/** CapCut-style packing: readable lines, not one word per card. */
function packCaptionLines(
  segments: CaptionSegment[],
  opts?: { maxChars?: number; maxDurMs?: number; maxGapMs?: number },
): CaptionSegment[] {
  const maxChars = opts?.maxChars ?? 42;
  const maxDurMs = opts?.maxDurMs ?? 3200;
  const maxGapMs = opts?.maxGapMs ?? 450;
  if (!segments.length) return [];

  const out: CaptionSegment[] = [];
  let buf: CaptionSegment | null = null;

  for (const seg of segments) {
    if (!buf) {
      buf = { ...seg, words: seg.words ? [...seg.words] : undefined };
      continue;
    }
    const gap = seg.startMs - buf.endMs;
    const mergedText = `${buf.text} ${seg.text}`.replace(/\s+/g, " ").trim();
    const dur = seg.endMs - buf.startMs;
    const canMerge =
      gap >= 0 &&
      gap <= maxGapMs &&
      mergedText.length <= maxChars &&
      dur <= maxDurMs;

    if (canMerge) {
      buf = {
        text: mergedText,
        startMs: buf.startMs,
        endMs: seg.endMs,
        words: [...(buf.words || []), ...(seg.words || [])],
      };
    } else {
      out.push(buf);
      buf = { ...seg, words: seg.words ? [...seg.words] : undefined };
    }
  }
  if (buf) out.push(buf);
  return out;
}

export async function POST(req: NextRequest) {
  await ensureDataDirs();
  const body = await req.json();
  const projectId = body.projectId as string;
  const language = (body.language || "en") as CaptionLanguage;
  const enhanceAudio = body.enhanceAudio !== false;

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
      { error: "Upload at least one clip before generating captions." },
      { status: 400 },
    );
  }

  const fallback = project.defaultTransition || "crossfade";
  const positions = clipPositionsOnTimeline(clips, fallback);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        send({ type: "start", total: clips.length });
        const all: CaptionSegment[] = [];

        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          send({
            type: "clip",
            index: i,
            total: clips.length,
            name: clip.name,
            phase: "extract",
          });

          const filePath = mediaPathFromUrl(clip.url);
          try {
            await fs.access(filePath);
          } catch {
            throw new Error(`Missing media file for clip “${clip.name}”.`);
          }

          const trimDur = usableClipDurationMs(clip);
          const pos = positions.find((p) => p.id === clip.id);
          const timelineStart = pos?.startMs ?? 0;
          const wavPath = path.join(UPLOADS_DIR, `cap-${uuid()}.wav`);

          try {
            await extractWhisperWav(filePath, wavPath, {
              startMs: clip.trimStartMs,
              durationMs: trimDur,
              enhance: enhanceAudio,
            });

            send({
              type: "clip",
              index: i,
              total: clips.length,
              name: clip.name,
              phase: "transcribe",
            });

            const { segments } = await whisperTranscribeWav(wavPath, language);
            const packed = packCaptionLines(segments);

            for (const seg of packed) {
              const localStart = Math.max(0, seg.startMs);
              const localEnd = Math.min(
                trimDur,
                Math.max(localStart + 200, seg.endMs),
              );
              if (localStart >= trimDur) continue;
              all.push({
                text: seg.text,
                startMs: timelineStart + localStart,
                endMs: timelineStart + localEnd,
                words: seg.words?.map((w) => ({
                  ...w,
                  startMs: timelineStart + w.startMs,
                  endMs: timelineStart + w.endMs,
                })),
              });
            }

            send({
              type: "clip_done",
              index: i,
              total: clips.length,
              name: clip.name,
              lines: packed.length,
            });
          } finally {
            await fs.unlink(wavPath).catch(() => undefined);
          }
        }

        if (!all.length) {
          send({
            type: "error",
            error:
              "No speech detected. Try Reduce noise first, then generate captions again.",
          });
          return;
        }

        all.sort((a, b) => a.startMs - b.startMs);
        const updated = await saveProject({
          ...project,
          captions: all,
          captionLanguage: language,
          showCaptionOverlay: true,
        });

        send({
          type: "done",
          project: updated,
          source: "whisper",
          count: all.length,
        });
      } catch (error) {
        send({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Caption generation failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

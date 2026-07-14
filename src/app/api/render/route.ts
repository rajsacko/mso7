import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getBrandKit, getProject, saveProject } from "@/lib/projects";
import {
  ensureDataDirs,
  RENDERS_DIR,
  readJsonFile,
  writeJsonFile,
} from "@/lib/storage";
import type { RenderJob } from "@/lib/types";
import { compositionIdFor } from "@/lib/composition";
import type { CompositionProps } from "@/remotion/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function jobPath(id: string) {
  return path.join(RENDERS_DIR, `${id}.json`);
}

async function saveJob(job: RenderJob) {
  await writeJsonFile(jobPath(job.id), job);
  return job;
}

function absoluteMediaUrl(url: string | undefined, origin: string) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `${origin}${url}`;
}

export async function POST(req: NextRequest) {
  await ensureDataDirs();
  const body = await req.json();
  const projectId = body.projectId as string;
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const maxSeconds = Number(process.env.MAX_RENDER_SECONDS || 180);
  const roughSeconds =
    project.clips.reduce((sum, c) => {
      const end = c.trimEndMs || c.durationMs;
      return sum + Math.max(0, end - c.trimStartMs);
    }, 0) / 1000;

  if (roughSeconds > maxSeconds) {
    return NextResponse.json(
      {
        error: `Project exceeds max render length (${maxSeconds}s). Trim clips first.`,
      },
      { status: 400 },
    );
  }

  const jobId = uuid();
  const now = new Date().toISOString();
  let job: RenderJob = {
    id: jobId,
    projectId,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  await saveJob(job);

  const origin = req.nextUrl.origin;
  const brand = await getBrandKit();

  // Fire-and-forget render (dev/server). Client polls GET /api/render/[id]
  void (async () => {
    try {
      job = await saveJob({
        ...job,
        status: "rendering",
        progress: 5,
        updatedAt: new Date().toISOString(),
      });

      const entry = path.join(process.cwd(), "src", "remotion", "index.ts");
      const serveUrl = await bundle({
        entryPoint: entry,
        webpackOverride: (config) => config,
      });

      const inputProps: CompositionProps = {
        brand,
        format: project.format,
        preset: project.preset,
        clips: project.clips.map((c) => ({
          ...c,
          url: absoluteMediaUrl(c.url, origin)!,
          transitionOut: c.transitionOut || project.defaultTransition || "none",
        })),
        overlays: (project.overlays || []).map((o) => ({
          ...o,
          imageUrl: absoluteMediaUrl(o.imageUrl, origin),
          videoUrl: absoluteMediaUrl(o.videoUrl, origin),
        })),
        hook: project.hook,
        subtitle: project.subtitle,
        lowerThird: project.lowerThird?.trim() || "",
        principle: project.principle,
        chapterLabels: project.chapterLabels,
        question: project.question,
        answer: project.answer,
        captions: project.captions,
        captionLanguage: project.captionLanguage,
        voiceOverUrl: absoluteMediaUrl(project.voiceOver.url, origin),
        musicUrl: absoluteMediaUrl(
          project.musicUrl || brand.musicUrl,
          origin,
        ),
        lookId: project.lookId || "none",
        defaultTransition: project.defaultTransition || "crossfade",
        previewPreset: false,
        musicStartMs: project.musicStartMs || 0,
        musicEndMs: project.musicEndMs || 0,
        musicVolume: project.musicVolume ?? 0.22,
      };

      const compositionId = compositionIdFor(project.preset, project.format);
      const composition = await selectComposition({
        serveUrl,
        id: compositionId,
        inputProps: inputProps as unknown as Record<string, unknown>,
      });

      const filename = `${jobId}.mp4`;
      const outputPath = path.join(RENDERS_DIR, filename);

      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps: inputProps as unknown as Record<string, unknown>,
        ...(process.env.REMOTION_CHROME_EXECUTABLE_PATH
          ? {
              browserExecutable: process.env.REMOTION_CHROME_EXECUTABLE_PATH,
            }
          : {}),
        onProgress: async ({ progress }) => {
          job = {
            ...job,
            status: "rendering",
            progress: Math.round(progress * 100),
            updatedAt: new Date().toISOString(),
          };
          await writeJsonFile(jobPath(job.id), job);
        },
      });

      job = await saveJob({
        ...job,
        status: "ready",
        progress: 100,
        outputUrl: `/api/media/${filename}`,
        updatedAt: new Date().toISOString(),
      });

      await saveProject({
        ...project,
        lastRenderId: job.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Render failed";
      await saveJob({
        ...job,
        status: "error",
        error: message.slice(0, 500),
        updatedAt: new Date().toISOString(),
      });
    }
  })();

  return NextResponse.json({ job }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const job = await readJsonFile<RenderJob>(jobPath(id));
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}

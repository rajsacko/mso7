import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import {
  enhanceMediaFile,
  mediaPathFromUrl,
  publicMediaUrl,
  type EnhanceStrength,
} from "@/lib/audioEnhance";
import { getProject, saveProject } from "@/lib/projects";
import { ensureDataDirs, UPLOADS_DIR } from "@/lib/storage";
import type { ProjectClip } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function resolveStrength(raw: unknown): EnhanceStrength {
  if (raw === "light" || raw === "strong") return raw;
  return "medium";
}

async function enhanceClipFile(
  clip: ProjectClip,
  strength: EnhanceStrength,
): Promise<ProjectClip> {
  const sourceUrl = clip.originalUrl || clip.url;
  const inputPath = mediaPathFromUrl(sourceUrl);
  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Missing media for clip “${clip.name}”.`);
  }

  const outName = `${uuid()}-clean.mp4`;
  const outPath = path.join(UPLOADS_DIR, outName);
  await enhanceMediaFile(inputPath, outPath, strength);

  // Drop previous enhanced remux if it isn't the original
  if (clip.url !== sourceUrl) {
    const prev = mediaPathFromUrl(clip.url);
    if (prev !== inputPath) {
      await fs.unlink(prev).catch(() => undefined);
    }
  }

  return {
    ...clip,
    originalUrl: sourceUrl,
    url: publicMediaUrl(outName),
    audioEnhanced: true,
    enhanceStrength: strength,
  };
}

export async function POST(req: NextRequest) {
  await ensureDataDirs();
  const body = await req.json();
  const projectId = body.projectId as string;
  const clipId = body.clipId as string | undefined;
  const allClips = Boolean(body.allClips);
  const voiceOver = Boolean(body.voiceOver);
  const restore = Boolean(body.restore);
  const strength = resolveStrength(body.strength);

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    if (voiceOver) {
      const voUrl = project.voiceOver.url;
      if (!voUrl) {
        return NextResponse.json(
          { error: "Record or upload a voice take first." },
          { status: 400 },
        );
      }
      if (restore) {
        const original = project.voiceOver.originalUrl || voUrl;
        if (voUrl !== original) {
          await fs.unlink(mediaPathFromUrl(voUrl)).catch(() => undefined);
        }
        const updated = await saveProject({
          ...project,
          voiceOver: {
            ...project.voiceOver,
            url: original,
            originalUrl: original,
            audioEnhanced: false,
          },
        });
        return NextResponse.json({ project: updated });
      }

      const sourceUrl = project.voiceOver.originalUrl || voUrl;
      const inputPath = mediaPathFromUrl(sourceUrl);
      const outName = `${uuid()}-vo-clean.m4a`;
      const outPath = path.join(UPLOADS_DIR, outName);
      await enhanceMediaFile(inputPath, outPath, strength);
      if (voUrl !== sourceUrl) {
        await fs.unlink(mediaPathFromUrl(voUrl)).catch(() => undefined);
      }
      const updated = await saveProject({
        ...project,
        voiceOver: {
          ...project.voiceOver,
          originalUrl: sourceUrl,
          url: publicMediaUrl(outName),
          audioEnhanced: true,
          status: "ready",
        },
      });
      return NextResponse.json({ project: updated, strength });
    }

    if (restore && clipId) {
      const clip = project.clips.find((c) => c.id === clipId);
      if (!clip) {
        return NextResponse.json({ error: "Clip not found" }, { status: 404 });
      }
      const original = clip.originalUrl || clip.url;
      if (clip.url !== original) {
        await fs.unlink(mediaPathFromUrl(clip.url)).catch(() => undefined);
      }
      const clips = project.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              url: original,
              originalUrl: original,
              audioEnhanced: false,
              enhanceStrength: undefined,
            }
          : c,
      );
      const updated = await saveProject({ ...project, clips });
      return NextResponse.json({ project: updated });
    }

    const targets = allClips
      ? [...project.clips].sort((a, b) => a.order - b.order)
      : project.clips.filter((c) => c.id === clipId);

    if (!targets.length) {
      return NextResponse.json(
        {
          error: allClips
            ? "Upload a clip first."
            : "Select a clip to enhance its audio.",
        },
        { status: 400 },
      );
    }

    const enhancedMap = new Map<string, ProjectClip>();
    for (const clip of targets) {
      enhancedMap.set(clip.id, await enhanceClipFile(clip, strength));
    }

    const clips = project.clips.map((c) => enhancedMap.get(c.id) || c);
    const updated = await saveProject({ ...project, clips });
    return NextResponse.json({
      project: updated,
      strength,
      count: enhancedMap.size,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Audio enhance failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import path from "path";
import { v4 as uuid } from "uuid";
import {
  BRAND_FILE,
  ensureDataDirs,
  PROJECTS_DIR,
  readJsonFile,
  writeJsonFile,
} from "./storage";
import {
  BrandKit,
  DEFAULT_BRAND,
  FormatId,
  PresetId,
  Project,
  ProjectClip,
} from "./types";

/** Backfill fields added after early project JSON files were saved. */
export function normalizeProjectData(project: Project): Project {
  return {
    ...project,
    overlays: project.overlays ?? [],
    previewPreset: false,
    defaultTransition: project.defaultTransition ?? "crossfade",
    lookId: project.lookId ?? "none",
    showTitle: project.showTitle ?? false,
    showCaptionOverlay: project.showCaptionOverlay ?? true,
    musicStartMs: project.musicStartMs ?? 0,
    musicEndMs: project.musicEndMs ?? 0,
    musicVolume:
      typeof project.musicVolume === "number" ? project.musicVolume : 0.22,
    chapterLabels: project.chapterLabels?.length
      ? project.chapterLabels
      : ["Studio", "Client", "Lesson"],
    voiceOver: project.voiceOver ?? { text: "", status: "idle" },
    clips: (project.clips || []).map((clip, order) => ({
      ...clip,
      order: clip.order ?? order,
      transitionOut: clip.transitionOut || "none",
      trimStartMs: clip.trimStartMs ?? 0,
      trimEndMs:
        clip.trimEndMs && clip.trimEndMs > 0
          ? clip.trimEndMs
          : clip.durationMs || 5000,
    })),
  };
}

export async function getBrandKit(): Promise<BrandKit> {
  await ensureDataDirs();
  const existing = await readJsonFile<BrandKit>(BRAND_FILE);
  if (existing) {
    return {
      ...DEFAULT_BRAND,
      ...existing,
      customFonts: existing.customFonts ?? [],
    };
  }
  await writeJsonFile(BRAND_FILE, DEFAULT_BRAND);
  return DEFAULT_BRAND;
}

export async function saveBrandKit(
  partial: Partial<BrandKit>,
): Promise<BrandKit> {
  const current = await getBrandKit();
  const next: BrandKit = {
    ...current,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(BRAND_FILE, next);
  return next;
}

function projectPath(id: string) {
  return path.join(PROJECTS_DIR, `${id}.json`);
}

export async function listProjects(): Promise<Project[]> {
  await ensureDataDirs();
  const { promises: fs } = await import("fs");
  const files = await fs.readdir(PROJECTS_DIR);
  const projects: Project[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const project = await readJsonFile<Project>(path.join(PROJECTS_DIR, file));
    if (project) projects.push(normalizeProjectData(project));
  }
  return projects.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  await ensureDataDirs();
  const project = await readJsonFile<Project>(projectPath(id));
  return project ? normalizeProjectData(project) : null;
}

export async function saveProject(project: Project): Promise<Project> {
  await ensureDataDirs();
  const next = normalizeProjectData({
    ...project,
    updatedAt: new Date().toISOString(),
  });
  await writeJsonFile(projectPath(project.id), next);
  return next;
}

export async function deleteProject(id: string): Promise<void> {
  await ensureDataDirs();
  const { promises: fs } = await import("fs");
  try {
    await fs.unlink(projectPath(id));
  } catch {
    // ignore missing
  }
}

export function createProjectInput(input: {
  title?: string;
  format: FormatId;
  preset: PresetId;
  clips?: ProjectClip[];
}): Project {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    title: input.title?.trim() || "Untitled piece",
    format: input.format,
    preset: input.preset,
    clips: input.clips ?? [],
    hook: "When the work has to be right.",
    subtitle: "A Designer's Diary",
    lowerThird: "",
    principle: "Form follows patience.",
    chapterLabels: ["Studio", "Client", "Lesson"],
    question: "What makes a space feel inevitable?",
    answer: "Restraint. Material truth. Time.",
    captions: [],
    captionLanguage: "en",
    showTitle: false,
    showCaptionOverlay: true,
    previewPreset: false,
    lookId: "none",
    defaultTransition: "crossfade",
    overlays: [],
    voiceOver: { text: "", status: "idle" },
    musicStartMs: 0,
    musicEndMs: 0,
    musicVolume: 0.22,
    createdAt: now,
    updatedAt: now,
  };
}

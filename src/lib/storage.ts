import { promises as fs } from "fs";
import os from "os";
import path from "path";

/**
 * On Vercel, `/var/task` is read-only — use /tmp.
 * On Docker/VPS, persist under ./data (or DATA_ROOT).
 * Note: /tmp is ephemeral and not shared across instances.
 */
function resolveDataRoot() {
  if (process.env.DATA_ROOT) return process.env.DATA_ROOT;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "mso7-data");
  }
  return path.join(process.cwd(), "data");
}

export const DATA_ROOT = resolveDataRoot();
export const PROJECTS_DIR = path.join(DATA_ROOT, "projects");
export const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");
export const BRAND_DIR = path.join(DATA_ROOT, "brand");
export const RENDERS_DIR = path.join(DATA_ROOT, "renders");
export const BRAND_FILE = path.join(BRAND_DIR, "brand.json");

export async function ensureDataDirs() {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await Promise.all([
    fs.mkdir(PROJECTS_DIR, { recursive: true }),
    fs.mkdir(UPLOADS_DIR, { recursive: true }),
    fs.mkdir(BRAND_DIR, { recursive: true }),
    fs.mkdir(RENDERS_DIR, { recursive: true }),
  ]);
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

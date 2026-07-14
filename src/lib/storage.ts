import { promises as fs } from "fs";
import path from "path";

export const DATA_ROOT = path.join(process.cwd(), "data");
export const PROJECTS_DIR = path.join(DATA_ROOT, "projects");
export const UPLOADS_DIR = path.join(DATA_ROOT, "uploads");
export const BRAND_DIR = path.join(DATA_ROOT, "brand");
export const RENDERS_DIR = path.join(DATA_ROOT, "renders");
export const BRAND_FILE = path.join(BRAND_DIR, "brand.json");

export async function ensureDataDirs() {
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

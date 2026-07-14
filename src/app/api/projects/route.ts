import { NextRequest, NextResponse } from "next/server";
import {
  createProjectInput,
  listProjects,
  saveProject,
} from "@/lib/projects";
import type { FormatId, PresetId } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const format = body.format as FormatId;
  // Preset packing removed — keep a dormant field for older project JSON.
  const preset = (body.preset as PresetId) || "designers-diary";

  if (!format) {
    return NextResponse.json({ error: "format is required" }, { status: 400 });
  }

  const project = createProjectInput({
    title: body.title,
    format,
    preset,
    clips: body.clips,
  });
  await saveProject(project);
  return NextResponse.json({ project }, { status: 201 });
}

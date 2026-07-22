import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { cancelRenderJob } from "@/lib/renderCancel";
import { RENDERS_DIR, readJsonFile, writeJsonFile } from "@/lib/storage";
import type { RenderJob } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function jobPath(id: string) {
  return path.join(RENDERS_DIR, `${id}.json`);
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = await readJsonFile<RenderJob>(jobPath(id));
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}

/** Soft-cancel an in-flight export. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = await readJsonFile<RenderJob>(jobPath(id));
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.status === "ready" || job.status === "error") {
    return NextResponse.json({ job });
  }
  cancelRenderJob(id);
  const next: RenderJob = {
    ...job,
    status: "cancelled",
    error: "Cancelled",
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(jobPath(id), next);
  return NextResponse.json({ job: next });
}

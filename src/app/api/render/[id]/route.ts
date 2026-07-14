import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { RENDERS_DIR, readJsonFile } from "@/lib/storage";
import type { RenderJob } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = await readJsonFile<RenderJob>(
    path.join(RENDERS_DIR, `${id}.json`),
  );
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}

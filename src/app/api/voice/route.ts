import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** AI TTS retired — voiceover is recorded in the studio with the microphone. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "AI voiceover generation is disabled. Record with your microphone in the studio.",
    },
    { status: 410 },
  );
}

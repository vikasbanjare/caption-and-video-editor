import { NextRequest, NextResponse } from "next/server";
import { cuesFromWords } from "@/engine";
import {
  activeProvider,
  buildStubSrt,
  transcribeMedia,
} from "@/server/transcription";

/**
 * Transcription endpoint (WEBSAASPLAN.md §4.2 / §4.3).
 *
 *   GET  → which provider is active and whether it needs the media uploaded.
 *   POST → run it:
 *          • multipart/form-data (file + language) → real ASR (Deepgram),
 *            returns word-timed cues.
 *          • application/json   ({durationSeconds, language}) → stub sample SRT.
 *
 * Set DEEPGRAM_API_KEY to switch from the stub to real transcription. The
 * request/response shape is stable across that swap so the client doesn't care
 * which backend ran.
 */

export const runtime = "nodejs";
// Allow larger uploads for the real (media) path.
export const maxDuration = 60;

export async function GET() {
  const p = activeProvider();
  return NextResponse.json({
    provider: p.id,
    label: p.label,
    ready: p.ready,
    needsMedia: p.needsMedia,
  });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  const provider = activeProvider();

  // --- real ASR path: media uploaded as multipart/form-data ------------------
  if (contentType.includes("multipart/form-data")) {
    if (!provider.needsMedia) {
      return NextResponse.json(
        { error: "No media-based transcription provider is configured." },
        { status: 501 }
      );
    }
    try {
      const form = await req.formData();
      const file = form.get("file");
      const language = String(form.get("language") || "en");
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "Missing file." }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      const words = await transcribeMedia({
        bytes,
        contentType: file.type || "application/octet-stream",
        language,
      });
      return NextResponse.json({
        provider: provider.id,
        language,
        cues: cuesFromWords(words),
      });
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message || "Transcription failed." },
        { status: 502 }
      );
    }
  }

  // --- stub path: JSON metadata only ----------------------------------------
  let body: { durationSeconds?: number; language?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body → defaults
  }
  const durationSeconds = Number(body.durationSeconds) || 30;
  const language = body.language || "en";

  // Simulate a little async work without holding the request too long.
  await new Promise((r) => setTimeout(r, 400));

  return NextResponse.json({
    stub: true,
    provider: "stub",
    language,
    srt: buildStubSrt(durationSeconds, language),
    note:
      "Stubbed transcript. Set DEEPGRAM_API_KEY to enable real word-level transcription.",
  });
}

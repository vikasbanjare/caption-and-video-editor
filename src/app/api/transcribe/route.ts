import { NextRequest, NextResponse } from "next/server";

/**
 * Transcription STUB (WEBSAASPLAN.md §6 Phase 1: "transcription via a cloud API
 * stub first"). It does NOT touch the video — it returns a believable sample
 * transcript spread across the clip's duration so the whole editor flow
 * (transcribe → editable transcript → live styled preview) works end to end.
 *
 * Phase 2 replaces the body of this handler with a real call: enqueue a job,
 * run WhisperX / a commercial API on the audio, and return word-level cues
 * (§4.3). The request/response shape is meant to survive that swap.
 */

export const runtime = "nodejs";

const EN_SCRIPT = [
  "Okay so here is the one thing nobody tells you",
  "most people quit right before it actually works",
  "the secret is showing up when you do not feel like it",
  "small reps every single day beat one big burst",
  "save this so you remember it next week",
  "and if this helped you follow for part two",
];

// Showcases Hinglish romanization when language is "hi".
const HI_SCRIPT = [
  "देखो दोस्तों आज मैं आपको एक राज़ बताने वाला हूँ",
  "ज़्यादातर लोग ठीक पहले ही हार मान लेते हैं",
  "रोज़ थोड़ा थोड़ा करना ही असली जादू है",
  "इसे सेव कर लो ताकि अगले हफ़्ते याद रहे",
];

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}
function tc(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function buildSrt(durationSeconds: number, language: string): string {
  const script = language?.toLowerCase().startsWith("hi") ? HI_SCRIPT : EN_SCRIPT;
  const dur = Math.max(4, Math.min(durationSeconds || 30, 60 * 30));
  const perCue = Math.max(1.6, Math.min(2.6, dur / script.length));

  const blocks: string[] = [];
  let t = 0.2;
  let i = 0;
  let n = 1;
  while (t < dur - 0.2) {
    const line = script[i % script.length];
    const end = Math.min(dur, t + perCue);
    blocks.push(`${n}\n${tc(t)} --> ${tc(end)}\n${line}`);
    t = end + 0.05;
    i++;
    n++;
  }
  return blocks.join("\n\n") + "\n";
}

export async function POST(req: NextRequest) {
  let body: { durationSeconds?: number; language?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — fall back to defaults
  }

  const durationSeconds = Number(body.durationSeconds) || 30;
  const language = body.language || "en";

  // Simulate async work without holding the request too long.
  await new Promise((r) => setTimeout(r, 600));

  return NextResponse.json({
    stub: true,
    language,
    srt: buildSrt(durationSeconds, language),
    note:
      "Stubbed transcript (Phase 1). Replace /api/transcribe with WhisperX or a commercial ASR in Phase 2.",
  });
}

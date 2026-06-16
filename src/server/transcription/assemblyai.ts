import type { TimedWords, TranscribeAudioInput } from "./types";
import { parseAssemblyaiWords } from "./parse";

/**
 * AssemblyAI (Universal) backend — a second commercial ASR option from
 * WEBSAASPLAN.md §4.3. Unlike Deepgram's single request, AssemblyAI is async:
 * upload bytes → create a transcript job → poll until it completes. That makes
 * it a natural fit for the queue/progress model (§4.2) once long videos arrive.
 *
 * Requires ASSEMBLYAI_API_KEY. Not exercised by CI (no key / egress); the
 * response parsing it relies on IS unit-tested.
 */

const BASE = "https://api.assemblyai.com/v2";
const POLL_INTERVAL_MS = 2500;
const MAX_WAIT_MS = 5 * 60 * 1000;

export function assemblyaiConfigured(): boolean {
  return !!process.env.ASSEMBLYAI_API_KEY;
}

export async function transcribeAssemblyai(
  input: TranscribeAudioInput
): Promise<TimedWords> {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error("ASSEMBLYAI_API_KEY is not set");
  const auth = { authorization: key };

  // 1) Upload the media bytes.
  const up = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/octet-stream" },
    body: input.bytes,
  });
  if (!up.ok) {
    throw new Error(`AssemblyAI upload ${up.status}: ${(await up.text()).slice(0, 200)}`);
  }
  const { upload_url } = (await up.json()) as { upload_url: string };

  // 2) Create the transcription job.
  const payload: Record<string, unknown> = { audio_url: upload_url };
  if (input.language && input.language !== "auto") {
    payload.language_code = input.language;
  }
  const create = await fetch(`${BASE}/transcript`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!create.ok) {
    throw new Error(
      `AssemblyAI create ${create.status}: ${(await create.text()).slice(0, 200)}`
    );
  }
  const { id } = (await create.json()) as { id: string };

  // 3) Poll until done.
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const poll = await fetch(`${BASE}/transcript/${id}`, { headers: auth });
    const data = (await poll.json()) as { status: string; error?: string };
    if (data.status === "completed") {
      const words = parseAssemblyaiWords(data);
      if (words.length === 0) throw new Error("AssemblyAI returned no words");
      return words;
    }
    if (data.status === "error") {
      throw new Error(`AssemblyAI error: ${data.error ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("AssemblyAI transcription timed out");
}

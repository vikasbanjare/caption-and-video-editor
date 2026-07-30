import type { TimedWords, TranscribeAudioInput } from "./types";
import { parseDeepgramWords } from "./parse";

/**
 * Deepgram (Nova) backend — the "fastest path to top accuracy" launch option
 * from WEBSAASPLAN.md §4.3. One synchronous request: POST the media bytes, get
 * word-level timestamps back. Cheap to run (no GPU of our own) and fast enough
 * to do inline for short-form clips; the queue/worker split (§3) comes later
 * for long videos.
 *
 * Requires DEEPGRAM_API_KEY. Not exercised by CI (no key / egress in the
 * sandbox); the response parsing it depends on IS covered by unit tests.
 */

const ENDPOINT = "https://api.deepgram.com/v1/listen";

export function deepgramConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY;
}

export async function transcribeDeepgram(
  input: TranscribeAudioInput
): Promise<TimedWords> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set");

  const model = process.env.DEEPGRAM_MODEL || "nova-2";
  const params = new URLSearchParams({
    model,
    smart_format: "true",
    punctuate: "true",
  });
  // Let Deepgram auto-detect unless the user picked a specific language.
  if (input.language && input.language !== "auto") {
    params.set("language", input.language);
  }

  const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": input.contentType || "application/octet-stream",
    },
    body: input.bytes,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Deepgram ${res.status}: ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  const words = parseDeepgramWords(json);
  if (words.length === 0) {
    throw new Error("Deepgram returned no words for this media");
  }
  return words;
}

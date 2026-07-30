import type { Word } from "@/engine";
import type { TimedWords } from "./types";

/**
 * Pure parsers that turn an ASR provider's JSON into our flat, word-timed
 * format. Kept side-effect-free so they're unit-tested against fixtures — that
 * way the integration's core correctness is verified without a live API call.
 */

/**
 * Deepgram (Nova) `listen` response. Word-level timestamps live at
 * `results.channels[0].alternatives[0].words[]`, each with `start`/`end`
 * (seconds) and a `punctuated_word` we prefer for readable captions.
 */
export function parseDeepgramWords(json: unknown): TimedWords {
  const root = json as DeepgramResponse;
  const alt = root?.results?.channels?.[0]?.alternatives?.[0];
  const words = alt?.words ?? [];
  return words
    .map((w): Word | null => {
      if (typeof w.start !== "number" || typeof w.end !== "number") return null;
      const text = (w.punctuated_word ?? w.word ?? "").trim();
      if (!text) return null;
      return { text, start: w.start, end: Math.max(w.start, w.end) };
    })
    .filter((w): w is Word => w !== null);
}

/**
 * AssemblyAI transcript response. `words[]` carry `start`/`end` in
 * **milliseconds**, so divide by 1000.
 */
export function parseAssemblyaiWords(json: unknown): TimedWords {
  const root = json as AssemblyaiResponse;
  const words = root?.words ?? [];
  return words
    .map((w): Word | null => {
      if (typeof w.start !== "number" || typeof w.end !== "number") return null;
      const text = (w.text ?? "").trim();
      if (!text) return null;
      return { text, start: w.start / 1000, end: Math.max(w.start, w.end) / 1000 };
    })
    .filter((w): w is Word => w !== null);
}

// --- minimal shapes we read (providers return much more) -------------------

interface DeepgramWord {
  word?: string;
  punctuated_word?: string;
  start?: number;
  end?: number;
}
interface DeepgramResponse {
  results?: {
    channels?: Array<{ alternatives?: Array<{ words?: DeepgramWord[] }> }>;
  };
}

interface AssemblyaiWord {
  text?: string;
  start?: number; // ms
  end?: number; // ms
}
interface AssemblyaiResponse {
  words?: AssemblyaiWord[];
}

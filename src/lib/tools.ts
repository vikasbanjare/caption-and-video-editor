import type { Cue, Word } from "@/engine";

/**
 * Browser-feasible tools ported in spirit from the Pulse plugin's non-caption
 * features: filler-word / stutter clean-up and auto-chapters from the
 * transcript. (Silence-cut, multicam, and noise reduction need a video
 * decode/encode pipeline and land with export.)
 */

// Conservative single-word filler set — safe to drop from captions.
const FILLERS = new Set([
  "um", "umm", "ummm", "uh", "uhh", "uhm", "uhhh", "er", "err", "erm",
  "ah", "ahh", "hmm", "hmmm", "mmm", "mhm", "mm", "eh",
]);

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Remove filler words ("um", "uh"…) and immediate stutter repeats
 * ("the the" → "the") from every cue. Cues left empty are dropped.
 */
export function removeFillerWords(cues: Cue[]): { cues: Cue[]; removed: number } {
  let removed = 0;
  const out: Cue[] = [];
  for (const c of cues) {
    const kept: Word[] = [];
    let prev = "";
    for (const w of c.words) {
      const n = norm(w.text);
      if (n && FILLERS.has(n)) {
        removed++;
        continue;
      }
      if (n && n === prev) {
        removed++;
        continue;
      }
      kept.push(w);
      prev = n;
    }
    if (kept.length === 0) continue;
    out.push({ ...c, text: kept.map((w) => w.text).join(" "), words: kept });
  }
  return { cues: out, removed };
}

export interface Chapter {
  start: number;
  title: string;
}

/** "0:00", "1:23", "1:02:03" — YouTube-style chapter timestamps. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const titleize = (s: string) =>
  s.replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

/**
 * Auto-chapters: start a new chapter at a silence gap ≥ `gap` seconds, but no
 * more often than `minSpacing`. The first chapter is always at 0:00. Titles are
 * the opening words of each chapter's first cue.
 */
export function generateChapters(
  cues: Cue[],
  gap = 2.5,
  minSpacing = 12
): Chapter[] {
  if (cues.length === 0) return [];
  const title = (c: Cue) => titleize(c.words.slice(0, 6).map((w) => w.text).join(" "));

  const chapters: Chapter[] = [{ start: 0, title: title(cues[0]) }];
  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1];
    const cur = cues[i];
    if (
      cur.start - prev.end >= gap &&
      cur.start - chapters[chapters.length - 1].start >= minSpacing
    ) {
      chapters.push({ start: cur.start, title: title(cur) });
    }
  }
  return chapters;
}

/** Render chapters as a YouTube-ready description block. */
export function chaptersToText(chapters: Chapter[]): string {
  return chapters.map((c) => `${formatTimestamp(c.start)} ${c.title}`).join("\n");
}

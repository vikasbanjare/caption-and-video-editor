import type { Cue } from "@/engine";
import { splitWords } from "@/engine";

/**
 * Pure edit operations on a cue list — the editable-transcript + timeline
 * feature set (WEBSAASPLAN.md §4.1). Each returns a new array so React state
 * updates stay immutable, and every operation PRESERVES real per-word ASR
 * timings wherever possible (only text edits re-distribute word timing).
 */

let _eid = 0;
const editId = () => `e${(_eid++).toString(36)}${Date.now().toString(36)}`;

/** Minimum cue duration in seconds — prevents zero/negative-length cues. */
export const MIN_CUE = 0.1;

/** Replace a cue's text and re-distribute word timings across its span. */
export function updateCueText(cues: Cue[], id: string, text: string): Cue[] {
  return cues.map((c) =>
    c.id === id ? { ...c, text, words: splitWords(text, c.start, c.end) } : c
  );
}

/**
 * Re-time a cue to a new [start, end] window, scaling its word timings
 * proportionally so real ASR word sync survives trims/moves (an even re-split
 * would throw the karaoke timing away).
 */
export function retimeCue(
  cues: Cue[],
  id: string,
  start: number,
  end: number
): Cue[] {
  const s = Math.max(0, start);
  const e = Math.max(s + MIN_CUE, end);
  return cues.map((c) => {
    if (c.id !== id) return c;
    const oldSpan = Math.max(0.001, c.end - c.start);
    const scale = (e - s) / oldSpan;
    return {
      ...c,
      start: s,
      end: e,
      words: c.words.map((w) => ({
        ...w,
        start: s + (w.start - c.start) * scale,
        end: s + (w.end - c.start) * scale,
      })),
    };
  });
}

/** Delete a cue. */
export function deleteCue(cues: Cue[], id: string): Cue[] {
  return cues.filter((c) => c.id !== id);
}

/**
 * Merge a cue into the one after it. Word objects (and their real timings)
 * are concatenated untouched; only the cue envelope changes.
 */
export function mergeWithNext(cues: Cue[], id: string): Cue[] {
  const i = cues.findIndex((c) => c.id === id);
  if (i < 0 || i >= cues.length - 1) return cues;
  const a = cues[i];
  const b = cues[i + 1];
  const merged: Cue = {
    id: a.id,
    start: a.start,
    end: b.end,
    text: `${a.text} ${b.text}`.trim(),
    words: [...a.words, ...b.words],
  };
  return [...cues.slice(0, i), merged, ...cues.slice(i + 2)];
}

/**
 * Split a cue into two at a word boundary (`at` = word index, defaults to the
 * middle). Word objects keep their original timings; the boundary time is the
 * first right-hand word's start.
 */
export function splitCue(cues: Cue[], id: string, at?: number): Cue[] {
  const i = cues.findIndex((c) => c.id === id);
  if (i < 0) return cues;
  const c = cues[i];
  if (c.words.length < 2) return cues;

  const idx = Math.min(
    c.words.length - 1,
    Math.max(1, at ?? Math.floor(c.words.length / 2))
  );
  const left = c.words.slice(0, idx);
  const right = c.words.slice(idx);
  const splitTime = Math.min(
    Math.max(right[0].start, c.start + MIN_CUE),
    c.end - MIN_CUE
  );
  if (!(splitTime > c.start && splitTime < c.end)) return cues;

  const a: Cue = {
    id: editId(),
    start: c.start,
    end: splitTime,
    text: left.map((w) => w.text).join(" "),
    words: left,
  };
  const b: Cue = {
    id: editId(),
    start: splitTime,
    end: c.end,
    text: right.map((w) => w.text).join(" "),
    words: right,
  };
  return [...cues.slice(0, i), a, b, ...cues.slice(i + 1)];
}

/**
 * Split whatever cue contains time `t`, at the word boundary nearest to `t`.
 * Used by the timeline's split-at-playhead. No-op if `t` isn't inside a cue.
 */
export function splitCueAtTime(cues: Cue[], t: number): Cue[] {
  const cue = cues.find((c) => t > c.start && t < c.end);
  if (!cue || cue.words.length < 2) return cues;
  let best = 1;
  let bestD = Infinity;
  for (let k = 1; k < cue.words.length; k++) {
    const d = Math.abs(cue.words[k].start - t);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return splitCue(cues, cue.id, best);
}

/**
 * Insert a new caption in the empty gap at time `t` (used by the timeline's
 * "add caption at playhead"). Clamped so it never overlaps the next cue.
 * No-op when `t` is inside an existing cue or the gap is too small.
 */
export function insertCueAt(
  cues: Cue[],
  t: number,
  text = "New caption"
): Cue[] {
  if (cues.some((c) => t >= c.start && t < c.end)) return cues;
  const next = cues.find((c) => c.start >= t);
  let prevEnd = 0;
  for (const c of cues) if (c.end <= t && c.end > prevEnd) prevEnd = c.end;

  const start = Math.max(t, prevEnd);
  const end = next ? Math.min(start + 1.5, next.start) : start + 1.5;
  if (end - start < MIN_CUE) return cues;

  const cue: Cue = {
    id: editId(),
    start,
    end,
    text,
    words: splitWords(text, start, end),
  };
  const idx = next ? cues.indexOf(next) : cues.length;
  return [...cues.slice(0, idx), cue, ...cues.slice(idx)];
}

/** mm:ss.t for compact display in the transcript list and timeline. */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const t = Math.floor((s - Math.floor(s)) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${t}`;
}

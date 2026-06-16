import type { Cue } from "@/engine";
import { splitWords } from "@/engine";

/**
 * Pure edit operations on a cue list — the editable-transcript feature the plan
 * calls the "#1 quality feature" (WEBSAASPLAN.md §4.1). Each returns a new array
 * so React state updates stay immutable.
 */

let _eid = 0;
const editId = () => `e${(_eid++).toString(36)}${Date.now().toString(36)}`;

/** Replace a cue's text and re-distribute word timings across its span. */
export function updateCueText(cues: Cue[], id: string, text: string): Cue[] {
  return cues.map((c) =>
    c.id === id
      ? { ...c, text, words: splitWords(text, c.start, c.end) }
      : c
  );
}

/** Nudge a cue's start/end (kept within neighbouring cues), re-timing words. */
export function updateCueTiming(
  cues: Cue[],
  id: string,
  start: number,
  end: number
): Cue[] {
  return cues.map((c) =>
    c.id === id
      ? {
          ...c,
          start,
          end: Math.max(start + 0.05, end),
          words: splitWords(c.text, start, Math.max(start + 0.05, end)),
        }
      : c
  );
}

/** Delete a cue. */
export function deleteCue(cues: Cue[], id: string): Cue[] {
  return cues.filter((c) => c.id !== id);
}

/** Merge a cue into the one after it (text joined, span unioned). */
export function mergeWithNext(cues: Cue[], id: string): Cue[] {
  const i = cues.findIndex((c) => c.id === id);
  if (i < 0 || i >= cues.length - 1) return cues;
  const a = cues[i];
  const b = cues[i + 1];
  const text = `${a.text} ${b.text}`.trim();
  const merged: Cue = {
    id: a.id,
    start: a.start,
    end: b.end,
    text,
    words: splitWords(text, a.start, b.end),
  };
  return [...cues.slice(0, i), merged, ...cues.slice(i + 2)];
}

/**
 * Split a cue into two. `at` is the word index to break at (defaults to the
 * middle). The split time is taken from the boundary word so timing stays sane.
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
  const splitTime = right[0].start;

  const leftText = left.map((w) => w.text).join(" ");
  const rightText = right.map((w) => w.text).join(" ");

  const a: Cue = {
    id: editId(),
    start: c.start,
    end: splitTime,
    text: leftText,
    words: splitWords(leftText, c.start, splitTime),
  };
  const b: Cue = {
    id: editId(),
    start: splitTime,
    end: c.end,
    text: rightText,
    words: splitWords(rightText, splitTime, c.end),
  };
  return [...cues.slice(0, i), a, b, ...cues.slice(i + 1)];
}

/** mm:ss.t for compact display in the transcript list. */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const t = Math.floor((s - Math.floor(s)) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${t}`;
}

import type { Cue, Word } from "@/engine";

/**
 * Dead-air / silence detection from the transcript's word timings — pure and
 * deterministic (no audio decode needed). Produces cut ranges (silent gaps to
 * remove) and the complementary keep-segments the exporter plays back to output
 * a tightened video, with a src→out time map so nothing desyncs.
 *
 * Word gaps are semantically safe (never cut mid-word); leaving `padSec` on each
 * side keeps speech onsets/tails intact and avoids choppy joins.
 */

export interface Range {
  start: number;
  end: number;
}

export interface SilencePlan {
  cuts: Range[]; // silent ranges removed
  segments: Range[]; // kept ranges, in order
  removedSec: number;
  outDurationSec: number;
}

export interface SilenceOptions {
  /** minimum gap (s) to treat as dead air */
  minGapSec?: number;
  /** padding (s) left around speech on each side of a cut */
  padSec?: number;
  /** also trim leading/trailing silence */
  trimEnds?: boolean;
}

function flatWords(cues: Cue[]): Word[] {
  const all: Word[] = [];
  for (const c of cues) for (const w of c.words) all.push(w);
  all.sort((a, b) => a.start - b.start);
  return all;
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 0.001) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

/** Detect silent gaps (cut ranges) from word timings. */
export function detectSilences(
  cues: Cue[],
  durationSec: number,
  opts: SilenceOptions = {}
): Range[] {
  const minGap = opts.minGapSec ?? 0.6;
  const pad = opts.padSec ?? 0.1;
  const words = flatWords(cues);
  if (!words.length) return [];
  const cuts: Range[] = [];

  if (opts.trimEnds && words[0].start > minGap) {
    cuts.push({ start: 0, end: words[0].start - pad });
  }
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= minGap) {
      const s = words[i - 1].end + pad;
      const e = words[i].start - pad;
      if (e - s > 0.02) cuts.push({ start: s, end: e });
    }
  }
  if (opts.trimEnds) {
    const lastEnd = words[words.length - 1].end;
    if (durationSec - lastEnd > minGap) cuts.push({ start: lastEnd + pad, end: durationSec });
  }
  return mergeRanges(cuts);
}

/** Invert cut ranges into the ordered keep-segments, with removal totals. */
export function planFromCuts(cuts: Range[], durationSec: number): SilencePlan {
  const merged = mergeRanges(cuts);
  const segments: Range[] = [];
  let t = 0;
  for (const c of merged) {
    if (c.start > t) segments.push({ start: t, end: Math.min(c.start, durationSec) });
    t = Math.max(t, c.end);
  }
  if (t < durationSec) segments.push({ start: t, end: durationSec });
  const kept = segments.filter((s) => s.end - s.start > 0.02);
  const outDurationSec = kept.reduce((a, s) => a + (s.end - s.start), 0);
  return {
    cuts: merged,
    segments: kept,
    removedSec: Math.max(0, durationSec - outDurationSec),
    outDurationSec,
  };
}

/** Convenience: detect + plan in one call. */
export function planSilenceCut(
  cues: Cue[],
  durationSec: number,
  opts: SilenceOptions = {}
): SilencePlan {
  return planFromCuts(detectSilences(cues, durationSec, opts), durationSec);
}

/** Map an original (source) time to output time given the keep-segments. */
export function srcToOut(segments: Range[], srcT: number): number {
  let out = 0;
  for (const s of segments) {
    if (srcT < s.start) return out;
    if (srcT <= s.end) return out + (srcT - s.start);
    out += s.end - s.start;
  }
  return out;
}

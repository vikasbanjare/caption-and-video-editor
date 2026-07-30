import type { Cue, Transcript, Word } from "./types";
import { hasIndicScript, toLatin } from "./romanize";

/**
 * The caption "brain": SRT parse/serialize, word-by-word splitting, regrouping
 * into N-word cues, animation-frame lookup, and keyword highlighting
 * (WEBSAASPLAN.md §1). Pure functions, no DOM — runs in the browser and on the
 * server unchanged.
 */

let _id = 0;
const nextId = () => `cue_${(_id++).toString(36)}_${Date.now().toString(36)}`;

// ---------------------------------------------------------------------------
// SRT timecodes
// ---------------------------------------------------------------------------

/** "00:01:02,500" -> 62.5 (seconds). Accepts "." or "," as the ms separator. */
export function parseTimecode(tc: string): number {
  const m = tc.trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!m) return 0;
  const [, h, mm, ss, ms] = m;
  return (
    Number(h) * 3600 +
    Number(mm) * 60 +
    Number(ss) +
    Number(ms.padEnd(3, "0")) / 1000
  );
}

/** 62.5 -> "00:01:02,500". */
export function formatTimecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(ms, 3)}`;
}

// ---------------------------------------------------------------------------
// Parse / serialize
// ---------------------------------------------------------------------------

/** Parse an SRT string into cues (with words evenly distributed across each cue). */
export function parseSRT(srt: string): Cue[] {
  const cues: Cue[] = [];
  // Normalize newlines and split into blocks on blank lines.
  const blocks = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    // Optional numeric index line.
    let idx = 0;
    if (/^\d+$/.test(lines[0].trim())) idx = 1;

    const timeLine = lines[idx];
    if (!timeLine || !timeLine.includes("-->")) continue;
    const [startTc, endTc] = timeLine.split("-->");
    const start = parseTimecode(startTc);
    const end = parseTimecode(endTc);

    const text = lines.slice(idx + 1).join(" ").trim();
    if (!text) continue;

    cues.push(makeCue(start, end, text));
  }

  return cues;
}

/** Serialize cues back into a standard SRT string. */
export function serializeSRT(cues: Cue[]): string {
  return (
    cues
      .map((c, i) => {
        return `${i + 1}\n${formatTimecode(c.start)} --> ${formatTimecode(
          c.end
        )}\n${c.text}`;
      })
      .join("\n\n") + "\n"
  );
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** Build a cue from a span of text, distributing word timings evenly. */
export function makeCue(start: number, end: number, text: string): Cue {
  const clean = text.trim();
  return {
    id: nextId(),
    start,
    end,
    text: clean,
    words: splitWords(clean, start, end),
  };
}

/**
 * Split text into timed words. With no per-word timing available (plain SRT),
 * the cue's duration is distributed across the words weighted by length, which
 * approximates natural speech well enough for karaoke preview. WhisperX word
 * timestamps replace this later (§4.3).
 */
export function splitWords(text: string, start: number, end: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const weights = tokens.map((t) => Math.max(1, t.replace(/\W/g, "").length));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(0.001, end - start);

  const words: Word[] = [];
  let cursor = start;
  for (let i = 0; i < tokens.length; i++) {
    const dur = (weights[i] / total) * span;
    const wStart = cursor;
    const wEnd = i === tokens.length - 1 ? end : cursor + dur;
    words.push({ text: tokens[i], start: wStart, end: wEnd });
    cursor = wEnd;
  }
  return words;
}

// ---------------------------------------------------------------------------
// Regrouping
// ---------------------------------------------------------------------------

/**
 * Flatten all words and regroup them into cues of at most `wordsPerCue` words.
 * This is the knob that turns long subtitle lines into the punchy 3–4 word
 * captions short-form creators want.
 */
export interface RegroupOptions {
  /** break the cue after sentence-ending punctuation (. ! ? …) */
  sentenceBreak?: boolean;
  /** break the cue when the pause to the next word exceeds this (seconds) */
  maxGapSec?: number;
  /** break before a word that would push the cue past this many characters */
  maxChars?: number;
}

/**
 * ASR word hygiene (Pulse tech brief §4): never drop a word; force strictly
 * increasing starts with a minimum visible window so zero/negative-length or
 * out-of-order timestamps can't break karaoke or the timeline.
 */
export function sanitizeWords(words: Word[], minDur = 0.05): Word[] {
  const out: Word[] = [];
  let cursor = 0;
  for (const w of words) {
    if (!w || !String(w.text || "").trim()) continue;
    let start = Number.isFinite(w.start) ? Math.max(w.start, cursor) : cursor;
    let end = Number.isFinite(w.end) ? w.end : start + minDur;
    if (end < start + minDur) end = start + minDur;
    out.push({ ...w, text: String(w.text).trim(), start, end });
    cursor = start + 0.001; // strictly increasing starts
  }
  return out;
}

const SENTENCE_END = /[.!?…।۔]["')\]]?$/;

export function regroupCues(
  cues: Cue[],
  wordsPerCue: number,
  opts: RegroupOptions = {}
): Cue[] {
  const n = Math.max(1, Math.floor(wordsPerCue));
  const words = cues.flatMap((c) => c.words);
  if (words.length === 0) return [];

  const out: Cue[] = [];
  let group: Word[] = [];
  let chars = 0;

  const flush = () => {
    if (!group.length) return;
    out.push({
      id: nextId(),
      start: group[0].start,
      end: group[group.length - 1].end,
      text: group.map((w) => w.text).join(" "),
      words: group,
    });
    group = [];
    chars = 0;
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // width break BEFORE adding (brief: cap width so text can't overflow the box)
    if (
      opts.maxChars &&
      group.length > 0 &&
      chars + 1 + w.text.length > opts.maxChars
    ) {
      flush();
    }
    group.push(w);
    chars += (chars ? 1 : 0) + w.text.length;

    const next = words[i + 1];
    const full = group.length >= n;
    const sentence = !!opts.sentenceBreak && SENTENCE_END.test(w.text);
    const pause =
      !!opts.maxGapSec && next !== undefined && next.start - w.end >= opts.maxGapSec;
    if (full || sentence || pause || next === undefined) flush();
  }
  return out;
}

/**
 * Hold each caption into a short following pause so captions don't blink
 * between close cues; long silences still clear (after `holdSec`).
 * (Pulse tech brief §4 · fillFrameGaps.)
 */
export function holdCueGaps(cues: Cue[], holdSec = 0.4): Cue[] {
  return cues.map((c, i) => {
    const next = cues[i + 1];
    if (!next) return c;
    const gap = next.start - c.end;
    if (gap <= 0.01) return c;
    return { ...c, end: Math.min(next.start, c.end + Math.min(gap, holdSec)) };
  });
}

// ---------------------------------------------------------------------------
// Playback lookup (animation frame timing)
// ---------------------------------------------------------------------------

/** Index of the cue active at time `t` (seconds), or -1 if none. */
export function activeCueIndex(cues: Cue[], t: number): number {
  // Linear scan is fine for the cue counts we deal with; could binary-search.
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i].start && t < cues[i].end) return i;
  }
  return -1;
}

/** The cue active at time `t`, or null. */
export function activeCueAt(cues: Cue[], t: number): Cue | null {
  const i = activeCueIndex(cues, t);
  return i === -1 ? null : cues[i];
}

// ---------------------------------------------------------------------------
// Keyword highlighting
// ---------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Mark words as highlighted. If `keywords` is given, those words are flagged;
 * otherwise an automatic heuristic highlights the longest, most "content-y"
 * word of each cue — a cheap stand-in for the emoji/keyword auto-highlight in
 * §6 until a smarter pass lands.
 */
export function applyKeywordHighlight(cues: Cue[], keywords?: string[]): Cue[] {
  const set = keywords ? new Set(keywords.map(norm).filter(Boolean)) : null;

  return cues.map((c) => {
    let autoIdx = -1;
    if (!set) {
      let best = 2; // require >2 letters to bother
      c.words.forEach((w, i) => {
        const len = norm(w.text).length;
        if (len > best) {
          best = len;
          autoIdx = i;
        }
      });
    }
    return {
      ...c,
      words: c.words.map((w, i) => ({
        ...w,
        highlight: set ? set.has(norm(w.text)) : i === autoIdx,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Hinglish
// ---------------------------------------------------------------------------

/** Romanize any Devanagari in a transcript's cue/word text (Hinglish). */
export function romanizeTranscript(transcript: Transcript): Transcript {
  const cues = transcript.cues.map((c) => {
    if (!hasIndicScript(c.text)) return c;
    return {
      ...c,
      text: toLatin(c.text),
      words: c.words.map((w) =>
        hasIndicScript(w.text) ? { ...w, text: toLatin(w.text) } : w
      ),
    };
  });
  return { ...transcript, cues };
}

/** Total transcript duration (end of the last cue), in seconds. */
export function transcriptDuration(cues: Cue[]): number {
  return cues.length ? cues[cues.length - 1].end : 0;
}

/**
 * Wrap a flat, word-timed list (e.g. from an ASR provider in Phase 2) into a
 * single cue. The real per-word timestamps are preserved; callers then run
 * {@link regroupCues} to chunk them into the user's wordsPerCue, so karaoke
 * sync is driven by true word timings rather than the even split used for SRT.
 */
export function cuesFromWords(words: Word[]): Cue[] {
  if (words.length === 0) return [];
  return [
    {
      id: nextId(),
      start: words[0].start,
      end: words[words.length - 1].end,
      text: words.map((w) => w.text).join(" "),
      words,
    },
  ];
}

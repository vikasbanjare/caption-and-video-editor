import type { Cue, Word } from "@/engine";

/**
 * Client-side, pure-math creator analytics — deterministic and explainable
 * (every number traces to a formula), unlike the black-box "virality" scores
 * of Opus Clip / Submagic. Computed from the transcript (+ optional waveform
 * peaks) with no model and no server.
 */

const FILLERS = new Set([
  "um", "umm", "uh", "uhh", "uhm", "er", "erm", "ah", "hmm", "mmm", "eh",
  "like", "so", "actually", "basically", "literally", "kinda", "right",
]);
const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "is",
  "are", "was", "were", "be", "been", "it", "its", "this", "that", "these",
  "those", "i", "you", "we", "they", "he", "she", "them", "my", "your", "our",
  "me", "us", "at", "by", "with", "as", "from", "if", "then", "than", "so",
  "just", "do", "does", "did", "have", "has", "had", "will", "would", "can",
  "could", "not", "no", "yes", "up", "out", "about", "get", "got", "go",
]);
// tiny AFINN-style sentiment lexicon (−3..+3)
const SENT: Record<string, number> = {
  amazing: 3, awesome: 3, incredible: 3, love: 3, best: 3, perfect: 3,
  great: 2, good: 2, happy: 2, win: 2, easy: 2, free: 2, fast: 2, powerful: 2,
  nice: 1, cool: 1, better: 1, new: 1, growth: 1, secret: 1, boost: 1,
  bad: -2, hate: -2, worst: -2, hard: -1, slow: -1, fail: -2, wrong: -2,
  boring: -2, difficult: -2, problem: -1, never: -1, cant: -1, dont: -1,
};

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const clamp = (n: number, lo: number, hi: number) => (n < lo ? lo : n > hi ? hi : n);

export interface Pacepoint {
  t: number;
  wpm: number;
}
export interface Analytics {
  words: number;
  durationSec: number;
  wpm: number;
  paceSeries: Pacepoint[];
  deadAirRatio: number;
  longestGapSec: number;
  gapCount: number;
  fillerCount: number;
  fillerDensity: number; // per 100 words
  readabilityOver: number; // fraction of cues over the CPS ceiling
  avgCps: number;
  hook: number; // 0..100
  energyDynamics: number; // 0..100
  sentimentSeries: number[];
  keywords: { word: string; count: number }[];
  clarity: number; // 0..100 composite
}

const CPS_CEILING = 17; // Netflix adult reading speed

function flatWords(cues: Cue[]): Word[] {
  const all: Word[] = [];
  for (const c of cues) for (const w of c.words) all.push(w);
  all.sort((a, b) => a.start - b.start);
  return all;
}

export function computeAnalytics(
  cues: Cue[],
  durationSec: number,
  peaks?: number[] | Float32Array | null
): Analytics {
  const words = flatWords(cues);
  const n = words.length;
  const dur = durationSec > 0 ? durationSec : words.length ? words[words.length - 1].end : 1;

  // --- pace ---
  const wpm = n ? n / (dur / 60) : 0;
  const paceSeries: Pacepoint[] = [];
  const win = 10, hop = 2;
  for (let t = 0; t + 0.01 < Math.max(win, dur); t += hop) {
    const a = t, b = Math.min(dur, t + win);
    const c = words.filter((w) => w.start >= a && w.start < b).length;
    paceSeries.push({ t, wpm: c / ((b - a) / 60) });
    if (b >= dur) break;
  }

  // --- dead air (inter-word gaps) ---
  let gapSum = 0, longestGap = 0, gapCount = 0;
  for (let i = 1; i < n; i++) {
    const g = words[i].start - words[i - 1].end;
    if (g > 0.5) {
      gapSum += g;
      gapCount++;
      if (g > longestGap) longestGap = g;
    }
  }
  const deadAirRatio = dur ? clamp(gapSum / dur, 0, 1) : 0;

  // --- filler density ---
  let fillerCount = 0;
  for (const w of words) if (FILLERS.has(norm(w.text))) fillerCount++;
  const fillerDensity = n ? (fillerCount / n) * 100 : 0;

  // --- caption readability ---
  let over = 0, cpsSum = 0, cueN = 0;
  for (const c of cues) {
    const d = Math.max(0.2, c.end - c.start);
    const cps = (c.text || "").replace(/\s/g, "").length / d;
    cpsSum += cps;
    cueN++;
    if (cps > CPS_CEILING) over++;
  }
  const readabilityOver = cueN ? over / cueN : 0;
  const avgCps = cueN ? cpsSum / cueN : 0;

  // --- hook (first 3s) ---
  const ttfw = n ? words[0].start : 3;
  const first3 = words.filter((w) => w.start < 3).length;
  const firstText = words.slice(0, 12).map((w) => w.text).join(" ").toLowerCase();
  const opener = /\?|how |why |what |stop|nobody|secret|never|the one|watch|listen/.test(firstText) ? 1 : 0;
  const firstSent = firstText.split(/\s+/).reduce((a, w) => a + Math.abs(SENT[norm(w)] || 0), 0);
  const speechDensity = clamp(first3 / 9, 0, 1); // ~9 words in 3s = dense
  const hook = clamp(
    (0.35 * speechDensity + 0.25 * (1 - clamp(ttfw, 0, 1)) + 0.25 * opener + 0.15 * clamp(firstSent / 3, 0, 1)) * 100,
    0, 100
  );

  // --- energy dynamics (waveform variation) ---
  let energyDynamics = 50;
  if (peaks && peaks.length > 4) {
    const arr = Array.from(peaks);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const sd = Math.sqrt(arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / arr.length);
    energyDynamics = clamp((sd / (mean || 1)) * 120, 0, 100);
  }

  // --- sentiment arc (per ~sentence group of 8 words) ---
  const sentimentSeries: number[] = [];
  for (let i = 0; i < n; i += 8) {
    let s = 0;
    for (let j = i; j < Math.min(n, i + 8); j++) s += SENT[norm(words[j].text)] || 0;
    sentimentSeries.push(clamp(s, -5, 5));
  }

  // --- keywords ---
  const freq: Record<string, number> = {};
  for (const w of words) {
    const k = norm(w.text);
    if (k.length < 3 || STOP.has(k) || FILLERS.has(k)) continue;
    freq[k] = (freq[k] || 0) + 1;
  }
  const keywords = Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // --- clarity composite (0..100) ---
  const paceInRange = clamp(
    (paceSeries.filter((p) => p.wpm >= 120 && p.wpm <= 165).length / Math.max(1, paceSeries.length)) * 100,
    0, 100
  );
  const readScore = 100 * (1 - readabilityOver);
  const deadScore = 100 * (1 - Math.min(deadAirRatio / 0.3, 1));
  const fillerScore = 100 * (1 - Math.min(fillerDensity / 5, 1));
  const clarity = Math.round(
    0.25 * hook + 0.2 * paceInRange + 0.2 * readScore + 0.15 * deadScore + 0.1 * fillerScore + 0.1 * energyDynamics
  );

  return {
    words: n, durationSec: dur, wpm,
    paceSeries, deadAirRatio, longestGapSec: longestGap, gapCount,
    fillerCount, fillerDensity, readabilityOver, avgCps,
    hook, energyDynamics, sentimentSeries, keywords,
    clarity: clamp(clarity, 0, 100),
  };
}

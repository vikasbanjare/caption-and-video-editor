import { describe, it, expect } from "vitest";
import type { Cue, Word } from "../types";
import {
  sanitizeWords,
  regroupCues,
  holdCueGaps,
  cuesFromWords,
} from "../captions";

const W = (text: string, start: number, end: number): Word => ({ text, start, end });
const wrap = (words: Word[]): Cue[] => cuesFromWords(words);

describe("sanitizeWords (brief §4: never drop, strictly increasing)", () => {
  it("keeps every word and forces increasing starts + a minimum window", () => {
    const out = sanitizeWords([
      W("one", 0, 0.5),
      W("two", 0.4, 0.4), // overlapping start, zero length
      W("three", 0.2, 0.3), // out of order
    ]);
    expect(out).toHaveLength(3);
    expect(out[1].start).toBeGreaterThanOrEqual(out[0].start);
    expect(out[2].start).toBeGreaterThan(out[1].start);
    for (const w of out) expect(w.end - w.start).toBeGreaterThanOrEqual(0.05 - 1e-9);
  });

  it("drops only empty text, never real words", () => {
    const out = sanitizeWords([W("  ", 0, 1), W("hi", 1, 2)]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("hi");
  });
});

describe("regroupCues options (brief §4)", () => {
  const words = [
    W("This", 0, 0.3), W("works.", 0.3, 0.6),
    W("Next", 0.7, 1.0), W("thought", 1.0, 1.3),
  ];

  it("breaks at sentence-ending punctuation", () => {
    const out = regroupCues(wrap(words), 8, { sentenceBreak: true });
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("This works.");
  });

  it("breaks at long pauses", () => {
    const paused = [W("one", 0, 0.3), W("two", 2.0, 2.3), W("three", 2.3, 2.6)];
    const out = regroupCues(wrap(paused), 8, { maxGapSec: 0.8 });
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("one");
  });

  it("caps cue width in characters", () => {
    const long = [W("aaaaaaaaaa", 0, 1), W("bbbbbbbbbb", 1, 2), W("cc", 2, 3)];
    const out = regroupCues(wrap(long), 8, { maxChars: 15 });
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) expect(c.text.length).toBeLessThanOrEqual(15);
  });

  it("default behaviour (no opts) is unchanged fixed-count grouping", () => {
    const out = regroupCues(wrap(words), 2);
    expect(out).toHaveLength(2);
    expect(out[0].words).toHaveLength(2);
  });
});

describe("holdCueGaps (brief §4: no blinking, clear on long silence)", () => {
  it("extends into short pauses but not past the next cue", () => {
    const cues = wrap([W("a", 0, 1)]).concat(wrap([W("b", 1.2, 2)]));
    const out = holdCueGaps(cues, 0.4);
    expect(out[0].end).toBeCloseTo(1.2); // gap 0.2 < hold → meets next cue
  });

  it("holds only `holdSec` into a long silence", () => {
    const cues = wrap([W("a", 0, 1)]).concat(wrap([W("b", 5, 6)]));
    const out = holdCueGaps(cues, 0.4);
    expect(out[0].end).toBeCloseTo(1.4); // clears well before the next cue
    expect(out[1].end).toBeCloseTo(6); // last cue untouched
  });
});

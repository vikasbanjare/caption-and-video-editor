import { describe, it, expect } from "vitest";
import type { Cue } from "@/engine";
import {
  retimeCue,
  splitCue,
  splitCueAtTime,
  mergeWithNext,
  insertCueAt,
  deleteCue,
  MIN_CUE,
} from "../transcript";
import { computePeaks } from "../waveform";

function cue(id: string, start: number, end: number, words: [string, number, number][]): Cue {
  return {
    id,
    start,
    end,
    text: words.map(([t]) => t).join(" "),
    words: words.map(([text, s, e]) => ({ text, start: s, end: e })),
  };
}

describe("retimeCue", () => {
  it("scales word timings proportionally into the new window", () => {
    const cues = [cue("a", 0, 2, [["hey", 0, 1], ["you", 1, 2]])];
    const out = retimeCue(cues, "a", 4, 8);
    expect(out[0].start).toBe(4);
    expect(out[0].end).toBe(8);
    expect(out[0].words[0]).toMatchObject({ start: 4, end: 6 });
    expect(out[0].words[1]).toMatchObject({ start: 6, end: 8 });
  });

  it("enforces minimum duration and non-negative start", () => {
    const cues = [cue("a", 0, 2, [["x", 0, 2]])];
    const out = retimeCue(cues, "a", -1, -0.5);
    expect(out[0].start).toBe(0);
    expect(out[0].end).toBeCloseTo(MIN_CUE);
  });
});

describe("splitCue / splitCueAtTime", () => {
  const base = () =>
    [cue("a", 0, 3, [["one", 0, 1], ["two", 1, 2], ["three", 2, 3]])];

  it("splits preserving original word timings", () => {
    const out = splitCue(base(), "a", 1);
    expect(out).toHaveLength(2);
    expect(out[0].end).toBeCloseTo(1);
    expect(out[1].start).toBeCloseTo(1);
    // word objects keep their real times, no even re-split
    expect(out[1].words[0]).toMatchObject({ text: "two", start: 1, end: 2 });
  });

  it("splitCueAtTime picks the word boundary nearest the playhead", () => {
    const out = splitCueAtTime(base(), 2.1);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("one two");
    expect(out[1].text).toBe("three");
    expect(out[1].start).toBeCloseTo(2);
  });

  it("no-ops outside any cue or on single-word cues", () => {
    expect(splitCueAtTime(base(), 5)).toHaveLength(1);
    const single = [cue("s", 0, 1, [["hi", 0, 1]])];
    expect(splitCueAtTime(single, 0.5)).toBe(single);
  });
});

describe("mergeWithNext", () => {
  it("concatenates word objects without re-timing them", () => {
    const cues = [
      cue("a", 0, 1, [["one", 0, 1]]),
      cue("b", 2, 3, [["two", 2, 3]]),
    ];
    const out = mergeWithNext(cues, "a");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: 0, end: 3, text: "one two" });
    expect(out[0].words[1]).toMatchObject({ start: 2, end: 3 });
  });
});

describe("insertCueAt", () => {
  const cues = () => [
    cue("a", 0, 1, [["one", 0, 1]]),
    cue("b", 3, 4, [["two", 3, 4]]),
  ];

  it("inserts into a gap, clamped to the next cue", () => {
    const out = insertCueAt(cues(), 2, "hello there");
    expect(out).toHaveLength(3);
    expect(out[1].start).toBeCloseTo(2);
    expect(out[1].end).toBeCloseTo(3); // clamped to next.start
    expect(out[1].text).toBe("hello there");
  });

  it("refuses to insert inside an existing cue or a too-small gap", () => {
    expect(insertCueAt(cues(), 0.5)).toHaveLength(2);
    const tight = [cue("a", 0, 1, [["x", 0, 1]]), cue("b", 1.05, 2, [["y", 1.05, 2]])];
    expect(insertCueAt(tight, 1.01)).toHaveLength(2);
  });

  it("appends after the last cue", () => {
    const out = insertCueAt(cues(), 10);
    expect(out).toHaveLength(3);
    expect(out[2].start).toBeCloseTo(10);
    expect(out[2].end).toBeCloseTo(11.5);
  });
});

describe("deleteCue", () => {
  it("removes by id", () => {
    expect(deleteCue([cue("a", 0, 1, [["x", 0, 1]])], "a")).toHaveLength(0);
  });

  it("returns the same array when the id is absent (no phantom undo step)", () => {
    const cues = [cue("a", 0, 1, [["x", 0, 1]])];
    expect(deleteCue(cues, "missing")).toBe(cues);
  });
});

describe("computePeaks", () => {
  it("buckets by max amplitude and normalizes", () => {
    const peaks = computePeaks(new Float32Array([0, 0.8, 0, -0.4]), 2);
    expect(peaks).toHaveLength(2);
    expect(peaks[0]).toBeCloseTo(1); // 0.8 normalized
    expect(peaks[1]).toBeCloseTo(0.5); // 0.4 normalized
  });

  it("handles silence without dividing by ~zero", () => {
    // near-silence must NOT be normalized up to full scale
    const peaks = computePeaks(new Float32Array([0, 0.001, 0]), 3);
    expect(Array.from(peaks).every((p) => p < 0.01)).toBe(true);
  });
});

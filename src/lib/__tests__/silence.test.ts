import { describe, it, expect } from "vitest";
import type { Cue } from "@/engine";
import { detectSilences, planFromCuts, planSilenceCut, srcToOut } from "../silence";

const cue = (id: string, words: [string, number, number][]): Cue => ({
  id,
  start: words[0][1],
  end: words[words.length - 1][2],
  text: words.map((w) => w[0]).join(" "),
  words: words.map(([text, start, end]) => ({ text, start, end })),
});

describe("silence detection", () => {
  it("finds gaps longer than the threshold, padded", () => {
    // words end at 1.0, next starts at 3.0 → a 2s gap
    const cues = [
      cue("a", [["hello", 0, 0.5], ["there", 0.5, 1.0]]),
      cue("b", [["world", 3.0, 3.5]]),
    ];
    const cuts = detectSilences(cues, 4, { minGapSec: 0.6, padSec: 0.1 });
    expect(cuts).toHaveLength(1);
    expect(cuts[0].start).toBeCloseTo(1.1); // 1.0 + pad
    expect(cuts[0].end).toBeCloseTo(2.9); // 3.0 - pad
  });

  it("ignores short pauses", () => {
    const cues = [cue("a", [["a", 0, 0.5], ["b", 0.8, 1.2]])]; // 0.3s gap
    expect(detectSilences(cues, 1.2, { minGapSec: 0.6 })).toHaveLength(0);
  });

  it("plans keep-segments and removal totals", () => {
    const cuts = [{ start: 1, end: 3 }]; // remove 2s of a 5s clip
    const plan = planFromCuts(cuts, 5);
    expect(plan.segments).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 5 },
    ]);
    expect(plan.removedSec).toBeCloseTo(2);
    expect(plan.outDurationSec).toBeCloseTo(3);
  });

  it("maps source time to output time across cuts", () => {
    const { segments } = planFromCuts([{ start: 1, end: 3 }], 5);
    expect(srcToOut(segments, 0.5)).toBeCloseTo(0.5); // before the cut
    expect(srcToOut(segments, 4)).toBeCloseTo(2); // after: 1s kept + (4-3)=1 → 2
  });

  it("end-to-end plan removes the gap", () => {
    const cues = [
      cue("a", [["one", 0, 0.5]]),
      cue("b", [["two", 5, 5.5]]), // 4.5s gap
    ];
    const plan = planSilenceCut(cues, 6, { minGapSec: 0.6, padSec: 0.1 });
    expect(plan.removedSec).toBeGreaterThan(4);
    expect(plan.outDurationSec).toBeLessThan(2);
  });
});

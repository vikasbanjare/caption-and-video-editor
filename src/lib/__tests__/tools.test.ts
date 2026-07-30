import { describe, it, expect } from "vitest";
import type { Cue } from "@/engine";
import {
  removeFillerWords,
  generateChapters,
  formatTimestamp,
  chaptersToText,
} from "../tools";

function cue(id: string, start: number, end: number, words: string[]): Cue {
  const per = (end - start) / Math.max(1, words.length);
  return {
    id,
    start,
    end,
    text: words.join(" "),
    words: words.map((text, i) => ({
      text,
      start: start + i * per,
      end: start + (i + 1) * per,
    })),
  };
}

describe("removeFillerWords", () => {
  it("drops fillers and immediate stutters", () => {
    const cues = [cue("a", 0, 4, ["um", "the", "the", "big", "uh", "idea"])];
    const { cues: out, removed } = removeFillerWords(cues);
    expect(out[0].text).toBe("the big idea");
    expect(removed).toBe(3); // um, duplicate the, uh
  });

  it("drops a cue that becomes empty", () => {
    const cues = [cue("a", 0, 1, ["um", "uh"]), cue("b", 1, 2, ["real", "words"])];
    const { cues: out } = removeFillerWords(cues);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("real words");
  });

  it("keeps normal speech untouched", () => {
    const cues = [cue("a", 0, 2, ["hello", "there", "world"])];
    expect(removeFillerWords(cues).removed).toBe(0);
  });
});

describe("chapters", () => {
  it("starts at 0 and adds a chapter after a long gap", () => {
    const cues = [
      cue("a", 0, 3, ["intro", "to", "the", "topic"]),
      cue("b", 3.2, 6, ["still", "the", "intro"]),
      cue("c", 20, 24, ["a", "brand", "new", "section"]), // 14s gap
    ];
    const ch = generateChapters(cues);
    expect(ch).toHaveLength(2);
    expect(ch[0].start).toBe(0);
    expect(ch[1].start).toBeCloseTo(20);
    expect(ch[1].title.toLowerCase()).toContain("brand");
  });

  it("respects minimum spacing between chapters", () => {
    const cues = [
      cue("a", 0, 2, ["one"]),
      cue("b", 5, 7, ["two"]), // 3s gap but only 5s in → no new chapter
    ];
    expect(generateChapters(cues, 2.5, 12)).toHaveLength(1);
  });

  it("formats timestamps and a description block", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(83)).toBe("1:23");
    expect(formatTimestamp(3723)).toBe("1:02:03");
    expect(chaptersToText([{ start: 0, title: "Intro" }])).toBe("0:00 Intro");
  });
});

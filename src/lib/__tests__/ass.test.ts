import { describe, it, expect } from "vitest";
import type { Cue } from "@/engine";
import { styleFromPreset } from "@/engine";
import { assTime, assColor, buildAss } from "../ass";

const cue = (id: string, start: number, end: number, words: string[]): Cue => {
  const per = (end - start) / Math.max(1, words.length);
  return {
    id,
    start,
    end,
    text: words.join(" "),
    words: words.map((text, i) => ({ text, start: start + i * per, end: start + (i + 1) * per })),
  };
};

describe("ass export", () => {
  it("formats ASS timecodes in centiseconds", () => {
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(83.5)).toBe("0:01:23.50");
    expect(assTime(3661.23)).toBe("1:01:01.23");
  });

  it("converts hex/rgb to ASS BGR", () => {
    expect(assColor("#FFD400")).toBe("&H00D4FF&"); // R=FF G=D4 B=00 → BGR 00 D4 FF
    expect(assColor("#000000")).toBe("&H000000&");
    expect(assColor("rgb(255, 59, 107)")).toBe("&H6B3BFF&");
  });

  it("builds a complete styled ASS document with per-word highlight", () => {
    const style = styleFromPreset("hormozi");
    const out = buildAss([cue("a", 0, 1.5, ["make", "it", "pop"])], style, { width: 1080, height: 1920 });
    expect(out).toContain("[Script Info]");
    expect(out).toContain("PlayResX: 1080");
    expect(out).toContain("[V4+ Styles]");
    expect(out).toContain("Style: Pulse,");
    // one Dialogue per word (3 words → 3 events)
    const dialogues = out.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(dialogues).toHaveLength(3);
    // active word gets a colour override
    expect(dialogues[0]).toContain("{\\1c");
  });

  it("emits reveal mode (words appear as spoken) for word-by-word styles", () => {
    const style = {
      ...styleFromPreset("hormozi"),
      animation: "word-by-word" as const,
      uppercase: false,
      textTransform: "none" as const,
    };
    const out = buildAss([cue("a", 0, 1.5, ["one", "two", "three"])], style);
    const d = out.split("\n").filter((l) => l.startsWith("Dialogue:"));
    // first event reveals only the first word; the third reveals all three
    expect(d[0]).toContain("one");
    expect(d[0]).not.toContain("three");
    expect(d[2]).toContain("three");
  });
});

import { describe, it, expect } from "vitest";
import {
  parseSRT,
  serializeSRT,
  parseTimecode,
  formatTimecode,
  regroupCues,
  activeCueIndex,
  applyKeywordHighlight,
  splitWords,
} from "../captions";
import { devanagariToLatin, hasDevanagari } from "../romanize";
import { presetById, PRESETS } from "../presets";

const SAMPLE = `1
00:00:00,000 --> 00:00:02,000
Hello there world

2
00:00:02,000 --> 00:00:04,500
this is a quick test
`;

describe("timecodes", () => {
  it("parses and formats round-trip", () => {
    expect(parseTimecode("00:01:02,500")).toBeCloseTo(62.5, 3);
    expect(formatTimecode(62.5)).toBe("00:01:02,500");
  });
  it("accepts a dot ms separator", () => {
    expect(parseTimecode("00:00:01.250")).toBeCloseTo(1.25, 3);
  });
});

describe("parseSRT", () => {
  it("parses cues and timing", () => {
    const cues = parseSRT(SAMPLE);
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe("Hello there world");
    expect(cues[0].start).toBeCloseTo(0);
    expect(cues[1].end).toBeCloseTo(4.5);
  });

  it("distributes word timings within a cue", () => {
    const cues = parseSRT(SAMPLE);
    const w = cues[0].words;
    expect(w).toHaveLength(3);
    expect(w[0].start).toBeCloseTo(0);
    expect(w[w.length - 1].end).toBeCloseTo(2);
    // monotonic, non-overlapping
    for (let i = 1; i < w.length; i++) {
      expect(w[i].start).toBeGreaterThanOrEqual(w[i - 1].start);
    }
  });

  it("round-trips through serializeSRT", () => {
    const cues = parseSRT(SAMPLE);
    const again = parseSRT(serializeSRT(cues));
    expect(again).toHaveLength(2);
    expect(again[0].text).toBe("Hello there world");
    expect(again[1].start).toBeCloseTo(2);
  });
});

describe("regroupCues", () => {
  it("regroups all words into N-word cues", () => {
    const cues = parseSRT(SAMPLE); // 3 + 5 = 8 words
    const out = regroupCues(cues, 3);
    expect(out).toHaveLength(3); // 3,3,2
    expect(out[0].words).toHaveLength(3);
    expect(out[2].words).toHaveLength(2);
    expect(out[0].start).toBeCloseTo(0);
    // continuous timeline preserved
    expect(out[out.length - 1].end).toBeCloseTo(4.5);
  });
});

describe("activeCueIndex", () => {
  it("finds the cue at a given time", () => {
    const cues = parseSRT(SAMPLE);
    expect(activeCueIndex(cues, 1)).toBe(0);
    expect(activeCueIndex(cues, 3)).toBe(1);
    expect(activeCueIndex(cues, 99)).toBe(-1);
  });
});

describe("applyKeywordHighlight", () => {
  it("auto-highlights the longest word per cue", () => {
    const cues = parseSRT(SAMPLE);
    const hi = applyKeywordHighlight(cues);
    expect(hi[0].words.find((w) => w.highlight)?.text).toBe("Hello");
  });
  it("highlights explicit keywords case/punct-insensitively", () => {
    const cues = parseSRT(SAMPLE);
    const hi = applyKeywordHighlight(cues, ["WORLD"]);
    expect(hi[0].words.find((w) => w.text === "world")?.highlight).toBe(true);
    expect(hi[0].words.find((w) => w.text === "Hello")?.highlight).toBe(false);
  });
});

describe("romanize (Hinglish)", () => {
  it("detects Devanagari", () => {
    expect(hasDevanagari("नमस्ते")).toBe(true);
    expect(hasDevanagari("hello")).toBe(false);
  });
  it("romanizes common words", () => {
    expect(devanagariToLatin("नमस्ते")).toBe("namaste");
    expect(devanagariToLatin("भारत")).toBe("bhaarat");
  });
  it("passes Latin/mixed content through", () => {
    expect(devanagariToLatin("ये video मस्त है")).toContain("video");
  });
});

describe("presets", () => {
  it("exposes a catalog and looks up by id", () => {
    expect(PRESETS.length).toBeGreaterThan(0);
    expect(presetById("karaoke").style.animation).toBe("karaoke");
    expect(presetById("does-not-exist").id).toBeDefined(); // falls back
  });
});

describe("splitWords", () => {
  it("returns empty for empty text", () => {
    expect(splitWords("", 0, 1)).toHaveLength(0);
  });
});

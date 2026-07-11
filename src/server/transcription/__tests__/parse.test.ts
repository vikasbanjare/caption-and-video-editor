import { describe, it, expect } from "vitest";
import { parseDeepgramWords, parseAssemblyaiWords } from "../parse";
import { cuesFromWords, regroupCues } from "@/engine";

const deepgramFixture = {
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript: "hey there world",
            words: [
              { word: "hey", punctuated_word: "Hey,", start: 0.1, end: 0.4 },
              { word: "there", punctuated_word: "there", start: 0.4, end: 0.7 },
              { word: "world", punctuated_word: "world.", start: 0.7, end: 1.2 },
            ],
          },
        ],
      },
    ],
  },
};

const assemblyaiFixture = {
  text: "hey there world",
  words: [
    { text: "Hey,", start: 100, end: 400 },
    { text: "there", start: 400, end: 700 },
    { text: "world.", start: 700, end: 1200 },
  ],
};

describe("parseDeepgramWords", () => {
  it("extracts word-level timings and prefers punctuated_word", () => {
    const words = parseDeepgramWords(deepgramFixture);
    expect(words).toHaveLength(3);
    expect(words[0]).toMatchObject({ text: "Hey,", start: 0.1, end: 0.4 });
    expect(words[2].text).toBe("world.");
  });

  it("is safe on malformed input", () => {
    expect(parseDeepgramWords({})).toEqual([]);
    expect(parseDeepgramWords(null)).toEqual([]);
  });

  it("feeds the engine: cues carry real timings through regroup", () => {
    const words = parseDeepgramWords(deepgramFixture);
    const cues = regroupCues(cuesFromWords(words), 2);
    expect(cues).toHaveLength(2); // 2 + 1
    expect(cues[0].start).toBeCloseTo(0.1);
    expect(cues[0].words).toHaveLength(2);
    expect(cues[1].end).toBeCloseTo(1.2);
  });
});

describe("parseAssemblyaiWords", () => {
  it("converts millisecond timings to seconds", () => {
    const words = parseAssemblyaiWords(assemblyaiFixture);
    expect(words).toHaveLength(3);
    expect(words[0]).toMatchObject({ text: "Hey,", start: 0.1, end: 0.4 });
    expect(words[2].end).toBeCloseTo(1.2);
  });

  it("is safe on malformed input", () => {
    expect(parseAssemblyaiWords({})).toEqual([]);
  });
});

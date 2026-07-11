import { describe, it, expect } from "vitest";
import {
  arabicToLatin,
  hasArabic,
  hasIndicScript,
  toLatin,
} from "../romanize";
import { romanizeTranscript } from "../captions";
import type { Cue } from "../types";

describe("Urdu / Arabic-script romanization", () => {
  it("detects Arabic script", () => {
    expect(hasArabic("اگر آپ")).toBe(true);
    expect(hasArabic("hello world")).toBe(false);
    expect(hasIndicScript("ये video")).toBe(true); // Devanagari
    expect(hasIndicScript("ساتھ")).toBe(true); // Urdu
    expect(hasIndicScript("plain english")).toBe(false);
  });

  it("transliterates Urdu to Latin and leaves English untouched", () => {
    // from the real screenshot cues (Hinglish speaker → Whisper emitted Urdu)
    const out = arabicToLatin("سے India اگر آپ");
    expect(out).not.toMatch(/[؀-ۿ]/); // no Arabic chars remain
    expect(out).toContain("India"); // English word preserved
    expect(out.toLowerCase()).toContain("a"); // produced Latin letters
  });

  it("toLatin handles mixed Devanagari + Latin + Urdu", () => {
    expect(toLatin("Amazon USP sell کر")).toContain("Amazon");
    expect(toLatin("Amazon USP sell کر")).not.toMatch(/[؀-ۿ]/);
    expect(toLatin("ये मस्त video")).not.toMatch(/[ऀ-ॿ]/);
  });

  it("romanizeTranscript converts Urdu cues (fixes the RTL caption case)", () => {
    const cues: Cue[] = [
      {
        id: "a",
        start: 0,
        end: 1,
        text: "ساتھ بھو سے پھر",
        words: [
          { text: "ساتھ", start: 0, end: 0.25 },
          { text: "بھو", start: 0.25, end: 0.5 },
          { text: "سے", start: 0.5, end: 0.75 },
          { text: "پھر", start: 0.75, end: 1 },
        ],
      },
    ];
    const out = romanizeTranscript({ cues }).cues;
    expect(out[0].text).not.toMatch(/[؀-ۿ]/);
    for (const w of out[0].words) expect(w.text).not.toMatch(/[؀-ۿ]/);
    // timings preserved
    expect(out[0].words[3].start).toBeCloseTo(0.75);
  });
});

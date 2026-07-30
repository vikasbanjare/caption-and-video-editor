import { describe, it, expect } from "vitest";
import { renderFrame } from "../render";
import { PRESETS, styleFromPreset, DEFAULT_PRESET } from "../presets";
import type { Cue } from "../types";

/**
 * renderFrame is written against the standard CanvasRenderingContext2D API
 * precisely so it can run outside a browser — this suite drives it with a
 * recording mock, proving every one of the shipped presets draws (no preset
 * can silently throw or render nothing) and that sizing follows the
 * min-dimension calibration invariant.
 */

class MockCtx {
  font = "";
  textBaseline = "";
  textAlign = "";
  fillStyle: unknown = "";
  strokeStyle: unknown = "";
  lineWidth = 0;
  lineJoin = "";
  globalAlpha = 1;
  shadowColor = "";
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  filter = "none";

  calls: Record<string, number> = {};
  fonts: string[] = [];
  filledTexts: string[] = [];

  private count(name: string) {
    this.calls[name] = (this.calls[name] || 0) + 1;
  }
  clearRect() { this.count("clearRect"); }
  measureText(text: string) {
    this.count("measureText");
    // width proportional to glyph count is enough for layout logic
    return { width: Math.max(1, text.length) * 10 } as TextMetrics;
  }
  save() { this.count("save"); }
  restore() { this.count("restore"); }
  translate() { this.count("translate"); }
  rotate() { this.count("rotate"); }
  scale() { this.count("scale"); }
  beginPath() { this.count("beginPath"); }
  rect() { this.count("rect"); }
  clip() { this.count("clip"); }
  moveTo() { this.count("moveTo"); }
  lineTo() { this.count("lineTo"); }
  arcTo() { this.count("arcTo"); }
  closePath() { this.count("closePath"); }
  fill() { this.count("fill"); }
  stroke() { this.count("stroke"); }
  fillText(text: string) {
    this.count("fillText");
    this.filledTexts.push(text);
    // capture the font active at draw time
    this.fonts.push(this.font);
  }
  strokeText() { this.count("strokeText"); }
  createLinearGradient() {
    this.count("createLinearGradient");
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
}

const ctxOf = () => new MockCtx() as unknown as CanvasRenderingContext2D;

const CUE: Cue = {
  id: "t",
  start: 0,
  end: 2,
  text: "make it pop now",
  words: [
    { text: "make", start: 0, end: 0.5 },
    { text: "it", start: 0.5, end: 1, highlight: true },
    { text: "pop", start: 1, end: 1.5 },
    { text: "now", start: 1.5, end: 2 },
  ],
};

/** px value of the last-set base font (first font captured on a fillText). */
function fontPx(mock: MockCtx): number {
  const m = mock.fonts[0]?.match(/(\d+(?:\.\d+)?)px/);
  return m ? Number(m[1]) : NaN;
}

describe("renderFrame — every shipped preset draws", () => {
  const times = [0.05, 0.75, 1.95]; // entrance, mid-word, exit window

  for (const preset of PRESETS) {
    it(`${preset.id} renders text at all sample times`, () => {
      for (const time of times) {
        const mock = new MockCtx();
        renderFrame({
          ctx: mock as unknown as CanvasRenderingContext2D,
          cue: CUE,
          style: styleFromPreset(preset.id),
          time,
          width: 1080,
          height: 1920,
        });
        expect(mock.calls.clearRect).toBe(1);
        // word-by-word style reveals hide unspoken words, but at every sample
        // time at least the already-spoken words must be drawn
        expect(mock.calls.fillText ?? 0).toBeGreaterThan(0);
      }
    });
  }
});

describe("renderFrame — invariants", () => {
  it("null cue clears the frame and draws nothing", () => {
    const mock = new MockCtx();
    renderFrame({
      ctx: mock as unknown as CanvasRenderingContext2D,
      cue: null,
      style: styleFromPreset(DEFAULT_PRESET.id),
      time: 0.5,
      width: 1080,
      height: 1920,
    });
    expect(mock.calls.clearRect).toBe(1);
    expect(mock.calls.fillText ?? 0).toBe(0);
  });

  it("font size follows min(width,height): portrait === landscape", () => {
    const style = styleFromPreset(DEFAULT_PRESET.id);
    const portrait = new MockCtx();
    renderFrame({ ctx: portrait as never, cue: CUE, style, time: 0.75, width: 1080, height: 1920 });
    const landscape = new MockCtx();
    renderFrame({ ctx: landscape as never, cue: CUE, style, time: 0.75, width: 1920, height: 1080 });
    expect(fontPx(portrait)).toBeGreaterThan(0);
    expect(fontPx(portrait)).toBeCloseTo(fontPx(landscape), 3);
    // and the calibration itself: fontScale × min dimension
    expect(fontPx(portrait)).toBeCloseTo(Math.max(8, style.fontScale * 1080), 3);
  });

  it("uppercase transform reaches the drawn glyphs", () => {
    const style = { ...styleFromPreset(DEFAULT_PRESET.id), uppercase: true };
    const mock = new MockCtx();
    renderFrame({ ctx: mock as never, cue: CUE, style, time: 0.75, width: 1080, height: 1920 });
    expect(mock.filledTexts.some((t) => t === "MAKE")).toBe(true);
  });

  it("word-by-word hides words not yet spoken", () => {
    const style = { ...styleFromPreset(DEFAULT_PRESET.id), animation: "word-by-word" as const };
    const mock = new MockCtx();
    renderFrame({ ctx: mock as never, cue: CUE, style, time: 0.6, width: 1080, height: 1920 });
    // at t=0.6 only "make" and "it" have started
    expect(mock.filledTexts.length).toBeGreaterThan(0);
    expect(mock.filledTexts.some((t) => /pop/i.test(t))).toBe(false);
    expect(mock.filledTexts.some((t) => /now/i.test(t))).toBe(false);
  });
});

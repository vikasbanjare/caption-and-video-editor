import type { Cue, CaptionStyle, Word } from "./types";

/**
 * Canvas renderer — draws one animated caption frame (WEBSAASPLAN.md §1, §4.4).
 *
 * It is written against the standard CanvasRenderingContext2D API, so the SAME
 * function rasterizes:
 *   • in the browser, on a <canvas> overlaid on the playing <video> (preview)
 *   • on the server, via node-canvas / skia-canvas (final burn-in export)
 * giving the "preview === export" guarantee. All sizes derive from the canvas
 * height, so the result is resolution-independent.
 */

/** Minimal slice of CanvasRenderingContext2D we rely on (browser + node-canvas). */
export type Ctx2D = CanvasRenderingContext2D;

export interface RenderInput {
  ctx: Ctx2D;
  cue: Cue | null;
  style: CaptionStyle;
  /** playback time in seconds */
  time: number;
  width: number;
  height: number;
}

const ENTER = 0.18; // entrance animation window (s)
const EXIT = 0.12; // exit fade window (s)

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

interface LaidWord {
  word: Word;
  display: string;
  x: number; // left edge
  y: number; // baseline
  w: number; // measured width
  line: number;
}

/**
 * Clear the canvas and draw the caption for the current time. Caller owns the
 * animation loop and clears between frames via this function.
 */
export function renderFrame({
  ctx,
  cue,
  style,
  time,
  width,
  height,
}: RenderInput): void {
  ctx.clearRect(0, 0, width, height);
  if (!cue || cue.words.length === 0) return;

  const fontPx = Math.max(8, style.fontScale * height);
  ctx.font = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const lineH = fontPx * style.lineHeight;
  const maxW = style.maxWidth * width;
  const space = ctx.measureText(" ").width;

  // ---- layout: greedy word wrap within maxW ---------------------------------
  const disp = (w: Word) =>
    style.uppercase ? w.text.toUpperCase() : w.text;

  const lines: { words: { word: Word; display: string; w: number }[]; w: number }[] =
    [];
  let cur: { word: Word; display: string; w: number }[] = [];
  let curW = 0;
  for (const w of cue.words) {
    const display = disp(w);
    const ww = ctx.measureText(display).width;
    const add = cur.length === 0 ? ww : curW + space + ww;
    if (add > maxW && cur.length > 0) {
      lines.push({ words: cur, w: curW });
      cur = [];
      curW = 0;
    }
    curW = cur.length === 0 ? ww : curW + space + ww;
    cur.push({ word: w, display, w: ww });
  }
  if (cur.length) lines.push({ words: cur, w: curW });

  const blockH = lines.length * lineH;

  // ---- vertical placement ---------------------------------------------------
  const margin = style.marginV * height;
  let topY: number;
  if (style.position === "top") topY = margin;
  else if (style.position === "center") topY = (height - blockH) / 2;
  else topY = height - margin - blockH;

  // ---- cue-level entrance/exit ----------------------------------------------
  const enterP = clamp01((time - cue.start) / ENTER);
  const exitP = clamp01((cue.end - time) / EXIT);
  let alpha = 1;
  let slideY = 0;
  if (style.animation === "fade") alpha = Math.min(enterP, exitP);
  else alpha = exitP < 1 ? exitP : 1; // always fade out a touch at the end
  if (style.animation === "slide-up") slideY = (1 - easeOut(enterP)) * 0.06 * height;

  // ---- flatten to positioned words ------------------------------------------
  const laid: LaidWord[] = [];
  lines.forEach((ln, li) => {
    let x = (width - ln.w) / 2; // center each line
    const y = topY + li * lineH + fontPx; // baseline
    for (const item of ln.words) {
      laid.push({
        word: item.word,
        display: item.display,
        x,
        y: y + slideY,
        w: item.w,
        line: li,
      });
      x += item.w + space;
    }
  });

  // ---- background pills ------------------------------------------------------
  if (style.backgroundColor) {
    const padX = fontPx * 0.35;
    const padY = fontPx * 0.18;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style.backgroundColor;
    lines.forEach((ln, li) => {
      const lw = ln.w + padX * 2;
      const lx = (width - lw) / 2;
      const ly = topY + li * lineH + slideY + (lineH - fontPx) / 2 - padY;
      const lh = fontPx + padY * 2;
      roundRect(ctx, lx, ly, lw, lh, fontPx * 0.18);
      ctx.fill();
    });
    ctx.restore();
  }

  // ---- draw words ------------------------------------------------------------
  for (const lw of laid) {
    drawWord(ctx, lw, style, time, fontPx, alpha);
  }
}

function drawWord(
  ctx: Ctx2D,
  lw: LaidWord,
  style: CaptionStyle,
  time: number,
  fontPx: number,
  cueAlpha: number
): void {
  const { word } = lw;
  const spoken = time >= word.start;
  const current = time >= word.start && time < word.end;

  // word-by-word: hide words that haven't started yet (layout stays stable).
  let wordAlpha = cueAlpha;
  let scale = 1;
  if (style.animation === "word-by-word") {
    if (!spoken) return;
    const p = clamp01((time - word.start) / 0.12);
    wordAlpha = cueAlpha * p;
    scale = 0.8 + 0.2 * easeOut(p);
  } else if (style.animation === "pop" && current) {
    const p = clamp01((time - word.start) / Math.max(0.08, word.end - word.start));
    scale = easeOutBack(Math.min(1, p * 1.4));
  }

  const color = colorFor(word, style, spoken, current);

  ctx.save();
  ctx.globalAlpha = wordAlpha;

  // shadow
  if (style.shadowBlur > 0) {
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur * fontPx;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = fontPx * 0.04;
  }

  // pop / reveal scale around the word's center
  if (scale !== 1) {
    const cx = lw.x + lw.w / 2;
    const cy = lw.y - fontPx * 0.35;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
  }

  // outline then fill
  if (style.strokeColor && style.strokeWidth > 0) {
    ctx.lineJoin = "round";
    ctx.lineWidth = style.strokeWidth * fontPx;
    ctx.strokeStyle = style.strokeColor;
    ctx.strokeText(lw.display, lw.x, lw.y);
  }
  ctx.fillStyle = color;
  ctx.fillText(lw.display, lw.x, lw.y);

  ctx.restore();
}

function colorFor(
  word: Word,
  style: CaptionStyle,
  spoken: boolean,
  current: boolean
): string {
  if (style.animation === "karaoke") {
    return spoken ? style.activeWordColor : word.highlight ? style.highlightColor : style.color;
  }
  if ((style.animation === "pop" || style.animation === "word-by-word") && current) {
    return style.activeWordColor;
  }
  return word.highlight ? style.highlightColor : style.color;
}

function roundRect(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

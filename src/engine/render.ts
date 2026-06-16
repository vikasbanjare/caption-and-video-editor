import type { Cue, CaptionStyle, Word } from "./types";

/**
 * Canvas renderer — draws one animated caption frame (WEBSAASPLAN.md §1, §4.4).
 *
 * Written against the standard CanvasRenderingContext2D API so the SAME function
 * rasterizes in the browser (preview) and on the server (export), giving the
 * "preview === export" guarantee. All sizes derive from the canvas height, so
 * output is resolution-independent.
 */

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

const ENTER = 0.18;
const EXIT = 0.1;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeBounce = (t: number) => {
  // a soft single bounce overshoot
  return 1 + 0.18 * Math.sin(Math.min(1, t) * Math.PI) - (1 - easeOut(t)) * 0;
};

interface LaidWord {
  word: Word;
  display: string;
  x: number;
  y: number;
  w: number;
  line: number;
}

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
  applyFont(ctx, style, fontPx);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const lineH = fontPx * style.lineHeight;
  const maxW = style.maxWidth * width;
  const space = ctx.measureText(" ").width;
  const disp = (w: Word) => (style.uppercase ? w.text.toUpperCase() : w.text);

  // ---- layout: greedy word wrap --------------------------------------------
  const lines: { items: { word: Word; display: string; w: number }[]; w: number }[] = [];
  let cur: { word: Word; display: string; w: number }[] = [];
  let curW = 0;
  for (const w of cue.words) {
    const display = disp(w);
    const ww = ctx.measureText(display).width;
    if (cur.length > 0 && curW + space + ww > maxW) {
      lines.push({ items: cur, w: curW });
      cur = [];
      curW = 0;
    }
    curW = cur.length === 0 ? ww : curW + space + ww;
    cur.push({ word: w, display, w: ww });
  }
  if (cur.length) lines.push({ items: cur, w: curW });

  const blockH = lines.length * lineH;
  const margin = style.marginV * height;
  let topY: number;
  if (style.position === "top") topY = margin;
  else if (style.position === "center") topY = (height - blockH) / 2;
  else topY = height - margin - blockH;

  // ---- cue-level entrance/exit ----------------------------------------------
  const enterP = clamp01((time - cue.start) / ENTER);
  const exitP = clamp01((cue.end - time) / EXIT);
  let alpha = exitP < 1 ? exitP : 1;
  let slideY = 0;
  if (style.animation === "fade") alpha = Math.min(enterP, exitP);
  if (style.animation === "slide-up") slideY = (1 - easeOut(enterP)) * 0.06 * height;

  // ---- positioned words -----------------------------------------------------
  const laid: LaidWord[] = [];
  lines.forEach((ln, li) => {
    let x = (width - ln.w) / 2;
    const y = topY + li * lineH + fontPx + slideY;
    for (const it of ln.items) {
      laid.push({ word: it.word, display: it.display, x, y, w: it.w, line: li });
      x += it.w + space;
    }
  });

  // ---- background pill (whole block) ---------------------------------------
  if (style.backgroundColor) {
    const padX = fontPx * 0.4;
    const padY = fontPx * 0.2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style.backgroundColor;
    lines.forEach((ln, li) => {
      const lw = ln.w + padX * 2;
      const lx = (width - lw) / 2;
      const ly = topY + li * lineH + slideY + (lineH - fontPx) / 2 - padY;
      roundRect(ctx, lx, ly, lw, fontPx + padY * 2, fontPx * style.cornerRadius);
      ctx.fill();
    });
    ctx.restore();
  }

  // ---- active-word box (drawn behind text) ---------------------------------
  if (style.highlightMode === "box") {
    for (const lw of laid) {
      if (!isCurrent(lw.word, time)) continue;
      const scale = wordScale(style, lw.word, time);
      const padX = fontPx * 0.22;
      const padY = fontPx * 0.14;
      const bw = lw.w + padX * 2;
      const bh = fontPx * 0.86 + padY * 2;
      const bx = lw.x - padX;
      const by = lw.y - fontPx * 0.78 - padY;
      const cx = lw.x + lw.w / 2;
      const cy = lw.y - fontPx * 0.34;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (scale !== 1) {
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
      }
      ctx.fillStyle = style.activeBoxColor;
      roundRect(ctx, bx, by, bw, bh, fontPx * style.cornerRadius);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- words ----------------------------------------------------------------
  for (const lw of laid) drawWord(ctx, lw, style, time, fontPx, alpha);
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
  const current = isCurrent(word, time);

  let wordAlpha = cueAlpha;
  if (style.animation === "word-by-word") {
    if (!spoken) return;
    wordAlpha = cueAlpha * clamp01((time - word.start) / 0.1);
  }
  const scale = wordScale(style, word, time);
  const color = colorFor(word, style, spoken, current);

  ctx.save();
  ctx.globalAlpha = wordAlpha;

  if (scale !== 1) {
    const cx = lw.x + lw.w / 2;
    const cy = lw.y - fontPx * 0.34;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
  }

  // glow / shadow
  if (style.glow > 0 && (current || style.highlightMode !== "box")) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glow * fontPx * 1.3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (style.shadowBlur > 0) {
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur * fontPx;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = fontPx * 0.045;
  }

  if (style.strokeColor && style.strokeWidth > 0) {
    ctx.lineJoin = "round";
    ctx.lineWidth = style.strokeWidth * fontPx;
    ctx.strokeStyle = style.strokeColor;
    ctx.strokeText(lw.display, lw.x, lw.y);
  }
  ctx.fillStyle = color;
  ctx.fillText(lw.display, lw.x, lw.y);
  // a second pass strengthens the neon glow
  if (style.glow > 0 && (current || style.highlightMode !== "box")) {
    ctx.fillText(lw.display, lw.x, lw.y);
  }

  ctx.restore();
}

function isCurrent(word: Word, time: number): boolean {
  return time >= word.start && time < word.end;
}

function wordScale(style: CaptionStyle, word: Word, time: number): number {
  const current = isCurrent(word, time);
  if (style.animation === "pop" && current) {
    const p = clamp01((time - word.start) / Math.max(0.08, word.end - word.start));
    return easeOutBack(Math.min(1, p * 1.5));
  }
  if (style.animation === "bounce" && current) {
    const p = clamp01((time - word.start) / Math.max(0.1, (word.end - word.start) * 0.8));
    return easeBounce(p);
  }
  if (style.animation === "word-by-word" && time >= word.start) {
    return 0.82 + 0.18 * easeOut(clamp01((time - word.start) / 0.12));
  }
  return 1;
}

function colorFor(
  word: Word,
  style: CaptionStyle,
  spoken: boolean,
  current: boolean
): string {
  if (style.highlightMode === "box" && current) return style.activeBoxTextColor;
  if (style.animation === "karaoke") {
    return spoken
      ? style.activeWordColor
      : word.highlight
        ? style.highlightColor
        : style.color;
  }
  if (
    (style.animation === "pop" ||
      style.animation === "bounce" ||
      style.animation === "word-by-word") &&
    current
  ) {
    return style.activeWordColor;
  }
  return word.highlight ? style.highlightColor : style.color;
}

function applyFont(ctx: Ctx2D, style: CaptionStyle, fontPx: number): void {
  ctx.font = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`;
  // letterSpacing is supported in modern browsers; ignored where it isn't.
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${
      style.letterSpacing * fontPx
    }px`;
  } catch {
    /* node-canvas may not support it */
  }
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

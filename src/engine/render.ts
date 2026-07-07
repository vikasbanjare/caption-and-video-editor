import type { Cue, CaptionStyle, Word } from "./types";

/**
 * Canvas renderer — draws one animated caption frame. Written against the
 * standard CanvasRenderingContext2D API so the SAME code rasterises in the
 * browser (preview) and on the server (export): "preview === export". All sizes
 * derive from the canvas height, so output is resolution-independent.
 *
 * Supports the full CutPilot template feature set: gradient + glossy text,
 * spoken/keyword emphasis via colour, boxed pill, or underline bar, dimmed
 * upcoming words, active-word scaling, and decorated background pills / buttons
 * (gradient, stroke, glow, 3D extrude, gloss sheen, drop shadow).
 */

export type Ctx2D = CanvasRenderingContext2D;

export interface RenderInput {
  ctx: Ctx2D;
  cue: Cue | null;
  style: CaptionStyle;
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
const easeBounce = (t: number) => 1 + 0.16 * Math.sin(Math.min(1, t) * Math.PI);

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

  let fontPx = Math.max(8, style.fontScale * height);
  const maxW = style.maxWidth * width;
  const disp = (w: Word) => (style.uppercase ? w.text.toUpperCase() : w.text);

  // ---- single-line button pills: shrink to fit -------------------------------
  if (style.maxLines === 1) {
    setBaseFont(ctx, style, fontPx);
    const space = ctx.measureText(" ").width;
    let total = 0;
    cue.words.forEach((w, i) => {
      total += ctx.measureText(disp(w)).width + (i ? space : 0);
    });
    if (total > maxW) fontPx = Math.max(8, fontPx * (maxW / total) * 0.98);
  }

  setBaseFont(ctx, style, fontPx);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const lineH = fontPx * style.lineHeight;
  const space = ctx.measureText(" ").width;

  // ---- layout ----------------------------------------------------------------
  const lines: { items: { word: Word; display: string; w: number }[]; w: number }[] =
    [];
  if (style.maxLines === 1) {
    const items = cue.words.map((w) => ({
      word: w,
      display: disp(w),
      w: ctx.measureText(disp(w)).width,
    }));
    lines.push({ items, w: items.reduce((a, it, i) => a + it.w + (i ? space : 0), 0) });
  } else {
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
  }

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
  if (style.animation === "slide-up")
    slideY = (1 - easeOut(enterP)) * 0.06 * height;

  // ---- positioned words ------------------------------------------------------
  const laid: LaidWord[] = [];
  lines.forEach((ln, li) => {
    let x = (width - ln.w) / 2;
    const y = topY + li * lineH + fontPx + slideY;
    for (const it of ln.items) {
      laid.push({ word: it.word, display: it.display, x, y, w: it.w, line: li });
      x += it.w + space;
    }
  });

  // ---- background box / button pill (per line) -------------------------------
  if (hasBox(style)) {
    lines.forEach((ln, li) => {
      const pad = style.boxPad || 1;
      const padX = fontPx * 0.42 * pad;
      const padY = fontPx * 0.24 * pad;
      const bw = ln.w + padX * 2;
      const bx = (width - bw) / 2;
      const by = topY + li * lineH + slideY + (lineH - fontPx) / 2 - padY;
      const bh = fontPx + padY * 2;
      drawBox(ctx, bx, by, bw, bh, fontPx, style, alpha);
    });
  }

  // ---- emphasis box / bar behind or under the emphasised word ----------------
  for (const lw of laid) {
    if (!isEmphasised(lw.word, time, style)) continue;
    const scale = wordScale(lw.word, time, style);
    if (style.highlightMode === "box") {
      const padX = fontPx * 0.22;
      const padY = fontPx * 0.14;
      const bx = lw.x - padX;
      const by = lw.y - fontPx * 0.78 - padY;
      const bw = lw.w + padX * 2;
      const bh = fontPx * 0.86 + padY * 2;
      withScale(ctx, lw, fontPx, scale, () => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = style.activeBoxColor;
        roundRect(ctx, bx, by, bw, bh, fontPx * style.cornerRadius);
        ctx.fill();
        ctx.restore();
      });
    } else if (style.highlightMode === "bar") {
      const by = lw.y + fontPx * 0.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = style.activeWordColor;
      roundRect(ctx, lw.x, by, lw.w, Math.max(2, fontPx * 0.09), fontPx * 0.05);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- words -----------------------------------------------------------------
  for (const lw of laid) drawWord(ctx, lw, style, time, fontPx, alpha);
}

// ---------------------------------------------------------------------------

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
  const emph = isEmphasised(word, time, style);

  let wordAlpha = cueAlpha;
  if (style.animation === "word-by-word") {
    if (!spoken) return;
    wordAlpha *= clamp01((time - word.start) / 0.1);
  } else if (style.upcomingOpacity < 1 && !spoken) {
    wordAlpha *= style.upcomingOpacity;
  }

  const scale = wordScale(word, time, style);
  const useKeywordFont = emph && style.keywordFontFamily;

  withScale(ctx, lw, fontPx, scale, () => {
    ctx.save();
    ctx.globalAlpha = wordAlpha;
    if (useKeywordFont) {
      ctx.font = `${style.keywordItalic ? "italic " : ""}${style.fontWeight} ${fontPx}px ${style.keywordFontFamily}`;
    }

    // shadow / glow
    if (style.glow > 0 && (emph || style.emphasis !== "keyword")) {
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

    // outline
    if (style.strokeColor && style.strokeWidth > 0) {
      ctx.lineJoin = "round";
      ctx.lineWidth = style.strokeWidth * fontPx;
      ctx.strokeStyle = style.strokeColor;
      ctx.strokeText(lw.display, lw.x, lw.y);
    }

    // fill (solid / vertical gradient / emphasised colour)
    ctx.fillStyle = fillFor(ctx, lw, style, fontPx, emph);
    ctx.fillText(lw.display, lw.x, lw.y);
    if (style.glow > 0 && (emph || style.emphasis !== "keyword")) {
      ctx.fillText(lw.display, lw.x, lw.y); // second pass strengthens glow
    }

    // gloss sheen
    if (style.gloss) {
      ctx.shadowBlur = 0;
      const top = lw.y - fontPx * 0.72;
      const g = ctx.createLinearGradient(0, top, 0, top + fontPx * 0.5);
      g.addColorStop(0, "rgba(255,255,255,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillText(lw.display, lw.x, lw.y);
    }
    ctx.restore();
  });
}

function fillFor(
  ctx: Ctx2D,
  lw: LaidWord,
  style: CaptionStyle,
  fontPx: number,
  emph: boolean
): string | CanvasGradient {
  const top = lw.y - fontPx * 0.74;
  const bottom = lw.y + fontPx * 0.06;
  if (emph && style.highlightMode === "box") return style.activeBoxTextColor;
  if (emph && style.highlightMode !== "box") {
    if (style.activeWordColor2) {
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, style.activeWordColor);
      g.addColorStop(1, style.activeWordColor2);
      return g;
    }
    return style.activeWordColor;
  }
  if (!emph && style.emphasis === "keyword" && word_isKeyword(lw.word)) {
    // a keyword that isn't the *active* one still gets the accent colour
    return style.highlightColor;
  }
  if (style.color2) {
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, style.color);
    g.addColorStop(1, style.color2);
    return g;
  }
  return style.color;
}

function word_isKeyword(w: Word): boolean {
  return !!w.highlight;
}

function isEmphasised(word: Word, time: number, style: CaptionStyle): boolean {
  return style.emphasis === "keyword"
    ? !!word.highlight
    : time >= word.start && time < word.end;
}

function wordScale(word: Word, time: number, style: CaptionStyle): number {
  let s = 1;
  const cur = time >= word.start && time < word.end;
  const prog = clamp01((time - word.start) / Math.max(0.08, word.end - word.start));
  if (style.animation === "pop" && cur) s *= easeOutBack(Math.min(1, prog * 1.5));
  else if (style.animation === "bounce" && cur) s *= easeBounce(prog);
  else if (style.animation === "word-by-word" && time >= word.start)
    s *= 0.82 + 0.18 * easeOut(clamp01((time - word.start) / 0.12));

  if (isEmphasised(word, time, style) && style.activeScale !== 1) {
    s *=
      style.emphasis === "keyword"
        ? style.activeScale
        : 1 + (style.activeScale - 1) * easeOut(prog);
  }
  return s;
}

function withScale(
  ctx: Ctx2D,
  lw: LaidWord,
  fontPx: number,
  scale: number,
  draw: () => void
): void {
  if (scale === 1) {
    draw();
    return;
  }
  const cx = lw.x + lw.w / 2;
  const cy = lw.y - fontPx * 0.34;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

// ---- background box / button pill -----------------------------------------

function hasBox(style: CaptionStyle): boolean {
  return !!(style.backgroundColor || style.boxStroke || style.box3d);
}

function drawBox(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fontPx: number,
  style: CaptionStyle,
  alpha: number
): void {
  const r = fontPx * style.cornerRadius;

  // drop shadow
  if (style.boxShadow) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = style.boxShadow;
    ctx.shadowBlur = (style.boxShadowBlur || 0.4) * fontPx;
    ctx.shadowOffsetY = (style.boxShadowDY || 0.1) * fontPx;
    ctx.fillStyle = "rgba(0,0,0,0.001)";
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  // 3D extruded back edge
  if (style.box3d) {
    const depth = (style.box3dDepth || 0.12) * fontPx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style.box3d;
    roundRect(ctx, x, y + depth, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  // face
  if (style.backgroundColor) {
    ctx.save();
    ctx.globalAlpha = alpha * (style.boxOpacity ?? 1);
    if (style.boxGlow) {
      ctx.shadowColor = style.boxGlow;
      ctx.shadowBlur = (style.boxGlowBlur || 0.4) * fontPx;
    }
    ctx.fillStyle = boxFill(ctx, x, y, w, h, style);
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
  }

  // gloss sheen (top half)
  if (style.boxGloss > 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
    g.addColorStop(0, `rgba(255,255,255,${0.5 * style.boxGloss})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h * 0.55, r);
    ctx.fill();
    ctx.restore();
  }

  // border
  if (style.boxStroke) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = (style.boxStrokeWidth || 0.05) * fontPx;
    ctx.strokeStyle = style.boxStroke;
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.restore();
  }
}

function boxFill(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: CaptionStyle
): string | CanvasGradient {
  if (style.boxStops && style.boxStops.length) {
    const g = ctx.createLinearGradient(x, y, x + w, y);
    for (const [pos, col] of style.boxStops) g.addColorStop(clamp01(pos), col);
    return g;
  }
  if (style.boxGradient && style.boxColor2) {
    const g =
      style.boxGradient === "h"
        ? ctx.createLinearGradient(x, y, x + w, y)
        : ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, style.backgroundColor);
    g.addColorStop(1, style.boxColor2);
    return g;
  }
  return style.backgroundColor;
}

function setBaseFont(ctx: Ctx2D, style: CaptionStyle, fontPx: number): void {
  ctx.font = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`;
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

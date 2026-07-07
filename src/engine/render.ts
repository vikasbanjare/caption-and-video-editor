import type { Cue, CaptionStyle, Word } from "./types";

/**
 * Canvas renderer — draws one animated caption frame. Written against the
 * standard CanvasRenderingContext2D API so the SAME code rasterises in the
 * browser (preview) and on the server (export): "preview === export". All sizes
 * derive from the canvas height, so output is resolution-independent.
 *
 * Ports the full CutPilot / "Pulse" caption engine: gradient + glossy text,
 * spoken/keyword emphasis (colour / boxed pill / underline bar), dimmed
 * upcoming words, active-word scaling, decorated pills & buttons (gradient,
 * stroke, glow, 3D extrude, gloss, shadow), and Pulse's animation catalog
 * (pop, scale, zoom, zoompunch, bounce, slide, glide, wave, shake, glitch,
 * whoosh, blur-dissolve, reveal, karaoke, typewriter, fade).
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

const ENTER = 0.26; // cue-level entrance window (s)
const EXIT = 0.1;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeBounce = (t: number) => 1 + 0.16 * Math.sin(Math.min(1, t) * Math.PI);

interface Entrance {
  hidden: boolean;
  scale: number;
  dx: number;
  dy: number;
  alpha: number;
}

interface LaidWord {
  word: Word;
  display: string;
  x: number;
  y: number;
  w: number;
  line: number;
  en: Entrance;
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

  // single-line button pills: shrink to fit
  if (style.maxLines === 1) {
    setBaseFont(ctx, style, fontPx);
    const sp = ctx.measureText(" ").width;
    let total = 0;
    cue.words.forEach((w, i) => {
      total += ctx.measureText(disp(w)).width + (i ? sp : 0);
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

  // cue-level exit fade
  const exitP = clamp01((cue.end - time) / EXIT);
  const cueAlpha = exitP;

  // ---- positioned words + per-word entrance ----------------------------------
  const laid: LaidWord[] = [];
  lines.forEach((ln, li) => {
    let x = (width - ln.w) / 2;
    const y = topY + li * lineH + fontPx;
    for (const it of ln.items) {
      laid.push({
        word: it.word,
        display: it.display,
        x,
        y,
        w: it.w,
        line: li,
        en: entranceFor(it.word, cue, time, style, width, height),
      });
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
      const by = topY + li * lineH + (lineH - fontPx) / 2 - padY;
      const bh = fontPx + padY * 2;
      // move the pill with the line's entrance (words on a line share it)
      const en = laid.find((l) => l.line === li)?.en;
      const a = cueAlpha * (en ? en.alpha : 1);
      ctx.save();
      ctx.translate(en?.dx ?? 0, en?.dy ?? 0);
      drawBox(ctx, bx, by, bw, bh, fontPx, style, a);
      ctx.restore();
    });
  }

  // ---- emphasis box / bar behind or under the emphasised word ----------------
  for (const lw of laid) {
    if (lw.en.hidden || !isEmphasised(lw.word, time, style)) continue;
    const s = lw.en.scale * emphasisScale(lw.word, time, style);
    if (style.highlightMode === "box") {
      const padX = fontPx * 0.22;
      const padY = fontPx * 0.14;
      drawTransformed(ctx, lw, fontPx, s, () => {
        ctx.save();
        ctx.globalAlpha = cueAlpha * lw.en.alpha;
        ctx.fillStyle = style.activeBoxColor;
        roundRect(
          ctx,
          lw.x - padX,
          lw.y - fontPx * 0.78 - padY,
          lw.w + padX * 2,
          fontPx * 0.86 + padY * 2,
          fontPx * style.cornerRadius
        );
        ctx.fill();
        ctx.restore();
      });
    } else if (style.highlightMode === "bar") {
      drawTransformed(ctx, lw, fontPx, s, () => {
        ctx.save();
        ctx.globalAlpha = cueAlpha * lw.en.alpha;
        ctx.fillStyle = style.activeWordColor;
        roundRect(
          ctx,
          lw.x,
          lw.y + fontPx * 0.12,
          lw.w,
          Math.max(2, fontPx * 0.09),
          fontPx * 0.05
        );
        ctx.fill();
        ctx.restore();
      });
    }
  }

  // ---- words -----------------------------------------------------------------
  for (const lw of laid) drawWord(ctx, lw, style, time, fontPx, cueAlpha);
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
  const { word, en } = lw;
  if (en.hidden) return;
  const emph = isEmphasised(word, time, style);
  const spoken = time >= word.start;

  let wordAlpha = cueAlpha * en.alpha;
  if (style.upcomingOpacity < 1 && !spoken && style.animation !== "word-by-word")
    wordAlpha *= style.upcomingOpacity;

  const scale = en.scale * emphasisScale(word, time, style);
  const useKeywordFont = emph && style.keywordFontFamily;

  drawTransformed(ctx, lw, fontPx, scale, () => {
    ctx.save();
    ctx.globalAlpha = wordAlpha;
    if (useKeywordFont) {
      ctx.font = `${style.keywordItalic ? "italic " : ""}${style.fontWeight} ${fontPx}px ${style.keywordFontFamily}`;
    }

    if (style.glow > 0 && (emph || style.emphasis !== "keyword")) {
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = style.glow * fontPx * 1.3;
    } else if (style.shadowBlur > 0) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur * fontPx;
      ctx.shadowOffsetY = fontPx * 0.045;
    }

    if (style.strokeColor && style.strokeWidth > 0) {
      ctx.lineJoin = "round";
      ctx.lineWidth = style.strokeWidth * fontPx;
      ctx.strokeStyle = style.strokeColor;
      ctx.strokeText(lw.display, lw.x, lw.y);
    }

    ctx.fillStyle = fillFor(ctx, lw, style, fontPx, emph);
    ctx.fillText(lw.display, lw.x, lw.y);
    if (style.glow > 0 && (emph || style.emphasis !== "keyword")) {
      ctx.fillText(lw.display, lw.x, lw.y);
    }

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

// ---- animation catalog (Pulse engine) -------------------------------------

function entranceFor(
  word: Word,
  cue: Cue,
  time: number,
  style: CaptionStyle,
  w: number,
  h: number
): Entrance {
  const a = style.animation;
  const base: Entrance = { hidden: false, scale: 1, dx: 0, dy: 0, alpha: 1 };

  // per-word reveal animations
  if (a === "word-by-word" || a === "reveal" || a === "typewriter") {
    if (time < word.start)
      return a === "typewriter"
        ? { ...base, hidden: true }
        : { ...base, hidden: true };
    const p = clamp01((time - word.start) / 0.12);
    return {
      hidden: false,
      scale: a === "reveal" ? easeOutBack(Math.min(1, p * 1.4)) : 0.9 + 0.1 * easeOut(p),
      dx: 0,
      dy: 0,
      alpha: a === "typewriter" ? 1 : p,
    };
  }

  const p = clamp01((time - cue.start) / ENTER);
  const done = p >= 1;
  switch (a) {
    case "pop":
      return { ...base, scale: easeOutBack(Math.min(1, p * 1.4)) };
    case "bounce":
      return { ...base, scale: easeBounce(p) };
    case "scale":
      return { ...base, scale: 0.7 + 0.3 * easeOut(p), alpha: Math.min(1, p * 1.6) };
    case "zoom":
      return { ...base, scale: 1.6 - 0.6 * easeOut(p), alpha: Math.min(1, p * 2) };
    case "zoompunch":
      return { ...base, scale: 1.9 - 0.9 * easeOut(Math.min(1, p * 1.4)) };
    case "slide-up":
      return { ...base, dy: (1 - easeOut(p)) * 0.07 * h, alpha: Math.min(1, p * 1.6) };
    case "glide":
      return { ...base, dy: (1 - easeOut(p)) * 0.05 * h, alpha: Math.min(1, p * 1.6) };
    case "wave":
      return { ...base, dy: done ? 0 : Math.sin(p * Math.PI) * -0.035 * h };
    case "shake":
      return { ...base, dx: done ? 0 : Math.sin(time * 55) * (1 - p) * 0.02 * w };
    case "whoosh":
      return {
        ...base,
        dx: (1 - easeOut(p)) * -0.28 * w,
        scale: 1 + (1 - p) * 0.08,
        alpha: Math.min(1, p * 2),
      };
    case "blurdissolve":
      return { ...base, scale: 0.95 + 0.05 * p, alpha: p };
    case "glitch":
      if (done) return base;
      return {
        ...base,
        dx: Math.sin(time * 90) * 0.012 * w,
        alpha: Math.floor(time * 30) % 2 ? 0.6 : 1,
      };
    case "fade":
      return { ...base, alpha: p };
    default:
      return base; // none, karaoke
  }
}

function emphasisScale(word: Word, time: number, style: CaptionStyle): number {
  if (!isEmphasised(word, time, style) || style.activeScale === 1) return 1;
  if (style.emphasis === "keyword") return style.activeScale;
  const prog = clamp01((time - word.start) / Math.max(0.08, word.end - word.start));
  return 1 + (style.activeScale - 1) * easeOut(prog);
}

function drawTransformed(
  ctx: Ctx2D,
  lw: LaidWord,
  fontPx: number,
  scale: number,
  draw: () => void
): void {
  const { dx, dy } = lw.en;
  if (scale === 1 && dx === 0 && dy === 0) {
    draw();
    return;
  }
  const cx = lw.x + lw.w / 2;
  const cy = lw.y - fontPx * 0.34;
  ctx.save();
  ctx.translate(dx, dy);
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
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
  if (!emph && style.emphasis === "keyword" && lw.word.highlight) {
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

function isEmphasised(word: Word, time: number, style: CaptionStyle): boolean {
  return style.emphasis === "keyword"
    ? !!word.highlight
    : time >= word.start && time < word.end;
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

  if (style.box3d) {
    const depth = (style.box3dDepth || 0.12) * fontPx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style.box3d;
    roundRect(ctx, x, y + depth, w, h, r);
    ctx.fill();
    ctx.restore();
  }

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

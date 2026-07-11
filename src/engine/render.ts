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

  // Calibration (Pulse tech brief §3): the engine's authored face lives on a
  // 1080-wide portrait / 1080-tall landscape frame — i.e. the SMALL dimension.
  // Scaling by height alone oversized portrait captions relative to width.
  const refDim = Math.min(height, width);
  let fontPx = Math.max(8, style.fontScale * refDim);
  const maxW = style.maxWidth * width;
  const disp = (w: Word) => transformText(w.text, style);

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
  topY += (style.offsetY || 0) * height; // free-drag vertical offset
  const shiftX = (style.offsetX || 0) * width; // free-drag horizontal offset

  // horizontal alignment within the max-width column
  const lineX = (lineW: number): number => {
    const boxLeft = (width - maxW) / 2 + shiftX;
    if (style.textAlign === "left") return boxLeft;
    if (style.textAlign === "right") return boxLeft + (maxW - lineW);
    return (width - lineW) / 2 + shiftX;
  };

  // cue-level exit (fade + optional transform) × whole-block opacity
  const outSec = Math.max(0.02, (style.animOutMs || 100) / 1000);
  const exitP = clamp01((cue.end - time) / outSec);
  const exitAlpha = style.exitAnimation === "none" ? 1 : exitP;
  const cueAlpha = exitAlpha * (style.captionOpacity ?? 1);

  // ---- positioned words + per-word entrance ----------------------------------
  const laid: LaidWord[] = [];
  lines.forEach((ln, li) => {
    let x = lineX(ln.w);
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

  // ---- group transform: rotation + exit motion wrap every drawn element ------
  const gcx = width / 2 + shiftX;
  const gcy = topY + blockH / 2;
  const rot = ((style.rotation || 0) * Math.PI) / 180;
  let gdy = 0;
  let gscale = 1;
  ctx.save();
  if (style.exitAnimation === "slide") gdy = (1 - exitP) * 0.06 * height;
  else if (style.exitAnimation === "zoom") gscale = 1 - (1 - exitP) * 0.12;
  else if (style.exitAnimation === "blur") {
    try {
      ctx.filter = `blur(${((1 - exitP) * 8).toFixed(2)}px)`;
    } catch {
      /* node-canvas */
    }
  }
  if (rot || gscale !== 1 || gdy) {
    ctx.translate(gcx, gcy + gdy);
    ctx.rotate(rot);
    ctx.scale(gscale, gscale);
    ctx.translate(-gcx, -gcy);
  }

  // ---- background box / button pill (per line) -------------------------------
  if (hasBox(style)) {
    lines.forEach((ln, li) => {
      const padScale = style.boxPad || 1;
      const padX = fontPx * (style.boxPadX > 0 ? style.boxPadX : 0.42 * padScale);
      const padY = fontPx * (style.boxPadY > 0 ? style.boxPadY : 0.24 * padScale);
      const bw = ln.w + padX * 2;
      const bx = lineX(ln.w) - padX;
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

  ctx.restore(); // close group transform
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

  let wordAlpha = cueAlpha * en.alpha * (style.textOpacity ?? 1);
  if (style.upcomingOpacity < 1 && !spoken && style.animation !== "word-by-word")
    wordAlpha *= style.upcomingOpacity;

  // active-word vertical bounce (spoken mode)
  let bounceDy = 0;
  if (emph && style.activeBounce > 0 && style.emphasis === "spoken") {
    const prog = clamp01((time - word.start) / Math.max(0.08, word.end - word.start));
    bounceDy = -Math.sin(prog * Math.PI) * style.activeBounce * fontPx;
  }
  const enT: Entrance = bounceDy ? { ...en, dy: en.dy + bounceDy } : en;
  const lwT: LaidWord = bounceDy ? { ...lw, en: enT } : lw;

  const scale = en.scale * emphasisScale(word, time, style);
  const useKeywordFont = emph && style.keywordFontFamily;
  const fill = fillFor(ctx, lw, style, fontPx, emph);
  const glowActive = style.glow > 0 && (emph || style.emphasis !== "keyword");
  const karaoke = style.animation === "karaoke" && style.emphasis === "spoken";

  drawTransformed(ctx, lwT, fontPx, scale, () => {
    ctx.save();
    ctx.globalAlpha = wordAlpha;
    if (useKeywordFont) {
      ctx.font = `${style.keywordItalic ? "italic " : ""}${style.fontWeight} ${fontPx}px ${style.keywordFontFamily}`;
    }
    ctx.lineJoin = "round";

    // long / hard shadow (extrude) behind everything
    if (style.longShadow > 0) {
      const len = style.longShadow * fontPx;
      const steps = Math.max(2, Math.round(len / 2));
      const ang = (style.longShadowAngle * Math.PI) / 180;
      const dxs = (Math.cos(ang) * len) / steps;
      const dys = (Math.sin(ang) * len) / steps;
      ctx.save();
      ctx.fillStyle = style.longShadowColor || style.strokeColor || "rgba(0,0,0,0.85)";
      for (let i = steps; i >= 1; i--) {
        ctx.fillText(lw.display, lw.x + dxs * i, lw.y + dys * i);
      }
      ctx.restore();
    }

    // neon glow — its own blurred pass so it doesn't smear the crisp fill
    if (glowActive) {
      ctx.save();
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur =
        (style.glowRadius > 0 ? style.glowRadius : style.glow * 1.3) * fontPx;
      ctx.fillStyle = fill;
      ctx.fillText(lw.display, lw.x, lw.y);
      ctx.fillText(lw.display, lw.x, lw.y);
      ctx.restore();
    }

    // drop shadow for readability (can coexist with glow now)
    if (style.shadowBlur > 0) {
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur * fontPx;
      ctx.shadowOffsetX = (style.shadowOffsetX || 0) * fontPx;
      ctx.shadowOffsetY = (style.shadowOffsetY ?? 0.045) * fontPx;
    }

    // stacked outlines (largest first), then the main stroke
    for (const sl of style.strokes || []) {
      if (!sl || sl.width <= 0) continue;
      ctx.save();
      ctx.globalAlpha = wordAlpha * (sl.opacity ?? 1);
      ctx.lineWidth = sl.width * fontPx;
      ctx.strokeStyle = sl.color;
      ctx.strokeText(lw.display, lw.x, lw.y);
      ctx.restore();
    }
    if (style.strokeColor && style.strokeWidth > 0) {
      ctx.save();
      ctx.globalAlpha = wordAlpha * (style.strokeOpacity ?? 1);
      ctx.lineWidth = style.strokeWidth * fontPx;
      ctx.strokeStyle = style.strokeColor;
      ctx.strokeText(lw.display, lw.x, lw.y);
      ctx.restore();
    }

    // fill — karaoke does a two-tone left→right sweep
    if (karaoke) {
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = style.color;
      if (style.upcomingOpacity < 1)
        ctx.globalAlpha = wordAlpha * style.upcomingOpacity;
      ctx.fillText(lw.display, lw.x, lw.y);
      ctx.restore();
      const prog = clamp01((time - word.start) / Math.max(0.03, word.end - word.start));
      if (prog > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(lw.x - fontPx * 0.1, lw.y - fontPx * 1.15, lw.w * prog + fontPx * 0.12, fontPx * 1.55);
        ctx.clip();
        ctx.fillStyle = style.activeWordColor || fill;
        ctx.fillText(lw.display, lw.x, lw.y);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = fill;
      ctx.fillText(lw.display, lw.x, lw.y);
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    if (style.gloss) {
      const top = lw.y - fontPx * 0.72;
      const g = ctx.createLinearGradient(0, top, 0, top + fontPx * 0.5);
      g.addColorStop(0, "rgba(255,255,255,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillText(lw.display, lw.x, lw.y);
    }

    // underline / strikethrough
    const decor = typeof fill === "string" ? fill : style.color;
    const line = (yOff: number) => {
      ctx.save();
      ctx.globalAlpha = wordAlpha;
      ctx.strokeStyle = decor;
      ctx.lineWidth = Math.max(2, fontPx * 0.06);
      ctx.beginPath();
      ctx.moveTo(lw.x, lw.y + yOff);
      ctx.lineTo(lw.x + lw.w, lw.y + yOff);
      ctx.stroke();
      ctx.restore();
    };
    if (style.underline || (emph && style.activeUnderline)) line(fontPx * 0.14);
    if (style.strikethrough) line(-fontPx * 0.26);

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
    const p = clamp01((time - word.start) / Math.max(0.03, (style.wordStaggerMs || 120) / 1000));
    return {
      hidden: false,
      scale: a === "reveal" ? easeOutBack(Math.min(1, p * 1.4)) : 0.9 + 0.1 * easeOut(p),
      dx: 0,
      dy: 0,
      alpha: a === "typewriter" ? 1 : p,
    };
  }

  const p = clamp01((time - cue.start) / Math.max(0.05, (style.animInMs || 260) / 1000));
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
  if (!isEmphasised(word, time, style)) return 1;
  const base = style.activeScale || 1;
  if (style.emphasis === "keyword") return base;
  const dur = Math.max(0.08, word.end - word.start);
  const prog = clamp01((time - word.start) / dur);
  let scale = 1 + (base - 1) * easeOut(prog);
  if (style.activePunch > 0) {
    // scale spike on onset, decaying over ~0.25s
    const punchP = clamp01((time - word.start) / 0.25);
    scale += style.activePunch * (1 - easeOut(punchP));
  }
  return scale;
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
  // gradient endpoints honour fillGradientDir (v = top→bottom, h = left→right)
  const grad = (a: string, b: string): CanvasGradient => {
    const g =
      style.fillGradientDir === "h"
        ? ctx.createLinearGradient(lw.x, 0, lw.x + lw.w, 0)
        : ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  if (emph && style.highlightMode === "box") return style.activeBoxTextColor;
  if (emph && style.highlightMode !== "box") {
    if (style.activeWordColor2) return grad(style.activeWordColor, style.activeWordColor2);
    return style.activeWordColor;
  }
  if (!emph && style.emphasis === "keyword" && lw.word.highlight) {
    return style.highlightColor;
  }
  if (style.color2) return grad(style.color, style.color2);
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
  ctx.font = `${style.italic ? "italic " : ""}${style.fontWeight} ${fontPx}px ${style.fontFamily}`;
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${
      style.letterSpacing * fontPx
    }px`;
  } catch {
    /* node-canvas may not support it */
  }
}

/** Apply punctuation stripping + text-transform (falls back to legacy uppercase). */
function transformText(text: string, style: CaptionStyle): string {
  let out = text;
  if (style.punctuationStrip) out = out.replace(/[.,!?;:]+/g, "");
  const tt =
    style.textTransform && style.textTransform !== "none"
      ? style.textTransform
      : style.uppercase
        ? "upper"
        : "none";
  if (tt === "upper") return out.toUpperCase();
  if (tt === "lower") return out.toLowerCase();
  if (tt === "title") return out.replace(/\b\w/g, (c) => c.toUpperCase());
  return out;
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

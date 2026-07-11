/**
 * Background removal, in pure canvas math — no model, offline, instant.
 * Region-grows from the four corners, marking pixels within `tolerance` of a
 * corner's colour as background and clearing their alpha, then feathers the
 * edge. Ideal for solid / gradient / studio backgrounds (the "AI photo on a
 * plain backdrop" case). Also supports keying a specific picked colour.
 *
 * (Model-based matting for busy backgrounds is a later upgrade — kept out of
 * the bundle so this stays fast and dependency-free.)
 */

export interface BgRemoveOptions {
  /** 0..100 — colour distance allowed from the background seed */
  tolerance?: number;
  /** 0..4 — edge softening radius in px */
  feather?: number;
  /** optional explicit key colour [r,g,b]; default = the four corners */
  keyColor?: [number, number, number] | null;
}

/**
 * Returns a NEW RGBA buffer with background pixels made transparent.
 * Operates on raw data so it's unit-testable without a DOM.
 */
export function removeBackgroundData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  opts: BgRemoveOptions = {}
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  const tol = ((opts.tolerance ?? 30) / 100) * 765; // sum-of-abs across RGB (0..765)
  const bg = new Uint8Array(w * h);
  const idx = (x: number, y: number) => y * w + x;

  const seeds: [number, number, number][] = opts.keyColor
    ? [opts.keyColor]
    : [
        cornerColor(data, w, 0, 0),
        cornerColor(data, w, w - 1, 0),
        cornerColor(data, w, 0, h - 1),
        cornerColor(data, w, w - 1, h - 1),
      ];
  const startPoints: number[] = opts.keyColor
    ? allEdgePixels(w, h)
    : [idx(0, 0), idx(w - 1, 0), idx(0, h - 1), idx(w - 1, h - 1)];

  for (let s = 0; s < startPoints.length; s++) {
    const [sr, sg, sb] = seeds[Math.min(s, seeds.length - 1)];
    const stack = [startPoints[s]];
    while (stack.length) {
      const p = stack.pop() as number;
      if (bg[p]) continue;
      const o = p * 4;
      const d =
        Math.abs(data[o] - sr) + Math.abs(data[o + 1] - sg) + Math.abs(data[o + 2] - sb);
      if (d > tol) continue;
      bg[p] = 1;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - w);
      if (y < h - 1) stack.push(p + w);
    }
  }

  for (let i = 0; i < w * h; i++) out[i * 4 + 3] = bg[i] ? 0 : data[i * 4 + 3];

  const feather = Math.min(4, Math.max(0, Math.round(opts.feather ?? 1)));
  if (feather > 0) featherEdges(out, bg, w, h, feather);

  return out;
}

function cornerColor(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y: number
): [number, number, number] {
  const o = (y * w + x) * 4;
  return [data[o], data[o + 1], data[o + 2]];
}

function allEdgePixels(w: number, h: number): number[] {
  const pts: number[] = [];
  for (let x = 0; x < w; x++) {
    pts.push(x);
    pts.push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pts.push(y * w);
    pts.push(y * w + (w - 1));
  }
  return pts;
}

/** Soften alpha on foreground pixels that border the background. */
function featherEdges(
  out: Uint8ClampedArray,
  bg: Uint8Array,
  w: number,
  h: number,
  r: number
): void {
  const isEdge = (i: number, x: number, y: number) => {
    if (bg[i]) return false;
    if (x > 0 && bg[i - 1]) return true;
    if (x < w - 1 && bg[i + 1]) return true;
    if (y > 0 && bg[i - w]) return true;
    if (y < h - 1 && bg[i + w]) return true;
    return false;
  };
  const edges: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (isEdge(i, x, y)) edges.push(i);
    }
  }
  for (const i of edges) {
    const x = i % w;
    const y = (i / w) | 0;
    let bgN = 0;
    let total = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        total++;
        if (bg[ny * w + nx]) bgN++;
      }
    }
    const keep = 1 - bgN / Math.max(1, total);
    out[i * 4 + 3] = Math.round(out[i * 4 + 3] * (0.35 + 0.65 * keep));
  }
}

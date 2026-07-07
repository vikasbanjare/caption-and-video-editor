import type {
  CaptionStyle,
  AnimationKind,
  CaptionPosition,
  HighlightMode,
} from "./types";
import { RAW_TEMPLATES, CATEGORY_ORDER, type RawTemplate } from "./templates.data";

/**
 * The caption template catalog — every preset from the CutPilot Premiere plugin
 * (vikasbanjare/video · captions.js), mapped into the web engine's
 * {@link CaptionStyle}. 97 templates across the plugin's library categories,
 * shown as a visual gallery the user can pick from and then tweak.
 */

export interface StylePreset {
  id: string;
  label: string;
  category: string;
  tag: string;
  popularity: number;
  style: CaptionStyle;
}

const REF_H = 1080; // plugin font sizes are px on a ~1080-tall frame

// ---- colour helpers --------------------------------------------------------
function hexRgb(hex: string): [number, number, number] {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex: string): number {
  const [r, g, b] = hexRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function autoContrast(hex: string): string {
  return luminance(hex) > 0.55 ? "#111111" : "#FFFFFF";
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---- fonts -----------------------------------------------------------------
const SERIF = new Set(["Georgia", "Playfair Display", "Lora", "Merriweather", "Times New Roman"]);
const MONO = new Set(["JetBrains Mono", "Space Mono", "Roboto Mono", "Courier New"]);
const CURSIVE = new Set(["Pacifico", "Caveat", "Bradley Hand", "Comic Sans MS"]);
const q = (f: string) => (/\s/.test(f) ? `'${f}'` : f);

function cssFamily(font: string, fallbacks?: string[]): string {
  const generic = SERIF.has(font)
    ? "serif"
    : MONO.has(font)
      ? "monospace"
      : CURSIVE.has(font)
        ? "cursive"
        : "sans-serif";
  const list = [font, ...(fallbacks || [])].map(q);
  return `${list.join(", ")}, ${generic}`;
}

// Map the plugin's anim concept names → Pulse engine animations (ported 1:1).
function mapAnim(anim?: string): AnimationKind {
  switch (anim) {
    case "karaoke":
    case "color-sweep":
    case "box-snap":
      return "karaoke";
    case "reveal":
      return "reveal";
    case "typewriter":
      return "typewriter";
    case "fade":
      return "fade";
    case "slide":
      return "slide-up";
    case "glide":
      return "glide";
    case "scale":
      return "scale";
    case "zoom":
      return "zoom";
    case "zoompunch":
      return "zoompunch";
    case "bounce":
      return "bounce";
    case "wave":
      return "wave";
    case "shake":
      return "shake";
    case "glitch":
    case "glitch-in":
      return "glitch";
    case "whoosh":
      return "whoosh";
    case "blurdissolve":
      return "blurdissolve";
    case "none":
      return "none";
    default:
      return "pop"; // pop, pop-scale
  }
}

// Defaults for the extended customization fields — presets omit these, so they
// spread in first and any preset-set field below overrides. Keeps all 97
// templates rendering exactly as before while unlocking the full control set.
const EXTENDED_DEFAULTS = {
  italic: false,
  textTransform: "none" as const,
  textAlign: "center" as const,
  underline: false,
  strikethrough: false,
  fillGradientDir: "v" as const,
  textOpacity: 1,
  strokeOpacity: 1,
  strokes: [] as CaptionStyle["strokes"],
  shadowOffsetX: 0,
  shadowOffsetY: 0.045,
  longShadow: 0,
  longShadowAngle: 135,
  longShadowColor: "",
  glowRadius: 0,
  activeBounce: 0,
  activePunch: 0,
  activeUnderline: false,
  boxPadX: 0,
  boxPadY: 0,
  boxScope: "line" as const,
  rotation: 0,
  captionOpacity: 1,
  animInMs: 260,
  animOutMs: 100,
  wordStaggerMs: 120,
  exitAnimation: "fade" as const,
  punctuationStrip: false,
};

// ---- raw → CaptionStyle ----------------------------------------------------
function toStyle(t: RawTemplate): CaptionStyle {
  const fs = t.fontSize || 60;
  const fontScale = Math.min(0.13, Math.max(0.03, fs / REF_H));
  const hl = t.highlight || t.fill || "#FFFFFF";
  const hlMode: HighlightMode =
    t.highlightStyle === "box" ? "box" : t.highlightStyle === "bar" ? "bar" : "color";

  // glow: a bright colour = neon; a dark colour = soft shadow; none = readability shadow
  let glow = 0;
  let glowColor = "#000000";
  let shadowBlur = 0;
  let shadowColor = "rgba(0,0,0,0.55)";
  if (t.glow) {
    if (luminance(t.glow) >= 0.12) {
      glow = Math.min(1, Math.max(0.45, t.glowBlur ?? 0.7));
      glowColor = t.glow;
    } else {
      shadowBlur = Math.min(0.5, Math.max(0.2, t.glowBlur ?? 0.4));
      shadowColor = rgba(t.glow, 0.62);
    }
  } else if (!t.boxColor && !(t.stroke && (t.strokeWidth || 0) > 0)) {
    shadowBlur = 0.16;
  }

  const boxRadiusPx = t.boxRadius ?? (hlMode === "box" ? fs * 0.22 : fs * 0.2);
  const cornerRadius = Math.min(0.5, Math.max(0.06, boxRadiusPx / (fs * 0.9)));

  const wpc = t.wordsPerCue === 0 ? 6 : (t.wordsPerCue ?? 4);
  const layout = (t.layout || "bottom") as CaptionPosition;

  return {
    ...EXTENDED_DEFAULTS,
    preset: t.id,

    fontFamily: cssFamily(t.font, t.fallbackFonts),
    fontWeight: t.weight ?? 800,
    fontScale,
    uppercase: !!t.uppercase,
    letterSpacing: (t.letterSpacing ?? 0) / fs,
    lineHeight: 1.12,
    wordsPerCue: wpc,
    maxLines: t.maxLines ?? 0,

    color: t.fill || "#FFFFFF",
    color2: t.fill2 || "",
    gloss: !!t.glossy,
    strokeColor: t.stroke || "",
    strokeWidth: t.stroke ? (t.strokeWidth ?? 0) / fs : 0,
    shadowBlur,
    shadowColor,
    glow,
    glowColor,

    emphasis: t.keyword ? "keyword" : "spoken",
    highlightMode: hlMode,
    activeWordColor: hl,
    activeWordColor2: t.highlight2 || "",
    highlightColor: hl,
    activeBoxColor: hl,
    activeBoxTextColor: autoContrast(hl),
    activeScale: t.highlightScale ?? 1,
    upcomingOpacity: t.upcomingOpacity ?? 1,
    keywordFontFamily: t.highlightFont ? cssFamily(t.highlightFont) : "",
    keywordItalic: !!t.highlightItalic,

    animation: mapAnim(t.anim),
    position: layout,
    marginV: layout === "top" ? 0.1 : 0.14,
    maxWidth: t.maxLines === 1 ? 0.9 : 0.86,
    cornerRadius,
    offsetX: 0,
    offsetY: 0,

    backgroundColor: t.boxColor || "",
    boxColor2: t.boxColor2 || "",
    boxGradient: t.boxGradient || "",
    boxStops: t.boxStops || null,
    boxOpacity: t.boxOpacity ?? 1,
    boxPad: t.boxPad ?? 1,
    boxStroke: t.boxStroke || "",
    boxStrokeWidth: t.boxStroke ? (t.boxStrokeWidth ?? 0.05 * fs) / fs : 0,
    boxGlow: t.boxGlow || "",
    boxGlowBlur: t.boxGlowBlur ?? 0.4,
    box3d: t.box3d || "",
    box3dDepth: t.box3d ? (t.box3dDepth ?? 0.12 * fs) / fs : 0,
    boxGloss: t.boxGloss ?? 0,
    boxShadow: t.boxShadow || "",
    boxShadowBlur: t.boxShadowBlur ?? 0.4,
    boxShadowDY: (t.boxShadowDY ?? 0.1 * fs) / fs,
  };
}

function shortTag(category: string): string {
  return category.replace(/[⭐🔘]\s*/u, "");
}

export const PRESETS: StylePreset[] = RAW_TEMPLATES.map((t) => ({
  id: t.id,
  label: t.name,
  category: t.category,
  tag: shortTag(t.category),
  popularity: t.popularity ?? 60,
  style: toStyle(t),
}));

/** Categories that actually have templates, in the plugin's library order. */
export const CATEGORIES: string[] = CATEGORY_ORDER.filter((c) =>
  PRESETS.some((p) => p.category === c)
);

export const DEFAULT_PRESET =
  PRESETS.find((p) => p.id === "pro-spotlight") ?? PRESETS[0];

export function presetById(id: string): StylePreset {
  return PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
}

/** A fresh copy of a preset's style (so callers can mutate it freely). */
export function styleFromPreset(id: string): CaptionStyle {
  return { ...presetById(id).style };
}

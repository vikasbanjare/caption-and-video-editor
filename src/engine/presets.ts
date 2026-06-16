import type { CaptionStyle } from "./types";

/**
 * Premium caption template catalog — the styles short-form creators actually
 * use (Hormozi-style boxed keywords, karaoke fills, neon, etc.). Each is a
 * complete {@link CaptionStyle}; the UI shows them as a visual gallery and lets
 * the user tweak any field afterwards.
 */

export interface StylePreset {
  id: string;
  label: string;
  /** one-word vibe shown under the thumbnail */
  tag: string;
  style: CaptionStyle;
}

const base: CaptionStyle = {
  preset: "hormozi",
  fontFamily: "Montserrat, sans-serif",
  fontWeight: 900,
  fontScale: 0.072,
  color: "#ffffff",
  highlightColor: "#ffd400",
  activeWordColor: "#ffd400",
  strokeColor: "#000000",
  strokeWidth: 0.14,
  backgroundColor: "",
  uppercase: true,
  animation: "pop",
  position: "bottom",
  marginV: 0.2,
  maxWidth: 0.84,
  wordsPerCue: 4,
  lineHeight: 1.12,
  shadowBlur: 0.22,
  shadowColor: "rgba(0,0,0,0.5)",
  letterSpacing: 0,
  highlightMode: "color",
  activeBoxColor: "#ffd400",
  activeBoxTextColor: "#000000",
  glow: 0,
  glowColor: "#7c5cff",
  cornerRadius: 0.24,
};

function preset(
  id: string,
  label: string,
  tag: string,
  overrides: Partial<CaptionStyle>
): StylePreset {
  return { id, label, tag, style: { ...base, preset: id, ...overrides } };
}

export const PRESETS: StylePreset[] = [
  preset("hormozi", "Hormozi", "boxed keyword", {
    fontFamily: "Montserrat, sans-serif",
    highlightMode: "box",
    activeBoxColor: "#ffd400",
    activeBoxTextColor: "#000000",
    animation: "pop",
    wordsPerCue: 4,
  }),
  preset("beasty", "Beasty", "loud", {
    fontFamily: "'Archivo Black', sans-serif",
    fontWeight: 900,
    fontScale: 0.082,
    color: "#ffffff",
    highlightMode: "color",
    activeWordColor: "#22e06b",
    highlightColor: "#22e06b",
    strokeWidth: 0.16,
    animation: "bounce",
    wordsPerCue: 3,
  }),
  preset("karaoke", "Karaoke", "fill sync", {
    fontFamily: "Poppins, sans-serif",
    fontWeight: 800,
    uppercase: false,
    color: "#ffffff",
    activeWordColor: "#4f8bff",
    highlightMode: "color",
    animation: "karaoke",
    strokeColor: "#000000",
    strokeWidth: 0.1,
    wordsPerCue: 5,
  }),
  preset("neon", "Neon", "glow", {
    fontFamily: "Anton, sans-serif",
    fontWeight: 400,
    fontScale: 0.085,
    color: "#ffffff",
    highlightMode: "color",
    activeWordColor: "#37f0ff",
    highlightColor: "#37f0ff",
    strokeColor: "",
    strokeWidth: 0,
    shadowBlur: 0,
    glow: 0.8,
    glowColor: "#19b6ff",
    animation: "pop",
    wordsPerCue: 3,
  }),
  preset("poppink", "Pop Pink", "boxed", {
    fontFamily: "Poppins, sans-serif",
    fontWeight: 900,
    highlightMode: "box",
    activeBoxColor: "#ff3d7f",
    activeBoxTextColor: "#ffffff",
    animation: "pop",
    wordsPerCue: 4,
  }),
  preset("bebas", "Bebas", "tall caps", {
    fontFamily: "'Bebas Neue', sans-serif",
    fontWeight: 400,
    fontScale: 0.1,
    letterSpacing: 0.02,
    highlightMode: "box",
    activeBoxColor: "#ff4d4d",
    activeBoxTextColor: "#ffffff",
    strokeColor: "",
    strokeWidth: 0,
    animation: "slide-up",
    wordsPerCue: 4,
  }),
  preset("tiktok", "TikTok", "word-by-word", {
    fontFamily: "Poppins, sans-serif",
    fontWeight: 800,
    uppercase: false,
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.42)",
    strokeColor: "",
    strokeWidth: 0,
    shadowBlur: 0,
    highlightMode: "color",
    activeWordColor: "#ffd400",
    animation: "word-by-word",
    marginV: 0.12,
    wordsPerCue: 5,
    cornerRadius: 0.3,
  }),
  preset("clean", "Clean", "minimal", {
    fontFamily: "Inter, sans-serif",
    fontWeight: 700,
    fontScale: 0.05,
    uppercase: false,
    color: "#ffffff",
    highlightMode: "color",
    activeWordColor: "#ffffff",
    strokeColor: "",
    strokeWidth: 0,
    shadowBlur: 0.16,
    animation: "fade",
    marginV: 0.1,
    wordsPerCue: 7,
  }),
  preset("subtitle", "Subtitle", "classic", {
    fontFamily: "Inter, sans-serif",
    fontWeight: 600,
    fontScale: 0.045,
    uppercase: false,
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.62)",
    strokeColor: "",
    strokeWidth: 0,
    shadowBlur: 0,
    highlightMode: "color",
    activeWordColor: "#ffffff",
    animation: "none",
    marginV: 0.08,
    wordsPerCue: 9,
    cornerRadius: 0.18,
  }),
];

export const DEFAULT_PRESET = PRESETS[0]; // Hormozi

export function presetById(id: string): StylePreset {
  return PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
}

/** A fresh copy of a preset's style (so callers can mutate it freely). */
export function styleFromPreset(id: string): CaptionStyle {
  return { ...presetById(id).style };
}

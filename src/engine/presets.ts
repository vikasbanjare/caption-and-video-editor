import type { CaptionStyle } from "./types";

/**
 * Style preset catalog. Each preset is a complete {@link CaptionStyle}; the UI
 * lets the user pick one and then tweak individual fields. Ported in spirit
 * from the desktop panel's preset list (WEBSAASPLAN.md §1).
 */

export interface StylePreset {
  id: string;
  label: string;
  style: CaptionStyle;
}

const base: CaptionStyle = {
  preset: "clean",
  fontFamily:
    "Inter, 'Helvetica Neue', Arial, sans-serif",
  fontWeight: 800,
  fontScale: 0.065,
  color: "#ffffff",
  highlightColor: "#ffe14d",
  activeWordColor: "#ffe14d",
  strokeColor: "#000000",
  strokeWidth: 0.12,
  backgroundColor: "",
  uppercase: false,
  animation: "word-by-word",
  position: "bottom",
  marginV: 0.16,
  maxWidth: 0.86,
  wordsPerCue: 4,
  lineHeight: 1.15,
  shadowBlur: 0.18,
  shadowColor: "rgba(0,0,0,0.65)",
};

function preset(
  id: string,
  label: string,
  overrides: Partial<CaptionStyle>
): StylePreset {
  return { id, label, style: { ...base, preset: id, ...overrides } };
}

export const PRESETS: StylePreset[] = [
  preset("clean", "Clean", {
    animation: "fade",
    wordsPerCue: 6,
    fontWeight: 700,
    fontScale: 0.05,
  }),
  preset("hormozi", "Bold Pop", {
    animation: "pop",
    uppercase: true,
    fontWeight: 900,
    fontScale: 0.075,
    highlightColor: "#41e07a",
    activeWordColor: "#41e07a",
    strokeWidth: 0.16,
    wordsPerCue: 3,
  }),
  preset("karaoke", "Karaoke", {
    animation: "karaoke",
    fontWeight: 800,
    color: "#ffffff",
    activeWordColor: "#6d8bff",
    wordsPerCue: 5,
  }),
  preset("beast", "Beast", {
    animation: "slide-up",
    uppercase: true,
    fontWeight: 900,
    fontScale: 0.08,
    color: "#fff200",
    highlightColor: "#ff4d4d",
    activeWordColor: "#ff4d4d",
    strokeColor: "#000000",
    strokeWidth: 0.18,
    wordsPerCue: 3,
  }),
  preset("subtle", "Subtitle", {
    animation: "none",
    fontWeight: 600,
    fontScale: 0.045,
    backgroundColor: "rgba(0,0,0,0.55)",
    strokeColor: "",
    shadowBlur: 0,
    wordsPerCue: 8,
    marginV: 0.08,
  }),
];

export const DEFAULT_PRESET = PRESETS[1]; // "Bold Pop"

export function presetById(id: string): StylePreset {
  return PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET;
}

/** A fresh copy of a preset's style (so callers can mutate it freely). */
export function styleFromPreset(id: string): CaptionStyle {
  return { ...presetById(id).style };
}

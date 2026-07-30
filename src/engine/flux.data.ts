import type { RawTemplate } from "./templates.data";

/**
 * The plugin's MOGRT sections that live OUTSIDE captions.js — the animated
 * "Titles" templates and the premium "Flux" pack (Flux Apex/Echo/Halo/Orbit/
 * Prism/Pulse/Surge/Vector/Vortex). In Pulse-for-Premiere these are .mogrt
 * files, but the panel renders them through the SAME caption engine as a
 * resolved style (main.js · mogrtCardStyle / mapPresetToFlux), so they port
 * 1:1 into the web engine as premium templates. Signature colours match the
 * plugin (Flux Vector = electric blue, Flux Orbit = orange, Halo = blue box…).
 */

const TITLES: RawTemplate[] = [
  {
    id: "title-solid", name: "Solid Title", category: "Titles", popularity: 88,
    layout: "center", font: "Anton", fallbackFonts: ["Bebas Neue", "Arial Black"],
    fontSize: 132, weight: 900, uppercase: true, wordsPerCue: 3, anim: "reveal",
    fill: "#FFFFFF", stroke: null,
  },
  {
    id: "title-gradient", name: "Gradient Title", category: "Titles", popularity: 87,
    layout: "center", font: "Montserrat", fallbackFonts: ["Poppins"],
    fontSize: 122, weight: 900, uppercase: true, wordsPerCue: 3, anim: "pop-scale",
    fill: "#A78BFA", fill2: "#F472B6",
  },
  {
    id: "title-threeline", name: "Three-Line Title", category: "Titles", popularity: 84,
    layout: "center", font: "Montserrat", fallbackFonts: ["Poppins"],
    fontSize: 92, weight: 800, uppercase: false, wordsPerCue: 6, maxLines: 3,
    anim: "slide", fill: "#FFFFFF",
  },
  {
    id: "title-shorts", name: "Shorts Stack", category: "Titles", popularity: 86,
    layout: "center", font: "Poppins", fallbackFonts: ["Inter"],
    fontSize: 92, weight: 800, uppercase: true, wordsPerCue: 5, maxLines: 3,
    anim: "pop", fill: "#FFFFFF", highlight: "#FFD400", keyword: true, highlightStyle: "color",
  },
];

const FLUX: RawTemplate[] = [
  {
    id: "flux-apex", name: "Flux Apex", category: "✦ Flux", popularity: 97,
    layout: "center", font: "Anton", fallbackFonts: ["Bebas Neue"],
    fontSize: 124, weight: 900, uppercase: true, wordsPerCue: 3, anim: "reveal",
    fill: "#FFFFFF", upcomingOpacity: 0.32, highlightScale: 1.06,
  },
  {
    id: "flux-echo", name: "Flux Echo", category: "✦ Flux", popularity: 96,
    layout: "center", font: "Montserrat", fallbackFonts: ["Poppins"],
    fontSize: 112, weight: 900, uppercase: true, wordsPerCue: 3, anim: "reveal",
    fill: "#FFFFFF", glow: "#0A0A12", glowBlur: 0.5,
  },
  {
    id: "flux-halo", name: "Flux Halo", category: "✦ Flux", popularity: 96,
    layout: "bottom", font: "Inter", fallbackFonts: ["Helvetica", "Arial"],
    fontSize: 66, weight: 700, uppercase: false, wordsPerCue: 4, anim: "box-snap",
    fill: "#FFFFFF", stroke: "#000000", strokeWidth: 6,
    highlight: "#2D7CFF", highlightStyle: "box", boxRadius: 14,
  },
  {
    id: "flux-halo-pro", name: "Flux Halo Pro", category: "✦ Flux", popularity: 95,
    layout: "bottom", font: "Inter", fallbackFonts: ["Helvetica", "Arial"],
    fontSize: 64, weight: 700, uppercase: false, wordsPerCue: 6, anim: "box-snap",
    fill: "#FFFFFF", stroke: "#000000", strokeWidth: 6,
    highlight: "#2D7CFF", highlightStyle: "box", boxRadius: 16,
  },
  {
    id: "flux-orbit", name: "Flux Orbit", category: "✦ Flux", popularity: 95,
    layout: "center", font: "Anton", fallbackFonts: ["Bebas Neue"],
    fontSize: 122, weight: 900, uppercase: true, wordsPerCue: 3, anim: "zoom",
    fill: "#FFFFFF", glow: "#FF7A1A", glowBlur: 0.72,
  },
  {
    id: "flux-prism", name: "Flux Prism", category: "✦ Flux", popularity: 94,
    layout: "center", font: "Poppins", fallbackFonts: ["Inter"],
    fontSize: 82, weight: 800, uppercase: true, wordsPerCue: 4, anim: "pop",
    fill: "#0B0B12", boxColor: "#FFFFFF", boxRadius: 60, boxPad: 1.5,
  },
  {
    id: "flux-pulse", name: "Flux Pulse", category: "✦ Flux", popularity: 96,
    layout: "center", font: "Montserrat", fallbackFonts: ["Poppins"],
    fontSize: 112, weight: 900, uppercase: true, wordsPerCue: 3, anim: "zoompunch",
    fill: "#FFFFFF", glow: "#3B6BF5", glowBlur: 0.55, highlightScale: 1.18,
  },
  {
    id: "flux-surge", name: "Flux Surge", category: "✦ Flux", popularity: 94,
    layout: "center", font: "Anton", fallbackFonts: ["Bebas Neue"],
    fontSize: 122, weight: 900, uppercase: true, wordsPerCue: 3, anim: "whoosh",
    fill: "#FFFFFF",
  },
  {
    id: "flux-vector", name: "Flux Vector", category: "✦ Flux", popularity: 95,
    layout: "center", font: "Montserrat", fallbackFonts: ["Poppins"],
    fontSize: 112, weight: 900, uppercase: true, wordsPerCue: 3, anim: "reveal",
    fill: "#FFFFFF", glow: "#3B82F6", glowBlur: 0.78,
  },
  {
    id: "flux-vortex", name: "Flux Vortex", category: "✦ Flux", popularity: 94,
    layout: "center", font: "Anton", fallbackFonts: ["Bebas Neue"],
    fontSize: 118, weight: 900, uppercase: true, wordsPerCue: 2, anim: "glitch",
    fill: "#FFFFFF", highlight: "#00E5FF", highlightStyle: "color", keyword: true,
  },
];

/** Flux first (premium), then Titles — both shown ahead of the caption library. */
export const FLUX_TEMPLATES: RawTemplate[] = [...FLUX, ...TITLES];

/** Category order for the extra sections (prepended in presets.ts). */
export const FLUX_CATEGORY_ORDER: string[] = ["✦ Flux", "Titles"];

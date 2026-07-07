/**
 * Color grade — applied as a CSS/canvas filter string so the SAME grade drives
 * both the live monitor (filter on the <video>) and the burn-in export
 * (ctx.filter before drawing each frame). Preview === export.
 *
 * Exposure / contrast / saturation are faithful filter primitives. "Looks" are
 * one-tap filmic grades. True temperature/LUT grading arrives with the WebGL
 * pass; these primitives are what CSS/canvas filters can express exactly.
 */

export type LookId = "none" | "warm" | "cool" | "punch" | "mono" | "film";

export interface ColorGrade {
  exposure: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  look: LookId;
}

export const DEFAULT_GRADE: ColorGrade = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  look: "none",
};

export const LOOKS: { id: LookId; label: string; filter: string }[] = [
  { id: "none", label: "None", filter: "" },
  { id: "warm", label: "Warm", filter: "sepia(.28) saturate(1.15) brightness(1.02)" },
  { id: "cool", label: "Cool", filter: "hue-rotate(-8deg) saturate(1.08) brightness(1.02) contrast(1.03)" },
  { id: "punch", label: "Punch", filter: "contrast(1.16) saturate(1.35)" },
  { id: "mono", label: "Mono", filter: "grayscale(1) contrast(1.08)" },
  { id: "film", label: "Film", filter: "sepia(.35) contrast(.94) saturate(1.12) brightness(1.03)" },
];

/** Build the CSS/canvas filter string for a grade (or "none" if neutral). */
export function gradeFilter(g: ColorGrade): string {
  const b = (1 + (g.exposure / 100) * 0.5).toFixed(3);
  const c = (1 + (g.contrast / 100) * 0.6).toFixed(3);
  const s = Math.max(0, 1 + g.saturation / 100).toFixed(3);
  let f = `brightness(${b}) contrast(${c}) saturate(${s})`;
  const look = LOOKS.find((l) => l.id === g.look);
  if (look && look.filter) f += " " + look.filter;
  return f;
}

export function isGradeActive(g: ColorGrade): boolean {
  return (
    g.exposure !== 0 ||
    g.contrast !== 0 ||
    g.saturation !== 0 ||
    g.look !== "none"
  );
}

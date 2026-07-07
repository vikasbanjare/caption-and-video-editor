/**
 * Shared cue / style schema — the single source of truth used by the browser
 * preview AND (later) the server render worker ("preview === export").
 */

export interface Word {
  text: string;
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  /** the auto-detected keyword of its cue (emphasised by keyword templates) */
  highlight?: boolean;
}

export interface Cue {
  id: string;
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface Transcript {
  cues: Cue[];
  language?: string;
}

/** Pulse's built-in animation catalog (ported from the Premiere plugin). */
export type AnimationKind =
  | "none"
  | "fade"
  | "pop"
  | "scale"
  | "zoom"
  | "zoompunch"
  | "bounce"
  | "slide-up"
  | "glide"
  | "wave"
  | "shake"
  | "glitch"
  | "whoosh"
  | "blurdissolve"
  | "karaoke"
  | "reveal"
  | "word-by-word"
  | "typewriter";

export type CaptionPosition = "top" | "center" | "bottom";

/** How the emphasised word is drawn. */
export type HighlightMode = "color" | "box" | "bar";

/** Which word gets emphasised: the currently-spoken one, or the cue's keyword. */
export type EmphasisMode = "spoken" | "keyword";

export type TextTransform = "none" | "upper" | "lower" | "title";
export type TextAlign = "left" | "center" | "right";
export type ExitAnimation = "none" | "fade" | "slide" | "zoom" | "blur";

/** One stroke in a stacked-outline stack (Hormozi/Beast style). */
export interface StrokeLayer {
  width: number; // fraction of font px
  color: string;
  opacity: number; // 0..1
}

/**
 * Full caption style. Sizes that must match between browser preview and server
 * render are fractions of the canvas (resolution-independent). Superset of the
 * CutPilot Premiere plugin's preset schema so every ported template renders.
 */
export interface CaptionStyle {
  preset: string;

  // --- type ---
  fontFamily: string;
  fontWeight: number;
  fontScale: number; // fraction of canvas height
  uppercase: boolean;
  letterSpacing: number; // em
  lineHeight: number;
  wordsPerCue: number;
  /** 0 = wrap freely; 1 = force one line and shrink to fit (button pills) */
  maxLines: number;

  // --- fill ---
  color: string;
  /** vertical gradient bottom colour for the text ("" = solid) */
  color2: string;
  /** subtle top sheen on the text */
  gloss: boolean;
  strokeColor: string; // "" disables
  strokeWidth: number; // fraction of font px
  shadowBlur: number; // fraction of font px
  shadowColor: string;
  glow: number; // 0..1 neon glow
  glowColor: string;

  // --- emphasis ---
  emphasis: EmphasisMode;
  highlightMode: HighlightMode;
  /** colour for the emphasised word (color/bar modes) */
  activeWordColor: string;
  /** optional gradient partner for the emphasised word ("" = solid) */
  activeWordColor2: string;
  /** colour for keyword-highlighted words when not the active one */
  highlightColor: string;
  /** filled pill behind the emphasised word (box mode) */
  activeBoxColor: string;
  activeBoxTextColor: string;
  /** scale applied to the emphasised word */
  activeScale: number;
  /** opacity of not-yet-spoken words (reveal effect); 1 = off */
  upcomingOpacity: number;
  /** optional different font for the keyword ("" = same) */
  keywordFontFamily: string;
  keywordItalic: boolean;

  animation: AnimationKind;
  position: CaptionPosition;
  marginV: number; // fraction of height
  maxWidth: number; // fraction of width
  cornerRadius: number; // fraction of font px (pills/boxes)
  /** free-drag offset from the anchored position, as fractions of the frame */
  offsetX: number;
  offsetY: number;

  // --- line background box / button pill ---
  backgroundColor: string; // "" = none
  boxColor2: string; // gradient partner
  boxGradient: "" | "v" | "h";
  boxStops: Array<[number, string]> | null;
  boxOpacity: number;
  boxPad: number; // padding multiplier
  boxStroke: string;
  boxStrokeWidth: number; // fraction of font px
  boxGlow: string;
  boxGlowBlur: number; // fraction of font px
  box3d: string;
  box3dDepth: number; // fraction of font px
  boxGloss: number; // 0..1 sheen on the box
  boxShadow: string;
  boxShadowBlur: number; // fraction of font px
  boxShadowDY: number; // fraction of font px

  // --- extended typography ---
  italic: boolean;
  textTransform: TextTransform; // overrides `uppercase` when not "none"
  textAlign: TextAlign;
  underline: boolean;
  strikethrough: boolean;

  // --- extended fill / decoration ---
  fillGradientDir: "v" | "h";
  textOpacity: number; // 0..1
  strokeOpacity: number; // 0..1
  /** stacked outlines drawn largest→smallest behind the fill ("" list = none) */
  strokes: StrokeLayer[];

  // --- extended shadow / glow ---
  shadowOffsetX: number; // fraction of font px
  shadowOffsetY: number; // fraction of font px
  longShadow: number; // length, fraction of font px (0 = off)
  longShadowAngle: number; // degrees
  longShadowColor: string; // "" = derive
  glowRadius: number; // fraction of font px (0 = derive from glow)

  // --- extended emphasis ---
  activeBounce: number; // amplitude, fraction of font px
  activePunch: number; // extra scale spike on word onset (0 = off)
  activeUnderline: boolean;

  // --- extended box ---
  boxPadX: number; // fraction of font px (0 = use boxPad)
  boxPadY: number; // fraction of font px (0 = use boxPad)
  boxScope: "line" | "word" | "block";

  // --- transform ---
  rotation: number; // degrees
  captionOpacity: number; // 0..1, whole block

  // --- animation timing ---
  animInMs: number;
  animOutMs: number;
  wordStaggerMs: number;
  exitAnimation: ExitAnimation;

  // --- effects ---
  punctuationStrip: boolean;
}

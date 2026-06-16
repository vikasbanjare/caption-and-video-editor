/**
 * Shared cue / style schema — the single source of truth used by the browser
 * preview AND (later) the server render worker. Keeping this framework-agnostic
 * is what lets "preview === export" (see WEBSAASPLAN.md §1, §6 Phase 0).
 */

/** One word with its own timing — the basis for karaoke / word-by-word sync. */
export interface Word {
  text: string;
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  /** highlighted (keyword) word — drawn in the highlight color */
  highlight?: boolean;
}

/** A caption cue: a short run of words shown together on screen. */
export interface Cue {
  id: string;
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  text: string;
  words: Word[];
}

/** A full transcript is just an ordered list of cues. */
export interface Transcript {
  cues: Cue[];
  /** BCP-47-ish language tag, e.g. "en", "hi". */
  language?: string;
}

export type AnimationKind =
  | "none"
  | "fade"
  | "pop"
  | "slide-up"
  | "karaoke"
  | "word-by-word";

export type CaptionPosition = "top" | "center" | "bottom";

/**
 * Style for a project's captions. All sizes that must look identical between
 * the browser preview and a server render are expressed as *fractions of the
 * canvas* (resolution independent) rather than absolute pixels.
 */
export interface CaptionStyle {
  /** id of the preset this style was derived from (for the UI) */
  preset: string;
  fontFamily: string;
  fontWeight: number;
  /** font size as a fraction of canvas height (e.g. 0.06 = 6% of height) */
  fontScale: number;
  /** base text color */
  color: string;
  /** color for keyword-highlighted words */
  highlightColor: string;
  /** color for the currently-spoken word (karaoke / word-by-word) */
  activeWordColor: string;
  /** outline color; "" disables the outline */
  strokeColor: string;
  /** outline width as a fraction of the font pixel size */
  strokeWidth: number;
  /** background pill color (rgba/hex); "" disables the box */
  backgroundColor: string;
  uppercase: boolean;
  animation: AnimationKind;
  position: CaptionPosition;
  /** vertical margin from the chosen edge, as a fraction of height */
  marginV: number;
  /** max text width as a fraction of canvas width (for wrapping) */
  maxWidth: number;
  /** how many words to group into one cue when regrouping */
  wordsPerCue: number;
  /** line height multiplier */
  lineHeight: number;
  /** drop-shadow blur as a fraction of the font pixel size */
  shadowBlur: number;
  shadowColor: string;
}

import type { Cue, CaptionStyle } from "@/engine";

/**
 * ASS (Advanced SubStation Alpha) export — a faithful TypeScript port of the
 * Pulse plugin's ass.js. ASS carries real styling (font, size, fill,
 * per-word highlight, outline, shadow, position, bold/italic, letter-spacing)
 * and word-level karaoke timing, so a styled Pulse caption round-trips into
 * DaVinci Resolve / Premiere (via libass / ffmpeg) — not just plain text like
 * SRT. Pure functions, unit-tested.
 */

function pad(n: number, w: number): string {
  let s = String(Math.floor(n));
  while (s.length < w) s = "0" + s;
  return s;
}

/** seconds → ASS time H:MM:SS.cc (centiseconds). */
export function assTime(sec: number): string {
  let cs = Math.round((sec > 0 ? sec : 0) * 100);
  const h = Math.floor(cs / 360000);
  cs -= h * 360000;
  const m = Math.floor(cs / 6000);
  cs -= m * 6000;
  const s = Math.floor(cs / 100);
  cs -= s * 100;
  return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`;
}

/** "#RRGGBB" (or rgb()) → ASS "&HBBGGRR&" (ASS colour is BGR). */
export function assColor(input: string): string {
  let hex = String(input == null ? "#FFFFFF" : input);
  const m = hex.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(",").map((n) => parseInt(n.trim(), 10) || 0);
    const h = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
    hex = `${h(r)}${h(g)}${h(b)}`;
  } else {
    hex = hex.replace(/[^0-9a-fA-F]/g, "");
  }
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length < 6) hex = (hex + "FFFFFF").slice(0, 6);
  const r = hex.substr(0, 2), g = hex.substr(2, 2), b = hex.substr(4, 2);
  return "&H" + (b + g + r).toUpperCase() + "&";
}

/** Neutralise braces (ASS override delimiters) and hard-break newlines. */
export function assText(t: string): string {
  return String(t == null ? "" : t)
    .replace(/[{}]/g, (c) => (c === "{" ? "(" : ")"))
    .replace(/\r?\n/g, "\\N");
}

/** First real font family from a CSS font stack, unquoted. */
function primaryFont(family: string): string {
  const first = (family || "Arial").split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  return first || "Arial";
}

export interface AssOptions {
  width?: number;
  height?: number;
}

/**
 * Build a complete .ass document from word-timed cues + a CaptionStyle.
 * Emits one Dialogue per active-word state: the whole caption shows with the
 * spoken word recoloured to the highlight and a quick scale "pop".
 */
export function buildAss(
  cues: Cue[],
  style: CaptionStyle,
  opts: AssOptions = {}
): string {
  const W = opts.width || 1080;
  const H = opts.height || 1920;
  const font = primaryFont(style.fontFamily);
  const fontSize = Math.round((style.fontScale || 0.06) * H);
  const fill = assColor(style.color || "#FFFFFF");
  const hi = assColor(style.activeWordColor || style.highlightColor || "#FFD400");
  const outlineCol = assColor(style.strokeColor || "#000000");
  const outline = style.strokeColor && style.strokeWidth > 0
    ? Math.max(1, Math.round(style.strokeWidth * fontSize))
    : Math.max(2, Math.round(fontSize * 0.05));
  const shadow = style.shadowBlur > 0 ? Math.max(1, Math.round(style.shadowBlur * fontSize)) : 0;
  const bold = (style.fontWeight || 700) >= 600 ? -1 : 0;
  const italic = style.italic ? -1 : 0;
  const spacing = Math.round((style.letterSpacing || 0) * fontSize);
  const marginLR = Math.round(W * (1 - (style.maxWidth || 0.86)) / 2);
  const marginV = Math.round((style.marginV || 0.12) * H);
  // ASS numpad alignment: center column = 8 (top) / 5 (middle) / 2 (bottom)
  const align = style.position === "top" ? 8 : style.position === "center" ? 5 : 2;
  const allCaps =
    style.textTransform === "upper" || (style.textTransform === "none" && style.uppercase);
  const popScale = Math.round((style.activeScale && style.activeScale > 1 ? style.activeScale : 1.16) * 100);
  const anim = style.animation === "none" || style.animation === "fade" ? "none" : "pop";
  const reveal = ["word-by-word", "typewriter", "reveal"].includes(style.animation);

  const head = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: " + W,
    "PlayResY: " + H,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, " +
      "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, " +
      "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Pulse," + font + "," + fontSize + "," + fill + "," + hi + "," + outlineCol + ",&H64000000&," +
      bold + "," + italic + ",0,0,100,100," + spacing + ",0,1," + outline + "," + shadow + "," +
      align + "," + marginLR + "," + marginLR + "," + marginV + ",1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const caseIt = (s: string) => (allCaps ? s.toUpperCase() : s);
  const lines: string[] = [];

  for (const cue of cues) {
    const ws =
      cue.words && cue.words.length
        ? cue.words
        : [{ text: (cue.text || "").replace(/\s+/g, " ").trim(), start: cue.start, end: cue.end }];
    if (!ws.length || (ws.length === 1 && !ws[0].text)) continue;

    for (let k = 0; k < ws.length; k++) {
      const start = +ws[k].start || 0;
      let end = k + 1 < ws.length ? +ws[k + 1].start || 0 : +ws[k].end || 0;
      if (!(end > start)) end = start + 0.04;
      const parts: string[] = [];
      for (let j = 0; j < ws.length; j++) {
        if (reveal && j > k) break;
        const word = assText(caseIt(ws[j].text));
        if (j === k) {
          const pop = anim === "pop"
            ? `\\fscx${popScale}\\fscy${popScale}\\t(0,90,\\fscx100\\fscy100)`
            : "";
          parts.push("{\\1c" + hi + pop + "}" + word + "{\\1c" + fill + "}");
        } else {
          parts.push(word);
        }
      }
      lines.push(
        "Dialogue: 0," + assTime(start) + "," + assTime(end) + ",Pulse,,0,0,0,," + parts.join(" ")
      );
    }
  }

  return head.join("\n") + "\n" + lines.join("\n") + "\n";
}

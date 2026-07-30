/**
 * Hinglish support: transliterate Devanagari (Hindi) script to Latin letters so
 * Hindi speech can be shown as the Roman "Hinglish" the audience reads
 * (WEBSAASPLAN.md §1, §4.3). This is a pragmatic phonetic mapping, not a formal
 * ISO transliteration — it's tuned to look natural in burned-in captions.
 *
 * Conjuncts (e.g. क्ष, ज्ञ) are encoded in Unicode as consonant + virama +
 * consonant, so the virama branch handles them naturally — no special cases.
 */

// Independent vowels
const INDEPENDENT_VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
};

// Vowel signs (matras) that attach to a consonant
const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

// Consonants — value is the consonant sound WITHOUT the inherent "a".
const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h",
};

// Nukta (U+093C) variants — Perso-Arabic loan sounds. Input is NFC-normalized
// first, which decomposes the precomposed letters (U+0958–095F are composition
// exclusions), so every nukta letter arrives as base consonant + combining
// nukta and is resolved here by lookahead. A 2-char map key can never match
// the 1-char loop read — that's the bug this replaces.
const NUKTA = "़";
const NUKTA_SOUNDS: Record<string, string> = {
  "क": "q", "ख": "kh", "ग": "gh", "ज": "z",
  "ड": "r", "ढ": "rh", "फ": "f", "य": "y",
};

const SIGNS: Record<string, string> = {
  "ं": "n", // anusvara
  "ः": "h", // visarga
  "ँ": "n", // chandrabindu
  "ऽ": "", // avagraha
};

const VIRAMA = "्";
const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

const isDevanagari = (ch: string) => ch >= "ऀ" && ch <= "ॿ";

/**
 * Convert a string that may contain Devanagari into Latin letters. Non-Devanagari
 * characters (Latin, punctuation, spaces, emoji) pass through untouched, so mixed
 * Hinglish like "ये video मस्त है" romanizes cleanly.
 */
export function devanagariToLatin(input: string): string {
  // NFC decomposes precomposed nukta letters (क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़) to
  // base + U+093C, so a single lookahead below covers both encodings.
  input = input.normalize("NFC");
  let out = "";
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (!isDevanagari(ch)) {
      out += ch;
      i++;
      continue;
    }

    if (CONSONANTS[ch]) {
      let j = i + 1;
      if (input[j] === NUKTA) {
        out += NUKTA_SOUNDS[ch] ?? CONSONANTS[ch];
        j++;
      } else {
        out += CONSONANTS[ch];
      }
      if (input[j] === VIRAMA) {
        // half consonant (start of a conjunct) — no vowel, let the next
        // consonant be emitted on the following pass.
        i = j + 1;
        continue;
      }
      const matra = input[j] !== undefined ? MATRAS[input[j]] : undefined;
      if (matra !== undefined) {
        out += matra;
        j++;
      } else {
        // Inherent vowel, with word-final schwa deletion so "भारत" → "bhaarat"
        // (not "bhaarata"). Heuristic: keep the inherent "a" only when another
        // Devanagari letter/sign follows (medial); drop it at a word boundary.
        const nx = input[j];
        const medial =
          nx !== undefined &&
          (CONSONANTS[nx] !== undefined ||
            INDEPENDENT_VOWELS[nx] !== undefined ||
            SIGNS[nx] !== undefined);
        if (medial) out += "a";
      }
      // optional trailing nasal / visarga
      if (input[j] !== undefined && SIGNS[input[j]] !== undefined) {
        out += SIGNS[input[j]];
        j++;
      }
      i = j;
      continue;
    }

    if (INDEPENDENT_VOWELS[ch]) {
      out += INDEPENDENT_VOWELS[ch];
      i++;
      continue;
    }
    if (MATRAS[ch] !== undefined) {
      out += MATRAS[ch];
      i++;
      continue;
    }
    if (SIGNS[ch] !== undefined) {
      out += SIGNS[ch];
      i++;
      continue;
    }
    if (DEVANAGARI_DIGITS[ch]) {
      out += DEVANAGARI_DIGITS[ch];
      i++;
      continue;
    }
    if (ch === "।" || ch === "॥") {
      out += ".";
      i++;
      continue;
    }

    // Unknown Devanagari mark — drop it.
    i++;
  }

  // Collapse runs of whitespace that may appear from dropped marks.
  return out.replace(/[ \t]+/g, " ");
}

/** True if the string contains any Devanagari characters. */
export function hasDevanagari(input: string): boolean {
  for (const ch of input) if (isDevanagari(ch)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Urdu / Arabic-script → Latin. Whisper often decodes Hindustani speech as Urdu
// (Hindi and Urdu are the same spoken language), so a Hinglish creator gets
// right-to-left Arabic script. This pragmatic phonetic map transliterates it to
// Latin so it reads as the Roman "Hinglish"/"Urdulish" the audience expects —
// and, being Latin, it lays out left-to-right in the caption renderer.

const ARABIC_MAP: Record<string, string> = {
  "ا": "a", "آ": "aa", "أ": "a", "إ": "i", "ٱ": "a",
  "ب": "b", "پ": "p", "ت": "t", "ٹ": "t", "ث": "s",
  "ج": "j", "چ": "ch", "ح": "h", "خ": "kh",
  "د": "d", "ڈ": "d", "ذ": "z", "ر": "r", "ڑ": "r",
  "ز": "z", "ژ": "zh", "س": "s", "ش": "sh", "ص": "s",
  "ض": "z", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh",
  "ف": "f", "ق": "q", "ک": "k", "ك": "k", "گ": "g",
  "ل": "l", "م": "m", "ن": "n", "ں": "n", "و": "o",
  "ؤ": "o", "ہ": "h", "ھ": "h", "ة": "h", "ه": "h",
  "ء": "", "ئ": "y", "ی": "i", "ي": "i", "ے": "e", "ى": "a",
  // short-vowel diacritics
  "َ": "a", "ِ": "i", "ُ": "u", "ً": "an", "ٍ": "in", "ٌ": "un",
  "ْ": "", "ّ": "", "ٰ": "a",
  // punctuation & digits
  "۔": ".", "،": ",", "؟": "?", "٪": "%", "ـ": "",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

const isArabic = (ch: string) => {
  const c = ch.codePointAt(0) || 0;
  return (
    (c >= 0x0600 && c <= 0x06ff) ||
    (c >= 0x0750 && c <= 0x077f) ||
    (c >= 0xfb50 && c <= 0xfdff) ||
    (c >= 0xfe70 && c <= 0xfeff)
  );
};

/** True if the string contains any Arabic-script (e.g. Urdu) characters. */
export function hasArabic(input: string): boolean {
  for (const ch of input) if (isArabic(ch)) return true;
  return false;
}

/** Transliterate Arabic-script (Urdu) to Latin; other characters pass through. */
export function arabicToLatin(input: string): string {
  let out = "";
  for (const ch of input) {
    if (ARABIC_MAP[ch] !== undefined) out += ARABIC_MAP[ch];
    else if (isArabic(ch)) continue; // unknown Arabic mark — drop
    else out += ch;
  }
  return out.replace(/[ \t]+/g, " ").trim();
}

/** True if the string contains any non-Latin Indic/Urdu script. */
export function hasIndicScript(input: string): boolean {
  return hasDevanagari(input) || hasArabic(input);
}

/**
 * Romanize whichever non-Latin script is present (Devanagari or Urdu/Arabic)
 * to Latin, leaving English words, numbers, punctuation and emoji untouched.
 */
export function toLatin(input: string): string {
  let out = input;
  if (hasDevanagari(out)) out = devanagariToLatin(out);
  if (hasArabic(out)) out = arabicToLatin(out);
  return out;
}

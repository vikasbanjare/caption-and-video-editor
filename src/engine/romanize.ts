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
  "ड़": "r", "ढ़": "rh", "फ़": "f", "ज़": "z",
  "क़": "q", "ग़": "gh", "ख़": "kh",
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
      out += CONSONANTS[ch];
      let j = i + 1;
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

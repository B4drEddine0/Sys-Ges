// Arabic text normalization shared by the word/answer-matching games (Harf, Brain
// Battle, …). Deliberately conservative — see the warning on normalizeArabic below.

/**
 * Normalizes an Arabic string for loose matching: strips diacritics/tatweel, collapses
 * the four hamza-on-alef forms to bare alef, treats alef maqsura (ى) as ya and ta marbuta
 * (ة) as ha (common typing/spelling variation), and collapses whitespace.
 *
 * Deliberately does NOT touch hamza-on-waw/ya (ؤ/ئ) or standalone hamza (ء) — those more
 * often distinguish genuinely different words, so merging them risks false "correct"
 * matches rather than just tolerating typos.
 */
export function normalizeArabic(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips a leading "ال" (the definite article) when it's not the whole word. */
export function stripArticle(s: string): string {
  return s.startsWith('ال') && s.length > 3 ? s.slice(2) : s;
}

/** Additionally strips common punctuation — useful for free-text trivia/riddle answers. */
export function normalizeAnswerText(s: string): string {
  return normalizeArabic(s)
    .replace(/[،؛؟!.,?!"'’“”«»ـ]/g, '')
    .replace(/\s+/g, '');
}

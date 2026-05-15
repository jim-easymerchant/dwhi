/**
 * Cleans a raw transcript into a deterministic shape the intent parser can
 * match against. Lowercased, punctuation stripped, basic filler removed,
 * common contractions expanded.
 *
 * Intentionally conservative — we don't want to strip a token that could
 * actually be the item name (e.g. "honey", "may").
 */

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bwe're\b/g, 'we are'],
  [/\bdon't\b/g, 'do not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bi'm\b/g, 'i am'],
  [/\bi'?ve\b/g, 'i have'],
];

const STRIP_FILLER = /\b(uh|um|like|just|please|hey)\b/g;

export function normalizeTranscript(input: string): string {
  if (!input) return '';
  let s = input.toLowerCase();

  // Expand contractions first so "we're out of" → "we are out of" → intent.
  for (const [pattern, replacement] of CONTRACTIONS) {
    s = s.replace(pattern, replacement);
  }

  // Drop end-of-sentence punctuation; keep apostrophes & hyphens within
  // words so "paper-towels" or "o'brien" survive (unlikely but cheap).
  s = s.replace(/[.?!,;:"]+/g, ' ');

  // Strip filler tokens.
  s = s.replace(STRIP_FILLER, ' ');

  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Heuristic, regex-driven intent extraction. Deterministic, fast, and
 * explainable — there's no LLM in this path.
 *
 * Order of precedence:
 *   1. ASK   — questions / interrogatives
 *   2. OUT   — depletion verbs ("remove", "we are out of", "used up")
 *   3. IN    — acquisition verbs ("add", "bought", "got")
 *   4. UNKNOWN
 *
 * After an intent fires, the parser:
 *   - pulls the first numeric/number-word as quantity (default 1)
 *   - strips the matched intent phrase + the quantity span + filler
 *     articles to leave the item-name residual.
 */

import { normalizeTranscript } from './transcriptNormalizer';
import type { ParsedVoiceCommand, VoiceIntentType } from './voiceTypes';

// ---- intent patterns -----------------------------------------------------

interface PatternBinding {
  type: VoiceIntentType;
  patterns: RegExp[];
}

// IMPORTANT: keep these checks in order. The first hit wins.
const INTENT_PATTERNS: PatternBinding[] = [
  {
    type: 'ASK',
    patterns: [
      // Direct questions about presence.
      /\b(do we have|do i have|did we (?:buy|get)|did i (?:buy|get)|is there (?:any|some)?|are we out of|got any|have any)\b/,
      // "any X left", "got X left"
      /\b(?:any|some) [\w\s'-]+ left\b/,
    ],
  },
  {
    type: 'OUT',
    patterns: [
      /\b(scan out|take out|throw(?:ing)? out|remove|removed|delete)\b/,
      /\b(we are out of|out of|ran out of|finished (?:the|off)?|used up|used the last|threw out|ate the last)\b/,
      /\b(took|ate|drank|used|finished)\b/,
    ],
  },
  {
    type: 'IN',
    patterns: [
      /\b(scan in|add|added|stock(?:ed)?|just got|i (?:just )?bought|we (?:just )?bought|bought|got|picked up|grabbed|now have)\b/,
    ],
  },
];

// ---- quantity extraction -------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  // Note: "a" / "an" are deliberately NOT here. They almost always behave
  // as articles ("add a milk") rather than quantity words; the article
  // gets stripped by STRIP_AFTER_INTENT and the default qty of 1 applies.
  // "a dozen eggs" still resolves to 12 because "dozen" is in this map.
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  couple: 2,
  pair: 2,
  few: 3,
  dozen: 12,
};

function extractQuantity(text: string): { quantity: number; span: string | null } {
  // Digits first.
  const digitMatch = text.match(/\b(\d{1,3})\b/);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    if (n >= 1 && n <= 999) return { quantity: n, span: digitMatch[0] };
  }
  // Word numbers — first one wins, scanning in source order so "two yogurts"
  // beats a later stray "one".
  const tokens = text.split(/\s+/);
  for (const t of tokens) {
    if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, t)) {
      return { quantity: NUMBER_WORDS[t], span: t };
    }
  }
  return { quantity: 1, span: null };
}

// ---- item-name extraction -----------------------------------------------

// Words to strip from the residual after we've matched an intent + quantity.
// These are filler/connector tokens that almost never belong to an item name.
// "last" and "left" appear in phrases like "used the last of the milk" and
// "any pickles left" where they're syntactic noise around the real item.
const STRIP_AFTER_INTENT =
  /\b(a|an|the|some|any|of|please|to|for|now|last|left|over)\b/g;
const PLURAL_PATTERNS: Array<[RegExp, string]> = [
  [/\b([\w-]+?)ies\b/g, '$1y'], // berries → berry
  [/\b([\w-]+?)(?<!s)s\b/g, '$1'], // eggs → egg, BUT skip "boss" via lookbehind
];

function singularize(word: string): string {
  let w = word;
  for (const [pattern, replacement] of PLURAL_PATTERNS) {
    w = w.replace(pattern, replacement);
  }
  return w.trim();
}

function extractItemName(
  normalized: string,
  matchedSpan: RegExpMatchArray | null,
  quantitySpan: string | null,
): string | null {
  // Take what's left after the intent phrase, then strip quantity + articles.
  let residual = normalized;
  if (matchedSpan && matchedSpan[0]) {
    residual = residual.replace(matchedSpan[0], ' ');
  }
  if (quantitySpan) {
    residual = residual.replace(new RegExp(`\\b${quantitySpan}\\b`), ' ');
  }
  residual = residual.replace(STRIP_AFTER_INTENT, ' ');
  residual = residual.replace(/\s+/g, ' ').trim();
  if (!residual) return null;

  // Light singularization so "eggs" / "two yogurts" land on a stem the
  // engine's searchByName will find via LIKE.
  return singularize(residual);
}

// ---- public entry point -------------------------------------------------

export function parseVoiceCommand(rawTranscript: string): ParsedVoiceCommand {
  const trimmed = (rawTranscript ?? '').trim();
  const normalized = normalizeTranscript(trimmed);

  if (!normalized) {
    return {
      type: 'UNKNOWN',
      itemName: null,
      quantity: 1,
      rawTranscript: trimmed,
      normalizedTranscript: normalized,
      confidence: 0,
    };
  }

  for (const binding of INTENT_PATTERNS) {
    for (const pattern of binding.patterns) {
      const match = normalized.match(pattern);
      if (!match) continue;

      const { quantity, span: qtySpan } = extractQuantity(normalized);
      const item = extractItemName(normalized, match, qtySpan);
      const matchedPattern = pattern.source;

      let confidence = item ? 0.9 : 0.55;
      // Boost when the user spelled out a quantity — that's strong signal
      // they're describing a concrete action, not just musing aloud.
      if (qtySpan && binding.type !== 'ASK') confidence = Math.min(1, confidence + 0.05);

      return {
        type: binding.type,
        itemName: item,
        quantity: binding.type === 'ASK' ? 1 : quantity,
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        confidence,
        matchedPattern,
      };
    }
  }

  // No clear intent; surface what they said so the user can edit before
  // dispatching. The UI uses UNKNOWN as a signal to open the manual editor.
  return {
    type: 'UNKNOWN',
    itemName: normalized || null,
    quantity: 1,
    rawTranscript: trimmed,
    normalizedTranscript: normalized,
    confidence: 0.2,
  };
}

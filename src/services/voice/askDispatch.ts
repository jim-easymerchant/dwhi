/**
 * Pure decision: given a parsed voice/text input, what should the Ask
 * screen do next?
 *
 *   - "answer"  → run the existing confidence engine and render its result
 *   - "staged"  → stage an itemDraft + navigate to /confirm-item
 *
 * Kept out of ask.tsx so it stays testable without React Native.
 */

import type { ParsedVoiceCommand } from './voiceTypes';

export type AskDispatch =
  | { kind: 'answer'; query: string }
  | {
      kind: 'staged';
      direction: 'IN' | 'OUT';
      itemName: string;
      quantity: number;
      rawTranscript: string;
    };

export function chooseAskDispatch(parsed: ParsedVoiceCommand): AskDispatch {
  if ((parsed.type === 'IN' || parsed.type === 'OUT') && parsed.itemName) {
    return {
      kind: 'staged',
      direction: parsed.type,
      itemName: parsed.itemName,
      quantity: parsed.quantity,
      rawTranscript: parsed.rawTranscript,
    };
  }
  // ASK, UNKNOWN, or IN/OUT without an item name — fall through to a
  // regular ask. The user's literal phrasing goes to the confidence
  // engine; for UNKNOWN we trust the engine to surface a graceful
  // "I don't have any history" rather than try to be clever here.
  const query = parsed.rawTranscript.trim() || parsed.itemName || '';
  return { kind: 'answer', query };
}

import { chooseAskDispatch } from '../askDispatch';
import { parseVoiceCommand } from '../voiceIntentParser';

describe('chooseAskDispatch', () => {
  test('ASK question → answer dispatch', () => {
    const parsed = parseVoiceCommand('Do we have pickles?');
    const d = chooseAskDispatch(parsed);
    expect(d).toEqual({ kind: 'answer', query: 'Do we have pickles?' });
  });

  test('IN command with item → staged dispatch (IN)', () => {
    const parsed = parseVoiceCommand('Add three apples');
    const d = chooseAskDispatch(parsed);
    expect(d).toEqual({
      kind: 'staged',
      direction: 'IN',
      itemName: 'apple',
      quantity: 3,
      rawTranscript: 'Add three apples',
    });
  });

  test('OUT command with item → staged dispatch (OUT)', () => {
    const parsed = parseVoiceCommand('Remove two yogurts');
    const d = chooseAskDispatch(parsed);
    expect(d.kind).toBe('staged');
    if (d.kind === 'staged') {
      expect(d.direction).toBe('OUT');
      expect(d.itemName).toBe('yogurt');
      expect(d.quantity).toBe(2);
    }
  });

  test('IN intent without an item → falls back to answer (engine handles)', () => {
    const parsed = parseVoiceCommand('add');
    const d = chooseAskDispatch(parsed);
    expect(d.kind).toBe('answer');
  });

  test('UNKNOWN → answer dispatch with the raw text', () => {
    const parsed = parseVoiceCommand('banana boat aerodynamics');
    const d = chooseAskDispatch(parsed);
    expect(d).toEqual({ kind: 'answer', query: 'banana boat aerodynamics' });
  });

  test('Empty → answer dispatch with empty query (caller will short-circuit)', () => {
    const parsed = parseVoiceCommand('');
    const d = chooseAskDispatch(parsed);
    expect(d).toEqual({ kind: 'answer', query: '' });
  });
});

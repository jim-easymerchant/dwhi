import { parseVoiceCommand } from '../voiceIntentParser';

describe('parseVoiceCommand — IN intents', () => {
  test('"add milk" → IN milk qty 1', () => {
    const r = parseVoiceCommand('add milk');
    expect(r.type).toBe('IN');
    expect(r.itemName).toBe('milk');
    expect(r.quantity).toBe(1);
    expect(r.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test('"I just bought milk" → IN milk', () => {
    const r = parseVoiceCommand('I just bought milk');
    expect(r.type).toBe('IN');
    expect(r.itemName).toBe('milk');
  });

  test('"add three apples" → IN apple qty 3 (digit/word + singularize)', () => {
    const r = parseVoiceCommand('add three apples');
    expect(r.type).toBe('IN');
    expect(r.quantity).toBe(3);
    expect(r.itemName).toBe('apple');
  });

  test('"add 2 yogurts" → IN yogurt qty 2', () => {
    const r = parseVoiceCommand('add 2 yogurts');
    expect(r.type).toBe('IN');
    expect(r.quantity).toBe(2);
    expect(r.itemName).toBe('yogurt');
  });

  test('"picked up a dozen eggs" → IN egg qty 12', () => {
    const r = parseVoiceCommand('picked up a dozen eggs');
    expect(r.type).toBe('IN');
    expect(r.quantity).toBe(12);
    expect(r.itemName).toBe('egg');
  });
});

describe('parseVoiceCommand — OUT intents', () => {
  test('"remove two yogurts" → OUT yogurt qty 2', () => {
    const r = parseVoiceCommand('remove two yogurts');
    expect(r.type).toBe('OUT');
    expect(r.quantity).toBe(2);
    expect(r.itemName).toBe('yogurt');
  });

  test('"we\'re out of ketchup" → OUT ketchup', () => {
    const r = parseVoiceCommand("we're out of ketchup");
    expect(r.type).toBe('OUT');
    expect(r.itemName).toBe('ketchup');
    expect(r.quantity).toBe(1);
  });

  test('"scan out yogurt" → OUT yogurt', () => {
    const r = parseVoiceCommand('scan out yogurt');
    expect(r.type).toBe('OUT');
    expect(r.itemName).toBe('yogurt');
  });

  test('"used up the last of the milk" → OUT milk', () => {
    const r = parseVoiceCommand('used up the last of the milk');
    expect(r.type).toBe('OUT');
    expect(r.itemName).toBe('milk');
  });

  test('"threw out moldy bread" → OUT bread', () => {
    const r = parseVoiceCommand('threw out moldy bread');
    expect(r.type).toBe('OUT');
    expect(r.itemName).toBe('moldy bread');
  });
});

describe('parseVoiceCommand — ASK intents', () => {
  test('"do we have eggs" → ASK egg', () => {
    const r = parseVoiceCommand('do we have eggs?');
    expect(r.type).toBe('ASK');
    expect(r.itemName).toBe('egg');
    expect(r.quantity).toBe(1);
  });

  test('"did we buy ketchup" → ASK ketchup', () => {
    const r = parseVoiceCommand('did we buy ketchup?');
    expect(r.type).toBe('ASK');
    expect(r.itemName).toBe('ketchup');
  });

  test('"got any milk" → ASK milk', () => {
    const r = parseVoiceCommand('got any milk?');
    expect(r.type).toBe('ASK');
    expect(r.itemName).toBe('milk');
  });

  test('"is there any pickles left" → ASK pickle', () => {
    const r = parseVoiceCommand('is there any pickles left');
    expect(r.type).toBe('ASK');
    expect(r.itemName).toBe('pickle');
  });

  test('"are we out of paper towels" → ASK paper towel', () => {
    const r = parseVoiceCommand('are we out of paper towels');
    // The "are we out of" phrase is *interrogative*, not an out-action,
    // so it must classify as ASK — not OUT.
    expect(r.type).toBe('ASK');
    expect(r.itemName).toBe('paper towel');
  });
});

describe('parseVoiceCommand — edge cases', () => {
  test('empty transcript → UNKNOWN with confidence 0', () => {
    const r = parseVoiceCommand('');
    expect(r.type).toBe('UNKNOWN');
    expect(r.itemName).toBeNull();
    expect(r.confidence).toBe(0);
  });

  test('whitespace transcript → UNKNOWN', () => {
    const r = parseVoiceCommand('   ');
    expect(r.type).toBe('UNKNOWN');
  });

  test('nonsense ("banana boat aerodynamics") → UNKNOWN with low confidence', () => {
    const r = parseVoiceCommand('banana boat aerodynamics');
    expect(r.type).toBe('UNKNOWN');
    expect(r.confidence).toBeLessThanOrEqual(0.3);
    // UNKNOWN deliberately preserves the user's wording verbatim (no
    // singularization) so the manual-edit modal shows them exactly what
    // we heard.
    expect(r.itemName).toBe('banana boat aerodynamics');
  });

  test('filler-only after stripping → UNKNOWN', () => {
    const r = parseVoiceCommand('uh um like please');
    expect(r.type).toBe('UNKNOWN');
    expect(r.itemName).toBeNull();
  });

  test('"add" with no item → IN, no item name, lower confidence', () => {
    const r = parseVoiceCommand('add');
    expect(r.type).toBe('IN');
    expect(r.itemName).toBeNull();
    expect(r.confidence).toBeLessThan(0.7);
  });

  test('rawTranscript is preserved verbatim for the UI', () => {
    const r = parseVoiceCommand("We're OUT of Eggs!");
    expect(r.rawTranscript).toBe("We're OUT of Eggs!");
    expect(r.normalizedTranscript).toBe('we are out of eggs');
  });
});

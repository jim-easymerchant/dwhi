import { normalizeTranscript } from '../transcriptNormalizer';

describe('normalizeTranscript', () => {
  test('returns empty for empty/whitespace input', () => {
    expect(normalizeTranscript('')).toBe('');
    expect(normalizeTranscript('   ')).toBe('');
  });

  test('lowercases + collapses whitespace', () => {
    expect(normalizeTranscript('  Do  We Have  Pickles ')).toBe('do we have pickles');
  });

  test('strips end-of-sentence punctuation', () => {
    expect(normalizeTranscript('Do we have eggs?')).toBe('do we have eggs');
    expect(normalizeTranscript('add milk!')).toBe('add milk');
    expect(normalizeTranscript('add milk, please')).toBe('add milk');
  });

  test('expands common contractions so intent matchers can fire', () => {
    expect(normalizeTranscript("We're out of ketchup")).toBe('we are out of ketchup');
    expect(normalizeTranscript("I've got milk")).toBe('i have got milk');
    expect(normalizeTranscript("Didn't buy yogurt")).toBe('did not buy yogurt');
  });

  test('drops filler tokens but keeps real words', () => {
    expect(normalizeTranscript('uh add some milk like please')).toBe('add some milk');
    expect(normalizeTranscript('hey, just buy bread')).toBe('buy bread');
  });
});

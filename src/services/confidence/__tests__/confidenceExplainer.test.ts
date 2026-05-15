import { explain } from '../confidenceExplainer';
import type { ConfidenceSignal, SignalContext } from '../confidenceTypes';

function sig(overrides: Partial<ConfidenceSignal>): ConfidenceSignal {
  return {
    type: 'test',
    weight: 0,
    polarity: 'positive',
    explanation: '',
    ...overrides,
  };
}

const baseCtx: SignalContext = {
  query: 'milk',
  matchedItem: null,
  matchedReceipt: null,
  itemBehavior: null,
  categoryBehavior: null,
  feedback: null,
  now: Date.now(),
};

describe('explain', () => {
  test('Unknown / no signals → onboarding line referencing the query', () => {
    const out = explain('Unknown', [], { ...baseCtx, query: 'caviar' });
    expect(out).toMatch(/I don't have any history for "caviar"/);
    expect(out).toMatch(/Scan a receipt or tap \+ In/);
  });

  test('Probably leads with the strongest positive', () => {
    const out = explain(
      'Probably',
      [
        sig({
          type: 'receipt.recent',
          weight: 35,
          polarity: 'positive',
          explanation: 'You bought pickles 4 days ago.',
        }),
        sig({
          type: 'event.no-out-since-restock',
          weight: 15,
          polarity: 'positive',
          explanation: "There's no scan-out since then.",
        }),
      ],
      baseCtx,
    );
    expect(out.startsWith('Probably.')).toBe(true);
    expect(out).toContain('You bought pickles 4 days ago.');
    expect(out).toContain("There's no scan-out since then.");
  });

  test('Maybe pairs a positive with a decay-style negative', () => {
    const out = explain(
      'Maybe',
      [
        sig({
          type: 'receipt.older',
          weight: 20,
          polarity: 'positive',
          explanation: 'You bought milk a week ago.',
        }),
        sig({
          type: 'temporal.fast',
          weight: -16,
          polarity: 'negative',
          explanation: 'Milk usually gets used quickly.',
        }),
      ],
      baseCtx,
    );
    expect(out.startsWith('Maybe.')).toBe(true);
    expect(out).toContain('You bought milk a week ago.');
    expect(out.toLowerCase()).toContain('but milk usually gets used quickly.');
  });

  test('No leads with last-out clause', () => {
    const out = explain(
      'No',
      [
        sig({
          type: 'event.last-out',
          weight: -35,
          polarity: 'negative',
          explanation: 'The last milk was scanned out today.',
        }),
        sig({
          type: 'temporal.fast',
          weight: -2,
          polarity: 'negative',
          explanation: 'Milk usually gets used quickly.',
        }),
      ],
      baseCtx,
    );
    expect(out.startsWith('No.')).toBe(true);
    expect(out).toContain('The last milk was scanned out today.');
  });

  test('Unlikely leads with the strongest negative, supports with the next', () => {
    const out = explain(
      'Unlikely',
      [
        sig({
          type: 'temporal.fast',
          weight: -20,
          polarity: 'negative',
          explanation: 'Milk usually gets used quickly.',
        }),
        sig({
          type: 'receipt.older',
          weight: 18,
          polarity: 'positive',
          explanation: 'You bought milk a week ago.',
        }),
        sig({
          type: 'event.net-negative',
          weight: -5,
          polarity: 'negative',
          explanation: 'More milk has gone out than in.',
        }),
      ],
      baseCtx,
    );
    expect(out.startsWith('Unlikely.')).toBe(true);
    expect(out).toContain('Milk usually gets used quickly.');
  });

  test('Empty signal list always falls back to the onboarding message', () => {
    // If a level somehow gets picked without any signals, the explainer
    // still treats it as "no evidence" because the answer would otherwise
    // be a bare prefix.
    const out = explain('Maybe', [], baseCtx);
    expect(out).toMatch(/I don't have any history for "milk"/);
  });
});

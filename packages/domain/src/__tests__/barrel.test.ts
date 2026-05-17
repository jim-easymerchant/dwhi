// Smoke tests for the @dwhi/domain boundary. Verifies the pantry
// surface is exposed; behavioural tests live alongside the
// implementations under src/services/<area>/__tests__.

import * as domain from '@dwhi/domain';
import * as items from '@dwhi/domain/items';
import * as inventory from '@dwhi/domain/inventory';
import * as receipts from '@dwhi/domain/receipts';
import * as ask from '@dwhi/domain/ask';
import * as confidence from '@dwhi/domain/confidence';
import * as behavior from '@dwhi/domain/behavior';
import * as voice from '@dwhi/domain/voice';
import * as recentActivity from '@dwhi/domain/recent-activity';

describe('@dwhi/domain barrel', () => {
  test('items surface', () => {
    expect(typeof items.findByCanonicalKey).toBe('function');
    expect(typeof items.findByBarcode).toBe('function');
    expect(typeof items.searchByName).toBe('function');
    expect(typeof items.createItem).toBe('function');
    expect(typeof items.upsertItem).toBe('function');
    expect(typeof items.toCanonicalKey).toBe('function');
  });

  test('inventory surface', () => {
    expect(typeof inventory.recordEvent).toBe('function');
    expect(typeof inventory.getEstimatedBalance).toBe('function');
    expect(typeof inventory.listRecentEvents).toBe('function');
  });

  test('receipts surface', () => {
    expect(typeof receipts.createReceipt).toBe('function');
    expect(typeof receipts.listReceipts).toBe('function');
    expect(typeof receipts.findMostRecentReceiptForItem).toBe('function');
  });

  test('ask surface', () => {
    expect(typeof ask.recordAsk).toBe('function');
    expect(typeof ask.recordFeedback).toBe('function');
    expect(typeof ask.askHistorySummaryForTerm).toBe('function');
    expect(typeof ask.askFeedbackSummaryForTerm).toBe('function');
  });

  test('confidence surface', () => {
    expect(typeof confidence.answerQuestion).toBe('function');
    expect(typeof confidence.scoreSignals).toBe('function');
    expect(typeof confidence.explain).toBe('function');
    expect(typeof confidence.extractQueryTerm).toBe('function');
  });

  test('behavior surface', () => {
    expect(typeof behavior.getItemBehaviorStats).toBe('function');
    expect(typeof behavior.getCategoryBehaviorStats).toBe('function');
    expect(typeof behavior.countLearnedPatterns).toBe('function');
  });

  test('voice surface', () => {
    expect(typeof voice.parseVoiceCommand).toBe('function');
    expect(typeof voice.normalizeTranscript).toBe('function');
    expect(typeof voice.chooseAskDispatch).toBe('function');
    expect(typeof voice.selectSpeechService).toBe('function');
    expect(typeof voice.speechService).toBe('object');
  });

  test('recent activity surface', () => {
    expect(typeof recentActivity.listRecentActivity).toBe('function');
  });

  test('root barrel re-exports everything', () => {
    expect(domain.answerQuestion).toBe(confidence.answerQuestion);
    expect(domain.recordEvent).toBe(inventory.recordEvent);
    expect(domain.searchByName).toBe(items.searchByName);
    expect(domain.listRecentActivity).toBe(recentActivity.listRecentActivity);
  });
});

describe('@dwhi/domain does not leak pantry-specific tables into the framework barrel', () => {
  // Belt-and-braces regression guard: if someone accidentally adds
  // pantry-only exports to @dwhi/framework, this test surfaces it.
  test('framework barrel does not export item/receipt/inventory helpers', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const framework = require('@dwhi/framework') as Record<string, unknown>;
    expect(framework.findByCanonicalKey).toBeUndefined();
    expect(framework.findByBarcode).toBeUndefined();
    expect(framework.createReceipt).toBeUndefined();
    expect(framework.recordEvent).toBeUndefined();
    expect(framework.answerQuestion).toBeUndefined();
  });
});

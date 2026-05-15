import { getDb } from '@/db/database';
import {
  getBuildInfo,
  getConfigSource,
  getOpenAIKey,
  getOpenAIModel,
  getProbeSnapshot,
  isOpenAIConfigured,
  type BuildInfo,
  type ConfigSource,
} from './env';
import { countAll as countAllAsks } from '@/repositories/askHistoryRepository';
import { countAll as countAllFeedback } from '@/repositories/askFeedbackRepository';
import { countLearnedPatterns } from './behaviorStats';

export interface Diagnostics {
  aiEnabled: boolean;
  aiModel: string;
  aiKeyLength: number;
  configSource: ConfigSource;
  probeSnapshot: Record<ConfigSource, boolean>;
  barcodeLookup: 'Enabled (Open Food Facts, no key required)';
  dbReady: boolean;
  itemCount: number;
  receiptCount: number;
  eventCount: number;
  askHistoryCount: number;
  feedbackCount: number;
  learnedPatternsCount: number;
  seedPresent: boolean;
  appMode: 'Local POC';
  build: BuildInfo;
}

/**
 * Snapshot of app state for the Settings screen. Never throws — each probe
 * is wrapped so a missing table or open-failure shows up as `dbReady: false`
 * instead of a red error screen.
 */
export async function readDiagnostics(): Promise<Diagnostics> {
  const apiKey = getOpenAIKey();

  let dbReady = false;
  let itemCount = 0;
  let receiptCount = 0;
  let eventCount = 0;
  let askHistoryCount = 0;
  let feedbackCount = 0;
  let learnedPatternsCount = 0;

  try {
    const db = await getDb();
    const items = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM items;',
    );
    const receipts = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM receipts;',
    );
    const events = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM inventory_events;',
    );
    itemCount = items?.c ?? 0;
    receiptCount = receipts?.c ?? 0;
    eventCount = events?.c ?? 0;
    askHistoryCount = await countAllAsks();
    feedbackCount = await countAllFeedback();
    learnedPatternsCount = await countLearnedPatterns();
    dbReady = true;
  } catch (e) {
    console.warn('[dwhi] diagnostics probe failed:', e);
  }

  return {
    aiEnabled: isOpenAIConfigured(),
    aiModel: getOpenAIModel(),
    aiKeyLength: apiKey?.length ?? 0,
    configSource: getConfigSource(),
    probeSnapshot: getProbeSnapshot(),
    barcodeLookup: 'Enabled (Open Food Facts, no key required)',
    dbReady,
    itemCount,
    receiptCount,
    eventCount,
    askHistoryCount,
    feedbackCount,
    learnedPatternsCount,
    seedPresent: itemCount > 0,
    appMode: 'Local POC',
    build: getBuildInfo(),
  };
}

/**
 * Last four chars of the configured key for visual confirmation that a key
 * is actually present. Never exposes the full secret on-screen.
 */
export function getKeyHint(): string | null {
  const key = getOpenAIKey();
  if (!key) return null;
  if (key.length <= 4) return '****';
  return `…${key.slice(-4)}`;
}

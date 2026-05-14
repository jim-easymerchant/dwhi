import { getDb } from '@/db/database';
import { getOpenAIKey, getOpenAIModel, isOpenAIConfigured } from './env';

export interface Diagnostics {
  aiEnabled: boolean;
  aiModel: string;
  dbReady: boolean;
  itemCount: number;
  receiptCount: number;
  eventCount: number;
  seedPresent: boolean;
  appMode: 'Local POC';
}

/**
 * Reads a snapshot of app state for the Settings/Diagnostics screen. Never
 * throws — every probe is wrapped so a missing table or open-failure just
 * shows up as `dbReady: false` instead of a red error screen.
 */
export async function readDiagnostics(): Promise<Diagnostics> {
  const aiEnabled = isOpenAIConfigured();
  const aiModel = getOpenAIModel();

  let dbReady = false;
  let itemCount = 0;
  let receiptCount = 0;
  let eventCount = 0;

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
    dbReady = true;
  } catch (e) {
    console.warn('[dwhi] diagnostics probe failed:', e);
  }

  return {
    aiEnabled,
    aiModel,
    dbReady,
    itemCount,
    receiptCount,
    eventCount,
    seedPresent: itemCount > 0,
    appMode: 'Local POC',
  };
}

/**
 * Last four chars of the configured key for visual confirmation that a key is
 * actually present without leaking the full secret on-screen.
 */
export function getKeyHint(): string | null {
  const key = getOpenAIKey();
  if (!key) return null;
  if (key.length <= 4) return '****';
  return `…${key.slice(-4)}`;
}

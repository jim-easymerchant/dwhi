import { create } from 'zustand';
import type { ReceiptParseResult, ItemRecognitionResult } from './aiService';
import type { ParseSource } from './receiptParser';

/**
 * Lightweight in-memory handoff between the capture screens and the
 * confirmation screens. expo-router params can't carry rich objects cleanly,
 * so we stash the parsed payload here and let the confirmation screen read it.
 *
 * Drafts carry a `stagedAt` timestamp so a confirm screen can detect that
 * it's looking at a stale draft from a previous flow and refuse to render it.
 */

const STALE_DRAFT_MS = 5 * 60 * 1000; // 5 minutes

interface BaseDraft {
  stagedAt: number;
}

export interface ReceiptDraft extends BaseDraft {
  imageUri: string | null;
  parsed: ReceiptParseResult;
  source: ParseSource;
  rawAiJson?: string;
  model?: string;
}

export interface ItemDraft extends BaseDraft {
  imageUri: string | null;
  parsed: ItemRecognitionResult;
  direction: 'IN' | 'OUT';
}

interface CaptureStoreState {
  receiptDraft: ReceiptDraft | null;
  itemDraft: ItemDraft | null;
  stageReceiptDraft: (d: Omit<ReceiptDraft, 'stagedAt'>) => void;
  stageItemDraft: (d: Omit<ItemDraft, 'stagedAt'>) => void;
  clearReceiptDraft: () => void;
  clearItemDraft: () => void;
}

export const useCaptureStore = create<CaptureStoreState>(set => ({
  receiptDraft: null,
  itemDraft: null,
  stageReceiptDraft: d => set({ receiptDraft: { ...d, stagedAt: Date.now() } }),
  stageItemDraft: d => set({ itemDraft: { ...d, stagedAt: Date.now() } }),
  clearReceiptDraft: () => set({ receiptDraft: null }),
  clearItemDraft: () => set({ itemDraft: null }),
}));

export function isDraftFresh(draft: BaseDraft | null | undefined): boolean {
  if (!draft) return false;
  return Date.now() - draft.stagedAt < STALE_DRAFT_MS;
}

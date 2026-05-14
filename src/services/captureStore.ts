import { create } from 'zustand';
import type { ReceiptParseResult, ItemRecognitionResult } from './aiService';

/**
 * Lightweight in-memory handoff between the capture screens and the
 * confirmation screens. expo-router params can't carry rich objects cleanly,
 * so we stash the parsed payload here and let the confirmation screen read it.
 */

interface ReceiptDraft {
  imageUri: string | null;
  parsed: ReceiptParseResult | null;
}

interface ItemDraft {
  imageUri: string | null;
  parsed: ItemRecognitionResult | null;
  direction: 'IN' | 'OUT';
}

interface CaptureStoreState {
  receiptDraft: ReceiptDraft | null;
  itemDraft: ItemDraft | null;
  setReceiptDraft: (d: ReceiptDraft | null) => void;
  setItemDraft: (d: ItemDraft | null) => void;
  clear: () => void;
}

export const useCaptureStore = create<CaptureStoreState>(set => ({
  receiptDraft: null,
  itemDraft: null,
  setReceiptDraft: receiptDraft => set({ receiptDraft }),
  setItemDraft: itemDraft => set({ itemDraft }),
  clear: () => set({ receiptDraft: null, itemDraft: null }),
}));

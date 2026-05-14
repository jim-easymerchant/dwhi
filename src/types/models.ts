export type Direction = 'IN' | 'OUT';

export type ItemSource = 'manual' | 'photo' | 'receipt' | 'barcode';

export type ItemLookupSource = 'barcode' | 'ai' | 'mock' | 'manual';

export interface Item {
  id: number;
  manufacturer: string | null;
  name: string;
  category: string | null;
  containerType: string | null;
  size: string | null;
  canonicalKey: string | null;
  barcode: string | null;
  source: string | null;
  rawLookupJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewItem = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;

export interface InventoryEvent {
  id: number;
  itemId: number;
  direction: Direction;
  quantity: number;
  imageUri: string | null;
  rawAiJson: string | null;
  source: ItemSource;
  createdAt: string;
}

export type NewInventoryEvent = Omit<InventoryEvent, 'id' | 'createdAt'>;

export interface Receipt {
  id: number;
  storeName: string | null;
  purchasedAt: string | null;
  total: number | null;
  imageUri: string | null;
  createdAt: string;
}

export interface ReceiptItem {
  id: number;
  receiptId: number;
  canonicalName: string | null;
  rawName: string | null;
  quantity: number | null;
  estimatedCategory: string | null;
}

export type ConfidenceLevel = 'Probably' | 'Maybe' | 'Unlikely' | 'No' | 'Unknown';

export interface AskAnswer {
  confidence: ConfidenceLevel;
  message: string;
  matchedItemId?: number;
}

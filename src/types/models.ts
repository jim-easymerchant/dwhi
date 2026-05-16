export type Direction = 'IN' | 'OUT';

export type ItemSource = 'manual' | 'photo' | 'receipt' | 'barcode';

export type ItemLookupSource = 'barcode' | 'ai' | 'mock' | 'manual';

// ---------------------------------------------------------------------------
// Household scope (local-first today; sync-ready tomorrow)
// ---------------------------------------------------------------------------

export type HouseholdRole = 'owner' | 'member';

export interface Household {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  remoteId: string | null;
}

export interface HouseholdMember {
  id: number;
  householdId: number;
  displayName: string;
  role: HouseholdRole;
  localDeviceId: number | null;
  createdAt: string;
  remoteId: string | null;
  remoteUserId: string | null;
}

export interface Device {
  id: number;
  householdId: number;
  deviceName: string;
  deviceUuid: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface ActiveHouseholdContext {
  household: Household;
  member: HouseholdMember;
  device: Device;
}

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
  householdId: number | null;
}

// Household scope is set by the repository from the active context, not the
// caller — keep it out of the input shape so business code never thinks
// about it.
export type NewItem = Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'householdId'>;

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

// ConfidenceLevel + ConfidenceResult now live in
// src/services/confidence/confidenceTypes.ts

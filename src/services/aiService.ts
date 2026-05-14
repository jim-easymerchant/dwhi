/**
 * Stub AI services. The real implementation will call a vision model (OpenAI
 * Vision or similar) with the captured image; for the POC we return mock
 * structured data shaped exactly like the future response so downstream code
 * doesn't have to change.
 *
 * Replace each `*Stub` function with a real implementation behind the same
 * interface to ship vision.
 */

export interface ReceiptItemPayload {
  rawName: string;
  canonicalName: string;
  quantity: number;
  category: string | null;
}

export interface ReceiptParseResult {
  storeName: string | null;
  purchasedAt: string;
  total: number | null;
  items: ReceiptItemPayload[];
}

export interface ItemRecognitionResult {
  manufacturer: string | null;
  name: string;
  category: string | null;
  containerType: string | null;
  size: string | null;
}

export interface AIService {
  parseReceipt(imageUri: string): Promise<ReceiptParseResult>;
  recognizeItem(imageUri: string): Promise<ItemRecognitionResult>;
}

const MOCK_RECEIPT_ITEMS: ReceiptItemPayload[] = [
  {
    rawName: 'VLASIC BABY DILL',
    canonicalName: 'Vlasic Baby Dill Pickles',
    quantity: 1,
    category: 'Pickles',
  },
  {
    rawName: 'HORIZON ORG MILK 1G',
    canonicalName: 'Horizon Organic Milk 1 Gallon',
    quantity: 1,
    category: 'Milk',
  },
  {
    rawName: 'CHOBANI PLAIN 32OZ',
    canonicalName: 'Chobani Plain Greek Yogurt 32 oz',
    quantity: 2,
    category: 'Yogurt',
  },
  {
    rawName: 'BANANAS',
    canonicalName: 'Bananas',
    quantity: 6,
    category: 'Produce',
  },
];

const MOCK_ITEMS: ItemRecognitionResult[] = [
  {
    manufacturer: 'Vlasic',
    name: 'Baby Dill Pickles',
    category: 'Pickles',
    containerType: 'Jar',
    size: '12 oz',
  },
  {
    manufacturer: 'Horizon',
    name: 'Organic Milk',
    category: 'Milk',
    containerType: 'Jug',
    size: '1 gal',
  },
  {
    manufacturer: 'Chobani',
    name: 'Plain Greek Yogurt',
    category: 'Yogurt',
    containerType: 'Tub',
    size: '32 oz',
  },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const stubAIService: AIService = {
  async parseReceipt(_imageUri: string) {
    // Simulate network/inference latency so the UI gets a realistic feel.
    await new Promise(r => setTimeout(r, 600));
    return {
      storeName: 'Publix',
      purchasedAt: new Date().toISOString(),
      total: 24.18,
      items: MOCK_RECEIPT_ITEMS,
    };
  },
  async recognizeItem(_imageUri: string) {
    await new Promise(r => setTimeout(r, 500));
    return pick(MOCK_ITEMS);
  },
};

export const aiService: AIService = stubAIService;

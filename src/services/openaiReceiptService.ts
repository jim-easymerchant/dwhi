import * as FileSystem from 'expo-file-system';
import type { ReceiptParseResult, ReceiptItemPayload } from './aiService';
import { getOpenAIKey, getOpenAIModel } from './env';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ITEMS = 100;
const MAX_QUANTITY = 99;
const MAX_NAME_LENGTH = 200;

const SYSTEM_PROMPT = `You parse photos of grocery receipts into structured data.

Return ONE valid JSON object with this exact shape:
{
  "storeName": string | null,
  "purchasedAt": string | null,
  "total": number | null,
  "items": Array<{
    "rawName": string,
    "canonicalName": string,
    "quantity": number,
    "category": string | null
  }>
}

Rules:
- "rawName" is the text as printed on the receipt (e.g. "VLASIC BABY DILL").
- "canonicalName" is a clean, human-readable version (e.g. "Vlasic Baby Dill Pickles").
- "quantity" must be a positive integer. Default to 1 if not stated.
- "category" is a short noun like "Pickles", "Milk", "Produce", or null if unsure.
- "purchasedAt" must be an ISO 8601 timestamp, or null if you can't read the date.
- "total" must be a decimal number, or null.
- If a field is missing, illegible, or uncertain, use null (or 1 for quantity).
- Do NOT include any commentary, prose, or markdown fences. JSON only.`;

const USER_PROMPT = 'Parse this receipt. Respond with the JSON object only.';

export class OpenAIReceiptError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'OpenAIReceiptError';
  }
}

export interface OpenAIReceiptResult {
  parsed: ReceiptParseResult;
  rawJson: string;
  model: string;
}

async function imageToDataUrl(imageUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  // We don't sniff the file type. JPEG covers what expo-image-picker produces
  // on Android and iOS; OpenAI accepts the wrong MIME label gracefully here.
  return `data:image/jpeg;base64,${base64}`;
}

export async function parseReceiptWithOpenAI(
  imageUri: string,
): Promise<OpenAIReceiptResult> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new OpenAIReceiptError('No OPENAI key configured.');
  }
  const model = getOpenAIModel();

  const dataUrl = await imageToDataUrl(imageUri);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: USER_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new OpenAIReceiptError('OpenAI request timed out.');
    }
    throw new OpenAIReceiptError(
      `Network error reaching OpenAI: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new OpenAIReceiptError(
      `OpenAI returned ${response.status} ${response.statusText}: ${bodyText.slice(0, 240)}`,
      response.status,
    );
  }

  const envelope = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = envelope.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new OpenAIReceiptError('OpenAI response had no content.');
  }

  const parsed = sanitizeReceiptResult(rawContent);
  return { parsed, rawJson: rawContent, model };
}

// ---------------------------------------------------------------------------
// Guardrails: coerce whatever the model returned into a known-good shape.
// Even with response_format=json_object, the model can return an object whose
// fields don't match our schema — so every field is defensively normalized.
// ---------------------------------------------------------------------------

function asNullableString(value: unknown, max = MAX_NAME_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.\-]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asQuantity(value: unknown): number {
  const n = asNullableNumber(value);
  if (n === null) return 1;
  const rounded = Math.round(n);
  if (rounded < 1) return 1;
  if (rounded > MAX_QUANTITY) return MAX_QUANTITY;
  return rounded;
}

function asIsoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
}

export function sanitizeReceiptResult(rawJson: string): ReceiptParseResult {
  let obj: unknown;
  try {
    obj = JSON.parse(rawJson);
  } catch {
    return emptyResult();
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return emptyResult();
  }
  const record = obj as Record<string, unknown>;

  const itemsRaw = Array.isArray(record.items) ? record.items.slice(0, MAX_ITEMS) : [];
  const items: ReceiptItemPayload[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const rawName = asNullableString(row.rawName);
    const canonicalName = asNullableString(row.canonicalName);
    // Drop fully-empty lines.
    if (!rawName && !canonicalName) continue;
    items.push({
      rawName: rawName ?? canonicalName ?? '',
      canonicalName: canonicalName ?? rawName ?? '',
      quantity: asQuantity(row.quantity),
      category: asNullableString(row.category, 60),
    });
  }

  return {
    storeName: asNullableString(record.storeName, 120),
    purchasedAt: asIsoDateOrNull(record.purchasedAt) ?? new Date().toISOString(),
    total: asNullableNumber(record.total),
    items,
  };
}

function emptyResult(): ReceiptParseResult {
  return {
    storeName: null,
    purchasedAt: new Date().toISOString(),
    total: null,
    items: [],
  };
}

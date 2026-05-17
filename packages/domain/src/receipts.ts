/**
 * Receipts + receipt items. Created from OpenAI parsing or manual
 * entry; consumed by the confidence engine to know whether an item
 * was recently bought.
 */
export {
  createReceipt,
  findMostRecentReceiptForItem,
  listReceiptItems,
  listReceipts,
  type CreateReceiptInput,
} from '@/repositories/receiptRepository';

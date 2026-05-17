/**
 * Item catalogue: canonical names, barcode lookup, search, basic CRUD.
 * Pantry-specific because "item" here means a household product (with
 * manufacturer, container_type, size). A workout app would have its
 * own equivalent (exercise, set, …) — they do not share storage.
 */
export {
  createItem,
  findByBarcode,
  findByCanonicalKey,
  getById,
  listAll,
  searchByName,
  toCanonicalKey,
  upsertItem,
} from '@/repositories/itemRepository';

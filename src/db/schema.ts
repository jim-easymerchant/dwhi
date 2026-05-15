export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manufacturer TEXT,
    name TEXT NOT NULL,
    category TEXT,
    container_type TEXT,
    size TEXT,
    canonical_key TEXT,
    barcode TEXT,
    source TEXT,
    raw_lookup_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_items_canonical_key ON items(canonical_key);`,
  `CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);`,
  `CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);`,
  `CREATE TABLE IF NOT EXISTS inventory_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('IN', 'OUT')),
    quantity INTEGER NOT NULL DEFAULT 1,
    image_uri TEXT,
    raw_ai_json TEXT,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_events_item_id ON inventory_events(item_id);`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_events_created_at ON inventory_events(created_at);`,
  `CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_name TEXT,
    purchased_at TEXT,
    total REAL,
    image_uri TEXT,
    raw_ai_json TEXT,
    parse_source TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL,
    canonical_name TEXT,
    raw_name TEXT,
    quantity INTEGER,
    estimated_category TEXT,
    FOREIGN KEY(receipt_id) REFERENCES receipts(id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);`,
  `CREATE TABLE IF NOT EXISTS ask_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT NOT NULL,
    normalized_term TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ask_history_normalized_term ON ask_history(normalized_term);`,
  `CREATE INDEX IF NOT EXISTS idx_ask_history_created_at ON ask_history(created_at);`,
  `CREATE TABLE IF NOT EXISTS ask_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    normalized_term TEXT NOT NULL,
    answer_level TEXT NOT NULL,
    user_feedback TEXT NOT NULL CHECK(user_feedback IN ('have', 'dont', 'unsure')),
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ask_feedback_normalized_term ON ask_feedback(normalized_term);`,
  `CREATE INDEX IF NOT EXISTS idx_ask_feedback_created_at ON ask_feedback(created_at);`,
];

export const SCHEMA_STATEMENTS: string[] = [
  // ---------------------------------------------------------------------------
  // Multi-household scoping (local-first today; ready for sync later).
  // Every row in every domain table carries an integer household_id so a
  // future cloud-sync layer can fan rows out by household without touching
  // UI code. Today the bootstrap creates a single "My Household" and
  // backfills all rows to it.
  //
  // IMPORTANT: indexes on `household_id` of pre-existing tables are NOT in
  // this list. They live in `database.runInit()` and are created AFTER
  // `addColumnIfMissing` ensures the column exists. Putting them here would
  // run on existing installs (where CREATE TABLE IF NOT EXISTS is a no-op
  // and the column doesn't exist yet) and crash the whole migration.
  // ---------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS households (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    remote_id TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS household_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','member')),
    local_device_id INTEGER,
    created_at TEXT NOT NULL,
    remote_id TEXT,
    remote_user_id TEXT,
    FOREIGN KEY(household_id) REFERENCES households(id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);`,
  `CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id INTEGER NOT NULL,
    device_name TEXT NOT NULL,
    device_uuid TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    FOREIGN KEY(household_id) REFERENCES households(id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_devices_household_id ON devices(household_id);`,

  // ---------------------------------------------------------------------------
  // Domain tables — household scope columns appended after the original
  // columns so positional INSERTs in older code paths stay readable.
  // ---------------------------------------------------------------------------
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
    updated_at TEXT NOT NULL,
    household_id INTEGER
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
    household_id INTEGER,
    created_by_member_id INTEGER,
    created_by_device_id INTEGER,
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
    created_at TEXT NOT NULL,
    household_id INTEGER,
    created_by_member_id INTEGER,
    created_by_device_id INTEGER
  );`,
  `CREATE TABLE IF NOT EXISTS receipt_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id INTEGER NOT NULL,
    canonical_name TEXT,
    raw_name TEXT,
    quantity INTEGER,
    estimated_category TEXT,
    household_id INTEGER,
    FOREIGN KEY(receipt_id) REFERENCES receipts(id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);`,
  `CREATE TABLE IF NOT EXISTS ask_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT NOT NULL,
    normalized_term TEXT NOT NULL,
    created_at TEXT NOT NULL,
    household_id INTEGER,
    created_by_member_id INTEGER,
    created_by_device_id INTEGER
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ask_history_normalized_term ON ask_history(normalized_term);`,
  `CREATE INDEX IF NOT EXISTS idx_ask_history_created_at ON ask_history(created_at);`,
  `CREATE TABLE IF NOT EXISTS ask_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    normalized_term TEXT NOT NULL,
    answer_level TEXT NOT NULL,
    user_feedback TEXT NOT NULL CHECK(user_feedback IN ('have', 'dont', 'unsure')),
    created_at TEXT NOT NULL,
    household_id INTEGER,
    created_by_member_id INTEGER,
    created_by_device_id INTEGER
  );`,
  `CREATE INDEX IF NOT EXISTS idx_ask_feedback_normalized_term ON ask_feedback(normalized_term);`,
  `CREATE INDEX IF NOT EXISTS idx_ask_feedback_created_at ON ask_feedback(created_at);`,

  // Tiny key/value store for app preferences that don't deserve their own
  // table. Used today for "which household is active" persistence across
  // launches; future use: per-feature flags, last-sync cursors, etc.
  `CREATE TABLE IF NOT EXISTS app_prefs (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL
  );`,
];

// Jest stub for expo-sqlite. The real package can't load outside a
// real RN runtime. Tests that exercise SQL mock the database module
// (@/db/database) explicitly; this stub just keeps the bare import
// resolvable for smoke tests.
export interface SQLiteDatabase {
  runAsync: (...args: unknown[]) => Promise<{ lastInsertRowId: number; changes: number }>;
  execAsync: (sql: string) => Promise<void>;
  getFirstAsync: <T = unknown>(...args: unknown[]) => Promise<T | null>;
  getAllAsync: <T = unknown>(...args: unknown[]) => Promise<T[]>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
}

export async function openDatabaseAsync(): Promise<SQLiteDatabase> {
  throw new Error('expo-sqlite is stubbed in tests; mock @/db/database instead.');
}

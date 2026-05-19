/**
 * Tiny in-memory SQLite stub for the workout-app persistence tests.
 *
 * Implements only the surface our repositories use:
 *   - CREATE TABLE IF NOT EXISTS
 *   - CREATE INDEX IF NOT EXISTS
 *   - INSERT ... ON CONFLICT(...) DO UPDATE SET ... = excluded.<col>
 *   - SELECT ... FROM <table> [WHERE col = ?][ ORDER BY col DESC LIMIT ?]
 *   - PRAGMA table_info(...)
 *   - PRAGMA foreign_keys = ON  (no-op)
 *   - ALTER TABLE ADD COLUMN
 *   - DELETE FROM <table>
 *   - DROP TABLE IF EXISTS <table>
 *
 * This is NOT a general SQLite emulator. It is *just* enough to
 * exercise our DAL deterministically in Node-land Jest, mirroring
 * the pantry app's approach of stubbing the bare expo-sqlite import
 * and mocking the database module instead.
 */

interface TableColumn {
  name: string;
  type: string;
  pkPosition: number; // 1-based, 0 = not part of PK
  notNull: boolean;
}
interface Table {
  name: string;
  columns: TableColumn[];
  primaryKey: string[];
  rows: Record<string, unknown>[];
}

function parseCreateTable(stmt: string): Table | null {
  const m = stmt.match(
    /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]+)\)\s*;?\s*$/i,
  );
  if (!m) return null;
  const name = m[1];
  const body = m[2];

  // Split top-level commas. The body has no nested parens beyond the
  // PRIMARY KEY clause we generate, so a simple split works.
  const parts = splitTopLevel(body);
  const columns: TableColumn[] = [];
  let primaryKey: string[] = [];

  for (const raw of parts) {
    const p = raw.trim();
    if (/^PRIMARY\s+KEY/i.test(p)) {
      const inner = p.match(/\(([^)]+)\)/);
      if (inner) {
        primaryKey = inner[1].split(',').map((s) => s.trim());
      }
      continue;
    }
    const [colName, colTypeAndConstraints] = (() => {
      const i = p.indexOf(' ');
      if (i === -1) return [p, ''];
      return [p.slice(0, i), p.slice(i + 1).trim()];
    })();
    columns.push({
      name: colName,
      type: colTypeAndConstraints.split(/\s+/)[0]?.toUpperCase() ?? 'TEXT',
      pkPosition: 0,
      notNull: /\bNOT\s+NULL\b/i.test(colTypeAndConstraints),
    });
  }
  // Composite PRIMARY KEY (a, b)
  if (primaryKey.length > 0) {
    primaryKey.forEach((c, i) => {
      const col = columns.find((x) => x.name === c);
      if (col) col.pkPosition = i + 1;
    });
  } else {
    // Inline PRIMARY KEY on a column
    for (const raw of parts) {
      const p = raw.trim();
      if (/\bPRIMARY\s+KEY\b/i.test(p) && !/^PRIMARY\s+KEY/i.test(p)) {
        const colName = p.split(/\s+/)[0];
        const col = columns.find((x) => x.name === colName);
        if (col) {
          col.pkPosition = 1;
          primaryKey = [colName];
        }
      }
    }
  }

  return { name, columns, primaryKey, rows: [] };
}

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

export class InMemoryDb {
  tables = new Map<string, Table>();

  async execAsync(sql: string): Promise<void> {
    // Multi-statement support (semicolon-separated).
    for (const raw of sql.split(';')) {
      const stmt = raw.trim();
      if (!stmt) continue;
      if (/^PRAGMA\s+foreign_keys/i.test(stmt)) continue;
      if (/^CREATE\s+TABLE/i.test(stmt)) {
        const t = parseCreateTable(stmt + ';');
        if (t && !this.tables.has(t.name)) this.tables.set(t.name, t);
        continue;
      }
      if (/^CREATE\s+INDEX/i.test(stmt)) {
        // No-op — we don't enforce indexes in the stub.
        continue;
      }
      if (/^ALTER\s+TABLE/i.test(stmt)) {
        const m = stmt.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\s+(\w+)/i);
        if (m) {
          const t = this.tables.get(m[1]);
          if (t && !t.columns.find((c) => c.name === m[2])) {
            t.columns.push({ name: m[2], type: m[3].toUpperCase(), pkPosition: 0, notNull: false });
          }
        }
        continue;
      }
      if (/^DROP\s+TABLE/i.test(stmt)) {
        const m = stmt.match(/DROP\s+TABLE\s+IF\s+EXISTS\s+(\w+)/i);
        if (m) this.tables.delete(m[1]);
        continue;
      }
      if (/^DELETE\s+FROM/i.test(stmt)) {
        const m = stmt.match(/DELETE\s+FROM\s+(\w+)/i);
        if (m) {
          const t = this.tables.get(m[1]);
          if (t) t.rows = [];
        }
        continue;
      }
      throw new Error(`InMemoryDb.execAsync: unsupported statement: ${stmt}`);
    }
  }

  async runAsync(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const trimmed = sql.trim().replace(/;+$/g, '');
    if (/^INSERT\s+INTO/i.test(trimmed)) {
      return this.handleInsert(trimmed, params);
    }
    if (/^UPDATE/i.test(trimmed)) {
      throw new Error('InMemoryDb: bare UPDATE not implemented (only via ON CONFLICT)');
    }
    throw new Error(`InMemoryDb.runAsync: unsupported statement: ${trimmed}`);
  }

  private handleInsert(
    sql: string,
    params: readonly unknown[],
  ): { lastInsertRowId: number; changes: number } {
    const m = sql.match(
      /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(?:\s+ON\s+CONFLICT\(([^)]+)\)\s+DO\s+UPDATE\s+SET\s+([\s\S]+))?/i,
    );
    if (!m) throw new Error(`Cannot parse INSERT: ${sql}`);
    const tableName = m[1];
    const cols = m[2].split(',').map((s) => s.trim());
    const conflictCols = m[4] ? m[4].split(',').map((s) => s.trim()) : null;
    const updateClause = m[5] ?? null;
    const t = this.tables.get(tableName);
    if (!t) throw new Error(`Unknown table: ${tableName}`);

    const row: Record<string, unknown> = {};
    cols.forEach((c, i) => {
      row[c] = params[i] ?? null;
    });

    const conflictKey = conflictCols ?? t.primaryKey;
    const matchIndex = t.rows.findIndex((r) =>
      conflictKey.every((c) => r[c] === row[c]),
    );

    if (matchIndex === -1) {
      t.rows.push({ ...row });
      return { lastInsertRowId: t.rows.length, changes: 1 };
    }
    // ON CONFLICT branch — apply updateClause.
    if (!updateClause) {
      // No update spec → no-op upsert.
      return { lastInsertRowId: matchIndex + 1, changes: 0 };
    }
    const existing = t.rows[matchIndex];
    const updated = { ...existing };
    for (const assign of updateClause.split(',')) {
      const am = assign.trim().match(/(\w+)\s*=\s*excluded\.(\w+)/i);
      if (!am) continue;
      updated[am[1]] = row[am[2]];
    }
    t.rows[matchIndex] = updated;
    return { lastInsertRowId: matchIndex + 1, changes: 1 };
  }

  async getFirstAsync<T = unknown>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, params);
    return rows[0] ?? null;
  }

  async getAllAsync<T = unknown>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const trimmed = sql.trim().replace(/;+$/g, '');
    // PRAGMA table_info
    const pragma = trimmed.match(/^PRAGMA\s+table_info\((\w+)\)/i);
    if (pragma) {
      const t = this.tables.get(pragma[1]);
      if (!t) return [];
      return t.columns.map((c) => ({ name: c.name } as unknown as T));
    }
    const m = trimmed.match(
      /^SELECT\s+([\s\S]+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+?))?(?:\s+ORDER\s+BY\s+(\w+)\s+(ASC|DESC))?(?:\s+LIMIT\s+(\?|\d+))?$/i,
    );
    if (!m) throw new Error(`Unsupported SELECT: ${trimmed}`);
    const colsPart = m[1].trim();
    const tableName = m[2];
    const wherePart = m[3]?.trim();
    const orderCol = m[4];
    const orderDir = m[5]?.toUpperCase() ?? 'ASC';
    const limitTok = m[6];

    const t = this.tables.get(tableName);
    if (!t) return [];

    let rows = [...t.rows];
    if (wherePart) {
      // Support: "col1 = ? AND col2 = ? AND ..."
      const conds = wherePart.split(/\s+AND\s+/i);
      let p = 0;
      const constraints: Array<{ col: string; val: unknown }> = [];
      for (const c of conds) {
        const cm = c.match(/(\w+)\s*=\s*\?/);
        if (!cm) throw new Error(`Unsupported WHERE clause: ${c}`);
        constraints.push({ col: cm[1], val: params[p++] });
      }
      rows = rows.filter((r) =>
        constraints.every((cn) => r[cn.col] === cn.val),
      );
    }
    if (orderCol) {
      rows.sort((a, b) => {
        const av = a[orderCol] as string | number | null;
        const bv = b[orderCol] as string | number | null;
        if (av === bv) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return (av > bv ? 1 : -1) * (orderDir === 'DESC' ? -1 : 1);
      });
    }
    if (limitTok !== undefined) {
      const lim =
        limitTok === '?'
          ? Number(params[params.length - 1] ?? 0)
          : parseInt(limitTok, 10);
      rows = rows.slice(0, Math.max(0, lim));
    }
    // Project columns
    if (colsPart === '*') return rows as T[];
    const requested = colsPart.split(',').map((s) => s.trim());
    return rows.map((r) => {
      const projected: Record<string, unknown> = {};
      for (const c of requested) projected[c] = r[c] ?? null;
      return projected as T;
    });
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    // No nested-transaction semantics in this stub — just run.
    await fn();
  }
}

/** Returns a fresh stub plus a helper that resolves it as the
 *  openDatabaseAsync result. */
export function freshDbStub(): { db: InMemoryDb; open: () => Promise<InMemoryDb> } {
  const db = new InMemoryDb();
  return { db, open: () => Promise.resolve(db) };
}

import { dev } from '$app/environment';

type DB = App.Platform['env']['DB'];

const tableExistsCache = new Map<string, boolean>();
const tableColumnsCache = new Map<string, Set<string>>();

const productionColumnAssumptions = new Map<string, string[]>([
  [
    'users',
    [
      'id',
      'email',
      'email_normalized',
      'password_hash',
      'display_name',
      'username',
      'role',
      'is_active',
      'created_at',
      'updated_at'
    ]
  ],
  ['user_preferences', ['user_id', 'email_updates', 'sms_updates', 'dark_mode', 'language', 'updated_at']]
]);

function cacheKey(tableName: string) {
  return tableName.toLowerCase();
}

function safeIdentifier(value: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return value;
}

export async function hasTable(db: DB, tableName: string) {
  const key = cacheKey(tableName);
  if (!dev) {
    tableExistsCache.set(key, true);
    return true;
  }

  if (tableExistsCache.has(key)) {
    return tableExistsCache.get(key) ?? false;
  }

  const row = await db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
      `
    )
    .bind(tableName)
    .first<{ name: string }>();

  const exists = Boolean(row);
  tableExistsCache.set(key, exists);
  return exists;
}

export async function getTableColumns(db: DB, tableName: string) {
  const table = safeIdentifier(tableName);
  const key = cacheKey(tableName);
  const cached = tableColumnsCache.get(key);
  if (cached) return cached;

  if (!dev) {
    const assumed = productionColumnAssumptions.get(key);
    if (assumed) {
      const result = new Set(assumed);
      tableColumnsCache.set(key, result);
      return result;
    }
  }

  const columns = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const result = new Set((columns.results ?? []).map((column) => column.name));
  tableColumnsCache.set(key, result);
  return result;
}

export async function hasColumn(db: DB, tableName: string, columnName: string) {
  const columns = await getTableColumns(db, tableName);
  return columns.has(columnName);
}

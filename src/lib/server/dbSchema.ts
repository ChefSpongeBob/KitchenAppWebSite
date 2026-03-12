type DB = App.Platform['env']['DB'];

const tableExistsCache = new Map<string, boolean>();
const tableColumnsCache = new Map<string, Set<string>>();

function cacheKey(tableName: string) {
  return tableName.toLowerCase();
}

export async function hasTable(db: DB, tableName: string) {
  const key = cacheKey(tableName);
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
  const key = cacheKey(tableName);
  const cached = tableColumnsCache.get(key);
  if (cached) return cached;

  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all<{ name: string }>();
  const result = new Set((columns.results ?? []).map((column) => column.name));
  tableColumnsCache.set(key, result);
  return result;
}

export async function hasColumn(db: DB, tableName: string, columnName: string) {
  const columns = await getTableColumns(db, tableName);
  return columns.has(columnName);
}

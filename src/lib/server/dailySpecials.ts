import { dev } from '$app/environment';
import { ensureTenantSchema } from '$lib/server/tenant';

export const dailySpecialCategories = ['item-1', 'item-2', 'item-3', 'item-4'] as const;
let dailySpecialsSchemaEnsured = false;

export type DailySpecialCategory = (typeof dailySpecialCategories)[number];

export type DailySpecial = {
  category: DailySpecialCategory;
  label: string;
  content: string;
  updatedAt: number;
  updatedBy: string | null;
};

const labels: Record<DailySpecialCategory, string> = {
  'item-1': 'Highlight 1',
  'item-2': 'Highlight 2',
  'item-3': 'Highlight 3',
  'item-4': 'Highlight 4'
};

export function getDailySpecialLabel(category: DailySpecialCategory) {
  return labels[category];
}

export function getDailySpecialStorageCategory(category: DailySpecialCategory, businessId?: string | null) {
  return businessId ? `${businessId}:${category}` : category;
}

function displayDailySpecialCategory(category: string, businessId?: string | null) {
  const prefix = businessId ? `${businessId}:` : '';
  const normalized = prefix && category.startsWith(prefix) ? category.slice(prefix.length) : category;
  return dailySpecialCategories.includes(normalized as DailySpecialCategory)
    ? (normalized as DailySpecialCategory)
    : null;
}

export async function ensureDailySpecialsSchema(db: App.Platform['env']['DB']) {
  if (!dev) {
    dailySpecialsSchemaEnsured = true;
    return;
  }

  if (dailySpecialsSchemaEnsured) return;
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS daily_specials (
        category TEXT PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        updated_by TEXT,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS daily_specials_editors (
        user_id TEXT PRIMARY KEY,
        granted_by TEXT,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();
  dailySpecialsSchemaEnsured = true;
}

export async function userCanEditDailySpecials(
  db: App.Platform['env']['DB'],
  userId: string | null | undefined,
  role: string | null | undefined,
  businessId?: string | null
) {
  if (!userId) return false;
  if (role === 'admin') return true;
  await ensureTenantSchema(db, true);

  const row = await db
    .prepare(
      `
      SELECT user_id
      FROM daily_specials_editors
      WHERE user_id = ?
        AND (? IS NULL OR business_id = ?)
      LIMIT 1
      `
    )
    .bind(userId, businessId ?? null, businessId ?? null)
    .first<{ user_id: string }>();

  return Boolean(row);
}

export async function loadDailySpecials(db: App.Platform['env']['DB'], businessId?: string | null) {
  await ensureDailySpecialsSchema(db);
  await ensureTenantSchema(db, true);

  const result = await db
    .prepare(
      `
      SELECT category, content, updated_by, updated_at
      FROM daily_specials
      WHERE (? IS NULL OR business_id = ?)
      `
    )
    .bind(businessId ?? null, businessId ?? null)
    .all<{
      category: string;
      content: string;
      updated_by: string | null;
      updated_at: number;
    }>();

  const rows = new Map<
    DailySpecialCategory,
    { content: string; updatedBy: string | null; updatedAt: number; isBusinessKey: boolean }
  >();
  for (const row of result.results ?? []) {
    const category = displayDailySpecialCategory(row.category, businessId);
    if (!category) continue;
    const isBusinessKey = Boolean(businessId && row.category.startsWith(`${businessId}:`));
    const current = rows.get(category);
    if (current?.isBusinessKey && !isBusinessKey) continue;
    rows.set(category, {
      content: row.content,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
      isBusinessKey
    });
  }

  return dailySpecialCategories.map((category) => {
    const current = rows.get(category);
    return {
      category,
      label: getDailySpecialLabel(category),
      content: current?.content ?? '',
      updatedAt: current?.updatedAt ?? 0,
      updatedBy: current?.updatedBy ?? null
    } satisfies DailySpecial;
  });
}

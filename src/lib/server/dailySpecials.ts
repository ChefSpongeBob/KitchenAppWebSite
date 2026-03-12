export const dailySpecialCategories = ['roll', 'nigiri', 'sashimi', 'kitchen'] as const;

export type DailySpecialCategory = (typeof dailySpecialCategories)[number];

export type DailySpecial = {
  category: DailySpecialCategory;
  label: string;
  content: string;
  updatedAt: number;
  updatedBy: string | null;
};

const labels: Record<DailySpecialCategory, string> = {
  roll: 'Roll',
  nigiri: 'Nigiri',
  sashimi: 'Sashimi',
  kitchen: 'Kitchen'
};

export function getDailySpecialLabel(category: DailySpecialCategory) {
  return labels[category];
}

export async function ensureDailySpecialsSchema(db: App.Platform['env']['DB']) {
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
}

export async function userCanEditDailySpecials(
  db: App.Platform['env']['DB'],
  userId: string | null | undefined,
  role: string | null | undefined
) {
  if (!userId) return false;
  if (role === 'admin') return true;

  const row = await db
    .prepare(
      `
      SELECT user_id
      FROM daily_specials_editors
      WHERE user_id = ?
      LIMIT 1
      `
    )
    .bind(userId)
    .first<{ user_id: string }>();

  return Boolean(row);
}

export async function loadDailySpecials(db: App.Platform['env']['DB']) {
  await ensureDailySpecialsSchema(db);

  const result = await db
    .prepare(
      `
      SELECT category, content, updated_by, updated_at
      FROM daily_specials
      `
    )
    .all<{
      category: string;
      content: string;
      updated_by: string | null;
      updated_at: number;
    }>();

  const rows = new Map(
    (result.results ?? []).map((row) => [
      row.category,
      { content: row.content, updatedBy: row.updated_by, updatedAt: row.updated_at }
    ])
  );

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

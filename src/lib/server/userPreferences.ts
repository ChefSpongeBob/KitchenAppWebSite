type D1 = App.Platform['env']['DB'];

export type WelcomeTourVariant = 'admin' | 'user';

async function ensureOptionalColumn(db: D1, tableName: string, columnName: string, definition: string) {
  try {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('duplicate column name') || message.includes('already exists')) {
      return;
    }
    throw error;
  }
}

export async function ensureUserPreferencesSchema(db: D1) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        email_updates INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      `
    )
    .run();

  await ensureOptionalColumn(db, 'user_preferences', 'welcome_tour_completed_at', 'INTEGER');
  await ensureOptionalColumn(db, 'user_preferences', 'welcome_tour_variant', 'TEXT');
}

export async function isWelcomeTourComplete(db: D1, userId: string) {
  await ensureUserPreferencesSchema(db);
  const row = await db
    .prepare(
      `
      SELECT welcome_tour_completed_at
      FROM user_preferences
      WHERE user_id = ?
      LIMIT 1
      `
    )
    .bind(userId)
    .first<{ welcome_tour_completed_at: number | null }>();
  // Existing legacy users might not have a preferences row yet.
  // We treat that as already completed to avoid interrupting active teams.
  if (!row) return true;
  return Boolean(row.welcome_tour_completed_at);
}

export async function markWelcomeTourComplete(db: D1, userId: string, variant: WelcomeTourVariant) {
  await ensureUserPreferencesSchema(db);
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO user_preferences (
        user_id,
        email_updates,
        updated_at,
        welcome_tour_completed_at,
        welcome_tour_variant
      )
      VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(user_id)
      DO UPDATE SET
        updated_at = excluded.updated_at,
        welcome_tour_completed_at = excluded.welcome_tour_completed_at,
        welcome_tour_variant = excluded.welcome_tour_variant
      `
    )
    .bind(userId, now, now, variant)
    .run();
}

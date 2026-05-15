import { dev } from '$app/environment';

type D1 = App.Platform['env']['DB'];

let userPreferencesSchemaEnsured = false;

export type WelcomeTourVariant = 'admin' | 'user';
export type FirstOpenTourVariant = 'user_home' | 'admin_dashboard';

function guidedTourColumnForVariant(variant: FirstOpenTourVariant) {
  return variant === 'admin_dashboard' ? 'admin_tour_completed_at' : 'user_home_tour_completed_at';
}

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
  if (!dev) {
    userPreferencesSchemaEnsured = true;
    return;
  }

  if (userPreferencesSchemaEnsured) return;

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
  await ensureOptionalColumn(db, 'user_preferences', 'user_home_tour_completed_at', 'INTEGER');
  await ensureOptionalColumn(db, 'user_preferences', 'admin_tour_completed_at', 'INTEGER');
  userPreferencesSchemaEnsured = true;
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

export async function isFirstOpenTourComplete(db: D1, userId: string, variant: FirstOpenTourVariant) {
  await ensureUserPreferencesSchema(db);
  const column = guidedTourColumnForVariant(variant);
  const row = await db
    .prepare(
      `
      SELECT ${column} AS completed_at
      FROM user_preferences
      WHERE user_id = ?
      LIMIT 1
      `
    )
    .bind(userId)
    .first<{ completed_at: number | null }>();

  // Keep existing teams uninterrupted: if no preference row exists, treat as complete.
  if (!row) return true;
  return Boolean(row.completed_at);
}

export async function markFirstOpenTourComplete(db: D1, userId: string, variant: FirstOpenTourVariant) {
  await ensureUserPreferencesSchema(db);
  const now = Math.floor(Date.now() / 1000);
  const column = guidedTourColumnForVariant(variant);

  await db
    .prepare(
      `
      INSERT INTO user_preferences (
        user_id,
        email_updates,
        updated_at,
        ${column}
      )
      VALUES (?, 1, ?, ?)
      ON CONFLICT(user_id)
      DO UPDATE SET
        updated_at = excluded.updated_at,
        ${column} = excluded.${column}
      `
    )
    .bind(userId, now, now)
    .run();
}

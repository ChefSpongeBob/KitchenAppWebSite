import { dev } from '$app/environment';

export type HomepageAnnouncement = {
  content: string;
  updatedAt: number;
};
let announcementsSchemaEnsured = false;

function homepageAnnouncementId(businessId?: string | null) {
  return businessId ? `${businessId}:homepage` : 'homepage';
}

async function ensureOptionalColumn(
  db: App.Platform['env']['DB'],
  tableName: string,
  columnName: string,
  definition: string
) {
  try {
    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('duplicate column name') || message.includes('already exists')) return;
    throw error;
  }
}

export async function ensureAnnouncementsSchema(db: App.Platform['env']['DB']) {
  if (!dev) {
    announcementsSchemaEnsured = true;
    return;
  }

  if (announcementsSchemaEnsured) return;
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        updated_by TEXT,
        updated_at INTEGER NOT NULL DEFAULT 0,
        business_id TEXT,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();
  await ensureOptionalColumn(db, 'announcements', 'business_id', 'TEXT');
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_announcements_business_id ON announcements(business_id)`)
    .run();
  announcementsSchemaEnsured = true;
}

export async function loadHomepageAnnouncement(db: App.Platform['env']['DB'], businessId?: string | null) {
  await ensureAnnouncementsSchema(db);

  const id = homepageAnnouncementId(businessId);
  const row = businessId
    ? await db
        .prepare(
          `
          SELECT content, updated_at
          FROM announcements
          WHERE business_id = ? OR id = ?
          ORDER BY CASE WHEN business_id = ? THEN 0 ELSE 1 END
          LIMIT 1
          `
        )
        .bind(businessId, id, businessId)
        .first<{ content: string; updated_at: number }>()
    : await db
        .prepare(
          `
          SELECT content, updated_at
          FROM announcements
          WHERE id = ?
          LIMIT 1
          `
        )
        .bind(id)
        .first<{ content: string; updated_at: number }>();

  return {
    content: row?.content ?? '',
    updatedAt: row?.updated_at ?? 0
  } satisfies HomepageAnnouncement;
}

export function getHomepageAnnouncementId(businessId?: string | null) {
  return homepageAnnouncementId(businessId);
}

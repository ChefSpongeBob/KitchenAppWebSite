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
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS announcement_editors (
        business_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        granted_by TEXT,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (business_id, user_id),
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();
  await ensureOptionalColumn(db, 'announcements', 'business_id', 'TEXT');
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_announcements_business_id ON announcements(business_id)`)
    .run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_announcement_editors_business_id ON announcement_editors(business_id)`)
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

export async function userCanEditHomepageAnnouncement(
  db: App.Platform['env']['DB'],
  userId?: string | null,
  role?: string | null,
  businessId?: string | null
) {
  if (role === 'admin' || role === 'owner' || role === 'manager') return true;
  if (!userId || !businessId) return false;

  await ensureAnnouncementsSchema(db);
  const row = await db
    .prepare(
      `
      SELECT user_id
      FROM announcement_editors
      WHERE business_id = ? AND user_id = ?
      LIMIT 1
      `
    )
    .bind(businessId, userId)
    .first<{ user_id: string }>();

  return Boolean(row);
}

export async function saveHomepageAnnouncement(
  db: App.Platform['env']['DB'],
  businessId: string,
  userId: string | null | undefined,
  content: string
) {
  await ensureAnnouncementsSchema(db);
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
      INSERT INTO announcements (id, content, updated_by, updated_at, business_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at,
        business_id = excluded.business_id
      `
    )
    .bind(homepageAnnouncementId(businessId), content, userId ?? null, now, businessId)
    .run();
}

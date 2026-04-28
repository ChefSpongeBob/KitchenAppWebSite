export type HomepageAnnouncement = {
  content: string;
  updatedAt: number;
};
let announcementsSchemaEnsured = false;

function homepageAnnouncementId(businessId?: string | null) {
  return businessId ? `${businessId}:homepage` : 'homepage';
}

export async function ensureAnnouncementsSchema(db: App.Platform['env']['DB']) {
  if (announcementsSchemaEnsured) return;
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL DEFAULT '',
        updated_by TEXT,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
      `
    )
    .run();
  announcementsSchemaEnsured = true;
}

export async function loadHomepageAnnouncement(db: App.Platform['env']['DB'], businessId?: string | null) {
  await ensureAnnouncementsSchema(db);

  const row = await db
    .prepare(
      `
      SELECT content, updated_at
      FROM announcements
      WHERE id = ?
      LIMIT 1
      `
    )
    .bind(homepageAnnouncementId(businessId))
    .first<{ content: string; updated_at: number }>();

  return {
    content: row?.content ?? '',
    updatedAt: row?.updated_at ?? 0
  } satisfies HomepageAnnouncement;
}

export function getHomepageAnnouncementId(businessId?: string | null) {
  return homepageAnnouncementId(businessId);
}

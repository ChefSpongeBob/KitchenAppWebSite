export type HomepageAnnouncement = {
  content: string;
  updatedAt: number;
};

export async function ensureAnnouncementsSchema(db: App.Platform['env']['DB']) {
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
}

export async function loadHomepageAnnouncement(db: App.Platform['env']['DB']) {
  await ensureAnnouncementsSchema(db);

  const row = await db
    .prepare(
      `
      SELECT content, updated_at
      FROM announcements
      WHERE id = 'homepage'
      LIMIT 1
      `
    )
    .first<{ content: string; updated_at: number }>();

  return {
    content: row?.content ?? '',
    updatedAt: row?.updated_at ?? 0
  } satisfies HomepageAnnouncement;
}

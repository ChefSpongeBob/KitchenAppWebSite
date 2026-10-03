import { hasBusinessCapability, isBusinessAdminRole, type BusinessCapability } from '$lib/server/permissions';
import { dev } from '$app/environment';

export type HomepageAnnouncement = {
  content: string;
  updatedAt: number;
};

export type AnnouncementHistoryEntry = {
  id: string;
  content: string;
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: number;
};

const ANNOUNCEMENT_HISTORY_RETENTION_SECONDS = 60 * 60 * 24 * 30 * 9;
const ANNOUNCEMENT_HISTORY_CLEANUP_INTERVAL_SECONDS = 60 * 60 * 24;
let announcementsSchemaEnsured = false;
const lastHistoryCleanupAtByBusiness = new Map<string, number>();

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
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS announcement_history (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
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
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_announcement_history_business_created
       ON announcement_history(business_id, created_at DESC)`
    )
    .run();
  announcementsSchemaEnsured = true;
}

async function cleanupAnnouncementHistory(
  db: App.Platform['env']['DB'],
  businessId: string,
  force = false
) {
  const now = Math.floor(Date.now() / 1000);
  const lastCleanupAt = lastHistoryCleanupAtByBusiness.get(businessId) ?? 0;
  if (!force && now - lastCleanupAt < ANNOUNCEMENT_HISTORY_CLEANUP_INTERVAL_SECONDS) return;
  const cutoff = now - ANNOUNCEMENT_HISTORY_RETENTION_SECONDS;
  await db
    .prepare(`DELETE FROM announcement_history WHERE business_id = ? AND created_at < ?`)
    .bind(businessId, cutoff)
    .run();
  lastHistoryCleanupAtByBusiness.set(businessId, now);
}

export async function loadAnnouncementHistory(
  db: App.Platform['env']['DB'],
  businessId: string,
  limit = 40
) {
  await ensureAnnouncementsSchema(db);
  await cleanupAnnouncementHistory(db, businessId);
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db
    .prepare(
      `
      SELECT
        h.id,
        h.content,
        h.created_by,
        h.created_at,
        u.display_name AS created_by_name,
        u.email AS created_by_email
      FROM announcement_history h
      LEFT JOIN users u ON u.id = h.created_by
      WHERE h.business_id = ?
      ORDER BY h.created_at DESC
      LIMIT ?
      `
    )
    .bind(businessId, safeLimit)
    .all<{
      id: string;
      content: string;
      created_by: string | null;
      created_at: number;
      created_by_name: string | null;
      created_by_email: string | null;
    }>();

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    content: row.content,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at
  })) satisfies AnnouncementHistoryEntry[];
}

export async function deleteAnnouncementHistoryEntry(
  db: App.Platform['env']['DB'],
  businessId: string,
  historyId: string
) {
  await ensureAnnouncementsSchema(db);
  await db
    .prepare(`DELETE FROM announcement_history WHERE id = ? AND business_id = ?`)
    .bind(historyId, businessId)
    .run();
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
  businessId?: string | null,
  permissionTemplate?: string | null,
  capabilities?: readonly BusinessCapability[] | null
) {
  if (
    (capabilities
      ? hasBusinessCapability(role, permissionTemplate, 'manage_announcements', capabilities)
      : role === 'admin' || isBusinessAdminRole(role))
  ) {
    return true;
  }
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

  const current = await db
    .prepare(`SELECT content FROM announcements WHERE id = ? AND business_id = ? LIMIT 1`)
    .bind(homepageAnnouncementId(businessId), businessId)
    .first<{ content: string }>();
  const statements = [
    db.prepare(
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
  ];

  if (content && content !== current?.content) {
    statements.push(
      db
        .prepare(
          `
          INSERT INTO announcement_history (id, business_id, content, created_by, created_at)
          VALUES (?, ?, ?, ?, ?)
          `
        )
        .bind(crypto.randomUUID(), businessId, content, userId ?? null, now)
    );
  }

  await db.batch(statements);
  await cleanupAnnouncementHistory(db, businessId, true);
}

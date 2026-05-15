import { dev } from '$app/environment';

type D1 = App.Platform['env']['DB'];
type CameraBucket = App.Platform['env']['CAMERA_MEDIA'];

type ColumnInfo = {
  name: string;
};

let lastCameraCleanupAt = 0;
const CAMERA_CLEANUP_BATCH_SIZE = 100;
let cameraSchemaEnsured = false;

async function tableColumns(db: D1, table: string) {
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all<ColumnInfo>();
  return new Set((columns.results ?? []).map((column) => column.name));
}

export async function ensureCameraSchema(db: D1) {
  if (!dev) {
    cameraSchemaEnsured = true;
    return;
  }
  if (cameraSchemaEnsured) return;

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS camera_events (
        id TEXT PRIMARY KEY,
        camera_id TEXT,
        camera_name TEXT,
        event_type TEXT,
        payload_json TEXT,
        image_url TEXT,
        created_at INTEGER NOT NULL
      )
      `
    )
    .run();

  const eventColumns = await tableColumns(db, 'camera_events');
  if (!eventColumns.has('clip_url')) {
    await db.prepare(`ALTER TABLE camera_events ADD COLUMN clip_url TEXT`).run();
  }
  if (!eventColumns.has('clip_duration_seconds')) {
    await db.prepare(`ALTER TABLE camera_events ADD COLUMN clip_duration_seconds INTEGER`).run();
  }

  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS camera_sources (
        id TEXT PRIMARY KEY,
        camera_id TEXT UNIQUE,
        name TEXT NOT NULL,
        live_url TEXT,
        preview_image_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_camera_events_created_at
      ON camera_events(created_at DESC)
      `
    )
    .run();

  await db
    .prepare(
      `
      CREATE INDEX IF NOT EXISTS idx_camera_sources_is_active
      ON camera_sources(is_active, updated_at DESC)
      `
    )
    .run();

  cameraSchemaEnsured = true;
}

export function cameraIngestAuthorized(request: Request, apiKey?: string) {
  return Boolean(apiKey) && request.headers.get('x-api-key') === apiKey;
}

export function extensionFromContentType(contentType: string, fallback = 'bin') {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('mp4')) return 'mp4';
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('ogg')) return 'ogg';
  return fallback;
}

function mediaKeyFromUrl(url: string | null) {
  if (!url) return null;
  const marker = '/api/camera/media/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;
  return url.slice(markerIndex + marker.length);
}

export async function cleanupExpiredCameraMedia(
  db: D1,
  bucket?: CameraBucket,
  now = Math.floor(Date.now() / 1000)
) {
  if (now - lastCameraCleanupAt < 1800) return;
  lastCameraCleanupAt = now;

  const cutoff = now - 60 * 60 * 24 * 7;
  const expired = await db
    .prepare(
      `
      SELECT id, image_url, clip_url
      FROM camera_events
      WHERE created_at < ?
      ORDER BY created_at ASC
      LIMIT ?
      `
    )
    .bind(cutoff, CAMERA_CLEANUP_BATCH_SIZE)
    .all<{ id: string; image_url: string | null; clip_url: string | null }>();

  for (const event of expired.results ?? []) {
    if (bucket) {
      const imageKey = mediaKeyFromUrl(event.image_url);
      const clipKey = mediaKeyFromUrl(event.clip_url);
      if (imageKey) await bucket.delete(imageKey);
      if (clipKey && clipKey !== imageKey) await bucket.delete(clipKey);
    }
  }

  const ids = expired.results ?? [];
  if (!ids.length) return;

  await db.batch(ids.map((event) => db.prepare(`DELETE FROM camera_events WHERE id = ?`).bind(event.id)));
}

export async function deleteCameraEventAssets(
  bucket: CameraBucket | undefined,
  imageUrl: string | null,
  clipUrl: string | null
) {
  if (!bucket) return;
  const imageKey = mediaKeyFromUrl(imageUrl);
  const clipKey = mediaKeyFromUrl(clipUrl);
  if (imageKey) await bucket.delete(imageKey);
  if (clipKey && clipKey !== imageKey) await bucket.delete(clipKey);
}

type D1 = App.Platform['env']['DB'];

type ColumnInfo = {
  name: string;
};

async function tableColumns(db: D1, table: string) {
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all<ColumnInfo>();
  return new Set((columns.results ?? []).map((column) => column.name));
}

export async function ensureCameraSchema(db: D1) {
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
}

export function cameraIngestAuthorized(request: Request, apiKey?: string) {
  if (!apiKey) return true;
  return request.headers.get('x-api-key') === apiKey;
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

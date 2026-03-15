import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { ensureCameraSchema } from '$lib/server/camera';

type CameraEvent = {
  id: string;
  camera_id: string | null;
  camera_name: string | null;
  event_type: string;
  payload_json: string | null;
  image_url: string | null;
  clip_url: string | null;
  clip_duration_seconds: number | null;
  created_at: number;
};

type CameraSource = {
  id: string;
  camera_id: string | null;
  name: string;
  live_url: string | null;
  preview_image_url: string | null;
  is_active: number;
  updated_at: number;
};

export const load: PageServerLoad = async ({ locals, url }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) {
    return { events: [], sources: [], endpoint: '/api/camera/activity', status: url.origin };
  }

  await ensureCameraSchema(db);

  const [events, sources] = await Promise.all([
    db
      .prepare(
        `
        SELECT
          id,
          camera_id,
          camera_name,
          event_type,
          payload_json,
          image_url,
          clip_url,
          clip_duration_seconds,
          created_at
        FROM camera_events
        ORDER BY created_at DESC
        LIMIT 40
        `
      )
      .all<CameraEvent>(),
    db
      .prepare(
        `
        SELECT id, camera_id, name, live_url, preview_image_url, is_active, updated_at
        FROM camera_sources
        ORDER BY is_active DESC, updated_at DESC, name ASC
        `
      )
      .all<CameraSource>()
  ]);

  return {
    events: events.results ?? [],
    sources: sources.results ?? [],
    endpoint: '/api/camera/activity',
    status: url.origin
  };
};

export const actions: Actions = {
  clear_events: async ({ locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    await ensureCameraSchema(db);
    await db.prepare(`DELETE FROM camera_events`).run();
    return { success: true };
  },

  delete_event: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    await ensureCameraSchema(db);
    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing event id.' });

    await db.prepare(`DELETE FROM camera_events WHERE id = ?`).bind(id).run();
    return { success: true };
  },

  save_source: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    await ensureCameraSchema(db);
    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim() || crypto.randomUUID();
    const cameraId = String(formData.get('camera_id') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const liveUrl = String(formData.get('live_url') ?? '').trim();
    const previewImageUrl = String(formData.get('preview_image_url') ?? '').trim();
    const isActive = Number(formData.get('is_active') ?? 1) === 1 ? 1 : 0;

    if (!name) return fail(400, { error: 'Camera name is required.' });

    await db
      .prepare(
        `
        INSERT INTO camera_sources (id, camera_id, name, live_url, preview_image_url, is_active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          camera_id = excluded.camera_id,
          name = excluded.name,
          live_url = excluded.live_url,
          preview_image_url = excluded.preview_image_url,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
        `
      )
      .bind(
        id,
        cameraId || null,
        name,
        liveUrl || null,
        previewImageUrl || null,
        isActive,
        Math.floor(Date.now() / 1000)
      )
      .run();

    return { success: true };
  },

  delete_source: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });

    await ensureCameraSchema(db);
    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing source id.' });

    await db.prepare(`DELETE FROM camera_sources WHERE id = ?`).bind(id).run();
    return { success: true };
  }
};

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { cameraBetaEnabled } from '$lib/config/features';
import { cleanupExpiredCameraMedia, deleteCameraEventAssets, ensureCameraSchema } from '$lib/server/camera';
import { loadIoTDevices } from '$lib/server/iotIngest';
import { ensureTenantSchema, requireBusinessId } from '$lib/server/tenant';

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
  is_active: number;
  updated_at: number;
};

type IoTDevice = Awaited<ReturnType<typeof loadIoTDevices>>[number];

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!cameraBetaEnabled) throw error(404, 'Not found.');
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) {
    return { events: [], sources: [], iotDevices: [] as IoTDevice[] };
  }
  const businessId = requireBusinessId(locals);

  await ensureCameraSchema(db);
  await ensureTenantSchema(db, true);
  await cleanupExpiredCameraMedia(db, platform?.env?.CAMERA_MEDIA);

  const [events, sources, iotDevices] = await Promise.all([
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
        WHERE business_id = ?
        ORDER BY created_at DESC
        LIMIT 40
        `
      )
      .bind(businessId)
      .all<CameraEvent>(),
    db
      .prepare(
        `
        SELECT id, camera_id, name, is_active, updated_at
        FROM camera_sources
        WHERE business_id = ?
        ORDER BY is_active DESC, updated_at DESC, name ASC
        `
      )
      .bind(businessId)
      .all<CameraSource>(),
    loadIoTDevices(db, businessId)
  ]);

  const sourceRows = (sources.results ?? []).map((source) => ({
    ...source,
    camera_id: source.camera_id?.includes(':') ? source.camera_id.split(':').pop() ?? source.camera_id : source.camera_id
  }));

  return {
    events: events.results ?? [],
    sources: sourceRows,
    iotDevices
  };
};

export const actions: Actions = {
  clear_events: async ({ locals, platform }) => {
    if (!cameraBetaEnabled) return fail(404, { error: 'Not found.' });
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    await ensureCameraSchema(db);
    await ensureTenantSchema(db, true);
    const events = await db
      .prepare(`SELECT image_url, clip_url FROM camera_events WHERE business_id = ?`)
      .bind(businessId)
      .all<{ image_url: string | null; clip_url: string | null }>();

    for (const event of events.results ?? []) {
      await deleteCameraEventAssets(platform?.env?.CAMERA_MEDIA, event.image_url, event.clip_url);
    }

    await db.prepare(`DELETE FROM camera_events WHERE business_id = ?`).bind(businessId).run();
    return { success: true };
  },

  delete_event: async ({ request, locals, platform }) => {
    if (!cameraBetaEnabled) return fail(404, { error: 'Not found.' });
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    await ensureCameraSchema(db);
    await ensureTenantSchema(db, true);
    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing event id.' });

    const event = await db
      .prepare(`SELECT image_url, clip_url FROM camera_events WHERE id = ? AND business_id = ? LIMIT 1`)
      .bind(id, businessId)
      .first<{ image_url: string | null; clip_url: string | null }>();

    if (event) {
      await deleteCameraEventAssets(platform?.env?.CAMERA_MEDIA, event.image_url, event.clip_url);
    }

    await db.prepare(`DELETE FROM camera_events WHERE id = ? AND business_id = ?`).bind(id, businessId).run();
    return { success: true };
  }
};

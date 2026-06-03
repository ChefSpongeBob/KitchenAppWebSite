import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { ensureCameraSchema } from '$lib/server/camera';
import { loadIoTDevices, provisionIoTDevice, revokeIoTDevice } from '$lib/server/iotIngest';
import { ensureTenantSchema, requireBusinessId } from '$lib/server/tenant';
import { normalizeDeviceSerial } from '$lib/server/temperatureSensors';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return { iotDevices: [] as Awaited<ReturnType<typeof loadIoTDevices>> };
  const businessId = requireBusinessId(locals);

  await ensureCameraSchema(db);
  await ensureTenantSchema(db, true);

  return {
    iotDevices: await loadIoTDevices(db, businessId)
  };
};

export const actions: Actions = {
  register_iot_unit: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    await ensureCameraSchema(db);
    await ensureTenantSchema(db, true);

    const formData = await request.formData();
    const externalDeviceId = normalizeDeviceSerial(formData.get('external_device_id'));
    const displayName = String(formData.get('display_name') ?? '').trim();

    if (!externalDeviceId) return fail(400, { error: 'Unit serial is required.' });
    if (!displayName) return fail(400, { error: 'Name is required.' });

    await provisionIoTDevice(db, {
      businessId,
      deviceType: 'camera',
      externalDeviceId,
      displayName,
      createdBy: locals.userId ?? null
    });

    await db
      .prepare(
        `
        INSERT INTO camera_sources (id, camera_id, name, live_url, preview_image_url, is_active, updated_at, business_id)
        VALUES (?, ?, ?, NULL, NULL, 1, ?, ?)
        ON CONFLICT(camera_id) DO UPDATE SET
          name = excluded.name,
          is_active = 1,
          updated_at = excluded.updated_at,
          business_id = excluded.business_id
        `
      )
      .bind(crypto.randomUUID(), `${businessId}:${externalDeviceId}`, displayName, Math.floor(Date.now() / 1000), businessId)
      .run();

    return {
      success: true,
      deviceName: displayName
    };
  },

  revoke_iot_device: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing device id.' });

    await revokeIoTDevice(db, businessId, id);
    return { success: true };
  }
};

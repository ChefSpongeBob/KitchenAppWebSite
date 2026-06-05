import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { addNodeName, deleteNodeName, loadAdminNodeNames, requireAdmin } from '$lib/server/admin';
import { ensureCameraSchema } from '$lib/server/camera';
import { loadIoTDevices, provisionIoTDevice, revokeIoTDevice } from '$lib/server/iotIngest';
import { ensureTenantSchema, requireBusinessId } from '$lib/server/tenant';
import { normalizeDeviceSerial, sensorNodeIdFromSerial } from '$lib/server/temperatureSensors';
import {
  acknowledgeTemperatureAlert,
  defaultTemperatureSetting,
  loadActiveTemperatureAlerts,
  loadTemperatureSensorSettings,
  saveTemperatureSensorSetting
} from '$lib/server/temperatureMonitoring';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return { nodeNames: [], iotDevices: [] as Awaited<ReturnType<typeof loadIoTDevices>> };
  const businessId = requireBusinessId(locals);

  await ensureCameraSchema(db);
  await ensureTenantSchema(db, true);

  const [nodeNames, iotDevices, sensorSettings, activeAlerts] = await Promise.all([
    loadAdminNodeNames(db, businessId),
    loadIoTDevices(db, businessId),
    loadTemperatureSensorSettings(db, businessId),
    loadActiveTemperatureAlerts(db, businessId)
  ]);

  return { nodeNames, iotDevices, sensorSettings, activeAlerts };
};

export const actions: Actions = {
  register_gateway: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    await ensureCameraSchema(db);
    await ensureTenantSchema(db, true);

    const formData = await request.formData();
    const externalDeviceId = normalizeDeviceSerial(formData.get('external_device_id'));
    const displayName = String(formData.get('display_name') ?? '').trim();

    if (!externalDeviceId) return fail(400, { error: 'Gateway serial is required.' });
    if (!displayName) return fail(400, { error: 'Name is required.' });

    await provisionIoTDevice(db, {
      businessId,
      deviceType: 'sensor_gateway',
      externalDeviceId,
      displayName,
      createdBy: locals.userId ?? null
    });

    return { success: true, deviceName: displayName };
  },

  register_sensor: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    await ensureCameraSchema(db);
    await ensureTenantSchema(db, true);

    const formData = await request.formData();
    const externalDeviceId = normalizeDeviceSerial(formData.get('external_device_id'));
    const displayName = String(formData.get('display_name') ?? '').trim();
    const sensorId = sensorNodeIdFromSerial(externalDeviceId);

    if (!externalDeviceId) return fail(400, { error: 'Sensor serial is required.' });
    if (!displayName) return fail(400, { error: 'Name is required.' });

    await provisionIoTDevice(db, {
      businessId,
      deviceType: 'sensor',
      externalDeviceId,
      displayName,
      createdBy: locals.userId ?? null
    });

    await db
      .prepare(
        `
        INSERT OR REPLACE INTO sensor_nodes (sensor_id, name, updated_at, business_id)
        VALUES (?, ?, ?, ?)
        `
      )
      .bind(sensorId, displayName, Math.floor(Date.now() / 1000), businessId)
      .run();

    return {
      success: true,
      deviceName: displayName
    };
  },

  save_sensor_settings: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    const formData = await request.formData();
    const sensorId = Number(formData.get('sensor_id'));
    const defaults = defaultTemperatureSetting(sensorId);
    try {
      await saveTemperatureSensorSetting(db, {
        businessId,
        sensorId,
        highThreshold: Number(formData.get('high_threshold') ?? defaults.high_threshold),
        lowThreshold: Number(formData.get('low_threshold') ?? defaults.low_threshold),
        staleAfterMinutes: Number(formData.get('stale_after_minutes') ?? defaults.stale_after_minutes),
        offlineAfterMinutes: Number(formData.get('offline_after_minutes') ?? defaults.offline_after_minutes),
        alertCooldownMinutes: Number(formData.get('alert_cooldown_minutes') ?? defaults.alert_cooldown_minutes),
        isAlertingEnabled: String(formData.get('is_alerting_enabled') ?? '0') === '1',
        updatedBy: locals.userId ?? null
      });
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Alert rules could not be saved.' });
    }

    return { success: true };
  },

  acknowledge_alert: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    const formData = await request.formData();
    const alertId = String(formData.get('alert_id') ?? '').trim();
    if (!alertId) return fail(400, { error: 'Missing alert.' });

    await acknowledgeTemperatureAlert(db, {
      businessId,
      alertId,
      acknowledgedBy: locals.userId ?? null
    });
    return { success: true };
  },

  add_node_name: ({ request, locals }) => {
    requireAdmin(locals.userRole);
    return addNodeName(request, locals);
  },

  delete_node_name: ({ request, locals }) => {
    requireAdmin(locals.userRole);
    return deleteNodeName(request, locals);
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

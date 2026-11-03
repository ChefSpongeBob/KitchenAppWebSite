import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadAdminNodeNames, requireAdmin } from '#lib/server/admin.ts';
import { revokeIoTDevice } from '#lib/server/iotIngest.ts';
import { ensureTenantSchema, requireBusinessId } from '#lib/server/tenant.ts';
import {
  claimTemperatureGateway,
  claimTemperatureSensorNode,
  loadGatewayProvisioningSession,
  loadGatewayConnectionStatus,
  loadTemperatureGateways,
  loadTemperatureSensorNodes,
  revokeTemperatureSensorNode
} from '#lib/server/temperatureDeviceProvisioning.ts';
import {
  defaultTemperatureSetting,
  loadTemperatureSensorSettings,
  saveTemperatureSensorSetting
} from '#lib/server/temperatureMonitoring.ts';
import { checkRateLimit, rateLimitFailure, writeAuditLogSafe } from '#lib/server/security.ts';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return { nodeNames: [], gateways: [], sensorNodes: [], sensorSettings: [] };
  const businessId = requireBusinessId(locals);

  await ensureTenantSchema(db, true);

  const [nodeNames, gateways, sensorNodes, sensorSettings] = await Promise.all([
    loadAdminNodeNames(db, businessId),
    loadTemperatureGateways(db, businessId),
    loadTemperatureSensorNodes(db, businessId),
    loadTemperatureSensorSettings(db, businessId)
  ]);

  return { nodeNames, gateways, sensorNodes, sensorSettings };
};

export const actions: Actions = {
  gateway_setup: async ({ request, locals, getClientAddress, setHeaders }) => {
    requireAdmin(locals.userRole);
    setHeaders({ 'cache-control': 'no-store' });
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);
    const formData = await request.formData();
    const gatewayId = String(formData.get('gateway_id') ?? '').trim();
    if (!gatewayId) return fail(400, { error: 'Choose a gateway.' });

    const limit = await checkRateLimit(db, {
      action: 'gateway-wifi-setup',
      identifier: `${businessId}:${locals.userId ?? 'unknown'}:${gatewayId}`,
      limit: 10,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60
    });
    if (!limit.allowed) return rateLimitFailure('Too many gateway setup attempts. Try again shortly.');

    try {
      const provisioning = await loadGatewayProvisioningSession(db, businessId, gatewayId);
      await writeAuditLogSafe(db, {
        action: 'gateway_wifi_setup_started',
        request,
        getClientAddress,
        businessId,
        actorUserId: locals.userId ?? null,
        metadata: { gatewayId, serial: provisioning.serial }
      });
      return { success: true, provisioning };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Gateway setup could not start.' });
    }
  },

  gateway_connection: async ({ request, locals, setHeaders }) => {
    requireAdmin(locals.userRole);
    setHeaders({ 'cache-control': 'no-store' });
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);
    const formData = await request.formData();
    const gatewayId = String(formData.get('gateway_id') ?? '').trim();
    const startedAt = Number(formData.get('started_at'));
    const now = Math.floor(Date.now() / 1000);
    if (!gatewayId || !Number.isSafeInteger(startedAt) || startedAt <= 0 || startedAt > now || now - startedAt > 86400) {
      return fail(400, { error: 'Start Wi-Fi setup again.' });
    }
    const limit = await checkRateLimit(db, {
      action: 'gateway-connection-check',
      identifier: `${businessId}:${locals.userId ?? 'unknown'}:${gatewayId}`,
      limit: 30,
      windowSeconds: 5 * 60,
      blockSeconds: 60
    });
    if (!limit.allowed) return rateLimitFailure('Please wait before checking again.');
    try {
      const lastSeenAt = await loadGatewayConnectionStatus(db, businessId, gatewayId);
      return { connected: lastSeenAt !== null && lastSeenAt > startedAt && now - lastSeenAt < 600, lastSeenAt };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Connection could not be checked.' });
    }
  },

  register_gateway: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    await ensureTenantSchema(db, true);

    const formData = await request.formData();
    const serial = String(formData.get('external_device_id') ?? '');
    const displayName = String(formData.get('display_name') ?? '').trim();

    if (!displayName) return fail(400, { error: 'Name is required.' });

    try {
      const gateway = await claimTemperatureGateway(db, {
        businessId,
        serial,
        displayName,
        createdBy: locals.userId ?? null
      });
      return { success: true, deviceName: displayName, gatewayId: gateway.id };
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Gateway could not be registered.' });
    }
  },

  register_sensor: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    await ensureTenantSchema(db, true);

    const formData = await request.formData();
    const gatewayDeviceId = String(formData.get('gateway_device_id') ?? '').trim();
    const nodeSerial = String(formData.get('external_device_id') ?? '');
    const displayName = String(formData.get('display_name') ?? '').trim();

    if (!gatewayDeviceId) return fail(400, { error: 'Choose a gateway.' });
    if (!displayName) return fail(400, { error: 'Name is required.' });

    try {
      await claimTemperatureSensorNode(db, {
        businessId,
        gatewayDeviceId,
        nodeSerial,
        displayName,
        createdBy: locals.userId ?? null
      });
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Sensor could not be registered.' });
    }

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
  },

  revoke_sensor_node: async ({ request, locals }) => {
    requireAdmin(locals.userRole);
    const db = locals.DB;
    if (!db) return fail(503, { error: 'Database not configured.' });
    const businessId = requireBusinessId(locals);

    const formData = await request.formData();
    const id = String(formData.get('id') ?? '').trim();
    if (!id) return fail(400, { error: 'Missing sensor.' });

    await revokeTemperatureSensorNode(db, businessId, id);
    return { success: true };
  }
};

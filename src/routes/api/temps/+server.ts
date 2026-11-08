import { json, type RequestHandler } from '@sveltejs/kit';
import { cleanupExpiredTemps } from '#lib/server/retention.ts';
import { allowIoTIngest, authenticateIoTDevice } from '#lib/server/iotIngest.ts';
import { ensureTenantSchema } from '#lib/server/tenant.ts';
import { loadAppFeatureModes } from '#lib/server/appFeatures.ts';
import { normalizeDeviceSerial } from '#lib/server/temperatureSensors.ts';
import { resolveGatewayNodeReadings } from '#lib/server/temperatureDeviceProvisioning.ts';
import { getBusinessTrialAccess } from '#lib/server/trial.ts';
import { logOperationalError } from '#lib/server/observability.ts';
import {
  evaluateTemperatureReadings,
  loadLatestTemperatureSnapshots,
  TEMPERATURE_ONLINE_WINDOW_SECONDS
} from '#lib/server/temperatureMonitoring.ts';

type TempRow = {
  sensor_id: number;
  node_serial?: string;
  temperature: number;
  humidity_pct: number | null;
  packet_sequence: number | null;
  wake_nonce: string | null;
  lqi: number | null;
  battery_mv?: number | null;
  rssi?: number | null;
  ts: number;
};

type RawTempRow = {
  node_serial: string | null;
  temperature: number;
  humidity_pct: number | null;
  packet_sequence: number | null;
  wake_nonce: string | null;
  lqi: number | null;
  ts: number;
  battery_mv: number | null;
  rssi: number | null;
};

const DEFAULT_TEMP_QUERY_LIMIT = 240;
const MAX_TEMP_QUERY_LIMIT = 500;
const MAX_TEMP_BATCH_SIZE = 200;
const MAX_TEMP_BODY_BYTES = 64 * 1024;
const MIN_AHT20_TEMPERATURE_F = -40;
const MAX_AHT20_TEMPERATURE_F = 185;
const TENANT_TEMP_CACHE_CONTROL = 'private, max-age=10, stale-while-revalidate=20';

function numericValue(value: unknown) {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
    ? Number(value) : NaN;
}

function normalizeReading(input: Record<string, unknown>, now: number): RawTempRow | null {
  const serialRaw =
    input.node_serial ??
    input.nodeSerial ??
    input.sensor_serial ??
    input.sensorSerial ??
    input.device_serial ??
    input.deviceSerial;
  const tempRaw = input.temperature ?? input.temp;
  const humidityRaw = input.humidity_pct ?? input.humidityPct ?? input.humidity ?? input.relative_humidity;
  const tsRaw = input.ts ?? input.timestamp ?? now;
  const batteryRaw = input.battery_mv ?? input.batteryMv ?? input.battery;
  const rssiRaw = input.rssi ?? input.signal;
  const sequenceRaw = input.packet_sequence ?? input.packetSequence ?? input.sequence ?? input.seq;
  const nonceRaw = input.wake_nonce ?? input.wakeNonce ?? input.nonce;
  const lqiRaw = input.lqi ?? input.link_quality ?? input.linkQuality;

  const node_serial = normalizeDeviceSerial(String(serialRaw ?? ''));
  const temperature = numericValue(tempRaw);
  const humidity_pct = numericValue(humidityRaw);
  const ts = numericValue(tsRaw);
  const battery_mv = numericValue(batteryRaw);
  const rssi = numericValue(rssiRaw);
  const packet_sequence = numericValue(sequenceRaw);
  const wake_nonce = typeof nonceRaw === 'string' ? nonceRaw.trim() : '';
  const lqi = numericValue(lqiRaw);

  if (typeof serialRaw !== 'string' || node_serial !== serialRaw.trim().toLowerCase() ||
      !node_serial || node_serial.length >= 32 || !Number.isFinite(temperature) ||
      temperature < MIN_AHT20_TEMPERATURE_F || temperature > MAX_AHT20_TEMPERATURE_F ||
      !Number.isSafeInteger(ts) || ts < 1_577_836_800 || ts > now + 60 ||
      !Number.isSafeInteger(packet_sequence) || packet_sequence <= 0 || packet_sequence > 0xffffffff ||
      !wake_nonce || wake_nonce.length > 64) {
    return null;
  }

  return {
    node_serial,
    temperature,
    humidity_pct: Number.isFinite(humidity_pct) && humidity_pct >= 0 && humidity_pct <= 100 ? humidity_pct : null,
    packet_sequence: Number.isInteger(packet_sequence) && packet_sequence >= 0 ? packet_sequence : null,
    wake_nonce: wake_nonce || null,
    lqi: Number.isInteger(lqi) && lqi >= 0 && lqi <= 255 ? lqi : null,
    ts,
    battery_mv: Number.isFinite(battery_mv) ? battery_mv : null,
    rssi: Number.isFinite(rssi) ? rssi : null
  };
}

export const GET: RequestHandler = async ({ url, request, locals }) => {
  const db = locals.env.DB;
  if (!db) {
    return json({ error: 'D1 DB binding is missing' }, { status: 503 });
  }
  await ensureTenantSchema(db);
  const businessId = String(locals.businessId ?? '').trim();
  if (!businessId) {
    return json({ error: 'Workspace required.' }, { status: 401 });
  }

  const requestedLimit = Number(url.searchParams.get('limit') ?? DEFAULT_TEMP_QUERY_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(MAX_TEMP_QUERY_LIMIT, Math.floor(requestedLimit)))
    : DEFAULT_TEMP_QUERY_LIMIT;
  const sensor = url.searchParams.get('sensor');
  const view = url.searchParams.get('view')?.trim().toLowerCase() ?? '';

  if (sensor) {
    const sensorId = Number(sensor);
    const result = await db
      .prepare(
        `
        SELECT sensor_id, temperature, humidity_pct, ts
        FROM temps
        WHERE sensor_id = ? AND business_id = ?
        ORDER BY ts DESC
        LIMIT ?
      `
      )
      .bind(sensorId, businessId, limit)
      .all<TempRow>();
    return json(result.results ?? [], {
      headers: { 'cache-control': TENANT_TEMP_CACHE_CONTROL }
    });
  }

  if (view === 'latest') {
    const latest = await loadLatestTemperatureSnapshots(db, businessId, limit);
    return json(latest, {
      headers: { 'cache-control': TENANT_TEMP_CACHE_CONTROL }
    });
  }

  if (view === 'summary') {
    const [latest, history] = await Promise.all([
      loadLatestTemperatureSnapshots(db, businessId, 25),
      db
        .prepare(
          `
          SELECT sensor_id, temperature, humidity_pct, ts
          FROM temps
          WHERE business_id = ?
          ORDER BY ts DESC
          LIMIT ?
          `
        )
        .bind(businessId, limit)
        .all<TempRow>()
    ]);
    return json(
      {
        latest,
        history: history.results ?? []
      },
      {
        headers: { 'cache-control': TENANT_TEMP_CACHE_CONTROL }
      }
    );
  }

  const result = await db
    .prepare(
      `
      SELECT sensor_id, temperature, humidity_pct, ts
      FROM temps
      WHERE business_id = ?
      ORDER BY ts DESC
      LIMIT ?
    `
    )
    .bind(businessId, limit)
    .all<TempRow>();

  return json(result.results ?? [], {
    headers: { 'cache-control': TENANT_TEMP_CACHE_CONTROL }
  });
};

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const db = locals.env.DB;
  if (!db) {
    return json({ error: 'D1 DB binding is missing' }, { status: 503 });
  }
  await ensureTenantSchema(db);
  const device = await authenticateIoTDevice(db, request, 'sensor_gateway');
  if (!device) {
    return json({ error: 'Gateway credentials required.' }, { status: 401 });
  }
  const businessId = device.businessId;
  const featureModes = await loadAppFeatureModes(db, businessId);
  if (featureModes.temps === 'off') {
    return json({ error: 'Temperature monitoring is disabled for this workspace.' }, { status: 403 });
  }
  if (!(await getBusinessTrialAccess(db, businessId)).allowApp) {
    return json({ error: 'Workspace activation required.' }, { status: 403 });
  }

  let body: unknown;
  try {
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_TEMP_BODY_BYTES) {
      return json({ error: 'Reading payload is too large.' }, { status: 413 });
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_TEMP_BODY_BYTES) {
      return json({ error: 'Reading payload is too large.' }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body && typeof body === 'object' && !Array.isArray(body) &&
      Object.keys(body).length === 1 && (body as { gateway_status?: unknown }).gateway_status === true) {
    return json({ connected: true }, { headers: { 'cache-control': 'no-store' } });
  }

  const rawItems =
    body && typeof body === 'object' && !Array.isArray(body) && Array.isArray((body as { readings?: unknown }).readings)
      ? ((body as { readings: unknown[] }).readings)
      : Array.isArray(body)
        ? body
        : [body];

  if (rawItems.length > MAX_TEMP_BATCH_SIZE) {
    return json({ error: 'Too many readings supplied.' }, { status: 413 });
  }

  const now = Math.floor(Date.now() / 1000);
  const rawReadings = rawItems
    .map((entry) => normalizeReading((entry ?? {}) as Record<string, unknown>, now))
    .filter((entry): entry is RawTempRow => entry !== null);
  if (rawReadings.length !== rawItems.length) {
    return json({ error: 'Invalid reading in batch.' }, { status: 400 });
  }
  const items: TempRow[] = await resolveGatewayNodeReadings(db, {
    businessId, gatewayDeviceId: device.id,
    readings: rawReadings.map(row => ({ nodeSerial: row.node_serial ?? '', temperature: row.temperature,
      humidityPct: row.humidity_pct, packetSequence: row.packet_sequence, wakeNonce: row.wake_nonce,
      lqi: row.lqi, ts: row.ts, batteryMv: row.battery_mv, rssi: row.rssi }))
  });
  const rejected = rawReadings.length - items.length;
  if (items.length === 0) return json({ accepted: 0, rejected, inserted: 0 });

  const packetSignature = items
    .map((row) => `${row.sensor_id}:${row.ts}:${row.packet_sequence ?? ''}:${row.wake_nonce ?? ''}`)
    .sort()
    .join('|');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(packetSignature)));
  const guardKey = `temps:${businessId}:${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const allowed = await allowIoTIngest(db, guardKey, 60, 120);

  if (!allowed) {
    return json(
      {
        error: 'Reading batch is being retried too quickly.'
      },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // Recheck authority/sequence at the write boundary and commit each reading with its node state.
  const statements = items.flatMap((row) => [db
      .prepare(
        `
        INSERT OR IGNORE INTO temps (sensor_id, temperature, humidity_pct, packet_sequence, wake_nonce, lqi, ts, business_id)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?
        FROM temperature_sensor_nodes sn
        JOIN iot_devices g ON g.id = sn.gateway_device_id AND g.business_id = sn.business_id
        WHERE sn.business_id = ? AND sn.gateway_device_id = ? AND sn.node_serial = ? AND sn.sensor_id = ?
          AND sn.is_active = 1 AND sn.revoked_at IS NULL AND g.is_active = 1 AND g.revoked_at IS NULL
          AND (sn.packet_sequence IS NULL OR sn.packet_sequence < ?)
      `
      )
      .bind(
        row.sensor_id,
        row.temperature,
        row.humidity_pct ?? null,
        row.packet_sequence ?? null,
        row.wake_nonce ?? null,
        row.lqi ?? null,
        row.ts,
        businessId,
        businessId, device.id, row.node_serial ?? '', row.sensor_id, row.packet_sequence
      ),
    db.prepare(`
      UPDATE temperature_sensor_nodes
      SET last_seen_at = ?,
          battery_mv = COALESCE(?, battery_mv),
          humidity_pct = COALESCE(?, humidity_pct),
          rssi = COALESCE(?, rssi),
          packet_sequence = COALESCE(?, packet_sequence),
          wake_nonce = COALESCE(?, wake_nonce),
          lqi = COALESCE(?, lqi),
          updated_at = ?
      WHERE changes() = 1 AND business_id = ? AND gateway_device_id = ? AND node_serial = ?
        AND (packet_sequence IS NULL OR packet_sequence < ?)
    `).bind(
      row.ts,
      row.battery_mv ?? null,
      row.humidity_pct,
      row.rssi ?? null,
      row.packet_sequence,
      row.wake_nonce,
      row.lqi,
      now,
      businessId,
      device.id,
      row.node_serial ?? '',
      row.packet_sequence
    )]);

  const results = await db.batch(statements);
  const insertedRows = items.filter((_, index) => (results[index * 2]?.meta?.changes ?? 0) > 0);
  const currentReadings = insertedRows.filter(row => now - row.ts < TEMPERATURE_ONLINE_WINDOW_SECONDS);
  try {
    if (currentReadings.length > 0) await evaluateTemperatureReadings(db, {
      businessId, deviceId: device.externalDeviceId, readings: currentReadings
    });
  } catch (error) {
    logOperationalError({ event: 'temperature_rule_evaluation_failed', request, businessId, error });
  }
  try { await cleanupExpiredTemps(db); }
  catch (error) { logOperationalError({ event: 'temperature_cleanup_failed', request, businessId, error }); }
  return json({ accepted: insertedRows.length, rejected: rawItems.length - insertedRows.length, inserted: insertedRows.length }, { status: insertedRows.length ? 201 : 200 });
};

import { json, type RequestHandler } from '@sveltejs/kit';
import { cleanupExpiredTemps } from '$lib/server/retention';
import { allowIoTIngest, authenticateIoTDevice } from '$lib/server/iotIngest';
import { ensureTenantSchema } from '$lib/server/tenant';
import { normalizeDeviceSerial } from '$lib/server/temperatureSensors';
import { resolveGatewayNodeReading } from '$lib/server/temperatureDeviceProvisioning';
import { recordOperationalEventBestEffort } from '$lib/server/operationalEvents';
import { evaluateTemperatureReadings, type TemperatureReading } from '$lib/server/temperatureMonitoring';

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
const TENANT_TEMP_CACHE_CONTROL = 'private, max-age=10, stale-while-revalidate=20';

function normalizeReading(input: Record<string, unknown>): RawTempRow | null {
  const serialRaw =
    input.node_serial ??
    input.nodeSerial ??
    input.sensor_serial ??
    input.sensorSerial ??
    input.device_serial ??
    input.deviceSerial;
  const tempRaw = input.temperature ?? input.temp;
  const humidityRaw = input.humidity_pct ?? input.humidityPct ?? input.humidity ?? input.relative_humidity;
  const tsRaw = input.ts ?? input.timestamp ?? Math.floor(Date.now() / 1000);
  const batteryRaw = input.battery_mv ?? input.batteryMv ?? input.battery;
  const rssiRaw = input.rssi ?? input.signal;
  const sequenceRaw = input.packet_sequence ?? input.packetSequence ?? input.sequence ?? input.seq;
  const nonceRaw = input.wake_nonce ?? input.wakeNonce ?? input.nonce;
  const lqiRaw = input.lqi ?? input.link_quality ?? input.linkQuality;

  const node_serial = normalizeDeviceSerial(String(serialRaw ?? ''));
  const temperature = Number(tempRaw);
  const humidity_pct = Number(humidityRaw);
  const ts = Number(tsRaw);
  const battery_mv = Number(batteryRaw);
  const rssi = Number(rssiRaw);
  const packet_sequence = Number(sequenceRaw);
  const wake_nonce = String(nonceRaw ?? '').trim().slice(0, 64);
  const lqi = Number(lqiRaw);

  if (!node_serial || !Number.isFinite(temperature) || !Number.isFinite(ts) ||
      !Number.isInteger(packet_sequence) || packet_sequence <= 0 || !wake_nonce) {
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

async function resolveReadingSensor(
  db: App.Platform['env']['DB'],
  businessId: string,
  gatewayDeviceId: string,
  row: RawTempRow
): Promise<TempRow | null> {
  return resolveGatewayNodeReading(db, {
    businessId,
    gatewayDeviceId,
    nodeSerial: row.node_serial ?? '',
    temperature: row.temperature,
    humidityPct: row.humidity_pct,
    packetSequence: row.packet_sequence,
    wakeNonce: row.wake_nonce,
    lqi: row.lqi,
    ts: row.ts,
    batteryMv: row.battery_mv,
    rssi: row.rssi
  });
}

export const GET: RequestHandler = async ({ platform, url, request, locals }) => {
  const db = platform?.env?.DB;
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

export const POST: RequestHandler = async ({ platform, request, url, locals }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ error: 'D1 DB binding is missing' }, { status: 503 });
  }
  await ensureTenantSchema(db);
  const device = await authenticateIoTDevice(db, request, 'sensor_gateway');
  if (!device) {
    return json({ error: 'Gateway credentials required.' }, { status: 401 });
  }
  const businessId = device.businessId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
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

  const rawReadings = rawItems
    .map((entry) => normalizeReading((entry ?? {}) as Record<string, unknown>))
    .filter((entry): entry is RawTempRow => entry !== null);
  if (rawReadings.length !== rawItems.length) {
    return json({ error: 'Invalid reading in batch.' }, { status: 400 });
  }
  const resolved = await Promise.all(rawReadings.map((entry) => resolveReadingSensor(db, businessId, device.id, entry)));
  const items = resolved.filter((entry): entry is TempRow => entry !== null);
  const rejected = rawReadings.length - items.length;
  if (items.length === 0) return json({ accepted: 0, rejected, inserted: 0 });

  const sensorSignature = items
    .map((row) => row.sensor_id)
    .sort((a, b) => a - b)
    .join(',');
  const timestampSignature = Array.from(new Set(items.map((row) => row.ts)))
    .sort((a, b) => a - b)
    .join(',');
  const packetSignature = items
    .map((row) => `${row.sensor_id}:${row.ts}:${row.packet_sequence ?? ''}:${row.wake_nonce ?? ''}`)
    .sort()
    .join('|');
  const guardKey = `temps:${businessId}:${packetSignature || `${sensorSignature}:${timestampSignature}`}`;
  const allowed = await allowIoTIngest(db, guardKey, 60);

  if (!allowed) {
    return json(
      {
        error: 'Reading batch is being retried too quickly.'
      },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const statements = items.map((row) =>
    db
      .prepare(
        `
        INSERT OR IGNORE INTO temps (sensor_id, temperature, humidity_pct, packet_sequence, wake_nonce, lqi, ts, business_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        businessId
      )
  );

  const results = await db.batch(statements);
  const insertedRows = items.filter((_, index) => (results[index]?.meta?.changes ?? 0) > 0);
  if (insertedRows.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    await db.batch(insertedRows.map((row) => db.prepare(`
      UPDATE temperature_sensor_nodes
      SET last_seen_at = ?,
          battery_mv = COALESCE(?, battery_mv),
          humidity_pct = COALESCE(?, humidity_pct),
          rssi = COALESCE(?, rssi),
          packet_sequence = COALESCE(?, packet_sequence),
          wake_nonce = COALESCE(?, wake_nonce),
          lqi = COALESCE(?, lqi),
          updated_at = ?
      WHERE business_id = ? AND gateway_device_id = ? AND node_serial = ?
        AND (packet_sequence IS NULL OR packet_sequence < ?)
    `).bind(
      now,
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
    )));
  }
  if (insertedRows.length > 0) await evaluateTemperatureReadings(db, {
    businessId,
    deviceId: device.externalDeviceId,
    readings: insertedRows,
    request
  });
  if (insertedRows.length > 0) await recordOperationalEventBestEffort(
    db,
    {
      businessId,
      eventType: 'temperature.reading_batch.received',
      category: 'temperature',
      actorUserId: null,
      subjectType: 'iot_device',
      subjectId: device.externalDeviceId,
      title: 'Temperature readings received',
      dedupeKey: guardKey,
      payload: {
        inserted: insertedRows.length,
        sensors: insertedRows.map((item) => item.sensor_id),
        humidity: insertedRows.some((item) => item.humidity_pct !== null),
        radio: {
          protocol: 'ieee802154',
          packetMetadata: insertedRows.some((item) => item.packet_sequence !== null || item.wake_nonce !== null),
          linkQuality: insertedRows.some((item) => item.lqi !== null)
        }
      }
    },
    request
  );
  await cleanupExpiredTemps(db);
  return json({ accepted: items.length, rejected, inserted: insertedRows.length }, { status: insertedRows.length ? 201 : 200 });
};

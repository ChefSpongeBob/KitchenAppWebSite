import { dev } from '$app/environment';
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
  temperature: number;
  ts: number;
};

type RawTempRow = {
  node_serial: string | null;
  temperature: number;
  ts: number;
  battery_mv: number | null;
  rssi: number | null;
};

const DEFAULT_TEMP_QUERY_LIMIT = 240;
const MAX_TEMP_QUERY_LIMIT = 500;
let tempsIndexesEnsured = false;

async function ensureTempsIndexes(db: App.Platform['env']['DB']) {
  if (!dev) {
    tempsIndexesEnsured = true;
    return;
  }
  if (tempsIndexesEnsured) return;
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_temps_ts_desc ON temps(ts DESC)`).run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_temps_sensor_ts_desc ON temps(sensor_id, ts DESC)`)
    .run();
  tempsIndexesEnsured = true;
}

function normalizeReading(input: Record<string, unknown>): RawTempRow | null {
  const serialRaw =
    input.node_serial ??
    input.nodeSerial ??
    input.sensor_serial ??
    input.sensorSerial ??
    input.device_serial ??
    input.deviceSerial;
  const tempRaw = input.temperature ?? input.temp;
  const tsRaw = input.ts ?? input.timestamp ?? Math.floor(Date.now() / 1000);
  const batteryRaw = input.battery_mv ?? input.batteryMv ?? input.battery;
  const rssiRaw = input.rssi ?? input.signal;

  const node_serial = normalizeDeviceSerial(String(serialRaw ?? ''));
  const temperature = Number(tempRaw);
  const ts = Number(tsRaw);
  const battery_mv = Number(batteryRaw);
  const rssi = Number(rssiRaw);

  if (!node_serial || !Number.isFinite(temperature) || !Number.isFinite(ts)) {
    return null;
  }

  return {
    node_serial,
    temperature,
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
  await ensureTempsIndexes(db);
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
        SELECT sensor_id, temperature, ts
        FROM temps
        WHERE sensor_id = ? AND business_id = ?
        ORDER BY ts DESC
        LIMIT ?
      `
      )
      .bind(sensorId, businessId, limit)
      .all<TempRow>();
    return json(result.results ?? [], {
      headers: { 'cache-control': 'public, max-age=10, s-maxage=10, stale-while-revalidate=20' }
    });
  }

  const result = await db
    .prepare(
      `
      SELECT sensor_id, temperature, ts
      FROM temps
      WHERE business_id = ?
      ORDER BY ts DESC
      LIMIT ?
    `
    )
    .bind(businessId, limit)
    .all<TempRow>();

  return json(result.results ?? [], {
    headers: { 'cache-control': 'public, max-age=10, s-maxage=10, stale-while-revalidate=20' }
  });
};

export const POST: RequestHandler = async ({ platform, request, url, locals }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ error: 'D1 DB binding is missing' }, { status: 503 });
  }
  await ensureTempsIndexes(db);
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
  const rawReadings = rawItems
    .map((entry) => normalizeReading((entry ?? {}) as Record<string, unknown>))
    .filter((entry): entry is RawTempRow => entry !== null);
  const resolved = await Promise.all(rawReadings.map((entry) => resolveReadingSensor(db, businessId, device.id, entry)));
  const items = resolved.filter((entry): entry is TemperatureReading => entry !== null);

  if (items.length === 0) {
    return json({ error: 'No valid readings supplied' }, { status: 400 });
  }

  const sensorSignature = items
    .map((row) => row.sensor_id)
    .sort((a, b) => a - b)
    .join(',');
  const timestampSignature = Array.from(new Set(items.map((row) => row.ts)))
    .sort((a, b) => a - b)
    .join(',');
  const guardKey = `temps:${businessId}:${sensorSignature}:${timestampSignature}`;
  const allowed = await allowIoTIngest(db, guardKey, 60);

  if (!allowed) {
    return json(
      {
        inserted: 0,
        skipped: true,
        message: 'Duplicate temp batch ignored.'
      },
      { status: 202 }
    );
  }

  const statements = items.map((row) =>
    db
      .prepare(
        `
        INSERT INTO temps (sensor_id, temperature, ts, business_id)
        VALUES (?, ?, ?, ?)
      `
      )
      .bind(row.sensor_id, row.temperature, row.ts, businessId)
  );

  await db.batch(statements);
  await evaluateTemperatureReadings(db, {
    businessId,
    deviceId: device.externalDeviceId,
    readings: items,
    request
  });
  await recordOperationalEventBestEffort(
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
        inserted: items.length,
        sensors: items.map((item) => item.sensor_id)
      }
    },
    request
  );
  await cleanupExpiredTemps(db);
  return json({ inserted: items.length }, { status: 201 });
};

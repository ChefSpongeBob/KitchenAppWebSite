import { dev } from '$app/environment';
import { json, type RequestHandler } from '@sveltejs/kit';
import { cleanupExpiredTemps } from '$lib/server/retention';
import { allowIoTIngest, authenticateIoTDevice } from '$lib/server/iotIngest';
import { ensureTenantSchema } from '$lib/server/tenant';

type TempRow = {
  sensor_id: number;
  temperature: number;
  ts: number;
};

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

function normalizeReading(input: Record<string, unknown>): TempRow | null {
  const sensorRaw = input.sensor_id ?? input.sensorId ?? input.node;
  const tempRaw = input.temperature ?? input.temp;
  const tsRaw = input.ts ?? input.timestamp ?? Math.floor(Date.now() / 1000);

  const sensor_id = Number(sensorRaw);
  const temperature = Number(tempRaw);
  const ts = Number(tsRaw);

  if (!Number.isFinite(sensor_id) || !Number.isFinite(temperature) || !Number.isFinite(ts)) {
    return null;
  }

  return { sensor_id, temperature, ts };
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

  const limit = Math.max(1, Math.min(2000, Number(url.searchParams.get('limit') ?? 500)));
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
  const device = await authenticateIoTDevice(db, request, 'sensor');
  if (!device) {
    return json({ error: 'Device credentials required.' }, { status: 401 });
  }
  const businessId = device.businessId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawItems = Array.isArray(body) ? body : [body];
  const items = rawItems
    .map((entry) => normalizeReading((entry ?? {}) as Record<string, unknown>))
    .filter((entry): entry is TempRow => entry !== null);

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
  await cleanupExpiredTemps(db);
  return json({ inserted: items.length }, { status: 201 });
};

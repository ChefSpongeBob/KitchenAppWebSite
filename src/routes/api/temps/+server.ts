import { json, type RequestHandler } from '@sveltejs/kit';

type TempRow = {
  sensor_id: number;
  temperature: number;
  ts: number;
};

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

export const GET: RequestHandler = async ({ platform, url }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ error: 'D1 DB binding is missing' }, { status: 503 });
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
        WHERE sensor_id = ?
        ORDER BY ts DESC
        LIMIT ?
      `
      )
      .bind(sensorId, limit)
      .all<TempRow>();
    return json(result.results ?? []);
  }

  const result = await db
    .prepare(
      `
      SELECT sensor_id, temperature, ts
      FROM temps
      ORDER BY ts DESC
      LIMIT ?
    `
    )
    .bind(limit)
    .all<TempRow>();

  return json(result.results ?? []);
};

export const POST: RequestHandler = async ({ platform, request }) => {
  const db = platform?.env?.DB;
  if (!db) {
    return json({ error: 'D1 DB binding is missing' }, { status: 503 });
  }

  const apiKey = platform?.env?.IOT_API_KEY;
  if (apiKey) {
    const headerKey = request.headers.get('x-api-key');
    if (headerKey !== apiKey) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

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

  const statements = items.map((row) =>
    db
      .prepare(
        `
        INSERT INTO temps (sensor_id, temperature, ts)
        VALUES (?, ?, ?)
      `
      )
      .bind(row.sensor_id, row.temperature, row.ts)
  );

  await db.batch(statements);
  return json({ inserted: items.length }, { status: 201 });
};

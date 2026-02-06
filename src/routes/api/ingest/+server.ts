 import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
  const db = platform?.env?.DB;
  if (!db) return new Response("No DB", { status: 500 });

  const data = await request.json();

  const sensor = Number(data.sensor_id);
  const temp = Number(data.temperature);

  if (isNaN(sensor) || isNaN(temp)) {
    return new Response("Bad data", { status: 400 });
  }

  await db.prepare(
    "INSERT INTO temps (sensor_id, temperature, ts) VALUES (?, ?, ?)"
  )
    .bind(sensor, temp, Date.now())
    .run();

  return new Response("OK");
};

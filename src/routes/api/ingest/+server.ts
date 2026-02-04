import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
  const db = platform!.env.DB;

  const data = await request.json();

  const sensor = Number(data.sensor_id);
  const temp = Number(data.temperature);
  const ts = Date.now();

  if (!sensor || !temp) {
    return new Response("Invalid data", { status: 400 });
  }

  await db.prepare(
    "INSERT INTO temps (sensor_id, temperature, ts) VALUES (?, ?, ?)"
  )
  .bind(sensor, temp, ts)
  .run();

  return new Response("OK");
};

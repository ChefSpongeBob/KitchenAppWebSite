import type { RequestHandler } from './$types';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: cors });
};

export const POST: RequestHandler = async ({ request, platform }) => {
  try {
    if (!platform?.env?.DB) {
      return new Response("DB not bound", { status: 500, headers: cors });
    }

    const db = platform.env.DB;
    const data = await request.json();

    const sensor = Number(data.sensor_id);
    const temp = Number(data.temperature);

    if (isNaN(sensor) || isNaN(temp)) {
      return new Response("Invalid data", { status: 400, headers: cors });
    }

    await db.prepare(
      "INSERT INTO temps (sensor_id, temperature, ts) VALUES (?, ?, ?)"
    )
    .bind(sensor, temp, Date.now())
    .run();

    return new Response("OK", { headers: cors });

  } catch (err) {
    return new Response(String(err), { status: 500, headers: cors });
  }
};

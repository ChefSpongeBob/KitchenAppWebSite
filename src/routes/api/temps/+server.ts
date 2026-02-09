export async function POST({ request, platform }) {
  const db = platform!.env.DB;

  const data = await request.json();

  const { sent_at, readings } = data;

  if (!sent_at || !readings || !Array.isArray(readings)) {
    return new Response("Missing fields or invalid payload", { status: 400 });
  }

  for (const r of readings) {
    const sensor_id = r.node;
    const temperature = r.temperature;

    if (sensor_id === undefined || temperature === undefined) {
      continue; // skip invalid entries
    }

    await db
      .prepare(
        "INSERT INTO temps (sensor_id, temperature, ts) VALUES (?, ?, ?)"
      )
      .bind(sensor_id, temperature, sent_at)
      .run();
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function GET({ platform }) {
  const db = platform!.env.DB;

  const { results } = await db
    .prepare("SELECT * FROM temps ORDER BY ts DESC LIMIT 50")
    .all();

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
}

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
  if (!platform?.env?.DB) {
    return new Response("DB not bound", { status: 500 });
  }

  const { results } = await platform.env.DB
    .prepare(`
      SELECT
        id,
        sensor_id,
        temperature,
        ts
      FROM temps
      ORDER BY ts DESC
      LIMIT 20
    `)
    .all();

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
};

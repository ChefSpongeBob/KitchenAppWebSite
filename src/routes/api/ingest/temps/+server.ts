import type { RequestHandler } from './$types';

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: cors });
};

export const GET: RequestHandler = async ({ platform }) => {
  try {
    if (!platform?.env?.DB) {
      return new Response("DB not bound", { status: 500, headers: cors });
    }

    const db = platform.env.DB;

    const { results } = await db.prepare(
      "SELECT * FROM temps ORDER BY ts DESC LIMIT 200"
    ).all();

    return new Response(JSON.stringify(results), {
      headers: {
        ...cors,
        "Content-Type": "application/json"
      }
    });

  } catch (err) {
    return new Response(String(err), { status: 500, headers: cors });
  }
};

import { json } from '@sveltejs/kit';

export async function GET({ platform }) {
  const db = platform?.env.DB;

  const { results } = await db
    .prepare('SELECT * FROM temps ORDER BY id DESC LIMIT 20')
    .all();

  return json(results);
}

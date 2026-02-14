import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, env }) => {
  const category = params?.category;

  try {
    if (category) {
      // Fetch recipes for category
      const { results } = await env.DB.prepare(
        `SELECT id, title, ingredients, instructions, created_at
         FROM recipes
         WHERE category = ?
         ORDER BY created_at DESC`
      )
      .bind(category)
      .all();

      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Fetch all categories
      const { results } = await env.DB.prepare(
        `SELECT DISTINCT category
         FROM recipes
         ORDER BY category ASC`
      ).all();

      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    console.error('Error fetching data', err);
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
};
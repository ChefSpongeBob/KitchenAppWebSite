import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
    try {
        // D1 query for distinct categories
        const query = 'SELECT DISTINCT category FROM recipes';
        const { results } = await locals.DB.prepare(query).all();

        // Map to proper format for frontend
        const categories = results.map((r: any) => ({
            id: r.category,
            title: r.category.charAt(0).toUpperCase() + r.category.slice(1),
            description: '' // optional, can add descriptions later
        }));

        return new Response(JSON.stringify(categories), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error fetching categories', err);
        return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        });
    }
};
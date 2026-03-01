import type { PageServerLoad, Actions } from './$types';
import { redirect, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userRole !== 'admin') {
		throw redirect(303, '/');
	}

	return {};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (locals.userRole !== 'admin') {
			throw redirect(303, '/');
		}

		const db = locals.DB;
		const formData = await request.formData();

		const title = String(formData.get('title') || '').trim();
		const description = String(formData.get('description') || '').trim();

		if (!title) {
			return fail(400, { error: 'Title required' });
		}

		const now = Math.floor(Date.now() / 1000);
		const id = crypto.randomUUID();

		await db
			.prepare(
				`
			INSERT INTO todos (
				id,
				title,
				description,
				created_by,
				created_at,
				updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?)
		`
			)
			.bind(id, title, description, locals.userId, now, now)
			.run();

		return { success: true };
	}
};
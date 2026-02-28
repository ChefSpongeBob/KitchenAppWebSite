import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// hooks enforces auth; but guard anyway
	if (!locals.userId) throw redirect(303, '/login');

	const db = locals.DB;

	const user = await db
		.prepare(
			`
			SELECT display_name
			FROM users
			WHERE id = ?
		`
		)
		.bind(locals.userId)
		.first();

	return {
		display_name: user?.display_name ?? ''
	};
};

export const actions: Actions = {
	save_username: async ({ request, locals }) => {
		if (!locals.userId) throw redirect(303, '/login');

		const formData = await request.formData();
		const displayName = String(formData.get('display_name') || '').trim();

		if (!displayName) {
			return fail(400, { error: 'Username is required.' });
		}

		const db = locals.DB;
		const now = Math.floor(Date.now() / 1000);

		await db
			.prepare(
				`
			UPDATE users
			SET display_name = ?, updated_at = ?
			WHERE id = ?
		`
			)
			.bind(displayName, now, locals.userId)
			.run();

		return { success: true };
	}
};
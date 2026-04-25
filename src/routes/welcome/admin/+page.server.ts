import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ensureUserPreferencesSchema, markWelcomeTourComplete } from '$lib/server/userPreferences';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userId || !locals.DB) {
		throw redirect(303, '/login');
	}

	if (
		locals.businessRole !== 'owner' &&
		locals.businessRole !== 'admin' &&
		locals.businessRole !== 'manager'
	) {
		throw redirect(303, '/welcome/user');
	}

	return {
		businessName: locals.businessName ?? 'Your Workspace'
	};
};

export const actions: Actions = {
	complete: async ({ locals }) => {
		if (!locals.userId || !locals.DB) {
			return fail(401, { error: 'Session expired. Sign in again.' });
		}

		await ensureUserPreferencesSchema(locals.DB);
		await markWelcomeTourComplete(locals.DB, locals.userId, 'admin');
		throw redirect(303, '/admin?guided=1');
	}
};

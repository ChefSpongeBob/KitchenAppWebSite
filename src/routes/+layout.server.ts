import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.userId) {
		return { user: null };
	}

	return {
		user: {
			id: locals.userId,
			role: locals.userRole
		}
	};
};
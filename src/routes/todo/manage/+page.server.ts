import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  throw redirect(303, '/admin');
};

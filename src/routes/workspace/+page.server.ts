import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadUserBusinessMemberships } from '#lib/server/business.ts';
import { restaurantLandingPath } from '#lib/server/activeBusiness.ts';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.DB || !locals.userId) redirect(303, '/login');
  const businesses = await loadUserBusinessMemberships(locals.DB, locals.userId);
  if (businesses.length === 1) redirect(303, await restaurantLandingPath(locals.DB, locals.userId, businesses[0].businessId));
  return { businesses };
};

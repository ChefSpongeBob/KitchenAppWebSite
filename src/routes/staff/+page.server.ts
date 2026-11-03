import { redirect } from '@sveltejs/kit';
import { requirePlatformStaff } from '#lib/server/platformStaff.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  await requirePlatformStaff(locals);
  redirect(303, '/staff/businesses');
};

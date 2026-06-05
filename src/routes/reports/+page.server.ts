import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { hasReportsAccess } from '$lib/server/permissions';

export const load: PageServerLoad = async ({ locals }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  return {};
};

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { hasBusinessCapability, hasReportsAccess } from '#lib/server/permissions.ts';

export const load: PageServerLoad = async ({ locals }) => {
  if (!hasReportsAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  return {
    canViewTodoLog: hasBusinessCapability(
      locals.businessRole,
      locals.businessPermissionTemplate,
      'manage_content',
      locals.businessCapabilities
    )
  };
};

import type { PageServerLoad } from './$types';
import {
  loadAdminUsers,
  requireAdmin
} from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;

  if (!db) {
    return {
      users: []
    };
  }

  if (!locals.businessId) {
    return { users: [] };
  }

  return {
    users: await loadAdminUsers(db, locals.businessId)
  };
};

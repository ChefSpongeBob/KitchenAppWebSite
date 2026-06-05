import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { hasVendorAccess } from '$lib/server/permissions';
import { requireBusinessId } from '$lib/server/tenant';
import { loadVendors } from '$lib/server/vendors';

export const load: PageServerLoad = async ({ locals }) => {
  if (!hasVendorAccess(locals.businessRole, locals.businessPermissionTemplate, locals.businessCapabilities)) {
    throw redirect(303, '/app');
  }
  const db = locals.DB;
  if (!db) return { vendors: [] };

  const vendors = (await loadVendors(db, requireBusinessId(locals))).filter(
    (vendor) => vendor.isActive === 1
  );

  return { vendors };
};

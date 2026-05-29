import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { requireBusinessId } from '$lib/server/tenant';
import { loadVendors } from '$lib/server/vendors';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return { vendors: [] };

  const vendors = (await loadVendors(db, requireBusinessId(locals))).filter(
    (vendor) => vendor.isActive === 1
  );

  return { vendors };
};

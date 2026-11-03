import type { Actions, PageServerLoad } from './$types';
import { requireAdmin } from '#lib/server/admin.ts';
import { requireBusinessId } from '#lib/server/tenant.ts';
import { createVendor, deleteVendor, loadVendors, updateVendor } from '#lib/server/vendors.ts';

export const load: PageServerLoad = async ({ locals }) => {
  requireAdmin(locals.userRole);
  const db = locals.DB;
  if (!db) return { vendors: [] };

  const vendors = await loadVendors(db, requireBusinessId(locals));
  return { vendors };
};

export const actions: Actions = {
  create_vendor: ({ request, locals }) => createVendor(request, locals),
  update_vendor: ({ request, locals }) => updateVendor(request, locals),
  delete_vendor: ({ request, locals }) => deleteVendor(request, locals)
};

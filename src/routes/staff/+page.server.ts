import { requirePlatformStaff } from '#lib/server/platformStaff.ts';
import { loadStaffOverview } from '#lib/server/platformStaffOverview.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const staff = await requirePlatformStaff(locals);
  return { overview: await loadStaffOverview(locals.DB, staff.role, url) };
};

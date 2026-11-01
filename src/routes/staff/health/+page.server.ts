import type { PageServerLoad } from './$types';
import { requirePlatformStaff } from '$lib/server/platformStaff';
import { loadStaffHealth } from '$lib/server/platformHealth';
import { isEmailConfigured } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals, platform, url, setHeaders }) => {
  const staff = await requirePlatformStaff(locals);
  setHeaders({ 'cache-control': 'no-store' });
  const health = await loadStaffHealth(locals.DB, staff.role, url);
  return { ...health, emailConfigured: health.business && health.canViewDelivery && platform?.env
    ? isEmailConfigured(platform.env) : null };
};

import type { PageServerLoad } from './$types';
import { requirePlatformStaff } from '#lib/server/platformStaff.ts';
import { loadStaffHealth } from '#lib/server/platformHealth.ts';
import { isEmailConfigured } from '#lib/server/email.ts';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const staff = await requirePlatformStaff(locals);
  setHeaders({ 'cache-control': 'no-store' });
  const health = await loadStaffHealth(locals.DB, staff.role, url);
  return { ...health, emailConfigured: health.business && health.canViewDelivery && locals.env
    ? isEmailConfigured(locals.env) : null };
};

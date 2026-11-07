import type { LayoutServerLoad } from './$types';
import { loadStaffStepUp, requirePlatformStaff, STAFF_SESSION_SECONDS } from '#lib/server/platformStaff.ts';

export const load: LayoutServerLoad = async ({ locals, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  const staff = await requirePlatformStaff(locals, undefined, url.pathname === '/staff/security');
  // Initial verification is an authentication screen, not a console workspace.
  if (url.pathname === '/staff/security' && (!locals.sessionId ||
    !await loadStaffStepUp(locals.DB, staff.userId, locals.sessionId, undefined, STAFF_SESSION_SECONDS))) {
    return { staff: null, hasWorkspace: false };
  }
  const membership = await locals.DB.prepare('SELECT business_id FROM business_users WHERE user_id = ? AND is_active = 1 LIMIT 1')
    .bind(staff.userId).first<{ business_id: string }>();
  return { staff, hasWorkspace: Boolean(membership) };
};

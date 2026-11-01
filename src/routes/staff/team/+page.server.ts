import { fail, isHttpError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loadStaffStepUp, requirePlatformStaff, requireStaffStepUp, staffPageNumber, type PlatformStaffRole } from '$lib/server/platformStaff';
import { changeStaffMembership } from '$lib/server/platformStaffAdministration';
import { checkRateLimit, rateLimitFailure } from '$lib/server/security';

export const load: PageServerLoad = async ({ locals, url }) => {
  const staff = await requirePlatformStaff(locals, ['owner']);
  const page = staffPageNumber(url.searchParams.get('page'));
  const rows = await locals.DB.prepare(`SELECT m.user_id, u.display_name, u.email, m.staff_role, m.is_active, m.revision,
      COALESCE(u.is_active, 1) AS account_active FROM platform_staff_members m JOIN users u ON u.id = m.user_id
    ORDER BY m.created_at DESC, m.user_id LIMIT 21 OFFSET ?`).bind((page - 1) * 20)
    .all<{ user_id: string; display_name: string | null; email: string; staff_role: PlatformStaffRole; is_active: number; revision: number; account_active: number }>();
  return { members: rows.results.slice(0, 20), page, hasNext: rows.results.length > 20, currentUser: staff.userId,
    changesUnlocked: Boolean(locals.sessionId && await loadStaffStepUp(locals.DB, staff.userId, locals.sessionId)) };
};

export const actions: Actions = {
  default: async ({ locals, request }) => {
    const staff = await requireStaffStepUp(locals, ['owner']);
    const limit = await checkRateLimit(locals.DB, { action: 'staff-membership-change', identifier: staff.userId,
      limit: 20, windowSeconds: 300, blockSeconds: 60 });
    if (!limit.allowed) return rateLimitFailure('Please wait before changing staff access.');
    const form = await request.formData();
    if (form.get('confirmed') !== 'yes') return fail(400, { error: 'Confirm the staff access change.' });
    const revision = String(form.get('revision') ?? '');
    const active = String(form.get('active') ?? '');
    if (!/^\d+$/.test(revision) || !/^[01]$/.test(active)) return fail(400, { error: 'Choose an access setting.' });
    try {
      await changeStaffMembership(locals.DB, staff, locals.sessionId!, {
        email: String(form.get('email') ?? ''), userId: String(form.get('user_id') ?? ''),
        role: String(form.get('role') ?? '') as PlatformStaffRole, active: Number(active), revision: Number(revision),
        reason: String(form.get('reason') ?? '').trim()
      });
      return { success: true };
    } catch (err) {
      if (isHttpError(err)) return fail(err.status, { error: err.body.message });
      return fail(409, { error: 'Access could not be changed. Keep an active owner and refresh before retrying.' });
    }
  }
};

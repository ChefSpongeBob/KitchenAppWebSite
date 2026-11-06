import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePlatformStaff, requireStaffStepUp, type PlatformStaff } from '#lib/server/platformStaff.ts';
import { loadSupportRequest, readSupportForm, staffSupportContext, updateSupportRequest } from '#lib/server/platformSupport.ts';
import { checkRateLimit } from '#lib/server/security.ts';

async function requestBusiness(db: App.RuntimeEnv['DB'], id: string) {
  if (!id || id.length > 100) error(404, 'Request not found.');
  const row = await db.prepare('SELECT business_id FROM platform_support_requests WHERE id = ?').bind(id).first<{ business_id: string }>();
  if (!row) error(404, 'Request not found.');
  return row.business_id;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const staff = await requirePlatformStaff(locals, ['owner', 'support']);
  const context = staffSupportContext(staff, locals.sessionId!, await requestBusiness(locals.DB, params.id));
  return { detail: await loadSupportRequest(locals.DB, params.id, context, url) };
};

export const actions: Actions = {
  reply: async ({ locals, params, request }) => {
    let staff: PlatformStaff;
    try { staff = await requireStaffStepUp(locals, ['owner', 'support']); }
    catch (err) { if (isHttpError(err)) return fail(err.status, { error: err.body.message }); throw err; }
    const limit = await checkRateLimit(locals.DB, { action: 'staff-support-write', identifier: staff.userId,
      limit: 30, windowSeconds: 300, blockSeconds: 60 });
    if (!limit.allowed) return fail(429, { error: 'Please wait before saving another update.' });
    const businessId = await requestBusiness(locals.DB, params.id);
    const form = await readSupportForm(request);
    if (form.get('business_id') !== businessId) return fail(409, { error: 'The selected business changed. Refresh the request.' });
    try {
      await updateSupportRequest(locals.DB, staffSupportContext(staff, locals.sessionId!, businessId), params.id,
        Object.fromEntries(['body', 'revision', 'visibility', 'status', 'priority'].map(key => [key, form.get(key)])));
    } catch (err) {
      if (isHttpError(err)) return fail(err.status, { error: err.body.message });
      return fail(503, { error: 'The update could not be saved. Try again.' });
    }
    redirect(303, `/staff/support/${encodeURIComponent(params.id)}`);
  }
};

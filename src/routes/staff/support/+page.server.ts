import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePlatformStaff, requireStaffStepUp, type PlatformStaff } from '#lib/server/platformStaff.ts';
import { createSupportRequest, listSupportRequests, readSupportForm, staffSupportContext } from '#lib/server/platformSupport.ts';
import { checkRateLimit } from '#lib/server/security.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
  const staff = await requirePlatformStaff(locals, ['owner', 'support']);
  const businessId = url.searchParams.get('business') ?? '';
  if (businessId.length > 80) error(404, 'Business not found.');
  const business = businessId ? await locals.DB.prepare('SELECT id, name FROM businesses WHERE id = ?').bind(businessId)
    .first<{ id: string; name: string }>() : null;
  if (businessId && !business) error(404, 'Business not found.');
  return { queue: await listSupportRequests(locals.DB, url, { staff }, businessId || undefined), business,
    submissionId: crypto.randomUUID(), creating: url.searchParams.get('new') === '1' };
};

export const actions: Actions = {
  create: async ({ locals, request }) => {
    let staff: PlatformStaff;
    try { staff = await requireStaffStepUp(locals, ['owner', 'support']); }
    catch (err) { if (isHttpError(err)) return fail(err.status, { error: err.body.message }); throw err; }
    const limit = await checkRateLimit(locals.DB, { action: 'staff-support-write', identifier: staff.userId,
      limit: 30, windowSeconds: 300, blockSeconds: 60 });
    if (!limit.allowed) return fail(429, { error: 'Please wait before saving another request.' });
    const form = await readSupportForm(request);
    let id: string;
    try {
      const context = staffSupportContext(staff, locals.sessionId!, String(form.get('business_id') ?? ''));
      id = await createSupportRequest(locals.DB, context,
        Object.fromEntries(['subject', 'body', 'category', 'priority', 'submission_id'].map(key => [key, form.get(key)])));
    } catch (err) {
      if (isHttpError(err)) return fail(err.status, { error: err.body.message });
      return fail(503, { error: 'The support request could not be saved. Try again.' });
    }
    redirect(303, `/staff/support/${encodeURIComponent(id)}`);
  }
};

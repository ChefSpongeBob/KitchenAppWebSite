import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listDeletionRequests, loadDeletionRequest, reviewDeletionRequest } from '#lib/server/deletionRequests.ts';
import { requireStaffStepUp } from '#lib/server/platformStaff.ts';
import { readStaffForm } from '#lib/server/platformStaffForm.ts';
import { checkRateLimit } from '#lib/server/security.ts';
import { logOperationalError } from '#lib/server/observability.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
  try {
    const id = url.searchParams.get('request');
    return id ? { detail: await loadDeletionRequest(locals, id), queue: null }
      : { detail: null, queue: await listDeletionRequests(locals, url) };
  } catch (err) {
    if (isHttpError(err)) throw err;
    logOperationalError({ event: 'deletion_review_read_failed', route: '/staff/deletion-requests', status: 503 });
    error(503, 'Deletion requests are temporarily unavailable.');
  }
};

export const actions: Actions = {
  review: async ({ locals, request, url }) => {
    try {
      const staff = await requireStaffStepUp(locals, ['owner']);
      const limit = await checkRateLimit(locals.DB, { action: 'staff-deletion-review', identifier: staff.userId,
        limit: 30, windowSeconds: 300, blockSeconds: 60 });
      if (!limit.allowed) return fail(429, { error: 'Please wait before saving another review.' });
      const input = await readStaffForm(request);
      await reviewDeletionRequest(locals, url.searchParams.get('request') ?? '', input);
    } catch (err) {
      if (isHttpError(err)) return fail(err.status, { error: err.body.message });
      logOperationalError({ event: 'deletion_review_save_failed', route: '/staff/deletion-requests', status: 503 });
      return fail(503, { error: 'The review could not be saved. Refresh before trying again.' });
    }
    redirect(303, `/staff/deletion-requests?request=${encodeURIComponent(url.searchParams.get('request') ?? '')}`);
  }
};

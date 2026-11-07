import { fail, isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getSessionCookieName, getSessionCookieOptions } from '#lib/server/authCookies.ts';
import { checkRateLimit, rateLimitFailure } from '#lib/server/security.ts';
import { loadStaffStepUp, requirePlatformStaff, requireStaffStepUp, staffReturnPath } from '#lib/server/platformStaff.ts';
import { beginStaffEmailChallenge, maskStaffEmail, pendingStaffEmailChallenge, staffEmailIdentity, verifyStaffEmailChallenge } from '#lib/server/platformStaffEmail.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
  const staff = await requirePlatformStaff(locals, undefined, true);
  const identity = locals.sessionId && await staffEmailIdentity(locals.DB, staff.userId, locals.sessionId);
  if (!identity) redirect(303, '/login?staff=1');
  return { next: staffReturnPath(url.searchParams.get('next')), deliveryFailed: url.searchParams.get('delivery') === 'retry',
    verified: Boolean(await loadStaffStepUp(locals.DB, staff.userId, locals.sessionId!)),
    email: maskStaffEmail(identity.email),
    pending: await pendingStaffEmailChallenge(locals.DB, staff.userId, locals.sessionId!) };
};

export const actions: Actions = {
  default: async ({ locals, request, cookies, url }) => {
    const staff = await requirePlatformStaff(locals, undefined, true);
    if (!locals.sessionId) return fail(401, { error: 'Sign in again.' });
    const form = await request.formData();
    const intent = String(form.get('intent') ?? '');
    if (!['send', 'change_email', 'verify'].includes(intent)) return fail(400, { error: 'Choose a verification option.' });
    const verifying = intent === 'verify';
    if (verifying) {
      const limit = await checkRateLimit(locals.DB, { action: 'staff-email-code-check',
        identifier: staff.userId, limit: 10, windowSeconds: 900, blockSeconds: 900 });
      if (!limit.allowed) return rateLimitFailure('Please wait before trying staff verification again.');
    }
    try {
      if (!verifying) {
        if (intent === 'change_email') await requireStaffStepUp(locals);
        await beginStaffEmailChallenge(locals, String(form.get('password') ?? ''),
          intent === 'change_email' ? 'change_email' : 'sign_in', String(form.get('email') ?? ''));
        return { sent: true };
      }
      const result = await verifyStaffEmailChallenge(locals, String(form.get('challenge') ?? ''), String(form.get('code') ?? '').trim());
      cookies.set(getSessionCookieName(), result.token,
        { ...getSessionCookieOptions(request), maxAge: Math.max(0, result.expiresAt - Math.floor(Date.now() / 1000)) });
      redirect(303, result.emailChanged ? '/staff/security?updated=1' : staffReturnPath(url.searchParams.get('next')));
    } catch (err) {
      if (isRedirect(err)) throw err;
      if (isHttpError(err)) return fail(err.status, { error: err.body.message });
      return fail(503, { error: 'Staff verification is unavailable. Try again shortly.' });
    }
  }
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hashSessionToken, verifyPassword } from '$lib/server/auth';
import { getSessionCookieName, getSessionCookieOptions } from '$lib/server/authCookies';
import { checkRateLimit, rateLimitFailure } from '$lib/server/security';
import { loadStaffStepUp, requirePlatformStaff, staffReturnPath } from '$lib/server/platformStaff';

export const load: PageServerLoad = async ({ locals, url }) => {
  const staff = await requirePlatformStaff(locals, undefined, true);
  return { next: staffReturnPath(url.searchParams.get('next')),
    verified: Boolean(locals.sessionId && await loadStaffStepUp(locals.DB, staff.userId, locals.sessionId)) };
};

export const actions: Actions = {
  default: async ({ locals, request, platform, cookies, url }) => {
    const staff = await requirePlatformStaff(locals, undefined, true);
    const sessionId = locals.sessionId;
    if (!sessionId) return fail(401, { error: 'Sign in again.' });
    const limit = await checkRateLimit(locals.DB, { action: 'staff-password-confirmation', identifier: staff.userId,
      limit: 5, windowSeconds: 900, blockSeconds: 900 });
    if (!limit.allowed) return rateLimitFailure('Please wait before confirming your password again.');
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    if (!password || password.length > 1024) return fail(400, { error: 'Enter your password.' });
    const row = await locals.DB.prepare(`SELECT u.password_hash, m.revision, s.session_token_hash, s.expires_at
      FROM platform_staff_members m JOIN users u ON u.id = m.user_id JOIN sessions s ON s.user_id = u.id
      WHERE m.user_id = ? AND s.id = ? AND m.is_active = 1 AND COALESCE(u.is_active, 1) = 1
        AND s.revoked_at IS NULL AND s.expires_at > ? LIMIT 1`)
      .bind(staff.userId, sessionId, Math.floor(Date.now() / 1000))
      .first<{ password_hash: string; revision: number; session_token_hash: string; expires_at: number }>();
    if (!row?.password_hash) return fail(401, { error: 'Sign in again.' });
    let valid = false;
    try { valid = (await verifyPassword(password, row.password_hash, platform?.env)).valid; }
    catch { return fail(503, { error: 'Password confirmation is unavailable. Try again shortly.' }); }
    if (!valid) return fail(400, { error: 'Password could not be confirmed.' });
    const now = Math.floor(Date.now() / 1000);
    const token = crypto.randomUUID() + crypto.randomUUID();
    const hash = await hashSessionToken(token);
    const results = await locals.DB.batch([
      locals.DB.prepare(`UPDATE sessions SET session_token_hash = ? WHERE id = ? AND user_id = ?
        AND session_token_hash = ? AND revoked_at IS NULL AND expires_at > ?
        AND EXISTS (SELECT 1 FROM platform_staff_members m JOIN users u ON u.id = m.user_id
          WHERE m.user_id = ? AND m.is_active = 1 AND m.revision = ? AND COALESCE(u.is_active, 1) = 1
            AND u.password_hash = ?)`)
        .bind(hash, sessionId, staff.userId, row.session_token_hash, now, staff.userId, row.revision, row.password_hash),
      locals.DB.prepare(`INSERT INTO platform_staff_step_up (session_id, user_id, membership_revision, verified_at)
        SELECT ?, ?, ?, ? WHERE changes() = 1
        ON CONFLICT(session_id) DO UPDATE SET membership_revision = excluded.membership_revision,
          verified_at = excluded.verified_at`)
        .bind(sessionId, staff.userId, row.revision, now),
      locals.DB.prepare(`INSERT INTO platform_staff_audit (id, actor_user_id, target_user_id, action, reason, created_at)
        SELECT ?, ?, ?, 'staff_password_confirmed', 'Session password confirmation', ? WHERE changes() = 1`)
        .bind(crypto.randomUUID(), staff.userId, staff.userId, now)
    ]).catch(() => null);
    if (!results) return fail(503, { error: 'Password confirmation could not be saved. Try again shortly.' });
    if (results[0].meta.changes !== 1) return fail(409, { error: 'Your session changed. Sign in again.' });
    cookies.set(getSessionCookieName(), token, { ...getSessionCookieOptions(request), maxAge: Math.max(0, row.expires_at - now) });
    redirect(303, staffReturnPath(url.searchParams.get('next')));
  }
};

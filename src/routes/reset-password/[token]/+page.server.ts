import { fail, redirect } from '@sveltejs/kit';
import { hashPassword, sha256Hex } from '$lib/server/auth';
import {
  ensurePasswordResetSchema,
  findValidPasswordResetByTokenHash,
  validateNewPassword
} from '$lib/server/passwordReset';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const db = locals.DB;
  if (!db) {
    return { valid: false };
  }

  await ensurePasswordResetSchema(db);
  const tokenHash = await sha256Hex(params.token);
  const reset = await findValidPasswordResetByTokenHash(db, tokenHash);

  return {
    valid: Boolean(reset),
    email: reset?.user_email ?? null
  };
};

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const db = locals.DB;
    if (!db) {
      return fail(503, { error: 'Database is not configured yet.' });
    }

    await ensurePasswordResetSchema(db);

    const tokenHash = await sha256Hex(params.token);
    const reset = await findValidPasswordResetByTokenHash(db, tokenHash);

    if (!reset) {
      return fail(400, { error: 'This reset link is invalid or expired.' });
    }

    const formData = await request.formData();
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirm_password') ?? '');

    const passwordError = validateNewPassword(password, confirmPassword);
    if (passwordError) {
      return passwordError;
    }

    const now = Math.floor(Date.now() / 1000);
    const passwordHash = await hashPassword(password);

    await db.batch([
      db
        .prepare(
          `
          UPDATE users
          SET password_hash = ?, updated_at = ?
          WHERE id = ?
        `
        )
        .bind(passwordHash, now, reset.user_id),
      db
        .prepare(`UPDATE password_resets SET used_at = ? WHERE id = ?`)
        .bind(now, reset.id),
      db
        .prepare(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL`)
        .bind(now, reset.user_id),
      db
        .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
        .bind(now, reset.user_id)
    ]);

    throw redirect(303, '/login?reset=success');
  }
};

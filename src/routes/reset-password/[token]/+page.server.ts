import { dev } from '$app/env';
import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { hashPassword, sha256Hex } from '#lib/server/auth.ts';
import {
  ensurePasswordResetSchema,
  completePasswordReset,
  findValidPasswordResetByTokenHash,
  validateNewPassword
} from '#lib/server/passwordReset.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const db = locals.DB;
  if (!db) {
    return { valid: false };
  }

  try {
    await ensurePasswordResetSchema(db);
    const tokenHash = await sha256Hex(params.token);
    const reset = await findValidPasswordResetByTokenHash(db, tokenHash);

    return {
      valid: Boolean(reset),
      email: reset?.user_email ?? null
    };
  } catch (error) {
    console.error('Password reset load failed.');
    return { valid: false };
  }
};

export const actions: Actions = {
  default: async ({ request, params, locals, getClientAddress }) => {
    try {
      const db = locals.DB;
      if (!db) {
        return fail(503, { error: 'Password reset is temporarily unavailable. Please try again.' });
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

      const passwordHash = await hashPassword(password, locals.env);
      const completed = await completePasswordReset({ db, reset, tokenHash, passwordHash, request, getClientAddress });
      if (!completed) return fail(400, { error: 'This reset link is invalid or expired.' });

      throw redirect(303, '/login?reset=success');
    } catch (error) {
      if (isRedirect(error)) throw error;
      console.error('Password reset submit failed.');
      return fail(503, {
        error: dev ? 'Local password reset failed. Check the dev server log.' : 'Password reset is temporarily unavailable. Please try again.'
      });
    }
  }
};

import { fail, type Actions } from '@sveltejs/kit';
import { sendPasswordResetEmail } from '$lib/server/email';
import {
  createPasswordResetRecord,
  ensurePasswordResetSchema,
  findUserByEmail,
  generatePasswordResetToken,
  genericResetRequestSuccess
} from '$lib/server/passwordReset';
import { sha256Hex } from '$lib/server/auth';

export const actions: Actions = {
  default: async ({ request, locals, platform, url, getClientAddress }) => {
    const formData = await request.formData();
    const email = String(formData.get('email') ?? '').trim().toLowerCase();

    if (!email) {
      return fail(400, { error: 'Enter your email address.' });
    }

    const db = locals.DB;
    if (!db) {
      return fail(503, { error: 'Database is not configured yet.' });
    }

    await ensurePasswordResetSchema(db);

    const user = await findUserByEmail(db, email);

    if (!user || !user.password_hash || user.is_active !== 1) {
      return genericResetRequestSuccess();
    }

    const token = generatePasswordResetToken();
    const tokenHash = await sha256Hex(token);
    const requestedIp = (() => {
      try {
        return getClientAddress?.() ?? null;
      } catch {
        return request.headers.get('cf-connecting-ip') ?? null;
      }
    })();

    await createPasswordResetRecord({
      db,
      userId: user.id,
      email: user.email,
      tokenHash,
      requestedIp
    });

    await sendPasswordResetEmail({
      env: platform?.env,
      origin: url.origin,
      userEmail: user.email,
      displayName: user.display_name,
      resetToken: token
    });

    return genericResetRequestSuccess();
  }
};

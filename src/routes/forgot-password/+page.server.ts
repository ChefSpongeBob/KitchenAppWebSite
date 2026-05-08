import { fail, type Actions } from '@sveltejs/kit';
import { sendPasswordResetEmail } from '$lib/server/email';
import {
	createPasswordResetRecord,
	deletePasswordResetRecordById,
	ensurePasswordResetSchema,
	findUserByEmail,
	generatePasswordResetToken,
	genericResetRequestSuccess
} from '$lib/server/passwordReset';
import { sha256Hex } from '$lib/server/auth';
import {
	checkRateLimit,
	getRequestIpAddress,
	rateLimitFailure,
	writeAuditLog
} from '$lib/server/security';

const MIN_RESET_RESPONSE_MS = 450;

async function finishResetRequest(startedAt: number, email: string) {
	const elapsed = Date.now() - startedAt;
	if (elapsed < MIN_RESET_RESPONSE_MS) {
		await new Promise((resolve) => setTimeout(resolve, MIN_RESET_RESPONSE_MS - elapsed));
	}
	return { ...genericResetRequestSuccess(), email };
}

export const actions: Actions = {
	default: async ({ request, locals, platform, url, getClientAddress }) => {
		const startedAt = Date.now();
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim().toLowerCase();

		if (!email) {
			return fail(400, { error: 'Enter the email address for your account.', email });
		}

		const db = locals.DB;
		if (!db) {
			return fail(503, { error: 'Password reset is temporarily unavailable. Please try again in a moment.', email });
		}

		await ensurePasswordResetSchema(db);

		const ipAddress = getRequestIpAddress(request, getClientAddress);
		const [ipLimit, emailLimit] = await Promise.all([
			checkRateLimit(db, {
				action: 'password_reset_ip',
				identifier: ipAddress,
				limit: 10,
				windowSeconds: 60 * 60,
				blockSeconds: 60 * 60
			}),
			checkRateLimit(db, {
				action: 'password_reset_email',
				identifier: email,
				limit: 4,
				windowSeconds: 60 * 60,
				blockSeconds: 60 * 60
			})
		]);

		if (!ipLimit.allowed || !emailLimit.allowed) {
			await writeAuditLog(db, {
				action: 'password_reset_rate_limited',
				request,
				getClientAddress,
				email
			});
			return rateLimitFailure();
		}

		const user = await findUserByEmail(db, email);

		if (!user || !user.password_hash || user.is_active !== 1) {
			await writeAuditLog(db, {
				action: 'password_reset_requested_unknown_or_inactive',
				request,
				getClientAddress,
				email
			});
			return finishResetRequest(startedAt, email);
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

		const resetRecord = await createPasswordResetRecord({
			db,
			userId: user.id,
			email: user.email,
			tokenHash,
			requestedIp
		});

		const emailResult = await sendPasswordResetEmail({
			env: platform?.env,
			origin: url.origin,
			userEmail: user.email,
			displayName: user.display_name,
			resetToken: token
		});

		if (!emailResult.sent) {
			await deletePasswordResetRecordById(db, resetRecord.id);
			await writeAuditLog(db, {
				action: 'password_reset_email_failed',
				request,
				getClientAddress,
				targetUserId: user.id,
				email
			});
			return fail(503, {
				error: emailResult.reason ?? 'Reset instructions could not be sent right now. Please try again.',
				email
			});
		}

		await writeAuditLog(db, {
			action: 'password_reset_requested',
			request,
			getClientAddress,
			targetUserId: user.id,
			email
		});

		return finishResetRequest(startedAt, email);
	}
};

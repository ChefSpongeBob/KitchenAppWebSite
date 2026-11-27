import { fail, isHttpError, type Actions } from '@sveltejs/kit';
import { dev } from '$app/env';
import { checkRateLimit, getRequestIpAddress, hashedAuditValue } from '#lib/server/security.ts';
import { normalizeFormText } from '#lib/server/inputSanitizer.ts';
import { sendAccountDeletionRequestEmail } from '#lib/server/email.ts';
import { logOperationalError, logOperationalEvent } from '#lib/server/observability.ts';
import { readTextForm } from '#lib/server/textForm.ts';

export const actions: Actions = {
	default: async ({ request, locals, url, getClientAddress }) => {
		let email = '';
		let workspaceName = '';
		let phase = 'read';

		try {
			const db = locals.DB;
			const formData = await readTextForm(request);
			email = normalizeFormText(formData, 'email', { maxLength: 180 }).toLowerCase();
			workspaceName = normalizeFormText(formData, 'workspace_name', { maxLength: 160 });
			const requestScope = String(formData.get('request_scope') ?? 'user').trim();
			const details = normalizeFormText(formData, 'details', { maxLength: 1000, multiline: true });

			if (!db) return fail(503, { error: 'Deletion requests are temporarily unavailable.', email, workspaceName });
			if (!email || !email.includes('@')) {
				return fail(400, { error: 'Enter a valid email.', email, workspaceName });
			}
			if (requestScope !== 'user' && requestScope !== 'workspace') {
				return fail(400, { error: 'Choose a deletion request type.', email, workspaceName });
			}

			const ipAddress = getRequestIpAddress(request, getClientAddress);
			phase = 'rate_limit';
			let limit = { allowed: true, retryAfterSeconds: 0 };
			try {
				limit = await checkRateLimit(db, {
					action: 'account_deletion_request',
					identifier: `${ipAddress}:${email}`,
					limit: 4,
					windowSeconds: 60 * 60,
					blockSeconds: 60 * 60
				});
			} catch (error) {
				if (!dev) throw error;
				logOperationalEvent({ level: 'warn', event: 'account_deletion_rate_limit_unavailable', request,
					route: '/account-deletion', metadata: { phase: 'rate_limit' } });
			}
			if (!limit.allowed) {
				return fail(429, { error: 'Too many requests. Try again later.', email, workspaceName });
			}

			const now = Math.floor(Date.now() / 1000);
			const requestId = crypto.randomUUID();
			phase = 'save';
			await db
				.prepare(
					`
				INSERT INTO account_deletion_requests (
					id,
					email,
					workspace_name,
					request_scope,
					details,
					status,
					requester_user_id,
					requester_business_id,
					ip_hash,
					user_agent_hash,
					created_at,
					updated_at
				)
				VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
				`
				)
				.bind(
					requestId,
					email,
					workspaceName || null,
					requestScope,
					details || null,
					locals.userId ?? null,
					locals.businessId ?? null,
					await hashedAuditValue(ipAddress),
					await hashedAuditValue(request.headers.get('user-agent')),
					now,
					now
				)
				.run();

			// The request is durable; a receipt outage must not ask the person to submit it again.
			try {
				const emailResult = await sendAccountDeletionRequestEmail({
					env: locals.env, origin: url.origin, userEmail: email, workspaceName, requestScope, requestId
				});
				if (!emailResult.sent) throw new Error('Receipt unavailable.');
			} catch {
				logOperationalEvent({ level: 'warn', event: 'account_deletion_receipt_unavailable', request,
					route: '/account-deletion', metadata: { phase: 'notification' } });
			}

			return { success: true };
		} catch (error) {
			if (isHttpError(error)) return fail(error.status, { error: error.body.message, email, workspaceName });
			logOperationalError({ event: 'account_deletion_request_failed', request,
				route: '/account-deletion', status: 503, metadata: { phase } });
			return fail(503, {
				error: dev ? 'Local deletion request failed. Check the dev server log.' : 'Deletion requests are temporarily unavailable.',
				email,
				workspaceName
			});
		}
	}
};

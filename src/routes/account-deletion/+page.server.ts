import { fail, type Actions } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { checkRateLimit, getRequestIpAddress, hashedAuditValue } from '$lib/server/security';

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		let email = '';
		let workspaceName = '';

		try {
			const db = locals.DB;
			const formData = await request.formData();
			email = String(formData.get('email') ?? '').trim().toLowerCase();
			workspaceName = String(formData.get('workspace_name') ?? '').trim();
			const requestScope = String(formData.get('request_scope') ?? 'user').trim();
			const details = String(formData.get('details') ?? '').trim();

			if (!db) return fail(503, { error: 'Deletion requests are temporarily unavailable.', email, workspaceName });
			if (!email || !email.includes('@')) {
				return fail(400, { error: 'Enter a valid email.', email, workspaceName });
			}
			if (requestScope !== 'user' && requestScope !== 'workspace') {
				return fail(400, { error: 'Choose a deletion request type.', email, workspaceName });
			}

			const ipAddress = getRequestIpAddress(request, getClientAddress);
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
				console.warn('Local account deletion rate limit skipped:', error instanceof Error ? error.message : String(error));
			}
			if (!limit.allowed) {
				return fail(429, { error: 'Too many requests. Try again later.', email, workspaceName });
			}

			const now = Math.floor(Date.now() / 1000);
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
					crypto.randomUUID(),
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

			return { success: true };
		} catch (error) {
			console.error('Account deletion request failed:', error instanceof Error ? error.message : String(error));
			return fail(503, {
				error: dev ? 'Local deletion request failed. Check the dev server log.' : 'Deletion requests are temporarily unavailable.',
				email,
				workspaceName
			});
		}
	}
};

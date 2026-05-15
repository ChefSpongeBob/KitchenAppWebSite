import { fail, type Actions } from '@sveltejs/kit';
import { checkRateLimit, getRequestIpAddress, hashedAuditValue } from '$lib/server/security';

export const actions: Actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const db = locals.DB;
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '').trim().toLowerCase();
		const workspaceName = String(formData.get('workspace_name') ?? '').trim();
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
		const limit = await checkRateLimit(db, {
			action: 'account_deletion_request',
			identifier: `${ipAddress}:${email}`,
			limit: 4,
			windowSeconds: 60 * 60,
			blockSeconds: 60 * 60
		});
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
	}
};

import { json, type RequestHandler } from '@sveltejs/kit';

function authorized(request: Request, env: App.Platform['env'] | undefined) {
	const token = env?.BILLING_WEBHOOK_TOKEN?.trim();
	if (!token) return true;
	return request.url.includes(`token=${encodeURIComponent(token)}`);
}

function decodeNotificationId(signedPayload: string) {
	try {
		const payload = signedPayload.split('.')[1];
		const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
		const decoded = JSON.parse(atob(padded)) as { notificationUUID?: string; notificationType?: string };
		return {
			eventId: decoded.notificationUUID ?? crypto.randomUUID(),
			eventType: decoded.notificationType ?? 'app_store_notification'
		};
	} catch {
		return { eventId: crypto.randomUUID(), eventType: 'app_store_notification' };
	}
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!authorized(request, platform?.env)) {
		return json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}

	const db = locals.DB ?? platform?.env?.DB;
	if (!db) return json({ ok: false, error: 'Database unavailable.' }, { status: 503 });

	const body = (await request.json().catch(() => ({}))) as { signedPayload?: string };
	const signedPayload = String(body.signedPayload ?? '');
	const notification = decodeNotificationId(signedPayload);
	const now = Math.floor(Date.now() / 1000);

	await db
		.prepare(
			`
      INSERT INTO store_webhook_events (
        id,
        store,
        event_id,
        event_type,
        processed_status,
        raw_payload_json,
        created_at
      )
      VALUES (?, 'app_store', ?, ?, 'pending', ?, ?)
      ON CONFLICT(store, event_id) DO UPDATE SET
        raw_payload_json = excluded.raw_payload_json
    `
		)
		.bind(crypto.randomUUID(), notification.eventId, notification.eventType, JSON.stringify(body), now)
		.run();

	return json({ ok: true });
};

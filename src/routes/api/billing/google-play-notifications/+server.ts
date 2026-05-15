import { json, type RequestHandler } from '@sveltejs/kit';

function authorized(request: Request, env: App.Platform['env'] | undefined) {
	const token = env?.BILLING_WEBHOOK_TOKEN?.trim();
	if (!token) return true;
	return request.url.includes(`token=${encodeURIComponent(token)}`);
}

function decodePubSubMessage(body: Record<string, unknown>) {
	const message = body.message as { data?: string; messageId?: string } | undefined;
	if (!message?.data) {
		return {
			eventId: message?.messageId ?? crypto.randomUUID(),
			eventType: 'google_play_notification',
			payload: body
		};
	}

	try {
		const decoded = JSON.parse(atob(message.data)) as {
			subscriptionNotification?: { notificationType?: number; purchaseToken?: string; subscriptionId?: string };
			testNotification?: unknown;
		};
		return {
			eventId: message.messageId ?? crypto.randomUUID(),
			eventType: decoded.testNotification
				? 'google_play_test_notification'
				: `google_play_subscription_${decoded.subscriptionNotification?.notificationType ?? 'unknown'}`,
			payload: decoded
		};
	} catch {
		return {
			eventId: message.messageId ?? crypto.randomUUID(),
			eventType: 'google_play_notification',
			payload: body
		};
	}
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!authorized(request, platform?.env)) {
		return json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}

	const db = locals.DB ?? platform?.env?.DB;
	if (!db) return json({ ok: false, error: 'Database unavailable.' }, { status: 503 });

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const notification = decodePubSubMessage(body);
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
      VALUES (?, 'google_play', ?, ?, 'pending', ?, ?)
      ON CONFLICT(store, event_id) DO UPDATE SET
        raw_payload_json = excluded.raw_payload_json
    `
		)
		.bind(
			crypto.randomUUID(),
			notification.eventId,
			notification.eventType,
			JSON.stringify(notification.payload),
			now
		)
		.run();

	return json({ ok: true });
};

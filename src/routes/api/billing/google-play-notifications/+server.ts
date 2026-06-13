import { json, type RequestHandler } from '@sveltejs/kit';
import {
	findStoreEntitlementForLifecycle,
	refreshBusinessBillingState,
	sha256Hex,
	updateStoreEntitlementLifecycle,
	type StoreEntitlementStatus
} from '$lib/server/storeBilling';
import { verifyStorePurchase } from '$lib/server/storeVerification';
import { bearerTokenFromRequest, constantTimeTokenEqual } from '$lib/server/requestTokens';

function authorized(request: Request, env: App.Platform['env'] | undefined) {
	const token = env?.BILLING_WEBHOOK_TOKEN?.trim();
	if (!token) return false;

	const bearer = bearerTokenFromRequest(request);
	if (constantTimeTokenEqual(token, bearer)) return true;

	const url = new URL(request.url);
	return constantTimeTokenEqual(token, url.searchParams.get('token'));
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
		const subscription = decoded.subscriptionNotification;
		return {
			eventId: message.messageId ?? crypto.randomUUID(),
			eventType: decoded.testNotification
				? 'google_play_test_notification'
				: `google_play_subscription_${subscription?.notificationType ?? 'unknown'}`,
			payload: decoded,
			subscription
		};
	} catch {
		return {
			eventId: message.messageId ?? crypto.randomUUID(),
			eventType: 'google_play_notification',
			payload: body,
			subscription: undefined
		};
	}
}

function fallbackGoogleStatus(notificationType?: number): {
	status: StoreEntitlementStatus;
	autoRenewing: boolean | null;
} {
	switch (notificationType) {
		case 1: // recovered
		case 2: // renewed
		case 4: // purchased
		case 7: // restarted
		case 8: // price change confirmed
		case 9: // deferred
		case 11: // pause schedule changed
		case 19: // price step-up consent updated
			return { status: 'active', autoRenewing: true };
		case 3: // canceled, usually access remains until expiry
			return { status: 'active', autoRenewing: false };
		case 5:
		case 10:
			return { status: 'past_due', autoRenewing: false };
		case 6:
			return { status: 'grace_period', autoRenewing: true };
		case 12:
			return { status: 'refunded', autoRenewing: false };
		case 13:
			return { status: 'expired', autoRenewing: false };
		case 20:
			return { status: 'canceled', autoRenewing: false };
		default:
			return { status: 'pending_verification', autoRenewing: null };
	}
}

async function markWebhook(
	db: App.Platform['env']['DB'],
	store: 'google_play',
	eventId: string,
	status: 'processed' | 'failed' | 'ignored'
) {
	await db
		.prepare(
			`
      UPDATE store_webhook_events
      SET processed_status = ?,
          processed_at = ?
      WHERE store = ?
        AND event_id = ?
    `
		)
		.bind(status, Math.floor(Date.now() / 1000), store, eventId)
		.run();
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

	const subscription = notification.subscription;
	if (!subscription?.purchaseToken || !subscription.subscriptionId) {
		await markWebhook(db, 'google_play', notification.eventId, 'ignored');
		return json({ ok: true, status: 'ignored' });
	}

	const purchaseTokenHash = await sha256Hex(subscription.purchaseToken);
	const entitlement = await findStoreEntitlementForLifecycle(db, {
		store: 'google_play',
		productId: subscription.subscriptionId,
		purchaseTokenHash
	});
	if (!entitlement) {
		await markWebhook(db, 'google_play', notification.eventId, 'failed');
		return json({ ok: true, status: 'unmatched' }, { status: 202 });
	}

	const verification = await verifyStorePurchase(platform?.env ?? ({ DB: db } as App.Platform['env']), {
		store: 'google_play',
		productId: subscription.subscriptionId,
		purchaseToken: subscription.purchaseToken
	});
	const fallback = fallbackGoogleStatus(subscription.notificationType);
	const status: StoreEntitlementStatus = verification.configured
		? verification.status === 'pending'
			? 'pending_verification'
			: verification.status
		: fallback.status;
	const autoRenewing = verification.configured ? verification.autoRenewing ?? null : fallback.autoRenewing;

	if (verification.configured && !verification.verified && verification.status === 'pending') {
		await markWebhook(db, 'google_play', notification.eventId, 'failed');
		return json({ ok: true, status: 'verification_pending' }, { status: 202 });
	}

	await updateStoreEntitlementLifecycle(db, {
		entitlementId: entitlement.id,
		status,
		currentPeriodStart: verification.currentPeriodStart ?? null,
		currentPeriodEnd: verification.currentPeriodEnd ?? null,
		expiresAt: verification.currentPeriodEnd ?? null,
		autoRenewing,
		rawPayload: { notification: notification.payload, verification: verification.rawPayload ?? null }
	});
	await refreshBusinessBillingState(db, entitlement.business_id);
	await markWebhook(db, 'google_play', notification.eventId, 'processed');

	return json({ ok: true, status: 'processed' });
};

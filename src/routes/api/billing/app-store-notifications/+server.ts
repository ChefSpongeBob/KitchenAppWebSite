import { json, type RequestHandler } from '@sveltejs/kit';
import {
	findStoreEntitlementForLifecycle,
	refreshBusinessBillingState,
	updateStoreEntitlementLifecycle,
	type StoreEntitlementStatus
} from '$lib/server/storeBilling';
import { verifyStorePurchase } from '$lib/server/storeVerification';

function base64UrlDecodeJson<T>(input: string): T {
	const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	return JSON.parse(atob(padded)) as T;
}

function authorized(request: Request, env: App.Platform['env'] | undefined) {
	const token = env?.BILLING_WEBHOOK_TOKEN?.trim();
	if (!token) return false;

	const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
	if (bearer === token) return true;

	const url = new URL(request.url);
	return url.searchParams.get('token') === token;
}

function decodeNotificationId(signedPayload: string) {
	try {
		const decoded = base64UrlDecodeJson<{
			notificationUUID?: string;
			notificationType?: string;
			subtype?: string;
			data?: { signedTransactionInfo?: string; signedRenewalInfo?: string };
		}>(signedPayload.split('.')[1]);
		return {
			eventId: decoded.notificationUUID ?? crypto.randomUUID(),
			eventType: decoded.notificationType ?? 'app_store_notification',
			subtype: decoded.subtype ?? null,
			data: decoded.data ?? null
		};
	} catch {
		return {
			eventId: crypto.randomUUID(),
			eventType: 'app_store_notification',
			subtype: null,
			data: null
		};
	}
}

function decodeTransaction(signedTransactionInfo: string | undefined) {
	if (!signedTransactionInfo) return null;
	try {
		return base64UrlDecodeJson<{
			productId?: string;
			expiresDate?: number;
			purchaseDate?: number;
			transactionId?: string;
			originalTransactionId?: string;
			revocationDate?: number;
		}>(signedTransactionInfo.split('.')[1]);
	} catch {
		return null;
	}
}

function mapAppleStatus(
	notificationType: string,
	subtype: string | null,
	transaction: ReturnType<typeof decodeTransaction>
): { status: StoreEntitlementStatus; autoRenewing: boolean | null } {
	const type = notificationType.toUpperCase();
	const normalizedSubtype = String(subtype ?? '').toUpperCase();
	const now = Date.now();
	const expiresAtMs = Number(transaction?.expiresDate ?? 0);
	const unexpired = !expiresAtMs || expiresAtMs > now;

	if (transaction?.revocationDate || type === 'REFUND' || type === 'REVOKE') {
		return { status: 'refunded', autoRenewing: false };
	}
	if (type === 'EXPIRED' || type === 'GRACE_PERIOD_EXPIRED') {
		return { status: 'expired', autoRenewing: false };
	}
	if (type === 'DID_FAIL_TO_RENEW') {
		return {
			status: normalizedSubtype === 'GRACE_PERIOD' ? 'grace_period' : 'past_due',
			autoRenewing: true
		};
	}
	if (type === 'DID_CHANGE_RENEWAL_STATUS') {
		return {
			status: unexpired ? 'active' : 'expired',
			autoRenewing: normalizedSubtype !== 'AUTO_RENEW_DISABLED'
		};
	}
	if (type === 'DID_RENEW' || type === 'SUBSCRIBED' || type === 'DID_RECOVER') {
		return { status: 'active', autoRenewing: true };
	}
	if (!unexpired) return { status: 'expired', autoRenewing: false };
	return { status: 'active', autoRenewing: null };
}

async function markWebhook(
	db: App.Platform['env']['DB'],
	store: 'app_store',
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

	const transaction = decodeTransaction(notification.data?.signedTransactionInfo);
	if (!transaction?.productId) {
		await markWebhook(db, 'app_store', notification.eventId, 'ignored');
		return json({ ok: true, status: 'ignored' });
	}

	const entitlement = await findStoreEntitlementForLifecycle(db, {
		store: 'app_store',
		productId: transaction.productId,
		originalTransactionId: transaction.originalTransactionId ?? null,
		transactionId: transaction.transactionId ?? null
	});
	if (!entitlement) {
		await markWebhook(db, 'app_store', notification.eventId, 'failed');
		return json({ ok: true, status: 'unmatched' }, { status: 202 });
	}

	const lifecycle = mapAppleStatus(notification.eventType, notification.subtype, transaction);
	const verification = await verifyStorePurchase(platform?.env ?? ({ DB: db } as App.Platform['env']), {
		store: 'app_store',
		productId: transaction.productId,
		originalTransactionId: transaction.originalTransactionId ?? null,
		transactionId: transaction.transactionId ?? null
	});
	if (verification.configured && !verification.verified && verification.status === 'pending') {
		await markWebhook(db, 'app_store', notification.eventId, 'failed');
		return json({ ok: true, status: 'verification_pending' }, { status: 202 });
	}
	const terminalNotification = ['REFUND', 'REVOKE', 'EXPIRED', 'GRACE_PERIOD_EXPIRED'].includes(
		notification.eventType.toUpperCase()
	);
	const status: StoreEntitlementStatus =
		verification.configured && !terminalNotification
			? verification.status === 'pending'
				? lifecycle.status
				: verification.status
			: lifecycle.status;
	const currentPeriodStart = transaction.purchaseDate
		? Math.floor(Number(transaction.purchaseDate) / 1000)
		: null;
	const currentPeriodEnd = transaction.expiresDate
		? Math.floor(Number(transaction.expiresDate) / 1000)
		: null;

	await updateStoreEntitlementLifecycle(db, {
		entitlementId: entitlement.id,
		status,
		currentPeriodStart: verification.currentPeriodStart ?? currentPeriodStart,
		currentPeriodEnd: verification.currentPeriodEnd ?? currentPeriodEnd,
		expiresAt: verification.currentPeriodEnd ?? currentPeriodEnd,
		autoRenewing: verification.autoRenewing ?? lifecycle.autoRenewing,
		originalTransactionId: transaction.originalTransactionId ?? null,
		transactionId: transaction.transactionId ?? null,
		rawPayload: { notification, transaction, verification: verification.rawPayload ?? null }
	});
	await refreshBusinessBillingState(db, entitlement.business_id);
	await markWebhook(db, 'app_store', notification.eventId, 'processed');

	return json({ ok: true, status: 'processed' });
};

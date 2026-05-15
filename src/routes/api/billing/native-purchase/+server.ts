import { json, type RequestHandler } from '@sveltejs/kit';
import {
	normalizeStore,
	activateVerifiedStoreEntitlement,
	applyVerifiedEntitlementsToBusiness,
	readStoreProduct,
	recordStorePurchaseEvent,
	sha256Hex,
	upsertPendingStoreEntitlement
} from '$lib/server/storeBilling';
import { upsertStoreBillingPlaceholder } from '$lib/server/storeBilling';
import { verifyStorePurchase } from '$lib/server/storeVerification';
import { logOperationalError, logOperationalEvent } from '$lib/server/observability';

function canManageBilling(role: string | undefined) {
	return role === 'owner' || role === 'admin';
}

function textValue(value: unknown) {
	return typeof value === 'string' ? value.trim() : '';
}

export const POST: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.DB || !locals.userId || !locals.businessId) {
		return json({ ok: false, error: 'Sign in required.' }, { status: 401 });
	}
	if (!canManageBilling(locals.businessRole)) {
		return json({ ok: false, error: 'Only owner/admin can manage billing.' }, { status: 403 });
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return json({ ok: false, error: 'Invalid purchase payload.' }, { status: 400 });
	}

	const store = normalizeStore(textValue(body.store));
	const productId = textValue(body.productId);
	const purchaseToken = textValue(body.purchaseToken);
	const originalTransactionId = textValue(body.originalTransactionId);
	const transactionId = textValue(body.transactionId);

	if (!store || !productId) {
		return json({ ok: false, error: 'Store and product are required.' }, { status: 400 });
	}
	if (!purchaseToken && !originalTransactionId && !transactionId) {
		return json({ ok: false, error: 'Purchase token or transaction id is required.' }, { status: 400 });
	}

	try {
		const product = await readStoreProduct(locals.DB, store, productId);
		if (!product) {
			return json({ ok: false, error: 'Unknown store product.' }, { status: 400 });
		}

		const sensitiveToken = purchaseToken || originalTransactionId || transactionId;
		const tokenHash = sensitiveToken ? await sha256Hex(sensitiveToken) : null;
		const eventPayload = {
			store,
			productId,
			hasPurchaseToken: Boolean(purchaseToken),
			hasOriginalTransactionId: Boolean(originalTransactionId),
			hasTransactionId: Boolean(transactionId)
		};

		await recordStorePurchaseEvent(locals.DB, {
			businessId: locals.businessId,
			userId: locals.userId,
			store,
			productId,
			purchaseTokenHash: tokenHash,
			originalTransactionId: originalTransactionId || null,
			transactionId: transactionId || null,
			eventType: 'native_purchase_submitted',
			verificationStatus: 'pending_store_configuration',
			rawPayload: eventPayload
		});

		await upsertPendingStoreEntitlement(locals.DB, {
			businessId: locals.businessId,
			ownerUserId: locals.userId,
			product,
			purchaseTokenHash: tokenHash,
			originalTransactionId: originalTransactionId || null,
			transactionId: transactionId || null,
			rawPayload: eventPayload
		});

		const env = platform?.env ?? ({ DB: locals.DB } as App.Platform['env']);
		const verification = await verifyStorePurchase(env, {
			store,
			productId,
			purchaseToken: purchaseToken || null,
			originalTransactionId: originalTransactionId || null,
			transactionId: transactionId || null
		});

		if (verification.verified && verification.status === 'active') {
			await activateVerifiedStoreEntitlement(locals.DB, {
				businessId: locals.businessId,
				store,
				productId,
				currentPeriodStart: verification.currentPeriodStart ?? null,
				currentPeriodEnd: verification.currentPeriodEnd ?? null,
				expiresAt: verification.currentPeriodEnd ?? null,
				autoRenewing: verification.autoRenewing ?? true,
				rawPayload: verification.rawPayload
			});
			await applyVerifiedEntitlementsToBusiness(locals.DB, locals.businessId);
			await recordStorePurchaseEvent(locals.DB, {
				businessId: locals.businessId,
				userId: locals.userId,
				store,
				productId,
				purchaseTokenHash: tokenHash,
				originalTransactionId: originalTransactionId || null,
				transactionId: transactionId || null,
				eventType: 'native_purchase_verified',
				verificationStatus: 'verified',
				rawPayload: verification.rawPayload
			});
		}

		if (product.plan_tier) {
			await upsertStoreBillingPlaceholder(locals.DB, {
				businessId: locals.businessId,
				ownerUserId: locals.userId,
				preferredStore: store,
				planTier: product.plan_tier,
				addOnTempMonitoring: product.addon_temp_monitoring === 1,
				addOnCameraMonitoring: product.addon_camera_monitoring === 1,
				status: verification.verified ? 'active' : 'queued'
			});
		}

		logOperationalEvent({
			level: 'info',
			event: 'native_purchase_pending_verification',
			request,
			businessId: locals.businessId,
			userId: locals.userId,
				status: verification.verified ? 200 : 202,
				metadata: {
					store,
					product_id: productId,
					verified: verification.verified,
					verification_configured: verification.configured
				}
			});

		if (verification.verified) {
			return json(
				{
					ok: true,
					status: 'active',
					message: 'Purchase verified.'
				},
				{ status: 200, headers: { 'cache-control': 'no-store' } }
			);
		}

		return json(
			{
				ok: false,
				status: 'pending_verification',
				message: verification.configured
					? 'Purchase received. Verification pending.'
					: 'Purchase received. Store verification is not configured yet.'
			},
			{ status: 202, headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		logOperationalError({
			event: 'native_purchase_submit_failed',
			request,
			businessId: locals.businessId,
			userId: locals.userId,
			status: 500,
			error,
			message: error instanceof Error ? error.message : String(error ?? '')
		});
		return json({ ok: false, error: 'Could not record purchase.' }, { status: 500 });
	}
};

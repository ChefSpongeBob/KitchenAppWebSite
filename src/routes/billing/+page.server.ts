import { fail, isRedirect, redirect, type Actions } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
	cancelTrialAndPurgeBusiness,
	convertBusinessToPaid,
	ensureTrialSchema,
	getBusinessTrialAccess,
	getRequestIpAddress
} from '$lib/server/trial';
import {
	readBusinessEntitlements,
	readStoreProducts,
	readStoreBillingPlaceholder,
	upsertStoreBillingPlaceholder
} from '$lib/server/storeBilling';
import {
	getSessionCookieDeleteOptions,
	getSessionCookieName
} from '$lib/server/authCookies';
import { logOperationalError, logOperationalEvent } from '$lib/server/observability';
import type { PageServerLoad } from './$types';

const PLAN_TIER_MAP: Record<string, 'starter' | 'growth' | 'enterprise'> = {
	small: 'starter',
	medium: 'growth',
	large: 'enterprise',
	starter: 'starter',
	growth: 'growth',
	enterprise: 'enterprise'
};

function clearSessionCookies(
	cookies: Parameters<Actions['convert']>[0]['cookies'],
	request: Request
) {
	const cookieName = getSessionCookieName();
	const deleteOptions = getSessionCookieDeleteOptions(request);
	cookies.delete(cookieName, deleteOptions);
	cookies.delete('session_id', { path: '/' });
	cookies.delete('session_id_pwa', { path: '/' });
}

function canManageBilling(role: string | undefined) {
	return role === 'owner' || role === 'admin';
}

export const load: PageServerLoad = async ({ locals, platform, url }) => {
	if (!locals.userId || !locals.DB || !locals.businessId) {
		throw redirect(303, '/login');
	}

	await ensureTrialSchema(locals.DB);
	const trial = await getBusinessTrialAccess(locals.DB, locals.businessId);
	const business = await locals.DB
		.prepare(
			`
      SELECT
        name,
        plan_tier,
        addon_temp_monitoring,
        addon_camera_monitoring
      FROM businesses
      WHERE id = ?
      LIMIT 1
    `
		)
		.bind(locals.businessId)
		.first<{
			name: string;
			plan_tier: string;
			addon_temp_monitoring: number;
			addon_camera_monitoring: number;
		}>();

	if (!business) {
		throw redirect(303, '/login?error=session');
	}
	const storeBillingPlaceholder = await readStoreBillingPlaceholder(locals.DB, locals.businessId);
	const storeProducts = await readStoreProducts(locals.DB);
	const storeEntitlements = await readBusinessEntitlements(locals.DB, locals.businessId);
	const activeEntitlements = storeEntitlements.filter((entitlement) => entitlement.status === 'active');
	const activePlanEntitlement = activeEntitlements.find((entitlement) => entitlement.plan_tier);
	const appStoreProductId =
		activeEntitlements.find((entitlement) => entitlement.store === 'app_store')?.product_id ??
		storeProducts.find(
			(product) => product.store === 'app_store' && product.plan_tier === activePlanEntitlement?.plan_tier
		)?.product_id ??
		null;
	const googleProductId =
		activeEntitlements.find((entitlement) => entitlement.store === 'google_play')?.product_id ??
		storeProducts.find(
			(product) =>
				product.store === 'google_play' && product.plan_tier === activePlanEntitlement?.plan_tier
		)?.product_id ??
		null;
	const googleManageParams = new URLSearchParams();
	if (locals.businessId && platform?.env?.GOOGLE_PLAY_PACKAGE_NAME) {
		googleManageParams.set('package', platform.env.GOOGLE_PLAY_PACKAGE_NAME);
	}
	if (googleProductId) googleManageParams.set('sku', googleProductId);
	const googleManageQuery = googleManageParams.toString();

	return {
		business: {
			name: business.name,
			planTier: business.plan_tier,
			addOnTempMonitoring: business.addon_temp_monitoring === 1,
			addOnCameraMonitoring: business.addon_camera_monitoring === 1
		},
		trial,
		canManageBilling: canManageBilling(locals.businessRole),
		localMode: dev,
		storeProducts: storeProducts.map((product) => ({
			store: product.store,
			productId: product.product_id,
			displayName: product.display_name,
			entitlementKey: product.entitlement_key,
			planTier: product.plan_tier,
			priceCents: product.price_cents,
			currency: product.currency,
			addOnTempMonitoring: product.addon_temp_monitoring === 1,
			addOnCameraMonitoring: product.addon_camera_monitoring === 1
		})),
		storeEntitlements: storeEntitlements.map((entitlement) => ({
			store: entitlement.store,
			productId: entitlement.product_id,
			entitlementKey: entitlement.entitlement_key,
			planTier: entitlement.plan_tier,
			status: entitlement.status,
			currentPeriodEnd: entitlement.current_period_end,
			autoRenewing: entitlement.auto_renewing === 1
		})),
		manageLinks: {
			appStore: 'https://apps.apple.com/account/subscriptions',
			googlePlay: `https://play.google.com/store/account/subscriptions${googleManageQuery ? `?${googleManageQuery}` : ''}`
		},
		storeBillingPlaceholder: storeBillingPlaceholder
			? {
					preferredStore: storeBillingPlaceholder.preferred_store,
					status: storeBillingPlaceholder.status,
					planTier: storeBillingPlaceholder.plan_tier,
					addOnTempMonitoring: storeBillingPlaceholder.addon_temp_monitoring === 1,
					addOnCameraMonitoring: storeBillingPlaceholder.addon_camera_monitoring === 1
				}
			: null,
		storeStatus: String(url.searchParams.get('store') ?? '').trim().toLowerCase() || null
	};
};

export const actions: Actions = {
	convert: async ({ request, locals }) => {
		try {
			if (!locals.userId || !locals.DB || !locals.businessId) {
				throw redirect(303, '/login');
			}
			if (!canManageBilling(locals.businessRole)) {
				logOperationalEvent({
					level: 'warn',
					event: 'billing_access_denied',
					request,
					businessId: locals.businessId,
					userId: locals.userId,
					status: 403,
					metadata: { action: 'convert', reason: 'role' }
				});
				return fail(403, { error: 'Only owner/admin can manage billing.' });
			}

			const form = await request.formData();
			const planRaw = String(form.get('plan_tier') ?? 'small').trim().toLowerCase();
			const addOnTempMonitoring = String(form.get('addon_temp_monitoring') ?? '0') === '1';
			const addOnCameraMonitoring = String(form.get('addon_camera_monitoring') ?? '0') === '1';
			const storeBillingPreference = String(form.get('store_billing_preference') ?? 'both')
				.trim()
				.toLowerCase();
			const planTier = PLAN_TIER_MAP[planRaw] ?? 'starter';

			if (!dev) {
				logOperationalEvent({
					level: 'info',
					event: 'billing_conversion_queued',
					request,
					businessId: locals.businessId,
					userId: locals.userId,
					status: 202,
					metadata: { action: 'convert', source: 'store_billing' }
				});
				await upsertStoreBillingPlaceholder(locals.DB, {
					businessId: locals.businessId,
					ownerUserId: locals.userId,
					preferredStore: storeBillingPreference,
					planTier,
					addOnTempMonitoring,
					addOnCameraMonitoring,
					status: 'queued'
				});
				throw redirect(303, '/billing?store=queued');
			}

			await convertBusinessToPaid(locals.DB, {
				businessId: locals.businessId,
				ownerUserId: locals.userId,
				planTier,
				addOnTempMonitoring,
				addOnCameraMonitoring
			});
			logOperationalEvent({
				level: 'info',
				event: 'billing_conversion_completed',
				request,
				businessId: locals.businessId,
				userId: locals.userId,
				status: 200,
				metadata: { action: 'convert', source: 'local_dev' }
			});
			throw redirect(303, '/app?billing=active&mode=local');
		} catch (error) {
			if (isRedirect(error)) throw error;
			const message = error instanceof Error ? error.message : String(error ?? '');
			logOperationalError({
				event: 'billing_conversion_failed',
				request,
				businessId: locals.businessId,
				userId: locals.userId,
				status: 500,
				error,
				message
			});
			return fail(500, { error: 'Could not activate paid workspace right now.' });
		}
	},
	cancel: async ({ request, locals, cookies }) => {
		try {
			if (!locals.userId || !locals.DB || !locals.businessId) {
				throw redirect(303, '/login');
			}
			if (!canManageBilling(locals.businessRole)) {
				logOperationalEvent({
					level: 'warn',
					event: 'billing_access_denied',
					request,
					businessId: locals.businessId,
					userId: locals.userId,
					status: 403,
					metadata: { action: 'cancel', reason: 'role' }
				});
				return fail(403, { error: 'Only owner/admin can cancel this workspace.' });
			}

			const now = Math.floor(Date.now() / 1000);
			const user = await locals.DB
				.prepare(
					`
          SELECT email
          FROM users
          WHERE id = ?
          LIMIT 1
        `
				)
				.bind(locals.userId)
				.first<{ email: string }>();
			const business = await locals.DB
				.prepare(
					`
          SELECT name
          FROM businesses
          WHERE id = ?
          LIMIT 1
        `
				)
				.bind(locals.businessId)
				.first<{ name: string }>();

			await cancelTrialAndPurgeBusiness(locals.DB, {
				businessId: locals.businessId,
				source: 'canceled',
				reason: 'manual_workspace_cancel',
				requestedByUserId: locals.userId,
				now,
				identity: {
					emailNormalized: user?.email ?? '',
					businessName: business?.name ?? '',
					clientFingerprint: String((await request.formData()).get('client_fingerprint') ?? ''),
					ipAddress: getRequestIpAddress(request),
					userAgent: request.headers.get('user-agent') ?? ''
				}
			});
			logOperationalEvent({
				level: 'warn',
				event: 'billing_workspace_canceled',
				request,
				businessId: locals.businessId,
				userId: locals.userId,
				status: 200,
				metadata: { action: 'cancel' }
			});

			clearSessionCookies(cookies, request);
			throw redirect(303, '/login?trial=canceled');
		} catch (error) {
			if (isRedirect(error)) throw error;
			const message = error instanceof Error ? error.message : String(error ?? '');
			logOperationalError({
				event: 'billing_cancel_failed',
				request,
				businessId: locals.businessId,
				userId: locals.userId,
				status: 500,
				error,
				message
			});
			return fail(500, { error: 'Could not cancel and close workspace right now.' });
		}
	}
};

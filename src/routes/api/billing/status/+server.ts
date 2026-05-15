import { json, type RequestHandler } from '@sveltejs/kit';
import { getBusinessTrialAccess } from '$lib/server/trial';
import { readBusinessEntitlements, readStoreProducts } from '$lib/server/storeBilling';
import { logOperationalError } from '$lib/server/observability';

function googleManageUrl(packageName: string | undefined, productId?: string | null) {
	const params = new URLSearchParams();
	if (packageName) params.set('package', packageName);
	if (productId) params.set('sku', productId);
	const query = params.toString();
	return `https://play.google.com/store/account/subscriptions${query ? `?${query}` : ''}`;
}

export const GET: RequestHandler = async ({ locals, platform, request }) => {
	if (!locals.DB || !locals.userId || !locals.businessId) {
		return json({ ok: false, error: 'Sign in required.' }, { status: 401 });
	}

	try {
		const [trial, products, entitlements] = await Promise.all([
			getBusinessTrialAccess(locals.DB, locals.businessId),
			readStoreProducts(locals.DB),
			readBusinessEntitlements(locals.DB, locals.businessId)
		]);
		const active = entitlements.filter((entitlement) => entitlement.status === 'active');
		const activePlan = active.find((entitlement) => entitlement.plan_tier);
		const appStoreProductId =
			active.find((entitlement) => entitlement.store === 'app_store')?.product_id ??
			products.find((product) => product.store === 'app_store' && product.plan_tier === activePlan?.plan_tier)
				?.product_id ??
			null;
		const googleProductId =
			active.find((entitlement) => entitlement.store === 'google_play')?.product_id ??
			products.find((product) => product.store === 'google_play' && product.plan_tier === activePlan?.plan_tier)
				?.product_id ??
			null;

		return json(
			{
				ok: true,
				trial,
				entitlements: entitlements.map((entitlement) => ({
					store: entitlement.store,
					productId: entitlement.product_id,
					entitlementKey: entitlement.entitlement_key,
					planTier: entitlement.plan_tier,
					status: entitlement.status,
					currentPeriodEnd: entitlement.current_period_end,
					autoRenewing: entitlement.auto_renewing === 1
				})),
				manage: {
					appStore: {
						productId: appStoreProductId,
						url: 'https://apps.apple.com/account/subscriptions'
					},
					googlePlay: {
						productId: googleProductId,
						url: googleManageUrl(platform?.env?.GOOGLE_PLAY_PACKAGE_NAME, googleProductId)
					}
				}
			},
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		logOperationalError({
			event: 'billing_status_failed',
			request,
			businessId: locals.businessId,
			userId: locals.userId,
			status: 500,
			error,
			message: error instanceof Error ? error.message : String(error ?? '')
		});
		return json({ ok: false, error: 'Could not load billing status.' }, { status: 500 });
	}
};

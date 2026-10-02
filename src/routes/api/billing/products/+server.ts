import { json, type RequestHandler } from '@sveltejs/kit';
import { normalizeStore, readStoreProducts } from '$lib/server/storeBilling';
import { logOperationalError } from '$lib/server/observability';
import { hasBusinessCapability } from '$lib/server/permissions';

export const GET: RequestHandler = async ({ locals, url, request }) => {
	if (!locals.DB || !locals.userId || !locals.businessId) {
		return json({ ok: false, error: 'Sign in required.' }, { status: 401 });
	}
	if (
		!hasBusinessCapability(
			locals.businessRole,
			locals.businessPermissionTemplate,
			'manage_billing',
			locals.businessCapabilities
		)
	) {
		return json({ ok: false, error: 'Billing access required.' }, { status: 403 });
	}

	try {
		const store = normalizeStore(url.searchParams.get('store'));
		const products = await readStoreProducts(locals.DB, store);
		return json(
			{
				ok: true,
				products: products
					.filter((product) => !(product.addon_temp_monitoring === 1 && !product.plan_tier))
					.map((product) => ({
						store: product.store,
						productId: product.product_id,
						displayName: product.display_name,
						entitlementKey: product.entitlement_key,
						planTier: product.plan_tier,
						billingPeriod: product.billing_period,
						priceCents: product.price_cents,
						currency: product.currency,
						addOnTempMonitoring: product.addon_temp_monitoring === 1
					}))
			},
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		logOperationalError({
			event: 'store_products_load_failed',
			request,
			status: 500,
			error,
			message: error instanceof Error ? error.message : String(error ?? '')
		});
		return json({ ok: false, error: 'Could not load store products.' }, { status: 500 });
	}
};

import { json, type RequestHandler } from '@sveltejs/kit';
import { normalizeStore, readStoreProducts } from '$lib/server/storeBilling';
import { logOperationalError } from '$lib/server/observability';

export const GET: RequestHandler = async ({ locals, url, request }) => {
	if (!locals.DB) {
		return json({ ok: false, error: 'Database unavailable.' }, { status: 503 });
	}

	try {
		const store = normalizeStore(url.searchParams.get('store'));
		const products = await readStoreProducts(locals.DB, store);
		return json(
			{
				ok: true,
				products: products.map((product) => ({
					store: product.store,
					productId: product.product_id,
					displayName: product.display_name,
					entitlementKey: product.entitlement_key,
					planTier: product.plan_tier,
					billingPeriod: product.billing_period,
					priceCents: product.price_cents,
					currency: product.currency,
					addOnTempMonitoring: product.addon_temp_monitoring === 1,
					addOnCameraMonitoring: product.addon_camera_monitoring === 1
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

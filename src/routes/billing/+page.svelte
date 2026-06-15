<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { onMount } from 'svelte';
	import {
		CriminiBilling,
		nativeStoreForPlatform,
		type NativeBillingProduct,
		type NativeStore
	} from '$lib/billing/nativeBilling';

	export let data: {
		business: {
			name: string;
			planTier: string;
			addOnTempMonitoring: boolean;
			addOnCameraMonitoring: boolean;
		};
		trial: {
			mode:
				| 'grandfathered'
				| 'trialing'
				| 'active'
				| 'expired'
				| 'canceled'
				| 'pending_payment'
				| 'past_due'
				| 'suspended';
			allowApp: boolean;
			shouldPurge: boolean;
			trialEndsAt: number | null;
			secondsRemaining: number | null;
		};
		canManageBilling: boolean;
		localMode: boolean;
		storeProducts: Array<{
			store: NativeStore;
			productId: string;
			displayName: string;
			entitlementKey: string;
			planTier: 'starter' | 'growth' | 'enterprise' | null;
			priceCents: number;
			currency: string;
			addOnTempMonitoring: boolean;
			addOnCameraMonitoring: boolean;
		}>;
		storeEntitlements: Array<{
			store: NativeStore;
			productId: string;
			entitlementKey: string;
			planTier: 'starter' | 'growth' | 'enterprise' | null;
			status: string;
			currentPeriodEnd: number | null;
			autoRenewing: boolean;
		}>;
		manageLinks: {
			appStore: string;
			googlePlay: string;
		};
		storeBillingPlaceholder: {
			preferredStore: 'google_play' | 'app_store' | 'both';
			status: 'pending_setup' | 'queued' | 'active' | 'disabled';
			planTier: 'starter' | 'growth' | 'enterprise';
			addOnTempMonitoring: boolean;
			addOnCameraMonitoring: boolean;
		} | null;
		storeStatus: string | null;
	};

	export let form:
		| {
				error?: string;
		  }
		| undefined;

	let selectedPlan = data.business.planTier === 'enterprise' ? 'large' : data.business.planTier === 'growth' ? 'medium' : 'small';
	let storeBillingPreference: 'both' | 'google_play' | 'app_store' =
		data.storeBillingPlaceholder?.preferredStore ?? 'both';
	let clientFingerprint = '';
	let nativeStore: NativeStore | null = null;
	let nativeProducts: NativeBillingProduct[] = [];
	let selectedProductId = '';
	let purchaseStatus = '';
	let purchaseBusy = false;

	const trialEndsText = data.trial.trialEndsAt
		? new Date(data.trial.trialEndsAt * 1000).toLocaleDateString()
		: 'N/A';

	$: availableProducts = data.storeProducts.filter(
		(product) =>
			!product.addOnCameraMonitoring &&
			!(product.addOnTempMonitoring && !product.planTier) &&
			(nativeStore ? product.store === nativeStore : product.store === 'google_play')
	);
	$: addOnTempMonitoring = selectedPlan === 'medium' || selectedPlan === 'large';
	$: if (!selectedProductId && availableProducts.length) {
		selectedProductId =
			availableProducts.find((product) => product.planTier === 'starter')?.productId ??
			availableProducts[0].productId;
	}
	$: selectedStoreProduct = availableProducts.find((product) => product.productId === selectedProductId);
	$: nativeProduct = nativeProducts.find((product) => product.productId === selectedProductId);
	$: activeEntitlement = data.storeEntitlements.find((entitlement) => entitlement.status === 'active');
	$: manageUrl =
		activeEntitlement?.store === 'app_store'
			? data.manageLinks.appStore
			: activeEntitlement?.store === 'google_play'
				? data.manageLinks.googlePlay
				: nativeStore === 'app_store'
					? data.manageLinks.appStore
					: data.manageLinks.googlePlay;

	function priceLabel(product: (typeof availableProducts)[number]) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: product.currency
		}).format(product.priceCents / 100);
	}

	function billingStatusLabel(status: string) {
		if (status === 'pending_setup') return 'Activation pending';
		if (status === 'queued') return 'Activation queued';
		if (status === 'active') return 'Active';
		if (status === 'disabled') return 'Disabled';
		return status.replaceAll('_', ' ');
	}

	async function postNativePurchase(payload: Record<string, unknown>) {
		const response = await fetch('/api/billing/native-purchase', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const result = await response.json().catch(() => ({}));
		if (!response.ok && response.status !== 202) {
			throw new Error(result?.error ?? 'Purchase could not be saved.');
		}
		return result;
	}

	async function purchaseSelectedProduct() {
		if (!selectedProductId) return;
		if (!nativeStore) {
			purchaseStatus = 'Open the mobile app to purchase.';
			return;
		}

		purchaseBusy = true;
		purchaseStatus = '';
		try {
			const purchase = await CriminiBilling.purchase({ productId: selectedProductId });
			await postNativePurchase(purchase);
			purchaseStatus = 'Purchase received. Verification pending.';
		} catch (error) {
			purchaseStatus = error instanceof Error ? error.message : 'Purchase failed.';
		} finally {
			purchaseBusy = false;
		}
	}

	async function restorePurchases() {
		if (!nativeStore) {
			purchaseStatus = 'Open the mobile app to restore.';
			return;
		}

		purchaseBusy = true;
		purchaseStatus = '';
		try {
			const restored = await CriminiBilling.restorePurchases();
			for (const purchase of restored.purchases) {
				await postNativePurchase(purchase);
			}
			purchaseStatus = restored.purchases.length ? 'Restore received.' : 'Nothing to restore.';
		} catch (error) {
			purchaseStatus = error instanceof Error ? error.message : 'Restore failed.';
		} finally {
			purchaseBusy = false;
		}
	}

	onMount(() => {
		try {
			const storageKey = 'sknns_trial_fingerprint_v1';
			clientFingerprint = window.localStorage.getItem(storageKey) ?? '';
		} catch {
			clientFingerprint = '';
		}
		nativeStore = nativeStoreForPlatform();
		if (nativeStore) {
			const productIds = data.storeProducts
				.filter((product) => !product.addOnCameraMonitoring)
				.filter((product) => !(product.addOnTempMonitoring && !product.planTier))
				.filter((product) => product.store === nativeStore)
				.map((product) => product.productId);
			CriminiBilling.getProducts({ productIds })
				.then((result) => {
					nativeProducts = result.products;
				})
				.catch(() => {
					nativeProducts = [];
				});
		}
	});
</script>

<Layout>
	<PageHeader title="Billing & Trial" />

	<section class="billing-shell">
		<article class="panel">
			<h2>{data.business.name}</h2>
			<p class="muted">Trial status: {data.trial.mode}</p>
			<p class="muted">Trial end: {trialEndsText}</p>
			<p class="notice">Billing provider: app stores.</p>
			{#if data.storeStatus === 'queued'}
				<p class="notice">Store activation queued.</p>
			{/if}
			{#if data.storeBillingPlaceholder}
				<p class="muted">
					Billing: {data.storeBillingPlaceholder.preferredStore.replace('_', ' ')} /
					{billingStatusLabel(data.storeBillingPlaceholder.status)}
				</p>
			{/if}
			{#if data.storeEntitlements.length}
				<p class="muted">Entitlement: {data.storeEntitlements[0].status}</p>
			{/if}
			{#if activeEntitlement}
				<a class="manage-link" href={manageUrl} target="_blank" rel="noreferrer">Manage subscription</a>
			{/if}
		</article>

		{#if !data.canManageBilling}
			<article class="panel">
				<p>Only workspace owners or managers can manage billing.</p>
			</article>
		{:else}
			<article class="panel">
				<h3>Plans</h3>
				<div class="stack">
					<label for="store-product">Plan</label>
					<select id="store-product" bind:value={selectedProductId}>
						{#each availableProducts as product}
							<option value={product.productId}>
								{product.displayName} - {nativeProducts.length && nativeProduct?.price
									? nativeProduct.price
									: `${priceLabel(product)}/mo`}
							</option>
						{/each}
					</select>

					{#if selectedStoreProduct}
						<div class="subscription-summary" aria-live="polite">
							<strong>{selectedStoreProduct.displayName}</strong>
							<span>
								{nativeProducts.length && nativeProduct?.price ? nativeProduct.price : priceLabel(selectedStoreProduct)}
								/month
							</span>
							<small>Renews monthly until canceled.</small>
							<small>Restore is available for existing App Store or Google Play purchases.</small>
						</div>
					{/if}

					<div class="button-row">
						<button type="button" class="primary" disabled={purchaseBusy} on:click={purchaseSelectedProduct}>
							{purchaseBusy ? 'Working...' : 'Purchase'}
						</button>
						<button type="button" class="secondary" disabled={purchaseBusy} on:click={restorePurchases}>
							Restore
						</button>
					</div>

					{#if !nativeStore}
						<p class="muted">Purchases are available in the mobile app.</p>
					{/if}
					{#if purchaseStatus}
						<p class="notice">{purchaseStatus}</p>
					{/if}
					<nav class="billing-links" aria-label="Billing links">
						<a href="/privacy">Privacy</a>
						<a href="/terms">Terms</a>
						<a href="/billing-terms">Billing Terms</a>
						<a href="/support">Support</a>
						<a href="/account-deletion">Account Deletion</a>
					</nav>
				</div>
				{#if data.localMode}
					<form method="POST" action="?/convert" class="dev-convert">
						<input type="hidden" name="plan_tier" value={selectedPlan} />
						<input type="hidden" name="addon_temp_monitoring" value={addOnTempMonitoring ? '1' : '0'} />
						<input type="hidden" name="addon_camera_monitoring" value="0" />
						<input type="hidden" name="store_billing_preference" value={storeBillingPreference} />
						<button type="submit" class="secondary">Local activate</button>
					</form>
				{/if}
			</article>

			<article class="panel danger">
				<h3>Cancel Trial Workspace</h3>
				<p>
					This permanently removes workspace data and marks this identity as no-trial for future signup.
				</p>
				<form method="POST" action="?/cancel">
					<input type="hidden" name="client_fingerprint" value={clientFingerprint} />
					<button type="submit" class="danger-btn">Cancel And Delete Workspace</button>
				</form>
			</article>
		{/if}

		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
	</section>
</Layout>

<style>
	.billing-shell {
		display: grid;
		gap: 0.8rem;
	}

	.panel {
		padding: 1rem 0;
		border: 0;
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
		border-radius: 0;
		background: transparent;
	}

	.panel h2,
	.panel h3 {
		margin: 0 0 0.45rem;
	}

	.muted {
		margin: 0.2rem 0 0;
		color: var(--color-text-muted);
	}

	.stack {
		display: grid;
		gap: 0.7rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.86rem;
	}

	select {
		padding: 0.55rem 0;
		border-radius: 0;
		border: 0;
		border-bottom: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.subscription-summary {
		display: grid;
		gap: 0.18rem;
		padding: 0.7rem 0;
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}

	.subscription-summary strong,
	.subscription-summary span {
		color: var(--color-text);
	}

	.subscription-summary small {
		color: var(--color-text-muted);
	}

	.primary,
	.secondary,
	.danger-btn {
		padding: 0.34rem 0.18rem;
		border-radius: 0;
		border: 0;
		border-bottom: 1px solid var(--color-border);
		font-weight: var(--weight-semibold);
	}

	.primary {
		background: transparent;
		color: var(--color-text);
	}

	.secondary {
		background: transparent;
		color: var(--color-text);
	}

	.dev-convert {
		margin-top: 0.8rem;
	}

	.danger {
		border-color: color-mix(in srgb, var(--color-error) 42%, var(--color-border));
	}

	.danger-btn {
		background: transparent;
		color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
	}

	.error {
		margin: 0;
		color: var(--color-error);
	}

	.notice {
		margin: 0.45rem 0 0;
		color: var(--color-text);
	}

	.billing-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.billing-links a {
		width: fit-content;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-soft);
		text-decoration: none;
		font-size: var(--text-sm);
	}

	.billing-links a:hover,
	.billing-links a:focus-visible {
		border-bottom-color: var(--color-text);
		color: var(--color-text);
	}

	.manage-link {
		display: inline-flex;
		margin-top: 0.65rem;
		color: var(--color-text);
		text-decoration: underline;
		text-underline-offset: 0.18em;
	}
</style>

<script lang="ts">
	import { enhance } from '$app/forms';
	import Layout from '$lib/components/ui/Layout.svelte';
	import ManagerSectionNav from '$lib/components/ui/ManagerSectionNav.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { onMount } from 'svelte';
	import {
		CriminiBilling,
		nativeStoreForPlatform,
		type NativeBillingProduct,
		type NativeStore
	} from '$lib/billing/nativeBilling';
	import { SENSOR_PRICING, sensorMonthlyPrice } from '$lib/billing/pricing';

	export let data: {
		business: {
			name: string;
			planTier: string;
			addOnTempMonitoring: boolean;
		};
		trial: {
			mode:
				| 'missing_billing'
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
		} | null;
		storeStatus: string | null;
		registeredSensorCount: number;
	};

	export let form:
		| {
				error?: string;
		  }
		| undefined;

	let selectedPlan =
		data.business.planTier === 'enterprise'
			? 'large'
			: data.business.planTier === 'growth'
				? 'medium'
				: 'small';
	let storeBillingPreference: 'both' | 'google_play' | 'app_store' =
		data.storeBillingPlaceholder?.preferredStore ?? 'both';
	let clientFingerprint = '';
	let nativeStore: NativeStore | null = null;
	let nativeProducts: NativeBillingProduct[] = [];
	let selectedProductId = '';
	let addOnTempMonitoring = data.business.addOnTempMonitoring;
	let purchaseStatus = '';
	let purchaseBusy = false;

	$: availableProducts = data.storeProducts.filter((product) =>
		nativeStore ? product.store === nativeStore : product.store === 'google_play'
	);
	$: if (!selectedProductId && availableProducts.length) {
		selectedProductId =
			availableProducts.find((product) => product.planTier === 'starter')?.productId ??
			availableProducts[0].productId;
	}
	$: selectedStoreProduct = availableProducts.find(
		(product) => product.productId === selectedProductId
	);
	$: nativeProduct = nativeProducts.find((product) => product.productId === selectedProductId);
	$: if (selectedStoreProduct?.planTier) {
		selectedPlan =
			selectedStoreProduct.planTier === 'enterprise'
				? 'large'
				: selectedStoreProduct.planTier === 'growth'
					? 'medium'
					: 'small';
	}
	$: selectedProductIsSensor = Boolean(
		selectedStoreProduct?.addOnTempMonitoring && !selectedStoreProduct?.planTier
	);
	$: sensorEstimate = sensorMonthlyPrice(data.registeredSensorCount);
	$: activeEntitlement = data.storeEntitlements.find(
		(entitlement) => entitlement.status === 'active'
	);
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

	function planLabel(plan: string) {
		if (plan === 'starter') return 'Small';
		if (plan === 'growth') return 'Medium';
		if (plan === 'enterprise') return 'Large';
		return plan ? plan.replaceAll('_', ' ') : 'Not selected';
	}

	$: billingState = activeEntitlement
		? 'Active'
		: data.storeBillingPlaceholder
			? billingStatusLabel(data.storeBillingPlaceholder.status)
			: billingStatusLabel(data.trial.mode);
	$: billingChannel = activeEntitlement?.store === 'app_store'
		? 'App Store'
		: activeEntitlement?.store === 'google_play'
			? 'Google Play'
			: data.storeBillingPlaceholder?.preferredStore === 'app_store'
				? 'App Store'
				: data.storeBillingPlaceholder?.preferredStore === 'google_play'
					? 'Google Play'
					: 'Not selected';

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
			const storageKey = 'crimini_signup_fingerprint_v1';
			clientFingerprint = window.localStorage.getItem(storageKey) ?? '';
		} catch {
			clientFingerprint = '';
		}
		nativeStore = nativeStoreForPlatform();
		if (nativeStore) {
			const productIds = data.storeProducts
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
	<PageHeader title="Billing" />
	<ManagerSectionNav groupId="business" />

	<section class="billing-shell">
		<section class="billing-overview">
			<header class="section-heading">
				<h2>{data.business.name}</h2>
				{#if activeEntitlement}
					<a class="manage-link" href={manageUrl} target="_blank" rel="noreferrer">Manage Subscription</a>
				{/if}
			</header>
			<div class="status-grid">
				<div><span>Plan</span><strong>{planLabel(data.business.planTier)}</strong></div>
				<div><span>Status</span><strong>{billingState}</strong></div>
				<div><span>Purchase Channel</span><strong>{billingChannel}</strong></div>
				<div><span>Temperature Sensors</span><strong>{data.registeredSensorCount}</strong></div>
			</div>
		</section>

		{#if data.storeStatus === 'queued'}
			<p class="notice-line">Store activation queued.</p>
		{/if}

		{#if !data.canManageBilling}
			<section class="access-line">
				<p>Only workspace owners or managers can manage billing.</p>
			</section>
		{:else}
			<section class="billing-section">
				<header class="section-heading"><h2>Subscriptions</h2></header>
				<div class="stack">
					<label for="store-product">Choose a plan or add-on</label>
					{#if availableProducts.length}
						<select id="store-product" bind:value={selectedProductId}>
							{#each availableProducts as product}
								<option value={product.productId}>
									{product.displayName} - {nativeProducts.length && nativeProduct?.price
										? nativeProduct.price
										: `${priceLabel(product)}/mo`}
								</option>
							{/each}
						</select>
					{:else}
						<p class="muted">Store products are not available.</p>
					{/if}

					{#if selectedStoreProduct}
						<div class="subscription-summary" aria-live="polite">
							<strong>{selectedStoreProduct.displayName}</strong>
							<span>
								{nativeProducts.length && nativeProduct?.price
									? nativeProduct.price
									: priceLabel(selectedStoreProduct)}
								/month
							</span>
							<small>Renews monthly until canceled.</small>
							{#if selectedProductIsSensor}
								<small>
									Includes up to {SENSOR_PRICING.includedSensors} sensors, then ${SENSOR_PRICING.additionalSensorMonthly}/month
									per additional sensor, with no sensor ceiling.
								</small>
							{/if}
							<small>Restore is available for existing App Store or Google Play purchases.</small>
						</div>
					{/if}

					<div class="sensor-usage">
						<strong>Temperature monitoring</strong>
						<span
							>{data.registeredSensorCount} active {data.registeredSensorCount === 1
								? 'sensor'
								: 'sensors'}</span
						>
						<small>Add-on monthly rate at this count: ${sensorEstimate}.</small>
					</div>

					<div class="button-row">
						<button
							type="button"
							class="primary"
							disabled={purchaseBusy || !selectedProductId}
							on:click={purchaseSelectedProduct}
						>
							{purchaseBusy ? 'Working...' : 'Purchase'}
						</button>
						<button
							type="button"
							class="secondary"
							disabled={purchaseBusy}
							on:click={restorePurchases}
						>
							Restore
						</button>
					</div>

					{#if !nativeStore}
						<p class="muted">Purchases are available in the mobile app.</p>
					{/if}
					{#if purchaseStatus}
						<p class="notice">{purchaseStatus}</p>
					{/if}
				</div>
				{#if data.localMode}
					<form method="POST" action="?/convert" class="dev-convert" use:enhance>
						<input type="hidden" name="plan_tier" value={selectedPlan} />
						<label class="local-addon">
							<input type="checkbox" bind:checked={addOnTempMonitoring} />
							<span>Activate temperature monitoring locally</span>
						</label>
						<input
							type="hidden"
							name="addon_temp_monitoring"
							value={addOnTempMonitoring ? '1' : '0'}
						/>
						<input type="hidden" name="store_billing_preference" value={storeBillingPreference} />
						<button type="submit" class="secondary">Local activate</button>
					</form>
				{/if}
			</section>

			<details class="danger-section">
				<summary>Cancel Workspace Setup</summary>
				<div>
					<p>This permanently removes workspace data before activation.</p>
					<form method="POST" action="?/cancel" use:enhance>
						<input type="hidden" name="client_fingerprint" value={clientFingerprint} />
						<button type="submit" class="danger-btn">Cancel And Delete Workspace</button>
					</form>
				</div>
			</details>
		{/if}

		<nav class="billing-links" aria-label="Billing links">
			<a href="/privacy">Privacy</a>
			<a href="/terms">Terms</a>
			<a href="/billing-terms">Billing Terms</a>
			<a href="/support">Support</a>
			<a href="/account-deletion">Account Deletion</a>
		</nav>

		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
	</section>
</Layout>

<style>
	:global(.main-content:has(.billing-shell)) {
		max-width: 1040px;
	}

	.billing-shell {
		display: grid;
		gap: 1rem;
		padding-bottom: 2rem;
	}

	.billing-overview,
	.billing-section,
	.access-line,
	.danger-section,
	.notice-line,
	.billing-links {
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
		background: transparent;
	}

	.section-heading {
		min-height: 3.25rem;
		padding: 0.72rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-bottom: 1px solid var(--color-divider);
	}

	.section-heading h2 {
		margin: 0;
		font-size: 1rem;
	}

	.status-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.status-grid > div {
		min-width: 0;
		min-height: 4.25rem;
		padding: 0.72rem 0.9rem;
		display: grid;
		align-content: center;
		gap: 0.12rem;
		border-right: 1px solid var(--color-divider);
	}

	.status-grid > div:last-child {
		border-right: 0;
	}

	.status-grid span {
		color: var(--color-text-muted);
		font-size: 0.64rem;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.status-grid strong {
		overflow: hidden;
		font-size: 0.86rem;
		text-overflow: ellipsis;
	}

	.muted {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.78rem;
	}

	.stack {
		display: grid;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.8rem;
		font-weight: var(--weight-semibold);
	}

	select {
		width: 100%;
		padding: 0.5rem 0;
		border-radius: 0;
		border: 0;
		border-bottom: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
		font: inherit;
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.subscription-summary,
	.sensor-usage {
		display: grid;
		gap: 0.18rem;
		padding: 0.7rem 0;
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}

	.sensor-usage {
		border-top: 0;
		border-bottom: 1px solid var(--color-divider);
	}

	.sensor-usage span,
	.sensor-usage small {
		color: var(--color-text-muted);
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
		width: fit-content;
		padding: 0.4rem 0.18rem;
		border-radius: 0;
		border: 0;
		border-bottom: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-size: 0.78rem;
		font-weight: var(--weight-semibold);
		cursor: pointer;
	}

	.primary:disabled,
	.secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dev-convert {
		padding: 0 1rem 0.9rem;
	}

	.local-addon {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.65rem;
	}

	.local-addon input {
		width: 1rem;
		height: 1rem;
		accent-color: var(--color-text);
	}

	.access-line,
	.notice-line {
		padding: 0.75rem 1rem;
	}

	.access-line p,
	.notice-line {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.78rem;
	}

	.danger-section summary {
		padding: 0.75rem 1rem;
		color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
		font-size: 0.8rem;
		font-weight: var(--weight-semibold);
		cursor: pointer;
	}

	.danger-section > div {
		padding: 0.8rem 1rem;
		border-top: 1px solid var(--color-divider);
	}

	.danger-section p {
		margin: 0 0 0.7rem;
		color: var(--color-text-muted);
		font-size: 0.78rem;
	}

	.danger-btn {
		color: color-mix(in srgb, var(--color-error) 78%, var(--color-text));
		border-bottom-color: color-mix(in srgb, var(--color-error) 42%, var(--color-border));
	}

	.error {
		margin: 0;
		padding: 0.7rem 1rem;
		color: var(--color-error);
	}

	.notice {
		margin: 0;
		color: var(--color-text);
		font-size: 0.78rem;
	}

	.billing-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem 0.9rem;
		padding: 0.72rem 1rem;
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
		border-bottom: 1px solid var(--color-divider);
		color: var(--color-text);
		font-size: 0.76rem;
		font-weight: var(--weight-semibold);
		text-decoration: none;
	}

	@media (max-width: 720px) {
		.status-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.status-grid > div:nth-child(even) {
			border-right: 0;
		}

		.status-grid > div {
			border-bottom: 1px solid var(--color-divider);
		}

		.status-grid > div:nth-last-child(-n + 2) {
			border-bottom: 0;
		}
	}

	@media (max-width: 460px) {
		.status-grid {
			grid-template-columns: 1fr;
		}

		.status-grid > div,
		.status-grid > div:nth-child(even),
		.status-grid > div:nth-last-child(-n + 2) {
			border-right: 0;
			border-bottom: 1px solid var(--color-divider);
		}

		.status-grid > div:last-child {
			border-bottom: 0;
		}

		.section-heading {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>

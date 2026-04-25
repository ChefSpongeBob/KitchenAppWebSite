<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { onMount } from 'svelte';

	export let data: {
		business: {
			name: string;
			planTier: string;
			addOnTempMonitoring: boolean;
			addOnCameraMonitoring: boolean;
		};
		trial: {
			mode: 'grandfathered' | 'trialing' | 'paid' | 'expired' | 'canceled' | 'pending_payment';
			allowApp: boolean;
			shouldPurge: boolean;
			trialEndsAt: number | null;
			secondsRemaining: number | null;
		};
		canManageBilling: boolean;
		localMode: boolean;
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
	let addOnTempMonitoring = data.business.addOnTempMonitoring;
	let addOnCameraMonitoring = data.business.addOnCameraMonitoring;
	let storeBillingPreference: 'both' | 'google_play' | 'app_store' =
		data.storeBillingPlaceholder?.preferredStore ?? 'both';
	let clientFingerprint = '';

	const trialEndsText = data.trial.trialEndsAt
		? new Date(data.trial.trialEndsAt * 1000).toLocaleDateString()
		: 'N/A';

	onMount(() => {
		try {
			const storageKey = 'sknns_trial_fingerprint_v1';
			clientFingerprint = window.localStorage.getItem(storageKey) ?? '';
		} catch {
			clientFingerprint = '';
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
			<p class="notice">Billing provider path: app stores only.</p>
			{#if data.storeStatus === 'queued'}
				<p class="notice">Store billing placeholder has been queued for activation.</p>
			{/if}
			{#if data.storeBillingPlaceholder}
				<p class="muted">
					Placeholder: {data.storeBillingPlaceholder.preferredStore.replace('_', ' ')} /
					{data.storeBillingPlaceholder.status}
				</p>
			{/if}
		</article>

		{#if !data.canManageBilling}
			<article class="panel">
				<p>Only workspace owner/admin can manage conversion or cancellation.</p>
			</article>
		{:else}
			<article class="panel">
				<h3>Convert To Paid</h3>
				<form method="POST" action="?/convert" class="stack">
					<label for="billing-plan">Plan tier</label>
					<select id="billing-plan" name="plan_tier" bind:value={selectedPlan}>
						<option value="small">Small - $50/mo</option>
						<option value="medium">Medium - $120/mo</option>
						<option value="large">Large - $275/mo</option>
					</select>

					<label class="check">
						<input type="checkbox" bind:checked={addOnTempMonitoring} />
						<span>Cooler/freezer monitoring (+$30/mo)</span>
					</label>
					<input type="hidden" name="addon_temp_monitoring" value={addOnTempMonitoring ? '1' : '0'} />

					<label class="check">
						<input type="checkbox" bind:checked={addOnCameraMonitoring} />
						<span>Camera monitoring (+$30/mo)</span>
					</label>
					<input type="hidden" name="addon_camera_monitoring" value={addOnCameraMonitoring ? '1' : '0'} />
					<label for="store-preference">Store target</label>
					<select id="store-preference" name="store_billing_preference" bind:value={storeBillingPreference}>
						<option value="both">Both stores</option>
						<option value="google_play">Google Play</option>
						<option value="app_store">App Store</option>
					</select>

					<button type="submit" class="primary">Activate Paid Workspace</button>
				</form>
				<p class="muted">
					{data.localMode
						? 'Local testing mode: direct activation is enabled for development only.'
						: 'Production mode: paid activation must be handled through Play Store / App Store billing.'}
				</p>
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
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
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
		padding: 0.55rem 0.6rem;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-alt);
		color: var(--color-text);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.primary,
	.danger-btn {
		padding: 0.62rem 0.9rem;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		font-weight: var(--weight-semibold);
	}

	.primary {
		background: color-mix(in srgb, var(--color-primary) 24%, var(--color-surface));
		color: var(--color-text);
	}

	.danger {
		border-color: color-mix(in srgb, var(--color-error) 42%, var(--color-border));
	}

	.danger-btn {
		background: color-mix(in srgb, var(--color-error) 18%, var(--color-surface));
		color: var(--color-text);
	}

	.error {
		margin: 0;
		color: var(--color-error);
	}

	.notice {
		margin: 0.45rem 0 0;
		color: var(--color-text);
	}
</style>

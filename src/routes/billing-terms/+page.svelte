<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
</script>

<Layout>
	<section class="legal-page">
		<p class="eyebrow">Crimini</p>
		<h1>Billing Terms</h1>
		<p class="updated">Last updated June 15, 2026</p>

		<div class="legal-section">
			<h2>Subscriptions</h2>
			<p>
				Crimini is offered through monthly subscription plans. Plan access, included features,
				and pricing are shown before purchase.
			</p>
		</div>

		<div class="legal-section">
			<h2>Store Billing</h2>
			<p>
				Mobile subscriptions are handled through Apple App Store or Google Play billing where
				required. Store account settings control renewal, cancellation, and payment method changes.
			</p>
		</div>

		<div class="legal-section">
			<h2>Renewal And Cancellation</h2>
			<p>
				Subscriptions renew monthly until canceled. Canceling stops future renewal and may keep
				access active until the paid period ends.
			</p>
		</div>

		<div class="legal-section">
			<h2>Refunds</h2>
			<p>
				Refund requests for store purchases are handled by the store where the subscription was
				purchased. Workspace data may remain subject to retention, security, billing, and legal needs.
			</p>
		</div>

		<div class="legal-section">
			<h2>Plans</h2>
			<p>
				Small, Medium, and Large plans use separate store product IDs. Temperature monitoring is
				included with Medium and Large plans. Camera monitoring is deferred until a later release.
			</p>
		</div>

		<div class="legal-section">
			<h2>Related Terms</h2>
			<nav aria-label="Billing links">
				<a href="/pricing">Pricing</a>
				<a href="/terms">Terms</a>
				<a href="/privacy">Privacy</a>
				<a href="/account-deletion">Account Deletion</a>
				<a href="/support">Support</a>
			</nav>
		</div>
	</section>
</Layout>

<style>
	.legal-page {
		max-width: 780px;
		margin: 0 auto;
		padding: clamp(3rem, 8vw, 6rem) 0;
		color: #111214;
	}

	.eyebrow,
	.updated {
		margin: 0;
		color: rgba(17, 18, 20, 0.58);
		font-size: 0.78rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0.35rem 0 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2.6rem, 8vw, 5.4rem);
		font-weight: 400;
		letter-spacing: -0.065em;
		line-height: 0.92;
	}

	.updated {
		margin-top: 1rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid rgba(17, 18, 20, 0.16);
	}

	.legal-section {
		padding: 1.15rem 0;
		border-bottom: 1px solid rgba(17, 18, 20, 0.12);
	}

	h2 {
		margin: 0 0 0.45rem;
		font-size: 1rem;
		letter-spacing: -0.02em;
	}

	p {
		margin: 0;
		color: rgba(17, 18, 20, 0.72);
		line-height: 1.65;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	a {
		border-bottom: 1px solid rgba(17, 18, 20, 0.22);
		color: #111214;
		text-decoration: none;
	}

	a:hover,
	a:focus-visible {
		border-bottom-color: #111214;
	}
</style>

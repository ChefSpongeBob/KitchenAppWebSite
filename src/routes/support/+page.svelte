<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
</script>

<svelte:head>
	<title>Support | Crimini</title>
	<meta
		name="description"
		content="Contact Crimini support for account, workspace, billing, onboarding, privacy, security, or sensor-monitoring help."
	/>
</svelte:head>

<Layout>
	<section class="support-page">
		<p class="eyebrow">Crimini</p>
		<h1>Support</h1>
		<p class="updated">Updated October 5, 2026</p>

		<div class="support-section">
			<h2>Contact</h2>
			<p>
				Email <a href="mailto:support@criminiops.com">support@criminiops.com</a> for account, workspace,
				onboarding, billing, or sensor-monitoring help.
			</p>
		</div>

		<div class="support-section">
			<h2>Include With Your Request</h2>
			<p>
				Include the workspace name, account email, device type, and a short description of the
				issue. Do not email passwords, complete bank details, tax identification numbers, or
				identity documents.
			</p>
		</div>

		<div class="support-section">
			<h2>Billing</h2>
			<p>
				Apple and Google control payment methods, subscription cancellation, and refunds for
				purchases made through their stores. Crimini support can help identify the purchase channel
				and review workspace entitlement status.
			</p>
			<nav aria-label="Subscription management links">
				<a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer"
					>Apple Subscriptions</a
				>
				<a
					href="https://play.google.com/store/account/subscriptions"
					target="_blank"
					rel="noreferrer">Google Play Subscriptions</a
				>
				<a href="/billing-terms">Billing Terms</a>
			</nav>
		</div>

		<div class="support-section">
			<h2>Security And Privacy</h2>
			<p>
				Report suspected unauthorized access promptly. Privacy and deletion requests can use the
				links below so they are recorded through the correct process.
			</p>
		</div>

		<div class="support-section">
			<h2>Privacy And Deletion</h2>
			<nav aria-label="Support links">
				<a href="/privacy">Privacy</a>
				<a href="/terms">Terms</a>
				<a href="/billing-terms">Billing Terms</a>
				<a href="/account-deletion">Account Deletion</a>
			</nav>
		</div>
	</section>
</Layout>

<style>
	.support-page {
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

	.support-section {
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

	p + nav {
		margin-top: 0.65rem;
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

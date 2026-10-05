<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import { PLAN_PRICES, SENSOR_PRICING } from '$lib/billing/pricing';
</script>

<svelte:head>
	<title>Billing Terms | Crimini</title>
	<meta
		name="description"
		content="Crimini subscription prices, sensor monitoring charges, renewal, cancellation, refunds, and app-store billing terms."
	/>
</svelte:head>

<Layout>
	<section class="legal-page">
		<p class="eyebrow">Crimini</p>
		<h1>Billing Terms</h1>
		<p class="updated">Effective October 5, 2026</p>

		<div class="legal-section">
			<h2>Monthly Plans</h2>
			<p>
				Crimini offers three monthly workspace subscriptions: Small at ${PLAN_PRICES.starter} per month,
				Medium at ${PLAN_PRICES.growth} per month, and Large at ${PLAN_PRICES.enterprise} per month. Prices
				are in U.S. dollars unless the purchase screen shows a localized price. Applicable taxes may be
				added by the billing provider.
			</p>
		</div>

		<div class="legal-section">
			<h2>Temperature Monitoring</h2>
			<p>
				Temperature monitoring is optional and is not included automatically with a workspace plan.
				The service costs ${SENSOR_PRICING.baseMonthly} per month for up to
				{SENSOR_PRICING.includedSensors} active sensors, plus ${SENSOR_PRICING.additionalSensorMonthly}
				per month for each additional active sensor. There is no fixed sensor ceiling. Sensor hardware,
				shipping, replacement, and installation are separate unless an order expressly states otherwise.
			</p>
			<p>
				The registered active-sensor count determines the applicable sensor-service rate. The
				purchase channel or Crimini business invoice, as applicable, will identify the amount
				charged. Removing a sensor from active service affects future billing adjustments and does
				not retroactively refund a completed billing period.
			</p>
		</div>

		<div class="legal-section">
			<h2>Purchase And Renewal</h2>
			<p>
				The plan name, included service, billing period, and total price are shown before purchase.
				Subscriptions automatically renew each month until canceled. The billing provider charges
				the payment method associated with the purchasing account at confirmation and at each
				renewal. Store purchases are processed by Apple or Google and are also subject to that
				store's terms.
			</p>
		</div>

		<div class="legal-section">
			<h2>Changes</h2>
			<p>
				Plan upgrades, downgrades, sensor-count adjustments, proration, and effective dates are
				handled according to the purchase channel. We may change prices or plan contents with
				advance notice and any consent required by Apple, Google, or applicable law. A changed price
				does not apply before the date disclosed by the billing provider.
			</p>
		</div>

		<div class="legal-section">
			<h2>Cancellation</h2>
			<p>
				Cancel through the store or billing channel used to purchase the subscription. Cancellation
				stops future renewals and normally leaves paid access active through the end of the current
				billing period.
				<a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer"
					>Manage Apple subscriptions</a
				>
				or
				<a
					href="https://play.google.com/store/account/subscriptions"
					target="_blank"
					rel="noreferrer">manage Google Play subscriptions</a
				>.
			</p>
			<p>
				Canceling a subscription does not delete workspace data. Requesting account deletion does
				not automatically cancel an Apple or Google subscription. Both actions must be completed
				when both are wanted.
			</p>
		</div>

		<div class="legal-section">
			<h2>Failed Payments And Access</h2>
			<p>
				A failed, expired, refunded, revoked, or past-due purchase may limit paid workspace or
				sensor access after any store-provided grace period. Crimini verifies purchase status with
				the billing provider before granting or continuing paid entitlements.
			</p>
		</div>

		<div class="legal-section">
			<h2>Refunds</h2>
			<p>
				Apple and Google control refunds for purchases made through their stores. Requests for those
				purchases must be submitted to the applicable store. For a charge billed directly by NNS,
				LLC, contact <a href="mailto:support@criminiops.com">support@criminiops.com</a>. Refund
				rights required by law remain unaffected.
			</p>
		</div>

		<div class="legal-section">
			<h2>Restore And Support</h2>
			<p>
				The mobile billing screen provides a restore option for eligible Apple and Google purchases.
				Billing questions may be sent to <a href="mailto:support@criminiops.com"
					>support@criminiops.com</a
				>.
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

	p + p {
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

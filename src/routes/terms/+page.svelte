<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
</script>

<Layout>
	<section class="legal-page">
		<p class="eyebrow">Crimini</p>
		<h1>Terms</h1>
		<p class="updated">Last updated June 15, 2026</p>

		<div class="legal-section">
			<h2>Service</h2>
			<p>
				Crimini provides restaurant operations software for scheduling, staff workflows,
				lists, documents, reports, onboarding, and configured monitoring tools.
			</p>
		</div>

		<div class="legal-section">
			<h2>Business Responsibility</h2>
			<p>
				Each business controls its workspace, users, records, forms, settings, and compliance
				processes. Crimini does not replace legal, payroll, tax, food safety, or HR advice.
			</p>
		</div>

		<div class="legal-section">
			<h2>Employee Records</h2>
			<p>
				Businesses are responsible for confirming required employment documents, retention
				rules, state-specific forms, worker authorization procedures, and payroll setup.
			</p>
		</div>

		<div class="legal-section">
			<h2>Acceptable Use</h2>
			<p>
				Users may not misuse accounts, bypass permissions, access another business workspace,
				upload unlawful content, interfere with service security, or use Crimini to violate law.
			</p>
		</div>

		<div class="legal-section">
			<h2>Monitoring Tools</h2>
			<p>
				Temperature and future device monitoring tools support operations. Businesses remain
				responsible for equipment, local code, staff training, incident response, and final decisions.
			</p>
		</div>

		<div class="legal-section">
			<h2>Accounts And Access</h2>
			<p>
				Workspace owners and managers are responsible for inviting the correct users, assigning
				permissions, removing access when needed, and reviewing business activity.
			</p>
		</div>

		<div class="legal-section">
			<h2>Related Terms</h2>
			<nav aria-label="Legal links">
				<a href="/privacy">Privacy</a>
				<a href="/billing-terms">Billing Terms</a>
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

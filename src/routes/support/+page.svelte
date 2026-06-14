<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
</script>

<Layout>
	<section class="support-page">
		<p class="eyebrow">Crimini</p>
		<h1>Support</h1>
		<p class="updated">Last updated June 14, 2026</p>

		<div class="support-section">
			<h2>Account Help</h2>
			<p>For access, billing, onboarding, or workspace issues, contact Crimini support through your business account channel.</p>
		</div>

		<div class="support-section">
			<h2>Review Access</h2>
			<p>App review accounts must be active, connected to a test workspace, and able to access billing, onboarding, scheduling, lists, docs, reports, and settings.</p>
		</div>

		<div class="support-section">
			<h2>Privacy And Deletion</h2>
			<nav aria-label="Support links">
				<a href="/privacy">Privacy</a>
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

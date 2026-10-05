<script lang="ts">
	import { enhance } from '$app/forms';
	import Layout from '$lib/components/ui/Layout.svelte';

	export let form:
		| {
				success?: boolean;
				error?: string;
				email?: string;
				workspaceName?: string;
		  }
		| undefined;
</script>

<svelte:head>
	<title>Account Deletion | Crimini</title>
	<meta
		name="description"
		content="Request deletion of a Crimini user account or an authorized business workspace."
	/>
</svelte:head>

<Layout>
	<section class="legal-page">
		<p class="eyebrow">Crimini</p>
		<h1>Account Deletion</h1>
		<p class="updated">Updated October 5, 2026</p>

		<div class="legal-section intro-section">
			<h2>Delete An Account Or Workspace</h2>
			<p>
				Use this form to start deletion from the web. Signed-in users can also open <strong
					>Profile & Settings</strong
				> and choose Account Deletion.
			</p>
		</div>

		<form method="POST" class="request-form" use:enhance>
			{#if form?.success}
				<p class="notice success">Request received. Check your email for confirmation.</p>
			{:else if form?.error}
				<p class="notice error">{form.error}</p>
			{/if}

			<label>
				<span>Email</span>
				<input name="email" type="email" value={form?.email ?? ''} autocomplete="email" required />
			</label>

			<label>
				<span>Workspace</span>
				<input
					name="workspace_name"
					value={form?.workspaceName ?? ''}
					autocomplete="organization"
				/>
			</label>

			<label>
				<span>Request Type</span>
				<select name="request_scope">
					<option value="user">My user account</option>
					<option value="workspace">Entire business workspace</option>
				</select>
			</label>

			<label>
				<span>Details</span>
				<textarea
					name="details"
					rows="4"
					placeholder="Optional information that will help verify the request"
				></textarea>
			</label>

			<button type="submit">Submit Request</button>
		</form>

		<div class="legal-section">
			<h2>Verification And Timing</h2>
			<p>
				We may verify identity, account access, and authority before deletion. Only an authorized
				workspace owner may request deletion of an entire business workspace. Approved requests are
				normally completed within 30 days; we will notify the requester if law or technical recovery
				safeguards require more time.
			</p>
		</div>

		<div class="legal-section">
			<h2>What Gets Deleted</h2>
			<p>
				A user-account request removes the account, access credentials, sessions, and personal data
				Crimini is permitted to delete. It does not automatically delete a restaurant's records that
				the business controls or must lawfully retain.
			</p>
			<p>
				An approved full-workspace request removes the business workspace and associated users,
				schedules, lists, recipes, documents, onboarding records, reports, device assignments, and
				other tenant data where deletion is legally and operationally allowed.
			</p>
		</div>

		<div class="legal-section">
			<h2>What May Be Retained</h2>
			<p>
				Limited billing, transaction, security, fraud-prevention, audit, tax, employment, or legal
				records may be retained when required or permitted. Retained data is restricted to the
				applicable purpose and deleted or de-identified when that purpose ends. Backup copies may
				remain until the normal backup cycle completes.
			</p>
		</div>

		<div class="legal-section">
			<h2>Subscriptions Are Separate</h2>
			<p>
				Deleting an account does not automatically cancel an Apple App Store or Google Play
				subscription. Cancel recurring billing separately through
				<a href="https://apps.apple.com/account/subscriptions" target="_blank" rel="noreferrer"
					>Apple Subscriptions</a
				>
				or
				<a
					href="https://play.google.com/store/account/subscriptions"
					target="_blank"
					rel="noreferrer">Google Play Subscriptions</a
				>.
			</p>
		</div>

		<div class="legal-section">
			<h2>Contact</h2>
			<p>
				Send deletion questions to <a href="mailto:support@criminiops.com">support@criminiops.com</a
				>.
			</p>
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

	.request-form {
		display: grid;
		gap: 0.78rem;
		margin: 1.3rem 0 0.65rem;
		padding-bottom: 1.2rem;
		border-bottom: 1px solid rgba(17, 18, 20, 0.16);
	}

	.intro-section {
		padding-bottom: 0;
		border-bottom: 0;
	}

	label {
		display: grid;
		gap: 0.35rem;
	}

	label span {
		font-size: 0.82rem;
		color: rgba(17, 18, 20, 0.62);
	}

	input,
	select,
	textarea {
		width: 100%;
		border: 1px solid rgba(17, 18, 20, 0.18);
		background: #fff;
		color: #111214;
		border-radius: 0;
		padding: 0.72rem 0.8rem;
		font: inherit;
	}

	button {
		width: fit-content;
		border: 1px solid #111214;
		background: #111214;
		color: #fff;
		border-radius: 0;
		padding: 0.75rem 1.1rem;
		font-weight: 700;
		cursor: pointer;
	}

	.notice {
		border-left: 3px solid #111214;
		padding: 0.7rem 0.85rem;
		background: rgba(17, 18, 20, 0.05);
		color: #111214;
	}

	.notice.error {
		border-left-color: #9f2f2f;
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

	a {
		color: #111214;
		text-underline-offset: 0.16rem;
	}
</style>

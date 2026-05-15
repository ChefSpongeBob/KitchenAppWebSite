<script lang="ts">
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

<Layout>
	<section class="legal-page">
		<p class="eyebrow">Crimini</p>
		<h1>Account Deletion</h1>
		<p class="updated">Last updated May 10, 2026</p>

		<form method="POST" class="request-form">
			{#if form?.success}
				<p class="notice success">Request received.</p>
			{:else if form?.error}
				<p class="notice error">{form.error}</p>
			{/if}

			<label>
				<span>Email</span>
				<input name="email" type="email" value={form?.email ?? ''} required />
			</label>

			<label>
				<span>Workspace</span>
				<input name="workspace_name" value={form?.workspaceName ?? ''} />
			</label>

			<label>
				<span>Request Type</span>
				<select name="request_scope">
					<option value="user">User account</option>
					<option value="workspace">Full workspace</option>
				</select>
			</label>

			<label>
				<span>Details</span>
				<textarea name="details" rows="4"></textarea>
			</label>

			<button type="submit">Submit Request</button>
		</form>

		<div class="legal-section">
			<h2>Request Deletion</h2>
			<p>
				Use this page to request deletion for one user account or a full business workspace.
			</p>
			<p>
				Logged-in users can also open <strong>Profile & Settings</strong> and use the Account Deletion
				link from inside the app.
			</p>
		</div>

		<div class="legal-section">
			<h2>What Gets Deleted</h2>
			<p>
				Approved deletion requests remove the account and associated workspace data where deletion is
				legally and operationally allowed, including profile, invite, schedule, list, task, document,
				recipe, onboarding, and session data tied to the account or workspace.
			</p>
		</div>

		<div class="legal-section">
			<h2>What May Be Retained</h2>
			<p>
				Some records may be retained for security, fraud prevention, legal, tax, billing, abuse
				prevention, or compliance reasons. Trial-abuse prevention records may remain so a canceled or
				expired free trial cannot be restarted under the same identity.
			</p>
		</div>

		<div class="legal-section">
			<h2>Contact</h2>
			<p>
				Send deletion requests to NexusNorthSystems, LLC using the business contact channel connected
				to your Crimini workspace.
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
</style>

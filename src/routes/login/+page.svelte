<script>
	export let form;
	import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { page } from '$app/stores';
	let showPassword = false;
</script>

<Layout>
	<PageHeader title="Login" subtitle="Sign in to continue" />

	<form method="POST">
		<div>
			<label>Email</label>
			<input name="email" type="email" required autocapitalize="none" autocorrect="off" spellcheck="false" />
		</div>

		<div>
			<label>Password</label>
			<div class="password-row">
				<input name="password" type={showPassword ? 'text' : 'password'} required autocapitalize="none" autocorrect="off" spellcheck="false" />
				<button type="button" on:click={() => (showPassword = !showPassword)}>
					{showPassword ? 'Hide' : 'Show'}
				</button>
			</div>
		</div>

		<button type="submit">Login</button>
	</form>

	{#if form?.error}
		<p style="color:red;">{form.error}</p>
	{:else if $page.url.searchParams.get('error') === 'session'}
		<p style="color:red;">Your session could not be restored. Please sign in again.</p>
	{:else if $page.url.searchParams.get('registered') === 'pending'}
		<p class="notice">Account created. An admin must approve access before first login.</p>
	{/if}

	<p>
		No account?
		<a href="/register">Create one here</a>
	</p>

	<AppInstallCard compact />
</Layout>

<style>
	form {
		display: grid;
		gap: 0.75rem;
	}

	label {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	input {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-alt);
		color: var(--color-text);
	}

	button[type='submit'] {
		padding: 0.58rem 0.72rem;
		border-radius: 10px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}

	p {
		margin: 0.5rem 0 0;
		color: var(--color-text-muted);
	}

	a {
		color: var(--color-text);
	}

	.notice {
		color: var(--color-text-muted);
		margin-top: 0.5rem;
	}

	.password-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.password-row input {
		flex: 1;
	}

	@media (max-width: 760px) {
		.password-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>

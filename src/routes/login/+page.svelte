<script>
	export let form;
	import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
</script>

<Layout>
	<PageHeader title="Login" subtitle="Sign in to continue" />

	<form method="POST">
		<div>
			<label>Email</label>
			<input name="email" type="email" required />
		</div>

		<div>
			<label>Password</label>
			<input name="password" type="password" required />
		</div>

		<button type="submit">Login</button>
	</form>

	{#if form?.error}
		<p style="color:red;">{form.error}</p>
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
</style>

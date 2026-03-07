<script>
	export let form;
	import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	let showPassword = false;
	let showConfirmPassword = false;
</script>

<Layout>
	<PageHeader title="Create Account" subtitle="Register a new account" />

	<form method="POST">
		<div>
			<input name="display_name" placeholder="Display Name" required />

			<label>Email</label>
			<input name="email" type="email" required />

			<label>Confirm Email</label>
			<input name="confirm_email" type="email" required />
		</div>

		<div>
			<label>Password</label>
			<div>
				<input name="password" type={showPassword ? 'text' : 'password'} required />
				<button type="button" on:click={() => (showPassword = !showPassword)}>
					{showPassword ? 'Hide' : 'Show'}
				</button>
			</div>
		</div>

		<div>
			<label>Confirm Password</label>
			<div>
				<input name="confirm_password" type={showConfirmPassword ? 'text' : 'password'} required />
				<button type="button" on:click={() => (showConfirmPassword = !showConfirmPassword)}>
					{showConfirmPassword ? 'Hide' : 'Show'}
				</button>
			</div>
		</div>

		<div>
			<label>
				<input name="email_updates" type="checkbox" value="1" checked />
				Receive email updates
			</label>
		</div>

		<button type="submit">Register</button>
	</form>

	{#if form?.error}
		<p style="color:red;">{form.error}</p>
	{/if}

	<p>
		Already have an account?
		<a href="/login">Login</a>
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

	form > div > div {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	form > div > div input {
		flex: 1;
	}

	button {
		padding: 0.56rem 0.7rem;
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

	@media (max-width: 760px) {
		form > div > div {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>

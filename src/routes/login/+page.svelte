<script>
	export let form;
	export let data;
	import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { page } from '$app/stores';
	let showPassword = false;
</script>

<Layout>
	<PageHeader title="Login" />

	<section class="auth-shell">
		<form method="POST" class="auth-card">
			<div class="field">
				<label for="login-email">Email</label>
				<input
					id="login-email"
					name="email"
					type="email"
					required
					value={form?.email ?? data?.activeSession?.email ?? ''}
					autocapitalize="none"
					autocorrect="off"
					spellcheck="false"
				/>
			</div>

			<div class="field">
				<label for="login-password">Password</label>
				<div class="password-row">
					<input id="login-password" name="password" type={showPassword ? 'text' : 'password'} required autocapitalize="none" autocorrect="off" spellcheck="false" />
					<button type="button" class="toggle" on:click={() => (showPassword = !showPassword)}>
						{showPassword ? 'Hide' : 'Show'}
					</button>
				</div>
			</div>

			<button type="submit" class="submit">Login</button>
		</form>

		{#if data?.activeSession?.email}
			<div class="session-inline">
				<span>Signed in as {data.activeSession.email}</span>
				<div class="session-inline-actions">
					<a href="/app" class="mini-action">Continue</a>
					<form method="POST" action="?/not_you">
						<button type="submit" class="mini-action ghost">Not you?</button>
					</form>
				</div>
			</div>
		{/if}
	</section>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{:else if $page.url.searchParams.get('error') === 'session'}
		<p class="error">Your session could not be restored. Please sign in again.</p>
	{:else if $page.url.searchParams.get('registered') === 'success'}
		<p class="notice">Account created. You can sign in now.</p>
	{:else if $page.url.searchParams.get('purchase') === 'pending'}
		<p class="notice">Account created. Paid activation is pending app-store billing setup.</p>
	{:else if $page.url.searchParams.get('reset') === 'success'}
		<p class="notice">Password reset. You can sign in now.</p>
	{:else if $page.url.searchParams.get('trial') === 'expired'}
		<p class="error">Trial ended without conversion. The workspace was closed and trial access is now locked.</p>
	{:else if $page.url.searchParams.get('trial') === 'canceled'}
		<p class="notice">Workspace canceled and closed. Future signup will require paid activation.</p>
	{:else if $page.url.searchParams.get('switch') === '1'}
		<p class="notice">Session cleared. You can sign in with a different account.</p>
	{/if}

	<p>
		<a href="/forgot-password">Forgot password?</a>
	</p>

	<p>
		No account?
		<a href="/register#onboarding-slideshow">Create one here</a>
	</p>

	<AppInstallCard compact />
</Layout>

<style>
	form {
		width: min(100%, 34rem);
		display: grid;
		gap: 0.95rem;
	}

	.auth-shell {
		display: grid;
		gap: 1rem;
	}

	.session-inline {
		width: min(100%, 34rem);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-size: 0.86rem;
		color: var(--color-text-muted);
		padding: 0.1rem 0.1rem 0;
	}

	.session-inline-actions {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.session-inline-actions form {
		width: auto;
		display: inline;
	}

	.auth-card {
		padding: 1.15rem;
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: var(--radius-lg);
		background:
			linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
			color-mix(in srgb, var(--color-surface) 94%, black 6%);
		box-shadow: 0 18px 38px rgba(4, 5, 7, 0.2);
	}

	.field {
		display: grid;
		gap: 0.35rem;
	}

	label {
		display: block;
		font-size: 0.83rem;
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

	.submit {
		padding: 0.72rem 0.85rem;
		border-radius: 12px;
		border: 1px solid rgba(122, 132, 148, 0.24);
		background: linear-gradient(180deg, rgba(122, 132, 148, 0.24), rgba(122, 132, 148, 0.15));
		color: var(--color-primary-contrast);
		font-weight: var(--weight-semibold);
	}

	.mini-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.38rem 0.58rem;
		border-radius: 9px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-alt);
		color: var(--color-text);
		font-size: 0.79rem;
		text-decoration: none;
	}

	.mini-action.ghost {
		cursor: pointer;
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

	.error {
		color: #ff8d92;
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

	.toggle {
		min-width: 4.4rem;
		padding: 0.58rem 0.72rem;
	}

	@media (max-width: 760px) {
		.password-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>



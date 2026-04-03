<script>
	export let form;
	import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	let showPassword = false;
	let showConfirmPassword = false;
</script>

<Layout>
	<PageHeader title="Create Account" subtitle="Use your invite code to create an account" />

	<section class="auth-shell">
		<form method="POST" class="auth-card">
			<div class="field">
				<label for="register-display-name">Display Name</label>
				<input id="register-display-name" name="display_name" placeholder="How your name should appear" required />
			</div>

			<div class="field">
				<label for="register-email">Email</label>
				<input id="register-email" name="email" type="email" required />
			</div>

			<div class="field">
				<label for="register-confirm-email">Confirm Email</label>
				<input id="register-confirm-email" name="confirm_email" type="email" required />
			</div>

			<div class="field">
				<label for="register-invite-code">Invite Code</label>
				<input id="register-invite-code" name="invite_code" placeholder="INV-XXXXXXXXXXXX" required />
			</div>

			<div class="field">
				<label for="register-password">Password</label>
				<div class="password-row">
					<input id="register-password" name="password" type={showPassword ? 'text' : 'password'} required />
					<button type="button" class="toggle" on:click={() => (showPassword = !showPassword)}>
						{showPassword ? 'Hide' : 'Show'}
					</button>
				</div>
			</div>

			<div class="field">
				<label for="register-confirm-password">Confirm Password</label>
				<div class="password-row">
					<input id="register-confirm-password" name="confirm_password" type={showConfirmPassword ? 'text' : 'password'} required />
					<button type="button" class="toggle" on:click={() => (showConfirmPassword = !showConfirmPassword)}>
						{showConfirmPassword ? 'Hide' : 'Show'}
					</button>
				</div>
			</div>

			<label class="checkbox-row" for="register-email-updates">
				<input id="register-email-updates" name="email_updates" type="checkbox" value="1" checked />
				<span>Receive email updates</span>
			</label>

			<button type="submit" class="submit">Create Account</button>
		</form>
	</section>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<p>
		Already have an account?
		<a href="/login">Login</a>
	</p>
	<p>Registration requires an invite code from an admin. Once the code is accepted, your account is ready to sign in.</p>

	<AppInstallCard compact />
</Layout>

<style>
	form {
		width: min(100%, 36rem);
		display: grid;
		gap: 0.95rem;
	}

	.auth-shell {
		display: grid;
		gap: 1rem;
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

	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.15rem;
	}

	.checkbox-row input {
		width: auto;
	}

	.submit {
		padding: 0.72rem 0.85rem;
		border-radius: 12px;
		border: 1px solid rgba(179, 58, 63, 0.24);
		background: linear-gradient(180deg, rgba(179, 58, 63, 0.24), rgba(179, 58, 63, 0.15));
		color: var(--color-primary-contrast);
		font-weight: var(--weight-semibold);
	}

	p {
		margin: 0.5rem 0 0;
		color: var(--color-text-muted);
	}

	a {
		color: var(--color-text);
	}

	.error {
		color: #ff8d92;
	}

	@media (max-width: 760px) {
		.password-row {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>

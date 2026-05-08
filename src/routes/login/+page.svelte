<script lang="ts">
	import { page } from '$app/stores';
	import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
	import AuthShell from '$lib/components/ui/AuthShell.svelte';

	export let form:
		| {
				error?: string;
				email?: string;
		  }
		| undefined;
	export let data:
		| {
				activeSession?: {
					email: string;
					displayName?: string | null;
					businessName?: string | null;
					businessRole?: string | null;
					role?: string | null;
					continuePath?: string | null;
				} | null;
		  }
		| undefined;

	let showPassword = false;

	$: activeSession = data?.activeSession ?? null;
	$: emailValue = form?.email ?? activeSession?.email ?? '';
	$: statusMessage = (() => {
		const params = $page.url.searchParams;
		if (form?.error) return { tone: 'error', text: form.error };
		if (params.get('error') === 'session') return { tone: 'error', text: 'Your session ended. Sign in again to continue.' };
		if (params.get('registered') === 'success' && params.get('purchase') === 'pending') {
			return { tone: 'notice', text: 'Account created. Paid activation is pending app-store billing setup.' };
		}
		if (params.get('registered') === 'success') return { tone: 'notice', text: 'Account created. You can sign in now.' };
		if (params.get('reset') === 'success') return { tone: 'notice', text: 'Password reset. Sign in with your new password.' };
		if (params.get('trial') === 'expired') return { tone: 'error', text: 'Trial access ended. This workspace now requires paid activation.' };
		if (params.get('trial') === 'canceled') return { tone: 'notice', text: 'Workspace canceled. Future signup will require paid activation.' };
		if (params.get('switch') === '1') return { tone: 'notice', text: 'Session cleared. Sign in with the account you want to use.' };
		return null;
	})();
</script>

<AuthShell
	eyebrow=""
	title="Welcome back"
	subtitle=""
	supportText=""
>
	<div class="auth-stack">
		<form method="POST" action="?/login" class="auth-form">
			<div class="auth-form-head">
				<h2>Sign in</h2>
			</div>

			{#if statusMessage}
				<p class="auth-alert" class:error={statusMessage.tone === 'error'}>{statusMessage.text}</p>
			{/if}

			<div class="auth-field">
				<label for="login-email">Email</label>
				<input
					class="auth-input"
					id="login-email"
					name="email"
					type="email"
					required
					value={emailValue}
					autocomplete="email"
					autocapitalize="none"
					autocorrect="off"
					spellcheck="false"
				/>
			</div>

			<div class="auth-field">
				<div class="auth-label-row">
					<label for="login-password">Password</label>
					<a href="/forgot-password">Forgot?</a>
				</div>
				<div class="password-row">
					<input
						id="login-password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						required
						autocomplete="current-password"
						autocapitalize="none"
						autocorrect="off"
						spellcheck="false"
					/>
					<button type="button" class="auth-secondary-button" on:click={() => (showPassword = !showPassword)}>
						{showPassword ? 'Hide' : 'Show'}
					</button>
				</div>
			</div>

			<button type="submit" class="auth-button">Sign in</button>
		</form>

		{#if activeSession?.email}
			<div class="auth-divider"></div>
			<div class="signed-in-strip">
				<div>
					<span>Currently signed in</span>
					<strong>{activeSession.displayName || activeSession.email}</strong>
					{#if activeSession.businessName}
						<small>{activeSession.businessName}</small>
					{/if}
				</div>
				<div class="session-actions">
					<a href={activeSession.continuePath || '/app'} class="auth-secondary-button">Continue</a>
					<form method="POST" action="?/not_you">
						<button type="submit" class="auth-link-button">Not you?</button>
					</form>
				</div>
			</div>
		{/if}

		<div class="auth-footer-row">
			<p class="auth-footer">No account yet?</p>
			<a href="/register#onboarding-slideshow" class="auth-link-button">Create workspace</a>
		</div>

		<div class="install-wrap">
			<AppInstallCard compact />
		</div>
	</div>
</AuthShell>

<style>
	.auth-stack {
		display: grid;
		gap: 0.95rem;
	}

	.auth-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.auth-label-row a {
		color: var(--color-text-muted);
		font-size: 0.82rem;
		font-weight: var(--weight-semibold);
		text-decoration: none;
	}

	.auth-label-row a:hover {
		color: var(--color-text);
	}

	.signed-in-strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		flex-wrap: wrap;
		border-radius: 16px;
		background: color-mix(in srgb, var(--color-surface-alt) 82%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-border) 78%, transparent);
		padding: 0.78rem;
	}

	.signed-in-strip div:first-child {
		display: grid;
		gap: 0.12rem;
	}

	.signed-in-strip span,
	.signed-in-strip small {
		color: var(--color-text-muted);
		font-size: 0.76rem;
	}

	.signed-in-strip strong {
		color: var(--color-text);
		font-size: 0.92rem;
	}

	.session-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.session-actions form {
		display: inline;
	}

	.install-wrap {
		margin-top: 0.1rem;
	}

	@media (max-width: 520px) {
		.signed-in-strip,
		.session-actions {
			align-items: stretch;
		}

		.signed-in-strip,
		.session-actions,
		.session-actions .auth-secondary-button,
		.session-actions form,
		.session-actions button {
			width: 100%;
		}
	}
</style>

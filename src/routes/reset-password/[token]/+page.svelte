<script lang="ts">
	import AuthShell from '$lib/components/ui/AuthShell.svelte';

	export let data: { valid?: boolean; email?: string | null };
	export let form: { error?: string } | undefined;

	let showPassword = false;
	let showConfirmPassword = false;
</script>

<svelte:head>
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<AuthShell
	eyebrow="Secure Reset"
	title="Create a new password"
	subtitle="Choose a new password for your workspace account. Once saved, existing sessions are revoked."
	supportText="Reset links are single-use and expire automatically. After saving, sign in again with the new password."
>
	{#if data.valid}
		<form method="POST" class="auth-form">
			<div class="auth-form-head">
				<h2>Set new password</h2>
				{#if data.email}
					<p>{data.email}</p>
				{:else}
					<p>Enter and confirm your new password.</p>
				{/if}
			</div>

			{#if form?.error}
				<p class="auth-alert error">{form.error}</p>
			{/if}

			<div class="auth-field">
				<label for="reset-password">New password</label>
				<div class="password-row">
					<input
						id="reset-password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						required
						minlength="8"
						autocomplete="new-password"
					/>
					<button type="button" class="auth-secondary-button" on:click={() => (showPassword = !showPassword)}>
						{showPassword ? 'Hide' : 'Show'}
					</button>
				</div>
			</div>

			<div class="auth-field">
				<label for="reset-confirm-password">Confirm password</label>
				<div class="password-row">
					<input
						id="reset-confirm-password"
						name="confirm_password"
						type={showConfirmPassword ? 'text' : 'password'}
						required
						minlength="8"
						autocomplete="new-password"
					/>
					<button
						type="button"
						class="auth-secondary-button"
						on:click={() => (showConfirmPassword = !showConfirmPassword)}
					>
						{showConfirmPassword ? 'Hide' : 'Show'}
					</button>
				</div>
			</div>

			<p class="auth-subtle">Use at least 8 characters. Avoid passwords used on other accounts.</p>

			<button type="submit" class="auth-button">Save password</button>
		</form>
	{:else}
		<div class="auth-form invalid-link">
			<div class="auth-form-head">
				<h2>Link expired</h2>
				<p>This reset link is invalid, expired, or already used.</p>
			</div>
			<p class="auth-alert error">Request a new reset link to continue.</p>
			<a href="/forgot-password" class="auth-button">Request new link</a>
			<a href="/login" class="auth-link-button">Back to sign in</a>
		</div>
	{/if}
</AuthShell>

<style>
	.invalid-link {
		text-align: left;
	}
</style>

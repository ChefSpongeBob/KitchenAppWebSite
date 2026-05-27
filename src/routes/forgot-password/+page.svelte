<script lang="ts">
	import AuthShell from '$lib/components/ui/AuthShell.svelte';

	export let form:
		| {
				error?: string;
				notice?: string;
				email?: string;
		  }
		| undefined;
</script>

<AuthShell
	eyebrow=""
	title="Reset access"
	subtitle=""
	supportText=""
>
	<form method="POST" class="auth-form">
		<div class="auth-form-head">
			<h2>Forgot password?</h2>
		</div>

		{#if form?.error}
			<p class="auth-alert error">{form.error}</p>
		{:else if form?.notice}
			<p class="auth-alert">{form.notice}</p>
		{/if}

		<div class="auth-field">
			<label for="reset-email">Email</label>
			<input
				class="auth-input"
				id="reset-email"
				name="email"
				type="email"
				required
				value={form?.email ?? ''}
				autocomplete="email"
				autocapitalize="none"
				autocorrect="off"
				spellcheck="false"
			/>
		</div>

		<button type="submit" class="auth-button">Send reset link</button>

		<div class="auth-footer-row">
			<p class="auth-footer">Remembered it?</p>
			<a href="/login" class="auth-link-button">Back to sign in</a>
		</div>
	</form>
</AuthShell>

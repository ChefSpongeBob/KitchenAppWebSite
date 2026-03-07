<script>
	export let form;
	import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
	let showPassword = false;
	let showConfirmPassword = false;
</script>

<h1>Create Account</h1>

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

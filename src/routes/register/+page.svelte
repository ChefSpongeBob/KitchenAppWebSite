<script>
	export let form;
</script>

<h1>Create Account</h1>

<form method="POST">
	<div>
		<input name="display_name" placeholder="Display Name" required />

		<label>Email</label>
		<input name="email" type="email" required />
	</div>

	<div>
		<label>Password</label>
		<input name="password" type="password" required />
	</div>

	<div>
		<label>Choose PIN</label>
		<input name="pin" type="password" inputmode="numeric" required />
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
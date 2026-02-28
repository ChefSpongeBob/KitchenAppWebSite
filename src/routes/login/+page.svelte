<script>
	export let form;
</script>

<h1>Login</h1>

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
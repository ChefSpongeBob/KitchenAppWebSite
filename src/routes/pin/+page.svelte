<script>
	export let form;
</script>

<h1>Enter PIN</h1>

<form method="POST">
	<div>
		<label>PIN</label>
		<input name="pin" type="password" inputmode="numeric" required />
	</div>

	<button type="submit">Unlock</button>
</form>

{#if form?.error}
	<p style="color:red;">{form.error}</p>
{/if}

<p>
	Not your device?
	<a href="/login">Login with email</a>
</p>
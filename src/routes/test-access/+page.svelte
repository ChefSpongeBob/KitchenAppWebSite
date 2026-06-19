<script lang="ts">
	let { data, form } = $props<{
		data: { next: string };
		form?: { error?: string; next?: string };
	}>();
</script>

<svelte:head>
	<title>Private Test Access | Crimini</title>
</svelte:head>

<main class="access-shell">
	<section class="access-panel">
		<img src="/crimini-full-logo.jpg" alt="Crimini" />
		<form method="POST">
			<input type="hidden" name="next" value={form?.next ?? data.next} />
			<label for="access-code">Private access</label>
			<div class="access-row">
				<input id="access-code" name="accessCode" type="password" autocomplete="off" required />
				<button type="submit">Enter</button>
			</div>
			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}
		</form>
	</section>
</main>

<style>
	.access-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: clamp(1.5rem, 5vw, 4rem);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 241, 231, 0.96)),
			var(--color-page, #f7f1e7);
		color: var(--color-text, #211b16);
	}

	.access-panel {
		width: min(100%, 420px);
		display: grid;
		gap: 1.4rem;
		padding: clamp(1.4rem, 5vw, 2.2rem);
		border-top: 1px solid rgba(33, 27, 22, 0.24);
		border-bottom: 1px solid rgba(33, 27, 22, 0.14);
		background: rgba(255, 255, 255, 0.72);
	}

	img {
		width: min(260px, 80%);
		justify-self: center;
		height: auto;
	}

	form,
	.access-row {
		display: grid;
		gap: 0.75rem;
	}

	label {
		font-size: 0.8rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(33, 27, 22, 0.68);
	}

	.access-row {
		grid-template-columns: 1fr auto;
		align-items: center;
		border-bottom: 1px solid rgba(33, 27, 22, 0.2);
	}

	input {
		min-width: 0;
		border: 0;
		background: transparent;
		color: inherit;
		padding: 0.7rem 0;
		font: inherit;
		outline: none;
	}

	button {
		border: 0;
		border-left: 1px solid rgba(33, 27, 22, 0.24);
		background: transparent;
		color: inherit;
		padding: 0.65rem 0 0.65rem 1rem;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	button:focus-visible,
	input:focus-visible {
		outline: 2px solid rgba(33, 27, 22, 0.36);
		outline-offset: 3px;
	}

	.error {
		margin: 0;
		color: #8f2e21;
		font-size: 0.92rem;
	}

	@media (max-width: 520px) {
		.access-row {
			grid-template-columns: 1fr;
		}

		button {
			border-left: 0;
			border-top: 1px solid rgba(33, 27, 22, 0.18);
			padding-left: 0;
			text-align: left;
		}
	}
</style>

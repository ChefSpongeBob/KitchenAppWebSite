<script>
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { enhance } from '$app/forms';
</script>

<Layout>
	<PageHeader title="Manage Tasks" />

	<form method="POST" action="?/create" use:enhance>
		<div class="task-form">
			<label class="field-group">
				<span>Task Title</span>
				<input
					class="field"
					name="title"
					placeholder="Enter task title..."
					required
				/>
			</label>

			<label class="field-group">
				<span>Description</span>
				<textarea
					class="field"
					name="description"
					rows="4"
					placeholder="Enter task details..."
				></textarea>
			</label>

			<button type="submit" class="create-button">Create Task</button>
		</div>
	</form>
</Layout>

<style>
	.task-form {
		display: grid;
		gap: 1rem;
		padding: 1rem;
		padding-bottom: 6rem;
		border: 1px solid var(--color-divider);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.field-group {
		display: grid;
		gap: 0.5rem;
	}

	.field-group span {
		font-size: 0.78rem;
		font-weight: var(--weight-semibold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.field {
		width: 100%;
		padding: 0.72rem 0.82rem;
		border-radius: 0;
		border: var(--surface-outline);
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: none;
	}

	.create-button {
		align-self: flex-start;
		background: transparent;
		border: 1px solid var(--color-border);
		color: var(--color-text);
		font-weight: var(--weight-semibold);
		padding: 0.62rem 1rem;
		border-radius: 0;
		cursor: pointer;
	}

	@media (max-width: 760px) {
		.task-form {
			gap: 0.8rem;
			padding-bottom: 5rem;
		}
	}
</style>

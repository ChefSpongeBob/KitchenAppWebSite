<script>
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
	import { enhance } from '$app/forms';
</script>

<Layout>
	<PageHeader title="Manage Tasks" />

	<form method="POST" action="?/create" use:enhance>
		<div class="card-list">

			<div class="card-wrapper">
				<DashboardCard
					title="Task Title"
					description=""
				/>
				<input
					class="field"
					name="title"
					placeholder="Enter task title..."
					required
				/>
			</div>

			<div class="card-wrapper">
				<DashboardCard
					title="Description"
					description=""
				/>
				<textarea
					class="field"
					name="description"
					rows="4"
					placeholder="Enter task details..."
				></textarea>
			</div>

			<div class="card-wrapper">
				<button type="submit" class="create-button">
					Create Task
				</button>
			</div>

		</div>
	</form>
</Layout>

<style>
	.card-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-bottom: 6rem;
	}

	.card-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.field {
		width: 100%;
		padding: 0.72rem 0.82rem;
		border-radius: var(--radius-md);
		border: var(--surface-outline);
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: inset 0 1px 0 color-mix(in srgb, white 4%, transparent);
	}

	.create-button {
		align-self: flex-start;
		background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface));
		border: 1px solid color-mix(in srgb, var(--color-primary) 42%, var(--color-border) 58%);
		color: var(--color-text);
		font-weight: var(--weight-semibold);
		padding: 0.62rem 1rem;
		border-radius: 999px;
		cursor: pointer;
	}

	@media (max-width: 760px) {
		.card-list {
			gap: 0.8rem;
			padding-bottom: 5rem;
		}
	}
</style>

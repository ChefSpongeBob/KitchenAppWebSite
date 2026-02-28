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
		padding: 0.6rem;
		border-radius: 10px;
		border: 1px solid var(--border-subtle);
		background: transparent;
		color: var(--text-primary);
	}

	.create-button {
		background: rgba(235, 24, 24, 0.15);
		border: 1px solid rgba(0,0,0,0.4);
		padding: 0.5rem 1rem;
		border-radius: 999px;
		cursor: pointer;
	}
</style>
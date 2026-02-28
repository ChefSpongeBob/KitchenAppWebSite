<script>
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

	export let data;

	const logs = data.logs ?? [];
</script>

<Layout>
	<PageHeader title="Completion Log" />

	<div class="card-list">
		{#if logs.length === 0}
			<p style="padding: 1rem;">No completed tasks yet.</p>
		{/if}

		{#each logs as log (log.id)}
			<div class="card-wrapper">
				<DashboardCard
					title={log.title}
					description={
						'Completed by: ' +
						(log.display_name ?? 'Unknown') +
						'\n\nCompleted at: ' +
						new Date(log.completed_at * 1000).toLocaleString()
					}
				/>
			</div>
		{/each}
	</div>
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
		gap: 4px;
	}
</style>
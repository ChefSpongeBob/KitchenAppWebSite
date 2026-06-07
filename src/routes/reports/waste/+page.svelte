<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	export let data;

	$: csvHref = `/reports/waste.csv?start=${data.startDate}&end=${data.endDate}`;

	function dateLabel(timestamp: number) {
		return new Date(timestamp * 1000).toLocaleString([], {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<Layout>
	<PageHeader title="Waste Logs" />

	<div class="report-toolbar">
		<a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
		<a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>CSV</a>
	</div>

	<section class="report-table-wrap">
		{#if data.rows.length}
			<table class="report-table">
				<thead>
					<tr>
						<th>Date</th>
						<th>Product</th>
						<th>Amount</th>
						<th>Reason</th>
						<th>Submitted By</th>
						<th>Notes</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row}
						<tr>
							<td>{dateLabel(row.created_at)}</td>
							<td><strong>{row.product}</strong></td>
							<td>{row.amount ?? '-'} {row.unit}</td>
							<td>{row.reason}</td>
							<td>
								<strong>{row.submitted_by_name}</strong>
								<span>{row.submitted_by_email}</span>
							</td>
							<td>{row.notes || '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="empty-state">No waste logs yet.</p>
		{/if}
	</section>
</Layout>

<style>
	.report-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.9rem;
		align-items: center;
		padding: 0.7rem 0;
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}

	.report-toolbar a {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border-bottom: 1px solid var(--color-divider);
		color: var(--color-text);
		font-weight: var(--weight-semibold);
		text-decoration: none;
	}

	.report-toolbar .material-icons {
		color: var(--color-text-muted);
		font-size: 1rem;
		line-height: 1;
	}

	.report-table-wrap {
		overflow-x: auto;
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}

	.report-table {
		width: 100%;
		min-width: 840px;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.75rem 0.55rem;
		border-bottom: 1px solid var(--color-divider);
		text-align: left;
		vertical-align: top;
	}

	th {
		color: var(--color-text-muted);
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	td span {
		display: block;
		margin-top: 0.2rem;
		color: var(--color-text-muted);
		font-size: 0.88rem;
	}

	.empty-state {
		margin: 0;
		padding: 1rem 0;
		color: var(--color-text-muted);
	}
</style>

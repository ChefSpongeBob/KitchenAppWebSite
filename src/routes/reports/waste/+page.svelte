<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import ReportExportList, { type ReportExportEntry } from '$lib/components/ui/ReportExportList.svelte';

	type WasteRow = {
		product: string;
		amount: number | null;
		unit: string;
		reason: string;
		submitted_by_name: string;
		created_at: number;
		created_date: string;
	};

	export let data: {
		startDate: string;
		endDate: string;
		rows: WasteRow[];
	};

	$: csvHref = `/reports/waste.csv?start=${data.startDate}&end=${data.endDate}`;

	function dateLabel(timestamp: number) {
		return new Date(timestamp * 1000).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	$: entries = data.rows.map((row): ReportExportEntry => ({
		title: `${row.product} · ${dateLabel(row.created_at)}`,
		meta: `${row.amount ?? '-'} ${row.unit} · ${row.reason}`,
		detail: row.submitted_by_name,
		href: `/reports/waste.csv?start=${row.created_date}&end=${row.created_date}&created_at=${row.created_at}`,
		icon: 'delete_sweep'
	}));
</script>

<Layout>
	<PageHeader title="Waste Logs" />

	<div class="report-toolbar">
		<a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
		<a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>Full CSV</a>
	</div>

	<ReportExportList {entries} empty="No waste log exports yet." icon="delete_sweep" />
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
</style>

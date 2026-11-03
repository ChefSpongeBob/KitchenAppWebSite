<script lang="ts">
  import Layout from '#lib/components/ui/Layout.svelte';
  import PageHeader from '#lib/components/ui/PageHeader.svelte';
  import ReportDataTable, {
    type ReportTableColumn,
    type ReportTableRow
  } from '#lib/components/ui/ReportDataTable.svelte';
  import ReportDateFilters from '#lib/components/ui/ReportDateFilters.svelte';
  import ReportExportList, { type ReportExportEntry } from '#lib/components/ui/ReportExportList.svelte';
  import ReportSummaryStrip, { type ReportMetric } from '#lib/components/ui/ReportSummaryStrip.svelte';
  import ReportToolbar from '#lib/components/ui/ReportToolbar.svelte';
  import { nativeServerUrl } from '#lib/client/nativeServerUrl.ts';

  type WasteRow = {
    product: string;
    amount: number | null;
    unit: string;
    reason: string;
    notes: string;
    submitted_by_name: string;
    submitted_by_email: string;
    created_at: number;
    created_date: string;
  };

  export let data: {
    startDate: string;
    endDate: string;
    rows: WasteRow[];
  };

  const tableColumns: ReportTableColumn[] = [
    { key: 'date', label: 'Date' },
    { key: 'product', label: 'Product' },
    { key: 'amount', label: 'Amount' },
    { key: 'reason', label: 'Reason' },
    { key: 'notes', label: 'Notes' },
    { key: 'submittedBy', label: 'Submitted By' }
  ];

  $: csvHref = nativeServerUrl(`/reports/waste.csv?start=${data.startDate}&end=${data.endDate}`);

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
    title: `${row.product} | ${dateLabel(row.created_at)}`,
    meta: `${row.amount ?? '-'} ${row.unit} | ${row.reason}`,
    detail: row.submitted_by_name,
    href: `/reports/waste.csv?start=${row.created_date}&end=${row.created_date}&created_at=${row.created_at}`,
    icon: 'delete_sweep'
  }));
  $: metrics = [
    { label: 'Entries', value: data.rows.length },
    { label: 'Products', value: new Set(data.rows.map((row) => row.product.trim().toLowerCase())).size },
    { label: 'Submitted By', value: new Set(data.rows.map((row) => row.submitted_by_name)).size }
  ] satisfies ReportMetric[];
  $: tableRows = data.rows.map(
    (row, index): ReportTableRow => ({
      id: `${row.created_at}-${index}`,
      cells: {
        date: dateLabel(row.created_at),
        product: row.product,
        amount: row.amount == null ? '-' : `${row.amount} ${row.unit}`.trim(),
        reason: row.reason,
        notes: row.notes || '-',
        submittedBy: row.submitted_by_name
      }
    })
  );
</script>

<Layout>
  <PageHeader title="Waste Logs" />

  <ReportToolbar exportHref={csvHref} />
  <ReportDateFilters startDate={data.startDate} endDate={data.endDate} />
  <ReportSummaryStrip {metrics} />
  <ReportDataTable columns={tableColumns} rows={tableRows} empty="No waste entries in this range." />
  <ReportExportList {entries} empty="No waste log exports yet." icon="delete_sweep" collapsed />
</Layout>

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

  type OnboardingRow = {
    employee_name: string;
    employee_email: string;
    package_status: string;
    payroll_classification: string;
    sent_at: number;
    completed_at: number | null;
    approved_at: number | null;
    approved_by_name: string;
    created_by_name: string;
    item_count: number;
    pending_items: number;
    submitted_items: number;
    approved_items: number;
    changes_requested_items: number;
    updated_at: number;
  };

  export let data: {
    startDate: string;
    endDate: string;
    rows: OnboardingRow[];
  };

  const tableColumns: ReportTableColumn[] = [
    { key: 'employee', label: 'Employee' },
    { key: 'status', label: 'Status' },
    { key: 'classification', label: 'Classification' },
    { key: 'items', label: 'Items', align: 'right' },
    { key: 'pending', label: 'Pending', align: 'right' },
    { key: 'submitted', label: 'Submitted', align: 'right' },
    { key: 'approved', label: 'Approved', align: 'right' },
    { key: 'updated', label: 'Updated' }
  ];

  $: csvHref = nativeServerUrl(`/reports/onboarding.csv?start=${data.startDate}&end=${data.endDate}`);

  function monthFromTimestamp(timestamp: number) {
    return new Date(timestamp * 1000).toISOString().slice(0, 7);
  }

  function monthBounds(month: string) {
    const start = `${month}-01`;
    const endDate = new Date(`${start}T00:00:00`);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    return { start, end: endDate.toISOString().slice(0, 10) };
  }

  function monthLabel(month: string) {
    return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  function formatTimestamp(timestamp: number | null) {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function displayValue(value: string) {
    return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '-';
  }

  $: entries = Object.values(
    data.rows.reduce<Record<string, { month: string; count: number; approved: number }>>((months, row) => {
      const month = monthFromTimestamp(row.updated_at);
      const entry = months[month] ?? { month, count: 0, approved: 0 };
      entry.count += 1;
      if (row.package_status === 'approved') entry.approved += 1;
      months[month] = entry;
      return months;
    }, {})
  )
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((entry): ReportExportEntry => {
      const range = monthBounds(entry.month);
      return {
        title: monthLabel(entry.month),
        meta: `${entry.count} package${entry.count === 1 ? '' : 's'} | ${entry.approved} approved`,
        href: `/reports/onboarding.csv?start=${range.start}&end=${range.end}`,
        icon: 'assignment_ind'
      };
    });
  $: metrics = [
    { label: 'Packages', value: data.rows.length },
    { label: 'Approved', value: data.rows.filter((row) => row.package_status === 'approved').length },
    {
      label: 'Needs Attention',
      value: data.rows.filter((row) => row.pending_items > 0 || row.changes_requested_items > 0).length
    }
  ] satisfies ReportMetric[];
  $: tableRows = data.rows.map(
    (row, index): ReportTableRow => ({
      id: `${row.employee_name}-${row.updated_at}-${index}`,
      cells: {
        employee: row.employee_name,
        status: displayValue(row.package_status),
        classification: displayValue(row.payroll_classification),
        items: row.item_count,
        pending: row.pending_items + row.changes_requested_items,
        submitted: row.submitted_items,
        approved: row.approved_items,
        updated: formatTimestamp(row.updated_at)
      }
    })
  );
</script>

<Layout>
  <PageHeader title="Onboarding Report" />

  <ReportToolbar exportHref={csvHref} />
  <ReportDateFilters startDate={data.startDate} endDate={data.endDate} />
  <ReportSummaryStrip {metrics} />
  <ReportDataTable columns={tableColumns} rows={tableRows} empty="No onboarding activity in this range." />
  <ReportExportList {entries} empty="No onboarding exports yet." icon="assignment_ind" collapsed />
</Layout>

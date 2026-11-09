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
  import { reportMonthBounds as monthBounds } from '#lib/reportDates.ts';
  import { nativeServerUrl } from '#lib/client/nativeServerUrl.ts';

  type RequestRow = {
    request_date: string;
    request_type: string;
    employee_name: string;
    employee_email: string;
    status: string;
    department: string;
    role_name: string;
    detail: string;
    start_time: string;
    end_label: string;
    note: string;
    manager_note: string;
    resolved_by_name: string;
    updated_at: number;
  };

  export let data: {
    timeZone?: string;
    hasMore?: boolean;
    startDate: string;
    endDate: string;
    rows: RequestRow[];
  };

  const closedStatuses = ['approved', 'declined', 'denied', 'resolved'];
  const tableColumns: ReportTableColumn[] = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'employee', label: 'Employee' },
    { key: 'status', label: 'Status' },
    { key: 'assignment', label: 'Department / Role' },
    { key: 'detail', label: 'Detail' },
    { key: 'resolvedBy', label: 'Resolved By' }
  ];

  $: csvHref = nativeServerUrl(`/reports/requests.csv?start=${data.startDate}&end=${data.endDate}`);

  function monthKey(dateIso: string) {
    return dateIso.slice(0, 7);
  }


  function monthLabel(month: string) {
    return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  function formatDate(dateIso: string) {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function displayType(value: string) {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  $: entries = Object.values(
    data.rows.reduce<Record<string, { month: string; count: number; pending: number }>>((months, row) => {
      const month = monthKey(row.request_date);
      const entry = months[month] ?? { month, count: 0, pending: 0 };
      entry.count += 1;
      if (!closedStatuses.includes(row.status)) entry.pending += 1;
      months[month] = entry;
      return months;
    }, {})
  )
    .sort((a, b) => b.month.localeCompare(a.month))
    .map((entry): ReportExportEntry => {
      const range = monthBounds(entry.month);
      return {
        title: monthLabel(entry.month),
        meta: `${entry.count} request${entry.count === 1 ? '' : 's'} | ${entry.pending} open`,
        href: `/reports/requests.csv?start=${range.start}&end=${range.end}`,
        icon: 'swap_horiz'
      };
    });
  $: metrics = [
    { label: 'Requests', value: data.rows.length },
    { label: 'Open', value: data.rows.filter((row) => !closedStatuses.includes(row.status)).length },
    { label: 'Resolved', value: data.rows.filter((row) => closedStatuses.includes(row.status)).length }
  ] satisfies ReportMetric[];
  $: tableRows = data.rows.map(
    (row, index): ReportTableRow => ({
      id: `${row.request_type}-${row.request_date}-${row.updated_at}-${index}`,
      cells: {
        date: formatDate(row.request_date),
        type: displayType(row.request_type),
        employee: row.employee_name,
        status: displayType(row.status),
        assignment: [row.department, row.role_name].filter(Boolean).join(' / ') || '-',
        detail: row.detail || row.note || '-',
        resolvedBy: row.resolved_by_name || '-'
      }
    })
  );
</script>

<Layout>
  <PageHeader title="Schedule Requests" />

  <ReportToolbar exportHref={csvHref} />
  <ReportDateFilters startDate={data.startDate} endDate={data.endDate} />
  <ReportSummaryStrip {metrics} />
  {#if data.hasMore}<p>Summary counts cover the preview. Narrow the date range to see more.</p>{/if}
  <ReportDataTable hasMore={data.hasMore ?? false} columns={tableColumns} rows={tableRows} empty="No schedule requests in this range." />
  <ReportExportList {entries} partial={data.hasMore ?? false} empty="No schedule request exports yet." icon="swap_horiz" collapsed />
</Layout>

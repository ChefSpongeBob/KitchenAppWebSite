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

  type ScheduleHistoryRow = {
    publish_id: string;
    week_start: string;
    version_number: number;
    published_at: number;
    published_by_name: string;
    shift_date: string;
    employee_name_snapshot: string;
    department: string;
    role_name: string;
    detail: string | null;
    start_time: string;
    end_label: string | null;
    break_minutes: number;
    notes: string | null;
  };

  type PublishedWeek = ScheduleHistoryRow & {
    shift_count: number;
  };

  export let data: {
    timeZone?: string;
    hasMore?: boolean;
    startDate: string;
    endDate: string;
    rows: ScheduleHistoryRow[];
  };

  const tableColumns: ReportTableColumn[] = [
    { key: 'date', label: 'Shift Date' },
    { key: 'employee', label: 'Employee' },
    { key: 'department', label: 'Department' },
    { key: 'role', label: 'Role' },
    { key: 'time', label: 'Time' },
    { key: 'break', label: 'Break' },
    { key: 'version', label: 'Published Version' }
  ];

  $: csvHref = nativeServerUrl(`/reports/schedule.csv?start=${data.startDate}&end=${data.endDate}`);
  $: publishedWeeks = Object.values(
    data.rows.reduce<Record<string, PublishedWeek>>((weeks, row) => {
      const existing = weeks[row.week_start];
      if (!existing || row.version_number > existing.version_number) {
        weeks[row.week_start] = { ...row, shift_count: 1 };
      } else if (row.version_number === existing.version_number) {
        existing.shift_count += 1;
      }
      return weeks;
    }, {})
  ).sort((a, b) => b.week_start.localeCompare(a.week_start));

  function formatDate(dateIso: string) {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatPublishedDate(timestamp: number) {
    if (!timestamp) return 'Not recorded';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      timeZone: data.timeZone ?? 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function weekCsvHref(week: PublishedWeek) {
    return `/reports/schedule.csv?start=${week.week_start}&end=${week.week_start}&publish_id=${encodeURIComponent(week.publish_id)}`;
  }

  $: entries = publishedWeeks.map((week): ReportExportEntry => ({
    title: `Week of ${formatDate(week.week_start)}`,
    meta: `Version ${week.version_number} | ${week.shift_count} shift${week.shift_count === 1 ? '' : 's'} | Published ${formatPublishedDate(week.published_at)}`,
    detail: week.published_by_name,
    href: weekCsvHref(week),
    icon: 'calendar_month'
  }));
  $: metrics = [
    { label: 'Published Weeks', value: publishedWeeks.length },
    { label: 'Published Shifts', value: data.rows.length },
    { label: 'Employees', value: new Set(data.rows.map((row) => row.employee_name_snapshot)).size }
  ] satisfies ReportMetric[];
  $: tableRows = data.rows.map(
    (row, index): ReportTableRow => ({
      id: `${row.week_start}-${row.version_number}-${row.shift_date}-${index}`,
      cells: {
        date: formatDate(row.shift_date),
        employee: row.employee_name_snapshot,
        department: row.department || '-',
        role: row.role_name || row.detail || '-',
        time: `${row.start_time} - ${row.end_label || 'Open'}`,
        break: `${row.break_minutes || 0} min`,
        version: `${formatDate(row.week_start)} / v${row.version_number}`
      }
    })
  );
</script>

<Layout>
  <PageHeader title="Schedule History" />

  <ReportToolbar exportHref={csvHref} />
  <ReportDateFilters startDate={data.startDate} endDate={data.endDate} />
  <ReportSummaryStrip {metrics} />
  {#if data.hasMore}<p>Summary counts cover the preview. Narrow the date range to see more.</p>{/if}
  <ReportDataTable hasMore={data.hasMore ?? false} columns={tableColumns} rows={tableRows} empty="No published schedules in this range." />
  <ReportExportList {entries} partial={data.hasMore ?? false} empty="No published schedules yet." icon="calendar_month" collapsed />
</Layout>

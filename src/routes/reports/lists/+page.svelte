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
  import ReportToolbar, { type ReportToolbarLink } from '#lib/components/ui/ReportToolbar.svelte';
  import { addReportDays as addDays, reportWeekStart as weekStart, reportMonthBounds } from '#lib/reportDates.ts';
  import { nativeServerUrl } from '#lib/client/nativeServerUrl.ts';

  type ListDomain = 'preplists' | 'inventory' | 'orders' | 'checklists';
  type ListHistoryRow = {
    batch_id: string;
    section_id: string;
    business_day: string;
    submitted_at: number;
    section_title_snapshot: string;
    submitted_by_name: string;
    item_name_snapshot: string;
    details_snapshot: string;
    submitted_value: string;
    par_count_snapshot: number;
    is_checked_snapshot: number;
    completed_by_name: string | null;
    completed_at: number | null;
    event_type: string;
  };

  export let data: {
    domain: ListDomain;
    timeZone?: string;
    hasMore?: boolean;
    recentStart?: string;
    startDate: string;
    endDate: string;
    rows: ListHistoryRow[];
  };

  const titles: Record<ListDomain, string> = {
    preplists: 'Prep History',
    inventory: 'Inventory History',
    orders: 'Order History',
    checklists: 'Checklist History'
  };

  const icons: Record<ListDomain, string> = {
    preplists: 'restaurant',
    inventory: 'inventory_2',
    orders: 'receipt_long',
    checklists: 'fact_check'
  };

  const tableColumns: ReportTableColumn[] = [
    { key: 'date', label: 'Date' },
    { key: 'list', label: 'List' },
    { key: 'item', label: 'Item' },
    { key: 'value', label: 'Value / Action' },
    { key: 'done', label: 'Done' },
    { key: 'completedBy', label: 'Completed By' },
    { key: 'submittedBy', label: 'Submitted By' }
  ];

  $: csvHref = nativeServerUrl(`/reports/lists.csv?domain=${data.domain}&start=${data.startDate}&end=${data.endDate}`);
  $: reportLinks = [
    { href: '/reports/lists?domain=preplists', label: 'Prep', icon: 'restaurant', active: data.domain === 'preplists' },
    { href: '/reports/lists?domain=inventory', label: 'Inventory', icon: 'inventory_2', active: data.domain === 'inventory' },
    { href: '/reports/lists?domain=orders', label: 'Orders', icon: 'receipt_long', active: data.domain === 'orders' },
    { href: '/reports/lists?domain=checklists', label: 'Checklists', icon: 'fact_check', active: data.domain === 'checklists' }
  ] satisfies ReportToolbarLink[];



  function formatDate(dateIso: string) {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function submissionEntries(rows: ListHistoryRow[]) {
    const groups = rows.reduce<Record<string, { row: ListHistoryRow; itemCount: number }>>((map, row) => {
      const key = row.batch_id;
      const existing = map[key];
      if (existing) existing.itemCount += 1;
      else map[key] = { row, itemCount: 1 };
      return map;
    }, {});

    return Object.values(groups)
      .sort((a, b) => b.row.business_day.localeCompare(a.row.business_day) || b.row.submitted_at - a.row.submitted_at)
      .map(({ row, itemCount }): ReportExportEntry => ({
        title: `${row.section_title_snapshot} | ${formatDate(row.business_day)}`,
        meta: `${itemCount} item${itemCount === 1 ? '' : 's'} | ${row.submitted_by_name}`,
        href: `/reports/lists.csv?domain=${data.domain}&start=${row.business_day}&end=${row.business_day}&batch_id=${encodeURIComponent(row.batch_id)}`,
        icon: icons[data.domain]
      }));
  }

  function weeklyEntries(rows: ListHistoryRow[]) {
    const groups = rows.reduce<Record<string, { week: string; itemCount: number; submissions: Set<string> }>>((map, row) => {
      const week = weekStart(row.business_day);
      const existing = map[week] ?? { week, itemCount: 0, submissions: new Set<string>() };
      existing.itemCount += 1;
      existing.submissions.add(row.batch_id);
      map[week] = existing;
      return map;
    }, {});

    return Object.values(groups)
      .sort((a, b) => b.week.localeCompare(a.week))
      .map((entry): ReportExportEntry => ({
        title: `Week of ${formatDate(entry.week)}`,
        meta: `${entry.itemCount} item${entry.itemCount === 1 ? '' : 's'} | ${entry.submissions.size} submission${entry.submissions.size === 1 ? '' : 's'}`,
        href: `/reports/lists.csv?domain=${data.domain}&start=${entry.week}&end=${addDays(entry.week, 6)}`,
        icon: icons[data.domain]
      }));
  }

  function checklistEntries(rows: ListHistoryRow[]) {
    const recentStart = data.recentStart ?? addDays(data.endDate, -6);
    const groups = new Map<string, { start: string; end: string; count: number; runs: Set<string> }>();
    for (const row of rows) {
      const recent = row.business_day >= recentStart;
      const period = recent ? { start: weekStart(row.business_day), end: addDays(weekStart(row.business_day), 6) }
        : reportMonthBounds(row.business_day.slice(0, 7));
      const start = [period.start, data.startDate, ...(recent ? [recentStart] : [])].sort().at(-1)!;
      const end = [period.end, data.endDate, ...(!recent ? [addDays(recentStart, -1)] : [])].sort()[0];
      const key = start + ':' + end;
      const group = groups.get(key) ?? { start, end, count: 0, runs: new Set<string>() };
      group.count++; group.runs.add(row.batch_id); groups.set(key, group);
    }
    return [...groups.values()].sort((a,b) => b.start.localeCompare(a.start)).map((group): ReportExportEntry => ({
      title: formatDate(group.start) + ' to ' + formatDate(group.end),
      meta: group.runs.size + ' completed runs | ' + group.count + ' items',
      href: '/reports/lists.csv?domain=checklists&start=' + group.start + '&end=' + group.end,
      icon: icons.checklists
    }));
  }
  $: entries = data.domain === 'orders' ? weeklyEntries(data.rows) : data.domain === 'checklists' ? checklistEntries(data.rows) : submissionEntries(data.rows);
  $: metrics = [
    { label: 'Submissions', value: new Set(data.rows.map(row => row.batch_id)).size },
    { label: 'Items', value: data.rows.length },
    { label: 'Completed', value: data.rows.filter((row) => Boolean(row.is_checked_snapshot)).length }
  ] satisfies ReportMetric[];
  $: tableRows = data.rows.map(
    (row, index): ReportTableRow => ({
      id: `${row.business_day}-${row.submitted_at}-${index}`,
      cells: {
        date: formatDate(row.business_day),
        list: row.section_title_snapshot,
        item: row.details_snapshot ? `${row.item_name_snapshot} - ${row.details_snapshot}` : row.item_name_snapshot,
        value: row.submitted_value || (row.par_count_snapshot ? String(row.par_count_snapshot) : '-'),
        done: row.is_checked_snapshot ? 'Yes' : 'No',
        completedBy: row.completed_by_name || '-',
        submittedBy: row.submitted_by_name
      }
    })
  );
</script>

<Layout>
  <PageHeader title={titles[data.domain] ?? 'List History'} />

  <ReportToolbar exportHref={csvHref} links={reportLinks} />
  <ReportDateFilters startDate={data.startDate} endDate={data.endDate} hidden={{ domain: data.domain }} />
  <ReportSummaryStrip {metrics} />
  {#if data.hasMore}<p>Summary counts cover the preview. Narrow the date range to see more.</p>{/if}
  <ReportDataTable hasMore={data.hasMore ?? false} columns={tableColumns} rows={tableRows} />
  <ReportExportList {entries} partial={data.hasMore ?? false} empty="No history exports yet." icon={icons[data.domain]} collapsed />
</Layout>

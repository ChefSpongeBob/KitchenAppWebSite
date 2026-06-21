<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ReportExportList, { type ReportExportEntry } from '$lib/components/ui/ReportExportList.svelte';

  type ScheduleHistoryRow = {
    week_start: string;
    version_number: number;
    published_at: number;
    published_by_name: string;
  };

  type PublishedWeek = ScheduleHistoryRow & {
    shift_count: number;
  };

  export let data: {
    startDate: string;
    endDate: string;
    rows: ScheduleHistoryRow[];
  };

  $: csvHref = `/reports/schedule.csv?start=${data.startDate}&end=${data.endDate}`;
  $: publishedWeeks = Object.values(
    data.rows.reduce<Record<string, PublishedWeek>>((weeks, row) => {
      const key = row.week_start;
      const existing = weeks[key];
      if (!existing || row.version_number > existing.version_number) {
        weeks[key] = {
          week_start: row.week_start,
          version_number: row.version_number,
          published_at: row.published_at,
          published_by_name: row.published_by_name,
          shift_count: 1
        };
      } else if (row.version_number === existing.version_number) {
        existing.shift_count += 1;
      }
      return weeks;
    }, {})
  ).sort((a, b) => b.week_start.localeCompare(a.week_start));

  function formatPublishedDate(timestamp: number) {
    if (!timestamp) return 'Not recorded';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function weekCsvHref(week: PublishedWeek) {
    return `/reports/schedule.csv?start=${week.week_start}&end=${week.week_start}&version=${week.version_number}`;
  }

  $: entries = publishedWeeks.map((week): ReportExportEntry => ({
    title: `Week of ${week.week_start}`,
    meta: `Version ${week.version_number} · ${week.shift_count} shift${week.shift_count === 1 ? '' : 's'} · Published ${formatPublishedDate(week.published_at)}`,
    detail: week.published_by_name,
    href: weekCsvHref(week),
    icon: 'calendar_month'
  }));
</script>

<Layout>
  <PageHeader title="Schedule History" />

  <div class="report-toolbar">
    <a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
    <a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>Full CSV</a>
  </div>

  <ReportExportList {entries} empty="No published schedules yet." icon="calendar_month" />
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

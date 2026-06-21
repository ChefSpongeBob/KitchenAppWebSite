<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ReportExportList, { type ReportExportEntry } from '$lib/components/ui/ReportExportList.svelte';

  type TemperatureRow = {
    event_date: string;
    sensor_id: number;
    row_type: string;
  };

  export let data: {
    startDate: string;
    endDate: string;
    rows: TemperatureRow[];
  };

  $: csvHref = `/reports/temperature.csv?start=${data.startDate}&end=${data.endDate}`;

  function formatDate(dateIso: string) {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function weekStart(dateIso: string) {
    const date = new Date(`${dateIso}T00:00:00`);
    const day = date.getDay();
    date.setDate(date.getDate() - day);
    return date.toISOString().slice(0, 10);
  }

  function addDays(dateIso: string, days: number) {
    const date = new Date(`${dateIso}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function uniqueNodeCount(rows: TemperatureRow[]) {
    return new Set(rows.map((row) => row.sensor_id)).size;
  }

  $: dailyEntries = Object.values(
    data.rows.reduce<Record<string, TemperatureRow[]>>((days, row) => {
      days[row.event_date] = [...(days[row.event_date] ?? []), row];
      return days;
    }, {})
  )
    .sort((a, b) => b[0].event_date.localeCompare(a[0].event_date))
    .map((rows): ReportExportEntry => {
      const date = rows[0].event_date;
      return {
        title: formatDate(date),
        meta: `${uniqueNodeCount(rows)} node${uniqueNodeCount(rows) === 1 ? '' : 's'} · Hourly averages`,
        detail: `${rows.filter((row) => row.row_type === 'alert').length} alert event${rows.filter((row) => row.row_type === 'alert').length === 1 ? '' : 's'}`,
        href: `/reports/temperature.csv?start=${date}&end=${date}`,
        icon: 'device_thermostat'
      };
    });

  $: weeklyEntries = Object.values(
    data.rows.reduce<Record<string, TemperatureRow[]>>((weeks, row) => {
      const week = weekStart(row.event_date);
      weeks[week] = [...(weeks[week] ?? []), row];
      return weeks;
    }, {})
  )
    .sort((a, b) => b[0].event_date.localeCompare(a[0].event_date))
    .map((rows): ReportExportEntry => {
      const week = weekStart(rows[0].event_date);
      return {
        title: `Week of ${formatDate(week)}`,
        meta: `${uniqueNodeCount(rows)} node${uniqueNodeCount(rows) === 1 ? '' : 's'} · Hourly averages`,
        detail: `${formatDate(week)} to ${formatDate(addDays(week, 6))}`,
        href: `/reports/temperature.csv?start=${week}&end=${addDays(week, 6)}`,
        icon: 'monitor_heart'
      };
    });

  $: entries = [...weeklyEntries, ...dailyEntries];
</script>

<Layout>
  <PageHeader title="Temperature Report" />

  <div class="report-toolbar">
    <a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
    <a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>Full CSV</a>
  </div>

  <ReportExportList {entries} empty="No temperature exports yet." icon="device_thermostat" />
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

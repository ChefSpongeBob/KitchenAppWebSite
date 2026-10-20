<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ReportDataTable, {
    type ReportTableColumn,
    type ReportTableRow
  } from '$lib/components/ui/ReportDataTable.svelte';
  import ReportDateFilters from '$lib/components/ui/ReportDateFilters.svelte';
  import ReportExportList, { type ReportExportEntry } from '$lib/components/ui/ReportExportList.svelte';
  import ReportSummaryStrip, { type ReportMetric } from '$lib/components/ui/ReportSummaryStrip.svelte';
  import ReportToolbar from '$lib/components/ui/ReportToolbar.svelte';
  import { nativeServerUrl } from '$lib/client/nativeServerUrl';

  type TemperatureRow = {
    event_date: string;
    event_hour: string;
    sensor_id: number;
    sensor_name: string;
    avg_temperature: number;
    min_temperature: number;
    max_temperature: number;
    avg_humidity_pct: number | null;
    min_humidity_pct: number | null;
    max_humidity_pct: number | null;
    reading_count: number;
  };

  export let data: {
    startDate: string;
    endDate: string;
    rows: TemperatureRow[];
  };

  const tableColumns: ReportTableColumn[] = [
    { key: 'date', label: 'Date' },
    { key: 'hour', label: 'Hour' },
    { key: 'sensor', label: 'Sensor' },
    { key: 'average', label: 'Average F', align: 'right' },
    { key: 'range', label: 'Range F', align: 'right' },
    { key: 'humidity', label: 'Humidity', align: 'right' },
    { key: 'readings', label: 'Readings', align: 'right' }
  ];

  $: csvHref = nativeServerUrl(`/reports/temperature.csv?start=${data.startDate}&end=${data.endDate}`);

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

  function temperature(value: number) {
    return Number(value).toFixed(1);
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
      const readingCount = rows.reduce((total, row) => total + row.reading_count, 0);
      return {
        title: formatDate(date),
        meta: `${uniqueNodeCount(rows)} node${uniqueNodeCount(rows) === 1 ? '' : 's'} | ${readingCount} readings`,
        detail: 'Hourly averages',
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
    .sort((a, b) => weekStart(b[0].event_date).localeCompare(weekStart(a[0].event_date)))
    .map((rows): ReportExportEntry => {
      const week = weekStart(rows[0].event_date);
      return {
        title: `Week of ${formatDate(week)}`,
        meta: `${uniqueNodeCount(rows)} node${uniqueNodeCount(rows) === 1 ? '' : 's'} | Hourly averages`,
        detail: `${formatDate(week)} to ${formatDate(addDays(week, 6))}`,
        href: `/reports/temperature.csv?start=${week}&end=${addDays(week, 6)}`,
        icon: 'monitor_heart'
      };
    });

  $: entries = [...weeklyEntries, ...dailyEntries];
  $: metrics = [
    { label: 'Nodes', value: uniqueNodeCount(data.rows) },
    { label: 'Hourly Rows', value: data.rows.length },
    { label: 'Readings', value: data.rows.reduce((total, row) => total + row.reading_count, 0) }
  ] satisfies ReportMetric[];
  $: tableRows = data.rows.map(
    (row, index): ReportTableRow => ({
      id: `${row.event_date}-${row.event_hour}-${row.sensor_id}-${index}`,
      cells: {
        date: formatDate(row.event_date),
        hour: row.event_hour,
        sensor: row.sensor_name,
        average: temperature(row.avg_temperature),
        range: `${temperature(row.min_temperature)} - ${temperature(row.max_temperature)}`,
        humidity: row.avg_humidity_pct == null ? '-' : `${Number(row.avg_humidity_pct).toFixed(1)}%`,
        readings: row.reading_count
      }
    })
  );
</script>

<Layout>
  <PageHeader title="Temperature Report" />

  <ReportToolbar exportHref={csvHref} />
  <ReportDateFilters startDate={data.startDate} endDate={data.endDate} />
  <ReportSummaryStrip {metrics} />
  <ReportDataTable columns={tableColumns} rows={tableRows} empty="No temperature readings in this range." />
  <ReportExportList {entries} empty="No temperature exports yet." icon="device_thermostat" collapsed />
</Layout>

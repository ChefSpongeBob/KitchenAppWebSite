<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ReportExportList, { type ReportExportEntry } from '$lib/components/ui/ReportExportList.svelte';

  type OnboardingRow = {
    updated_at: number;
    package_status: string;
  };

  export let data: {
    startDate: string;
    endDate: string;
    rows: OnboardingRow[];
  };

  $: csvHref = `/reports/onboarding.csv?start=${data.startDate}&end=${data.endDate}`;

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
        meta: `${entry.count} package${entry.count === 1 ? '' : 's'} · ${entry.approved} approved`,
        href: `/reports/onboarding.csv?start=${range.start}&end=${range.end}`,
        icon: 'assignment_ind'
      };
    });
</script>

<Layout>
  <PageHeader title="Onboarding Report" />

  <div class="report-toolbar">
    <a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
    <a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>Full CSV</a>
  </div>

  <ReportExportList {entries} empty="No onboarding exports yet." icon="assignment_ind" />
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

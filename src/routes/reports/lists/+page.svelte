<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ReportExportList, { type ReportExportEntry } from '$lib/components/ui/ReportExportList.svelte';

  type ListDomain = 'preplists' | 'inventory' | 'orders' | 'checklists';
  type ListHistoryRow = {
    business_day: string;
    submitted_at: number;
    section_title_snapshot: string;
    submitted_by_name: string;
  };

  export let data: {
    domain: ListDomain;
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

  $: csvHref = `/reports/lists.csv?domain=${data.domain}&start=${data.startDate}&end=${data.endDate}`;

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

  function formatDate(dateIso: string) {
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function submissionEntries(rows: ListHistoryRow[]) {
    const groups = rows.reduce<Record<string, { row: ListHistoryRow; itemCount: number }>>((map, row) => {
      const key =
        data.domain === 'checklists'
          ? `${row.business_day}:${row.section_title_snapshot}`
          : `${row.business_day}:${row.section_title_snapshot}:${row.submitted_at}`;
      const existing = map[key];
      if (existing) {
        existing.itemCount += 1;
      } else {
        map[key] = { row, itemCount: 1 };
      }
      return map;
    }, {});

    return Object.values(groups)
      .sort((a, b) => b.row.business_day.localeCompare(a.row.business_day) || b.row.submitted_at - a.row.submitted_at)
      .map(({ row, itemCount }): ReportExportEntry => ({
        title: `${row.section_title_snapshot} · ${formatDate(row.business_day)}`,
        meta: `${itemCount} item${itemCount === 1 ? '' : 's'} · ${row.submitted_by_name}`,
        href:
          data.domain === 'checklists'
            ? `/reports/lists.csv?domain=${data.domain}&start=${row.business_day}&end=${row.business_day}`
            : `/reports/lists.csv?domain=${data.domain}&start=${row.business_day}&end=${row.business_day}&submitted_at=${row.submitted_at}`,
        icon: icons[data.domain]
      }));
  }

  function weeklyEntries(rows: ListHistoryRow[]) {
    const groups = rows.reduce<Record<string, { week: string; itemCount: number; submissions: number }>>((map, row) => {
      const week = weekStart(row.business_day);
      const existing = map[week] ?? { week, itemCount: 0, submissions: 0 };
      existing.itemCount += 1;
      existing.submissions += 1;
      map[week] = existing;
      return map;
    }, {});

    return Object.values(groups)
      .sort((a, b) => b.week.localeCompare(a.week))
      .map((entry): ReportExportEntry => ({
        title: `Week of ${formatDate(entry.week)}`,
        meta: `${entry.itemCount} item${entry.itemCount === 1 ? '' : 's'} · ${entry.submissions} line${entry.submissions === 1 ? '' : 's'}`,
        href: `/reports/lists.csv?domain=${data.domain}&start=${entry.week}&end=${addDays(entry.week, 6)}`,
        icon: icons[data.domain]
      }));
  }

  $: entries = data.domain === 'orders' ? weeklyEntries(data.rows) : submissionEntries(data.rows);
</script>

<Layout>
  <PageHeader title={titles[data.domain] ?? 'List History'} />

  <div class="report-toolbar">
    <a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
    <a href="/reports/lists?domain=preplists"><span class="material-icons" aria-hidden="true">restaurant</span>Prep</a>
    <a href="/reports/lists?domain=inventory"><span class="material-icons" aria-hidden="true">inventory_2</span>Inventory</a>
    <a href="/reports/lists?domain=orders"><span class="material-icons" aria-hidden="true">receipt_long</span>Orders</a>
    <a href="/reports/lists?domain=checklists"><span class="material-icons" aria-hidden="true">fact_check</span>Checklists</a>
    <a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>Full CSV</a>
  </div>

  <ReportExportList {entries} empty="No history exports yet." icon={icons[data.domain]} />
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

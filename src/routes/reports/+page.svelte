<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  type ReportLink = {
    href: string;
    title: string;
    icon: string;
  };

  export let data: { canViewTodoLog: boolean };

  const serviceReports: ReportLink[] = [
    { href: '/reports/lists?domain=preplists', title: 'Prep History', icon: 'restaurant' },
    { href: '/reports/lists?domain=checklists', title: 'Checklist History', icon: 'fact_check' },
    { href: '/reports/lists?domain=inventory', title: 'Inventory History', icon: 'inventory_2' },
    { href: '/reports/lists?domain=orders', title: 'Order History', icon: 'receipt_long' },
    { href: '/reports/waste', title: 'Waste Logs', icon: 'delete_sweep' }
  ];

  const peopleReports: ReportLink[] = [
    { href: '/reports/schedule', title: 'Schedule History', icon: 'calendar_month' },
    { href: '/reports/requests', title: 'Schedule Requests', icon: 'swap_horiz' },
    { href: '/reports/onboarding', title: 'Onboarding Report', icon: 'assignment_ind' }
  ];

  const systemReports: ReportLink[] = [
    { href: '/reports/temperature', title: 'Temperature Report', icon: 'device_thermostat' }
  ];

  $: visiblePeopleReports = data.canViewTodoLog
    ? [...peopleReports, { href: '/todo/log', title: 'ToDo History', icon: 'task_alt' }]
    : peopleReports;
</script>

<Layout>
  <PageHeader title="Reports" />

  <div class="reports-page">
    <section class="report-group">
      <h2>Service</h2>
      <div class="report-links">
        {#each serviceReports as report}
          <a href={report.href} class="report-link">
            <span class="material-icons report-icon" aria-hidden="true">{report.icon}</span>
            <strong>{report.title}</strong>
            <span class="material-icons report-action" aria-hidden="true">arrow_forward</span>
          </a>
        {/each}
      </div>
    </section>

    <section class="report-group">
      <h2>People & Labor</h2>
      <div class="report-links">
        {#each visiblePeopleReports as report}
          <a href={report.href} class="report-link">
            <span class="material-icons report-icon" aria-hidden="true">{report.icon}</span>
            <strong>{report.title}</strong>
            <span class="material-icons report-action" aria-hidden="true">arrow_forward</span>
          </a>
        {/each}
      </div>
    </section>

    <section class="report-group">
      <h2>Systems</h2>
      <div class="report-links">
        {#each systemReports as report}
          <a href={report.href} class="report-link">
            <span class="material-icons report-icon" aria-hidden="true">{report.icon}</span>
            <strong>{report.title}</strong>
            <span class="material-icons report-action" aria-hidden="true">arrow_forward</span>
          </a>
        {/each}
      </div>
    </section>
  </div>
</Layout>

<style>
  :global(.main-content:has(.reports-page)) {
    max-width: 1040px;
  }

  .reports-page {
    display: grid;
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .report-group {
    display: grid;
    gap: 0.45rem;
  }

  .report-group h2 {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .report-links {
    display: grid;
    grid-template-columns: repeat(2, minmax(14rem, 1fr));
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .report-link {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.7rem;
    min-height: 3.8rem;
    padding: 0.72rem 0.85rem;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    text-decoration: none;
  }

  .report-link:nth-child(even) {
    border-right: 0;
  }

  .report-link:last-child,
  .report-link:nth-last-child(2):nth-child(odd) {
    border-bottom: 0;
  }

  .report-link strong {
    font-size: 0.84rem;
    font-weight: var(--weight-semibold);
  }

  .report-icon,
  .report-action {
    color: var(--color-text-muted);
    line-height: 1;
  }

  .report-icon {
    font-size: 1.1rem;
  }

  .report-action {
    font-size: 0.95rem;
  }

  .report-link:hover,
  .report-link:focus-visible {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
  }

  @media (max-width: 640px) {
    .report-links {
      grid-template-columns: 1fr;
    }

    .report-link,
    .report-link:nth-child(even),
    .report-link:nth-last-child(2):nth-child(odd) {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .report-link:last-child {
      border-bottom: 0;
    }
  }
</style>

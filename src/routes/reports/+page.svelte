<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  const reports = [
    {
      href: '/reports/lists?domain=preplists',
      title: 'Prep History',
      description: 'Two-week prep submissions and activity.',
      icon: 'restaurant'
    },
    {
      href: '/reports/lists?domain=inventory',
      title: 'Inventory History',
      description: 'Inventory counts and stock movement.',
      icon: 'inventory_2'
    },
    {
      href: '/reports/lists?domain=orders',
      title: 'Order History',
      description: 'Order list submissions and purchasing notes.',
      icon: 'receipt_long'
    },
    {
      href: '/reports/schedule',
      title: 'Schedule History',
      description: 'Published schedule records and CSV export.',
      icon: 'calendar_month'
    }
  ];
</script>

<Layout>
  <PageHeader title="Reports" />

  <section class="report-links">
    {#each reports as report}
      <a href={report.href} class="report-link">
        <span class="material-icons report-icon" aria-hidden="true">{report.icon}</span>
        <span class="report-copy">
          <strong>{report.title}</strong>
          <small>{report.description}</small>
        </span>
        <span class="material-icons report-action" aria-hidden="true">arrow_forward</span>
      </a>
    {/each}
  </section>
</Layout>

<style>
  .report-links {
    display: grid;
    grid-template-columns: repeat(2, minmax(14rem, 1fr));
    gap: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .report-link {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    min-height: 4.8rem;
    padding: 0.95rem 1rem;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    text-decoration: none;
  }

  .report-link:nth-child(even) {
    border-right: 0;
  }

  .report-link:nth-last-child(-n + 2) {
    border-bottom: 0;
  }

  .report-copy {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .report-copy strong {
    font-weight: var(--weight-semibold);
  }

  .report-copy small {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .report-icon,
  .report-action {
    color: var(--color-text-muted);
    line-height: 1;
  }

  .report-icon {
    font-size: 1.2rem;
  }

  .report-action {
    font-size: 1rem;
    opacity: 0.72;
  }

  @media (max-width: 640px) {
    .report-links {
      grid-template-columns: 1fr;
    }

    .report-link {
      border-right: 0;
    }

    .report-link:nth-last-child(-n + 2) {
      border-bottom: 1px solid var(--color-divider);
    }

    .report-link:last-child {
      border-bottom: 0;
    }
  }
</style>

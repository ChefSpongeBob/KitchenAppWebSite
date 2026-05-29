<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  const reports = [
    { href: '/reports/lists?domain=preplists', title: 'Prep History' },
    { href: '/reports/lists?domain=inventory', title: 'Inventory History' },
    { href: '/reports/lists?domain=orders', title: 'Order History' },
    { href: '/reports/schedule', title: 'Schedule History' }
  ];
</script>

<Layout>
  <PageHeader title="Reports" />

  <section class="report-links">
    {#each reports as report}
      <a href={report.href}>{report.title}</a>
    {/each}
  </section>
</Layout>

<style>
  .report-links {
    display: grid;
    gap: 0.65rem;
    border-top: 1px solid var(--color-divider);
  }

  .report-links a {
    padding: 0.8rem 0;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    text-decoration: none;
    font-weight: var(--weight-semibold);
  }
</style>

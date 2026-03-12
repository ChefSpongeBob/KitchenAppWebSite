<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  const menuPdfs = [
    {
      title: 'Secret Rolls',
      description: 'Off-menu and specialty roll reference.',
      href: '/menus/secret-rolls.pdf',
      file: 'secret-rolls.pdf'
    },
    {
      title: 'Main Menu',
      description: 'Standard guest-facing menu PDF.',
      href: '/menus/main-menu.pdf',
      file: 'main-menu.pdf'
    },
    {
      title: 'Seasonal / Limited',
      description: 'Rotating inserts, promos, or temporary menus.',
      href: '/menus/seasonal-menu.pdf',
      file: 'seasonal-menu.pdf'
    }
  ];
</script>

<Layout>
  <PageHeader
    title="Secret Rolls & Menu"
    subtitle="Menu sheets and roll references."
  />

  <section class="grid">
    {#each menuPdfs as item}
      <DashboardCard title={item.title} description={item.description}>
        <div class="card-copy">
          <p>View this menu reference.</p>
          <a href={item.href} target="_blank" rel="noreferrer" class="pdf-link">View PDF</a>
        </div>
      </DashboardCard>
    {/each}
  </section>
</Layout>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .card-copy {
    display: grid;
    gap: 0.65rem;
  }

  .card-copy p {
    margin: 0;
  }

  .card-copy p {
    color: var(--color-text-muted);
  }

  .pdf-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    min-width: 8rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.65rem 0.9rem;
    text-decoration: none;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-surface) 92%, black 8%);
  }

  .pdf-link:hover {
    border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-border));
  }
</style>

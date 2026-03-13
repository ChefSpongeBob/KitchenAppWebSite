<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  type SectionItem = {
    href: string;
    title: string;
    description: string | null;
  };

  export let data: { sections?: SectionItem[] };
  const sections = data.sections ?? [];
</script>

<Layout>
  <PageHeader title="Inventory" subtitle="Select an inventory sheet" />
  {#each sections as section}
    <a href={section.href} class="card-link">
      <DashboardCard title={section.title} description={section.description ?? ''} />
    </a>
  {/each}
</Layout>

<style>
  .card-link {
    display: block;
    text-decoration: none;
    border-radius: var(--radius-lg);
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out), filter 120ms var(--ease-out);
  }

  .card-link + .card-link {
    margin-top: var(--space-4);
  }

  .card-link:hover,
  .card-link:focus {
    transform: translateY(-2px);
    box-shadow: 0 18px 40px rgba(4, 5, 7, 0.2);
    filter: saturate(1.04);
    outline: none;
  }

  .card-link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
  }
</style>

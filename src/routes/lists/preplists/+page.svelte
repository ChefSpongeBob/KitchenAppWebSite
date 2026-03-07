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
  <PageHeader title="Prep Lists" subtitle="Select a prep list" />
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
  }
</style>

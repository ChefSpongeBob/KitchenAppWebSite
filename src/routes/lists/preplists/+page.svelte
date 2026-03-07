<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import Section from '$lib/components/ui/Section.svelte';
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
  <Section title="Prep Lists">
    {#each sections as section}
      <a href={section.href} class="card-link">
        <DashboardCard title={section.title} description={section.description ?? ''} />
      </a>
    {/each}

  </Section>
</Layout>

<style>
  .card-link {
    display: block;
    text-decoration: none;
  }
</style>

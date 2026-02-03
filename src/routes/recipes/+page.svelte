<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import Layout from '$lib/components/ui/Layout.svelte';
  import { goto } from '$app/navigation';

  const categories = [
    { id: 'rice', title: 'Rice', description: 'Rice & base prep' },
    { id: 'sauces', title: 'Sauces', description: 'House sauces' },
    { id: 'prep', title: 'Prep', description: 'General prep recipes' },
    { id: 'sushi', title: 'Sushi', description: 'Rolls & builds' }
  ];
</script>

<PageHeader
  title="Recipes"
  subtitle="Browse by category"
/>

<section class="grid">
{#each categories as c}
  <div
    role="button"
    tabindex="0"
    on:click={() => goto(`/recipes/${c.id}`)}
  >
    <DashboardCard
      title={c.title}
      description={c.description}
    />
  </div>
{/each}

</section>

<style>
  .grid {
    display: grid;
    gap: var(--space-4);
  }
</style>

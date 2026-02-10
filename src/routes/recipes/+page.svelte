<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import Layout from '$lib/components/ui/Layout.svelte';
  import { goto } from '$app/navigation';
  import { fade } from 'svelte/transition';

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
  {#each categories as c, index}
    <div
      role="button"
      tabindex="0"
      class="category-wrapper"
      on:click={() => goto(`/recipes/${c.id}`)}
      in:fade={{ delay: index * 80, duration: 180 }}
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
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  .category-wrapper {
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
  }

  .category-wrapper:hover,
  .category-wrapper:focus {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
    outline: none;
  }

  .category-wrapper:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
  }
</style>

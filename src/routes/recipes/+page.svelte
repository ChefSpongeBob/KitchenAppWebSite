<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';

  // STATIC dashboard: all cards always visible
  const categories = [
    'kitchen',
    'sushi',
    'sushiprep',
    'sauces',
    'specials'
  ];
</script>

<PageHeader title="Recipes" subtitle="Browse by category" />

<section class="grid">
  <!-- Manage Recipes card -->
  <div
    role="button"
    tabindex="0"
    class="category-wrapper"
    on:click={() => goto('/recipes/manage')}
    in:fade={{ delay: 0, duration: 180 }}
  >
    <DashboardCard title="Manage Recipes" description="Add, edit, or delete recipes" />
  </div>

  <!-- Static category cards -->
  {#each categories as c, index}
    <div
      role="button"
      tabindex="0"
      class="category-wrapper"
      on:click={() => goto(`/recipes/${c}`)}
      in:fade={{ delay: (index + 1) * 80, duration: 180 }}
    >
      <DashboardCard title={c} description={`View recipes in ${c}`} />
    </div>
  {/each}
</section>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .category-wrapper {
    cursor: pointer;
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
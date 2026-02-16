<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';

  export let data;
  let recipes = data.recipes ?? [];
  let category = data.category ?? '';
</script>

<PageHeader title={`Recipes: ${category}`} subtitle="Browse recipes in this category" />

{#if recipes.length > 0}
  <section class="grid">
    {#each recipes as r, index}
      <div in:fade={{ delay: index * 80, duration: 180 }}>
        <DashboardCard title={r.title} description={r.ingredients}>
          <p>{r.instructions}</p>
        </DashboardCard>
      </div>
    {/each}
  </section>
{:else}
  <p>No recipes found for this category.</p>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
</style>
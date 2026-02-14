<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let categories = [];
  let loading = true;

  // Fetch distinct categories from database via a server endpoint
  onMount(async () => {
    loading = true;
    try {
      const res = await fetch('/recipes/categories');
      if (res.ok) {
        categories = await res.json();
      } else {
        console.error('Failed to load categories', res.status);
        categories = [];
      }
    } catch (err) {
      console.error('Error fetching categories', err);
      categories = [];
    } finally {
      loading = false;
    }
  });
</script>

<PageHeader
  title="Recipes"
  subtitle="Browse by category"
/>

{#if loading}
  <p>Loading categories...</p>
{:else if categories.length > 0}
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
          description={c.description || ''}
        />
      </div>
    {/each}
  </section>
{:else}
  <p>No categories found.</p>
{/if}

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
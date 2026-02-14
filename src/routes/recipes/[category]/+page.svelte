<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fade } from 'svelte/transition';

  let search = '';
  let recipes = [];
  let loading = true;

  // Get the current category from the URL
  $: category = $page.params.category;

  onMount(async () => {
    loading = true;
    try {
      // 🔹 FIXED fetch: call the +server.ts in the same folder
      const res = await fetch('./'); 
      if (res.ok) {
        recipes = await res.json();
      } else {
        console.error('Failed to fetch recipes', res.status);
        recipes = [];
      }
    } catch (err) {
      console.error('Error fetching recipes', err);
      recipes = [];
    } finally {
      loading = false;
    }
  });

  $: filtered = recipes.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );
</script>

<PageHeader
  title={category.charAt(0).toUpperCase() + category.slice(1)}
  subtitle="Recipes"
/>

<TextInput placeholder="Search recipes..." bind:value={search} />

{#if loading}
  <p>Loading recipes...</p>
{:else if filtered.length > 0}
  <section class="grid">
    {#each filtered as r, index}
      <div
        role="button"
        tabindex="0"
        class="recipe-wrapper"
        on:click={() => goto(`/recipes/recipe/${r.id}`)}
        in:fade={{ delay: index * 50, duration: 180 }}
      >
        <DashboardCard
          title={r.title}
          description={r.ingredients}
        />
      </div>
    {/each}
  </section>
{:else}
  <EmptyState
    title="No recipes"
    description="No recipes in this category yet"
  />
{/if}

<style>
  .grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    margin-top: var(--space-4);
  }

  .recipe-wrapper {
    cursor: pointer;
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
  }

  .recipe-wrapper:hover,
  .recipe-wrapper:focus {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
    outline: none;
  }

  .recipe-wrapper:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
  }
</style>
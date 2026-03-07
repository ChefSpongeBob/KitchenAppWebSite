<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { recipeCategories } from '$lib/assets/recipeCategories';

  type RecipeIndexItem = {
    id: number;
    title: string;
    category: string;
  };

  export let data: { categories?: string[]; recipeIndex?: RecipeIndexItem[] };
  const categories = (data.categories?.length ? data.categories : [...recipeCategories]).map((c) =>
    c.trim().toLowerCase()
  );
  const recipeIndex = data.recipeIndex ?? [];
  let search = '';
  $: normalizedSearch = search.trim().toLowerCase();
  $: searchResults =
    normalizedSearch.length < 2
      ? []
      : recipeIndex
          .filter((r) => r.title.toLowerCase().includes(normalizedSearch))
          .slice(0, 12);
</script>

<PageHeader title="Recipes" subtitle="Browse by category" />

<section class="search">
  <input
    type="search"
    placeholder="Search recipe by title..."
    bind:value={search}
    aria-label="Search recipe by title"
  />
  {#if normalizedSearch.length >= 2}
    {#if searchResults.length > 0}
      <div class="search-results">
        {#each searchResults as recipe}
          <a href={`/recipes/${recipe.category}`} class="result-link">
            <strong>{recipe.title}</strong>
            <small>{recipe.category}</small>
          </a>
        {/each}
      </div>
    {:else}
      <p class="search-empty">No recipes found.</p>
    {/if}
  {/if}
</section>

<section class="grid">
  <!-- Static category cards -->
  {#each categories as c, index}
    <button
      type="button"
      class="category-wrapper"
      on:click={() => goto(`/recipes/${c}`)}
      in:fade={{ delay: index * 80, duration: 180 }}
    >
      <DashboardCard title={c} description={`View recipes in ${c}`} />
    </button>
  {/each}
</section>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .search {
    margin: 0.35rem 0 0.8rem;
  }

  .search input {
    width: 100%;
    max-width: 560px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.5rem 0.65rem;
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  .search-results {
    margin-top: 0.45rem;
    display: grid;
    gap: 0.35rem;
    max-width: 560px;
  }

  .result-link {
    display: flex;
    justify-content: space-between;
    gap: 0.65rem;
    text-decoration: none;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.45rem 0.6rem;
    color: var(--color-text);
    background: var(--color-surface);
  }

  .result-link small {
    color: var(--color-text-muted);
  }

  .search-empty {
    margin: 0.45rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.86rem;
  }

  .category-wrapper {
    cursor: pointer;
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
    border: none;
    padding: 0;
    background: transparent;
    text-align: inherit;
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

  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .search {
      margin-top: 0.2rem;
    }
  }
</style>

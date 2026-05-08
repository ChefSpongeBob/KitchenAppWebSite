<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { goto } from '$app/navigation';
  import { recipeCategories } from '$lib/assets/recipeCategories';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  type RecipeIndexItem = {
    id: number;
    title: string;
    category: string;
  };

  export let data: { categories?: string[]; recipeIndex?: RecipeIndexItem[]; query?: string };
  const categories = (data.categories?.length ? data.categories : [...recipeCategories]).map((c) =>
    c.trim().toLowerCase()
  );
  const recipeIndex = data.recipeIndex ?? [];
  let search = data.query ?? '';

  $: normalizedSearch = search.trim().toLowerCase();
  $: searchResults =
    normalizedSearch.length < 2
      ? []
      : recipeIndex.filter((r) => r.title.toLowerCase().includes(normalizedSearch)).slice(0, 12);

  function countByCategory(category: string) {
    return recipeIndex.filter((recipe) => recipe.category === category).length;
  }

  function recipeCategoryHref(category: string) {
    const query = normalizedSearch.length >= 2 ? `?q=${encodeURIComponent(search.trim())}` : '';
    return `/recipes/${category}${query}`;
  }

  async function syncSearch(value: string) {
    const next = value.trim();
    await goto(next ? `/recipes?q=${encodeURIComponent(next)}` : '/recipes', {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  }
</script>

<PageHeader title="Recipes" />

<section class="recipe-index">
  <div class="search-row">
    <input
      type="search"
      placeholder="Search recipes"
      bind:value={search}
      on:input={(event) => syncSearch((event.currentTarget as HTMLInputElement).value)}
      aria-label="Search recipes"
    />
  </div>

  {#if normalizedSearch.length >= 2}
    <div class="search-results">
      {#if searchResults.length > 0}
        {#each searchResults as recipe}
          <a href={`/recipes/${recipe.category}?q=${encodeURIComponent(search.trim())}`}>
            <span>{recipe.title}</span>
            <small>{recipe.category}</small>
          </a>
        {/each}
      {:else}
        <EmptyState title="No recipes found." compact />
      {/if}
    </div>
  {/if}

  <div class="category-list">
    {#each categories as category}
      <button type="button" on:click={() => goto(recipeCategoryHref(category))}>
        <span>{category}</span>
        <small>{countByCategory(category)} recipe{countByCategory(category) === 1 ? '' : 's'}</small>
      </button>
    {/each}
  </div>
</section>

<style>
  .recipe-index {
    display: grid;
    gap: 1rem;
  }

  .search-row input {
    width: min(100%, 620px);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.68rem 0.95rem;
    background: var(--surface-wash), var(--color-surface-alt);
    color: var(--color-text);
  }

  .search-results,
  .category-list {
    display: grid;
    border-top: 1px solid var(--color-divider);
  }

  .search-results a,
  .category-list button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    min-height: 3.1rem;
    padding: 0.72rem 0;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-divider) 72%, transparent);
    background: transparent;
    color: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .search-results span,
  .category-list span {
    font-weight: var(--weight-semibold);
    text-transform: capitalize;
  }

  .search-results small,
  .category-list small {
    color: var(--color-text-muted);
  }

  .search-results a:hover span,
  .category-list button:hover span,
  .category-list button:focus-visible span {
    color: var(--color-primary);
  }

  .category-list button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-primary) 72%, transparent);
    outline-offset: 3px;
  }

  @media (max-width: 700px) {
    .search-results a,
    .category-list button {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.2rem;
    }
  }
</style>

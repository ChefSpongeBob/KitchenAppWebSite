<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import TextInput from '$lib/components/ui/TextInput.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let search = '';

  $: category = $page.params.category;

  // mock UI-phase data
  const data = {
    rice: [
      { id: 'sushi-rice', title: 'Sushi Rice', description: 'Base rice prep' }
    ],
    sauces: [
      { id: 'spicy-mayo', title: 'Spicy Mayo', description: 'House spicy mayo' }
    ],
    prep: [],
    sushi: []
  };

  $: recipes = data[category] || [];

  $: filtered = recipes.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );
</script>

<PageHeader
  title={category}
  subtitle="Recipes"
/>

<TextInput
  placeholder="Search in category..."
  bind:value={search}
/>

{#if filtered.length > 0}
  <section class="grid">
    {#each filtered as r}
    <div
  role="button"
  tabindex="0"
  on:click={() => goto(`/recipes/recipe/${r.id}`)}
>
  <DashboardCard
    title={r.title}
    description={r.description}
  />
</div>

    {/each}
  </section>
{:else}
  <EmptyState
    title="No recipes"
    description="Nothing in this category yet"
  />
{/if}

<style>
  .grid {
    display: grid;
    gap: var(--space-4);
  }
</style>


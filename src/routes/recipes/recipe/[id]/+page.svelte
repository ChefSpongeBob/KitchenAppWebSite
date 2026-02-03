<script>
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Section from '$lib/components/ui/Section.svelte';
  import { page } from '$app/stores';

  // mock data (UI phase)
  const mockRecipes = {
    'sushi-rice': {
      title: 'Sushi Rice',
      description: 'Base rice used for rolls and nigiri.',
      ingredients: [
        '2 cups rice',
        '2.5 cups water',
        'vinegar mix'
      ],
      steps: [
        'Rinse rice',
        'Cook rice',
        'Fold in seasoning'
      ]
    },
    'spicy-mayo': {
      title: 'Spicy Mayo',
      description: 'House spicy mayo.',
      ingredients: [
        '1 cup mayo',
        'sriracha',
        'lime'
      ],
      steps: [
        'Combine',
        'Whisk',
        'Taste adjust'
      ]
    }
  };

  $: id = $page.params.id;
  $: recipe = mockRecipes[id];
</script>

{#if recipe}
  <PageHeader
    title={recipe.title}
    subtitle="Recipe"
  />

  <Section title="Description">
    <p>{recipe.description}</p>
  </Section>

  <Section title="Ingredients">
    <ul>
      {#each recipe.ingredients as i}
        <li>{i}</li>
      {/each}
    </ul>
  </Section>

  <Section title="Steps">
    <ol>
      {#each recipe.steps as s}
        <li>{s}</li>
      {/each}
    </ol>
  </Section>
{:else}
  <PageHeader title="Recipe not found" />
{/if}

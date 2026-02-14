<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';
  import { enhance } from '$app/forms';

  export let data;

  // Recipes from the database
  let recipes = data.recipes;

  // Reload recipes after any form action
  function refreshRecipes() {
    fetch('/recipes/manage')
      .then((res) => res.json())
      .then((json) => {
        recipes = json.recipes;
      });
  }

  // SvelteKit form enhancer
  function handleForm(form: HTMLFormElement) {
    enhance(form, {
      onSuccess() {
        refreshRecipes();
      }
    });
  }
</script>

<PageHeader title="Manage Recipes" subtitle="Edit, add, or delete recipes" />

<section class="create-recipe-grid">
  {#each recipes as r, index}
    <div in:fade={{ delay: index * 80, duration: 180 }}>
      <DashboardCard
        title={r.title}
        description={r.category}
      >
        <form use:enhance on:submit|preventDefault={(e) => handleForm(e.target as HTMLFormElement)} method="POST" action="?/updateRecipe">
          <input type="hidden" name="id" value={r.id} />
          <input type="text" name="title" value={r.title} placeholder="Title" required />
          <input type="text" name="ingredients" value={r.ingredients} placeholder="Ingredients" required />
          <input type="text" name="instructions" value={r.instructions} placeholder="Instructions" required />
          <button type="submit">Update</button>
        </form>

        <form use:enhance on:submit|preventDefault={(e) => handleForm(e.target as HTMLFormElement)} method="POST" action="?/deleteRecipe">
          <input type="hidden" name="id" value={r.id} />
          <button type="submit">Delete</button>
        </form>
      </DashboardCard>
    </div>
  {/each}

  <!-- Create new recipe card -->
  <div in:fade={{ delay: recipes.length * 80, duration: 180 }}>
    <DashboardCard title="Add Recipe">
      <form use:enhance on:submit|preventDefault={(e) => handleForm(e.target as HTMLFormElement)} method="POST" action="?/createRecipe">
        <input type="text" name="title" placeholder="Title" required />
        <input type="text" name="category" placeholder="Category" required />
        <input type="text" name="ingredients" placeholder="Ingredients" required />
        <input type="text" name="instructions" placeholder="Instructions" required />
        <button type="submit">Create</button>
      </form>
    </DashboardCard>
  </div>
</section>

<style>
  .create-recipe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  input {
    display: block;
    width: 100%;
    margin-bottom: 0.5rem;
    padding: 0.25rem;
  }

  button {
    padding: 0.5rem 1rem;
    margin-top: 0.25rem;
    cursor: pointer;
  }
</style>
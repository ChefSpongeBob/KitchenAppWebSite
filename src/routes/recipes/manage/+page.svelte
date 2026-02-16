<script lang="ts">
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';
  import { enhance } from '$app/forms';

  export let data;
  let recipes = data.recipes;
</script>

<PageHeader title="Manage Recipes" subtitle="Edit, add, or delete recipes" />

<section class="create-recipe-grid">
  {#each recipes as r, index}
    <div in:fade={{ delay: index * 80, duration: 180 }}>
      <DashboardCard title={r.title} description={r.category}>
        <form method="POST" action="?/updateRecipe" use:enhance>
          <input type="hidden" name="id" value={r.id} />
          <input name="title" value={r.title} required />
          <input name="ingredients" value={r.ingredients} required />
          <input name="instructions" value={r.instructions} required />
          <button>Update</button>
        </form>

        <form method="POST" action="?/deleteRecipe" use:enhance>
          <input type="hidden" name="id" value={r.id} />
          <button>Delete</button>
        </form>
      </DashboardCard>
    </div>
  {/each}

  <div in:fade>
    <DashboardCard title="Add Recipe">
      <form method="POST" action="?/createRecipe" use:enhance>
        <input name="title" placeholder="Title" required />
        <input name="category" placeholder="Category" required />
        <input name="ingredients" placeholder="Ingredients" required />
        <input name="instructions" placeholder="Instructions" required />
        <button>Create</button>
      </form>
    </DashboardCard>
  </div>
</section>

<style>
  .create-recipe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  input {
    display: block;
    width: 100%;
    margin-bottom: .5rem;
  }

  button {
    margin-top: .25rem;
  }
</style>
<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import { recipeCategories } from '$lib/assets/recipeCategories';

  type Recipe = {
    id: number;
    title: string;
    category: string;
    ingredients: string;
    instructions: string;
  };

  export let data: { recipes: Recipe[] };

  const defaultRecipeCategories = [...recipeCategories];
  let feedbackMessage = '';
  $: recipeCategoryOptions = Array.from(
    new Set([
      ...defaultRecipeCategories,
      ...data.recipes.map((recipe) => recipe.category).filter(Boolean)
    ])
  );
  $: recipesByCategory = recipeCategoryOptions.map((category) => ({
    category,
    recipes: data.recipes.filter((recipe) => recipe.category === category)
  }));

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Recipe changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That recipe change could not be saved.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader
    title="Admin Recipes"
    subtitle="Add and organize recipes here."
  />

  <nav class="subnav">
    <a href="/admin">Back to Dashboard</a>
  </nav>

  <section class="panel">
    <header class="panel-header">
      <div>
        <span class="eyebrow">Create</span>
        <h2>Recipes</h2>
      </div>
      <p>{data.recipes.length} total recipes</p>
    </header>

    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <form method="POST" action="?/create_recipe" use:enhance={withFeedback} class="add-row recipe-add">
      <select name="category" required>
        <option value="">Select Category</option>
        {#each recipeCategoryOptions as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
      <input name="title" placeholder="Title" required />
      <textarea name="materials_needed" placeholder="Materials needed" rows="3" required></textarea>
      <textarea name="ingredients" placeholder="Ingredients" rows="3" required></textarea>
      <textarea name="instruction" placeholder="Instruction" rows="3" required></textarea>
      <button type="submit">Add Recipe</button>
    </form>

    <div class="recipe-tabs">
      {#each recipesByCategory as bucket}
        <details class="section-block">
          <summary>
            <h3>{bucket.category}</h3>
            <span>{bucket.recipes.length} recipes</span>
          </summary>
          {#if bucket.recipes.length === 0}
            <p class="muted">No recipes in this category yet.</p>
          {:else}
            <table class="sheet">
              <thead>
                <tr>
                  <th>Title</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each bucket.recipes as recipe}
                  <tr>
                    <td>{recipe.title}</td>
                    <td>
                      <form method="POST" action="?/delete_recipe" use:enhance={withFeedback} class="inline">
                        <input type="hidden" name="id" value={recipe.id} />
                        <button type="submit" class="icon-btn danger" aria-label="Remove recipe">X</button>
                      </form>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </details>
      {/each}
    </div>
  </section>
</Layout>

<style>
  .subnav {
    margin: 0.5rem 0 1rem;
  }

  .subnav a {
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .panel {
    position: relative;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.008) 42%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
  }

  .panel::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.88), rgba(195, 32, 43, 0.2));
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    margin-bottom: 0.8rem;
  }

  .panel-header h2,
  h3 {
    margin: 0;
  }

  .panel-header p,
  .eyebrow,
  summary span,
  .muted {
    color: var(--color-text-muted);
  }

  .add-row,
  .inline {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .recipe-add textarea,
  .recipe-add input,
  .recipe-add select {
    width: 100%;
  }

  .feedback-banner {
    margin: 0 0 0.8rem;
    padding: 0.72rem 0.9rem;
    border: 1px solid rgba(22, 163, 74, 0.22);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.06));
    color: #bbf7d0;
  }

  .recipe-tabs {
    margin-top: 0.85rem;
    display: grid;
    gap: 0.55rem;
  }

  .section-block {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 0.55rem;
  }

  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    list-style: none;
    padding: 0.2rem 0;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .sheet {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.55rem;
  }

  .sheet th,
  .sheet td {
    text-align: left;
    padding: 0.48rem 0.42rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .sheet th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.02);
  }

  input,
  textarea,
  select {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.42rem 0.55rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.82rem;
  }

  button {
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    padding: 0.4rem 0.62rem;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .icon-btn {
    width: 1.9rem;
    height: 1.9rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  .danger {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
  }

  @media (max-width: 900px) {
    .panel-header {
      flex-direction: column;
      align-items: start;
    }

    .sheet {
      min-width: 520px;
    }
  }
</style>

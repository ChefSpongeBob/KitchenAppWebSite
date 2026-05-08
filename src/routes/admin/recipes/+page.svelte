<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';

  type Recipe = {
    id: number;
    title: string;
    category: string;
    ingredients: string;
    instructions: string;
  };

  export let data: { recipes: Recipe[] };

  let feedbackMessage = '';
  $: recipeCategoryOptions = Array.from(new Set(data.recipes.map((recipe) => recipe.category).filter(Boolean)));
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
        pushToast('Recipe saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That recipe could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Recipe saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That recipe could not be saved.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader title="Admin Recipes" />

  <section class="workspace">
    <header class="workspace-head">
      <h2>Recipes</h2>
      <span>{data.recipes.length} total</span>
    </header>

    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <details class="creator" open>
      <summary>Add recipe</summary>
      <form method="POST" action="?/create_recipe" use:enhance={withFeedback} class="recipe-form">
        <div class="field-grid">
          <input name="category" list="recipe-category-options" placeholder="Category" required />
          <datalist id="recipe-category-options">
            {#each recipeCategoryOptions as category}
              <option value={category}></option>
            {/each}
          </datalist>
          <input name="title" placeholder="Title" required />
        </div>
        <textarea name="materials_needed" placeholder="Materials needed" rows="3" required></textarea>
        <textarea name="ingredients" placeholder="Ingredients" rows="4" required></textarea>
        <textarea name="instruction" placeholder="Instruction" rows="5" required></textarea>
        <button type="submit">Add Recipe</button>
      </form>
    </details>

    <section class="records">
      {#if recipesByCategory.length === 0}
        <EmptyState title="No recipes yet." compact />
      {:else}
        {#each recipesByCategory as bucket}
          <section class="bucket">
            <header>
              <h3>{bucket.category}</h3>
              <span>{bucket.recipes.length}</span>
            </header>

            <div class="recipe-list">
              {#each bucket.recipes as recipe}
                <div class="recipe-row">
                  <span>{recipe.title}</span>
                  <form method="POST" action="?/delete_recipe" use:enhance={withFeedback}>
                    <input type="hidden" name="id" value={recipe.id} />
                    <button type="submit" class="danger" aria-label="Remove recipe">Delete</button>
                  </form>
                </div>
              {/each}
            </div>
          </section>
        {/each}
      {/if}
    </section>
  </section>
</Layout>

<style>
  .workspace {
    display: grid;
    gap: 0.9rem;
  }

  .workspace-head,
  .bucket header,
  .recipe-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
  }

  .workspace-head,
  .creator,
  .bucket {
    border-bottom: 1px solid var(--color-divider);
    padding-bottom: 0.7rem;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  .workspace-head span,
  .bucket header span {
    color: var(--color-text-muted);
  }

  .feedback-banner {
    color: #86efac;
  }

  summary {
    cursor: pointer;
    list-style: none;
    font-weight: var(--weight-semibold);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .recipe-form {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.7rem;
  }

  .field-grid {
    display: grid;
    grid-template-columns: 0.35fr 1fr;
    gap: 0.55rem;
  }

  .recipe-list {
    display: grid;
    margin-top: 0.4rem;
    border-top: 1px solid color-mix(in srgb, var(--color-divider) 70%, transparent);
  }

  .recipe-row {
    min-height: 3rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-divider) 70%, transparent);
  }

  .recipe-row span {
    font-weight: var(--weight-medium);
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.52rem 0.62rem;
    background: var(--surface-wash), var(--color-surface-alt);
    color: var(--color-text);
    font-size: 0.84rem;
  }

  textarea {
    resize: vertical;
  }

  button {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-text) 5%);
    color: var(--color-primary-contrast);
    min-height: 2.35rem;
    padding: 0.48rem 0.75rem;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
  }

  .recipe-form > button {
    justify-self: end;
  }

  .danger {
    border-color: color-mix(in srgb, #ef4444 38%, var(--color-border));
    background: color-mix(in srgb, #7f1d1d 30%, var(--color-surface));
    color: #fecaca;
  }

  @media (max-width: 820px) {
    .field-grid,
    .recipe-row {
      grid-template-columns: 1fr;
    }

    .recipe-row {
      align-items: flex-start;
      flex-direction: column;
      padding-block: 0.65rem;
    }

    button,
    .recipe-form > button,
    .recipe-row form {
      width: 100%;
    }
  }
</style>

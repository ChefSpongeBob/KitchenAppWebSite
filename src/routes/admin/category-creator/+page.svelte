<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type ListDomain = 'preplists' | 'inventory' | 'orders';
  type EditorType = 'list' | 'recipe' | 'document';

  type ListSection = {
    id: string;
    domain: ListDomain;
    slug: string;
    title: string;
    items: Array<{
      id: string;
      content: string;
      details: string;
      amount: number;
      par_count: number;
      is_checked: number;
      sort_order: number;
    }>;
  };

  type CreatorCatalog = {
    preplists: string[];
    inventory: string[];
    orders: string[];
    recipes: string[];
    documents: string[];
  };

  export let data: {
    sections: {
      preplists: ListSection[];
      inventory: ListSection[];
      orders: ListSection[];
    };
    creatorCatalog: CreatorCatalog;
  };

  let editorType: EditorType = 'list';
  let listDomain: ListDomain = 'preplists';
  let feedbackMessage = '';

  function listDomainLabel(domain: ListDomain) {
    if (domain === 'preplists') return 'Prep Lists';
    if (domain === 'inventory') return 'Inventory';
    return 'Orders';
  }

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Category changes saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That category change could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Category changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That category change could not be saved.'
            : '';
    };
  };

  const withResetFeedback: SubmitFunction = ({ formElement }) => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        formElement.reset();
        await invalidateAll();
        pushToast('Category changes saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That category change could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Category changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That category change could not be saved.'
            : '';
    };
  };

  $: filteredListSections = [
    ...data.sections.preplists,
    ...data.sections.inventory,
    ...data.sections.orders
  ].filter((section) => section.domain === listDomain);
</script>

<Layout>
  <PageHeader title="Category Creator" />

  <section class="creator-panel">
    <header class="creator-header">
      <div>
        <span class="eyebrow">Admin Creator</span>
        <h2>Category Creator</h2>
      </div>
      <div class="header-controls">
        <label>
          <span>Editor Type</span>
          <select bind:value={editorType}>
            <option value="list">List</option>
            <option value="recipe">Recipe</option>
            <option value="document">Document</option>
          </select>
        </label>
        {#if editorType === 'list'}
          <label>
            <span>List Type</span>
            <select bind:value={listDomain}>
              <option value="preplists">Prep Lists</option>
              <option value="inventory">Inventory</option>
              <option value="orders">Orders</option>
            </select>
          </label>
        {/if}
      </div>
    </header>

    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <section class="panel-block">
      <h3>{editorType === 'recipe' ? 'Create Recipe Category' : 'Create Category'}</h3>
      {#if editorType === 'list'}
        <form method="POST" action="?/create_list_section" use:enhance={withResetFeedback} class="grid-form">
          <input type="hidden" name="domain" value={listDomain} />
          <label>
            <span>Name</span>
            <input name="title" placeholder={`${listDomainLabel(listDomain)} category`} required />
          </label>
          <label>
            <span>Description</span>
            <input name="description" placeholder="Optional details" />
          </label>
          <button type="submit">Create</button>
        </form>
      {:else}
        <form method="POST" action="?/create_creator_category" use:enhance={withResetFeedback} class="grid-form single-column">
          <input type="hidden" name="editor_type" value={editorType} />
          <label>
            <span>Name</span>
            <input name="category" placeholder={editorType === 'recipe' ? 'Entrees' : 'Policies'} required />
          </label>
          <button type="submit">Create</button>
        </form>
      {/if}
    </section>

    <section class="panel-block">
      <h3>Existing Categories</h3>

      {#if editorType === 'list'}
        {#if filteredListSections.length === 0}
          <p class="empty">No {listDomainLabel(listDomain)} categories yet.</p>
        {:else}
          <div class="stack">
            {#each filteredListSections as section}
              <article class="row-card">
                <form method="POST" action="?/update_list_section" use:enhance={withFeedback} class="inline-form">
                  <input type="hidden" name="section_id" value={section.id} />
                  <input name="title" value={section.title} required />
                  <input name="description" placeholder="Description" />
                  <button type="submit">Save</button>
                </form>
                <form method="POST" action="?/delete_list_section" use:enhance={withFeedback}>
                  <input type="hidden" name="section_id" value={section.id} />
                  <button type="submit" class="danger">Delete</button>
                </form>
              </article>
            {/each}
          </div>
        {/if}
      {:else if editorType === 'recipe'}
        {#if data.creatorCatalog.recipes.length === 0}
          <p class="empty">No recipe categories yet.</p>
        {:else}
          <div class="stack">
            {#each data.creatorCatalog.recipes as category}
              <article class="row-card">
                <form method="POST" action="?/update_creator_category" use:enhance={withFeedback} class="inline-form">
                  <input type="hidden" name="editor_type" value="recipe" />
                  <input type="hidden" name="previous_category" value={category} />
                  <input name="next_category" value={category} required />
                  <button type="submit">Save</button>
                </form>
                <form method="POST" action="?/delete_creator_category" use:enhance={withFeedback}>
                  <input type="hidden" name="editor_type" value="recipe" />
                  <input type="hidden" name="category" value={category} />
                  <button type="submit" class="danger">Delete</button>
                </form>
                <form method="POST" action="?/delete_creator_category" use:enhance={withFeedback}>
                  <input type="hidden" name="editor_type" value="recipe" />
                  <input type="hidden" name="category" value={category} />
                  <input type="hidden" name="delete_with_content" value="1" />
                  <button type="submit" class="danger">Delete + Content</button>
                </form>
              </article>
            {/each}
          </div>
        {/if}
      {:else}
        {#if data.creatorCatalog.documents.length === 0}
          <p class="empty">No document categories yet.</p>
        {:else}
          <div class="stack">
            {#each data.creatorCatalog.documents as category}
              <article class="row-card">
                <form method="POST" action="?/update_creator_category" use:enhance={withFeedback} class="inline-form">
                  <input type="hidden" name="editor_type" value="document" />
                  <input type="hidden" name="previous_category" value={category} />
                  <input name="next_category" value={category} required />
                  <button type="submit">Save</button>
                </form>
                <form method="POST" action="?/delete_creator_category" use:enhance={withFeedback}>
                  <input type="hidden" name="editor_type" value="document" />
                  <input type="hidden" name="category" value={category} />
                  <button type="submit" class="danger">Delete</button>
                </form>
                <form method="POST" action="?/delete_creator_category" use:enhance={withFeedback}>
                  <input type="hidden" name="editor_type" value="document" />
                  <input type="hidden" name="category" value={category} />
                  <input type="hidden" name="delete_with_content" value="1" />
                  <button type="submit" class="danger">Delete + Content</button>
                </form>
              </article>
            {/each}
          </div>
        {/if}
      {/if}
    </section>
  </section>
</Layout>

<style>
  .creator-panel {
    display: grid;
    gap: 0.9rem;
    margin-top: 0.95rem;
    padding: clamp(0.85rem, 2vw, 1.1rem) 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .creator-header {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 0.8rem;
  }

  .creator-header h2,
  .panel-block h3 {
    margin: 0;
  }

  .eyebrow {
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.7rem;
  }

  .header-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(170px, 1fr));
    gap: 0.5rem;
  }

  .header-controls label,
  .grid-form label {
    display: grid;
    gap: 0.2rem;
  }

  .header-controls span,
  .grid-form span {
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.68rem;
  }

  .panel-block {
    display: grid;
    gap: 0.65rem;
    border-top: 1px solid var(--color-divider);
    padding-top: 0.8rem;
    background: transparent;
  }

  .grid-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    align-items: end;
  }

  .grid-form.single-column {
    grid-template-columns: 1fr auto;
  }

  .stack {
    display: grid;
    gap: 0.42rem;
  }

  .row-card {
    border-top: 1px solid var(--color-divider);
    background: transparent;
    padding: 0.6rem 0 0;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .inline-form {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.3rem;
  }

  .empty {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .feedback-banner {
    margin: 0;
    padding: 0.55rem 0;
    border-top: 1px solid color-mix(in srgb, var(--color-success) 34%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--color-success) 18%, transparent);
    background: transparent;
    color: color-mix(in srgb, var(--color-success) 76%, var(--color-text));
    font-size: 0.8rem;
  }

  input,
  select {
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    padding: 0.4rem 0;
    background: transparent;
    color: var(--color-text);
    font-size: 0.8rem;
    width: 100%;
  }

  button {
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-success) 46%, var(--color-border));
    border-radius: 0;
    background: transparent;
    color: color-mix(in srgb, var(--color-success) 74%, var(--color-text));
    padding: 0.36rem 0.58rem;
    cursor: pointer;
    font-size: 0.76rem;
    font-weight: var(--weight-medium);
    justify-self: start;
  }

  button.danger {
    border-color: color-mix(in srgb, var(--color-error) 52%, var(--color-border));
    background: transparent;
    color: color-mix(in srgb, var(--color-error) 82%, var(--color-text));
  }

  @media (max-width: 900px) {
    .creator-header {
      flex-direction: column;
      align-items: start;
    }

    .header-controls,
    .grid-form,
    .grid-form.single-column,
    .inline-form {
      grid-template-columns: 1fr;
      width: 100%;
    }
  }
</style>

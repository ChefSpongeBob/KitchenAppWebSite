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
      <h3>Create Category</h3>
      {#if editorType === 'list'}
        <form method="POST" action="?/create_list_section" use:enhance={withFeedback} class="grid-form">
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
        <form method="POST" action="?/create_creator_category" use:enhance={withFeedback} class="grid-form single-column">
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
    gap: 0.75rem;
    margin-top: 0.95rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01) 40%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    box-shadow: 0 16px 34px rgba(4, 5, 7, 0.16);
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
    gap: 0.45rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.68rem;
    background: rgba(255, 255, 255, 0.015);
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
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 10px;
    background: rgba(132, 146, 166, 0.08);
    padding: 0.5rem;
    display: grid;
    gap: 0.35rem;
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
    padding: 0.65rem 0.82rem;
    border: 1px solid rgba(22, 163, 74, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.06));
    color: #bbf7d0;
    font-size: 0.8rem;
  }

  input,
  select {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 9px;
    padding: 0.4rem 0.52rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.8rem;
    width: 100%;
  }

  button {
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 9px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
    color: var(--color-primary-contrast);
    padding: 0.36rem 0.58rem;
    cursor: pointer;
    font-size: 0.76rem;
    font-weight: var(--weight-medium);
    justify-self: start;
  }

  button.danger {
    border-color: rgba(239, 68, 68, 0.38);
    background: linear-gradient(180deg, rgba(239, 68, 68, 0.24), rgba(239, 68, 68, 0.1));
    color: #fecaca;
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

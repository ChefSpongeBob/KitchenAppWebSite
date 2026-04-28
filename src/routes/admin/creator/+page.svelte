<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { browser } from '$app/environment';
  import { applyAction, enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type CreatorCatalog = {
    preplists: string[];
    inventory: string[];
    orders: string[];
    recipes: string[];
    documents: string[];
  };

  type ListDomain = 'preplists' | 'inventory' | 'orders';
  type EditorType = 'category' | 'list' | 'recipe' | 'document';

  type ListItem = {
    id: string;
    content: string;
    details: string;
    amount: number;
    par_count: number;
    is_checked: number;
    sort_order: number;
  };

  type ListSection = {
    id: string;
    domain: ListDomain;
    slug: string;
    title: string;
    items: ListItem[];
  };

  type RecipeRow = {
    id: number | string;
    title: string;
    category: string;
    ingredients: string;
    instructions: string;
  };

  type DocumentRow = {
    id: string;
    slug: string;
    title: string;
    section: string;
    category: string;
    content: string | null;
    file_url: string | null;
    is_active: number;
  };

  export let data: {
    sections: {
      preplists: ListSection[];
      inventory: ListSection[];
      orders: ListSection[];
    };
    recipes: RecipeRow[];
    documents: DocumentRow[];
    creatorCatalog: CreatorCatalog;
    initialEditorType: EditorType;
    initialListDomain: ListDomain;
  };

  let editorType: EditorType = data.initialEditorType;
  let listDomain: ListDomain = data.initialListDomain;
  let feedbackMessage = '';
  let lastAppliedRouteSelection = '';

  function normalizeKey(value: string) {
    return value.trim().toLowerCase();
  }

  function listDomainLabel(domain: ListDomain) {
    if (domain === 'preplists') return 'Prep Lists';
    if (domain === 'inventory') return 'Inventory';
    return 'Orders';
  }

  function recipesByCategory(category: string) {
    const key = normalizeKey(category);
    return data.recipes.filter((recipe) => normalizeKey(recipe.category) === key);
  }

  function documentsByCategory(category: string) {
    const key = normalizeKey(category);
    return data.documents.filter((document) => normalizeKey(document.category) === key);
  }

  $: listSections = [
    ...data.sections.preplists,
    ...data.sections.inventory,
    ...data.sections.orders
  ] satisfies ListSection[];
  $: filteredListSections = listSections.filter((section) => section.domain === listDomain);
  $: routeSelectionToken = `${data.initialEditorType}:${data.initialListDomain}`;
  $: if (routeSelectionToken !== lastAppliedRouteSelection) {
    editorType = data.initialEditorType;
    listDomain = data.initialListDomain;
    lastAppliedRouteSelection = routeSelectionToken;
  }
  $: if (browser && editorType === 'category') {
    goto('/admin/category-creator');
  }

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Creator changes saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That creator change could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Creator changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That creator change could not be saved.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader title="Admin Creator" />

  <section class="creator-panel">
    <header class="creator-header">
      <div>
        <span class="eyebrow">Creator Studio</span>
        <h2>Category Workbench</h2>
      </div>
      <div class="header-controls">
        <label>
          <span>Editor Type</span>
          <select bind:value={editorType}>
            <option value="category">Category Creator</option>
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
      <h3>Category List</h3>

      {#if editorType === 'list'}
        {#if filteredListSections.length === 0}
          <p class="empty">No {listDomainLabel(listDomain)} categories yet.</p>
        {:else}
          <div class="stack">
            {#each filteredListSections as section}
              <details class="entity">
                <summary>
                  <strong>{section.title}</strong>
                  <small>{section.items.length} item{section.items.length === 1 ? '' : 's'}</small>
                </summary>
                <div class="entity-body">
                  <form method="POST" action="?/update_list_section" use:enhance={withFeedback} class="inline-form">
                    <input type="hidden" name="section_id" value={section.id} />
                    <input name="title" value={section.title} required />
                    <input name="description" placeholder="Description" />
                    <button type="submit">Save Category</button>
                  </form>
                  <form method="POST" action="?/delete_list_section" use:enhance={withFeedback}>
                    <input type="hidden" name="section_id" value={section.id} />
                    <button type="submit" class="danger">Delete Category</button>
                  </form>

                  <div class="entity-items">
                    {#if section.items.length === 0}
                      <p class="empty">No items yet.</p>
                    {:else}
                      {#each section.items as item}
                        <div class="entity-item">
                          <form method="POST" action="?/update_list_item" use:enhance={withFeedback} class="inline-form">
                            <input type="hidden" name="id" value={item.id} />
                            <input name="content" value={item.content} required />
                            <input name="details" value={item.details} />
                            <input name="par_count" type="number" min="0" step="0.1" value={item.par_count} />
                            <button type="submit">Save Item</button>
                          </form>
                          <form method="POST" action="?/delete_list_item" use:enhance={withFeedback}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" class="danger">Delete</button>
                          </form>
                        </div>
                      {/each}
                    {/if}
                  </div>

                  <form method="POST" action="?/add_list_item" use:enhance={withFeedback} class="inline-form">
                    <input type="hidden" name="section_id" value={section.id} />
                    <input name="content" placeholder="New item" required />
                    <input name="details" placeholder="Optional details" />
                    <input name="par_count" type="number" min="0" step="0.1" value="0" />
                    <button type="submit">Add Item</button>
                  </form>
                </div>
              </details>
            {/each}
          </div>
        {/if}
      {:else if editorType === 'recipe'}
          {#if data.creatorCatalog.recipes.length === 0}
            <p class="empty">No recipe categories yet.</p>
          {:else}
            <div class="stack">
              {#each data.creatorCatalog.recipes as category}
                {@const items = recipesByCategory(category)}
                <details class="entity">
                  <summary>
                    <strong>{category}</strong>
                    <small>{items.length} recipe{items.length === 1 ? '' : 's'}</small>
                  </summary>
                  <div class="entity-body">
                    <div class="category-tools">
                      <form method="POST" action="?/update_creator_category" use:enhance={withFeedback} class="inline-form">
                        <input type="hidden" name="editor_type" value="recipe" />
                        <input type="hidden" name="previous_category" value={category} />
                        <input name="next_category" value={category} required />
                        <button type="submit">Rename Category</button>
                      </form>
                      <form method="POST" action="?/delete_creator_category" use:enhance={withFeedback}>
                        <input type="hidden" name="editor_type" value="recipe" />
                        <input type="hidden" name="category" value={category} />
                        <button type="submit" class="danger">Delete Category</button>
                      </form>
                      <form method="POST" action="?/delete_creator_category" use:enhance={withFeedback}>
                        <input type="hidden" name="editor_type" value="recipe" />
                        <input type="hidden" name="category" value={category} />
                        <input type="hidden" name="delete_with_content" value="1" />
                        <button type="submit" class="danger">Delete Category + Content</button>
                      </form>
                    </div>

                    <div class="entity-items">
                      {#if items.length === 0}
                        <p class="empty">No recipes yet.</p>
                      {:else}
                        {#each items as recipe}
                          <div class="entity-item">
                            <details>
                              <summary>{recipe.title}</summary>
                              <form method="POST" action="?/update_recipe" use:enhance={withFeedback} class="inline-form">
                                <input type="hidden" name="id" value={recipe.id} />
                                <input name="title" value={recipe.title} required />
                                <input name="category" value={recipe.category} required />
                                <textarea name="ingredients" rows="4" required>{recipe.ingredients}</textarea>
                                <textarea name="instructions" rows="6" required>{recipe.instructions}</textarea>
                                <button type="submit">Save Recipe</button>
                              </form>
                            </details>
                            <form method="POST" action="?/delete_recipe" use:enhance={withFeedback}>
                              <input type="hidden" name="id" value={recipe.id} />
                              <button type="submit" class="danger">Delete</button>
                            </form>
                          </div>
                        {/each}
                      {/if}
                    </div>

                    <form method="POST" action="?/create_recipe" use:enhance={withFeedback} class="inline-form">
                      <input name="category" value={category} required />
                      <input name="title" placeholder="Recipe title" required />
                      <textarea name="ingredients" rows="4" placeholder="Ingredients" required></textarea>
                      <textarea name="instructions" rows="6" placeholder="Instructions" required></textarea>
                      <button type="submit">Add Recipe</button>
                    </form>
                  </div>
                </details>
              {/each}
            </div>
          {/if}
        {:else}
          {#if data.creatorCatalog.documents.length === 0}
            <p class="empty">No document categories yet.</p>
          {:else}
            <div class="stack">
              {#each data.creatorCatalog.documents as category}
                {@const items = documentsByCategory(category)}
                <details class="entity">
                  <summary>
                    <strong>{category}</strong>
                    <small>{items.length} document{items.length === 1 ? '' : 's'}</small>
                  </summary>
                  <div class="entity-body">
                    <div class="category-tools">
                      <form method="POST" action="?/update_creator_category" use:enhance={withFeedback} class="inline-form">
                        <input type="hidden" name="editor_type" value="document" />
                        <input type="hidden" name="previous_category" value={category} />
                        <input name="next_category" value={category} required />
                        <button type="submit">Rename Category</button>
                      </form>
                      <form method="POST" action="?/delete_creator_category" use:enhance={withFeedback}>
                        <input type="hidden" name="editor_type" value="document" />
                        <input type="hidden" name="category" value={category} />
                        <button type="submit" class="danger">Delete Category</button>
                      </form>
                      <form method="POST" action="?/delete_creator_category" use:enhance={withFeedback}>
                        <input type="hidden" name="editor_type" value="document" />
                        <input type="hidden" name="category" value={category} />
                        <input type="hidden" name="delete_with_content" value="1" />
                        <button type="submit" class="danger">Delete Category + Content</button>
                      </form>
                    </div>

                    <div class="entity-items">
                      {#if items.length === 0}
                        <p class="empty">No documents yet.</p>
                      {:else}
                        {#each items as document}
                          <div class="entity-item">
                            <details>
                              <summary>{document.title}</summary>
                              <form
                                method="POST"
                                action="?/update_document"
                                enctype="multipart/form-data"
                                use:enhance={withFeedback}
                                class="inline-form"
                              >
                                <input type="hidden" name="id" value={document.id} />
                                <input type="hidden" name="existing_file_url" value={document.file_url ?? ''} />
                                <input name="title" value={document.title} required />
                                <input name="section" value={document.section} />
                                <input name="category" value={document.category} required />
                                <input name="file_url" value={document.file_url ?? ''} placeholder="https://..." />
                                <input name="file" type="file" accept="application/pdf,image/*" />
                                <textarea name="content" rows="5">{document.content ?? ''}</textarea>
                                <select name="is_active">
                                  <option value="1" selected={document.is_active === 1}>Active</option>
                                  <option value="0" selected={document.is_active === 0}>Inactive</option>
                                </select>
                                <button type="submit">Save Document</button>
                              </form>
                            </details>
                            <form method="POST" action="?/delete_document" use:enhance={withFeedback}>
                              <input type="hidden" name="id" value={document.id} />
                              <button type="submit" class="danger">Delete</button>
                            </form>
                          </div>
                        {/each}
                      {/if}
                    </div>

                    <form
                      method="POST"
                      action="?/create_document"
                      enctype="multipart/form-data"
                      use:enhance={withFeedback}
                      class="inline-form"
                    >
                      <input name="title" placeholder="Document title" required />
                      <input name="section" value="Docs" />
                      <input name="category" value={category} required />
                      <input name="file_url" placeholder="https://..." />
                      <input name="file" type="file" accept="application/pdf,image/*" />
                      <textarea name="content" rows="5" placeholder="Optional content"></textarea>
                      <select name="is_active">
                        <option value="1" selected>Active</option>
                        <option value="0">Inactive</option>
                      </select>
                      <button type="submit">Add Document</button>
                    </form>
                  </div>
                </details>
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

  .header-controls label {
    display: grid;
    gap: 0.2rem;
  }

  .header-controls span {
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

  .stack {
    display: grid;
    gap: 0.42rem;
  }

  .entity {
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 10px;
    background: rgba(132, 146, 166, 0.08);
    padding: 0.4rem;
  }

  .entity > summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
    cursor: pointer;
    list-style: none;
  }

  .entity > summary::-webkit-details-marker {
    display: none;
  }

  .entity > summary small,
  .empty {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .entity-body {
    margin-top: 0.5rem;
    display: grid;
    gap: 0.55rem;
  }

  .entity-items {
    display: grid;
    gap: 0.4rem;
  }

  .entity-item {
    border: 1px solid rgba(132, 146, 166, 0.2);
    border-radius: 9px;
    padding: 0.4rem;
    background: rgba(132, 146, 166, 0.06);
    display: grid;
    gap: 0.35rem;
  }

  .category-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 0.42rem;
    align-items: start;
  }

  .inline-form {
    display: grid;
    gap: 0.3rem;
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
  textarea,
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

    .header-controls {
      grid-template-columns: 1fr;
      width: 100%;
    }
  }
</style>

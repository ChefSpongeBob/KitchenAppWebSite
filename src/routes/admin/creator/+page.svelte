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

  type ListDomain = 'preplists' | 'checklists' | 'inventory' | 'orders';
  type EditorType = 'category' | 'list' | 'recipe' | 'document' | 'menu';

  type ItemAttachment = {
    id: string;
    sourceType: 'list_item' | 'checklist_item';
    sourceItemId: string;
    targetType: 'recipe' | 'document';
    targetId: string;
    title: string;
    category: string;
  };

  type ListItem = {
    id: string;
    content: string;
    details: string;
    amount: number;
    par_count: number;
    is_checked: number;
    sort_order: number;
    attachments?: ItemAttachment[];
  };

  type ListSection = {
    id: string;
    domain: Exclude<ListDomain, 'checklists'>;
    slug: string;
    title: string;
    description: string;
    items: ListItem[];
  };

  type ChecklistItem = {
    id: string;
    content: string;
    is_checked: number;
    sort_order: number;
    attachments?: ItemAttachment[];
  };

  type ChecklistSection = {
    id: string;
    slug: string;
    title: string;
    items: ChecklistItem[];
  };

  type ChecklistCategory = {
    id: string;
    title: string;
    sections: ChecklistSection[];
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
    checklists: ChecklistSection[];
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
  let attachmentDrafts: Record<string, { targetType: 'recipe' | 'document'; category: string; targetId: string }> = {};
  let reverseAttachmentDrafts: Record<string, { domain: ListDomain; category: string; sourceRef: string }> = {};

  function normalizeKey(value: string) {
    return value.trim().toLowerCase();
  }

  function listDomainLabel(domain: ListDomain) {
    if (domain === 'preplists') return 'Prep Lists';
    if (domain === 'checklists') return 'Checklists';
    if (domain === 'inventory') return 'Inventory';
    return 'Orders';
  }

  const checklistGroupSlug = (slug: string) => slug.replace(/-(opening|midday|closing)$/i, '');
  const toTitle = (value: string) =>
    value
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  function checklistSectionLabel(slug: string) {
    const match = slug.match(/-(opening|midday|closing)$/i);
    return match ? toTitle(match[1]) : 'Checklist';
  }

  function recipesByCategory(category: string) {
    const key = normalizeKey(category);
    return data.recipes.filter((recipe) => normalizeKey(recipe.category) === key);
  }

  function documentsByCategory(category: string) {
    const key = normalizeKey(category);
    return data.documents.filter((document) => normalizeKey(document.category) === key && !isMenuDocument(document));
  }

  function attachmentTargetLabel(type: 'recipe' | 'document') {
    return type === 'recipe' ? 'Recipe' : 'Doc';
  }

  function attachmentDraftKey(sourceType: 'list_item' | 'checklist_item', itemId: string) {
    return `${sourceType}:${itemId}`;
  }

  function attachmentDraft(sourceType: 'list_item' | 'checklist_item', itemId: string) {
    const key = attachmentDraftKey(sourceType, itemId);
    return (
      attachmentDrafts[key] ?? {
        targetType: 'recipe',
        category: data.creatorCatalog.recipes[0] ?? '',
        targetId: ''
      }
    );
  }

  function updateAttachmentDraft(
    sourceType: 'list_item' | 'checklist_item',
    itemId: string,
    patch: Partial<{ targetType: 'recipe' | 'document'; category: string; targetId: string }>
  ) {
    const key = attachmentDraftKey(sourceType, itemId);
    const current = attachmentDraft(sourceType, itemId);
    const nextType = patch.targetType ?? current.targetType;
    const categoryOptions = nextType === 'recipe' ? data.creatorCatalog.recipes : documentCategories;
    const nextCategory = patch.category ?? (patch.targetType ? categoryOptions[0] ?? '' : current.category);
    attachmentDrafts = {
      ...attachmentDrafts,
      [key]: {
        targetType: nextType,
        category: nextCategory,
        targetId: patch.targetId ?? ''
      }
    };
  }

  function attachmentCategoryOptions(sourceType: 'list_item' | 'checklist_item', itemId: string) {
    const draft = attachmentDraft(sourceType, itemId);
    return draft.targetType === 'recipe' ? data.creatorCatalog.recipes : documentCategories;
  }

  function attachmentTargetOptions(sourceType: 'list_item' | 'checklist_item', itemId: string) {
    const draft = attachmentDraft(sourceType, itemId);
    return draft.targetType === 'recipe'
      ? recipesByCategory(draft.category).map((recipe) => ({ id: `recipe:${recipe.id}`, title: recipe.title }))
      : documentsByCategory(draft.category).map((document) => ({ id: `document:${document.id}`, title: document.title }));
  }

  function reverseDraftKey(targetType: 'recipe' | 'document', targetId: number | string) {
    return `${targetType}:${targetId}`;
  }

  function reverseAttachmentDraft(targetType: 'recipe' | 'document', targetId: number | string) {
    const key = reverseDraftKey(targetType, targetId);
    return (
      reverseAttachmentDrafts[key] ?? {
        domain: 'preplists',
        category: filteredReverseCategoryOptions('preplists')[0]?.id ?? '',
        sourceRef: ''
      }
    );
  }

  function filteredReverseCategoryOptions(domain: ListDomain) {
    if (domain === 'checklists') return checklistCategories.map((category) => ({ id: category.id, title: category.title }));
    return data.sections[domain].map((section) => ({ id: section.id, title: section.title }));
  }

  function updateReverseAttachmentDraft(
    targetType: 'recipe' | 'document',
    targetId: number | string,
    patch: Partial<{ domain: ListDomain; category: string; sourceRef: string }>
  ) {
    const key = reverseDraftKey(targetType, targetId);
    const current = reverseAttachmentDraft(targetType, targetId);
    const nextDomain = patch.domain ?? current.domain;
    const categoryOptions = filteredReverseCategoryOptions(nextDomain);
    reverseAttachmentDrafts = {
      ...reverseAttachmentDrafts,
      [key]: {
        domain: nextDomain,
        category: patch.category ?? (patch.domain ? categoryOptions[0]?.id ?? '' : current.category),
        sourceRef: patch.sourceRef ?? ''
      }
    };
  }

  function reverseItemOptions(targetType: 'recipe' | 'document', targetId: number | string) {
    const draft = reverseAttachmentDraft(targetType, targetId);
    if (draft.domain === 'checklists') {
      const category = checklistCategories.find((entry) => entry.id === draft.category);
      return (category?.sections ?? []).flatMap((section) =>
        section.items.map((item) => ({
          id: `checklist_item:${item.id}`,
          title: `${checklistSectionLabel(section.slug)}: ${item.content}`
        }))
      );
    }

    const section = data.sections[draft.domain].find((entry) => entry.id === draft.category);
    return (section?.items ?? []).map((item) => ({ id: `list_item:${item.id}`, title: item.content }));
  }

  function isMenuDocument(document: DocumentRow) {
    return (
      normalizeKey(document.category) === 'menu' ||
      normalizeKey(document.section) === 'menu' ||
      normalizeKey(document.slug).startsWith('menu')
    );
  }

  $: listSections = [
    ...data.sections.preplists,
    ...data.sections.inventory,
    ...data.sections.orders
  ] satisfies ListSection[];
  $: filteredListSections =
    listDomain === 'checklists' ? [] : listSections.filter((section) => section.domain === listDomain);
  $: checklistGroupMap = data.checklists.reduce((map, section) => {
    const key = checklistGroupSlug(section.slug);
    const current = map.get(key) ?? [];
    current.push(section);
    map.set(key, current);
    return map;
  }, new Map<string, ChecklistSection[]>());
  $: checklistCategories = Array.from(checklistGroupMap.entries())
    .map(([id, sections]) => ({
      id,
      title: toTitle(id),
      sections: sections.sort((a, b) => a.title.localeCompare(b.title))
    })) satisfies ChecklistCategory[];
  $: documentCategories = data.creatorCatalog.documents.filter((category) => normalizeKey(category) !== 'menu');
  $: routeSelectionToken = `${data.initialEditorType}:${data.initialListDomain}`;
  $: if (routeSelectionToken !== lastAppliedRouteSelection) {
    editorType = data.initialEditorType;
    listDomain = data.initialListDomain;
    lastAppliedRouteSelection = routeSelectionToken;
  }
  $: if (browser && editorType === 'category') {
    goto('/admin/category-creator');
  }
  $: if (browser && editorType === 'menu') {
    goto('/admin/menus');
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

  const withResetFeedback: SubmitFunction = ({ formElement }) => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        formElement.reset();
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
            <option value="menu">Menus</option>
          </select>
        </label>
        {#if editorType === 'list'}
          <label>
            <span>List Type</span>
            <select bind:value={listDomain}>
              <option value="preplists">Prep Lists</option>
              <option value="checklists">Checklists</option>
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
        {#if listDomain === 'checklists'}
          <form method="POST" action="?/create_checklist_category" use:enhance={withResetFeedback} class="create-form">
            <input name="title" placeholder="New checklist category" required />
            <input name="description" placeholder="Description" />
            <input type="hidden" name="create_shift_sections" value="1" />
            <button type="submit">Create Checklist</button>
          </form>

          {#if checklistCategories.length === 0}
            <p class="empty">No checklist categories yet.</p>
          {:else}
            <div class="stack">
              {#each checklistCategories as category}
                <details class="entity">
                  <summary>
                    <strong>{category.title}</strong>
                    <small>{category.sections.length} section{category.sections.length === 1 ? '' : 's'}</small>
                  </summary>
                  <div class="entity-body">
                    <div class="category-tools">
                      <form method="POST" action="?/update_checklist_category" use:enhance={withFeedback} class="inline-form">
                        <input type="hidden" name="base_slug" value={category.id} />
                        <input name="title" value={category.title} required />
                        <button type="submit">Rename Category</button>
                      </form>
                      <form method="POST" action="?/delete_checklist_category" use:enhance={withFeedback}>
                        <input type="hidden" name="base_slug" value={category.id} />
                        <button type="submit" class="danger">Delete Category</button>
                      </form>
                    </div>

                    <div class="entity-items">
                      {#each category.sections as section}
                        <div class="entity-item">
                          <div class="section-head">
                            <strong>{checklistSectionLabel(section.slug)}</strong>
                            <small>{section.items.length} item{section.items.length === 1 ? '' : 's'}</small>
                          </div>
                          <form method="POST" action="?/add_checklist_item" use:enhance={withResetFeedback} class="inline-form">
                            <input type="hidden" name="section_id" value={section.id} />
                            <input name="content" placeholder="New checklist item" required />
                            <button type="submit">Add Item</button>
                          </form>
                          {#if section.items.length === 0}
                            <p class="empty">No items yet.</p>
                          {:else}
                            <div class="entity-items nested">
                              {#each section.items as item}
                                {@const draft = attachmentDraft('checklist_item', item.id)}
                                <div class="entity-item compact">
                                  <form method="POST" action="?/update_checklist_item" use:enhance={withFeedback} class="inline-form">
                                    <input type="hidden" name="id" value={item.id} />
                                    <input name="content" value={item.content} required />
                                    <button type="submit">Save Item</button>
                                  </form>
                                  <form method="POST" action="?/delete_checklist_item" use:enhance={withFeedback}>
                                    <input type="hidden" name="id" value={item.id} />
                                    <button type="submit" class="danger">Delete</button>
                                  </form>
                                  <details class="attach-editor">
                                    <summary>Attach Recipe/Doc</summary>
                                    <form method="POST" action="?/create_item_attachment" use:enhance={withFeedback} class="attach-form">
                                      <input type="hidden" name="source_type" value="checklist_item" />
                                      <input type="hidden" name="source_item_id" value={item.id} />
                                      <select
                                        name="target_type"
                                        aria-label="Attachment type"
                                        on:change={(event) =>
                                          updateAttachmentDraft('checklist_item', item.id, {
                                            targetType: (event.currentTarget as HTMLSelectElement).value as 'recipe' | 'document'
                                          })}
                                      >
                                        <option value="recipe" selected={draft.targetType === 'recipe'}>Recipe</option>
                                        <option value="document" selected={draft.targetType === 'document'}>Doc</option>
                                      </select>
                                      <select
                                        aria-label="Attachment category"
                                        on:change={(event) =>
                                          updateAttachmentDraft('checklist_item', item.id, {
                                            category: (event.currentTarget as HTMLSelectElement).value
                                          })}
                                      >
                                        {#each attachmentCategoryOptions('checklist_item', item.id) as category}
                                          <option value={category} selected={draft.category === category}>{category}</option>
                                        {/each}
                                      </select>
                                      <select name="target_ref" required>
                                        <option value="">Choose item</option>
                                        {#each attachmentTargetOptions('checklist_item', item.id) as target}
                                          <option value={target.id} selected={draft.targetId === target.id}>{target.title}</option>
                                        {/each}
                                      </select>
                                      <button type="submit">Save</button>
                                    </form>
                                    {#if item.attachments?.length}
                                      <div class="attachment-list">
                                        {#each item.attachments as attachment}
                                          <form method="POST" action="?/delete_item_attachment" use:enhance={withFeedback} class="attachment-chip">
                                            <input type="hidden" name="id" value={attachment.id} />
                                            <span>{attachmentTargetLabel(attachment.targetType)}: {attachment.title}</span>
                                            <button type="submit" class="text-danger" aria-label="Remove attachment">Remove</button>
                                          </form>
                                        {/each}
                                      </div>
                                    {/if}
                                  </details>
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                </details>
              {/each}
            </div>
          {/if}
        {:else}
          <form method="POST" action="?/create_list_section" use:enhance={withResetFeedback} class="create-form">
            <input type="hidden" name="domain" value={listDomain} />
            <input name="title" placeholder={`New ${listDomainLabel(listDomain)} category`} required />
            <input name="description" placeholder="Description" />
            <input name="first_item" placeholder="First item" />
            <input name="first_details" placeholder="Item details" />
            <input name="first_par_count" type="number" min="0" step="0.1" value="0" />
            <button type="submit">Create {listDomainLabel(listDomain)}</button>
          </form>

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
                      <input name="description" value={section.description} placeholder="Description" />
                      <button type="submit">Save Category</button>
                    </form>
                    <form method="POST" action="?/delete_list_section" use:enhance={withFeedback}>
                      <input type="hidden" name="section_id" value={section.id} />
                      <button type="submit" class="danger">Delete Category</button>
                    </form>

                    <form method="POST" action="?/add_list_item" use:enhance={withResetFeedback} class="inline-form">
                      <input type="hidden" name="section_id" value={section.id} />
                      <input name="content" placeholder="New item" required />
                      <input name="details" placeholder="Optional details" />
                      <input name="par_count" type="number" min="0" step="0.1" value="0" />
                      <button type="submit">Add Item</button>
                    </form>

                    <div class="entity-items">
                      {#if section.items.length === 0}
                        <p class="empty">No items yet.</p>
                      {:else}
                        {#each section.items as item}
                          {@const draft = attachmentDraft('list_item', item.id)}
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
                            <details class="attach-editor">
                              <summary>Attach Recipe/Doc</summary>
                              <form method="POST" action="?/create_item_attachment" use:enhance={withFeedback} class="attach-form">
                                <input type="hidden" name="source_type" value="list_item" />
                                <input type="hidden" name="source_item_id" value={item.id} />
                                      <select
                                        name="target_type"
                                        aria-label="Attachment type"
                                        on:change={(event) =>
                                          updateAttachmentDraft('list_item', item.id, {
                                      targetType: (event.currentTarget as HTMLSelectElement).value as 'recipe' | 'document'
                                    })}
                                >
                                  <option value="recipe" selected={draft.targetType === 'recipe'}>Recipe</option>
                                  <option value="document" selected={draft.targetType === 'document'}>Doc</option>
                                </select>
                                <select
                                  aria-label="Attachment category"
                                  on:change={(event) =>
                                    updateAttachmentDraft('list_item', item.id, {
                                      category: (event.currentTarget as HTMLSelectElement).value
                                    })}
                                >
                                  {#each attachmentCategoryOptions('list_item', item.id) as category}
                                    <option value={category} selected={draft.category === category}>{category}</option>
                                  {/each}
                                </select>
                                <select name="target_ref" required>
                                  <option value="">Choose item</option>
                                  {#each attachmentTargetOptions('list_item', item.id) as target}
                                    <option value={target.id} selected={draft.targetId === target.id}>{target.title}</option>
                                  {/each}
                                </select>
                                <button type="submit">Save</button>
                              </form>
                              {#if item.attachments?.length}
                                <div class="attachment-list">
                                  {#each item.attachments as attachment}
                                    <form method="POST" action="?/delete_item_attachment" use:enhance={withFeedback} class="attachment-chip">
                                      <input type="hidden" name="id" value={attachment.id} />
                                      <span>{attachmentTargetLabel(attachment.targetType)}: {attachment.title}</span>
                                      <button type="submit" class="text-danger" aria-label="Remove attachment">Remove</button>
                                    </form>
                                  {/each}
                                </div>
                              {/if}
                            </details>
                          </div>
                        {/each}
                      {/if}
                    </div>
                  </div>
                </details>
              {/each}
            </div>
          {/if}
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

                    <details class="add-editor">
                      <summary>Add Recipe</summary>
                      <form method="POST" action="?/create_recipe" use:enhance={withResetFeedback} class="inline-form">
                        <input name="category" value={category} required />
                        <input name="title" placeholder="Recipe title" required />
                        <textarea name="ingredients" rows="4" placeholder="Ingredients" required></textarea>
                        <textarea name="instructions" rows="6" placeholder="Instructions" required></textarea>
                        <button type="submit">Save Recipe</button>
                      </form>
                    </details>

                    <div class="entity-items">
                      {#if items.length === 0}
                        <p class="empty">No recipes yet.</p>
                      {:else}
                        {#each items as recipe}
                          {@const reverseDraft = reverseAttachmentDraft('recipe', recipe.id)}
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
                            <details class="attach-editor">
                              <summary>Attach to Item</summary>
                              <form method="POST" action="?/attach_target_to_item" use:enhance={withFeedback} class="attach-form">
                                <input type="hidden" name="target_type" value="recipe" />
                                <input type="hidden" name="target_id" value={recipe.id} />
                                <select
                                  aria-label="List type"
                                  on:change={(event) =>
                                    updateReverseAttachmentDraft('recipe', recipe.id, {
                                      domain: (event.currentTarget as HTMLSelectElement).value as ListDomain
                                    })}
                                >
                                  <option value="preplists" selected={reverseDraft.domain === 'preplists'}>Prep Lists</option>
                                  <option value="checklists" selected={reverseDraft.domain === 'checklists'}>Checklists</option>
                                  <option value="inventory" selected={reverseDraft.domain === 'inventory'}>Inventory</option>
                                  <option value="orders" selected={reverseDraft.domain === 'orders'}>Orders</option>
                                </select>
                                <select
                                  aria-label="List category"
                                  on:change={(event) =>
                                    updateReverseAttachmentDraft('recipe', recipe.id, {
                                      category: (event.currentTarget as HTMLSelectElement).value
                                    })}
                                >
                                  {#each filteredReverseCategoryOptions(reverseDraft.domain) as category}
                                    <option value={category.id} selected={reverseDraft.category === category.id}>{category.title}</option>
                                  {/each}
                                </select>
                                <select name="source_ref" required>
                                  <option value="">Choose item</option>
                                  {#each reverseItemOptions('recipe', recipe.id) as item}
                                    <option value={item.id} selected={reverseDraft.sourceRef === item.id}>{item.title}</option>
                                  {/each}
                                </select>
                                <button type="submit">Save</button>
                              </form>
                            </details>
                          </div>
                        {/each}
                      {/if}
                    </div>
                  </div>
                </details>
              {/each}
            </div>
          {/if}
        {:else}
          {#if documentCategories.length === 0}
            <p class="empty">No document categories yet.</p>
          {:else}
            <div class="stack">
              {#each documentCategories as category}
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

                    <form
                      method="POST"
                      action="?/create_document"
                      enctype="multipart/form-data"
                      use:enhance={withResetFeedback}
                      class="inline-form"
                    >
                      <input name="title" placeholder="Document title" required />
                      <input type="hidden" name="section" value="Docs" />
                      <input type="hidden" name="category" value={category} />
                      <input type="hidden" name="file_url" value="" />
                      <input type="hidden" name="content" value="" />
                      <input name="file" type="file" accept="application/pdf,image/*" />
                      <select name="is_active">
                        <option value="1" selected>Active</option>
                        <option value="0">Inactive</option>
                      </select>
                      <button type="submit">Add Document</button>
                    </form>

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
                                <input type="hidden" name="section" value={document.section} />
                                <input type="hidden" name="category" value={document.category} />
                                <input type="hidden" name="file_url" value={document.file_url ?? ''} />
                                <input type="hidden" name="content" value="" />
                                <input name="title" value={document.title} required />
                                <input name="file" type="file" accept="application/pdf,image/*" />
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
    padding: 1rem 0;
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
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 0.68rem 0;
    background: transparent;
  }

  .stack {
    display: grid;
    gap: 0.42rem;
  }

  .entity {
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    padding: 0.58rem 0;
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

  .entity-items.nested {
    gap: 0.3rem;
  }

  .entity-item {
    border: 0;
    border-left: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 0.3rem 0 0.3rem 0.62rem;
    background: transparent;
    display: grid;
    gap: 0.35rem;
  }

  .entity-item.compact {
    padding: 0.34rem;
  }

  .attach-editor {
    padding-top: 0.1rem;
  }

  .add-editor {
    border-top: 1px solid var(--color-divider);
    padding-top: 0.45rem;
  }

  .add-editor > summary,
  .attach-editor > summary {
    width: fit-content;
    cursor: pointer;
    list-style: none;
    color: var(--color-text-muted);
    font-size: 0.76rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .add-editor > summary::-webkit-details-marker,
  .attach-editor > summary::-webkit-details-marker {
    display: none;
  }

  .add-editor .inline-form {
    margin-top: 0.5rem;
  }

  .attach-form {
    margin-top: 0.42rem;
    display: grid;
    grid-template-columns: minmax(180px, 1fr) auto;
    gap: 0.34rem;
    align-items: center;
  }

  .attachment-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.4rem;
  }

  .attachment-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.38rem;
    padding: 0.22rem 0.42rem;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .text-danger {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: color-mix(in srgb, var(--color-error) 72%, var(--color-text));
    font-size: 0.72rem;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    align-items: center;
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

  .create-form {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.36rem;
    padding: 0.48rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
  }

  .create-form button {
    grid-column: 1 / -1;
  }

  .feedback-banner {
    margin: 0;
    padding: 0.65rem 0;
    border-top: 1px solid color-mix(in srgb, var(--color-success) 34%, var(--color-border));
    border-bottom: 1px solid color-mix(in srgb, var(--color-success) 18%, var(--color-border));
    border-radius: 0;
    background: transparent;
    color: color-mix(in srgb, var(--color-success) 74%, var(--color-text));
    font-size: 0.8rem;
  }

  input,
  textarea,
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
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.36rem 0.58rem;
    cursor: pointer;
    font-size: 0.76rem;
    font-weight: var(--weight-medium);
    justify-self: start;
  }

  button.danger {
    border-color: color-mix(in srgb, var(--color-error) 38%, var(--color-border));
    background: transparent;
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
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

    .create-form {
      grid-template-columns: 1fr;
    }
  }
</style>

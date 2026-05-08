<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type Item = {
    id: string;
    content: string;
    details: string;
    amount: number;
    par_count: number;
    is_checked: number;
  };

  type Section = {
    id: string;
    slug: string;
    title: string;
    items: Item[];
  };

  type ChecklistItem = {
    id: string;
    content: string;
    amount: number;
    par_count: number;
    is_checked: number;
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

  type DocumentItem = {
    id: string;
    slug: string;
    title: string;
    section: string;
    category: string;
    content: string | null;
    file_url: string | null;
    is_active: number;
  };

  type EditorType = 'preplists' | 'checklists' | 'inventory' | 'orders' | 'documents';
  type CategoryOption = { id: string; title: string };

  export let data: {
    preplists: Section[];
    inventory: Section[];
    orders: Section[];
    checklists: ChecklistSection[];
    documents: DocumentItem[];
  };

  const editorTypeOptions: Array<{ id: EditorType; title: string }> = [
    { id: 'preplists', title: 'Prep Lists' },
    { id: 'checklists', title: 'Checklists' },
    { id: 'inventory', title: 'Inventory' },
    { id: 'orders', title: 'Orders' },
    { id: 'documents', title: 'Documents (PDF/Image)' }
  ];

  const sectionsByType: Record<'preplists' | 'inventory' | 'orders', Section[]> = {
    preplists: data.preplists,
    inventory: data.inventory,
    orders: data.orders
  };

  const checklistGroupSlug = (slug: string) => slug.replace(/-(opening|midday|closing)$/i, '');
  const toTitle = (value: string) =>
    value
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const checklistGroupMap = new Map<string, ChecklistSection[]>();
  for (const section of data.checklists) {
    const group = checklistGroupSlug(section.slug);
    const current = checklistGroupMap.get(group) ?? [];
    current.push(section);
    checklistGroupMap.set(group, current);
  }

  const checklistCategories: ChecklistCategory[] = Array.from(checklistGroupMap.entries())
    .map(([id, sections]) => ({
      id,
      title: toTitle(id),
      sections: sections.sort((a, b) => a.title.localeCompare(b.title))
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const documentGroupMap = new Map<string, DocumentItem[]>();
  for (const document of data.documents) {
    const groupKey = document.category?.trim() || 'General';
    const bucket = documentGroupMap.get(groupKey) ?? [];
    bucket.push(document);
    documentGroupMap.set(groupKey, bucket);
  }
  const documentGroups = Array.from(documentGroupMap.entries())
    .map(([category, docs]) => ({
      id: category,
      title: category,
      docs: docs.sort((a, b) => a.title.localeCompare(b.title))
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  let editorType: EditorType = 'preplists';
  let selectedCategory = '';
  let editorOpen = false;
  let feedbackMessage = '';

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Editor changes saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That editor change could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Editor changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That editor change could not be saved.'
            : '';
    };
  };

  const hasCategory = (options: CategoryOption[], id: string) => options.some((option) => option.id === id);

  $: categoryOptions = (() => {
    if (editorType === 'checklists') {
      return checklistCategories.map((category) => ({ id: category.id, title: category.title }));
    }
    if (editorType === 'documents') {
      return documentGroups.map((group) => ({ id: group.id, title: group.title }));
    }
    return sectionsByType[editorType].map((section) => ({ id: section.id, title: section.title }));
  })();

  $: if (!hasCategory(categoryOptions, selectedCategory)) {
    selectedCategory = categoryOptions[0]?.id ?? '';
  }

  $: currentListSection =
    editorType === 'preplists' || editorType === 'inventory' || editorType === 'orders'
      ? sectionsByType[editorType].find((section) => section.id === selectedCategory) ?? null
      : null;

  $: currentChecklistCategory =
    editorType === 'checklists'
      ? checklistCategories.find((category) => category.id === selectedCategory) ?? null
      : null;

  $: currentDocumentGroup =
    editorType === 'documents'
      ? documentGroups.find((group) => group.id === selectedCategory)?.docs ?? []
      : [];

  const categoryItemCount = (id: string) => {
    if (editorType === 'checklists') {
      const category = checklistCategories.find((entry) => entry.id === id);
      if (!category) return 0;
      return category.sections.reduce((total, section) => total + section.items.length, 0);
    }

    if (editorType === 'documents') {
      return documentGroups.find((group) => group.id === id)?.docs.length ?? 0;
    }

    return sectionsByType[editorType].find((section) => section.id === id)?.items.length ?? 0;
  };

  $: selectedCategoryTitle = categoryOptions.find((option) => option.id === selectedCategory)?.title ?? '';
</script>

<Layout>
  <PageHeader title="Admin List Editor" />

  <section class="panel">
    <header class="panel-header">
      <div>
        <span class="eyebrow">Unified Editor</span>
        <h2>Content Builder</h2>
      </div>
      <p>Select a type and category, then edit and submit.</p>
    </header>

    <div class="editor-controls">
      <label>
        <span>List Type</span>
        <select bind:value={editorType}>
          {#each editorTypeOptions as option}
            <option value={option.id}>{option.title}</option>
          {/each}
        </select>
      </label>

      <label>
        <span>Category</span>
        <select bind:value={selectedCategory}>
          {#if categoryOptions.length === 0}
            <option value="">No categories</option>
          {:else}
            {#each categoryOptions as option}
              <option value={option.id}>{option.title}</option>
            {/each}
          {/if}
        </select>
      </label>
    </div>

    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <section class="category-dashboard" aria-label="Category dashboard">
      {#if categoryOptions.length === 0}
        <p class="empty-note">No categories available for this list type.</p>
      {:else}
        {#each categoryOptions as option}
          <button
            type="button"
            class="category-tile"
            class:active={selectedCategory === option.id}
            on:click={() => {
              selectedCategory = option.id;
              editorOpen = false;
            }}
          >
            <strong>{option.title}</strong>
            <span>{categoryItemCount(option.id)} items</span>
          </button>
        {/each}
      {/if}
    </section>

    {#if selectedCategory}
      <section class="editor-launch">
        <div>
          <span class="eyebrow">Selected Category</span>
          <h3>{selectedCategoryTitle}</h3>
        </div>
        <button type="button" on:click={() => (editorOpen = !editorOpen)}>
          {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>
      </section>
    {/if}

    {#if editorOpen && editorType === 'documents'}
      <section class="editor-block">
        <h3>Documents</h3>
        <form method="POST" action="?/create_document" enctype="multipart/form-data" use:enhance={withFeedback} class="add-row docs-form">
          <input name="title" placeholder="Document title" required />
          <input name="section" placeholder="Section" value="Docs" />
          <input name="category" placeholder="Category" value="General" />
          <input name="file_url" placeholder="File URL (optional)" />
          <input name="file" type="file" accept="application/pdf,image/*" />
          <textarea name="content" rows="8" placeholder="Document content"></textarea>
          <select name="is_active">
            <option value="1" selected>Active</option>
            <option value="0">Inactive</option>
          </select>
          <button type="submit">Add Document</button>
        </form>

        {#if currentDocumentGroup.length === 0}
          <p class="empty-note">No documents in this category yet.</p>
        {:else}
          {#each currentDocumentGroup as doc}
            <details class="section-block">
              <summary>
                <h4>{doc.title}</h4>
                <span>{doc.is_active === 1 ? 'Active' : 'Inactive'}</span>
              </summary>
              <form method="POST" action="?/update_document" enctype="multipart/form-data" use:enhance={withFeedback} class="add-row docs-form">
                <input type="hidden" name="id" value={doc.id} />
                <input type="hidden" name="existing_file_url" value={doc.file_url ?? ''} />
                <input type="hidden" name="slug" value={doc.slug} />
                <input name="title" value={doc.title} required />
                <input name="section" value={doc.section} />
                <input name="category" value={doc.category} />
                <input name="file_url" value={doc.file_url ?? ''} />
                <input name="file" type="file" accept="application/pdf,image/*" />
                <textarea name="content" rows="8">{doc.content ?? ''}</textarea>
                <select name="is_active">
                  <option value="1" selected={doc.is_active === 1}>Active</option>
                  <option value="0" selected={doc.is_active === 0}>Inactive</option>
                </select>
                <button type="submit">Save</button>
              </form>
              <form method="POST" action="?/delete_document" use:enhance={withFeedback} class="inline delete-row">
                <input type="hidden" name="id" value={doc.id} />
                <button type="submit" class="text-action danger" aria-label="Delete document">Delete</button>
              </form>
            </details>
          {/each}
        {/if}
      </section>
    {:else if editorOpen && editorType === 'checklists'}
      <section class="editor-block">
        <h3>{currentChecklistCategory?.title ?? 'Checklist Category'}</h3>
        {#if !currentChecklistCategory}
          <p class="empty-note">No checklist categories available.</p>
        {:else}
          {#each currentChecklistCategory.sections as section}
            <details class="section-block" open>
              <summary>
                <h4>{section.title}</h4>
                <span>{section.items.length} items</span>
              </summary>
              <table class="sheet">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {#each section.items as item}
                    <tr>
                      <td>
                        <form method="POST" action="?/update_checklist_item" use:enhance={withFeedback} class="inline-edit checklist-edit">
                          <input type="hidden" name="id" value={item.id} />
                          <input name="content" value={item.content} required />
                          <button type="submit" class="text-action" aria-label="Save item">Save</button>
                        </form>
                      </td>
                      <td>{item.is_checked ? 'Done' : 'Open'}</td>
                      <td>
                        <form method="POST" action="?/delete_checklist_item" use:enhance={withFeedback} class="inline">
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" class="text-action danger" aria-label="Delete item">Delete</button>
                        </form>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              <form method="POST" action="?/add_checklist_item" use:enhance={withFeedback} class="add-row checklist-add">
                <input type="hidden" name="section_id" value={section.id} />
                <input name="content" placeholder={`Add item to ${section.title}`} required />
                <button type="submit">Add Item</button>
              </form>
            </details>
          {/each}
        {/if}
      </section>
    {:else if editorOpen}
      <section class="editor-block">
        <h3>{currentListSection?.title ?? 'List Section'}</h3>
        {#if !currentListSection}
          <p class="empty-note">No section available for this type.</p>
        {:else}
          <table class="sheet">
            <thead>
              <tr>
                <th>Item</th>
                <th>Par</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each currentListSection.items as item}
                <tr>
                  <td>
                    <div class="item-editor">
                      <form method="POST" action="?/update_list_item" use:enhance={withFeedback} class="inline-edit list-item-form">
                        <input type="hidden" name="id" value={item.id} />
                        <input name="content" value={item.content} required />
                        <input name="details" value={item.details} placeholder="Reference / pan size" />
                        <input name="par_count" type="number" min="0" step="0.1" value={item.par_count} required />
                        <button type="submit" class="text-action" aria-label="Save item">Save</button>
                      </form>

                      <form method="POST" action="?/delete_list_item" use:enhance={withFeedback} class="list-delete-form">
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" class="text-action danger" aria-label="Delete item">Delete</button>
                      </form>
                    </div>
                  </td>
                  <td>{item.par_count}</td>
                  <td>{item.is_checked ? 'Done' : 'Open'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <form method="POST" action="?/add_list_item" use:enhance={withFeedback} class="add-row">
            <input type="hidden" name="section_id" value={currentListSection.id} />
            <input name="content" placeholder={`Add item to ${currentListSection.title}`} required />
            <input name="details" placeholder="Reference / pan size" />
            <input name="par_count" type="number" min="0" step="0.1" placeholder="Par" value="0" required />
            <button type="submit">Add Item</button>
          </form>
        {/if}
      </section>
    {/if}
  </section>
</Layout>

<style>
  .panel {
    position: relative;
    margin-top: 0.95rem;
    padding: 1rem;
    border: 1px solid var(--surface-outline);
    border-radius: var(--radius-lg);
    background: var(--surface-wash), var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  .panel::before {
    content: none;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    margin-bottom: 0.8rem;
  }

  .panel-header h2 {
    margin: 0;
  }

  .panel-header p,
  .eyebrow {
    color: var(--color-text-muted);
  }

  .editor-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin-bottom: 0.8rem;
  }

  .category-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.6rem;
    margin-bottom: 0.8rem;
  }

  .category-tile {
    text-align: left;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 0.72rem;
    background: color-mix(in srgb, var(--color-surface-alt) 36%, transparent);
    display: grid;
    gap: 0.2rem;
    cursor: pointer;
    transition: border-color 140ms var(--ease-out), transform 140ms var(--ease-out);
  }

  .category-tile strong {
    font-size: 0.92rem;
    color: var(--color-text);
  }

  .category-tile span {
    font-size: 0.76rem;
    color: var(--color-text-muted);
  }

  .category-tile:hover,
  .category-tile:focus-visible,
  .category-tile.active {
    border-color: color-mix(in srgb, var(--color-text-muted) 42%, transparent);
    background: color-mix(in srgb, var(--color-surface-alt) 62%, transparent);
    transform: none;
    outline: none;
  }

  .editor-launch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    border: 1px solid var(--color-divider);
    border-radius: 12px;
    padding: 0.65rem 0.75rem;
    margin-bottom: 0.8rem;
    background: transparent;
  }

  .editor-launch h3 {
    margin: 0.15rem 0 0;
  }

  .editor-controls label {
    display: grid;
    gap: 0.28rem;
  }

  .editor-controls span {
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .editor-block h3 {
    margin: 0 0 0.75rem;
  }

  .editor-block {
    overflow-x: auto;
  }

  .section-block + .section-block {
    margin-top: 0.7rem;
  }

  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    list-style: none;
    padding: 0.35rem 0.1rem 0.7rem;
  }

  summary h4 {
    margin: 0;
  }

  summary span {
    color: var(--color-text-muted);
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .sheet {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .sheet th,
  .sheet td {
    text-align: left;
    padding: 0.48rem 0.42rem;
    border-bottom: 1px solid var(--color-divider);
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .sheet th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-surface-alt) 28%, transparent);
  }

  .add-row,
  .inline,
  .inline-edit {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .add-row {
    margin-top: 0.7rem;
  }

  .docs-form {
    align-items: flex-start;
  }

  .docs-form textarea {
    width: 100%;
    min-height: 180px;
    resize: vertical;
    flex: 1 1 100%;
  }

  .checklist-edit input {
    flex: 1 1 auto;
  }

  .item-editor {
    display: grid;
    gap: 0.5rem;
  }

  .list-item-form {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(92px, 120px) auto;
    gap: 0.45rem;
    align-items: center;
  }

  .list-delete-form {
    display: flex;
    justify-content: flex-start;
  }

  .delete-row {
    justify-content: flex-end;
    margin-top: 0.45rem;
  }

  .checklist-add {
    display: grid;
    grid-template-columns: 1fr auto;
  }

  .feedback-banner {
    margin: 0 0 0.8rem;
    padding: 0.72rem 0.9rem;
    border: 1px solid color-mix(in srgb, #16a34a 34%, var(--color-border));
    border-radius: 12px;
    background: color-mix(in srgb, #16a34a 14%, transparent);
    color: #bbf7d0;
  }

  .empty-note {
    margin: 0;
    color: var(--color-text-muted);
  }

  input,
  textarea,
  select {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.42rem 0.55rem;
    background: var(--surface-wash), var(--color-surface-alt);
    color: var(--color-text);
    font-size: 0.82rem;
    width: 100%;
  }

  button {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-text) 5%);
    color: var(--color-primary-contrast);
    padding: 0.4rem 0.62rem;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .text-action {
    min-width: 5.8rem;
    min-height: 2rem;
    white-space: nowrap;
  }

  .danger {
    border-color: color-mix(in srgb, #ef4444 36%, var(--color-border));
    color: #ffb6b6;
    background: color-mix(in srgb, #7f1d1d 34%, var(--color-surface));
  }

  @media (max-width: 900px) {
    .panel-header {
      flex-direction: column;
      align-items: start;
    }

    .editor-controls {
      grid-template-columns: 1fr;
    }

    .sheet {
      min-width: 0;
    }

    .add-row > *,
    .inline-edit > * {
      flex: 1 1 100%;
      min-width: 0;
    }

    .list-item-form {
      grid-template-columns: minmax(0, 1fr);
    }

    .text-action {
      width: 100%;
    }
  }
</style>

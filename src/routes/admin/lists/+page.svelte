<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import type { SubmitFunction } from '@sveltejs/kit';

  type Item = {
    id: string;
    content: string;
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

  export let data: {
    preplists: Section[];
    inventory: Section[];
    orders: Section[];
    checklists: ChecklistSection[];
  };

  const buckets = [
    { id: 'preplists', title: 'Preplists', sections: data.preplists, description: 'Prep sheets for the day.' },
    { id: 'inventory', title: 'Inventory', sections: data.inventory, description: 'Count sheets for stocked items.' },
    { id: 'orders', title: 'Orders', sections: data.orders, description: 'Order sheets and supply lists.' },
    { id: 'checklists', title: 'Checklists', sections: [], description: 'Opening, mid day, and closing checklist tasks.' }
  ];

  const isShiftChecklist = (slug: string, prefix: string) =>
    [`${prefix}-opening`, `${prefix}-midday`, `${prefix}-closing`].includes(slug);

  const checklistCategories: ChecklistCategory[] = [
    {
      id: 'sushi-prep',
      title: 'Sushi Prep',
      sections: data.checklists.filter((section) => isShiftChecklist(section.slug, 'sushi-prep'))
    },
    {
      id: 'sushi',
      title: 'Sushi',
      sections: data.checklists.filter((section) => isShiftChecklist(section.slug, 'sushi'))
    },
    {
      id: 'kitchen',
      title: 'Kitchen',
      sections: data.checklists.filter((section) => isShiftChecklist(section.slug, 'kitchen'))
    }
  ];

  let feedbackMessage = '';

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      feedbackMessage =
        result.type === 'success'
          ? 'List changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That list change could not be saved.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader
    title="Admin Lists"
    subtitle="Edit prep, inventory, and order sheets."
  />

  <nav class="subnav">
    <a href="/admin">Back to Dashboard</a>
    {#each buckets as bucket}
      <a href={`#${bucket.id}`}>{bucket.title}</a>
    {/each}
  </nav>

  {#each buckets as bucket}
    <section class="panel" id={bucket.id}>
      <header class="panel-header">
        <div>
          <span class="eyebrow">Sheet Group</span>
          <h2>{bucket.title}</h2>
        </div>
        <p>{bucket.description}</p>
      </header>

      {#if feedbackMessage}
        <p class="feedback-banner">{feedbackMessage}</p>
      {/if}

      {#if bucket.id === 'checklists'}
        {#each checklistCategories as category}
          <details class="section-block category-block">
            <summary>
              <h3>{category.title}</h3>
              <span>{category.sections.length} lists</span>
            </summary>

            {#each category.sections as section}
              <details class="subsection-block">
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
          </details>
        {/each}
      {:else}
        {#each bucket.sections as section}
          <details class="section-block">
            <summary>
              <h3>{section.title}</h3>
              <span>{section.items.length} items</span>
            </summary>
            <table class="sheet">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Par</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each section.items as item}
                  <tr>
                    <td>
                      <div class="item-editor">
                        <form method="POST" action="?/update_list_item" use:enhance={withFeedback} class="inline-edit list-item-form">
                          <input type="hidden" name="id" value={item.id} />
                          <input name="content" value={item.content} required />
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
              <input type="hidden" name="section_id" value={section.id} />
              <input name="content" placeholder={`Add item to ${section.title}`} required />
              <input name="par_count" type="number" min="0" step="0.1" placeholder="Par" value="0" required />
              <button type="submit">Add Item</button>
            </form>
          </details>
        {/each}
      {/if}
    </section>
  {/each}
</Layout>

<style>
  .subnav {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
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
    margin-top: 0.95rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.008) 42%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
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
  summary span {
    color: var(--color-text-muted);
  }

  .section-block + .section-block {
    margin-top: 0.7rem;
  }

  .subsection-block {
    margin-top: 0.6rem;
    margin-left: 0.4rem;
    padding-left: 0.8rem;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .subsection-block h4 {
    margin: 0;
    font-size: 0.98rem;
  }

  summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    list-style: none;
    padding: 0.35rem 0.1rem 0.7rem;
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  .sheet th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.02);
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

  .feedback-banner {
    margin: 0 0 0.8rem;
    padding: 0.72rem 0.9rem;
    border: 1px solid rgba(22, 163, 74, 0.22);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.06));
    color: #bbf7d0;
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
    grid-template-columns: minmax(0, 1.4fr) minmax(92px, 120px) auto;
    gap: 0.45rem;
    align-items: center;
  }

  .list-delete-form {
    display: flex;
    justify-content: flex-start;
  }

  .checklist-add {
    display: grid;
    grid-template-columns: 1fr auto;
  }

  input {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.42rem 0.55rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.82rem;
    width: 100%;
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

  .text-action {
    min-width: 5.8rem;
    min-height: 2rem;
    white-space: nowrap;
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

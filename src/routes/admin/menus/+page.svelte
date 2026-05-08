<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';

  type MenuDocument = {
    id: string;
    slug: string;
    title: string;
    section: string;
    category: string;
    content: string | null;
    file_url: string | null;
    is_active: number;
  };

  export let data: { menus: MenuDocument[] };
  let feedbackMessage = '';

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Menu saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That menu could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Menu saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That menu could not be saved.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader title="Menus" />

  <section class="workspace">
    <header class="workspace-head">
      <h2>Menus</h2>
      <span>{data.menus.length} total</span>
    </header>

    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <details class="creator" open>
      <summary>Add menu</summary>
      <form method="POST" action="?/create_menu" enctype="multipart/form-data" use:enhance={withFeedback} class="menu-form">
        <input type="hidden" name="section" value="Menu" />
        <input type="hidden" name="category" value="Menu" />
        <input type="hidden" name="file_url" value="" />
        <input type="hidden" name="content" value="" />
        <input name="title" placeholder="Menu title" required />
        <input name="file" type="file" accept="application/pdf,image/*" required />
        <select name="is_active">
          <option value="1" selected>Active</option>
          <option value="0">Hidden</option>
        </select>
        <button type="submit">Add Menu</button>
      </form>
    </details>

    <section class="records">
      {#if data.menus.length === 0}
        <EmptyState title="No menus yet." compact />
      {:else}
        {#each data.menus as menu}
          <details class="record-row">
            <summary>
              <span>{menu.title}</span>
              <small>{menu.is_active === 1 ? 'Active' : 'Hidden'}</small>
            </summary>

            <form method="POST" action="?/update_menu" enctype="multipart/form-data" use:enhance={withFeedback} class="menu-form compact">
              <input type="hidden" name="id" value={menu.id} />
              <input type="hidden" name="existing_file_url" value={menu.file_url ?? ''} />
              <input type="hidden" name="slug" value={menu.slug} />
              <input type="hidden" name="section" value="Menu" />
              <input type="hidden" name="category" value="Menu" />
              <input type="hidden" name="file_url" value={menu.file_url ?? ''} />
              <input type="hidden" name="content" value="" />
              <input name="title" value={menu.title} required />
              <input name="file" type="file" accept="application/pdf,image/*" />
              <select name="is_active">
                <option value="1" selected={menu.is_active === 1}>Active</option>
                <option value="0" selected={menu.is_active === 0}>Hidden</option>
              </select>
              <button type="submit">Save</button>
            </form>

            <form method="POST" action="?/delete_menu" use:enhance={withFeedback} class="delete-form">
              <input type="hidden" name="id" value={menu.id} />
              <button type="submit" class="danger">Delete</button>
            </form>
          </details>
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
  .record-row > summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
  }

  .workspace-head,
  .creator,
  .record-row {
    border-bottom: 1px solid var(--color-divider);
    padding-bottom: 0.7rem;
  }

  h2,
  p {
    margin: 0;
  }

  .workspace-head span,
  .record-row small {
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

  .menu-form {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(210px, 1.2fr) minmax(120px, 0.45fr) auto;
    gap: 0.55rem;
    align-items: center;
    margin-top: 0.7rem;
  }

  input,
  select {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.52rem 0.62rem;
    background: var(--surface-wash), var(--color-surface-alt);
    color: var(--color-text);
    font-size: 0.84rem;
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

  .delete-form {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.45rem;
  }

  .danger {
    border-color: color-mix(in srgb, #ef4444 38%, var(--color-border));
    background: color-mix(in srgb, #7f1d1d 30%, var(--color-surface));
    color: #fecaca;
  }

  @media (max-width: 980px) {
    .menu-form {
      grid-template-columns: 1fr;
    }

    button,
    .delete-form {
      width: 100%;
    }
  }
</style>

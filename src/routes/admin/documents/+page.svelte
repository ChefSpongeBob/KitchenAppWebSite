<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';

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

  export let data: { documents: DocumentItem[] };

  let feedbackMessage = '';
  $: documentBuckets = Array.from(
    data.documents.reduce((acc, doc) => {
      const key = doc.category?.trim() || 'General';
      const bucket = acc.get(key) ?? [];
      bucket.push(doc);
      acc.set(key, bucket);
      return acc;
    }, new Map<string, DocumentItem[]>())
  ).sort((a, b) => a[0].localeCompare(b[0]));

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Document saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That document could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Document saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That document could not be saved.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader title="Admin Documents" />

  <section class="workspace">
    <header class="workspace-head">
      <h2>Documents</h2>
      <span>{data.documents.length} total</span>
    </header>

    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <details class="creator" open>
      <summary>Add document</summary>
      <form method="POST" action="?/create_document" enctype="multipart/form-data" use:enhance={withFeedback} class="editor-form">
        <div class="field-grid">
          <input name="title" placeholder="Document title" required />
          <input name="section" placeholder="Section" value="Docs" />
          <input name="category" placeholder="Category" value="General" />
          <select name="is_active">
            <option value="1" selected>Active</option>
            <option value="0">Hidden</option>
          </select>
        </div>
        <input name="file_url" placeholder="File URL" />
        <input name="file" type="file" accept="application/pdf,image/*" />
        <textarea name="content" rows="5" placeholder="Optional notes"></textarea>
        <button type="submit">Add Document</button>
      </form>
    </details>

    <section class="records">
      {#if documentBuckets.length === 0}
        <EmptyState title="No documents yet." compact />
      {:else}
        {#each documentBuckets as [category, docs]}
          <section class="bucket">
            <header>
              <h3>{category}</h3>
              <span>{docs.length}</span>
            </header>

            {#each docs as doc}
              <details class="record-row">
                <summary>
                  <span>{doc.title}</span>
                  <small>{doc.is_active === 1 ? 'Active' : 'Hidden'}</small>
                </summary>

                <form method="POST" action="?/update_document" enctype="multipart/form-data" use:enhance={withFeedback} class="editor-form compact">
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="existing_file_url" value={doc.file_url ?? ''} />
                  <input type="hidden" name="slug" value={doc.slug} />
                  <div class="field-grid">
                    <input name="title" value={doc.title} required />
                    <input name="section" value={doc.section} />
                    <input name="category" value={doc.category} />
                    <select name="is_active">
                      <option value="1" selected={doc.is_active === 1}>Active</option>
                      <option value="0" selected={doc.is_active === 0}>Hidden</option>
                    </select>
                  </div>
                  <input name="file_url" value={doc.file_url ?? ''} />
                  <input name="file" type="file" accept="application/pdf,image/*" />
                  <textarea name="content" rows="5">{doc.content ?? ''}</textarea>
                  <button type="submit">Save</button>
                </form>

                <form method="POST" action="?/delete_document" use:enhance={withFeedback} class="delete-form">
                  <input type="hidden" name="id" value={doc.id} />
                  <button type="submit" class="danger">Delete</button>
                </form>
              </details>
            {/each}
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
  .record-row > summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
  }

  .workspace-head {
    padding-bottom: 0.65rem;
    border-bottom: 1px solid var(--color-divider);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  .workspace-head span,
  .bucket header span,
  .record-row small {
    color: var(--color-text-muted);
  }

  .feedback-banner {
    padding: 0.62rem 0;
    color: #86efac;
  }

  .creator,
  .bucket,
  .record-row {
    border-top: 1px solid var(--color-divider);
    padding-top: 0.65rem;
  }

  summary {
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .creator > summary,
  .record-row > summary span {
    font-weight: var(--weight-semibold);
  }

  .editor-form {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.7rem;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.55rem;
  }

  input,
  textarea,
  select {
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
    justify-self: end;
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

  @media (max-width: 900px) {
    .field-grid {
      grid-template-columns: 1fr;
    }

    button,
    .delete-form {
      width: 100%;
    }
  }
</style>

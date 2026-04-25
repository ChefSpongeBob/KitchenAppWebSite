<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
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

  let newDocSlug = 'about';
  let feedbackMessage = '';
  $: documentBuckets = Array.from(
    data.documents.reduce((acc, doc) => {
      const bucket = acc.get(doc.slug) ?? [];
      bucket.push(doc);
      acc.set(doc.slug, bucket);
      return acc;
    }, new Map<string, DocumentItem[]>())
  ).sort((a, b) => a[0].localeCompare(b[0]));

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Document changes saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That document change could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? 'Document changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That document change could not be saved.'
            : '';
    };
  };
</script>

<Layout>
  <PageHeader
    title="Admin Documents"
  />

  <section class="panel">
    <header class="panel-header">
      <div>
        <span class="eyebrow">Create</span>
        <h2>Documents</h2>
      </div>
      <p>{data.documents.length} docs</p>
    </header>

    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <form method="POST" action="?/create_document" enctype="multipart/form-data" use:enhance={withFeedback} class="add-row docs-form">
      <input name="slug" bind:value={newDocSlug} placeholder="doc-slug" required />
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

    <div class="doc-groups">
      {#if documentBuckets.length === 0}
        <p class="muted">No documents found.</p>
      {:else}
        {#each documentBuckets as [slug, docs]}
          <details class="section-block">
            <summary>
              <h3>{slug}</h3>
              <span>{docs.length} docs</span>
            </summary>
            {#each docs as doc}
              <details class="edit-doc">
                <summary>{doc.title}</summary>
                <form method="POST" action="?/update_document" enctype="multipart/form-data" use:enhance={withFeedback} class="add-row docs-form">
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="existing_file_url" value={doc.file_url ?? ''} />
                  <input name="slug" value={doc.slug} required />
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
                  <div class="form-actions">
                    <button type="submit">Save</button>
                  </div>
                </form>
                <form method="POST" action="?/delete_document" use:enhance={withFeedback} class="inline delete-row">
                  <input type="hidden" name="id" value={doc.id} />
                  <button type="submit" class="icon-btn danger" aria-label="Delete document">X</button>
                </form>
              </details>
            {/each}
          </details>
        {/each}
      {/if}
    </div>
  </section>
</Layout>

<style>
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
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.88), rgba(132, 146, 166, 0.2));
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
  .muted,
  summary span {
    color: var(--color-text-muted);
  }

  .add-row,
  .inline {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .docs-form {
    align-items: flex-start;
  }

  .feedback-banner {
    margin: 0 0 0.8rem;
    padding: 0.72rem 0.9rem;
    border: 1px solid rgba(22, 163, 74, 0.22);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.06));
    color: #bbf7d0;
  }

  .docs-form textarea {
    width: 100%;
    min-height: 180px;
    resize: vertical;
    flex: 1 1 100%;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    margin-top: 0.2rem;
  }

  .doc-groups {
    margin-top: 0.8rem;
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

  .edit-doc {
    margin-top: 0.45rem;
    border: 1px dashed rgba(132, 146, 166, 0.22);
    border-radius: 12px;
    padding: 0.6rem;
    background: rgba(255, 255, 255, 0.015);
  }

  .edit-doc summary {
    padding: 0;
  }

  .delete-row {
    justify-content: flex-end;
    margin-top: 0.45rem;
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
    width: 100%;
  }

  button {
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
    color: var(--color-primary-contrast);
    min-height: 2.6rem;
    padding: 0.55rem 0.78rem;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-medium);
  }

  .icon-btn {
    width: 1.9rem;
    height: 1.9rem;
    min-height: 1.9rem;
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

    .form-actions {
      justify-content: stretch;
    }

    .form-actions button {
      width: 100%;
    }
  }
</style>



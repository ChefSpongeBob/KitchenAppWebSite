<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { enhance } from '$app/forms';

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
  const preferredDocSlugOrder = ['about', 'sop', 'handbook'];
  $: documentBuckets = Array.from(
    data.documents.reduce((acc, doc) => {
      const bucket = acc.get(doc.slug) ?? [];
      bucket.push(doc);
      acc.set(doc.slug, bucket);
      return acc;
    }, new Map<string, DocumentItem[]>())
  ).sort((a, b) => {
    const aIndex = preferredDocSlugOrder.indexOf(a[0]);
    const bIndex = preferredDocSlugOrder.indexOf(b[0]);
    if (aIndex === -1 && bIndex === -1) return a[0].localeCompare(b[0]);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
</script>

<Layout>
  <PageHeader
    title="Admin Documents"
    subtitle="Add and update documents here."
  />

  <nav class="subnav">
    <a href="/admin">Back to Dashboard</a>
  </nav>

  <section class="panel">
    <header class="panel-header">
      <div>
        <span class="eyebrow">Create</span>
        <h2>Documents</h2>
      </div>
      <p>{data.documents.length} docs</p>
    </header>

    <form method="POST" action="?/create_document" use:enhance class="add-row docs-form">
      <select name="slug" bind:value={newDocSlug} required>
        <option value="about">About</option>
        <option value="sop">SOP</option>
        <option value="handbook">Handbook</option>
        <option value="custom">Custom slug</option>
      </select>
      {#if newDocSlug === 'custom'}
        <input name="slug_custom" placeholder="custom-slug" required />
      {/if}
      <input name="title" placeholder="Document title" required />
      <input name="section" placeholder="Section" value="Docs" />
      <input name="category" placeholder="Category" value="General" />
      <input name="file_url" placeholder="File URL (optional)" />
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
                <form method="POST" action="?/update_document" use:enhance class="add-row docs-form">
                  <input type="hidden" name="id" value={doc.id} />
                  <input name="slug" value={doc.slug} required />
                  <input name="title" value={doc.title} required />
                  <input name="section" value={doc.section} />
                  <input name="category" value={doc.category} />
                  <input name="file_url" value={doc.file_url ?? ''} />
                  <textarea name="content" rows="8">{doc.content ?? ''}</textarea>
                  <select name="is_active">
                    <option value="1" selected={doc.is_active === 1}>Active</option>
                    <option value="0" selected={doc.is_active === 0}>Inactive</option>
                  </select>
                  <button type="submit">Save</button>
                </form>
                <form method="POST" action="?/delete_document" use:enhance class="inline">
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
  .subnav {
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

  .docs-form textarea {
    width: 100%;
    min-height: 180px;
    resize: vertical;
    flex: 1 1 100%;
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
    border: 1px dashed rgba(195, 32, 43, 0.22);
    border-radius: 12px;
    padding: 0.6rem;
    background: rgba(255, 255, 255, 0.015);
  }

  .edit-doc summary {
    padding: 0;
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
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    padding: 0.4rem 0.62rem;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .icon-btn {
    width: 1.9rem;
    height: 1.9rem;
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
  }
</style>

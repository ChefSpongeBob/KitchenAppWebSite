<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import PdfPageStack from '$lib/components/ui/PdfPageStack.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  type Doc = {
    title: string;
    content: string | null;
    file_url: string | null;
    category: string;
    slug: string;
  };

  export let data: { doc: Doc };

  function isPdf(url: string | null) {
    return Boolean(url && url.toLowerCase().endsWith('.pdf'));
  }
</script>

<Layout>
  <PageHeader title={data.doc.title} />

  <section class="doc-viewer">
    <header class="doc-head">
      <a href="/docs">
        <span class="material-icons" aria-hidden="true">arrow_back</span>
        Documents
      </a>
      <span>
        <span class="material-icons" aria-hidden="true">folder_open</span>
        {data.doc.category}
      </span>
    </header>

    {#if data.doc.content}
      <p class="doc-copy">{data.doc.content}</p>
    {/if}

    {#if data.doc.file_url}
      <div class="doc-actions">
        <a href={data.doc.file_url} target="_blank" rel="noreferrer">
          <span class="material-icons" aria-hidden="true">open_in_new</span>
          Open file
        </a>
        <a href={data.doc.file_url} download>
          <span class="material-icons" aria-hidden="true">download</span>
          Download
        </a>
      </div>

      <div class="file-stage">
        {#if isPdf(data.doc.file_url)}
          <PdfPageStack src={data.doc.file_url} title={data.doc.title} />
        {:else}
          <img src={data.doc.file_url} alt={data.doc.title} loading="lazy" />
        {/if}
      </div>
    {:else if !data.doc.content}
      <EmptyState title="No document details yet." compact />
    {/if}
  </section>
</Layout>

<style>
  .doc-viewer {
    display: grid;
    gap: 0.9rem;
  }

  .doc-head,
  .doc-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.55rem;
  }

  .doc-head {
    justify-content: space-between;
    padding-bottom: 0.7rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .doc-head a,
  .doc-head span,
  .doc-actions a {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-text);
    text-decoration: none;
  }

  .doc-head a:hover,
  .doc-actions a:hover {
    color: var(--color-primary);
  }

  .doc-head > span,
  .doc-copy {
    color: var(--color-text-muted);
  }

  .doc-copy {
    margin: 0;
    max-width: 72ch;
    line-height: 1.65;
  }

  .doc-actions a {
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 0.42rem 0;
    font-size: 0.82rem;
    background: transparent;
  }

  .doc-head .material-icons,
  .doc-actions .material-icons {
    font-size: 1rem;
    line-height: 1;
  }

  .file-stage {
    display: grid;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }

  .file-stage img {
    width: 100%;
    max-height: 78vh;
    object-fit: contain;
    border-radius: 0;
    border: 1px solid var(--color-divider);
  }
</style>

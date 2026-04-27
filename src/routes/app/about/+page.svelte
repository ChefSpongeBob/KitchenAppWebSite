<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PdfPageStack from '$lib/components/ui/PdfPageStack.svelte';

  type Doc = { title: string; content: string | null; file_url: string | null; category: string };
  export let data: { doc: Doc | null };
</script>

<Layout>
  <section class="head" data-reveal style="--reveal-delay: 40ms;">
    <p class="eyebrow">About Workspace</p>
    <h1>About this workspace</h1>
    <p>Company information and reference documentation for this deployment.</p>
  </section>

  {#if data.doc}
    <section class="about-band" data-reveal>
      <div class="about-copy">
        <h2>{data.doc.title}</h2>
        {#if data.doc.content}
          <p class="copy">{data.doc.content}</p>
        {:else}
          <p class="copy muted">No text summary has been added yet.</p>
        {/if}
        {#if data.doc.file_url}
          <a href={data.doc.file_url} target="_blank" rel="noreferrer" class="doc-link">Open document</a>
        {/if}
      </div>

      {#if data.doc.file_url}
        <div class="doc-preview">
          <PdfPageStack src={data.doc.file_url} title={data.doc.title} />
        </div>
      {/if}
    </section>
  {:else}
    <section class="empty-band" data-reveal>
      <p>No about document is configured yet.</p>
    </section>
  {/if}
</Layout>

<style>
  .head {
    display: grid;
    gap: 0.45rem;
  }

  .eyebrow {
    margin: 0;
    font-size: 0.76rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  h1 {
    margin: 0;
    font-size: clamp(1.45rem, 3.6vw, 2.05rem);
    line-height: 1.1;
  }

  .head p {
    margin: 0;
    color: var(--color-text-muted);
    max-width: 66ch;
    line-height: 1.5;
  }

  .about-band {
    margin-top: 0.95rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 0.76rem;
    align-items: start;
  }

  .about-copy {
    display: grid;
    gap: 0.35rem;
  }

  h2 {
    margin: 0;
    font-size: clamp(1.02rem, 2.4vw, 1.4rem);
  }

  .copy {
    margin: 0;
    white-space: pre-wrap;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .muted {
    color: var(--color-text-muted);
  }

  .doc-link {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    color: var(--color-text);
    border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
    padding-bottom: 0.12rem;
    font-weight: var(--weight-semibold);
    width: fit-content;
  }

  .doc-preview {
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 0.44rem;
    background:
      linear-gradient(160deg, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 60%),
      var(--color-surface);
  }

  .empty-band {
    margin-top: 0.9rem;
    padding: 0.9rem;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: var(--color-surface);
  }

  .empty-band p {
    margin: 0;
    color: var(--color-text-muted);
  }

  @media (max-width: 980px) {
    .about-band {
      grid-template-columns: 1fr;
    }
  }
</style>

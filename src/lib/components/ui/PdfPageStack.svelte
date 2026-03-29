<script lang="ts">
  import { onMount } from 'svelte';
  import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

  export let src = '';
  export let title = 'Document';

  let container: HTMLDivElement | null = null;
  let pages: string[] = [];
  let loading = true;
  let failed = false;

  onMount(async () => {
    if (!src || !container) {
      loading = false;
      return;
    }

    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      const loadingTask = pdfjs.getDocument(src);
      const pdf = await loadingTask.promise;

      const nextPages: string[] = [];
      const targetWidth = Math.min(container.clientWidth || 900, 960);

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const initialViewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / initialViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({
          canvas,
          canvasContext: context,
          viewport
        }).promise;

        nextPages.push(canvas.toDataURL('image/png'));
      }

      pages = nextPages;
    } catch (error) {
      console.error(`Failed to render PDF stack for ${title}:`, error);
      failed = true;
    } finally {
      loading = false;
    }
  });
</script>

<div class="pdf-stack" bind:this={container} aria-label={title}>
  {#if loading}
    <div class="state">Loading document…</div>
  {:else if failed}
    <div class="state">Document preview could not be loaded.</div>
  {:else}
    {#each pages as pageSrc, index}
      <figure class="page-frame">
        <img src={pageSrc} alt={`${title} page ${index + 1}`} loading="lazy" />
      </figure>
    {/each}
  {/if}
</div>

<style>
  .pdf-stack {
    display: grid;
    gap: 1rem;
  }

  .page-frame {
    margin: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: white;
    box-shadow: 0 14px 30px rgba(4, 5, 7, 0.18);
  }

  .page-frame img {
    display: block;
    width: 100%;
    height: auto;
    background: white;
  }

  .state {
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-surface) 94%, black 6%);
  }
 </style>

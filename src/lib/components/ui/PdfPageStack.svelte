<script lang="ts">
  import { onMount } from 'svelte';
  import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  export let src = '';
  export let title = 'Document';

  let container: HTMLDivElement | null = null;
  let pages: string[] = [];
  let loading = true;
  let failed = false;
  let pageFrames: Array<HTMLElement | null> = [];
  let zoomedPageIndex: number | null = null;
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let lastTapAt = 0;
  let lastTapIndex: number | null = null;

  const ZOOM_SCALE = 2;
  const DOUBLE_TAP_DELAY_MS = 420;
  const MAX_RENDER_WIDTH = 1400;
  const MIN_RENDER_QUALITY = 2;
  const MAX_RENDER_QUALITY = 3;

  function resetZoom() {
    zoomedPageIndex = null;
    offsetX = 0;
    offsetY = 0;
    dragging = false;
    dragPointerId = null;
  }

  function clampOffset(index: number, nextX: number, nextY: number) {
    const frame = pageFrames[index];
    if (!frame) return { x: nextX, y: nextY };

    const maxX = ((frame.clientWidth * ZOOM_SCALE) - frame.clientWidth) / 2;
    const maxY = ((frame.clientHeight * ZOOM_SCALE) - frame.clientHeight) / 2;

    return {
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY))
    };
  }

  function toggleZoom(index: number) {
    if (zoomedPageIndex === index) {
      resetZoom();
      return;
    }

    zoomedPageIndex = index;
    offsetX = 0;
    offsetY = 0;
    dragging = false;
    dragPointerId = null;
  }

  function handleTouchEnd(index: number) {
    const now = Date.now();
    if (lastTapIndex === index && now - lastTapAt < DOUBLE_TAP_DELAY_MS) {
      toggleZoom(index);
      lastTapAt = 0;
      lastTapIndex = null;
      return;
    }

    lastTapAt = now;
    lastTapIndex = index;
  }

  function handlePointerDown(index: number, event: PointerEvent) {
    if (zoomedPageIndex !== index) return;

    dragging = true;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginX = offsetX;
    dragOriginY = offsetY;

    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(index: number, event: PointerEvent) {
    if (zoomedPageIndex !== index || dragPointerId !== event.pointerId || !dragging) return;

    event.preventDefault();

    const next = clampOffset(
      index,
      dragOriginX + (event.clientX - dragStartX),
      dragOriginY + (event.clientY - dragStartY)
    );

    offsetX = next.x;
    offsetY = next.y;
  }

  function handlePointerUp(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return;
    dragging = false;
    dragPointerId = null;
  }

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
      const targetWidth = Math.min(container.clientWidth || 900, MAX_RENDER_WIDTH);
      const deviceScale = Math.min(
        Math.max(window.devicePixelRatio || 1, MIN_RENDER_QUALITY),
        MAX_RENDER_QUALITY
      );

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const initialViewport = page.getViewport({ scale: 1 });
        const displayScale = targetWidth / initialViewport.width;
        const renderScale = displayScale * deviceScale;
        const viewport = page.getViewport({ scale: renderScale });

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
    <EmptyState tone="loading" icon="hourglass_empty" title="Loading document..." compact />
  {:else if failed}
    <EmptyState tone="error" icon="warning" title="Document preview could not be loaded." compact />
  {:else}
    {#each pages as pageSrc, index}
      <figure
        class="page-frame"
        class:zoomed={zoomedPageIndex === index}
        class:dragging={zoomedPageIndex === index && dragging}
        bind:this={pageFrames[index]}
        on:dblclick={() => toggleZoom(index)}
        on:touchend={() => handleTouchEnd(index)}
        on:pointerdown={(event) => handlePointerDown(index, event)}
        on:pointermove={(event) => handlePointerMove(index, event)}
        on:pointerup={handlePointerUp}
        on:pointercancel={handlePointerUp}
      >
        <img
          src={pageSrc}
          alt={`${title} page ${index + 1}`}
          loading="lazy"
          style={zoomedPageIndex === index
            ? `transform: translate(${offsetX}px, ${offsetY}px) scale(${ZOOM_SCALE});`
            : undefined}
        />
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
    border: 1px solid var(--surface-outline);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: white;
    box-shadow: var(--shadow-sm);
  }

  .page-frame.zoomed {
    touch-action: none;
    cursor: grab;
  }

  .page-frame.zoomed.dragging {
    cursor: grabbing;
  }

  .page-frame img {
    display: block;
    width: 100%;
    height: auto;
    background: white;
    transform-origin: center center;
    transition: transform 160ms var(--ease-out);
    user-select: none;
    -webkit-user-drag: none;
  }
</style>

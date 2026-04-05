<script lang="ts">
  export let pages: string[] = [];
  export let title = 'Document';

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
</script>

<div class="image-stack" aria-label={title}>
  {#if pages.length === 0}
    <div class="state">Document preview could not be loaded.</div>
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
  .image-stack {
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

  .state {
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-surface) 94%, black 6%);
  }
</style>

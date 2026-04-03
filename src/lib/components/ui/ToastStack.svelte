<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { toasts, type ToastItem } from '$lib/client/toasts';

  let items: ToastItem[] = [];
  const unsubscribe = toasts.subscribe((value) => {
    items = value;
  });

  $: if (!items.length) {
    // no-op; keeps reactive subscription explicit for Svelte
  }
</script>

<svelte:head>
  <style>
    @media (prefers-reduced-motion: reduce) {
      .toast-stack,
      .toast {
        animation: none !important;
        transition: none !important;
      }
    }
  </style>
</svelte:head>

{#if items.length > 0}
  <div class="toast-stack" aria-live="polite" aria-atomic="true">
    {#each items as item (item.id)}
      <article
        class={`toast toast-${item.tone}`}
        in:fly={{ y: -10, duration: 180 }}
        out:fade={{ duration: 160 }}
      >
        <span>{item.message}</span>
        <button type="button" on:click={() => toasts.remove(item.id)} aria-label="Dismiss notification">
          Close
        </button>
      </article>
    {/each}
  </div>
{/if}

<style>
  .toast-stack {
    position: fixed;
    top: calc(0.95rem + var(--safe-top));
    right: calc(0.95rem + var(--safe-right));
    z-index: 1200;
    display: grid;
    gap: 0.65rem;
    width: min(92vw, 360px);
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.82rem 0.9rem;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 38px rgba(4, 5, 7, 0.26);
    color: var(--color-text);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015)),
      color-mix(in srgb, var(--color-surface) 92%, black 8%);
  }

  .toast-success {
    border-color: rgba(22, 163, 74, 0.28);
    background:
      linear-gradient(180deg, rgba(22, 163, 74, 0.22), rgba(22, 163, 74, 0.08)),
      color-mix(in srgb, var(--color-surface) 92%, black 8%);
  }

  .toast-error {
    border-color: rgba(239, 68, 68, 0.28);
    background:
      linear-gradient(180deg, rgba(120, 12, 18, 0.42), rgba(120, 12, 18, 0.16)),
      color-mix(in srgb, var(--color-surface) 92%, black 8%);
  }

  .toast-info {
    border-color: rgba(195, 32, 43, 0.24);
  }

  .toast span {
    font-size: 0.84rem;
    line-height: 1.4;
  }

  .toast button {
    flex: 0 0 auto;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text);
    padding: 0.22rem 0.5rem;
    cursor: pointer;
    font-size: 0.72rem;
  }

  @media (max-width: 760px) {
    .toast-stack {
      top: auto;
      bottom: calc(0.95rem + var(--safe-bottom));
      right: calc(0.75rem + var(--safe-right));
      left: calc(0.75rem + var(--safe-left));
      width: auto;
    }
  }
</style>

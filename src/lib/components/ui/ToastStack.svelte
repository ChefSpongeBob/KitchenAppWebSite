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
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    box-shadow: none;
    color: var(--color-text);
    background: var(--color-surface);
  }

  .toast-success {
    border-color: color-mix(in srgb, var(--color-success) 62%, var(--color-border));
  }

  .toast-error {
    border-color: color-mix(in srgb, var(--color-error) 62%, var(--color-border));
  }

  .toast-info {
    border-color: var(--color-border);
  }

  .toast span {
    font-size: 0.84rem;
    line-height: 1.4;
  }

  .toast button {
    flex: 0 0 auto;
    border: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
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


<script lang="ts">
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  type ListIndexItem = {
    href: string;
    title: string;
    description?: string | null;
  };

  export let items: ListIndexItem[] = [];
  export let emptyLabel = 'Nothing here yet.';

  function iconFor(item: ListIndexItem) {
    const key = `${item.href} ${item.title}`.toLowerCase();
    if (key.includes('prep')) return 'restaurant';
    if (key.includes('check')) return 'task_alt';
    if (key.includes('order')) return 'shopping_cart';
    if (key.includes('inventory')) return 'inventory_2';
    if (key.includes('schedule')) return 'calendar_month';
    if (key.includes('report') || key.includes('history')) return 'analytics';
    if (key.includes('document') || key.includes('doc')) return 'description';
    if (key.includes('menu')) return 'restaurant_menu';
    return 'arrow_forward';
  }
</script>

{#if items.length === 0}
  <EmptyState title={emptyLabel} compact />
{:else}
  <nav class="list-index" aria-label="List navigation">
    {#each items as item}
      <a href={item.href} class="list-row">
        <span class="row-icon material-icons" aria-hidden="true">{iconFor(item)}</span>
        <span class="row-copy">
          <strong>{item.title}</strong>
          {#if item.description}
            <small>{item.description}</small>
          {/if}
        </span>
        <span class="row-action material-icons" aria-hidden="true">arrow_forward</span>
      </a>
    {/each}
  </nav>
{/if}

<style>
  .list-index {
    display: grid;
    grid-template-columns: repeat(2, minmax(14rem, 1fr));
    gap: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .list-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    min-height: 4.7rem;
    padding: 0.95rem 1rem;
    border: 0;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    text-decoration: none;
    transition:
      border-color 140ms var(--ease-out),
      color 140ms var(--ease-out);
  }

  .list-row:nth-child(even) {
    border-right: 0;
  }

  .list-row:nth-last-child(-n + 2) {
    border-bottom: 0;
  }

  .list-row:hover,
  .list-row:focus {
    outline: none;
    background: color-mix(in srgb, var(--color-surface-alt) 42%, transparent);
    color: var(--color-text);
  }

  .list-row:focus-visible {
    outline: 1px solid color-mix(in srgb, var(--color-text) 44%, transparent);
    outline-offset: 4px;
  }

  .row-copy {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .row-copy strong {
    font-size: 0.94rem;
    font-weight: var(--weight-semibold);
  }

  .row-copy small {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .row-icon,
  .row-action {
    color: var(--color-text-muted);
    font-size: 1.2rem;
    line-height: 1;
  }

  .row-action {
    font-size: 1rem;
    opacity: 0.72;
  }

  @media (max-width: 640px) {
    .list-index {
      grid-template-columns: 1fr;
    }

    .list-row {
      border-right: 0;
    }

    .list-row:nth-last-child(-n + 2) {
      border-bottom: 1px solid var(--color-divider);
    }

    .list-row:last-child {
      border-bottom: 0;
    }
  }
</style>

<script lang="ts">
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  type ListIndexItem = {
    href: string;
    title: string;
    description?: string | null;
  };

  export let items: ListIndexItem[] = [];
  export let emptyLabel = 'Nothing here yet.';
</script>

{#if items.length === 0}
  <EmptyState title={emptyLabel} compact />
{:else}
  <nav class="list-index" aria-label="List navigation">
    {#each items as item}
      <a href={item.href} class="list-row">
        <span class="row-copy">
          <strong>{item.title}</strong>
          {#if item.description}
            <small>{item.description}</small>
          {/if}
        </span>
        <span class="row-action">Open</span>
      </a>
    {/each}
  </nav>
{/if}

<style>
  .list-index {
    display: grid;
    gap: 0.55rem;
  }

  .list-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    min-height: 3.35rem;
    padding: 0.78rem 0.9rem;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-surface) 94%, transparent);
    color: var(--color-text);
    text-decoration: none;
    transition:
      border-color 140ms var(--ease-out),
      background 140ms var(--ease-out),
      transform 140ms var(--ease-out);
  }

  .list-row:hover,
  .list-row:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border));
    background: color-mix(in srgb, var(--color-surface-alt) 46%, transparent);
    transform: translateY(-1px);
  }

  .list-row:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-primary) 72%, transparent);
    outline-offset: 3px;
  }

  .row-copy {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .row-copy strong {
    font-size: 0.94rem;
    font-weight: var(--weight-medium);
  }

  .row-copy small {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .row-action {
    flex: 0 0 auto;
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }
  @media (max-width: 640px) {
    .list-row {
      align-items: start;
      flex-direction: column;
      gap: 0.45rem;
    }
  }
</style>

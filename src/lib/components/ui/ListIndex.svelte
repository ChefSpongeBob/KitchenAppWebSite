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
      </a>
    {/each}
  </nav>
{/if}

<style>
  .list-index {
    display: grid;
    gap: 0;
    border-top: 1px solid var(--color-divider);
  }

  .list-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    min-height: 3.2rem;
    padding: 0.8rem 0;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    text-decoration: none;
    transition:
      border-color 140ms var(--ease-out),
      color 140ms var(--ease-out);
  }

  .list-row:hover,
  .list-row:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--color-text) 36%, var(--color-divider));
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

  @media (max-width: 640px) {
    .list-row {
      align-items: start;
      flex-direction: column;
      gap: 0.45rem;
    }
  }
</style>

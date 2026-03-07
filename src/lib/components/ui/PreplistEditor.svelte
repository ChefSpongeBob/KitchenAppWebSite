<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  type PreplistItem = {
    id: string;
    content: string;
    amount: number;
    par_count: number;
    is_checked: number;
  };

  export let title = 'Prep List';
  export let items: PreplistItem[] = [];
  export let isAdmin = false;
</script>

<Layout>
  <PageHeader title={title} subtitle="Users update prep amount and complete items. Admins can edit item names and par counts." />

  {#if items.length === 0}
    <p class="empty">No prep items found yet.</p>
  {:else}
    <section class="sheet">
      <div class="sheet-header">
        <span>Done</span>
        <span>Item</span>
        <span>Prep</span>
        <span>Par</span>
      </div>

      {#each items as item}
        <div class="sheet-row" class:done={item.is_checked === 1}>
          <form method="POST" action="?/toggle_checked" class="done-form">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="is_checked" value={item.is_checked === 1 ? 0 : 1} />
            <button type="submit" class="check-btn" aria-label={`Toggle ${item.content} complete`}>
              {#if item.is_checked === 1}✓{:else}○{/if}
            </button>
          </form>

          {#if isAdmin}
            <form method="POST" action="?/update_content" class="item-form">
              <input type="hidden" name="id" value={item.id} />
              <input
                id={`content-${item.id}`}
                name="content"
                type="text"
                value={item.content}
                required
                class="text-input"
              />
              <button type="submit" class="mini-btn">Save</button>
            </form>
          {:else}
            <div class="item-cell">{item.content}</div>
          {/if}

          <form method="POST" action="?/update_amount" class="number-form">
            <input type="hidden" name="id" value={item.id} />
            <input
              id={`amount-${item.id}`}
              name="amount"
              type="number"
              min="0"
              step="0.1"
              value={item.amount}
              required
              class="number-input"
              class:green={item.is_checked === 1}
            />
            <button type="submit" class="mini-btn">Save</button>
          </form>

          {#if isAdmin}
            <form method="POST" action="?/update_par" class="number-form">
              <input type="hidden" name="id" value={item.id} />
              <input
                id={`par-${item.id}`}
                name="par_count"
                type="number"
                min="0"
                step="0.1"
                value={item.par_count}
                required
                class="number-input"
              />
              <button type="submit" class="mini-btn">Save</button>
            </form>
          {:else}
            <div class="par-readonly">{item.par_count}</div>
          {/if}
        </div>
      {/each}
    </section>
  {/if}
</Layout>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .sheet-header,
  .sheet-row {
    display: grid;
    grid-template-columns: 58px minmax(180px, 1.7fr) minmax(140px, 1fr) minmax(120px, 0.9fr);
    gap: 0.65rem;
    align-items: center;
  }

  .sheet-header {
    padding: 0.25rem 0.45rem;
    font-size: 0.78rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .sheet-row {
    padding: 0.5rem;
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-surface) 94%, white 6%);
    transition: background 140ms ease;
  }

  .sheet-row.done {
    background: color-mix(in srgb, #16a34a 17%, var(--color-surface) 83%);
  }

  .done-form,
  .item-form,
  .number-form {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .check-btn {
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-alt);
    color: var(--color-text);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }

  .item-cell {
    font-size: 0.95rem;
    color: var(--color-text);
  }

  .text-input,
  .number-input {
    width: 100%;
    min-width: 0;
    padding: 0.42rem 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  .number-input.green {
    border-color: #16a34a;
    box-shadow: inset 0 0 0 1px #16a34a55;
  }

  .mini-btn {
    width: fit-content;
    padding: 0.35rem 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-alt);
    color: var(--color-text);
    cursor: pointer;
    font-size: 0.8rem;
  }

  .par-readonly {
    font-size: 0.95rem;
    color: var(--color-text);
    padding: 0.25rem 0.35rem;
  }

  .empty {
    padding: 1rem;
    color: var(--color-text-muted);
  }

  @media (max-width: 760px) {
    .sheet-header {
      display: none;
    }

    .sheet-row {
      grid-template-columns: 50px 1fr;
      gap: 0.5rem;
    }

    .number-form,
    .item-form,
    .par-readonly {
      grid-column: 2 / -1;
    }
  }
</style>

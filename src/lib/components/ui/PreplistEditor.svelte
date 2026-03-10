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

  const isDone = (item: PreplistItem) => Number(item.is_checked) === 1;
</script>

<Layout>
  <PageHeader title={title} subtitle="Submit prep counts together. Admins can adjust par levels in admin tools." />

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

      <form id="prep-batch-form" method="POST" action="?/submit_prep_counts" class="batch-form">
        {#each items as item}
          <div class="sheet-row" class:done={isDone(item)}>
            <button
              type="submit"
              class="check-btn"
              aria-label={`Toggle ${item.content} complete`}
              form="prep-batch-form"
              formaction="?/toggle_checked"
              formmethod="POST"
              formnovalidate
              name="id"
              value={item.id}
            >
              {#if isDone(item)}X{:else}O{/if}
            </button>
            <input type="hidden" name={`is_checked_${item.id}`} value={isDone(item) ? 0 : 1} />

            <div class="item-cell">{item.content}</div>

            <div class="number-form">
              <span class="field-tag">PREP:</span>
              <input
                id={`amount-${item.id}`}
                name={`amount_${item.id}`}
                type="number"
                min="0"
                step="1"
                value={item.amount}
                required
                class="number-input"
              />
            </div>

            <div class="par-readonly">
              <span class="field-tag">PAR:</span>
              <span>{item.par_count}</span>
            </div>
          </div>
        {/each}
        <div class="actions-row">
          <button type="submit" class="submit-btn">Submit Prep Counts</button>
        </div>
      </form>

        <div class="actions-row reset-row">
          <form method="POST" action="?/new_prep_list">
            <button type="submit" class="submit-btn subtle-btn">New Prep List (Reset to 0)</button>
          </form>
        </div>

      {#if isAdmin}
        <details class="admin-par">
          <summary>+ Admin Par Levels</summary>
          <form method="POST" action="?/save_par_levels" class="admin-par-form">
            {#each items as item}
              <label class="par-edit-row" for={`par-${item.id}`}>
                <span>{item.content}</span>
                <div class="number-form">
                  <span class="field-tag">PAR:</span>
                  <input
                    id={`par-${item.id}`}
                    name={`par_${item.id}`}
                    type="number"
                    min="0"
                    step="1"
                    value={item.par_count}
                    required
                    class="number-input"
                  />
                </div>
              </label>
            {/each}
            <button type="submit" class="mini-btn subtle">Save Par Levels</button>
          </form>
        </details>
      {/if}
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

  .batch-form {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
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

  .number-input {
    width: 100%;
    min-width: 0;
    padding: 0.42rem 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  .actions-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .reset-row {
    margin-top: 0.5rem;
  }

  .submit-btn {
    padding: 0.55rem 0.8rem;
    border-radius: 9px;
    border: 1px solid var(--color-border);
    background: var(--color-surface-alt);
    color: var(--color-text);
    cursor: pointer;
    font-size: 0.88rem;
    font-weight: 600;
  }

  .subtle-btn {
    opacity: 0.88;
  }

  .admin-par {
    margin-top: 0.55rem;
  }

  .admin-par summary {
    cursor: pointer;
    width: fit-content;
    padding: 0.2rem 0.45rem;
    border: 1px dashed var(--color-border);
    border-radius: 8px;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .admin-par-form {
    margin-top: 0.55rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .par-edit-row {
    display: grid;
    grid-template-columns: 1fr minmax(100px, 140px);
    gap: 0.5rem;
    align-items: center;
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

  .subtle {
    opacity: 0.85;
  }

  .par-readonly {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.95rem;
    color: var(--color-text);
    padding: 0.25rem 0.35rem;
  }

  .field-tag {
    font-size: 0.72rem;
    letter-spacing: 0.03em;
    color: var(--color-text-muted);
    white-space: nowrap;
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
    .par-readonly {
      grid-column: 2 / -1;
    }
  }
</style>


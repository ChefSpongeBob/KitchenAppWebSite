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
  export let subtitle = 'Submit prep counts together. Admins can adjust par levels in admin tools.';
  export let items: PreplistItem[] = [];
  export let isAdmin = false;
  export let valueLabel = 'Prep';
  export let submitLabel = 'Submit Prep Counts';
  export let resetLabel = 'New Prep List (Reset to 0)';
  export let adminSummaryLabel = '+ Admin Par Levels';

  const isDone = (item: PreplistItem) => Number(item.is_checked) === 1;
</script>

<Layout>
  <PageHeader {title} {subtitle} />

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
              <span class="field-tag">{valueLabel.toUpperCase()}:</span>
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
          <button type="submit" class="submit-btn">{submitLabel}</button>
        </div>
      </form>

        <div class="actions-row reset-row">
          <form method="POST" action="?/new_prep_list">
            <button type="submit" class="submit-btn subtle-btn">{resetLabel}</button>
          </form>
        </div>

      {#if isAdmin}
        <details class="admin-par">
          <summary>{adminSummaryLabel}</summary>
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
    gap: 0.75rem;
    padding: 0.25rem 0 0.15rem;
  }

  .sheet-header,
  .sheet-row {
    display: grid;
    grid-template-columns: 58px minmax(180px, 1.7fr) minmax(140px, 1fr) minmax(120px, 0.9fr);
    gap: 0.65rem;
    align-items: center;
  }

  .sheet-header {
    padding: 0.2rem 0.8rem;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .batch-form {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .sheet-row {
    position: relative;
    padding: 0.78rem 0.8rem;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255,255,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008) 42%, rgba(255,255,255,0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.14);
    transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  }

  .sheet-row::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.88), rgba(195, 32, 43, 0.2));
  }

  .sheet-row.done {
    border-color: rgba(22, 163, 74, 0.2);
    background:
      linear-gradient(180deg, rgba(22, 163, 74, 0.12), rgba(22, 163, 74, 0.03)),
      color-mix(in srgb, var(--color-surface) 92%, black 8%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.16);
  }

  .sheet-row.done::before {
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.92), rgba(22, 163, 74, 0.2));
  }

  .number-form {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .check-btn {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.08);
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-primary-contrast);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    font-weight: var(--weight-semibold);
  }

  .item-cell {
    font-size: 0.95rem;
    color: var(--color-text);
    font-weight: var(--weight-medium);
  }

  .number-input {
    width: 100%;
    min-width: 0;
    padding: 0.5rem 0.58rem;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.08);
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
  }

  .actions-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }

  .reset-row {
    margin-top: 0.5rem;
  }

  .submit-btn {
    padding: 0.68rem 0.95rem;
    border-radius: 10px;
    border: 1px solid rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    cursor: pointer;
    font-size: 0.84rem;
    font-weight: var(--weight-semibold);
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
    padding: 0.28rem 0.55rem;
    border: 1px dashed rgba(195, 32, 43, 0.24);
    border-radius: 10px;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    background: rgba(255,255,255,0.018);
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
    padding: 0.46rem 0.62rem;
    border-radius: 10px;
    border: 1px solid rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.18), rgba(195, 32, 43, 0.06));
    color: var(--color-primary-contrast);
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
    padding: 0.3rem 0.4rem;
    border-radius: 10px;
    background: rgba(255,255,255,0.02);
  }

  .field-tag {
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .empty {
    padding: 1rem 0.1rem;
    color: var(--color-text-muted);
  }

  @media (max-width: 760px) {
    .sheet-header {
      display: none;
    }

    .sheet-row {
      grid-template-columns: 50px 1fr;
      gap: 0.65rem;
      padding: 0.8rem 0.75rem;
    }

    .number-form,
    .par-readonly {
      grid-column: 2 / -1;
    }
  }
</style>


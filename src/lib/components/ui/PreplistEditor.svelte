<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type PreplistItem = {
    id: string;
    content: string;
    details?: string | null;
    amount: number;
    amount_text?: string | null;
    par_count: number;
    is_checked: number;
  };

  export let title = 'Prep List';
  export let items: PreplistItem[] = [];
  export let isAdmin = false;
  export let valueLabel = 'Prep';
  export let submitLabel = 'Submit Prep Counts';
  export let resetLabel = 'New Prep List (Reset to 0)';
  export let adminSummaryLabel = '+ Admin Par Levels';
  export let valueType: 'number' | 'text' = 'number';

  const isDone = (item: PreplistItem) => Number(item.is_checked) === 1;

  let amountDrafts: Record<string, string> = {};
  let syncedDraftKey = '';

  $: {
    const nextKey = items
      .map((item) =>
        valueType === 'text'
          ? `${item.id}:${item.amount_text ?? ''}`
          : `${item.id}:${item.amount}`
      )
      .join('|');

    if (nextKey !== syncedDraftKey) {
      amountDrafts = Object.fromEntries(
        items.map((item) => [
          item.id,
          valueType === 'text' ? (item.amount_text ?? '') : String(item.amount ?? 0)
        ])
      );
      syncedDraftKey = nextKey;
    }
  }

  function updateAmount(id: string, value: string) {
    amountDrafts = {
      ...amountDrafts,
      [id]: value
    };
  }

  const withPrepFeedback =
    (successMessage: string, errorMessage: string): SubmitFunction =>
    () => {
      return async ({ result }) => {
        await applyAction(result);
        if (result.type === 'success') {
          await invalidateAll();
          pushToast(successMessage, 'success');
        } else if (result.type === 'failure') {
          pushToast(result.data?.error ?? errorMessage, 'error');
        }
      };
    };
</script>

<Layout>
  <PageHeader {title} />

  {#if items.length === 0}
    <p class="empty">No prep items found yet.</p>
  {:else}
    <section class="sheet">
      <div class="sheet-header">
        <span>Done</span>
        <span>Item</span>
        <span>Prep</span>
        <span>Ref</span>
        <span>Par</span>
      </div>

      <form
        id="prep-batch-form"
        method="POST"
        action="?/submit_prep_counts"
        use:enhance={withPrepFeedback('Prep list saved.', 'That prep change could not be saved.')}
        class="batch-form"
      >
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
                type={valueType === 'text' ? 'text' : 'number'}
                min={valueType === 'text' ? undefined : '0'}
                step={valueType === 'text' ? undefined : '0.1'}
                bind:value={amountDrafts[item.id]}
                on:input={(event) => updateAmount(item.id, (event.currentTarget as HTMLInputElement).value)}
                required
                class="number-input"
              />
            </div>

            <div class="ref-readonly">
              <span class="field-tag">REF:</span>
              <span>{item.details?.trim() || '-'}</span>
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
        <form
          method="POST"
          action="?/new_prep_list"
          use:enhance={withPrepFeedback('Prep list reset.', 'That prep list could not be reset.')}
        >
          <button type="submit" class="submit-btn subtle-btn">{resetLabel}</button>
        </form>
      </div>

      {#if isAdmin}
        <details class="admin-par">
          <summary>{adminSummaryLabel.replace(/^\+\s*/, '')}</summary>
          <form
            method="POST"
            action="?/save_par_levels"
            use:enhance={withPrepFeedback('Par levels saved.', 'Those par levels could not be saved.')}
            class="admin-par-form"
          >
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
                    step="0.1"
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
    padding: 0;
  }

  .sheet-header,
  .sheet-row {
    display: grid;
    grid-template-columns:
      58px
      minmax(180px, 1.6fr)
      minmax(140px, 1fr)
      minmax(130px, 1fr)
      minmax(120px, 0.9fr);
    gap: 0.65rem;
    align-items: center;
  }

  .sheet-header {
    padding: 0.1rem 0.65rem;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .batch-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sheet-row {
    position: relative;
    padding: 0.68rem 0.72rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-divider);
    background: color-mix(in srgb, var(--color-surface) 94%, transparent);
    box-shadow: none;
    transition: background 140ms ease, border-color 140ms ease;
  }

  .sheet-row::before {
    content: none;
  }

  .sheet-row.done {
    border-color: color-mix(in srgb, #16a34a 34%, var(--color-border));
    background: color-mix(in srgb, #16a34a 10%, var(--color-surface));
  }

  .sheet-row.done::before {
    content: none;
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
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface-alt) 72%, transparent);
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
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface-alt) 72%, transparent);
    color: var(--color-text);
  }

  .actions-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.2rem;
    flex-wrap: wrap;
  }

  .reset-row {
    margin-top: 0.5rem;
  }

  .submit-btn {
    min-height: 2.45rem;
    padding: 0.6rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface-alt) 72%, transparent);
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
    padding: 0.34rem 0.65rem;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    background: transparent;
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
    min-height: 2.35rem;
    padding: 0.55rem 0.72rem;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface-alt) 64%, transparent);
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
    border: 1px solid var(--color-divider);
    background: transparent;
  }

  .ref-readonly {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2.3rem;
    font-size: 0.88rem;
    color: var(--color-text);
    padding: 0.3rem 0.45rem;
    border-radius: 10px;
    border: 1px solid var(--color-divider);
    background: transparent;
    overflow: hidden;
  }

  .ref-readonly span:last-child,
  .par-readonly span:last-child {
    min-width: 0;
    overflow-wrap: anywhere;
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
    .ref-readonly,
    .par-readonly {
      grid-column: 2 / -1;
    }

    .actions-row > * {
      width: 100%;
    }

    .actions-row button,
    .actions-row .submit-btn {
      width: 100%;
    }
  }
</style>



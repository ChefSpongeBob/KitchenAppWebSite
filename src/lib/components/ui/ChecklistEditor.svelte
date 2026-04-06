<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type ChecklistItem = {
    id: string;
    content: string;
    is_checked: number;
  };

  export let title = 'Checklist';
  export let subtitle = 'Work through the checklist and reset when needed.';
  export let resetLabel = 'Reset Checklist';
  export let items: ChecklistItem[] = [];
  export let infoCardTitle = '';
  export let infoCardIntro = '';
  export let infoCardSections: Array<{ title: string; lines: string[] }> = [];

  const isDone = (item: ChecklistItem) => Number(item.is_checked) === 1;

  const withChecklistFeedback =
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
  <PageHeader {title} {subtitle} />

  {#if items.length === 0}
    <p class="empty">No checklist items found yet.</p>
  {:else}
    <section class="sheet">
      <div class="sheet-header">
        <span>Done</span>
        <span>Item</span>
      </div>

      <div class="sheet-list">
        {#each items as item}
          <div class="sheet-row" class:done={isDone(item)}>
            <form
              method="POST"
              action="?/toggle_checked"
              use:enhance={withChecklistFeedback('Checklist updated.', 'That checklist change could not be saved.')}
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name={`is_checked_${item.id}`} value={isDone(item) ? 0 : 1} />
              <button
                type="submit"
                class="check-btn"
                aria-label={`Toggle ${item.content} complete`}
              >
                {#if isDone(item)}X{:else}O{/if}
              </button>
            </form>

            <div class="item-cell">
              <strong>{item.content}</strong>
              <small>{#if isDone(item)}Complete{:else}Incomplete{/if}</small>
            </div>
          </div>
        {/each}
      </div>

      <div class="actions-row">
        <form
          method="POST"
          action="?/reset_checklist"
          use:enhance={withChecklistFeedback('Checklist reset.', 'That checklist could not be reset.')}
        >
          <button type="submit" class="submit-btn subtle-btn">{resetLabel}</button>
        </form>
      </div>
    </section>
  {/if}

  {#if infoCardTitle && infoCardSections.length > 0}
    <section class="info-card">
      <div class="info-head">
        <h2>{infoCardTitle}</h2>
        {#if infoCardIntro}
          <p>{infoCardIntro}</p>
        {/if}
      </div>

      <div class="info-grid">
        {#each infoCardSections as section}
          <article class="info-day">
            <strong>{section.title}</strong>
            {#if section.lines.length === 0}
              <p>None</p>
            {:else}
              <ul>
                {#each section.lines as line}
                  <li>{line}</li>
                {/each}
              </ul>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  {/if}
</Layout>

<style>
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    padding-top: 0.25rem;
  }

  .sheet-header,
  .sheet-row {
    display: grid;
    grid-template-columns: 58px minmax(220px, 1fr);
    gap: 0.7rem;
    align-items: center;
  }

  .sheet-header {
    padding: 0.2rem 0.8rem;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .sheet-list {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .sheet-row {
    position: relative;
    padding: 0.82rem 0.8rem;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255,255,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008) 42%, rgba(255,255,255,0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.14);
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
  }

  .sheet-row.done::before {
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.92), rgba(22, 163, 74, 0.2));
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
    display: grid;
    gap: 0.18rem;
  }

  .item-cell strong {
    font-size: 0.98rem;
    color: var(--color-text);
    font-weight: var(--weight-medium);
  }

  .item-cell small {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .actions-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.4rem;
    flex-wrap: wrap;
  }

  .submit-btn {
    min-height: 2.75rem;
    padding: 0.72rem 1rem;
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

  .empty {
    padding: 1rem 0.1rem;
    color: var(--color-text-muted);
  }

  .info-card {
    margin-top: 1.35rem;
    padding: 1rem;
    border-radius: var(--radius-lg);
    border: 1px solid rgba(255,255,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008) 42%, rgba(255,255,255,0)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.14);
  }

  .info-head {
    display: grid;
    gap: 0.2rem;
    margin-bottom: 0.8rem;
  }

  .info-head h2 {
    margin: 0;
    font-size: 1rem;
  }

  .info-head p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .info-grid {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .info-day {
    padding: 0.8rem 0.85rem;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.025);
    display: grid;
    gap: 0.45rem;
  }

  .info-day strong {
    color: var(--color-text);
    font-size: 0.9rem;
  }

  .info-day p,
  .info-day ul {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .info-day ul {
    padding-left: 1rem;
    display: grid;
    gap: 0.3rem;
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

    .actions-row,
    .actions-row form,
    .actions-row button {
      width: 100%;
    }

    .info-card {
      padding: 0.9rem;
    }
  }
</style>

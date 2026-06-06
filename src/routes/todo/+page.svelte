<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type Todo = {
    id: string;
    title: string;
    description: string | null;
    completed_at?: number | null;
    display_name?: string | null;
    assigned_name?: string | null;
    assigned_email?: string | null;
  };

  export let data: {
    user?: { role?: string };
    active?: Todo[];
    completed?: Todo[];
  };

  let activeTab: 'active' | 'completed' = 'active';
  let expandedId: string | null = null;

  const activeTodos: Todo[] = data.active ?? [];
  const completedTodos: Todo[] = data.completed ?? [];

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function expandedText(todo: Todo, includeCompletedBy = false) {
    const description = todo.description?.trim() || '';
    const assigned = todo.assigned_name ?? todo.assigned_email ?? 'Anyone';
    const completedBy = includeCompletedBy ? `\nCompleted by: ${todo.display_name ?? 'Unknown'}` : '';
    const completedAt = includeCompletedBy && todo.completed_at
      ? `\nCompleted at: ${new Date(todo.completed_at * 1000).toLocaleString()}`
      : '';
    return `${description}\n\nAssigned to: ${assigned}${completedBy}${completedAt}`;
  }

  const withTodoFeedback = (message: string): SubmitFunction => () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(message, 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That todo could not be updated.', 'error');
      }
    };
  };
</script>

<Layout>
  <PageHeader title="To Do" />

  <div class="tabs" role="tablist">
    <button role="tab" aria-selected={activeTab === 'active'} class:active={activeTab === 'active'} on:click={() => (activeTab = 'active')}>
      Active
    </button>
    <button role="tab" aria-selected={activeTab === 'completed'} class:active={activeTab === 'completed'} on:click={() => (activeTab = 'completed')}>
      Completed
    </button>
  </div>

  {#if activeTab === 'active'}
    <div class="card-list" role="region" aria-label="Active Tasks">
      {#each activeTodos as todo (todo.id)}
        <div class="card-wrapper">
          <button
            class="card-hit"
            type="button"
            aria-expanded={expandedId === todo.id}
            on:click={() => toggleExpand(todo.id)}
          >
            <span>
              <strong>{todo.title}</strong>
              <small>Assigned to {todo.assigned_name ?? todo.assigned_email ?? 'Anyone'}</small>
            </span>
            {#if expandedId === todo.id && expandedText(todo)}
              <p>{expandedText(todo)}</p>
            {/if}
          </button>
          <form method="POST" action="?/complete" use:enhance={withTodoFeedback('Todo completed.')}>
            <input type="hidden" name="id" value={todo.id} />
            <button class="todo-action complete-button" type="submit">Complete</button>
          </form>
        </div>
      {/each}
      {#if activeTodos.length === 0}
        <p class="empty-state">No active tasks.</p>
      {/if}
    </div>
  {/if}

  {#if activeTab === 'completed'}
    <div class="card-list" role="region" aria-label="Completed Tasks">
      {#each completedTodos as todo (todo.id)}
        <div class="card-wrapper">
          <button class="card-hit" type="button" aria-expanded={expandedId === todo.id} on:click={() => toggleExpand(todo.id)}>
            <span>
              <strong>{todo.title}</strong>
              <small>{todo.completed_at ? new Date(todo.completed_at * 1000).toLocaleString() : 'Completed'}</small>
            </span>
            {#if expandedId === todo.id}
              <p>{expandedText(todo, true)}</p>
            {/if}
          </button>
          <form method="POST" action="?/reopen" use:enhance={withTodoFeedback('Todo reopened.')}>
            <input type="hidden" name="id" value={todo.id} />
            <button class="todo-action" type="submit">Reopen</button>
          </form>
        </div>
      {/each}
      {#if completedTodos.length === 0}
        <p class="empty-state">No completed tasks.</p>
      {/if}
    </div>
  {/if}
</Layout>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0 0 0.9rem;
  }

  .tabs button {
    flex: 1;
    padding: 0.68rem;
    border-radius: var(--radius-sm);
    border: var(--surface-outline);
    background: var(--surface-wash), var(--color-surface);
    color: var(--color-text-muted);
    font-weight: var(--weight-semibold);
    cursor: pointer;
    transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
  }

  .tabs button.active {
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
    color: var(--color-text);
    border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border) 45%);
  }

  .card-list {
    display: grid;
    gap: 0.65rem;
    padding-bottom: 6rem;
  }

  .card-wrapper {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.7rem;
    align-items: start;
    padding: 0.82rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .card-wrapper:first-child {
    border-top: 0;
  }

  .card-hit {
    display: grid;
    gap: 0.35rem;
    width: 100%;
    text-align: left;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: var(--color-text);
  }

  .card-hit span {
    display: grid;
    gap: 0.16rem;
  }

  .card-hit strong {
    font-size: 1rem;
  }

  .card-hit small {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .card-hit p {
    margin: 0.25rem 0 0;
    color: var(--color-text-soft);
    white-space: pre-line;
  }

  .todo-action {
    align-self: flex-start;
    background: transparent;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-text) 34%, var(--color-border) 66%);
    color: var(--color-text);
    font-size: 0.74rem;
    font-weight: var(--weight-semibold);
    padding: 0.34rem 0.15rem;
    border-radius: 0;
    cursor: pointer;
    width: auto;
  }

  .complete-button {
    border-bottom-color: color-mix(in srgb, var(--color-success) 52%, var(--color-border) 48%);
  }

  .empty-state {
    margin: 0;
    padding: 0.9rem 0;
    border-top: 1px solid var(--color-divider);
    color: var(--color-text-muted);
  }

  @media (max-width: 760px) {
    .tabs {
      padding-bottom: 0.75rem;
    }

    .tabs button {
      padding: 0.54rem;
      font-size: 0.86rem;
    }

    .card-list {
      gap: 0.75rem;
      padding-bottom: 5.25rem;
    }

    .card-wrapper {
      grid-template-columns: 1fr;
    }

    .todo-action {
      width: 100%;
    }
  }
</style>


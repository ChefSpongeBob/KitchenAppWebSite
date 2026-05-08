<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
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
    const description = todo.description?.trim() || 'No description provided.';
    const assigned = todo.assigned_name ?? todo.assigned_email ?? 'Anyone';
    const completedBy = includeCompletedBy ? `\nCompleted by: ${todo.display_name ?? 'Unknown'}` : '';
    const completedAt = includeCompletedBy && todo.completed_at
      ? `\nCompleted at: ${new Date(todo.completed_at * 1000).toLocaleString()}`
      : '';
    return `${description}\n\nAssigned to: ${assigned}${completedBy}${completedAt}`;
  }

  const withTodoFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Todo completed.', 'success');
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
            <DashboardCard
              title={todo.title}
              description={expandedId === todo.id ? expandedText(todo) : ''}
            />
          </button>
          <form method="POST" action="?/complete" use:enhance={withTodoFeedback}>
            <input type="hidden" name="id" value={todo.id} />
            <button class="complete-button" type="submit">Complete</button>
          </form>
        </div>
      {/each}
    </div>
  {/if}

  {#if activeTab === 'completed'}
    <div class="card-list" role="region" aria-label="Completed Tasks">
      {#each completedTodos as todo (todo.id)}
        <button class="card-hit" type="button" aria-expanded={expandedId === todo.id} on:click={() => toggleExpand(todo.id)}>
          <DashboardCard
            title={todo.title}
            description={expandedId === todo.id ? expandedText(todo, true) : ''}
          />
        </button>
      {/each}
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
    border-radius: var(--radius-md);
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

  .card-list { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 6rem; }
  .card-wrapper { display: flex; flex-direction: column; gap: 4px; }

  .card-hit {
    text-align: left;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }

  .complete-button {
    align-self: flex-start;
    background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-success) 42%, var(--color-border) 58%);
    color: var(--color-text);
    font-size: 0.74rem;
    font-weight: var(--weight-semibold);
    padding: 0.34rem 0.7rem;
    border-radius: 999px;
    cursor: pointer;
    width: auto;
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
  }
</style>


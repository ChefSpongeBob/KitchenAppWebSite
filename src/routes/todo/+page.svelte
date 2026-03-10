<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  type Todo = {
    id: string;
    title: string;
    description: string | null;
    completed_at?: number | null;
    assigned_to?: string | null;
    display_name?: string | null;
    assigned_name?: string | null;
    assigned_email?: string | null;
  };

  type UserOption = {
    id: string;
    display_name: string | null;
    email: string;
  };

  export let data: {
    user?: { role?: string };
    active?: Todo[];
    completed?: Todo[];
    users?: UserOption[];
    canManageAssignments?: boolean;
  };

  let activeTab: 'active' | 'completed' = 'active';
  let expandedId: string | null = null;
  const canManageAssignments = Boolean(data.canManageAssignments);

  const activeTodos: Todo[] = data.active ?? [];
  const completedTodos: Todo[] = data.completed ?? [];
  const users: UserOption[] = data.users ?? [];

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
</script>

<Layout>
  <PageHeader title="To Do" />

  {#if canManageAssignments}
    <section class="create-panel">
      <form method="POST" action="?/create" class="create-form">
        <input name="title" placeholder="Task title" required />
        <input name="description" placeholder="Description" />
        <select name="assigned_to">
          <option value="">Assign to: Anyone</option>
          {#each users as user}
            <option value={user.id}>{user.display_name ?? user.email}</option>
          {/each}
        </select>
        <button type="submit">Add Task</button>
      </form>
    </section>
  {/if}

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
          {#if canManageAssignments}
            <form method="POST" action="?/assign" class="assign-form">
              <input type="hidden" name="id" value={todo.id} />
              <select name="assigned_to">
                <option value="" selected={!todo.assigned_to}>Anyone</option>
                {#each users as user}
                  <option value={user.id} selected={todo.assigned_to === user.id}>{user.display_name ?? user.email}</option>
                {/each}
              </select>
              <button type="submit" class="assign-button">Save Assignee</button>
            </form>
          {/if}
          <form method="POST" action="?/complete">
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
  .tabs { display: flex; gap: 0.5rem; padding: 0 0 0.9rem; }
  .tabs button { flex: 1; padding: 0.6rem; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-muted); }
  .tabs button.active { background: color-mix(in srgb, #16a34a 20%, var(--color-surface) 80%); color: var(--color-text); border-color: color-mix(in srgb, #16a34a 55%, var(--color-border) 45%); }
  .card-list { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 6rem; }
  .card-wrapper { display: flex; flex-direction: column; gap: 4px; }
  .create-panel { margin-bottom: 0.9rem; }
  .create-form { display: grid; grid-template-columns: 1.6fr 1.6fr 1fr auto; gap: 0.45rem; align-items: center; }
  .create-form input, .create-form select { border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text); padding: 0.5rem 0.6rem; }
  .create-form button { border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-alt); color: var(--color-text); padding: 0.5rem 0.65rem; cursor: pointer; }
  .card-hit { text-align: left; border: none; background: transparent; padding: 0; }
  .assign-form { display: flex; gap: 0.4rem; align-items: center; }
  .assign-form select { border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text); padding: 0.25rem 0.45rem; font-size: 0.72rem; }
  .assign-button { border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-text); font-size: 0.72rem; padding: 0.28rem 0.56rem; cursor: pointer; }
  .complete-button { background: rgba(13, 168, 39, 0.33); border: 1px solid rgba(7, 201, 33, 0.95); color: var(--color-text); font-size: 0.72rem; padding: 0.28rem 0.56rem; border-radius: 999px; cursor: pointer; width: auto; }

  @media (max-width: 760px) {
    .create-form {
      grid-template-columns: 1fr;
    }

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

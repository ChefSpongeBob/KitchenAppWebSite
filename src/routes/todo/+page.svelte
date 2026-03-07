<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  type Todo = {
    id: string;
    title: string;
    description: string;
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
              description={expandedId === todo.id
                ? `${todo.description}\n\nAssigned to: ${todo.assigned_name ?? todo.assigned_email ?? 'Anyone'}`
                : ''}
            />
          </button>
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
            description={expandedId === todo.id
              ? `${todo.description}\n\nAssigned to: ${todo.assigned_name ?? todo.assigned_email ?? 'Anyone'}\nCompleted by: ${todo.display_name ?? 'Unknown'}`
              : ''}
          />
        </button>
      {/each}
    </div>
  {/if}
</Layout>

<style>
  .tabs { display: flex; gap: 0.5rem; padding: 0 1rem 1rem; }
  .tabs button { flex: 1; padding: 0.6rem; border-radius: 10px; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); }
  .tabs button.active { background: rgba(235, 24, 24, 0.15); color: var(--text-primary); border-color: rgba(0, 0, 0, 0.35); }
  .card-list { display: flex; flex-direction: column; gap: 1rem; padding-bottom: 6rem; }
  .card-wrapper { display: flex; flex-direction: column; gap: 4px; }
  .card-hit { text-align: left; border: none; background: transparent; padding: 0; }
  .complete-button { background: rgba(13, 168, 39, 0.33); border: 1px solid rgba(7, 201, 33, 0.95); color: var(--accent-purple); font-size: 0.65rem; padding: 0.2rem 0.5rem; border-radius: 999px; cursor: pointer; width: auto; }
</style>

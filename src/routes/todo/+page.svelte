<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  let activeTab = 'active';
  let expandedId = null;

  let todos = [
    { id: 1, title: 'Prep Veg Station', description: 'Wash, cut, and portion all veg for dinner service.', completed: false },
    { id: 2, title: 'Check Walk-in Temps', description: 'Log temps before 4pm.', completed: false },
    { id: 3, title: 'Deep Clean Flat Top', description: 'Scrape, degrease, polish.', completed: true }
  ];

  function toggleExpand(id) {
    expandedId = expandedId === id ? null : id;
  }

  function completeTask(id) {
    todos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: true } : todo
    );
    expandedId = null;
  }

  $: activeTodos = todos.filter(t => !t.completed);
  $: completedTodos = todos.filter(t => t.completed);
</script>

<Layout>
  <PageHeader title="To Do" />

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    <button
      role="tab"
      aria-selected={activeTab === 'active'}
      class:active={activeTab === 'active'}
      on:click={() => (activeTab = 'active')}
    >
      Active
    </button>

    <button
      role="tab"
      aria-selected={activeTab === 'completed'}
      class:active={activeTab === 'completed'}
      on:click={() => (activeTab = 'completed')}
    >
      Completed
    </button>
  </div>

  <!-- Active Tasks -->
  {#if activeTab === 'active'}
    <div class="card-list" role="region" aria-label="Active Tasks">
      {#each activeTodos as todo (todo.id)}
        <DashboardCard
          title={todo.title}
          description={expandedId === todo.id ? todo.description : ''}
          role="button"
          tabindex="0"
          aria-expanded={expandedId === todo.id}
          on:click={() => toggleExpand(todo.id)}
          on:keydown={(e) => e.key === 'Enter' && toggleExpand(todo.id)}
        >
          <button
            slot="actions"
            class="complete-button"
            on:click|stopPropagation={() => completeTask(todo.id)}
          >
            ✓ Complete
          </button>
        </DashboardCard>
      {/each}
    </div>
  {/if}

  <!-- Completed Tasks -->
  {#if activeTab === 'completed'}
    <div class="card-list" role="region" aria-label="Completed Tasks">
      {#each completedTodos as todo (todo.id)}
        <DashboardCard
          title={todo.title}
          description={expandedId === todo.id ? todo.description : ''}
          role="button"
          tabindex="0"
          aria-expanded={expandedId === todo.id}
          on:click={() => toggleExpand(todo.id)}
          on:keydown={(e) => e.key === 'Enter' && toggleExpand(todo.id)}
        />
      {/each}
    </div>
  {/if}
</Layout>

<style>
  .tabs {
    display: flex;
    gap: 0.5rem;
    padding: 0 1rem 1rem;
  }

  .tabs button {
    flex: 1;
    padding: 0.6rem;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-secondary);
  }

  .tabs button.active {
    background: rgba(235, 24, 24, 0.15);
    color: var(--text-primary);
    border-color: rgba(0, 0, 0, 0.35);
  }

  .card-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 6rem;
  }

  .complete-button {
    background: rgba(13, 168, 39, 0.329);
    border: 1px solid rgba(7, 201, 33, 0.959);
    color: var(--accent-purple);
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;

    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>

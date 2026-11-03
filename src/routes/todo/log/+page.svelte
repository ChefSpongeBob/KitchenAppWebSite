<script lang="ts">
  import Layout from '#lib/components/ui/Layout.svelte';
  import PageHeader from '#lib/components/ui/PageHeader.svelte';
  import ManagerSectionNav from '#lib/components/ui/ManagerSectionNav.svelte';
  import ReportToolbar from '#lib/components/ui/ReportToolbar.svelte';

  type LogItem = {
    id: string;
    title: string;
    display_name?: string | null;
    completed_at: number;
  };

  export let data: { logs?: LogItem[]; canViewReports: boolean };

  $: logs = data.logs ?? [];

  function completedLabel(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
</script>

<Layout>
  <PageHeader title="ToDo History" />
  <ManagerSectionNav groupId="workspace" />

  <div class="history-page">
    {#if data.canViewReports}
      <ReportToolbar />
    {/if}

    <section class="history-list" aria-label="Completed tasks">
      {#if logs.length === 0}
        <p class="empty-log">No completed tasks yet.</p>
      {:else}
        {#each logs as log (log.id)}
          <article class="history-row">
            <span class="material-icons" aria-hidden="true">task_alt</span>
            <div>
              <h2>{log.title}</h2>
              <p>{log.display_name ?? 'Unknown user'}</p>
            </div>
            <time datetime={new Date(log.completed_at * 1000).toISOString()}>
              {completedLabel(log.completed_at)}
            </time>
          </article>
        {/each}
      {/if}
    </section>
  </div>
</Layout>

<style>
  :global(.main-content:has(.history-page)) {
    max-width: 1040px;
  }

  .history-page {
    display: grid;
    gap: 0.9rem;
    padding-bottom: 4rem;
  }

  .history-list {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .history-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.72rem;
    min-height: 3.8rem;
    padding: 0.7rem 0;
    border-bottom: 1px solid var(--color-divider);
  }

  .history-row:last-child {
    border-bottom: 0;
  }

  .history-row > .material-icons {
    color: var(--color-text-muted);
    font-size: 1.1rem;
  }

  .history-row h2,
  .history-row p {
    margin: 0;
  }

  .history-row h2 {
    font-size: 0.86rem;
    font-weight: var(--weight-semibold);
  }

  .history-row p,
  .history-row time {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .history-row time {
    text-align: right;
  }

  .empty-log {
    margin: 0;
    padding: 1rem 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  @media (max-width: 640px) {
    .history-row {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .history-row time {
      grid-column: 2;
      text-align: left;
    }
  }
</style>

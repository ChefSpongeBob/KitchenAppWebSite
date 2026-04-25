<script>
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import { fade } from 'svelte/transition';

  export let data;
  const lists = data.sections ?? [];
</script>

<Layout>
  <PageHeader title="Checklists" />
  <div class="grid">
    {#if lists.length === 0}
      <p class="empty">No checklist groups configured yet.</p>
    {:else}
      {#each lists as list, index}
      <a href={list.href} class="card-link" in:fade={{ delay: index * 80, duration: 180 }}>
        <DashboardCard title={list.title} />
      </a>
      {/each}
    {/if}
  </div>
</Layout>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-4);
    margin-top: var(--space-4);
  }

  .card-link {
    display: block;
    text-decoration: none;
    border-radius: var(--radius-lg);
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out), filter 120ms var(--ease-out);
  }

  .card-link:hover,
  .card-link:focus {
    transform: translateY(-2px);
    box-shadow: 0 18px 40px rgba(4, 5, 7, 0.2);
    filter: saturate(1.04);
    outline: none;
  }

  .card-link:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
  }

  .empty {
    margin: 0;
    color: var(--color-text-muted);
  }
</style>

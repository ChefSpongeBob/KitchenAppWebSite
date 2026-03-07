<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  type Doc = { title: string; content: string | null; file_url: string | null; category: string };
  export let data: { doc: Doc | null };
</script>

<Layout>
  <PageHeader title="Handbook" subtitle="Team handbook and working standards." />

  {#if data.doc}
    <DashboardCard title={data.doc.title} description={data.doc.category}>
      <p>{data.doc.content ?? 'No content yet.'}</p>
      {#if data.doc.file_url}<a href={data.doc.file_url}>Open file</a>{/if}
    </DashboardCard>
  {:else}
    <p class="empty">No Handbook document configured yet.</p>
  {/if}
</Layout>

<style>
  p {
    margin: 0;
    color: var(--color-text-muted);
  }

  a {
    display: inline-block;
    margin-top: 0.6rem;
    color: var(--color-primary);
    text-decoration: none;
  }

  .empty {
    color: var(--color-text-muted);
  }
</style>

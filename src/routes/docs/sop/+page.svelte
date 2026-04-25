<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  type Doc = { title: string; content: string | null; file_url: string | null; category: string };
  export let data: { doc: Doc | null };
</script>

<Layout>
  <PageHeader title="SOPs" />

  {#if data.doc}
    <DashboardCard title={data.doc.title} description={data.doc.category}>
      <p>{data.doc.content ?? 'Details will appear here once added.'}</p>
      {#if data.doc.file_url}
        <div class="doc-actions">
          <a href={data.doc.file_url} target="_blank" rel="noreferrer">Open File</a>
          <a href={data.doc.file_url} download>Download File</a>
        </div>
      {/if}
    </DashboardCard>
  {:else}
    <p class="empty">SOP content is not available yet.</p>
  {/if}
</Layout>

<style>
  p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .doc-actions {
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
    margin-top: 0.8rem;
  }

  .doc-actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.48rem 0.75rem;
    border-radius: 10px;
    border: 1px solid rgba(132, 146, 166, 0.22);
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
    color: var(--color-primary-contrast);
    text-decoration: none;
  }

  .empty {
    color: var(--color-text-muted);
  }
</style>



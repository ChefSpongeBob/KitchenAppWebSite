<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import PdfPageStack from '$lib/components/ui/PdfPageStack.svelte';

  type Doc = { title: string; content: string | null; file_url: string | null; category: string };
  export let data: { doc: Doc | null };
</script>

<Layout>
  <PageHeader title="Handbook" />

  {#if data.doc}
    <DashboardCard title={data.doc.title} description={data.doc.category}>
      <p>{data.doc.content ?? 'Details will appear here once added.'}</p>
      {#if data.doc.file_url}
        <div class="document-stage">
          <PdfPageStack src={data.doc.file_url} title="Employee handbook" />
        </div>
      {/if}
    </DashboardCard>
  {:else}
    <p class="empty">Handbook content is not available yet.</p>
  {/if}
</Layout>

<style>
  p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .document-stage {
    margin-top: 0.9rem;
    display: grid;
  }

  .empty {
    color: var(--color-text-muted);
  }
</style>


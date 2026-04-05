<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import PdfPageStack from '$lib/components/ui/PdfPageStack.svelte';

  type Doc = { title: string; content: string | null; file_url: string | null; category: string };
  export let data: { doc: Doc | null };

  const guideUrl = '/files/daves-sushi-app-guide.pdf';
</script>

<Layout>
  <PageHeader title="About" />

  <DashboardCard title="App Guide">
    <div class="document-stage">
      <PdfPageStack src={guideUrl} title="Dave's Sushi App Guide" />
    </div>
    <a href={guideUrl} download>Download Guide</a>
  </DashboardCard>

  {#if data.doc}
    <div class="info-card">
      <DashboardCard title={data.doc.title}>
        <p>{data.doc.content ?? 'Details will appear here once added.'}</p>
        {#if data.doc.file_url}<a href={data.doc.file_url}>View file</a>{/if}
      </DashboardCard>
    </div>
  {/if}
</Layout>

<style>
  p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .document-stage {
    display: grid;
  }

  .info-card {
    margin-top: 1rem;
  }

  a {
    display: inline-block;
    margin-top: 0.6rem;
    color: var(--color-primary);
    text-decoration: none;
  }
</style>

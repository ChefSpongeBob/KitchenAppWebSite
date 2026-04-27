<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';

  type DocItem = {
    id: string;
    slug: string;
    title: string;
    section: string;
    category: string;
    content?: string | null;
    file_url?: string | null;
  };

  export let data: { docs?: DocItem[] };
  const docs: DocItem[] = data.docs ?? [];

  function getDocHref(doc: DocItem) {
    if (doc.slug === 'about') return '/app/about';
    return `/docs/${doc.slug}`;
  }
</script>

<Layout>
  <PageHeader title="Documents" />

  {#if docs.length === 0}
    <p class="empty">No documents available.</p>
  {:else}
    <section class="grid">
      {#each docs as d}
        <div class="doc-card">
          <a href={getDocHref(d)} class="card-link">
            <DashboardCard title={d.title}>
              {#if d.content}
                <p>{d.content}</p>
              {/if}
            </DashboardCard>
          </a>
        </div>
      {/each}
    </section>
  {/if}
</Layout>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 1rem;
  }

  .card-link {
    display: block;
    text-decoration: none;
    color: inherit;
  }

  .doc-card {
    display: flex;
    flex-direction: column;
  }

  p {
    margin: 0.5rem 0 0;
    color: var(--color-text-muted);
  }

  .empty {
    color: var(--color-text-muted);
  }
</style>

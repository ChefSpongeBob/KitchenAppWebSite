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
</script>

<Layout>
  <PageHeader title="Documents" subtitle="Handbook, SOPs, and general docs." />

  {#if docs.length === 0}
    <p class="empty">No documents yet.</p>
  {:else}
    <section class="grid">
      {#each docs as d}
        <a href={d.slug === 'about' ? '/about' : d.slug === 'sop' ? '/docs/sop' : d.slug === 'handbook' ? '/docs/handbook' : '/docs'} class="card-link">
          <DashboardCard title={d.title} description={`${d.section} / ${d.category}`}>
            {#if d.content}
              <p>{d.content}</p>
            {/if}
            {#if d.file_url}
              <small>File: {d.file_url}</small>
            {/if}
          </DashboardCard>
        </a>
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

  p {
    margin: 0.5rem 0 0;
    color: var(--color-text-muted);
  }

  small {
    display: block;
    margin-top: 0.4rem;
    color: var(--color-text-muted);
  }

  .empty {
    color: var(--color-text-muted);
  }
</style>

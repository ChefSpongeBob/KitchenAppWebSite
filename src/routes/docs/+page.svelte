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
    if (doc.slug === 'about') return '/about';
    return `/docs/${doc.slug}`;
  }

  const extraDocs = [
    {
      id: 'doc-menu',
      href: '/menu',
      file_url: '/menus/main-menu.pdf',
      title: 'Menu'
    }
  ];
</script>

<Layout>
  <PageHeader title="Documents" />

  {#if docs.length === 0}
    <p class="empty">No documents available.</p>
  {:else}
    <section class="grid">
      {#each extraDocs as doc}
        <div class="doc-card">
          <a href={doc.href} class="card-link">
            <DashboardCard title={doc.title} />
          </a>
          <div class="doc-actions">
            <a href={doc.href}>View Menus</a>
          </div>
        </div>
      {/each}

      {#each docs as d}
        <div class="doc-card">
          <a href={getDocHref(d)} class="card-link">
            <DashboardCard title={d.title} description={`${d.section} / ${d.category}`}>
              {#if d.content}
                <p>{d.content}</p>
              {/if}
            </DashboardCard>
          </a>
          {#if d.file_url}
            <div class="doc-actions">
              <a href={d.file_url} target="_blank" rel="noreferrer">Open File</a>
              <a href={d.file_url} download>Download</a>
            </div>
          {/if}
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
    gap: 0.55rem;
  }

  .doc-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .doc-actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.42rem 0.7rem;
    border-radius: 10px;
    border: 1px solid rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    text-decoration: none;
    font-size: 0.78rem;
  }

  p {
    margin: 0.5rem 0 0;
    color: var(--color-text-muted);
  }

  .empty {
    color: var(--color-text-muted);
  }
</style>

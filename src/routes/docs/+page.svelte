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

  export let data: { docs?: DocItem[]; categories?: string[] };
  const docs: DocItem[] = data.docs ?? [];
  const categories: string[] = data.categories ?? [];

  function normalizeCategoryKey(value: string) {
    return value.trim().toLowerCase();
  }

  const docsByCategory = categories.map((category) => {
    const key = normalizeCategoryKey(category);
    const items = docs.filter((doc) => normalizeCategoryKey(doc.category ?? '') === key);
    return [category, items] as const;
  });

  function getDocHref(doc: DocItem) {
    return `/docs/${doc.slug}`;
  }
</script>

<Layout>
  <PageHeader title="Documents" />

  {#if categories.length === 0}
    <p class="empty">No document categories available yet.</p>
  {:else}
    <section class="group-stack">
      {#each docsByCategory as [category, items]}
        <div class="group">
          <h2>{category}</h2>
          {#if items.length === 0}
            <div class="grid">
              <div class="doc-card empty-category-card">
                <DashboardCard title={category}>
                  <p class="empty">No documents in this category yet.</p>
                </DashboardCard>
              </div>
            </div>
          {:else}
            <div class="grid">
              {#each items as d}
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
            </div>
          {/if}
        </div>
      {/each}
    </section>
  {/if}
</Layout>

<style>
  .group-stack {
    display: grid;
    gap: 1.1rem;
  }

  .group h2 {
    margin: 0 0 0.65rem;
    font-size: 0.95rem;
    color: var(--color-text-muted);
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

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

<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  type DocItem = {
    id: string;
    slug: string;
    title: string;
    section: string;
    category: string;
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

  <section class="library-shell">
    {#if categories.length === 0}
      <EmptyState title="No document categories yet." compact />
    {:else}
      {#each docsByCategory as [category, items]}
        <section class="category-row">
          <header class="category-head">
            <h2>{category}</h2>
            <span>{items.length} document{items.length === 1 ? '' : 's'}</span>
          </header>

          {#if items.length === 0}
            <EmptyState title="No documents yet." compact />
          {:else}
            <div class="doc-list">
              {#each items as doc}
                <a href={getDocHref(doc)} class="doc-link">
                  <span class="doc-title">{doc.title}</span>
                  <span class="doc-meta">{doc.file_url ? 'File attached' : 'Text only'}</span>
                </a>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    {/if}
  </section>
</Layout>

<style>
  .library-shell {
    display: grid;
    gap: 1.15rem;
  }

  .category-row {
    display: grid;
    gap: 0.55rem;
    padding-block: 0.85rem;
    border-top: 1px solid var(--color-divider);
  }

  .category-row:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .category-head,
  .doc-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .category-head h2 {
    margin: 0;
    font-size: clamp(1rem, 2vw, 1.25rem);
  }

  .category-head span,
  .doc-meta {
    color: var(--color-text-muted);
  }

  .category-head span,
  .doc-meta {
    font-size: 0.78rem;
  }

  .doc-list {
    display: grid;
    border-top: 1px solid color-mix(in srgb, var(--color-divider) 70%, transparent);
  }

  .doc-link {
    min-height: 3.05rem;
    padding: 0.72rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-divider) 70%, transparent);
    color: inherit;
    text-decoration: none;
  }

  .doc-link:hover .doc-title,
  .doc-link:focus-visible .doc-title {
    color: var(--color-primary);
  }

  .doc-title {
    font-weight: var(--weight-semibold);
  }

  @media (max-width: 700px) {
    .category-head,
    .doc-link {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.25rem;
    }
  }
</style>

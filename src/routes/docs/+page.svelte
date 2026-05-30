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
            <span class="category-icon material-icons" aria-hidden="true">folder_open</span>
            <span class="category-copy">
              <h2>{category}</h2>
              <small>{items.length} document{items.length === 1 ? '' : 's'}</small>
            </span>
          </header>

          {#if items.length === 0}
            <EmptyState title="No documents yet." compact />
          {:else}
            <div class="doc-list">
              {#each items as doc}
                <a href={getDocHref(doc)} class="doc-link">
                  <span class="material-icons doc-icon" aria-hidden="true">description</span>
                  <span class="doc-copy">
                    <span class="doc-title">{doc.title}</span>
                    <span class="doc-meta">{doc.file_url ? 'File attached' : 'Text only'}</span>
                  </span>
                  <span class="material-icons doc-action" aria-hidden="true">arrow_forward</span>
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
    gap: 1rem;
  }

  .category-row {
    display: grid;
    gap: 0.8rem;
    padding-block: 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .category-head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
  }

  .category-head h2 {
    margin: 0;
    font-size: clamp(1rem, 2vw, 1.25rem);
  }

  .category-copy {
    display: grid;
    gap: 0.12rem;
  }

  .category-copy small,
  .doc-meta {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .category-icon,
  .doc-icon,
  .doc-action {
    color: var(--color-text-muted);
    line-height: 1;
  }

  .category-icon {
    font-size: 1.35rem;
  }

  .doc-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(14rem, 1fr));
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .doc-link {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    min-height: 4.4rem;
    padding: 0.85rem 0.9rem;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    text-decoration: none;
  }

  .doc-link:nth-child(even) {
    border-right: 0;
  }

  .doc-link:nth-last-child(-n + 2) {
    border-bottom: 0;
  }

  .doc-link:hover .doc-title,
  .doc-link:focus-visible .doc-title {
    color: var(--color-text);
  }

  .doc-title {
    font-weight: var(--weight-semibold);
  }

  .doc-copy {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .doc-action {
    font-size: 1rem;
    opacity: 0.72;
  }

  @media (max-width: 700px) {
    .doc-list {
      grid-template-columns: 1fr;
    }

    .doc-link {
      border-right: 0;
    }

    .doc-link:nth-last-child(-n + 2) {
      border-bottom: 1px solid var(--color-divider);
    }

    .doc-link:last-child {
      border-bottom: 0;
    }
  }
</style>

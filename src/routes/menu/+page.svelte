<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import PdfPageStack from '$lib/components/ui/PdfPageStack.svelte';

  type MenuDoc = {
    id: string;
    slug: string;
    title: string;
    content: string | null;
    file_url: string | null;
  };

  export let data: { menuDocs?: MenuDoc[] };
  const menuDocs = data.menuDocs ?? [];
  let activeMenu: MenuDoc | null = menuDocs[0] ?? null;

  function isPdf(url: string | null) {
    return Boolean(url && url.toLowerCase().endsWith('.pdf'));
  }
</script>

<Layout>
  <PageHeader title="Menu" />

  {#if menuDocs.length === 0}
    <p class="empty">No menu documents are configured yet.</p>
  {:else}
    <section class="grid">
      {#each menuDocs as item}
        <div class="doc-card">
          <button
            type="button"
            class="menu-select"
            class:active={activeMenu?.id === item.id}
            on:click={() => (activeMenu = item)}
          >
            <DashboardCard title={item.title} />
          </button>
        </div>
      {/each}
    </section>

    {#if activeMenu}
      <section class="viewer-shell" aria-label="Menu viewer">
        <div class="viewer-head">
          <div>
            <span class="viewer-kicker">Menu Document</span>
            <h2>{activeMenu.title}</h2>
          </div>
        </div>
        {#if activeMenu.content}
          <p class="menu-content">{activeMenu.content}</p>
        {/if}
        {#if activeMenu.file_url}
          <div class="document-stage">
            {#if isPdf(activeMenu.file_url)}
              <PdfPageStack src={activeMenu.file_url} title={activeMenu.title} />
            {:else}
              <img src={activeMenu.file_url} alt={activeMenu.title} class="menu-image" loading="lazy" />
            {/if}
          </div>
        {/if}
      </section>
    {/if}
  {/if}
</Layout>

<style>
  .empty {
    color: var(--color-text-muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .doc-card {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .menu-select {
    display: block;
    padding: 0;
    background: transparent;
    border: 0;
    text-align: left;
  }

  .menu-select :global(.card) {
    transition: border-color 120ms var(--ease-out), box-shadow 120ms var(--ease-out), transform 120ms var(--ease-out);
  }

  .menu-select:hover :global(.card),
  .menu-select:focus-visible :global(.card) {
    transform: translateY(-2px);
    border-color: rgba(132, 146, 166, 0.18);
    box-shadow: var(--shadow-md);
  }

  .menu-select.active :global(.card) {
    border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border) 45%);
    box-shadow: 0 0 0 1px rgba(132, 146, 166, 0.12), var(--shadow-md);
  }

  .viewer-shell {
    margin-top: 1rem;
    display: grid;
    gap: 0.85rem;
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .viewer-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .viewer-head h2 {
    margin: 0.25rem 0 0;
    font-size: 1.05rem;
  }

  .menu-content {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .document-stage {
    display: grid;
  }

  .menu-image {
    width: 100%;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  @media (max-width: 760px) {
    .viewer-shell {
      padding: 0.85rem;
    }
  }
</style>

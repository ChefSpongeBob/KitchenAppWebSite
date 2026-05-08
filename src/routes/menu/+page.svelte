<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import PdfPageStack from '$lib/components/ui/PdfPageStack.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

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
  <PageHeader title="Menus" />

  {#if menuDocs.length === 0}
    <EmptyState title="No menus yet." compact />
  {:else}
    <section class="menu-layout">
      <aside class="menu-list" aria-label="Menu list">
        {#each menuDocs as item}
          <button
            type="button"
            class:active={activeMenu?.id === item.id}
            on:click={() => (activeMenu = item)}
          >
            <span>{item.title}</span>
            <small>{item.file_url ? 'Uploaded' : 'No file'}</small>
          </button>
        {/each}
      </aside>

      {#if activeMenu}
        <section class="viewer" aria-label="Menu viewer">
          <header>
            <h2>{activeMenu.title}</h2>
            {#if activeMenu.file_url}
              <a href={activeMenu.file_url} target="_blank" rel="noreferrer">Open file</a>
            {/if}
          </header>

          {#if activeMenu.content}
            <p>{activeMenu.content}</p>
          {/if}

          {#if activeMenu.file_url}
            <div class="document-stage">
              {#if isPdf(activeMenu.file_url)}
                <PdfPageStack src={activeMenu.file_url} title={activeMenu.title} />
              {:else}
                <img src={activeMenu.file_url} alt={activeMenu.title} loading="lazy" />
              {/if}
            </div>
          {:else}
            <EmptyState title="No menu file uploaded yet." compact />
          {/if}
        </section>
      {/if}
    </section>
  {/if}
</Layout>

<style>
  .menu-list small,
  .viewer p {
    color: var(--color-text-muted);
  }

  .menu-layout {
    display: grid;
    grid-template-columns: minmax(210px, 0.34fr) minmax(0, 1fr);
    gap: 1.1rem;
    align-items: start;
  }

  .menu-list {
    position: sticky;
    top: 1rem;
    display: grid;
    gap: 0.3rem;
    border-right: 1px solid var(--color-divider);
    padding-right: 0.8rem;
  }

  .menu-list button {
    display: grid;
    gap: 0.15rem;
    padding: 0.7rem 0.65rem;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--color-text);
    text-align: left;
    cursor: pointer;
  }

  .menu-list button:hover,
  .menu-list button:focus-visible,
  .menu-list button.active {
    background: color-mix(in srgb, var(--color-surface-alt) 58%, transparent);
    outline: none;
  }

  .menu-list span {
    font-weight: var(--weight-semibold);
  }

  .viewer {
    display: grid;
    gap: 0.8rem;
  }

  .viewer header {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: center;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .viewer h2,
  .viewer p {
    margin: 0;
  }

  .viewer a {
    color: var(--color-text);
    text-decoration: none;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.42rem 0.7rem;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  .viewer a:hover {
    color: var(--color-primary);
  }

  .document-stage {
    display: grid;
  }

  .document-stage img {
    width: 100%;
    max-height: 78vh;
    object-fit: contain;
    border-radius: 14px;
    border: 1px solid var(--color-divider);
  }

  @media (max-width: 820px) {
    .menu-layout {
      grid-template-columns: 1fr;
    }

    .menu-list {
      position: static;
      grid-auto-flow: column;
      grid-auto-columns: minmax(150px, 1fr);
      overflow-x: auto;
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
      padding-right: 0;
      padding-bottom: 0.65rem;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
    }

    .menu-list button {
      scroll-snap-align: start;
    }

    .viewer header {
      align-items: flex-start;
      flex-direction: column;
    }
  }

  @media (max-width: 480px) {
    .menu-list {
      grid-auto-columns: minmax(132px, 0.82fr);
    }

    .viewer a {
      width: 100%;
      justify-content: center;
    }
  }
</style>

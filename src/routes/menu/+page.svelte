<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import DashboardCard from '$lib/components/ui/DashboardCard.svelte';
  import PdfPageStack from '$lib/components/ui/PdfPageStack.svelte';

  const menuPdfs = [
    {
      title: 'Secret Menu',
      description: 'Off-menu and specialty roll reference.',
      href: '/menus/secret-rolls.pdf',
      file: 'secret-rolls.pdf'
    },
    {
      title: 'Main Menu',
      description: 'Standard guest-facing menu PDF.',
      href: '/menus/main-menu.pdf',
      file: 'main-menu.pdf'
    },
    {
      title: 'Seasonal / Limited',
      description: 'Rotating inserts, promos, or temporary menus.',
      href: '/menus/seasonal-menu.pdf',
      file: 'seasonal-menu.pdf'
    }
  ];

  let activeMenu: (typeof menuPdfs)[number] | null = null;

  function toggleMenu(item: (typeof menuPdfs)[number]) {
    activeMenu = activeMenu?.href === item.href ? null : item;
  }
</script>

<Layout>
  <PageHeader
    title="Secret Rolls & Menu"
    subtitle="Menu sheets and roll references."
  />

  <section class="grid">
    {#each menuPdfs as item}
      <div class="doc-card">
        <button
          type="button"
          class="menu-select"
          class:active={activeMenu?.href === item.href}
          on:click={() => toggleMenu(item)}
        >
          <DashboardCard title={item.title} description={item.description}>
            <div class="card-copy">
              <span class="state-pill">{activeMenu?.href === item.href ? 'Close' : 'Open'}</span>
            </div>
          </DashboardCard>
        </button>
      </div>
    {/each}
  </section>

  {#if activeMenu}
    <section class="viewer-shell" aria-label="Menu viewer">
      <div class="viewer-head">
        <div>
          <span class="viewer-kicker">Menu Sheet</span>
          <h2>{activeMenu.title}</h2>
        </div>
      </div>
      <div class="document-stage">
        <PdfPageStack src={activeMenu.href} title={activeMenu.title} />
      </div>
    </section>
  {/if}
</Layout>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  .card-copy {
    display: grid;
    gap: 0.45rem;
  }

  .state-pill {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    justify-content: center;
    padding: 0.4rem 0.72rem;
    border-radius: 999px;
    border: 1px solid rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.18), rgba(195, 32, 43, 0.06));
    color: var(--color-primary-contrast);
    font-size: 0.76rem;
    font-weight: var(--weight-medium);
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
    border-color: rgba(195, 32, 43, 0.18);
    box-shadow: var(--shadow-md);
  }

  .menu-select.active :global(.card) {
    border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border) 45%);
    box-shadow: 0 0 0 1px rgba(195, 32, 43, 0.12), var(--shadow-md);
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

  .viewer-head {
    display: block;
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

  .document-stage {
    display: grid;
  }

  @media (max-width: 760px) {
    .viewer-shell {
      padding: 0.85rem;
    }
  }
</style>

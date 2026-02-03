<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { primaryNav } from "$lib/assets/navigation";
  import PageHeader from "$lib/components/ui/PageHeader.svelte";

  let sidebarOpen = false;

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  $: currentPath = $page.url.pathname;
</script>

<svelte:head>
  <link
    href="https://fonts.googleapis.com/icon?family=Material+Icons"
    rel="stylesheet"
  />
</svelte:head>

<!-- ===== Hamburger ===== -->
<button class="hamburger tap" on:click={toggleSidebar}>
  <span class="material-icons">menu</span>
</button>

<!-- ===== Overlay ===== -->
{#if sidebarOpen}
  <div class="overlay" on:click={() => (sidebarOpen = false)}></div>
{/if}

<!-- ===== Sidebar ===== -->
<aside class="sidebar" class:open={sidebarOpen}>
  <div class="sidebar-inner">
    {#each primaryNav as item}
      <a
        href={item.route}
        class="side-item tap"
        class:active={currentPath.startsWith(item.route)}
        on:click={() => (sidebarOpen = false)}
      >
        <span class="active-indicator"></span>

        <span class="material-icons">{item.icon}</span>
        <span>{item.label}</span>
      </a>
    {/each}
  </div>
</aside>

<!-- ===== App Shell ===== -->
<div class="app-shell">
  <main class="app-content">
    <slot />
  </main>
</div>

<style>

  /* ===== Layout ===== */
  .app-shell {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .app-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4);
    padding-bottom: var(--space-6);
  }

  /* ===== Hamburger ===== */
.hamburger {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 20;

  background: transparent;
  border: none;
}


  /* ===== Overlay ===== */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    backdrop-filter: blur(2px);
    z-index: 999;
  }

  /* ===== Sidebar ===== */
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 260px;

    background: var(--color-surface);
    border-right: 1px solid var(--color-border);

    transform: translateX(-100%);
    transition: transform 240ms ease;

    z-index: 1000;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-inner {
    padding: 80px 14px 24px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ===== Sidebar Items ===== */
  .side-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;

    padding: 12px 14px;
    border-radius: var(--radius-md);

    text-decoration: none;
    color: var(--color-text-muted);
    font-size: var(--text-md);
    font-weight: var(--weight-medium);

    transition: background 160ms ease, color 160ms ease;
  }

  .side-item:hover {
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  .side-item .material-icons {
    font-size: 20px;
  }

  /* ===== Active Indicator ===== */
  .active-indicator {
    position: absolute;
    left: -14px;
    width: 4px;
    height: 22px;
    border-radius: 4px;
    background: var(--color-primary);
    opacity: 0;
    transition: opacity 160ms ease;
  }

  .side-item.active {
    color: var(--color-text);
    background: var(--color-surface-alt);
  }

  .side-item.active .active-indicator {
    opacity: 1;
  }

h1 {
  font-family: "Inter", sans-serif;
  font-size: 2.6rem;
  font-weight: 700;

  text-align: center;
  margin: 2rem 0 1.25rem 0;
}
.app-content {
  padding-top: 2.5rem;
}



</style>

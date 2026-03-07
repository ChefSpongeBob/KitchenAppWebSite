<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { primaryNav, type NavItem } from "$lib/assets/navigation";

  export let data: { user: { id: string; role: string } | null };

  let sidebarOpen = false;
  const adminNavItem: NavItem = {
    label: "Admin",
    route: "/admin",
    icon: "admin_panel_settings"
  };

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function isActive(route: string, path: string) {
    if (route === "/") return path === "/";
    return path === route || path.startsWith(`${route}/`);
  }

  $: currentPath = $page.url.pathname;
  $: navItems =
    data.user?.role === "admin"
      ? [...primaryNav, adminNavItem]
      : primaryNav;

  onMount(() => {
    if (!browser || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
</script>

<svelte:head>
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" href="/favicon.ico" />

  <link
    href="https://fonts.googleapis.com/icon?family=Material+Icons"
    rel="stylesheet"
  />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#0f172a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Kitchen" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

<!-- ===== Hamburger ===== -->
<button
  class="hamburger tap"
  style="color: #9ca3af;"
  on:click={toggleSidebar}
  aria-label="Toggle sidebar"
>
  <span class="material-icons">menu</span>

</button>

<!-- ===== Overlay ===== -->
{#if sidebarOpen}
  <div
    class="overlay"
    on:click={() => (sidebarOpen = false)}
    role="button"
    tabindex="0"
    aria-label="Close sidebar"
    on:keydown={(e) => e.key === "Enter" && (sidebarOpen = false)}
  ></div>
{/if}

<!-- ===== Sidebar ===== -->
<aside class="sidebar" class:open={sidebarOpen} aria-label="Sidebar navigation">
  <div class="sidebar-inner">
    {#each navItems as item}
      <a
        href={item.route}
        class="side-item tap"
        class:active={isActive(item.route, currentPath)}
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
    padding: clamp(0.75rem, 2.6vw, var(--space-4));
    padding-bottom: var(--space-6);
    padding-top: calc(2.5rem + var(--safe-top));
  }

  /* ===== Hamburger ===== */
  .hamburger {
    position: fixed;
    top: calc(0.75rem + var(--safe-top));
    left: calc(0.75rem + var(--safe-left));
    z-index: 20;

    background: transparent;
    border: none;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
    width: min(82vw, 300px);

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

  @media (max-width: 760px) {
    .app-content {
      padding-bottom: calc(4.5rem + var(--safe-bottom));
    }

    .sidebar-inner {
      padding-top: calc(72px + var(--safe-top));
      padding-bottom: calc(16px + var(--safe-bottom));
    }

    .side-item {
      padding: 11px 12px;
      font-size: 0.95rem;
      gap: 12px;
    }
  }

</style>

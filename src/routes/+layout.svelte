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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#121315" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Kitchen" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-touch-fullscreen" content="yes" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
</svelte:head>

<!-- ===== Hamburger ===== -->
<button
  class="hamburger tap"
  class:open={sidebarOpen}
  on:click={toggleSidebar}
  aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
>
  <img class="sushi-icon" src="/sushi-assets/sushi-tray.svg" alt="" aria-hidden="true" />
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
    <div class="sidebar-brand">
      <span class="brand-mark">K</span>
      <div class="brand-copy">
        <strong>Dave's Sushi</strong>
        <small>Daily Service Hub</small>
      </div>
    </div>
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
  <footer class="app-footer">
    <div class="footer-shell">
      <div class="footer-top">
        <div class="footer-brand">
          <img src="/spider-mark.svg" alt="" aria-hidden="true" class="footer-logo" />
          <div class="footer-brand-copy">
            <strong>Nexus North Systems, LLC</strong>
            <span class="footer-version">Kitchen App v2.1</span>
          </div>
        </div>
      </div>
      <p class="footer-copy">Kitchen operations hub for tasks, lists, docs, recipes, and live temperature monitoring.</p>
      <nav class="footer-links" aria-label="Footer links">
        <a href="/about">About App</a>
        <a href="/docs">Documentation</a>
        <a href="https://charlottesweb.nexus" target="_blank" rel="noreferrer">Support Contact</a>
      </nav>
      <div class="footer-bottom">
        <span>&copy; 2026 Nexus North Systems, LLC</span>
        <span>Built for connected kitchen operations</span>
      </div>
    </div>
  </footer>
</div>

<style>
  /* ===== Layout ===== */
  .app-shell {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
  }

  .app-content {
    flex: 1;
    padding: clamp(0.75rem, 2.6vw, var(--space-4));
    padding-bottom: var(--space-8);
    padding-top: calc(2.5rem + var(--safe-top));
    max-width: 1440px;
    width: 100%;
    margin: 0 auto;
  }

  /* ===== Hamburger ===== */
  .hamburger {
    position: fixed;
    top: calc(0.75rem + var(--safe-top));
    left: calc(0.75rem + var(--safe-left));
    z-index: 1001;

    background: color-mix(in srgb, var(--color-surface) 84%, transparent);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
    width: 2.7rem;
    height: 2.7rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    color: var(--color-text);
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
  }

  .hamburger:hover {
    border-color: rgba(195, 32, 43, 0.28);
    background: color-mix(in srgb, var(--color-surface-alt) 88%, transparent);
  }

  .sushi-icon {
    width: 1.42rem;
    height: 1.42rem;
    object-fit: contain;
    filter: brightness(0) saturate(100%) invert(95%) sepia(12%) saturate(308%) hue-rotate(296deg) brightness(111%) contrast(94%);
  }

  .hamburger.open,
  .hamburger:focus-visible {
    border-color: rgba(195, 32, 43, 0.3);
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

    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0)),
      color-mix(in srgb, var(--color-surface) 92%, black 8%);
    border-right: 1px solid rgba(255,255,255,0.08);
    box-shadow: 18px 0 40px rgba(0,0,0,0.28);
    backdrop-filter: blur(16px);

    transform: translateX(-100%);
    transition: transform 240ms ease;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;

    z-index: 1000;
  }

  .sidebar::-webkit-scrollbar {
    display: none;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-inner {
    min-height: 100%;
    padding: 78px 14px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    padding: 0 8px 10px;
    border-bottom: 1px solid var(--color-divider);
    position: sticky;
    top: 0;
    z-index: 1;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, black 4%), rgba(33, 37, 42, 0.94));
    backdrop-filter: blur(12px);
  }

  .brand-mark {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background:
      linear-gradient(145deg, rgba(201, 110, 74, 0.26), rgba(216, 192, 166, 0.08)),
      var(--color-surface-alt);
    border: 1px solid rgba(179, 58, 63, 0.25);
    color: var(--color-primary-contrast);
    font-weight: var(--weight-bold);
    letter-spacing: 0.03em;
  }

  .brand-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .brand-copy strong {
    color: var(--color-text);
    font-size: 0.95rem;
    line-height: 1.1;
  }

  .brand-copy small {
    color: var(--color-text-muted);
    font-size: 0.73rem;
  }

  /* ===== Sidebar Items ===== */
  .side-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;

    padding: 12px 14px;
    border-radius: var(--radius-md);
    border: 1px solid transparent;

    text-decoration: none;
    color: var(--color-text-muted);
    font-size: var(--text-md);
    font-weight: var(--weight-medium);

    transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease;
  }

  .side-item:hover {
    background: color-mix(in srgb, var(--color-surface-alt) 84%, transparent);
    border-color: rgba(255,255,255,0.06);
    color: var(--color-text);
    transform: translateX(2px);
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
    background:
      linear-gradient(90deg, rgba(201, 110, 74, 0.12), transparent 65%),
      var(--color-surface-alt);
    border-color: rgba(179, 58, 63, 0.18);
  }

  .side-item.active .active-indicator {
    opacity: 1;
  }

  .app-footer {
    margin-top: auto;
    position: relative;
    border-top: 1px solid rgba(255,255,255,0.06);
    color: var(--color-text-muted);
    font-size: 0.78rem;
    padding: 1rem 1rem calc(0.95rem + var(--safe-bottom));
    background:
      radial-gradient(circle at top center, rgba(195, 32, 43, 0.14), transparent 50%),
      linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0)),
      color-mix(in srgb, var(--color-bg) 90%, black 10%);
    backdrop-filter: blur(14px);
    box-shadow:
      0 -10px 26px rgba(195, 32, 43, 0.08),
      inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .app-footer::before {
    content: '';
    position: absolute;
    left: 50%;
    width: min(86%, 980px);
    transform: translateX(-50%);
    top: -1px;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(195, 32, 43, 0.06), rgba(195, 32, 43, 0.55), rgba(195, 32, 43, 0.06));
    box-shadow: 0 0 18px rgba(195, 32, 43, 0.22);
  }

  .footer-shell {
    width: min(100%, 1040px);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0.25rem 0 0;
  }

  .footer-shell::after {
    content: '';
    position: absolute;
    inset: 0 0 0 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 24px 24px;
    opacity: 0.08;
    border-radius: 0;
  }

  .footer-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .footer-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
  }

  .footer-logo {
    width: 2.35rem;
    height: 2.35rem;
    opacity: 0.92;
    filter:
      brightness(0) saturate(100%) invert(95%) sepia(12%) saturate(308%) hue-rotate(296deg) brightness(111%) contrast(94%)
      drop-shadow(0 0 10px rgba(195, 32, 43, 0.18));
  }

  .footer-brand-copy {
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
  }

  .footer-top strong {
    color: var(--color-text);
    font-size: 0.95rem;
    font-weight: var(--weight-semibold);
    letter-spacing: -0.01em;
  }

  .footer-version {
    font-size: 0.74rem;
    color: var(--color-text-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .footer-copy {
    position: relative;
    z-index: 1;
    margin: 0;
    max-width: 40rem;
    text-align: left;
    font-size: 0.77rem;
    line-height: 1.45;
    color: var(--color-text-muted);
    text-wrap: balance;
  }

  .footer-links {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: row;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .app-footer a {
    color: var(--color-text);
    text-decoration: none;
    font-size: 0.75rem;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 0.28rem 0.58rem;
    background: color-mix(in srgb, var(--color-surface) 82%, transparent);
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
  }

  .app-footer a:hover {
    text-decoration: none;
    border-color: rgba(179, 58, 63, 0.22);
    color: var(--color-primary-contrast);
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));
  }

  .footer-bottom {
    position: relative;
    z-index: 1;
    width: 100%;
    padding-top: 0.2rem;
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    border-top: 1px solid rgba(255,255,255,0.05);
    margin-top: 0.2rem;
  }

  @media (max-width: 760px) {
    .app-content {
      padding-bottom: calc(4.5rem + var(--safe-bottom));
    }

    .sidebar-inner {
      padding-top: calc(72px + var(--safe-top));
      padding-bottom: calc(16px + var(--safe-bottom));
    }

    .sidebar-brand {
      padding-inline: 6px;
      top: calc(var(--safe-top) * -1);
    }

    .side-item {
      padding: 11px 12px;
      font-size: 0.95rem;
      gap: 12px;
    }

    .app-footer {
      font-size: 0.74rem;
      padding-inline: 0.75rem;
    }

    .footer-copy {
      font-size: 0.76rem;
    }

    .footer-bottom {
      font-size: 0.72rem;
      flex-direction: column;
    }

    .footer-links {
      gap: 0.45rem;
    }

    .footer-logo {
      width: 2.05rem;
      height: 2.05rem;
    }
  }

</style>

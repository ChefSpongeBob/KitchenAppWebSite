<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { browser } from "$app/environment";
  import { navigating, page } from "$app/stores";
  import { primaryNav, publicNav, type NavItem } from "$lib/assets/navigation";
  import {
    canRoleAccessFeature,
    defaultAppFeatureModes,
    type AppFeatureKey,
    type AppFeatureModes
  } from "$lib/features/appFeatures";
  import {
    hasBusinessCapability,
    hasManagementAccess,
    hasReportsAccess,
    hasVendorAccess
  } from "$lib/auth/roles";
  import { resolveBusinessCapabilityForPath } from "$lib/auth/routeCapabilities";
  import ToastStack from "$lib/components/ui/ToastStack.svelte";

  type FeatureAwareNavItem = NavItem & {
    featureKey?: AppFeatureKey;
  };

  type AdminControlGroup = {
    label: string;
    icon: string;
    ungrouped?: boolean;
    items: FeatureAwareNavItem[];
  };

  type BusinessMembership = {
    businessId: string;
    businessName: string;
    businessSlug: string;
    businessPlan: string;
    businessRole: string;
    businessPermissionTemplate: string;
    businessCapabilities: import('$lib/auth/roles').BusinessCapability[];
    businessLogoUrl: string | null;
  };

  export let data: {
    user:
      | {
          id: string;
          role: string;
          businessId?: string | null;
          businessName?: string | null;
          businessLogoUrl?: string | null;
          businessRole?: string | null;
          businessPermissionTemplate?: string | null;
          businessCapabilities?: import('$lib/auth/roles').BusinessCapability[];
          businessOnboardingComplete?: boolean;
          businesses?: BusinessMembership[];
          preferredTheme?: "dark" | "light";
          pushNotificationsEnabled?: boolean;
        }
      | null;
    featureModes?: AppFeatureModes;
    featureAccess?: Partial<Record<AppFeatureKey, boolean>>;
  };

  let sidebarOpen = false;
  let marketingMenuOpen = false;
  let themeMode: "dark" | "light" = "light";
  let themePreferenceLoaded = false;
  let mobileView: "default" | "compact" = "default";
  let narrowViewportQuery: MediaQueryList | null = null;
  let coarsePointerQuery: MediaQueryList | null = null;
  let revealObserver: IntersectionObserver | null = null;
  const THEME_STORAGE_KEY = "crimini_theme_mode";
  const adminNavItem: NavItem = {
    label: "Manager",
    route: "/admin",
    icon: "admin_panel_settings"
  };
  const adminControlGroups: AdminControlGroup[] = [
    {
      label: "",
      icon: "space_dashboard",
      ungrouped: true,
      items: [
        { label: "Dashboard", route: "/app", icon: "home" },
        { label: "Manager Dashboard", route: "/admin", icon: "space_dashboard" }
      ]
    },
    {
      label: "Workspace",
      icon: "tune",
      items: [
        { label: "App Editor", route: "/admin/app-editor", icon: "tune" },
        { label: "Creator Studio", route: "/admin/creator", icon: "build_circle" },
        { label: "Vendors", route: "/admin/vendors", icon: "local_shipping", featureKey: "vendors" }
      ]
    },
    {
      label: "Scheduling",
      icon: "calendar_view_week",
      items: [
        { label: "Schedule Builder", route: "/admin/schedule", icon: "calendar_view_week", featureKey: "scheduling" },
        { label: "Schedule Settings", route: "/admin/schedule-settings", icon: "settings", featureKey: "scheduling" },
        { label: "Schedule Roles", route: "/admin/schedule-roles", icon: "badge", featureKey: "scheduling" }
      ]
    },
    {
      label: "People",
      icon: "groups",
      items: [
        { label: "Staff Manager", route: "/admin/users", icon: "groups" },
        { label: "Employee Onboarding", route: "/admin/onboarding", icon: "assignment_ind" }
      ]
    },
    {
      label: "Systems",
      icon: "device_thermostat",
      items: [
        { label: "Temperature Sensors", route: "/admin/sensors", icon: "device_thermostat" }
      ]
    }
  ];

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function toggleMarketingMenu() {
    marketingMenuOpen = !marketingMenuOpen;
  }

  function applyTheme(mode: "dark" | "light") {
    if (!browser) return;
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    themeMeta?.setAttribute("content", mode === "light" ? "#ffffff" : "#171717");
  }

  function applyMobileView(mode: "default" | "compact") {
    if (!browser) return;
    document.documentElement.setAttribute("data-mobile-view", mode);
  }

  function syncMobileView() {
    if (!browser) return;
    const isNarrow = narrowViewportQuery?.matches ?? window.matchMedia("(max-width: 900px)").matches;
    const isCoarsePointer = coarsePointerQuery?.matches ?? window.matchMedia("(pointer: coarse)").matches;
    mobileView = isNarrow || isCoarsePointer ? "compact" : "default";
    applyMobileView(mobileView);
  }

  function attachMediaListener(query: MediaQueryList, handler: () => void) {
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }

  function toggleTheme() {
    themeMode = themeMode === "dark" ? "light" : "dark";
  }

  async function startNativePushRegistration() {
    const module = await import("$lib/client/pushNotifications");
    await module.registerNativePushNotifications();
  }

  function isActive(route: string, path: string) {
    if (route === "/") return path === "/";
    if (route === "/admin") return path === "/admin";
    return path === route || path.startsWith(`${route}/`);
  }

  function isAdminGroupActive(group: AdminControlGroup) {
    return group.items.some((item) => isActive(item.route, currentPath));
  }

  function submitWorkspaceSwitch(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    select.form?.requestSubmit();
  }

  function setupScrollReveal() {
    if (!browser) return;

    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!nodes.length) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isMarketingRoute || reduceMotion) {
      for (const node of nodes) node.classList.add("is-visible");
      return;
    }

    revealObserver?.disconnect();
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          target.classList.add("is-visible");
          revealObserver?.unobserve(target);
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach((node, index) => {
      if (!node.style.getPropertyValue("--reveal-delay")) {
        node.style.setProperty("--reveal-delay", `${Math.min(index * 45, 260)}ms`);
      }
      if (node.classList.contains("is-visible")) return;
      revealObserver?.observe(node);
    });
  }

  $: currentPath = $page.url.pathname;
  $: navTargetPath = $navigating?.to?.url.pathname ?? "";
  const marketingExactRoutes = new Set([
    "/",
    "/features",
    "/how-it-works",
    "/about",
    "/pricing",
    "/support",
    "/privacy",
    "/terms",
    "/billing-terms",
    "/account-deletion",
    "/register",
    "/login",
    "/forgot-password"
  ]);
  const marketingPrefixRoutes = ["/reset-password/"];
  const appChromePrefixes = [
    "/app",
    "/admin",
    "/my-schedule",
    "/schedule",
    "/lists",
    "/recipes",
    "/todo",
    "/docs",
    "/announcements",
    "/whiteboard",
    "/temper",
    "/conversions",
    "/tools",
    "/vendors",
    "/reports",
    "/menu",
    "/settings",
    "/specials",
    "/billing"
  ];
  $: isOnboardingRoute = currentPath === "/register";
  $: isMarketingRoute =
    marketingExactRoutes.has(currentPath) ||
    marketingPrefixRoutes.some((prefix) => currentPath.startsWith(prefix));
  $: isAppChromeRoute = appChromePrefixes.some(
    (prefix) =>
      currentPath === prefix ||
      currentPath.startsWith(`${prefix}/`) ||
      currentPath.startsWith("/app")
  );
  $: effectiveThemeMode = isAppChromeRoute ? themeMode : "light";
  $: if (browser && isAppChromeRoute && data.user?.pushNotificationsEnabled) {
    startNativePushRegistration().catch((error) => {
      console.error("Push registration failed:", error);
    });
  }
  $: routeSplashTargetPath = navTargetPath || currentPath;
  $: isRouteSplashMarketing =
    marketingExactRoutes.has(routeSplashTargetPath) ||
    marketingPrefixRoutes.some((prefix) => routeSplashTargetPath.startsWith(prefix));
  $: showRouteSplash = Boolean($navigating) && Boolean(navTargetPath) && !navTargetPath.startsWith("/register");
  $: marketingNav = publicNav.filter((item) => item.route !== "/register" && item.route !== "/login");
  $: activeFeatureModes = data.featureModes ?? defaultAppFeatureModes;
  $: normalizedUserRole = String(data.user?.role ?? "").trim().toLowerCase();
  $: normalizedBusinessRole = String(data.user?.businessRole ?? "").trim().toLowerCase();
  $: normalizedPermissionTemplate = String(data.user?.businessPermissionTemplate ?? "").trim().toLowerCase();
  $: isAdminAccount = Boolean(
    data.user &&
      (normalizedUserRole === "admin" ||
        hasManagementAccess(normalizedBusinessRole, normalizedPermissionTemplate, data.user?.businessCapabilities))
  );
  $: canUseProtectedNavItem = (item: NavItem) => {
    if (!item.adminOnly) return true;
    if (item.route === "/reports") {
      return hasReportsAccess(normalizedBusinessRole, normalizedPermissionTemplate, data.user?.businessCapabilities);
    }
    if (item.route === "/vendors") {
      return hasVendorAccess(normalizedBusinessRole, normalizedPermissionTemplate, data.user?.businessCapabilities);
    }
    return isAdminAccount;
  };
  $: filteredPrimaryNav = primaryNav.filter(
    (item) =>
      canUseProtectedNavItem(item) &&
      (!item.featureKey ||
        canRoleAccessFeature(
          activeFeatureModes[item.featureKey],
          data.user?.businessRole ?? data.user?.role,
          item.featureKey,
          data.user?.businessPermissionTemplate,
          data.user?.businessCapabilities
      ))
  );
  $: toolNavItems = filteredPrimaryNav.filter((item) => item.group === "tools");
  $: mainNavItems = filteredPrimaryNav.filter((item) => item.group !== "tools");
  $: toolsGroupActive = toolNavItems.some((item) => isActive(item.route, currentPath));
  $: visibleAdminControlGroups = adminControlGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const requiredCapability = resolveBusinessCapabilityForPath(item.route);
        if (
          requiredCapability &&
          !hasBusinessCapability(
            data.user?.businessRole ?? data.user?.role,
            data.user?.businessPermissionTemplate,
            requiredCapability,
            data.user?.businessCapabilities
          )
        ) {
          return false;
        }
        if (!item.featureKey) return true;
        const role = data.user?.businessRole ?? data.user?.role ?? (currentPath?.startsWith("/admin") ? "admin" : null);
        return canRoleAccessFeature(
          activeFeatureModes[item.featureKey],
          role,
          item.featureKey,
          data.user?.businessPermissionTemplate,
          data.user?.businessCapabilities
        );
      })
    }))
    .filter((group) => group.items.length > 0);
  $: userBusinesses = data.user?.businesses ?? [];
  $: isAdminRoute = currentPath.startsWith("/admin");
  $: navItems = isAdminAccount || isAdminRoute ? [...mainNavItems, adminNavItem] : mainNavItems;
  $: isAdminSidebar = isAdminRoute;
  $: if (currentPath) {
    sidebarOpen = false;
    marketingMenuOpen = false;
  }

  afterNavigate(() => {
    if (!browser) return;
    requestAnimationFrame(setupScrollReveal);
  });

  onMount(() => {
    document.documentElement.classList.add("reveal-ready");
    narrowViewportQuery = window.matchMedia("(max-width: 900px)");
    coarsePointerQuery = window.matchMedia("(pointer: coarse)");

    const teardownViewportListener = attachMediaListener(narrowViewportQuery, syncMobileView);
    const teardownPointerListener = attachMediaListener(coarsePointerQuery, syncMobileView);
    window.addEventListener("resize", syncMobileView, { passive: true });
    const revealFailSafeTimer = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((node) => {
        node.classList.add("is-visible");
      });
    }, 900);

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      themeMode = savedTheme;
    } else if (data.user?.preferredTheme === "light" || data.user?.preferredTheme === "dark") {
      themeMode = data.user.preferredTheme;
    }
    themePreferenceLoaded = true;
    applyTheme(effectiveThemeMode);
    syncMobileView();

    requestAnimationFrame(setupScrollReveal);

    if (browser && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }

    return () => {
      revealObserver?.disconnect();
      window.clearTimeout(revealFailSafeTimer);
      teardownViewportListener();
      teardownPointerListener();
      window.removeEventListener("resize", syncMobileView);
    };
  });

  $: if (browser) {
    if (themePreferenceLoaded) {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }
    applyTheme(effectiveThemeMode);
  }
</script>

<svelte:head>
  <link rel="icon" type="image/svg+xml" sizes="any" href="/crimini-mushrooms.svg?v=4" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=4" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=4" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

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
  <meta name="theme-color" content="#ffffff" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Crimini" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-touch-fullscreen" content="yes" />
</svelte:head>

{#if !isOnboardingRoute}
  {#if !isAppChromeRoute}
  <header class="marketing-header">
    <div class="marketing-shell">
      <a href="/" class="marketing-brand">
        <img src="/crimini-mushrooms.svg" alt="Crimini" class="marketing-brand-logo" />
      </a>

      <nav class="marketing-nav" aria-label="Primary navigation">
        {#each marketingNav as item}
          <a href={item.route} class:active={isActive(item.route, currentPath)}>{item.label}</a>
        {/each}
      </nav>

      <div class="marketing-actions">
        <a href="/login" class="marketing-btn marketing-btn-ghost">Sign In</a>
        <a href="/register#onboarding-slideshow" class="marketing-btn marketing-btn-primary">Start Free</a>
        <button
          class="marketing-menu-btn tap"
          on:click={toggleMarketingMenu}
          aria-label={marketingMenuOpen ? "Close menu" : "Open menu"}
        >
          <span class="material-icons">{marketingMenuOpen ? "close" : "menu"}</span>
        </button>
      </div>
    </div>

    {#if marketingMenuOpen}
      <div class="marketing-mobile-menu">
        {#each marketingNav as item}
          <a href={item.route} class:active={isActive(item.route, currentPath)} on:click={() => (marketingMenuOpen = false)}>{item.label}</a>
        {/each}
        <div class="marketing-mobile-cta">
          <a href="/login" on:click={() => (marketingMenuOpen = false)}>Sign In</a>
          <a href="/register#onboarding-slideshow" class="primary" on:click={() => (marketingMenuOpen = false)}>Start Free</a>
        </div>
      </div>
    {/if}
  </header>
  {:else}
  <!-- ===== Hamburger ===== -->
  <button
    class="hamburger tap"
    class:open={sidebarOpen}
    data-guide="sidebar-toggle"
    on:click={toggleSidebar}
    aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
  >
    <img class="menu-icon" src="/crimini-mark.svg" alt="" aria-hidden="true" />
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
  <aside class="sidebar" class:open={sidebarOpen} aria-label="Sidebar navigation" data-guide="app-sidebar">
    <div class="sidebar-inner">
      <div class="sidebar-brand">
        {#if data.user?.businessLogoUrl}
          <img src={data.user.businessLogoUrl} alt="" aria-hidden="true" class="brand-mark brand-mark-image" />
        {:else}
          <span class="brand-mark">C</span>
        {/if}
        <div class="brand-copy">
          <strong>{data.user?.businessName?.trim() || 'Crimini'}</strong>
        </div>
        {#if userBusinesses.length > 1}
          <form method="POST" action="/workspace/switch" class="workspace-switch-form">
            <select name="business_id" aria-label="Workspace" on:change={submitWorkspaceSwitch}>
              {#each userBusinesses as business}
                <option value={business.businessId} selected={business.businessId === data.user?.businessId}>
                  {business.businessName}
                </option>
              {/each}
            </select>
          </form>
        {/if}
      </div>
      {#if isAdminSidebar}
        <div class="side-section-label">Manager Controls</div>
        {#each visibleAdminControlGroups as group}
          {#if group.ungrouped}
            <div class="side-group-items side-group-items--standalone">
              {#each group.items as item}
                <a
                  href={item.route}
                  class="side-item side-sub-item tap"
                  class:active={isActive(item.route, currentPath)}
                  on:click={() => (sidebarOpen = false)}
                >
                  <span class="active-indicator"></span>
                  <span class="material-icons">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              {/each}
            </div>
          {:else}
            <details class="side-group" open={isAdminGroupActive(group)}>
              <summary class="side-group-summary tap" class:active={isAdminGroupActive(group)}>
                <span class="material-icons">{group.icon}</span>
                <span>{group.label}</span>
                <span class="material-icons expand-icon" aria-hidden="true">expand_more</span>
              </summary>
              <div class="side-group-items">
                {#each group.items as item}
                  <a
                    href={item.route}
                    class="side-item side-sub-item tap"
                    class:active={isActive(item.route, currentPath)}
                    on:click={() => (sidebarOpen = false)}
                  >
                    <span class="active-indicator"></span>
                    <span class="material-icons">{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                {/each}
              </div>
            </details>
          {/if}
        {/each}
      {:else}
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
        {#if toolNavItems.length > 0}
          <details class="side-group" open={toolsGroupActive}>
            <summary class="side-group-summary tap" class:active={toolsGroupActive}>
              <span class="material-icons">build</span>
              <span>Tools</span>
              <span class="material-icons expand-icon" aria-hidden="true">expand_more</span>
            </summary>
            <div class="side-group-items">
              {#each toolNavItems as item}
                <a
                  href={item.route}
                  class="side-item side-sub-item tap"
                  class:active={isActive(item.route, currentPath)}
                  on:click={() => (sidebarOpen = false)}
                >
                  <span class="active-indicator"></span>
                  <span class="material-icons">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              {/each}
            </div>
          </details>
        {/if}
      {/if}
      <div class="sidebar-footer">
        <button
          class="sidebar-theme-toggle tap"
          class:active={themeMode === "dark"}
          on:click={toggleTheme}
          aria-pressed={themeMode === "dark"}
          aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span>Dark Mode</span>
          <span class="material-icons" aria-hidden="true">
            {themeMode === "dark" ? "toggle_on" : "toggle_off"}
          </span>
        </button>
      </div>
    </div>
  </aside>
  {/if}
{/if}

<!-- ===== App Shell ===== -->
<div
  class="app-shell"
  class:marketing-app={isMarketingRoute}
  class:onboarding-shell={isOnboardingRoute}
  class:mobile-compact={mobileView === "compact"}
>
  {#if showRouteSplash}
    <div class="route-splash" role="status" aria-live="polite">
      <div class="route-splash-inner">
        {#if isRouteSplashMarketing}
          <img src="/crimini-full-logo.jpg" alt="Crimini" class="route-splash-logo route-splash-logo-marketing" />
        {:else}
          <img src="/crimini-mushrooms-only.svg" alt="" aria-hidden="true" class="route-splash-logo route-splash-logo-app" />
          <p class="route-splash-copy">Prepping . . .</p>
          <div class="route-splash-loader" aria-hidden="true"></div>
        {/if}
      </div>
    </div>
  {/if}
  <ToastStack />
  <main class="app-content" class:marketing-content={isMarketingRoute} class:onboarding-content={isOnboardingRoute}>
    <slot />
  </main>
  {#if !isOnboardingRoute}
  <footer class="app-footer" class:marketing-footer={isMarketingRoute}>
    <div class="footer-shell">
      <div class="footer-top">
        <div class="footer-brand">
          <img src="/crimini-mushrooms.svg" alt="" aria-hidden="true" class="footer-logo" />
          <div class="footer-brand-copy">
            <strong>Crimini</strong>
            <span class="footer-version">by NNS, LLC</span>
          </div>
        </div>
      </div>
      <p class="footer-copy">
        {#if isMarketingRoute}
          Restaurant workforce scheduling, prep execution, and live kitchen communication in one operational platform.
        {:else}
          Kitchen operations hub for schedules, tasks, lists, docs, recipes, and live temperature monitoring.
        {/if}
      </p>
      <nav class="footer-links" aria-label="Footer links">
        {#if isMarketingRoute}
          <a href="/">Overview</a>
          <a href="/features">Features</a>
          <a href="/how-it-works">How It Works</a>
          <a href="/about">About</a>
          <a href="/pricing">Pricing</a>
          <a href="/support">Support</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/billing-terms">Billing Terms</a>
          <a href="/account-deletion">Account Deletion</a>
          <a href="/register#onboarding-slideshow">Start Free</a>
        {:else if data.user}
          <a href="/app/about">About App</a>
          <a href="/docs">Documentation</a>
          <a href="/settings">Support</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/billing-terms">Billing Terms</a>
          <a href="/account-deletion">Account Deletion</a>
        {:else}
          <a href="/features">Features</a>
          <a href="/how-it-works">How It Works</a>
          <a href="/pricing">Pricing</a>
        {/if}
      </nav>
      <div class="footer-bottom">
        <span>&copy; 2026 Crimini by NNS, LLC</span>
        <span>{isMarketingRoute ? "Built for modern kitchen teams" : "Built for connected kitchen operations"}</span>
      </div>
    </div>
  </footer>
  {/if}
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

  .app-shell.mobile-compact .app-content {
    max-width: 1120px;
    padding: clamp(0.58rem, 1.8vw, 0.92rem);
    padding-top: calc(2.25rem + var(--safe-top));
    padding-bottom: calc(3.95rem + var(--safe-bottom));
  }

  .app-shell.mobile-compact .app-content.marketing-content {
    padding-top: calc(3.92rem + var(--safe-top));
  }

  :global(html[data-mobile-view='compact']) .hamburger {
    width: 2.45rem;
    height: 2.45rem;
    top: calc(0.62rem + var(--safe-top));
  }

  :global(html[data-mobile-view='compact']) .side-item {
    padding: 10px 11px;
    font-size: 0.9rem;
    gap: 11px;
  }

  .app-shell.marketing-app::before {
    content: none;
    display: none;
  }

  .app-shell.marketing-app::after {
    content: none;
    display: none;
  }

  :global(html:has(.app-shell.marketing-app)),
  :global(body:has(.app-shell.marketing-app)) {
    --color-primary: #111214;
    --color-primary-contrast: #ffffff;
    --color-primary-soft: rgba(17, 18, 20, 0.08);
    --color-accent: #8f826e;
    --color-bg: #ffffff;
    --color-bg-elevated: #ffffff;
    --color-surface: #ffffff;
    --color-surface-alt: #f8f4ec;
    --color-surface-soft: #f3eee5;
    --color-text: #111214;
    --color-text-muted: rgba(17, 18, 20, 0.62);
    --color-text-soft: rgba(17, 18, 20, 0.76);
    --color-border: rgba(17, 18, 20, 0.14);
    --color-divider: rgba(17, 18, 20, 0.1);
    --surface-outline: 1px solid rgba(17, 18, 20, 0.14);
    --surface-wash: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0));
    --shadow-xs: 0 1px 2px rgba(17, 18, 20, 0.04);
    --shadow-sm: 0 8px 22px rgba(17, 18, 20, 0.06);
    --shadow-md: 0 18px 42px rgba(17, 18, 20, 0.08);
    --shadow-glow: 0 1px 2px rgba(17, 18, 20, 0.04), 0 18px 42px rgba(17, 18, 20, 0.08);
    background: #ffffff !important;
    background-image: none !important;
    color-scheme: light;
  }

  :global(body:has(.app-shell.marketing-app)::before),
  :global(body:has(.app-shell.marketing-app)::after) {
    content: none !important;
    display: none !important;
    background: none !important;
    opacity: 0 !important;
  }

  .app-shell.marketing-app,
  .marketing-header,
  .marketing-footer {
    background: #ffffff;
    color: #111214;
  }

  .route-splash {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: grid;
    place-items: center;
    background: #ffffff;
    backdrop-filter: none;
  }

  .route-splash-inner {
    display: grid;
    justify-items: center;
    gap: 0.55rem;
    text-align: center;
    padding: 1rem;
  }

  .route-splash-logo {
    width: min(220px, 58vw);
    height: auto;
    display: block;
    filter: drop-shadow(0 10px 24px rgba(17, 18, 20, 0.1));
  }

  .route-splash-logo-marketing {
    width: min(360px, 76vw);
  }

  .route-splash-logo-app {
    width: min(220px, 58vw);
    filter: none;
  }

  .route-splash-copy {
    margin: 0;
    color: #111214;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.74rem;
    font-weight: 700;
  }

  .route-splash-loader {
    width: 140px;
    height: 3px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(17, 18, 20, 0.1);
  }

  .route-splash-loader::after {
    content: "";
    display: block;
    width: 44%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(64, 61, 54, 0.44), rgba(17, 18, 20, 0.86));
    animation: route-splash-load 1.1s ease-in-out infinite;
  }

  @keyframes route-splash-load {
    0% {
      transform: translateX(-120%);
    }

    100% {
      transform: translateX(300%);
    }
  }

  .app-content {
    flex: 1;
    position: relative;
    z-index: 1;
    padding: clamp(0.75rem, 2.6vw, var(--space-4));
    padding-bottom: var(--space-8);
    padding-top: calc(2.5rem + var(--safe-top));
    max-width: 1440px;
    width: 100%;
    margin: 0 auto;
  }

  .app-content.marketing-content {
    padding-top: calc(4.35rem + var(--safe-top));
    max-width: 1200px;
    display: grid;
    gap: clamp(0.85rem, 2.2vw, 1.45rem);
    background: #ffffff;
    color: #111214;
  }

  .app-content.onboarding-content {
    max-width: none;
    width: 100%;
    padding: 0;
    padding-top: 0;
    padding-bottom: 0;
    min-height: 100dvh;
  }

  :global([data-reveal]) {
    opacity: 1;
    transform: translateY(0);
  }

  :global(html.reveal-ready [data-reveal]) {
    opacity: 0;
    transform: translateY(18px);
    transition:
      opacity 460ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
    transition-delay: var(--reveal-delay, 0ms);
    will-change: opacity, transform;
  }

  :global(html.reveal-ready [data-reveal].is-visible) {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    :global([data-reveal]) {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }

  .marketing-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1100;
    padding: calc(0.5rem + var(--safe-top)) 0.75rem 0.42rem;
    background: rgba(255, 255, 255, 0.94);
    border-bottom: 1px solid rgba(17, 18, 20, 0.12);
    backdrop-filter: blur(12px);
  }

  .marketing-shell {
    width: min(1200px, 100%);
    margin: 0 auto;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.9rem;
    padding: 0.22rem 0.1rem;
  }

  .marketing-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;
  }

  .marketing-brand-logo {
    width: 3.15rem;
    height: auto;
    display: block;
    opacity: 0.98;
  }

  .marketing-nav {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .marketing-nav a {
    text-decoration: none;
    color: rgba(17, 18, 20, 0.62);
    border: 1px solid transparent;
    border-radius: 0;
    padding: 0.34rem 0.62rem;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
  }

  .marketing-nav a:hover,
  .marketing-nav a.active {
    color: #111214;
    border-bottom-color: #111214;
    background: transparent;
  }

  .marketing-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .marketing-btn {
    text-decoration: none;
    border-radius: 0;
    border: 0;
    border-bottom: 1px solid rgba(17, 18, 20, 0.22);
    padding: 0.28rem 0.12rem;
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
    color: #111214;
    background: transparent;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: border-color 140ms ease, color 140ms ease;
  }

  .marketing-btn:hover,
  .marketing-btn:focus-visible {
    border-bottom-color: #111214;
    color: #111214;
  }

  .marketing-btn-primary {
    border-bottom-color: #111214;
    background: transparent;
    color: #111214;
  }

  .marketing-menu-btn {
    display: none;
    border: 1px solid rgba(17, 18, 20, 0.18);
    background: transparent;
    color: #111214;
    border-radius: 0;
    width: 2.2rem;
    height: 2.2rem;
    align-items: center;
    justify-content: center;
  }

  .marketing-mobile-menu {
    width: min(1200px, 100%);
    margin: 0.45rem auto 0;
    border: 1px solid rgba(17, 18, 20, 0.12);
    border-radius: 0;
    background: rgba(255, 255, 255, 0.96);
    padding: 0.42rem;
    display: grid;
    gap: 0.3rem;
  }

  .marketing-mobile-menu a {
    text-decoration: none;
    color: #111214;
    border-radius: 0;
    border: 0;
    border-bottom: 1px solid rgba(17, 18, 20, 0.16);
    background: transparent;
    padding: 0.42rem 0.12rem;
    font-size: 0.78rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .marketing-mobile-menu a.active {
    border-bottom-color: #111214;
  }

  .marketing-mobile-cta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.3rem;
    margin-top: 0.15rem;
  }

  .marketing-mobile-cta a.primary {
    border-bottom-color: #111214;
    background: transparent;
    color: #111214;
  }

  /* ===== Hamburger ===== */
  .hamburger {
    position: fixed;
    top: calc(0.75rem + var(--safe-top));
    left: calc(0.75rem + var(--safe-left));
    z-index: 1001;

    background: color-mix(in srgb, var(--color-surface) 90%, transparent);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
    width: 2.7rem;
    height: 2.7rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(12px);
    color: var(--color-text);
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
  }

  .hamburger:hover {
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
    background: color-mix(in srgb, var(--color-surface-alt) 92%, transparent);
  }

  .menu-icon {
    width: 1.72rem;
    height: 1.22rem;
    object-fit: contain;
  }

  .hamburger.open,
  .hamburger:focus-visible {
    border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border));
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
    height: 100dvh;
    width: min(82vw, 300px);

    background: var(--surface-wash), color-mix(in srgb, var(--color-surface) 94%, black 6%);
    border-right: 1px solid var(--color-border);
    box-shadow: 12px 0 30px rgba(0,0,0,0.22);
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

  @media (hover: hover) and (pointer: fine) {
    .sidebar {
      overflow-y: scroll !important;
      scrollbar-gutter: stable;
      scrollbar-width: thin !important;
      scrollbar-color: color-mix(in srgb, var(--color-text) 28%, transparent) transparent;
    }

    .sidebar::-webkit-scrollbar {
      display: block !important;
      width: 8px;
    }

    .sidebar::-webkit-scrollbar-track {
      background: transparent;
    }

    .sidebar::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, var(--color-text) 24%, transparent);
      border-radius: 0;
    }

    .sidebar::-webkit-scrollbar-thumb:hover {
      background: color-mix(in srgb, var(--color-text) 38%, transparent);
    }
  }

  @media (hover: none), (pointer: coarse) {
    .sidebar {
      scrollbar-width: none !important;
    }

    .sidebar::-webkit-scrollbar {
      display: none !important;
    }
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-inner {
    min-height: 100%;
    padding: 0 14px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sidebar-footer {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding: 0.72rem 0.15rem 0.1rem;
    background: color-mix(in srgb, var(--color-surface) 97%, transparent);
  }

  .sidebar-theme-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 0.7rem 0.42rem 0.2rem;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
  }

  .sidebar-theme-toggle:hover,
  .sidebar-theme-toggle.active {
    color: var(--color-text);
  }

  .sidebar-theme-toggle .material-icons {
    font-size: 1.42rem;
    line-height: 1;
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.38rem;
    margin-bottom: 0.15rem;
    padding: calc(0.72rem + var(--safe-top)) 8px 0.62rem;
    border-bottom: 1px solid var(--color-divider);
    position: sticky;
    top: 0;
    z-index: 1;
    background: color-mix(in srgb, var(--color-surface) 96%, black 4%);
    backdrop-filter: blur(12px);
  }

  .brand-mark {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--color-surface-alt) 88%, var(--color-primary) 12%);
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border));
    color: var(--color-primary-contrast);
    font-weight: var(--weight-bold);
    letter-spacing: 0.03em;
    margin-left: 3.25rem;
  }

  .brand-mark-image {
    object-fit: cover;
    padding: 0;
    background: color-mix(in srgb, var(--color-surface-alt) 90%, black 10%);
  }

  .brand-copy {
    flex: 1 0 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 0.18rem;
  }

  .brand-copy strong {
    color: var(--color-text);
    font-size: 0.95rem;
    line-height: 1.1;
  }

  .workspace-switch-form {
    flex: 1 0 100%;
    margin-left: 0;
  }

  .workspace-switch-form select {
    width: 100%;
    border: 1px solid color-mix(in srgb, var(--color-border) 84%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-surface-alt) 86%, transparent);
    color: var(--color-text);
    padding: 0.42rem 0.55rem;
    font: inherit;
    font-size: 0.78rem;
    outline: none;
  }

  .workspace-switch-form select:focus {
    border-color: color-mix(in srgb, var(--color-primary) 36%, var(--color-border));
  }

  /* ===== Sidebar Items ===== */
  .side-group {
    display: grid;
    gap: 4px;
  }

  .side-group-summary {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--text-md);
    font-weight: var(--weight-medium);
    list-style: none;
    transition: background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease;
  }

  .side-group-summary::-webkit-details-marker {
    display: none;
  }

  .side-group-summary:hover,
  .side-group-summary.active {
    background: color-mix(in srgb, var(--color-surface-alt) 84%, transparent);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .side-group-summary:hover {
    transform: translateX(2px);
  }

  .side-group-summary .material-icons {
    font-size: 20px;
  }

  .expand-icon {
    margin-left: auto;
    font-size: 18px;
    transition: transform 160ms ease;
  }

  .side-group[open] .expand-icon {
    transform: rotate(180deg);
  }

  .side-group-items {
    display: grid;
    gap: 3px;
    padding-left: 0.6rem;
  }

  .side-group-items--standalone {
    padding-left: 0;
  }

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
    border-color: var(--color-border);
    color: var(--color-text);
    transform: translateX(2px);
  }

  .side-item .material-icons {
    font-size: 20px;
  }

  .side-sub-item {
    padding: 10px 12px;
    font-size: 0.9rem;
  }

  .side-sub-item .material-icons {
    font-size: 18px;
  }

  .side-section-label {
    margin-top: 0.45rem;
    margin-bottom: 0.2rem;
    padding: 0 0.3rem;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    font-weight: var(--weight-semibold);
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
    background: color-mix(in srgb, var(--color-surface-alt) 88%, var(--color-primary) 12%);
    border-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-border));
  }

  .side-item.active .active-indicator {
    opacity: 1;
  }

  .app-footer {
    margin-top: auto;
    position: relative;
    border-top: 1px solid var(--color-divider);
    color: var(--color-text-muted);
    font-size: 0.78rem;
    padding: 1rem 1rem calc(0.95rem + var(--safe-bottom));
    background: var(--surface-wash), color-mix(in srgb, var(--color-bg) 92%, black 8%);
    backdrop-filter: blur(14px);
    box-shadow: none;
  }

  .app-footer.marketing-footer {
    margin-top: 2rem;
    background: var(--surface-wash), color-mix(in srgb, var(--color-bg) 94%, black 6%);
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
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 35%, transparent), transparent);
    box-shadow: none;
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
      drop-shadow(0 0 10px rgba(132, 146, 166, 0.18));
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
    border-color: rgba(122, 132, 148, 0.22);
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

  .hamburger {
    background: transparent;
    border-color: transparent;
    border-radius: 0;
    box-shadow: none;
    backdrop-filter: none;
  }

  .hamburger:hover,
  .hamburger.open,
  .hamburger:focus-visible {
    background: transparent;
    border-color: transparent;
  }

  .sidebar {
    background: color-mix(in srgb, var(--color-surface) 97%, transparent);
    border-right: 1px solid var(--color-border);
    box-shadow: 10px 0 26px rgba(17, 18, 20, 0.08);
  }

  :global(html[data-theme='dark']) .sidebar {
    box-shadow: 10px 0 26px rgba(0, 0, 0, 0.26);
  }

  .sidebar-brand {
    background: color-mix(in srgb, var(--color-surface) 97%, transparent);
    border-bottom-color: var(--color-divider);
  }

  .sidebar-footer {
    background: color-mix(in srgb, var(--color-surface) 97%, transparent);
  }

  .brand-mark {
    border-radius: 999px;
    background: transparent;
    color: var(--color-text);
    border-color: var(--color-border);
  }

  .brand-mark-image {
    background: transparent;
    border-color: transparent;
  }

  .side-group-summary,
  .side-item {
    border-radius: 0;
    border-color: transparent;
  }

  .side-group-summary:hover,
  .side-group-summary.active,
  .side-item:hover,
  .side-item.active {
    background: transparent;
    border-bottom-color: var(--color-text);
    color: var(--color-text);
    transform: none;
  }

  .active-indicator {
    width: 2px;
    background: var(--color-text);
  }

  .app-shell:not(.marketing-app) .app-footer {
    background: var(--color-bg);
    border-top-color: var(--color-divider);
    backdrop-filter: none;
  }

  .app-shell:not(.marketing-app) .app-footer::before,
  .app-shell:not(.marketing-app) .footer-shell::after {
    content: none;
  }

  .app-shell:not(.marketing-app) .footer-logo {
    filter: none;
  }

  .app-shell:not(.marketing-app) .footer-bottom {
    border-top-color: var(--color-divider);
  }

  .app-shell:not(.marketing-app) .app-footer a {
    border-radius: 0;
    border-color: transparent;
    border-bottom-color: var(--color-border);
    background: transparent;
  }

  .app-shell:not(.marketing-app) .app-footer a:hover {
    border-bottom-color: var(--color-text);
    background: transparent;
    color: var(--color-text);
  }

  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle)) {
    width: fit-content !important;
    min-width: 0 !important;
    min-height: 0 !important;
    border: 0 !important;
    border-bottom: 1px solid var(--color-border) !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: var(--color-text-soft) !important;
    padding: 0.28rem 0.18rem !important;
    font-weight: var(--weight-regular);
    line-height: 1.2;
    transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
  }

  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle):hover),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle):focus-visible) {
    border-bottom-color: var(--color-text) !important;
    background: transparent !important;
    color: var(--color-text) !important;
  }

  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).active),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).selected),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).filter-active),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).duplicate-day-btn-active),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).department-chip-active),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).autofill-preferred),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle)[aria-pressed='true']) {
    border-bottom-color: var(--color-text) !important;
    background: transparent !important;
    color: var(--color-text) !important;
    font-weight: var(--weight-bold) !important;
  }

  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).danger),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).danger-btn),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).danger-action),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).remove-btn),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).text-action.danger) {
    border-bottom-color: color-mix(in srgb, var(--color-error) 46%, var(--color-border)) !important;
    background: transparent !important;
    color: color-mix(in srgb, var(--color-error) 72%, var(--color-text)) !important;
  }

  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).success),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).approve-action),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).success-action),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).text-action.success) {
    border-bottom-color: color-mix(in srgb, var(--color-success) 46%, var(--color-border)) !important;
    background: transparent !important;
    color: color-mix(in srgb, var(--color-success) 72%, var(--color-text)) !important;
  }

  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).warn-action),
  .app-shell:not(.marketing-app) :global(button:not(.card-hit):not(.shift-toggle).warn-text) {
    border-bottom-color: color-mix(in srgb, var(--color-warning) 46%, var(--color-border)) !important;
    background: transparent !important;
    color: color-mix(in srgb, var(--color-warning) 72%, var(--color-text)) !important;
  }

  .app-shell:not(.marketing-app) :global(.inline-action),
  .app-shell:not(.marketing-app) :global(.inline-link),
  .app-shell:not(.marketing-app) :global(.source-link),
  .app-shell:not(.marketing-app) :global(.control-link),
  .app-shell:not(.marketing-app) :global(.week-nav-btn),
  .app-shell:not(.marketing-app) :global(.settings-link),
  .app-shell:not(.marketing-app) :global(.doc-actions a),
  .app-shell:not(.marketing-app) :global(.toolbar-actions a),
  .app-shell:not(.marketing-app) :global(.menu-link) {
    width: fit-content !important;
    min-width: 0 !important;
    min-height: auto !important;
    border: 0 !important;
    border-bottom: 1px solid var(--color-border) !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: var(--color-text-soft) !important;
    padding: 0.28rem 0.18rem !important;
    font-weight: var(--weight-regular);
    line-height: 1.2;
    text-decoration: none;
    transition: border-color 150ms ease, color 150ms ease;
  }

  .app-shell:not(.marketing-app) :global(.action-btn),
  .app-shell:not(.marketing-app) :global(.viewer header a) {
    width: fit-content !important;
    min-width: 0 !important;
    min-height: 0 !important;
    border: 0 !important;
    border-bottom: 1px solid var(--color-border) !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: var(--color-text-soft) !important;
    padding: 0.28rem 0.18rem !important;
    font-weight: var(--weight-regular);
    line-height: 1.2;
    text-decoration: none;
  }

  .app-shell:not(.marketing-app) :global(.inline-action:hover),
  .app-shell:not(.marketing-app) :global(.inline-link:hover),
  .app-shell:not(.marketing-app) :global(.source-link:hover),
  .app-shell:not(.marketing-app) :global(.control-link:hover),
  .app-shell:not(.marketing-app) :global(.week-nav-btn:hover),
  .app-shell:not(.marketing-app) :global(.settings-link:hover),
  .app-shell:not(.marketing-app) :global(.doc-actions a:hover),
  .app-shell:not(.marketing-app) :global(.toolbar-actions a:hover),
  .app-shell:not(.marketing-app) :global(.menu-link:hover),
  .app-shell:not(.marketing-app) :global(.action-btn:hover),
  .app-shell:not(.marketing-app) :global(.viewer header a:hover) {
    border-bottom-color: var(--color-text) !important;
    color: var(--color-text) !important;
  }

  .app-shell:not(.marketing-app) :global(.app-panel),
  .app-shell:not(.marketing-app) :global(.ui-section),
  .app-shell:not(.marketing-app) :global(.panel),
  .app-shell:not(.marketing-app) :global(.card),
  .app-shell:not(.marketing-app) :global([class$='card']),
  .app-shell:not(.marketing-app) :global([class*='-card']),
  .app-shell:not(.marketing-app) :global([class$='tile']),
  .app-shell:not(.marketing-app) :global([class*='-tile']) {
    box-shadow: none !important;
    background-image: none !important;
  }

  .app-shell:not(.marketing-app) :global(.panel),
  .app-shell:not(.marketing-app) :global(.editor-panel),
  .app-shell:not(.marketing-app) :global(.settings-panel),
  .app-shell:not(.marketing-app) :global(.admin-panel),
  .app-shell:not(.marketing-app) :global(.form-panel),
  .app-shell:not(.marketing-app) :global(.workspace-panel),
  .app-shell:not(.marketing-app) :global(.section-card),
  .app-shell:not(.marketing-app) :global(.editor-card),
  .app-shell:not(.marketing-app) :global(.form-card),
  .app-shell:not(.marketing-app) :global(.toggle-card),
  .app-shell:not(.marketing-app) :global(.list-card),
  .app-shell:not(.marketing-app) :global(.doc-card),
  .app-shell:not(.marketing-app) :global(.recipe-card),
  .app-shell:not(.marketing-app) :global(.vendor-card) {
    border-radius: 0 !important;
    border-color: var(--color-divider) !important;
    background: transparent !important;
  }

  .app-shell:not(.marketing-app) :global(input),
  .app-shell:not(.marketing-app) :global(select),
  .app-shell:not(.marketing-app) :global(textarea) {
    border: 0 !important;
    border-bottom: 1px solid var(--color-border) !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: var(--color-text) !important;
  }

  .app-shell:not(.marketing-app) :global(input:focus),
  .app-shell:not(.marketing-app) :global(select:focus),
  .app-shell:not(.marketing-app) :global(textarea:focus) {
    border-bottom-color: var(--color-text) !important;
    box-shadow: none !important;
  }

  .app-shell:not(.marketing-app) :global(select option),
  .app-shell:not(.marketing-app) :global(select optgroup) {
    background-color: var(--color-surface) !important;
    color: var(--color-text) !important;
  }

  :global(html[data-theme='dark']) .app-shell:not(.marketing-app) :global(select option),
  :global(html[data-theme='dark']) .app-shell:not(.marketing-app) :global(select optgroup) {
    background-color: var(--color-surface-alt) !important;
    color: var(--color-text) !important;
  }

  .app-shell:not(.marketing-app) :global(table) {
    border-collapse: collapse;
  }

  .app-shell:not(.marketing-app) :global(th),
  .app-shell:not(.marketing-app) :global(td) {
    border-color: var(--color-divider) !important;
  }

  .app-shell:not(.marketing-app) :global(.status-pill),
  .app-shell:not(.marketing-app) :global(.pill),
  .app-shell:not(.marketing-app) :global(.badge),
  .app-shell:not(.marketing-app) :global(.tag),
  .app-shell:not(.marketing-app) :global(.chip) {
    border-radius: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
  }

  .app-shell:not(.marketing-app) :global(.menu-list button) {
    width: 100% !important;
    justify-self: stretch;
    border-bottom-color: var(--color-divider) !important;
    padding: 0.56rem 0.12rem !important;
    text-align: left;
  }

  .app-shell:not(.marketing-app) :global(.menu-list button.active),
  .app-shell:not(.marketing-app) :global(.menu-list button:hover) {
    border-bottom-color: var(--color-text) !important;
    background: transparent !important;
  }

  .app-shell:not(.marketing-app) :global(.menu-list button.active) {
    color: var(--color-text) !important;
    font-weight: var(--weight-bold) !important;
  }

  @media (max-width: 760px) {
    .marketing-header {
      padding-inline: 0.55rem;
    }

    .marketing-shell {
      grid-template-columns: auto 1fr auto;
      gap: 0.55rem;
      padding: 0.42rem 0.5rem;
    }

    .marketing-brand-logo {
      width: 2.45rem;
    }

    .marketing-nav,
    .marketing-btn {
      display: none;
    }

    .marketing-menu-btn {
      display: inline-flex;
    }

    .app-content.marketing-content {
      padding-top: calc(4.15rem + var(--safe-top));
    }

    .app-content {
      padding-bottom: calc(4.5rem + var(--safe-bottom));
    }

    .sidebar-inner {
      padding-top: 0;
      padding-bottom: calc(16px + var(--safe-bottom));
    }

    .sidebar-brand {
      padding-inline: 6px;
      padding-top: calc(0.62rem + var(--safe-top));
    }

    .brand-mark {
      margin-left: 3rem;
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

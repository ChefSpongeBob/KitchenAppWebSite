<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { cameraBetaEnabled } from '$lib/config/features';
  import {
    canRoleAccessFeature,
    defaultAppFeatureModes,
    type AppFeatureKey
  } from '$lib/features/appFeatures';

  type AdminRoute = {
    href: string;
    label: string;
    matches: (path: string) => boolean;
    featureKey?: AppFeatureKey;
  };

  function exact(pathname: string) {
    return (path: string) => path === pathname;
  }

  function prefix(pathname: string) {
    return (path: string) => path === pathname || path.startsWith(`${pathname}/`);
  }

  const menuItems: AdminRoute[] = [
    { href: '/admin/app-editor', label: 'App Editor', matches: prefix('/admin/app-editor') },
    { href: '/admin/app-editor#business-registry', label: 'Business Registry', matches: prefix('/admin/app-editor') },
    { href: '/admin/category-creator', label: 'Category Creator', matches: prefix('/admin/category-creator') },
    { href: '/admin/creator', label: 'Creator Studio', matches: prefix('/admin/creator') },
    { href: '/admin', label: 'Dashboard', matches: exact('/admin') },
    { href: '/admin/documents', label: 'Documents', matches: prefix('/admin/documents'), featureKey: 'documents' },
    { href: '/admin/onboarding', label: 'Employee Onboarding', matches: prefix('/admin/onboarding') },
    { href: '/admin/users', label: 'Employees', matches: prefix('/admin/users') },
    { href: '/admin/lists', label: 'Lists', matches: prefix('/admin/lists'), featureKey: 'lists' },
    { href: '/admin/menus', label: 'Menus', matches: prefix('/admin/menus'), featureKey: 'menus' },
    { href: '/admin/recipes', label: 'Recipes', matches: prefix('/admin/recipes'), featureKey: 'recipes' },
    { href: '/admin/schedule', label: 'Schedule', matches: prefix('/admin/schedule'), featureKey: 'scheduling' },
    { href: '/admin/schedule-settings', label: 'Schedule Settings', matches: prefix('/admin/schedule-settings'), featureKey: 'scheduling' },
    { href: '/admin/schedule-roles', label: 'Schedule Roles', matches: prefix('/admin/schedule-roles'), featureKey: 'scheduling' },
    ...(cameraBetaEnabled
      ? [{ href: '/admin/camera', label: 'Camera Activity (Beta)', matches: prefix('/admin/camera') }]
      : [])
  ];

  $: currentPath = $page.url.pathname;
  $: currentHash = $page.url.hash;
  $: featureModes = $page.data?.featureModes ?? defaultAppFeatureModes;
  $: visibleMenuItems = menuItems.filter((item) =>
    item.featureKey ? canRoleAccessFeature(featureModes[item.featureKey], 'admin') : true
  );
  $: selectedHref =
    currentPath === '/admin/app-editor' && currentHash === '#business-registry'
      ? '/admin/app-editor#business-registry'
      : visibleMenuItems.find((item) => item.matches(currentPath))?.href ?? '/admin';

  async function openAdminEditor(event: Event) {
    const target = event.currentTarget as HTMLSelectElement | null;
    const href = target?.value ?? '';
    if (!href || href === `${currentPath}${currentHash}`) return;
    await goto(href);
  }
</script>

<section class="admin-editor-menu" aria-label="Admin editor navigation">
  <div class="editor-select-wrap">
    <span class="material-icons" aria-hidden="true">tune</span>
    <select
      id="admin-editor-select"
      aria-label="Admin editor navigation"
      value={selectedHref}
      on:change={openAdminEditor}
    >
      {#each visibleMenuItems as item}
        <option value={item.href}>{item.label}</option>
      {/each}
    </select>
  </div>
</section>

<style>
  .admin-editor-menu {
    display: grid;
    gap: 0;
    width: 100%;
  }

  .editor-select-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .editor-select-wrap .material-icons {
    position: absolute;
    left: 0.7rem;
    font-size: 1rem;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .editor-select-wrap::after {
    content: 'expand_more';
    position: absolute;
    right: 0.65rem;
    font-family: 'Material Icons';
    font-size: 1.05rem;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .editor-select-wrap select {
    width: 100%;
    appearance: none;
    padding: 0.52rem 2rem 0.52rem 2.2rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--color-text);
    font-size: 0.82rem;
    font-weight: var(--weight-medium);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
  }
</style>

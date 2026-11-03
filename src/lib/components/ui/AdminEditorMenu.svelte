<script lang="ts">
  import { goto } from '$app/navigation';
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
  import { defaultAppFeatureModes } from '#lib/features/appFeatures.ts';
  import {
    canViewManagerNavigationItem,
    isManagerNavigationItemActive,
    managerNavigationGroups
  } from '#lib/navigation/managerNavigation.ts';

  $: currentPath = $page.url.pathname;
  $: currentSearch = $page.url.search;
  $: featureModes = $page.data?.featureModes ?? defaultAppFeatureModes;
  $: activeUser = $page.data?.user;
  $: visibleGroups = managerNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canViewManagerNavigationItem(item, activeUser, featureModes)
      )
    }))
    .filter((group) => group.items.length > 0);
  $: visibleMenuItems = visibleGroups.flatMap((group) => group.items);
  $: selectedHref =
    visibleMenuItems.find((item) =>
      isManagerNavigationItemActive(item, currentPath, currentSearch)
    )?.href ?? '/admin';

  async function openAdminEditor(event: Event) {
    const target = event.currentTarget as HTMLSelectElement | null;
    const href = target?.value ?? '';
    if (!href || href === currentPath) return;
    await goto(href);
  }
</script>

<section class="admin-editor-menu" aria-label="Manager editor navigation">
  <div class="editor-select-wrap">
    <span class="material-icons" aria-hidden="true">tune</span>
    <select
      id="admin-editor-select"
      aria-label="Manager editor navigation"
      value={selectedHref}
      on:change={openAdminEditor}
    >
      {#each visibleGroups as group}
        <optgroup label={group.label}>
          {#each group.items as item}
            <option value={item.href}>{item.label}</option>
          {/each}
        </optgroup>
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
    border-radius: 0;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    font-size: 0.82rem;
    font-weight: var(--weight-medium);
    background: transparent;
  }
</style>

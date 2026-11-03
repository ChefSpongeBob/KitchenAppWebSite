<script lang="ts">
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
  import Layout from '#lib/components/ui/Layout.svelte';
  import PageHeader from '#lib/components/ui/PageHeader.svelte';
  import type { LayoutData } from './$types';
  export let data: LayoutData;
</script>

<Layout>
  <PageHeader title="Crimini Staff" />
  <nav class="staff-nav" aria-label="Staff console">
    <a href="/staff/businesses" aria-current={$page.url.pathname.startsWith('/staff/businesses') ? 'page' : undefined}>Businesses</a>
    <a href="/staff/equipment" aria-current={$page.url.pathname === '/staff/equipment' ? 'page' : undefined}>Equipment</a>
    <a href="/staff/health" aria-current={$page.url.pathname === '/staff/health' ? 'page' : undefined}>System Health</a>
    {#if data.staff.role === 'owner'}<a href="/staff/team" aria-current={$page.url.pathname === '/staff/team' ? 'page' : undefined}>Staff</a>{/if}
    {#if data.staff.role === 'owner'}<a href="/staff/activity" aria-current={$page.url.pathname === '/staff/activity' ? 'page' : undefined}>Activity</a>{/if}
    <a href="/staff/security" aria-current={$page.url.pathname === '/staff/security' ? 'page' : undefined}>Security</a>
    {#if data.hasWorkspace}<a href="/app">Open Crimini</a>{/if}
    <form method="POST" action="/logout"><button type="submit">Sign Out</button></form>
  </nav>
  <div class="staff-workspace"><slot /></div>
</Layout>

<style>
  .staff-nav { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0.8rem 0; margin-bottom: 1rem; border-bottom: 1px solid var(--color-divider); }
  .staff-nav a { color: var(--color-text); text-decoration: none; border-bottom: 1px solid var(--color-divider); padding: 0.3rem 0; font-size: 0.8rem; }
  .staff-nav a[aria-current] { font-weight: 700; border-bottom-color: currentColor; }
  .staff-workspace :global(h2) { margin: 0 0 1rem; font-size: 1.15rem; }
  .staff-workspace :global(.staff-toolbar) { display: flex; gap: 0.7rem; align-items: end; flex-wrap: wrap; margin: 0 0 1rem; }
  .staff-workspace :global(label) { display: grid; gap: 0.25rem; font-size: 0.8rem; }
  .staff-workspace :global(input) { max-width: 100%; min-width: 0; }
  .staff-workspace :global(.staff-confirm) { display: flex; align-items: center; gap: 0.4rem; }
  .staff-workspace :global(.staff-confirm input) { width: 0.9rem; height: 0.9rem; margin: 0; flex: 0 0 auto; }
  .staff-workspace :global(.staff-table-wrap) { overflow-x: auto; }
  .staff-workspace :global(table) { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .staff-workspace :global(th), .staff-workspace :global(td) { padding: 0.8rem 0.65rem; text-align: left; border-bottom: 1px solid var(--color-divider); vertical-align: top; }
  .staff-workspace :global(th) { font-weight: 600; color: var(--color-text-muted); }
  .staff-workspace :global(.staff-pagination) { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1rem; }
  .staff-workspace :global(.staff-summary) { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding: 1rem 0; border-block: 1px solid var(--color-divider); margin-bottom: 1rem; }
  .staff-workspace :global(dt) { font-size: 0.75rem; color: var(--color-text-muted); }
  .staff-workspace :global(dd) { margin: 0.3rem 0 0; overflow-wrap: anywhere; }
  .staff-workspace :global(.staff-feedback) { padding-block: 0.7rem; border-block: 1px solid var(--color-divider); }
  .staff-workspace :global(.staff-feedback.error) { color: var(--color-error); }
</style>

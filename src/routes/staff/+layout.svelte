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
    <a href="/staff" aria-current={$page.url.pathname === '/staff' ? 'page' : undefined}>Dashboard</a>
    <a href="/staff/businesses" aria-current={$page.url.pathname.startsWith('/staff/businesses') ? 'page' : undefined}>Businesses</a>
    {#if data.staff.role !== 'equipment'}<a href="/staff/support" aria-current={$page.url.pathname.startsWith('/staff/support') ? 'page' : undefined}>Support</a>{/if}
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
  .staff-workspace :global(.staff-dashboard) { display: grid; gap: 1rem; padding-bottom: 2rem; }
  .staff-workspace :global(.staff-overview-header) { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .staff-workspace :global(.staff-overview-header h2) { font-size: 1.65rem; margin: 0.25rem 0 0; }
  .staff-workspace :global(.staff-kicker) { font-size: 0.67rem; text-transform: uppercase; letter-spacing: 0.09em; color: var(--color-text-muted); }
  .staff-workspace :global(.staff-period) { margin: 0; }
  .staff-workspace :global(.staff-business-search) { max-width: 38rem; }
  .staff-workspace :global(.staff-business-search > div) { display: flex; align-items: center; gap: 1rem; margin-top: 0.4rem; }
  .staff-workspace :global(.staff-business-search input) { flex: 1; }
  .staff-workspace :global(.staff-overview-totals) { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; padding-block: 1rem; margin: 0; }
  .staff-workspace :global(.staff-overview-totals dd) { font-size: clamp(1.7rem, 3vw, 2.5rem); font-family: Georgia, serif; }
  .staff-workspace :global(.staff-overview-totals a) { color: inherit; text-decoration: none; }
  .staff-workspace :global(.staff-overview-grid) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem 2rem; }
  .staff-workspace :global(.staff-service-list > *) { display: flex; justify-content: space-between; gap: 1rem; padding: 0.85rem 0; font-size: 0.78rem; color: var(--color-text); text-decoration: none; border-bottom: 1px solid var(--color-divider); }
  .staff-workspace :global(.staff-service-list strong) { text-align: right; font-weight: 500; }
  .staff-workspace :global(.staff-inline-action) { display: inline-block; margin-top: 1rem; font-size: 0.8rem; }
  .staff-workspace :global(.staff-trend) { display: flex; align-items: end; gap: 4px; height: 9rem; padding-top: 0.8rem; border-bottom: 1px solid var(--color-divider); }
  .staff-workspace :global(.staff-trend > div) { display: flex; align-items: end; flex: 1; max-width: 36px; height: 100%; }
  .staff-workspace :global(.staff-trend span) { display: block; width: 100%; background: var(--color-text-muted); }
  .staff-workspace :global(.staff-trend-caption) { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.6rem; color: var(--color-text-muted); margin-top: 0.6rem; }
  .staff-workspace :global(.staff-trend-single) { display: grid; gap: 0.35rem; padding-block: 0.6rem 1rem; }
  .staff-workspace :global(.staff-trend-single strong) { font: 2.5rem Georgia, serif; }
  .staff-workspace :global(.staff-trend-single span), .staff-workspace :global(.staff-trend-single time) { font-size: 0.73rem; color: var(--color-text-muted); }
  .staff-workspace :global(.staff-business-context) { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .staff-workspace :global(.staff-business-context h2) { margin: 0.4rem 0; }
  .staff-workspace :global(.staff-record-header) { display: grid; gap: 0.5rem; margin-block: 1rem; }
  .staff-workspace :global(.staff-record-header h2) { margin: 0; overflow-wrap: anywhere; }
  .staff-workspace :global(.staff-message) { padding-block: 1rem; border-bottom: 1px solid var(--color-divider); }
  .staff-workspace :global(.staff-message header) { display: flex; gap: 1rem; flex-wrap: wrap; color: var(--color-text-muted); font-size: 0.72rem; }
  .staff-workspace :global(.staff-message p) { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.85rem; margin: 0.6rem 0 0; }
  .staff-workspace :global(.staff-form-grid) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; max-width: 54rem; }
  .staff-workspace :global(.staff-form-grid .staff-full-width) { grid-column: 1 / -1; }
  .staff-workspace :global(textarea) { width: 100%; min-height: 7rem; resize: vertical; }
  .staff-workspace :global(.staff-panel), .staff-workspace :global(.staff-command) { position: relative; padding-block: 1rem; }
  .staff-workspace :global(.staff-panel)::before, .staff-workspace :global(.staff-command)::before { content: ''; position: absolute; inset: 0 0 auto; height: 1px; background: linear-gradient(90deg, transparent, var(--color-divider) 10%, var(--color-divider) 85%, transparent); }
  .staff-workspace :global(.staff-command) { display: grid; grid-template-columns: minmax(200px, 1fr) 2fr; align-items: center; gap: 1rem; }
  .staff-workspace :global(.staff-command-title) { display: flex; align-items: center; gap: 0.7rem; }
  .staff-workspace :global(.staff-command-title small) { color: var(--color-text-muted); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .staff-workspace :global(.staff-command-title h2) { margin: 0.2rem 0 0; }
  .staff-workspace :global(.staff-snapshot) { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0; }
  .staff-workspace :global(.staff-snapshot > div) { padding: 0.5rem 0.8rem; border-left: 1px solid var(--color-divider); }
  .staff-workspace :global(.staff-snapshot dd) { font-size: 1.25rem; font-weight: 600; }
  .staff-workspace :global(.staff-dashboard-toolbar), .staff-workspace :global(.staff-check-time) { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.8rem; }
  .staff-workspace :global(.staff-check-time) { font-size: 0.72rem; color: var(--color-text-muted); }
  .staff-workspace :global(.staff-dashboard-columns) { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: 1.6rem; }
  .staff-workspace :global(.staff-dashboard-main), .staff-workspace :global(.staff-dashboard-aside) { min-width: 0; }
  .staff-workspace :global(.staff-panel-heading) { display: flex; align-items: baseline; justify-content: space-between; gap: 0.8rem; margin-bottom: 0.85rem; }
  .staff-workspace :global(.staff-panel-heading h2) { margin: 0; }
  .staff-workspace :global(.staff-panel-heading > span), .staff-workspace :global(.staff-panel-heading a), .staff-workspace :global(.staff-note) { font-size: 0.72rem; color: var(--color-text-muted); }
  .staff-workspace :global(.staff-filters select) { min-width: 8rem; }
  .staff-workspace :global(.staff-issue) { padding: 0.9rem 0 0.9rem 0.7rem; border-left: 2px solid var(--color-divider); border-bottom: 1px solid var(--color-divider); }
  .staff-workspace :global(.staff-issue-error) { border-left-color: var(--color-error); }
  .staff-workspace :global(.staff-issue-title), .staff-workspace :global(.staff-issue-detail) { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem 0.9rem; font-size: 0.8rem; }
  .staff-workspace :global(.staff-issue-title > span), .staff-workspace :global(.staff-issue-detail) { color: var(--color-text-muted); }
  .staff-workspace :global(.staff-issue-detail) { margin-top: 0.4rem; font-size: 0.7rem; overflow-wrap: anywhere; }
  .staff-workspace :global(.staff-issue-facts) { display: grid; grid-template-columns: auto 1fr 1fr auto; gap: 0.65rem; margin: 0.8rem 0; }
  .staff-workspace :global(.staff-issue-facts dt) { font-size: 0.65rem; }
  .staff-workspace :global(.staff-issue-facts dd) { font-size: 0.72rem; }
  .staff-workspace :global(.staff-reference) { font-size: 0.68rem; overflow-wrap: anywhere; }
  .staff-workspace :global(.staff-reference summary) { cursor: pointer; width: fit-content; border-bottom: 1px solid var(--color-divider); }
  .staff-workspace :global(.staff-empty) { padding: 1rem 0; font-size: 0.8rem; color: var(--color-text-muted); }
  .staff-workspace :global(.staff-cell-meta) { display: block; margin-top: 0.25rem; color: var(--color-text-muted); font-size: 0.68rem; }
  .staff-workspace :global(.staff-warning) { font-weight: 600; }
  .staff-workspace :global(.staff-workspace-links) { display: grid; }
  .staff-workspace :global(.staff-workspace-links a) { display: flex; align-items: center; gap: 0.8rem; padding: 1rem 0; text-decoration: none; border-bottom: 1px solid var(--color-divider); color: var(--color-text); }
  .staff-workspace :global(.staff-workspace-links small) { display: block; font-size: 0.7rem; color: var(--color-text-muted); margin-top: 0.25rem; }
  .staff-workspace :global(.staff-activity-list) { list-style: none; padding: 0; margin: 0; }
  .staff-workspace :global(.staff-activity-list li) { display: grid; gap: 0.3rem; padding: 0.8rem 0; border-bottom: 1px solid var(--color-divider); font-size: 0.75rem; }
  .staff-workspace :global(.staff-activity-list time) { color: var(--color-text-muted); font-size: 0.68rem; }
  .staff-workspace :global(.staff-business-tabs) { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0; }
  .staff-workspace :global(.staff-business-tabs a) { font-size: 0.8rem; text-decoration: none; color: var(--color-text); border-bottom: 1px solid var(--color-divider); padding-block: 0.4rem; }
  .staff-workspace :global(.staff-business-tabs a[aria-current]) { font-weight: 700; border-bottom-color: currentColor; }
  @media (max-width: 850px) {
    .staff-workspace :global(.staff-overview-grid) { grid-template-columns: 1fr; }
    .staff-workspace :global(.staff-dashboard-columns) { grid-template-columns: 1fr; gap: 0.5rem; }
    .staff-workspace :global(.staff-command) { grid-template-columns: 1fr; }
    .staff-workspace :global(.staff-issue-facts) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 500px) {
    .staff-workspace :global(.staff-form-grid) { grid-template-columns: 1fr; }
  }
</style>

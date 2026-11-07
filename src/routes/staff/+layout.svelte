<script lang="ts">
  import { page as pageState } from '$app/state';
  import { toStore } from 'svelte/store';
  const page = toStore(() => ({ ...pageState }));
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';
  export let data: LayoutData;
  export let children: Snippet;
</script>

{#snippet navigation()}
  <nav class="staff-nav" aria-label="Staff console">
    <a href="/staff" aria-current={$page.url.pathname === '/staff' ? 'page' : undefined}>Dashboard</a>
    <a href="/staff/businesses" aria-current={$page.url.pathname.startsWith('/staff/businesses') ? 'page' : undefined}>Businesses</a>
    {#if data.staff?.role !== 'equipment'}<a href="/staff/support" aria-current={$page.url.pathname.startsWith('/staff/support') ? 'page' : undefined}>Support</a>{/if}
    <a href="/staff/equipment" aria-current={$page.url.pathname === '/staff/equipment' ? 'page' : undefined}>Equipment</a>
    <a href="/staff/health" aria-current={$page.url.pathname === '/staff/health' ? 'page' : undefined}>System Health</a>
    {#if data.staff?.role === 'owner'}<a href="/staff/team" aria-current={$page.url.pathname === '/staff/team' ? 'page' : undefined}>Staff</a>{/if}
    {#if data.staff?.role === 'owner'}<a href="/staff/activity" aria-current={$page.url.pathname === '/staff/activity' ? 'page' : undefined}>Activity</a>{/if}
    <a href="/staff/security" aria-current={$page.url.pathname === '/staff/security' ? 'page' : undefined}>Security</a>
    {#if data.hasWorkspace}<a href="/app">Open Crimini</a>{/if}
    <form method="POST" action="/logout?staff=1"><button type="submit">Sign Out</button></form>
  </nav>
{/snippet}

{#if data.staff}
  <div class="staff-console">
    <a class="staff-skip" href="#staff-content">Skip to content</a>
    <aside class="staff-sidebar" aria-label="Staff workspace">
      <a class="staff-brand" href="/staff"><img src="/crimini-mushrooms.svg" alt="" aria-hidden="true" /><strong>Crimini <span>Staff</span></strong></a>
      {@render navigation()}
    </aside>
    <div class="staff-main">
      <header class="staff-topline">
        <span>Crimini Staff</span>
        {#key $page.url.pathname}
          <details class="staff-mobile-menu">
            <summary>Menu</summary>
            {@render navigation()}
          </details>
        {/key}
      </header>
      <div class="staff-workspace" id="staff-content" tabindex="-1">{@render children()}</div>
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .staff-console { display: grid; grid-template-columns: 12rem minmax(0, 1fr); gap: clamp(1.5rem, 3vw, 3rem); width: 100%; max-width: 1600px; margin: 0 auto; padding: 1rem clamp(0.5rem, 2vw, 1.5rem) 2rem; }
  .staff-sidebar { position: sticky; top: 1rem; align-self: start; max-height: calc(100dvh - 2rem); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--color-border) transparent; padding-right: 1rem; border-right: 1px solid var(--color-divider); }
  .staff-brand { display: flex; align-items: center; gap: 0.6rem; color: var(--color-text); text-decoration: none; padding-block: 0.5rem 1.75rem; }
  .staff-brand img { width: 34px; height: 28px; object-fit: contain; filter: invert(1); }
  .staff-brand strong { font-size: 0.95rem; letter-spacing: -0.04em; }
  .staff-brand span { color: var(--color-text-muted); font-weight: 400; }
  .staff-nav { display: flex; flex-direction: column; gap: 0.2rem; }
  .staff-nav a, .staff-nav button { display: block; text-align: left; color: var(--color-text-muted); text-decoration: none; border: 0; border-bottom: 1px solid transparent; border-radius: 0; background: transparent; padding: 0.75rem 0.4rem; font-size: 0.8rem; }
  .staff-nav a:hover, .staff-nav button:hover { color: var(--color-text); }
  .staff-nav a[aria-current] { color: var(--color-text); font-weight: 700; border-image: linear-gradient(90deg, var(--color-primary), transparent) 1; }
  .staff-nav form { margin-top: 1.25rem; border-top: 1px solid var(--color-divider); padding-top: 0.5rem; }
  .staff-main { min-width: 0; }
  .staff-topline { min-height: 3rem; display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; padding-block: 0.5rem; border-bottom: 1px solid var(--color-divider); }
  .staff-topline > span { color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.65rem; }
  .staff-mobile-menu { display: none; }
  .staff-workspace { min-width: 0; }
  .staff-skip { position: fixed; left: 1rem; top: -5rem; z-index: 100; background: var(--color-surface); padding: 0.75rem; }
  .staff-skip:focus { top: 1rem; }
  @media (max-width: 900px) {
    .staff-console { display: block; padding: 0.5rem 0 1.5rem; }
    .staff-sidebar { display: none; }
    .staff-topline { align-items: start; }
    .staff-mobile-menu { display: block; min-width: 10rem; }
    .staff-mobile-menu summary { cursor: pointer; text-align: right; font-size: 0.85rem; min-height: 2rem; }
    .staff-mobile-menu[open] { width: 100%; }
    .staff-mobile-menu .staff-nav { padding-top: 0.75rem; }
  }
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
    .staff-workspace :global(.staff-issue-facts) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 500px) {
    .staff-workspace :global(.staff-form-grid) { grid-template-columns: 1fr; }
  }
</style>

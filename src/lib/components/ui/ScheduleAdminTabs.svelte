<script lang="ts">
  export let active: 'overview' | 'builder' | 'settings' | 'users' = 'overview';

  const items = [
    { id: 'overview', href: '/admin', label: 'Overview' },
    { id: 'builder', href: '/admin/schedule', label: 'Builder' },
    { id: 'settings', href: '/admin/schedule-settings', label: 'Settings' },
    { id: 'users', href: '/admin/users', label: 'User Access' }
  ] as const;
</script>

<nav class="schedule-tabs" aria-label="Schedule admin navigation">
  {#each items as item}
    <a
      href={item.href}
      class="schedule-tab"
      class:schedule-tab-active={item.id === active}
      aria-current={item.id === active ? 'page' : undefined}
    >
      {item.label}
    </a>
  {/each}
</nav>

<style>
  .schedule-tabs {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 0.35rem 0 1rem;
  }

  .schedule-tab {
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 0.38rem 0.8rem;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    transition: border-color 140ms var(--ease-out), transform 140ms var(--ease-out);
  }

  .schedule-tab:hover,
  .schedule-tab:focus-visible {
    border-color: rgba(195, 32, 43, 0.24);
    transform: translateY(-1px);
    outline: none;
  }

  .schedule-tab-active {
    color: var(--color-primary-contrast);
    border-color: rgba(195, 32, 43, 0.26);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.24), rgba(195, 32, 43, 0.08));
  }
</style>

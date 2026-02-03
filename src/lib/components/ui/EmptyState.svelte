<script lang="ts">
  export let title: string;
  export let description: string | null = null;
  export let icon: string | null = null;
  export let actionLabel: string | null = null;
</script>

<div class="empty">
  {#if icon}
    <span class="material-icons icon">{icon}</span>
  {/if}

  <h2>{title}</h2>

  {#if description}
    <p>{description}</p>
  {/if}

  <div class="actions">
    {#if actionLabel}
      <button class="action-btn">
        {actionLabel}
      </button>
    {/if}

    <slot />
  </div>
</div>

<style>
  .empty {
    height: 100%;
    min-height: 50vh;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    text-align: center;
    padding: var(--space-6);
    color: var(--color-text-muted);
  }

  .icon {
    font-size: 48px;
    margin-bottom: var(--space-4);
    color: var(--color-text-muted);
  }

  h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
    color: var(--color-text);
  }

  p {
    margin: var(--space-2) 0 0;
    font-size: var(--text-sm);
  }

  .actions {
    margin-top: var(--space-4);
  }

  .action-btn {
    padding: 0.6rem 1rem;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
  }

  .action-btn:hover {
    border-color: rgba(255,255,255,0.25);
  }
</style>

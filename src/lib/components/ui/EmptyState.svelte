<script lang="ts">
  export let title = 'Nothing here yet.';
  export let description: string | null = null;
  export let icon: string | null = null;
  export let actionLabel: string | null = null;
  export let actionHref: string | null = null;
  export let tone: 'empty' | 'loading' | 'error' | 'success' = 'empty';
  export let compact = false;
</script>

<div class="empty" class:compact class:error={tone === 'error'} class:loading={tone === 'loading'} class:success={tone === 'success'}>
  {#if icon}
    <span class="material-icons icon">{icon}</span>
  {/if}

  <h2>{title}</h2>

  {#if description}
    <p>{description}</p>
  {/if}

  <div class="actions">
    {#if actionLabel && actionHref}
      <a class="action-btn" href={actionHref}>
        {actionLabel}
      </a>
    {:else if actionLabel}
      <button class="action-btn" type="button">
        {actionLabel}
      </button>
    {/if}

    <slot />
  </div>
</div>

<style>
  .empty {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 0.45rem;
    min-height: 13rem;
    text-align: center;
    padding: clamp(1rem, 4vw, 2rem) 0;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text-muted);
    box-shadow: none;
  }

  .compact {
    min-height: 0;
    justify-items: start;
    align-content: start;
    text-align: left;
    padding: 0.75rem 0;
    border-radius: 0;
  }

  .icon {
    font-size: 2rem;
    color: var(--color-text-muted);
  }

  h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--weight-medium);
    color: var(--color-text);
  }

  p {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .actions {
    display: inline-flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 0.45rem;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.34rem 0.18rem;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
  }

  .action-btn:hover {
    border-bottom-color: var(--color-text);
  }

  .error {
    border-color: color-mix(in srgb, var(--color-error) 36%, var(--color-border) 64%);
    background: transparent;
  }

  .success {
    border-color: color-mix(in srgb, var(--color-success) 34%, var(--color-border) 66%);
  }

  .loading .icon {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.48; }
    50% { opacity: 1; }
  }
</style>

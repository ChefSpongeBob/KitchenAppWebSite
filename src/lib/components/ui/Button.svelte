<script lang="ts">
  export let variant: 'primary' | 'secondary' = 'primary';
  export let icon: string | null = null;
  export let type: 'button' | 'submit' = 'button';
</script>

<button class="btn {variant} tap" type={type}>
  {#if icon}
    <span class="material-icons icon">{icon}</span>
  {/if}
  <span class="label">
    <slot />
  </span>
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);

    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-lg);
    border: none;

    font-size: var(--text-md);
    font-weight: var(--weight-medium);
    cursor: pointer;

    transition:
      background var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .btn.primary {
    background: var(--color-primary);
    color: var(--color-primary-contrast);
  }

  .btn.secondary {
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  .icon {
    font-size: 20px;
    line-height: 1;
  }
</style>

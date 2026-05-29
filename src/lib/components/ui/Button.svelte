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

    padding: 0.34rem 0.18rem;
    border-radius: 0;
    border: 0;
    border-bottom: 1px solid var(--color-border);

    font-size: var(--text-md);
    font-weight: var(--weight-medium);
    cursor: pointer;

    transition:
      color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .btn.primary {
    background: transparent;
    color: var(--color-text);
    box-shadow: none;
  }

  .btn.secondary {
    background: transparent;
    color: var(--color-text);
  }

  .btn:hover {
    transform: none;
    border-color: var(--color-text);
    color: var(--color-text);
  }

  .btn:active {
    transform: translateY(0);
  }

  .icon {
    font-size: 20px;
    line-height: 1;
  }
</style>

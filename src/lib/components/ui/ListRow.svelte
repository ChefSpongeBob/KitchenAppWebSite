<div class="row tap">
  <slot />
</div>

<style>
  .row {
    display: flex;
    align-items: center;

    padding: var(--space-4);
    background: var(--color-surface);
    border-radius: var(--radius-md);

    font-size: var(--text-md);
    color: var(--color-text);

    box-shadow: var(--shadow-sm);
  }

  .row + .row {
    margin-top: var(--space-2);
  }
</style>

<script lang="ts">
  export let label: string | null = null;
  export let value: string = '';
  export let placeholder: string = '';
  export let textarea: boolean = false;
  export let rows: number = 3;
</script>

<div class="field">
  {#if label}
    <label class="label">{label}</label>
  {/if}

  {#if textarea}
    <textarea
      class="input"
      bind:value
      rows={rows}
      placeholder={placeholder}
    />
  {:else}
    <input
      class="input"
      type="text"
      bind:value
      placeholder={placeholder}
    />
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-text);
  }

  .input {
    width: 100%;
    padding: var(--space-3);

    font-size: var(--text-md);
    font-family: inherit;

    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);

    transition:
      border-color var(--duration-fast) var(--ease-out),
      background var(--duration-fast) var(--ease-out);
  }

  .input::placeholder {
    color: var(--color-text-muted);
  }

  .input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  textarea.input {
    resize: vertical;
  }
</style>

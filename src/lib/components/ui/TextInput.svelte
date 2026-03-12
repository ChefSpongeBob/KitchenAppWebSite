<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let label: string | null = null;
  export let value: string = '';
  export let placeholder: string = '';
  export let textarea: boolean = false;
  export let rows: number = 3;
  export let id: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ input: string }>();
  const inputId = id ?? `field-${label?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'input'}`;
</script>

<div class="field">
  {#if label}
    <label class="label" for={inputId}>{label}</label>
  {/if}

  {#if textarea}
    <textarea
      id={inputId}
      class="input"
      bind:value
      rows={rows}
      placeholder={placeholder}
      on:input={() => dispatch('input', value)}
    ></textarea>
  {:else}
    <input
      id={inputId}
      class="input"
      type="text"
      bind:value
      placeholder={placeholder}
      on:input={() => dispatch('input', value)}
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

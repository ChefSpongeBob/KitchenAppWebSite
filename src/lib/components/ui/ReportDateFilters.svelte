<script lang="ts">
  export let startDate = '';
  export let endDate = '';
  export let hidden: Record<string, string> = {};
</script>

<form method="GET" class="report-filters">
  {#each Object.entries(hidden) as [name, value]}
    <input type="hidden" {name} {value} />
  {/each}

  <label>
    <span>From</span>
    <input type="date" name="start" value={startDate} max={endDate || undefined} />
  </label>

  <label>
    <span>To</span>
    <input type="date" name="end" value={endDate} min={startDate || undefined} />
  </label>

  <button type="submit">View</button>
</form>

<style>
  .report-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.75rem 1rem;
    padding: 0.85rem 0;
    border-bottom: 1px solid var(--color-divider);
  }

  label {
    display: grid;
    gap: 0.28rem;
  }

  label span {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  input {
    min-height: 2.25rem;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-divider);
    border-radius: 0;
    background: var(--color-surface);
    color: var(--color-text);
    color-scheme: light dark;
    font: inherit;
    font-size: 0.82rem;
  }

  button {
    min-height: 2.25rem;
    padding: 0.35rem 0;
    border: 0;
    border-bottom: 1px solid var(--color-text);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }
</style>

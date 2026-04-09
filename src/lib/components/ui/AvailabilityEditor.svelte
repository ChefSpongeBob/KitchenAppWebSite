<script lang="ts">
  import { enhance } from '$app/forms';
  import { buildQuarterHourOptions, scheduleWeekdays } from '$lib/assets/schedule';
  import type { SubmitFunction } from '@sveltejs/kit';

  type AvailabilityEntry = {
    weekday: number;
    isAvailable: boolean;
    startTime: string;
    endTime: string;
  };

  export let entries: AvailabilityEntry[] = [];
  export let action = '';
  export let enhanceFn: SubmitFunction;
  export let submitLabel = 'Save Availability';
  export let buttonClass = '';

  const quarterHourOptions = buildQuarterHourOptions();

  $: payload = JSON.stringify(
    entries.map((entry) => ({
      weekday: entry.weekday,
      isAvailable: entry.isAvailable,
      startTime: entry.startTime,
      endTime: entry.endTime
    }))
  );
</script>

<form method="POST" {action} use:enhance={enhanceFn} class="availability-editor">
  <input type="hidden" name="availability" value={payload} />

  <div class="availability-editor__grid">
    {#each scheduleWeekdays as day}
      {@const entry = entries.find((item) => item.weekday === day.value)}
      {#if entry}
        <div class:availability-editor__row--off={!entry.isAvailable} class="availability-editor__row">
          <div class="availability-editor__day">
            <strong>{day.label}</strong>
            <label class="availability-editor__toggle">
              <input type="checkbox" bind:checked={entry.isAvailable} />
              <span>{entry.isAvailable ? 'Available' : 'Not Available'}</span>
            </label>
          </div>

          <div class="availability-editor__times">
            <label>
              <span>Start</span>
              <select bind:value={entry.startTime} disabled={!entry.isAvailable}>
                {#each quarterHourOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>

            <label>
              <span>End</span>
              <select bind:value={entry.endTime} disabled={!entry.isAvailable}>
                {#each quarterHourOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <div class="availability-editor__actions">
    <button type="submit" class={`availability-editor__button ${buttonClass}`.trim()}>{submitLabel}</button>
  </div>
</form>

<style>
  .availability-editor,
  .availability-editor__grid {
    display: grid;
    gap: 0.8rem;
  }

  .availability-editor__row {
    display: grid;
    gap: 0.85rem;
    padding: 0.85rem 0.9rem;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .availability-editor__row--off {
    opacity: 0.72;
  }

  .availability-editor__day,
  .availability-editor__times,
  .availability-editor__toggle,
  .availability-editor__times label,
  .availability-editor__actions {
    display: flex;
  }

  .availability-editor__day {
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;
  }

  .availability-editor__day strong {
    font-size: 0.98rem;
  }

  .availability-editor__toggle {
    align-items: center;
    gap: 0.4rem;
    color: var(--color-text-muted);
  }

  .availability-editor__times {
    gap: 0.8rem;
  }

  .availability-editor__times label {
    flex-direction: column;
    gap: 0.35rem;
    flex: 1 1 0;
  }

  .availability-editor__times label span {
    font-size: 0.76rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .availability-editor__times select {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.55rem 0.68rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.84rem;
  }

  .availability-editor__actions {
    justify-content: flex-end;
  }

  .availability-editor__button {
    min-width: 12rem;
  }

  @media (max-width: 760px) {
    .availability-editor__day,
    .availability-editor__times,
    .availability-editor__actions {
      flex-direction: column;
      align-items: stretch;
    }

    .availability-editor__button {
      width: 100%;
      min-width: 0;
    }
  }
</style>

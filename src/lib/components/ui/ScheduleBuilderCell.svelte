<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { formatScheduleTimeLabel } from '$lib/assets/schedule';
  import type { DraftShift, EmployeeRow, ScheduleDepartment } from '$lib/types/schedule-builder';

  export let cell: EmployeeRow['cells'][number];
  export let userId = '';
  export let rowIndex = 0;
  export let cellIndex = 0;
  export let selectedSection: 'All' | ScheduleDepartment = 'All';
  export let canAdd = false;
  export let availabilityState: 'open' | 'limited' | 'unavailable' | 'unset' = 'unset';
  export let availabilityLabel = 'Availability not set';
  export let pendingTimeOff = false;

  const dispatch = createEventDispatcher<{
    addshift: { rowIndex: number; cellIndex: number; userId: string; date: string };
    editshift: { rowIndex: number; cellIndex: number; clientId: string };
  }>();

  function visibleShifts() {
    return selectedSection === 'All'
      ? cell.shifts
      : cell.shifts.filter((shift) => shift.department === selectedSection);
  }

  function shiftSummary(shift: DraftShift) {
    const pieces = [shift.department, shift.role];
    if (shift.detail) pieces.push(shift.detail);
    const time = shift.startTime
      ? `${formatScheduleTimeLabel(shift.startTime)}${shift.endLabel ? ` - ${shift.endLabel}` : ''}`
      : shift.endLabel || 'Time not set';
    return { title: pieces.join(' | '), time };
  }
</script>

<div class="shift-cell">
  <span
    class={`availability-marker availability-${availabilityState}`}
    class:pending-time-off={pendingTimeOff}
    role="img"
    title={pendingTimeOff ? `${availabilityLabel}; pending time off request` : availabilityLabel}
    aria-label={pendingTimeOff ? `${availabilityLabel}; pending time off request` : availabilityLabel}
  ></span>
  <div class="cell-body">
    {#each visibleShifts() as shift (shift.clientId)}
      <button
        type="button"
        class="shift-card shift-toggle"
        on:click={() => dispatch('editshift', { rowIndex, cellIndex, clientId: shift.clientId })}
      >
        <div class="shift-preview">
          <strong>{shiftSummary(shift).title}</strong>
          <span>{shiftSummary(shift).time}</span>
        </div>
        <span class="toggle-text">Edit</span>
      </button>
    {/each}
  </div>

  <button
    type="button"
    class="add-btn"
    disabled={!canAdd}
    title={!canAdd ? 'This employee has no approved schedule departments.' : undefined}
    on:click={() => dispatch('addshift', { rowIndex, cellIndex, userId, date: cell.date })}
  >
    Add Shift
  </button>
</div>

<style>
  .shift-cell {
    position: relative;
    display: grid;
    gap: 0.6rem;
    padding: 0.7rem;
    align-content: start;
    min-height: 170px;
  }

  .availability-marker {
    position: absolute;
    top: 0.38rem;
    right: 0.38rem;
    z-index: 1;
    width: 0.52rem;
    height: 0.52rem;
    border: 1px solid var(--color-divider-strong);
    border-radius: 50%;
    background: var(--color-text-muted);
  }

  .availability-open { background: #3f7b57; }
  .availability-limited { background: #bd8a2d; }
  .availability-unavailable { background: #a63d35; }
  .availability-unset { background: transparent; }
  .availability-marker.pending-time-off { box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 3px #bd8a2d; }

  .cell-body {
    display: grid;
    gap: 0.55rem;
  }

  .shift-card {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: start;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: var(--color-text);
    min-height: 0;
    width: 100%;
    padding: 0.55rem 0.6rem;
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
  }

  .shift-preview {
    display: grid;
    gap: 0.18rem;
  }

  .shift-preview strong {
    font-size: 0.82rem;
  }

  .shift-preview span,
  .toggle-text {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .toggle-text {
    white-space: nowrap;
  }

  .add-btn {
    width: 100%;
    border-radius: 10px;
    cursor: pointer;
    min-height: 2rem;
    font-size: 0.78rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: var(--color-text);
  }
</style>

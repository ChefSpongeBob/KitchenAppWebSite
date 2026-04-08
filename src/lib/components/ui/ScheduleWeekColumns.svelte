<script lang="ts">
  import { formatScheduleTimeLabel } from '$lib/assets/schedule';

  type Shift = {
    id: string;
    shiftDate: string;
    userName: string | null;
    userEmail: string;
    department: string;
    role: string;
    detail: string;
    startTime: string;
    endLabel: string;
    notes: string;
  };

  type Day = {
    date: string;
    label: string;
    shifts: Shift[];
  };

  export let days: Day[] = [];
  export let emptyText = 'No shifts posted.';

  let viewport: HTMLDivElement | null = null;
  let isDragging = false;
  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartScrollLeft = 0;

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType !== 'mouse' || !viewport) return;
    isDragging = true;
    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartScrollLeft = viewport.scrollLeft;
    viewport.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragging || !viewport || event.pointerId !== dragPointerId) return;
    const deltaX = event.clientX - dragStartX;
    viewport.scrollLeft = dragStartScrollLeft - deltaX;
  }

  function handlePointerUp(event: PointerEvent) {
    if (!viewport || event.pointerId !== dragPointerId) return;
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    isDragging = false;
    dragPointerId = null;
  }

  function shiftSortValue(shift: Shift) {
    const match = /^(\d{2}):(\d{2})$/.exec(shift.startTime);
    if (!match) return Number.MAX_SAFE_INTEGER;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  $: sortedDays = days.map((day) => ({
    ...day,
    shifts: [...day.shifts].sort((left, right) => shiftSortValue(left) - shiftSortValue(right))
  }));
</script>

<div
  class:dragging={isDragging}
  class="columns-shell"
  bind:this={viewport}
  role="region"
  aria-label="Weekly schedule day scroller"
  on:pointerdown={handlePointerDown}
  on:pointermove={handlePointerMove}
  on:pointerup={handlePointerUp}
  on:pointercancel={handlePointerUp}
>
  <section class="week-columns" aria-label="Weekly schedule">
    {#each sortedDays as day}
      <article class="day-column">
        <header class="day-head">
          <h2>{day.label}</h2>
          <span>{day.shifts.length}</span>
        </header>

        <div class="column-body">
          {#if day.shifts.length === 0}
            <p class="empty-note">{emptyText}</p>
          {:else}
            {#each day.shifts as shift}
              <div class="shift-card">
                <strong>{shift.userName ?? shift.userEmail}</strong>
                <div class="shift-meta">
                  <span>{shift.department}</span>
                  <span>{shift.role}</span>
                  {#if shift.detail}
                    <span>{shift.detail}</span>
                  {/if}
                </div>
                <p class="shift-time">
                  {formatScheduleTimeLabel(shift.startTime)}{#if shift.endLabel} - {shift.endLabel}{/if}
                </p>
                {#if shift.notes}
                  <p class="shift-notes">{shift.notes}</p>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </article>
    {/each}
  </section>
</div>

<style>
  .columns-shell {
    overflow-x: auto;
    padding-inline: clamp(0.75rem, 2.6vw, var(--space-4));
    padding-bottom: 1rem;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    scrollbar-width: none;
    cursor: grab;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
  }

  .columns-shell::-webkit-scrollbar {
    display: none;
  }

  .columns-shell.dragging {
    cursor: grabbing;
    scroll-behavior: auto;
    user-select: none;
  }

  .week-columns {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: min(100%, 32rem);
    gap: 0.8rem;
    min-width: max-content;
    width: max-content;
    margin: 0 auto;
  }

  .day-column {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 100%;
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }

  .day-head {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    align-items: start;
    padding: 0.9rem 0.9rem 0.75rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .day-head h2 {
    margin: 0;
    font-size: 0.96rem;
  }

  .day-head span,
  .shift-meta,
  .shift-notes,
  .empty-note {
    color: var(--color-text-muted);
  }

  .day-head span {
    font-size: 0.76rem;
  }

  .column-body {
    display: grid;
    gap: 0.55rem;
    padding: 0.8rem;
    align-content: start;
  }

  .shift-card {
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 0.7rem 0.75rem;
    background: rgba(255,255,255,0.025);
    display: grid;
    gap: 0.25rem;
  }

  .shift-card strong,
  .shift-time {
    color: var(--color-text);
  }

  .shift-meta {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    font-size: 0.76rem;
  }

  .shift-meta span {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 0.12rem 0.42rem;
    background: rgba(255,255,255,0.03);
  }

  .shift-time,
  .shift-notes,
  .empty-note {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.45;
  }
</style>

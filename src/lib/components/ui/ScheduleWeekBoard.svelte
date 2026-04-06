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
  export let showPerson = true;
  export let compact = false;
</script>

<section class:compact class="week-grid">
  {#each days as day}
    <article class="day-card">
      <header class="day-head">
        <h2>{day.label}</h2>
        <span>{day.shifts.length} shifts</span>
      </header>

      <div class="shift-list">
        {#if day.shifts.length === 0}
          <p class="empty-note">{emptyText}</p>
        {:else}
          {#each day.shifts as shift}
            <div class="shift-card">
              {#if showPerson}
                <strong>{shift.userName ?? shift.userEmail}</strong>
              {/if}
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

<style>
  .week-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.8rem;
  }

  .day-card {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    padding: 0.9rem;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    display: grid;
    gap: 0.75rem;
  }

  .day-head {
    display: flex;
    justify-content: space-between;
    gap: 0.6rem;
    align-items: start;
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

  .shift-list {
    display: grid;
    gap: 0.55rem;
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

  .week-grid.compact {
    grid-template-columns: 1fr;
  }

  @media (max-width: 1180px) {
    .week-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .week-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

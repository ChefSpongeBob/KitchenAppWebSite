<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import SchoolOfFish from '$lib/components/ui/SchoolOfFish.svelte';
  import { formatScheduleTimeLabel } from '$lib/assets/schedule';

  export let data: {
    weekStart: string;
    prevWeekStart: string;
    nextWeekStart: string;
    week: { status: 'draft' | 'published' } | null;
    days: Array<{
      date: string;
      label: string;
      shifts: Array<{
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
      }>;
    }>;
  };

  $: weekRangeLabel = (() => {
    if (data.days.length === 0) return data.weekStart;
    const start = new Date(`${data.days[0].date}T00:00:00`);
    const end = new Date(`${data.days[data.days.length - 1].date}T00:00:00`);
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const startDay = String(start.getDate()).padStart(2, '0');
    const endMonth = String(end.getMonth() + 1).padStart(2, '0');
    const endDay = String(end.getDate()).padStart(2, '0');
    const yy = String(end.getFullYear()).slice(-2);
    return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
      ? `${mm}/${startDay}-${endDay}/${yy}`
      : `${mm}/${startDay}-${endMonth}/${endDay}/${yy}`;
  })();
</script>

<Layout padded={false}>
  <div class="schedule-shell">
    <PageHeader title="My Schedule" subtitle="Your posted week, broken down day by day." />

    <nav class="subnav">
      <a href="/schedule">Full Schedule</a>
      <a href={`?week=${data.prevWeekStart}`}>Previous Week</a>
      <a href={`?week=${data.nextWeekStart}`}>Next Week</a>
    </nav>

    <section class="week-banner">
      <div>
        <span class="eyebrow">Week Of</span>
        <h2>{weekRangeLabel}</h2>
      </div>
      <span>{data.days.reduce((total, day) => total + day.shifts.length, 0)} shifts</span>
    </section>

    <section class="days-stack" aria-label="My scheduled week">
      {#each data.days as day}
        <article class="day-card">
          <header class="day-head">
            <div>
              <h3>{day.label}</h3>
              <small>{day.shifts.length} shift{day.shifts.length === 1 ? '' : 's'}</small>
            </div>
          </header>

          {#if day.shifts.length === 0}
            <div class="empty-state">
              <SchoolOfFish label="You are not scheduled." />
            </div>
          {:else}
            <div class="shift-list">
              {#each day.shifts as shift}
                <div class="shift-card">
                  <strong>{shift.department} | {shift.role}</strong>
                  <p class="shift-time">
                    {formatScheduleTimeLabel(shift.startTime)}{#if shift.endLabel} - {shift.endLabel}{/if}
                  </p>
                  {#if shift.detail}
                    <p class="shift-detail">{shift.detail}</p>
                  {/if}
                  {#if shift.notes}
                    <p class="shift-notes">{shift.notes}</p>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    </section>
  </div>
</Layout>

<style>
  .schedule-shell {
    display: grid;
    gap: 1rem;
  }

  .subnav {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: -0.35rem 0 0.2rem;
    padding-inline: clamp(0.75rem, 2.6vw, var(--space-4));
  }

  .subnav a {
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    background: rgba(255,255,255,0.03);
  }

  .week-banner {
    margin-inline: clamp(0.75rem, 2.6vw, var(--space-4));
    padding: 0.95rem 1rem;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }

  .eyebrow,
  .day-head small,
  .shift-detail,
  .shift-notes,
  .week-banner > span {
    color: var(--color-text-muted);
  }

  .eyebrow {
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h2,
  h3 {
    margin: 0.18rem 0 0;
  }

  .days-stack {
    display: grid;
    gap: 0.85rem;
    padding-inline: clamp(0.75rem, 2.6vw, var(--space-4));
    padding-bottom: 1rem;
  }

  .day-card {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    padding: 0.95rem;
    display: grid;
    gap: 0.8rem;
  }

  .empty-state {
    display: grid;
    justify-items: start;
    align-content: start;
  }

  .shift-list {
    display: grid;
    gap: 0.65rem;
  }

  .shift-card {
    display: grid;
    gap: 0.22rem;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 0.75rem 0.8rem;
    background: rgba(255,255,255,0.025);
  }

  .shift-card strong,
  .shift-time {
    color: var(--color-text);
  }

  .shift-time,
  .shift-detail,
  .shift-notes {
    margin: 0;
    line-height: 1.45;
  }
</style>

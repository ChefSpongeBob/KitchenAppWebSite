<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ScheduleWeekColumns from '$lib/components/ui/ScheduleWeekColumns.svelte';

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
</script>

<Layout padded={false}>
  <div class="schedule-shell">
    <PageHeader title="Schedule" subtitle="Posted weekly schedule for the team." />

    <nav class="subnav">
      <a href="/my-schedule">My Schedule</a>
      <a href={`?week=${data.prevWeekStart}`}>Previous Week</a>
      <a href={`?week=${data.nextWeekStart}`}>Next Week</a>
    </nav>

    <section class="week-banner">
      <div>
        <span class="eyebrow">Week Of</span>
        <h2>{data.weekStart}</h2>
      </div>
      <span class:published={data.week?.status === 'published'} class="status-pill">
        {data.week?.status === 'published' ? 'Posted' : 'Not posted'}
      </span>
    </section>

    <ScheduleWeekColumns days={data.days} emptyText="No shift posted." />
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

  .eyebrow {
    color: var(--color-text-muted);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  h2 {
    margin: 0.18rem 0 0;
  }

  .status-pill {
    border: 1px solid rgba(245, 158, 11, 0.28);
    color: #fcd34d;
    border-radius: 999px;
    padding: 0.25rem 0.6rem;
    font-size: 0.78rem;
    background: rgba(255,255,255,0.03);
  }

  .status-pill.published {
    border-color: rgba(22, 163, 74, 0.32);
    color: #bbf7d0;
  }

</style>

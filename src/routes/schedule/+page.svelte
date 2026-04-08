<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ScheduleWeekColumns from '$lib/components/ui/ScheduleWeekColumns.svelte';
  import {
    formatScheduleWeekRange,
    isValidScheduleDepartment,
    scheduleDepartments,
    type ScheduleDepartment
  } from '$lib/assets/schedule';

  export let data: {
    weekStart: string;
    prevWeekStart: string;
    nextWeekStart: string;
    week: { status: 'draft' | 'published' } | null;
    isAdmin: boolean;
    visibleDepartments: ScheduleDepartment[];
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

  let selectedDepartments = [...data.visibleDepartments];

  $: weekRangeLabel = formatScheduleWeekRange(
    data.days.map((day) => day.date),
    data.weekStart
  );
  $: visibleDepartmentSet = new Set(selectedDepartments);
  $: filteredDays = data.days.map((day) => ({
    ...day,
    shifts: day.shifts.filter(
      (shift) =>
        isValidScheduleDepartment(shift.department) &&
        visibleDepartmentSet.has(shift.department)
    )
  }));
  $: viewingLabel =
    selectedDepartments.length === scheduleDepartments.length
      ? 'All areas'
      : selectedDepartments.join(', ');

  function showAllDepartments() {
    selectedDepartments = [...scheduleDepartments];
  }

  function toggleDepartment(department: ScheduleDepartment) {
    if (!data.isAdmin) return;
    if (selectedDepartments.includes(department)) {
      if (selectedDepartments.length === 1) return;
      selectedDepartments = selectedDepartments.filter((entry) => entry !== department);
      return;
    }

    selectedDepartments = [...selectedDepartments, department];
  }
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
        <h2>{weekRangeLabel}</h2>
        <p class="viewing-note">Viewing: {viewingLabel}</p>
      </div>
      <span class:published={data.week?.status === 'published'} class="status-pill">
        {data.week?.status === 'published' ? 'Published Schedule' : 'Draft Schedule'}
      </span>
    </section>

    {#if data.isAdmin}
      <section class="filter-bar" aria-label="Schedule area filters">
        <button
          type="button"
          class:filter-active={selectedDepartments.length === scheduleDepartments.length}
          class="filter-chip"
          on:click={showAllDepartments}
        >
          All
        </button>
        {#each scheduleDepartments as department}
          <button
            type="button"
            class:filter-active={selectedDepartments.includes(department)}
            class="filter-chip"
            on:click={() => toggleDepartment(department)}
          >
            {department}
          </button>
        {/each}
      </section>
    {/if}

    <ScheduleWeekColumns
      days={filteredDays}
      emptyText="No shift posted."
    />
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

  .viewing-note {
    margin: 0.3rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .status-pill {
    color: var(--color-text-muted);
    padding: 0.2rem 0;
    font-size: 0.82rem;
    background: transparent;
    border: 0;
  }

  .status-pill.published {
    color: #bbf7d0;
  }

  .filter-bar {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-inline: clamp(0.75rem, 2.6vw, var(--space-4));
    margin-top: -0.25rem;
  }

  .filter-chip {
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    color: var(--color-text-muted);
    min-height: 2rem;
    padding: 0.35rem 0.8rem;
    font-size: 0.76rem;
    cursor: pointer;
  }

  .filter-chip.filter-active {
    border-color: rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
  }

</style>

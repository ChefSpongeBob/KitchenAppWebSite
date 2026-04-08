<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ScheduleAdminTabs from '$lib/components/ui/ScheduleAdminTabs.svelte';
  import ScheduleTimeSelect from '$lib/components/ui/ScheduleTimeSelect.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import {
    scheduleDepartments,
    scheduleEndLabels,
    scheduleDetailOptionsFor,
    formatScheduleTimeLabel,
    formatScheduleWeekRange,
    type ScheduleDepartment
  } from '$lib/assets/schedule';
  import type { SubmitFunction } from '@sveltejs/kit';

  type UserOption = {
    id: string;
    displayName: string | null;
    email: string;
    approvedDepartments: ScheduleDepartment[];
  };

  type Shift = {
    id: string;
    shiftDate: string;
    userId: string;
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

  type ShiftOffer = {
    id: string;
    shiftId: string;
    shiftDate: string;
    userId: string;
    userName: string | null;
    userEmail: string;
    department: string;
    role: string;
    detail: string;
    startTime: string;
    endLabel: string;
    notes: string;
    offeredByUserId: string;
    offeredByUserName: string | null;
    offeredByUserEmail: string;
    targetUserId: string | null;
    targetUserName: string | null;
    targetUserEmail: string | null;
    requestedByUserId: string | null;
    requestedByUserName: string | null;
    requestedByUserEmail: string | null;
    managerNote: string;
  };

  type DraftShift = {
    clientId: string;
    shiftDate: string;
    userId: string;
    department: ScheduleDepartment;
    role: string;
    detail: string;
    startTime: string;
    endLabel: string;
    notes: string;
    isEditing: boolean;
    duplicateDates: string[];
  };

  type EmployeeRow = {
    userId: string;
    cells: Array<{
      date: string;
      label: string;
      shifts: DraftShift[];
    }>;
  };

  export let data: {
    weekStart: string;
    prevWeekStart: string;
    nextWeekStart: string;
    users: UserOption[];
    week: { status: 'draft' | 'published'; publishedAt: number | null } | null;
    days: Day[];
    offers: ShiftOffer[];
    settings: {
      autofillNewWeeks: boolean;
      roleOptionsByDepartment: Record<ScheduleDepartment, string[]>;
    };
  };

  let selectedEmployeeId = '';
  let selectedSection: 'All' | ScheduleDepartment = 'All';
  let mobileTeamPanelOpen = false;
  const defaultDepartment: ScheduleDepartment = 'FOH';

  function normalizeDepartment(value: string): ScheduleDepartment {
    return (scheduleDepartments.includes(value as ScheduleDepartment)
      ? value
      : defaultDepartment) as ScheduleDepartment;
  }

  function userOption(userId: string) {
    return data.users.find((entry) => entry.id === userId) ?? null;
  }

  function approvedDepartmentsForUser(userId: string) {
    return userOption(userId)?.approvedDepartments ?? [];
  }

  function rolesFor(department: ScheduleDepartment) {
    return data.settings.roleOptionsByDepartment[department] as readonly string[];
  }

  function createShift(userId: string, shiftDate: string): DraftShift {
    const approvedDepartments = approvedDepartmentsForUser(userId);
    const startingDepartment =
      selectedSection !== 'All' && approvedDepartments.includes(selectedSection)
        ? selectedSection
        : approvedDepartments[0] ?? defaultDepartment;
    return {
      clientId: crypto.randomUUID(),
      shiftDate,
      userId,
      department: startingDepartment,
      role: rolesFor(startingDepartment)[0],
      detail: '',
      startTime: '',
      endLabel: '',
      notes: '',
      isEditing: true,
      duplicateDates: []
    };
  }

  const initialVisibleUserIds = Array.from(
    new Set(
      data.days.flatMap((day) =>
        day.shifts.map((shift) => shift.userId).filter((userId) => userId.length > 0)
      )
    )
  );

  function draftFromShift(shift: Shift): DraftShift {
    const department = normalizeDepartment(shift.department);
    const roles = rolesFor(department);
    return {
      clientId: shift.id,
      shiftDate: shift.shiftDate,
      userId: shift.userId,
      department,
      role: roles.includes(shift.role) ? shift.role : roles[0],
      detail: shift.detail,
      startTime: shift.startTime,
      endLabel: shift.endLabel,
      notes: shift.notes,
      isEditing: false,
      duplicateDates: []
    };
  }

  function buildRow(userId: string): EmployeeRow {
    return {
      userId,
      cells: data.days.map((day) => ({
        date: day.date,
        label: day.label,
        shifts: day.shifts
          .filter((shift) => shift.userId === userId)
          .map((shift) => draftFromShift(shift))
      }))
    };
  }

  let employeeRows: EmployeeRow[] = initialVisibleUserIds.map((userId) => buildRow(userId));
  const initialWeekPayload = JSON.stringify(
    employeeRows.flatMap((row) =>
      row.cells.flatMap((cell) =>
        cell.shifts.map((shift) => ({
          shiftDate: cell.date,
          userId: row.userId,
          department: shift.department,
          role: shift.role,
          detail: shift.detail,
          startTime: shift.startTime,
          endLabel: shift.endLabel,
          notes: shift.notes
        }))
      )
    )
  );

  $: visibleUserIds = employeeRows.map((row) => row.userId);
  $: availableUsers = data.users.filter((user) => !visibleUserIds.includes(user.id));
  $: pendingOffers = data.offers.filter((offer) => offer.requestedByUserId);
  $: weekPayload = JSON.stringify(
    employeeRows.flatMap((row) =>
      row.cells.flatMap((cell) =>
        cell.shifts.map((shift) => ({
          shiftDate: cell.date,
          userId: row.userId,
          department: shift.department,
          role: shift.role,
          detail: shift.detail,
          startTime: shift.startTime,
          endLabel: shift.endLabel,
          notes: shift.notes
        }))
      )
    )
  );
  $: hasUnsavedChanges = weekPayload !== initialWeekPayload;
  $: scheduleStateLabel =
    data.week?.status === 'published' && !hasUnsavedChanges
      ? 'Published Schedule'
      : hasUnsavedChanges
        ? 'Unsaved Draft'
        : 'Saved Draft';
  $: allShifts = employeeRows.flatMap((row) =>
    row.cells.flatMap((cell) =>
      cell.shifts.map((shift) => ({
        ...shift,
        shiftDate: cell.date,
        userId: row.userId
      }))
    )
  );
  $: visibleShiftCount =
    selectedSection === 'All'
      ? allShifts.length
      : allShifts.filter((shift) => shift.department === selectedSection).length;
  $: visibleScheduledHours = allShifts.reduce((sum, shift) => {
    if (selectedSection !== 'All' && shift.department !== selectedSection) return sum;
    const hours = shiftHours(shift);
    return hours === null ? sum : sum + hours;
  }, 0);
  $: departmentHourTotals = {
    FOH: allShifts.reduce((sum, shift) => {
      if (shift.department !== 'FOH') return sum;
      const hours = shiftHours(shift);
      return hours === null ? sum : sum + hours;
    }, 0),
    Sushi: allShifts.reduce((sum, shift) => {
      if (shift.department !== 'Sushi') return sum;
      const hours = shiftHours(shift);
      return hours === null ? sum : sum + hours;
    }, 0),
    Kitchen: allShifts.reduce((sum, shift) => {
      if (shift.department !== 'Kitchen') return sum;
      const hours = shiftHours(shift);
      return hours === null ? sum : sum + hours;
    }, 0)
  };
  $: totalsByDay = data.days.map((day) => {
    const dayShifts = allShifts.filter((shift) => shift.shiftDate === day.date);
    const visibleDayShifts =
      selectedSection === 'All'
        ? dayShifts
        : dayShifts.filter((shift) => shift.department === selectedSection);
    return {
      date: day.date,
      total: visibleDayShifts.length,
      foh: dayShifts.filter((shift) => shift.department === 'FOH').length,
      sushi: dayShifts.filter((shift) => shift.department === 'Sushi').length,
      kitchen: dayShifts.filter((shift) => shift.department === 'Kitchen').length
    };
  });
  $: weekRangeLabel = formatScheduleWeekRange(
    data.days.map((day) => day.date),
    data.weekStart
  );

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Schedule updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That schedule change could not be saved.', 'error');
      }
    };
  };

  function employeeName(userId: string) {
    const user = userOption(userId);
    return user ? user.displayName ?? user.email : 'Unknown user';
  }

  function compactEmployeeName(userId: string) {
    const label = employeeName(userId).trim();
    const [first, second] = label.split(/\s+/);
    if (!first) return label;
    if (!second) return first.length > 12 ? `${first.slice(0, 12)}…` : first;
    return `${first} ${second[0]}.`;
  }

  function approvedDepartmentLabel(userId: string) {
    const departments = approvedDepartmentsForUser(userId);
    return departments.length > 0 ? departments.join(', ') : 'No approved departments';
  }

  function canAddShift(userId: string) {
    return approvedDepartmentsForUser(userId).length > 0;
  }

  function departmentOptionsForUser(userId: string, currentDepartment: ScheduleDepartment) {
    const approvedDepartments = approvedDepartmentsForUser(userId);
    if (approvedDepartments.includes(currentDepartment)) {
      return approvedDepartments.map((department) => ({
        value: department,
        label: department
      }));
    }

    return [
      {
        value: currentDepartment,
        label: `${currentDepartment} (Not Approved)`
      },
      ...approvedDepartments.map((department) => ({
        value: department,
        label: department
      }))
    ];
  }

  function visibleShifts(cell: EmployeeRow['cells'][number]) {
    return selectedSection === 'All'
      ? cell.shifts
      : cell.shifts.filter((shift) => shift.department === selectedSection);
  }

  function addEmployeeRow() {
    if (!selectedEmployeeId || visibleUserIds.includes(selectedEmployeeId)) return;
    employeeRows = [...employeeRows, buildRow(selectedEmployeeId)];
    selectedEmployeeId = '';
    mobileTeamPanelOpen = false;
  }

  function removeEmployeeRow(userId: string) {
    employeeRows = employeeRows.filter((row) => row.userId !== userId);
  }

  function addShift(rowIndex: number, cellIndex: number) {
    const newShiftId = crypto.randomUUID();
    employeeRows = employeeRows.map((row, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return row;
      return {
        ...row,
        cells: row.cells.map((cell, currentCellIndex) => {
          if (currentCellIndex !== cellIndex) return cell;
          return {
            ...cell,
            shifts: [...cell.shifts, { ...createShift(row.userId, cell.date), clientId: newShiftId }]
          };
        })
      };
    });
  }

  function removeShift(rowIndex: number, cellIndex: number, clientId: string) {
    employeeRows = employeeRows.map((row, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return row;
      return {
        ...row,
        cells: row.cells.map((cell, currentCellIndex) => {
          if (currentCellIndex !== cellIndex) return cell;
          return {
            ...cell,
            shifts: cell.shifts.filter((shift) => shift.clientId !== clientId)
          };
        })
      };
    });
  }

  function toggleDuplicateDay(
    rowIndex: number,
    cellIndex: number,
    clientId: string,
    date: string
  ) {
    employeeRows = employeeRows.map((row, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return row;
      return {
        ...row,
        cells: row.cells.map((cell, currentCellIndex) => {
          if (currentCellIndex !== cellIndex) return cell;
          return {
            ...cell,
            shifts: cell.shifts.map((shift) => {
              if (shift.clientId !== clientId) return shift;
              const duplicateDates = shift.duplicateDates.includes(date)
                ? shift.duplicateDates.filter((entry) => entry !== date)
                : [...shift.duplicateDates, date];
              return { ...shift, duplicateDates };
            })
          };
        })
      };
    });
  }

  function updateDepartment(shift: DraftShift, userId: string, value: string) {
    const department = normalizeDepartment(value);
    const availableDepartments = departmentOptionsForUser(userId, shift.department).map(
      (option) => option.value
    );
    const nextDepartment = availableDepartments.includes(department)
      ? department
      : availableDepartments[0] ?? shift.department;
    const roles = rolesFor(nextDepartment);
    shift.department = nextDepartment;
    if (!roles.includes(shift.role)) {
      shift.role = roles[0];
    }
    employeeRows = [...employeeRows];
  }

  function toggleShiftCard(rowIndex: number, cellIndex: number, clientId: string) {
    employeeRows = employeeRows.map((row, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return row;
      return {
        ...row,
        cells: row.cells.map((cell, currentCellIndex) => {
          if (currentCellIndex !== cellIndex) return cell;
          return {
            ...cell,
            shifts: cell.shifts.map((shift) =>
              shift.clientId === clientId ? { ...shift, isEditing: !shift.isEditing } : shift
            )
          };
        })
      };
    });
  }

  function isExpanded(shift: DraftShift) {
    return shift.isEditing;
  }

  function shiftSummary(shift: DraftShift) {
    const pieces = [shift.department, shift.role];
    if (shift.detail) pieces.push(shift.detail);
    const time = shift.startTime
      ? `${formatScheduleTimeLabel(shift.startTime)}${shift.endLabel ? ` - ${shift.endLabel}` : ''}`
      : shift.endLabel || 'Time not set';
    return { title: pieces.join(' | '), time };
  }

  function parseTimeValue(value: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function shiftHours(shift: DraftShift) {
    const start = parseTimeValue(shift.startTime);
    const end = parseTimeValue(shift.endLabel);
    if (start === null || end === null) return null;
    let diff = end - start;
    if (diff < 0) diff += 24 * 60;
    return diff / 60;
  }

  function formatHours(value: number) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2).replace(/0$/, '');
  }

  function employeeHours(userId: string) {
    return allShifts.reduce((sum, shift) => {
      if (shift.userId !== userId) return sum;
      if (selectedSection !== 'All' && shift.department !== selectedSection) return sum;
      const hours = shiftHours(shift);
      return hours === null ? sum : sum + hours;
    }, 0);
  }

  function scheduleDateLabel(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  $: totalScheduledHours = allShifts.reduce((sum, shift) => {
    const hours = shiftHours(shift);
    return hours === null ? sum : sum + hours;
  }, 0);
  function collapseShift(rowIndex: number, cellIndex: number, clientId: string) {
    const row = employeeRows[rowIndex];
    const cell = row?.cells[cellIndex];
    const shift = cell?.shifts.find((entry) => entry.clientId === clientId);
    if (!row || !cell || !shift) return;

    const duplicateDates = shift.duplicateDates.filter((date) => date !== cell.date);

    employeeRows = employeeRows.map((row, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return row;
      return {
        ...row,
        cells: row.cells.map((cell, currentCellIndex) => {
          if (currentCellIndex !== cellIndex) return cell;
          return {
            ...cell,
            shifts: cell.shifts.map((shift) =>
              shift.clientId === clientId
                ? { ...shift, isEditing: false, duplicateDates: [] }
                : shift
            )
          };
        })
      };
    });

    if (duplicateDates.length === 0) return;

    employeeRows = employeeRows.map((rowEntry, currentRowIndex) => {
      if (currentRowIndex !== rowIndex) return rowEntry;
      return {
        ...rowEntry,
        cells: rowEntry.cells.map((cellEntry) => {
          if (!duplicateDates.includes(cellEntry.date)) return cellEntry;
          return {
            ...cellEntry,
            shifts: [
              ...cellEntry.shifts,
              {
                ...shift,
                clientId: crypto.randomUUID(),
                shiftDate: cellEntry.date,
                isEditing: false,
                duplicateDates: []
              }
            ]
          };
        })
      };
    });
  }
</script>

<Layout padded={false}>
  <div class="schedule-shell">
    <PageHeader title="Admin Schedule" subtitle="Build the whole week in one schedule sheet." />
    <div class="tabs-shell">
      <ScheduleAdminTabs active="builder" />
    </div>

    <nav class="subnav">
      <a href="/admin">Back to Dashboard</a>
      <a href="/admin/schedule-settings">Schedule Settings</a>
      <a href={`?week=${data.prevWeekStart}`}>Previous Week</a>
      <a href={`?week=${data.nextWeekStart}`}>Next Week</a>
    </nav>

    <section class="control-shell" aria-label="Schedule planning controls">
      <div class="control-grid">
        <section class="week-shell">
          <header class="week-head">
            <div>
              <span class="eyebrow">Week Of</span>
              <h2>{weekRangeLabel}</h2>
            </div>
            <div class="week-actions">
              <label class="section-filter">
                <span>Section</span>
                <select bind:value={selectedSection}>
                  <option value="All">All</option>
                  {#each scheduleDepartments as department}
                    <option value={department}>{department}</option>
                  {/each}
                </select>
              </label>
              <details class="action-menu">
                <summary class="menu-trigger">Schedule Actions</summary>
                <div class="menu-panel">
                  <form method="POST" action="?/copy_previous_week" use:enhance={withFeedback}>
                    <input type="hidden" name="week_start" value={data.weekStart} />
                    <button
                      type="submit"
                      class="menu-item"
                      class:autofill-preferred={data.settings.autofillNewWeeks}
                    >
                      {data.settings.autofillNewWeeks ? 'Autofill From Last Week' : 'Paste Last Week'}
                    </button>
                  </form>
                  <a href="/admin/schedule-settings" class="menu-item menu-link">Schedule Settings</a>
                  <form method="POST" action="?/publish_week" use:enhance={withFeedback}>
                    <input type="hidden" name="week_start" value={data.weekStart} />
                    <button type="submit" class="menu-item menu-item-primary">Publish</button>
                  </form>
                </div>
              </details>
            </div>
          </header>

          <div class="week-summary-row">
            <span class="status-pill">{visibleShiftCount} visible shifts</span>
            <span class:published={scheduleStateLabel === 'Published Schedule'} class="status-pill">
              {scheduleStateLabel}
            </span>
          </div>

          <form method="GET" class="week-picker">
            <label for="week-start">Jump to week</label>
            <input id="week-start" type="date" name="week" value={data.weekStart} />
            <button type="submit">Go</button>
          </form>
        </section>

        <section class="approval-shell">
          <header class="requests-head">
            <div>
              <span class="eyebrow">Shift Requests</span>
              <h2>Pending Approvals</h2>
            </div>
            <span class="status-pill">{pendingOffers.length} pending</span>
          </header>

          {#if pendingOffers.length === 0}
            <p class="requests-empty">No one is waiting on a pickup approval right now.</p>
          {:else}
            <p class="approval-note">
              Review requests below and approve or decline them before publishing schedule changes.
            </p>
          {/if}
        </section>
      </div>

      {#if pendingOffers.length > 0}
        <div class="request-list">
          {#each pendingOffers as offer}
            <article class="request-card">
              <div class="request-main">
                <strong>{offer.department} | {offer.role}</strong>
                <p class="request-time">
                  {scheduleDateLabel(offer.shiftDate)} | {formatScheduleTimeLabel(offer.startTime)}{#if offer.endLabel} - {offer.endLabel}{/if}
                </p>
                {#if offer.detail}
                  <p class="request-detail">{offer.detail}</p>
                {/if}
                <p class="request-meta">
                  Offered by {offer.offeredByUserName ?? offer.offeredByUserEmail}
                </p>
                <p class="request-meta">
                  Requested by {offer.requestedByUserName ?? offer.requestedByUserEmail}
                </p>
                {#if offer.targetUserId}
                  <p class="request-meta">
                    Directed to {offer.targetUserName ?? offer.targetUserEmail}
                  </p>
                {/if}
              </div>

              <div class="request-actions">
                <form method="POST" action="?/approve_offer" use:enhance={withFeedback}>
                  <input type="hidden" name="shift_id" value={offer.shiftId} />
                  <button type="submit" class="create-shift-btn">Approve</button>
                </form>
                <form method="POST" action="?/decline_offer" use:enhance={withFeedback}>
                  <input type="hidden" name="shift_id" value={offer.shiftId} />
                  <button type="submit" class="remove-btn request-decline-btn">Decline</button>
                </form>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <form method="POST" action="?/save_week" use:enhance={withFeedback} class="planner-shell">
      <input type="hidden" name="week_start" value={data.weekStart} />
      <input type="hidden" name="payload" value={weekPayload} />

        <div class="planner-head">
          <div>
            <span class="eyebrow">Week Builder</span>
            <h2>Team Schedule</h2>
          </div>
          <div class="planner-hours-shell">
            <span class="planner-hours">
              {selectedSection === 'All'
                ? `Tracked Hours: ${formatHours(totalScheduledHours)}`
                : `${selectedSection} Hours: ${formatHours(visibleScheduledHours)}`}
            </span>
            <div class="hours-breakdown">
              <span class="hours-chip">FOH {formatHours(departmentHourTotals.FOH)}</span>
              <span class="hours-chip">Sushi {formatHours(departmentHourTotals.Sushi)}</span>
              <span class="hours-chip">Kitchen {formatHours(departmentHourTotals.Kitchen)}</span>
            </div>
          </div>
          <button type="submit">Save Draft</button>
        </div>

      {#if mobileTeamPanelOpen}
        <button
          type="button"
          class="mobile-team-overlay"
          aria-label="Close team panel"
          on:click={() => (mobileTeamPanelOpen = false)}
        ></button>
      {/if}

      <aside class:open={mobileTeamPanelOpen} class="mobile-team-panel" aria-label="Team panel">
        <div class="mobile-team-head">
          <div>
            <span class="eyebrow">Team</span>
            <strong>Employee Controls</strong>
          </div>
          <button type="button" class="close-panel-btn" on:click={() => (mobileTeamPanelOpen = false)}>
            Close
          </button>
        </div>

        <div class="mobile-team-add">
          <select bind:value={selectedEmployeeId}>
            <option value="">Add employee</option>
            {#each availableUsers as user}
              <option value={user.id}>{user.displayName ?? user.email}</option>
            {/each}
          </select>
          <button type="button" class="add-employee-btn" on:click={addEmployeeRow}>Add Employee</button>
        </div>

        <div class="mobile-team-list">
          {#if employeeRows.length === 0}
            <p class="mobile-team-empty">No employees added yet.</p>
          {:else}
            {#each employeeRows as row (row.userId)}
              <div class="mobile-team-item">
                <div class="mobile-team-copy">
                  <strong>{employeeName(row.userId)}</strong>
                  <span>{approvedDepartmentLabel(row.userId)}</span>
                </div>
                <button type="button" class="remove-row-btn" on:click={() => removeEmployeeRow(row.userId)}>
                  Remove
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </aside>

      <div class="grid-scroll">
        <section class="schedule-grid" aria-label="Weekly schedule editor">
          <div class="corner-cell">
            <div class="corner-stack">
              <strong>Employees</strong>
              <button type="button" class="open-panel-btn" on:click={() => (mobileTeamPanelOpen = true)}>
                Add Employee
              </button>
              <div class="corner-actions">
                <select bind:value={selectedEmployeeId}>
                  <option value="">Add employee</option>
                  {#each availableUsers as user}
                    <option value={user.id}>{user.displayName ?? user.email}</option>
                  {/each}
                </select>
                <button type="button" class="add-employee-btn" on:click={addEmployeeRow}>
                  <span class="desktop-label">Add</span>
                  <span class="mobile-label">+</span>
                </button>
              </div>
            </div>
          </div>

          {#each data.days as day, dayIndex}
            <div class="day-header">
              <strong>{day.label}</strong>
              {#if totalsByDay[dayIndex]}
                <span>{totalsByDay[dayIndex].total} shifts</span>
                <small>FOH {totalsByDay[dayIndex].foh} | Sushi {totalsByDay[dayIndex].sushi} | Kitchen {totalsByDay[dayIndex].kitchen}</small>
              {/if}
            </div>
          {/each}

          {#if employeeRows.length === 0}
            <div class="employee-cell empty-employee-cell">
              <strong>No employees added</strong>
            </div>
            <div class="empty-grid-note" style={`grid-column: span ${data.days.length};`}>
              Add employees from the top-left selector to start building the schedule.
            </div>
          {/if}

          {#each employeeRows as row, rowIndex (row.userId)}
            <div class="employee-cell">
              <div class="employee-stack">
                <strong>{employeeName(row.userId)}</strong>
                <span class="employee-name-compact">{compactEmployeeName(row.userId)}</span>
                <span class="employee-departments">{approvedDepartmentLabel(row.userId)}</span>
                <span class="employee-hours">
                  Hours: {formatHours(employeeHours(row.userId))}
                </span>
                <button type="button" class="remove-row-btn" on:click={() => removeEmployeeRow(row.userId)}>
                  <span class="desktop-label">Remove Employee</span>
                  <span class="mobile-label">Remove</span>
                </button>
              </div>
            </div>

            {#each row.cells as cell, cellIndex (cell.date)}
              <div class="shift-cell">
                <div class="cell-body">
                  {#each visibleShifts(cell) as shift (shift.clientId)}
                    <div class:open={isExpanded(shift)} class="shift-card">
                      <button
                        type="button"
                        class="shift-card-top shift-toggle"
                        on:click={() => toggleShiftCard(rowIndex, cellIndex, shift.clientId)}
                        aria-expanded={isExpanded(shift)}
                      >
                        <div class="shift-preview">
                          <strong>{shiftSummary(shift).title}</strong>
                          <span>{shiftSummary(shift).time}</span>
                        </div>
                        <span class="toggle-text">{isExpanded(shift) ? 'Collapse' : 'Edit'}</span>
                      </button>

                      {#if isExpanded(shift)}
                        <div class="shift-editor">
                          <div class="input-grid two">
                            <label>
                              <span>Department</span>
                              <select
                                bind:value={shift.department}
                                on:change={(event) =>
                                  updateDepartment(
                                    shift,
                                    row.userId,
                                    (event.currentTarget as HTMLSelectElement).value
                                  )}
                              >
                                {#each departmentOptionsForUser(row.userId, shift.department) as option}
                                  <option value={option.value}>{option.label}</option>
                                {/each}
                              </select>
                            </label>

                            <label>
                              <span>Role</span>
                              <select bind:value={shift.role}>
                                {#each rolesFor(shift.department) as role}
                                  <option value={role}>{role}</option>
                                {/each}
                              </select>
                            </label>
                          </div>

                          <div class="input-grid two">
                            <label>
                              <span>Start</span>
                              <ScheduleTimeSelect bind:value={shift.startTime} />
                            </label>

                            <label class="end-group">
                              <span>End</span>
                              <ScheduleTimeSelect
                                bind:value={shift.endLabel}
                                includeSpecialOptions={[...scheduleEndLabels]}
                                specialPlaceholder="Timed End"
                              />
                            </label>
                          </div>

                          <label>
                            <span>Location / Detail</span>
                            <select bind:value={shift.detail}>
                              <option value="">Select detail</option>
                              {#each scheduleDetailOptionsFor(shift.department, shift.role) as detail}
                                <option value={detail}>{detail}</option>
                              {/each}
                            </select>
                          </label>

                          {#if !approvedDepartmentsForUser(row.userId).includes(shift.department)}
                            <p class="shift-warning">
                              {employeeName(row.userId)} is not approved for {shift.department}.
                            </p>
                          {/if}

                          <label>
                            <span>Notes</span>
                            <input bind:value={shift.notes} placeholder="Optional notes" />
                          </label>

                          <div class="duplicate-days">
                            <span>Duplicate To</span>
                            <div class="duplicate-day-chips">
                              {#each data.days as day}
                                {#if day.date !== cell.date}
                                  <button
                                    type="button"
                                    class="duplicate-day-btn"
                                    class:duplicate-day-btn-active={shift.duplicateDates.includes(day.date)}
                                    on:click={() =>
                                      toggleDuplicateDay(rowIndex, cellIndex, shift.clientId, day.date)}
                                  >
                                    {new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', {
                                      weekday: 'short'
                                    })}
                                  </button>
                                {/if}
                              {/each}
                            </div>
                          </div>

                          <div class="editor-actions">
                            <button
                              type="button"
                              class="create-shift-btn"
                              on:click={() => collapseShift(rowIndex, cellIndex, shift.clientId)}
                            >
                              Create Shift
                            </button>
                            <button
                              type="button"
                              class="remove-btn inline-remove"
                              aria-label="Remove shift"
                              on:click={() => removeShift(rowIndex, cellIndex, shift.clientId)}
                            >
                              Remove Shift
                            </button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>

                <button
                  type="button"
                  class="add-btn"
                  on:click={() => addShift(rowIndex, cellIndex)}
                  disabled={!canAddShift(row.userId)}
                  title={!canAddShift(row.userId) ? 'This employee has no approved schedule departments.' : undefined}
                >
                  Add Shift
                </button>
              </div>
            {/each}
          {/each}
        </section>
      </div>

    </form>
  </div>
</Layout>

<style>
  .schedule-shell {
    display: grid;
    gap: 1rem;
  }

  .subnav,
  .week-actions,
  .planner-head {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .subnav {
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

  .control-shell,
  .planner-shell {
    margin-inline: clamp(0.75rem, 2.6vw, var(--space-4));
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .control-shell {
    padding: 1rem;
    display: grid;
    gap: 0.9rem;
  }

  .week-shell,
  .approval-shell {
    display: grid;
    gap: 0.8rem;
  }

  .planner-shell {
    overflow: hidden;
  }

  .control-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
    gap: 1rem;
    align-items: start;
  }

  .week-head,
  .requests-head,
  .planner-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }

  .eyebrow,
  .week-picker label,
  .shift-card label span {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .section-filter {
    display: grid;
    gap: 0.25rem;
    min-width: 8.5rem;
  }

  .section-filter span {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .week-head h2,
  .requests-head h2,
  .planner-head h2 {
    margin: 0.18rem 0 0;
  }

  .week-picker {
    display: grid;
    grid-template-columns: auto minmax(160px, 220px) auto;
    gap: 0.6rem;
    align-items: center;
  }

  .week-summary-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
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

  .action-menu {
    position: relative;
  }

  .menu-trigger {
    list-style: none;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
    color: var(--color-text);
    min-height: 2.3rem;
    padding: 0.5rem 0.76rem;
    cursor: pointer;
    font-size: 0.78rem;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .menu-trigger::-webkit-details-marker {
    display: none;
  }

  .menu-trigger::after {
    content: '▾';
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }

  .menu-panel {
    position: absolute;
    right: 0;
    top: calc(100% + 0.4rem);
    min-width: 13.5rem;
    display: grid;
    gap: 0.35rem;
    padding: 0.45rem;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.3);
    z-index: 12;
  }

  .menu-panel form {
    display: block;
  }

  .menu-item {
    width: 100%;
    justify-content: flex-start;
    border-color: rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: var(--color-text);
    text-decoration: none;
  }

  .menu-item-primary {
    border-color: rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
  }

  .menu-link {
    display: inline-flex;
    align-items: center;
    min-height: 2.3rem;
    padding: 0.5rem 0.76rem;
    border-radius: 10px;
  }

  .planner-head {
    padding: 1rem 1rem 0.85rem;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .planner-hours {
    color: var(--color-text-muted);
    font-size: 0.82rem;
    padding-top: 0.3rem;
  }

  .planner-hours-shell {
    display: grid;
    gap: 0.35rem;
    align-content: start;
  }

  .hours-breakdown {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .hours-chip {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 0.18rem 0.55rem;
    font-size: 0.74rem;
    color: var(--color-text-muted);
    background: rgba(255,255,255,0.03);
  }

  .request-list {
    display: grid;
    gap: 0.7rem;
  }

  .request-card {
    display: flex;
    justify-content: space-between;
    gap: 0.85rem;
    padding: 0.85rem;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    background: rgba(255,255,255,0.025);
  }

  .request-main {
    display: grid;
    gap: 0.2rem;
  }

  .request-time,
  .request-detail,
  .request-meta,
  .requests-empty,
  .approval-note {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.45;
  }

  .request-actions {
    display: grid;
    gap: 0.45rem;
    align-content: start;
    min-width: 8rem;
  }

  .request-actions form {
    display: block;
  }

  .request-actions button {
    width: 100%;
  }

  .request-decline-btn {
    min-height: 2.3rem;
  }

  .mobile-team-overlay,
  .mobile-team-panel {
    display: none;
  }

  .grid-scroll {
    overflow-x: auto;
  }

  .schedule-grid {
    display: grid;
    grid-template-columns: 220px repeat(7, minmax(240px, 1fr));
    min-width: max-content;
  }

  .corner-cell,
  .day-header,
  .employee-cell,
  .shift-cell {
    border-right: 1px solid rgba(255,255,255,0.06);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .corner-cell,
  .day-header {
    position: sticky;
    top: 0;
    z-index: 2;
    background: color-mix(in srgb, var(--color-surface) 95%, black 5%);
  }

  .corner-cell {
    left: 0;
    z-index: 4;
    padding: 0.85rem 0.95rem;
  }

  .corner-stack {
    display: grid;
    gap: 0.45rem;
  }

  .corner-stack strong {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .mobile-label {
    display: none;
  }

  .open-panel-btn,
  .close-panel-btn {
    display: none;
  }

  .corner-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.45rem;
  }

  .day-header {
    padding: 0.85rem 0.9rem;
    display: grid;
    gap: 0.18rem;
  }

  .day-header span,
  .day-header small {
    color: var(--color-text-muted);
  }

  .day-header span {
    font-size: 0.76rem;
  }

  .day-header small {
    font-size: 0.7rem;
    line-height: 1.35;
  }

  .employee-cell {
    position: sticky;
    left: 0;
    z-index: 3;
    background: color-mix(in srgb, var(--color-surface) 95%, black 5%);
    padding: 0.9rem;
    display: flex;
    align-items: start;
  }

  .employee-stack {
    display: grid;
    gap: 0.5rem;
  }

  .employee-name-compact {
    display: none;
  }

  .employee-departments {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .employee-hours {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .employee-cell strong,
  .day-header strong {
    font-size: 0.88rem;
  }

  .empty-employee-cell,
  .empty-grid-note {
    position: static;
    background: rgba(255,255,255,0.02);
  }

  .empty-grid-note {
    padding: 0.9rem;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
  }

  .shift-cell {
    display: grid;
    gap: 0.6rem;
    padding: 0.7rem;
    align-content: start;
    min-height: 170px;
  }

  .cell-body {
    display: grid;
    gap: 0.55rem;
  }

  .shift-card {
    display: grid;
    gap: 0.3rem;
    padding: 0.55rem;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    background: rgba(255,255,255,0.025);
  }

  .shift-card.open {
    gap: 0.55rem;
    padding: 0.7rem;
  }

  .shift-card-top {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: start;
  }

  .shift-toggle {
    width: 100%;
    text-align: left;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: var(--color-text);
    min-height: 0;
    padding: 0.55rem 0.6rem;
  }

  .shift-preview {
    display: grid;
    gap: 0.18rem;
  }

  .shift-preview strong {
    font-size: 0.82rem;
  }

  .shift-preview span {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .toggle-text {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .shift-editor {
    display: grid;
    gap: 0.45rem;
  }

  .editor-actions {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .input-grid {
    display: grid;
    gap: 0.45rem;
  }

  .input-grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .shift-card label {
    display: grid;
    gap: 0.25rem;
  }

  .shift-warning {
    margin: 0;
    color: #fcd34d;
    font-size: 0.74rem;
    line-height: 1.4;
  }

  .duplicate-days {
    display: grid;
    gap: 0.35rem;
  }

  .duplicate-days > span {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .duplicate-day-chips {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .duplicate-day-btn {
    width: auto;
    min-height: 2rem;
    padding: 0.35rem 0.7rem;
    border-color: rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: var(--color-text);
    font-size: 0.74rem;
  }

  .duplicate-day-btn.duplicate-day-btn-active {
    border-color: rgba(22, 163, 74, 0.25);
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.08));
    color: #dcfce7;
  }

  input,
  select {
    width: 100%;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 0.42rem 0.56rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.8rem;
  }

  button {
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    min-height: 2.3rem;
    padding: 0.5rem 0.76rem;
    cursor: pointer;
    font-size: 0.78rem;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .add-btn,
  .remove-btn,
  .add-employee-btn,
  .remove-row-btn {
    border-color: rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: var(--color-text);
  }

  .menu-item.autofill-preferred {
    border-color: rgba(22, 163, 74, 0.25);
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.07));
    color: #dcfce7;
  }

  .add-btn {
    width: 100%;
  }

  .remove-btn,
  .remove-row-btn {
    color: #ffb6b6;
    border-color: rgba(239, 68, 68, 0.24);
    background: rgba(120, 12, 18, 0.14);
  }

  .inline-remove {
    width: auto;
    flex: 1 1 8rem;
  }

  .create-shift-btn {
    border-color: rgba(22, 163, 74, 0.25);
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.22), rgba(22, 163, 74, 0.08));
    color: #dcfce7;
    flex: 1 1 8rem;
  }

  .remove-btn {
    min-height: 1.9rem;
    padding-inline: 0.6rem;
  }

  @media (max-width: 960px) {
    .control-grid {
      grid-template-columns: 1fr;
    }

    .week-picker,
    .input-grid.two {
      grid-template-columns: 1fr;
    }

    .planner-head {
      flex-direction: column;
      align-items: stretch;
    }

    .request-card {
      flex-direction: column;
    }

    .request-actions {
      min-width: 0;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .menu-panel {
      left: 0;
      right: auto;
    }
  }

  @media (max-width: 760px) {
    .schedule-grid {
      grid-template-columns: 92px repeat(7, minmax(260px, 1fr));
    }

    .corner-cell,
    .employee-cell {
      padding: 0.65rem;
    }

    .corner-stack {
      gap: 0.35rem;
    }

    .corner-stack strong {
      font-size: 0.68rem;
    }

    .open-panel-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 2rem;
      padding: 0.35rem 0.65rem;
      font-size: 0.72rem;
      border-color: rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: var(--color-text);
    }

    .corner-actions {
      display: none;
    }

    .mobile-team-overlay {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(4, 5, 7, 0.62);
      border: 0;
      padding: 0;
      z-index: 19;
    }

    .mobile-team-panel {
      display: grid;
      gap: 0.75rem;
      position: fixed;
      top: calc(1rem + var(--safe-top));
      left: calc(0.75rem + var(--safe-left));
      bottom: calc(1rem + var(--safe-bottom));
      width: min(20rem, calc(100vw - 1.5rem - var(--safe-left) - var(--safe-right)));
      padding: 0.9rem;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: var(--radius-lg);
      background:
        linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
        color-mix(in srgb, var(--color-surface) 95%, black 5%);
      box-shadow: 0 18px 48px rgba(4, 5, 7, 0.35);
      transform: translateX(calc(-100% - 1rem));
      transition: transform 180ms ease;
      z-index: 20;
      overflow-y: auto;
    }

    .mobile-team-panel.open {
      transform: translateX(0);
    }

    .mobile-team-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .mobile-team-head strong {
      display: block;
      margin-top: 0.18rem;
      font-size: 1rem;
    }

    .close-panel-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2rem;
      padding: 0.42rem 0.8rem;
      font-size: 0.76rem;
      border-color: rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: var(--color-text);
    }

    .mobile-team-add {
      display: grid;
      gap: 0.35rem;
    }

    .mobile-team-list {
      display: grid;
      gap: 0.55rem;
      align-content: start;
    }

    .mobile-team-item {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 0.6rem;
      padding: 0.7rem;
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      background: rgba(255,255,255,0.025);
    }

    .mobile-team-copy {
      display: grid;
      gap: 0.22rem;
      min-width: 0;
    }

    .mobile-team-copy strong {
      font-size: 0.84rem;
    }

    .mobile-team-copy span,
    .mobile-team-empty {
      color: var(--color-text-muted);
      font-size: 0.74rem;
      line-height: 1.4;
    }

    .mobile-team-add select,
    .mobile-team-add .add-employee-btn,
    .mobile-team-item .remove-row-btn {
      min-height: 2rem;
      font-size: 0.72rem;
    }

    .employee-stack {
      gap: 0.35rem;
    }

    .employee-cell strong,
    .day-header strong {
      font-size: 0.8rem;
    }

    .employee-cell strong {
      display: none;
    }

    .employee-name-compact {
      display: block;
      font-size: 0.76rem;
      line-height: 1.25;
      color: var(--color-text);
      word-break: break-word;
    }

    .employee-departments {
      display: none;
    }

    .employee-hours {
      font-size: 0.68rem;
    }

    .employee-cell .remove-row-btn {
      display: none;
    }

    .desktop-label {
      display: none;
    }

    .mobile-label {
      display: inline;
    }
  }
</style>

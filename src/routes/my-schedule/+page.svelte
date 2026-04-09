<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import SchoolOfFish from '$lib/components/ui/SchoolOfFish.svelte';
  import AvailabilityEditor from '$lib/components/ui/AvailabilityEditor.svelte';
  import {
    formatScheduleTimeLabel,
    formatScheduleWeekRange,
    isValidScheduleDepartment,
    type ScheduleDepartment
  } from '$lib/assets/schedule';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  export let data: {
    userId: string;
    weekStart: string;
    prevWeekStart: string;
    nextWeekStart: string;
    week: { status: 'draft' | 'published' } | null;
    employees: Array<{
      id: string;
      displayName: string | null;
      email: string;
      approvedDepartments: ScheduleDepartment[];
    }>;
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
    offers: Array<{
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
    }>;
    availability: Array<{
      weekday: number;
      isAvailable: boolean;
      startTime: string;
      endTime: string;
    }>;
    timeOffRequests: Array<{
      id: string;
      startDate: string;
      endDate: string;
      note: string;
      status: 'pending' | 'approved' | 'declined';
      managerNote: string;
    }>;
  };

  type ShiftSummary = {
    id: string;
    department: string;
    role: string;
    detail: string;
    startTime: string;
    endLabel: string;
  };

  let activeOfferShift: ShiftSummary | null = null;
  let activeOfferTargetUserId = '';
  let availabilityEntries = data.availability.map((entry) => ({ ...entry }));
  let availabilitySeed = JSON.stringify(data.availability);

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
      }
      if (result.type === 'success') {
        pushToast(result.data?.message ?? 'Saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That update could not be saved.', 'error');
      }
    };
  };

  function todayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  $: weekRangeLabel = formatScheduleWeekRange(
    data.days.map((day) => day.date),
    data.weekStart
  );
  $: if (JSON.stringify(data.availability) !== availabilitySeed) {
    availabilitySeed = JSON.stringify(data.availability);
    availabilityEntries = data.availability.map((entry) => ({ ...entry }));
  }
  $: offersByShiftId = new Map(data.offers.map((offer) => [offer.shiftId, offer]));
  $: openShiftOffers = data.offers.filter((offer) => offer.offeredByUserId !== data.userId);
  $: myOfferCount = data.offers.filter((offer) => offer.offeredByUserId === data.userId).length;
  $: totalShiftCount = data.days.reduce((total, day) => total + day.shifts.length, 0);
  $: weeklyTrackedHours = data.days.reduce(
    (total, day) =>
      total +
      day.shifts.reduce((sum, shift) => {
        const hours = shiftHours(shift.startTime, shift.endLabel);
        return hours === null ? sum : sum + hours;
      }, 0),
    0
  );

  function canOfferShift(shiftDate: string) {
    return shiftDate >= todayIso();
  }

  function isMyShiftRequest(requestedByUserId: string | null) {
    return requestedByUserId === data.userId;
  }

  function hasAnotherRequester(requestedByUserId: string | null) {
    return Boolean(requestedByUserId && requestedByUserId !== data.userId);
  }

  function employeeOptionsForShift(department: string) {
    if (!isValidScheduleDepartment(department)) return [];
    return data.employees.filter(
      (employee) => employee.id !== data.userId && employee.approvedDepartments.includes(department)
    );
  }

  function openOfferPopup(shift: ShiftSummary) {
    activeOfferShift = shift;
    activeOfferTargetUserId = '';
  }

  function closeOfferPopup() {
    activeOfferShift = null;
    activeOfferTargetUserId = '';
  }

  function offerAudienceLabel(offer: (typeof data.offers)[number]) {
    if (offer.targetUserId) {
      return `Offered to ${offer.targetUserName ?? offer.targetUserEmail}`;
    }
    return 'Up for grabs';
  }

  function offerOwnerLabel(offer: (typeof data.offers)[number]) {
    if (offer.targetUserId === data.userId) {
      return `Offered to you by ${offer.offeredByUserName ?? offer.offeredByUserEmail}`;
    }
    return `Offered by ${offer.offeredByUserName ?? offer.offeredByUserEmail}`;
  }

  function parseTimeValue(value: string) {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function shiftHours(startTime: string, endLabel: string) {
    const start = parseTimeValue(startTime);
    const end = parseTimeValue(endLabel);
    if (start === null || end === null) return null;
    let diff = end - start;
    if (diff < 0) diff += 24 * 60;
    return diff / 60;
  }

  function formatHours(value: number) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2).replace(/0$/, '');
  }

  function formatRequestDate(value: string) {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }

  function formatRequestRange(startDate: string, endDate: string) {
    return startDate === endDate
      ? formatRequestDate(startDate)
      : `${formatRequestDate(startDate)} - ${formatRequestDate(endDate)}`;
  }

  function timeOffStatusLabel(status: 'pending' | 'approved' | 'declined') {
    if (status === 'approved') return 'Approved';
    if (status === 'declined') return 'Declined';
    return 'Pending Review';
  }

  const withOfferFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        closeOfferPopup();
        await invalidateAll();
        pushToast('Shift update saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That shift update could not be saved.', 'error');
      }
    };
  };

  const withAvailabilityFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Availability updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'Availability could not be saved.', 'error');
      }
    };
  };
</script>

<Layout padded={false}>
  <div class="schedule-shell">
    <PageHeader title="My Schedule" subtitle="Your posted week, broken down day by day." />

    <nav class="subnav">
      <a href="/schedule">Team Schedule</a>
      <a href={`?week=${data.prevWeekStart}`}>Previous Week</a>
      <a href={`?week=${data.nextWeekStart}`}>Next Week</a>
    </nav>

    <section class="week-banner">
      <div>
        <span class="eyebrow">Week Of</span>
        <h2>{weekRangeLabel}</h2>
      </div>
      <span>
        {totalShiftCount} shifts | {formatHours(weeklyTrackedHours)} hours
        {#if myOfferCount > 0} | {myOfferCount} offered{/if}
      </span>
    </section>

    <section class="availability-shell" aria-label="Weekly availability">
      <header class="offers-head">
        <div>
          <span class="eyebrow">Availability</span>
          <h3>Recurring Weekly Availability</h3>
        </div>
        <small>Managers use this when building schedules.</small>
      </header>

      <AvailabilityEditor
        entries={availabilityEntries}
        action="?/save_availability"
        enhanceFn={withAvailabilityFeedback}
        submitLabel="Save Availability"
        buttonClass="offer-btn availability-save-btn"
      />
    </section>

    <section class="offers-shell" aria-label="Time Off Requests">
      <header class="offers-head">
        <div>
          <span class="eyebrow">Time Off</span>
          <h3>Request Time Off</h3>
        </div>
        <small>{data.timeOffRequests.length} requests on file</small>
      </header>

      <form method="POST" action="?/request_time_off" use:enhance={withFeedback} class="timeoff-form">
        <label>
          <span>Start Date</span>
          <input type="date" name="start_date" required />
        </label>
        <label>
          <span>End Date</span>
          <input type="date" name="end_date" required />
        </label>
        <label class="timeoff-note">
          <span>Note</span>
          <input type="text" name="note" maxlength="160" placeholder="Optional reason or context" />
        </label>
        <div class="availability-actions">
          <button type="submit" class="offer-btn availability-save-btn">Submit Request</button>
        </div>
      </form>

      {#if data.timeOffRequests.length === 0}
        <p class="offers-empty">No time off requests submitted yet.</p>
      {:else}
        <div class="offer-list">
          {#each data.timeOffRequests as request}
            <article class="offer-card">
              <div class="offer-copy">
                <strong>{formatRequestRange(request.startDate, request.endDate)}</strong>
                <p class="offer-time">{timeOffStatusLabel(request.status)}</p>
                {#if request.note}
                  <p class="offer-detail">{request.note}</p>
                {/if}
                {#if request.managerNote}
                  <p class="offer-owner">Manager note: {request.managerNote}</p>
                {/if}
              </div>
              <div class="offer-actions">
                <span class:requested={request.status === 'approved'} class:pending={request.status === 'pending'} class="offer-badge">
                  {timeOffStatusLabel(request.status)}
                </span>
                {#if request.status === 'pending'}
                  <form method="POST" action="?/cancel_time_off_request" use:enhance={withFeedback}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <button type="submit" class="offer-btn">Cancel Request</button>
                  </form>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      {/if}
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
                {@const offer = offersByShiftId.get(shift.id)}
                <div class="shift-card">
                  <div class="shift-headline">
                    <div class="shift-copy">
                      <strong>{shift.department} | {shift.role}</strong>
                      <p class="shift-time">
                        {formatScheduleTimeLabel(shift.startTime)}{#if shift.endLabel} - {shift.endLabel}{/if}
                      </p>
                    </div>
                    {#if offer}
                      <form method="POST" action="?/cancel_offer" use:enhance={withFeedback}>
                        <input type="hidden" name="shift_id" value={shift.id} />
                        <button type="submit" class="offer-btn">Cancel Offer</button>
                      </form>
                    {:else if canOfferShift(shift.shiftDate)}
                      <button
                        type="button"
                        class="offer-btn"
                        on:click={() =>
                          openOfferPopup({
                            id: shift.id,
                            department: shift.department,
                            role: shift.role,
                            detail: shift.detail,
                            startTime: shift.startTime,
                            endLabel: shift.endLabel
                          })}
                      >
                        Offer Shift
                      </button>
                    {/if}
                  </div>
                  {#if shift.detail}
                    <p class="shift-detail">{shift.detail}</p>
                  {/if}
                  {#if shift.notes}
                    <p class="shift-notes">{shift.notes}</p>
                  {/if}
                  {#if offer}
                    <div class="offer-state">
                      <span class="offer-badge">{offerAudienceLabel(offer)}</span>
                      {#if offer.requestedByUserId}
                        <span class="offer-request-note">
                          Requested by {offer.requestedByUserName ?? offer.requestedByUserEmail}
                        </span>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </article>
      {/each}
    </section>

    <section class="offers-shell" aria-label="Open Shifts">
      <header class="offers-head">
        <div>
          <span class="eyebrow">Open Shifts</span>
          <h3>Available Pickups</h3>
        </div>
        <small>{openShiftOffers.length} available this week</small>
      </header>

      {#if openShiftOffers.length === 0}
        <p class="offers-empty">No shifts are up for grabs right now.</p>
      {:else}
        <div class="offer-list">
          {#each openShiftOffers as offer}
            <article class="offer-card">
              <div class="offer-copy">
                <strong>{offer.department} | {offer.role}</strong>
                <p class="offer-time">
                  {new Date(`${offer.shiftDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  | {formatScheduleTimeLabel(offer.startTime)}{#if offer.endLabel} - {offer.endLabel}{/if}
                </p>
                {#if offer.detail}
                  <p class="offer-detail">{offer.detail}</p>
                {/if}
                <p class="offer-owner">{offerOwnerLabel(offer)}</p>
              </div>
              <div class="offer-actions">
                {#if isMyShiftRequest(offer.requestedByUserId)}
                  <span class="offer-badge requested">Requested</span>
                  <form method="POST" action="?/withdraw_request" use:enhance={withFeedback}>
                    <input type="hidden" name="shift_id" value={offer.shiftId} />
                    <button type="submit" class="offer-btn">Withdraw Request</button>
                  </form>
                {:else if hasAnotherRequester(offer.requestedByUserId)}
                  <span class="offer-badge pending">Pending</span>
                  <p class="offer-request-note">
                    Requested by {offer.requestedByUserName ?? offer.requestedByUserEmail}
                  </p>
                {:else}
                  <form method="POST" action="?/request_offer" use:enhance={withFeedback}>
                    <input type="hidden" name="shift_id" value={offer.shiftId} />
                    <button type="submit" class="offer-btn">Request Shift</button>
                  </form>
                {/if}
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</Layout>

{#if activeOfferShift}
  <div
    class="popup-backdrop"
    role="button"
    tabindex="0"
    aria-label="Close offer popup"
    on:click={closeOfferPopup}
    on:keydown={(event) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeOfferPopup();
      }
    }}
  >
    <div
      class="offer-popup"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="offer-popup-title"
      on:click|stopPropagation
      on:keydown|stopPropagation={() => {}}
    >
      <div class="offer-popup-copy">
        <span class="eyebrow">Offer Shift</span>
        <h3 id="offer-popup-title">{activeOfferShift.department} | {activeOfferShift.role}</h3>
        <p class="offer-popup-time">
          {formatScheduleTimeLabel(activeOfferShift.startTime)}{#if activeOfferShift.endLabel} - {activeOfferShift.endLabel}{/if}
        </p>
        {#if activeOfferShift.detail}
          <p class="offer-popup-note">{activeOfferShift.detail}</p>
        {/if}
        <p class="offer-popup-note">Offer this shift to everyone, or send it to one employee directly.</p>
      </div>

      <form method="POST" action="?/offer_shift" use:enhance={withOfferFeedback} class="offer-popup-form">
        <input type="hidden" name="shift_id" value={activeOfferShift.id} />
        <label>
          <span>Offer To</span>
          <select bind:value={activeOfferTargetUserId} name="target_user_id">
            <option value="">Everyone</option>
            {#each employeeOptionsForShift(activeOfferShift.department) as employee}
              <option value={employee.id}>{employee.displayName ?? employee.email}</option>
            {/each}
          </select>
        </label>
        <div class="offer-popup-actions">
          <button type="button" class="offer-btn" on:click={closeOfferPopup}>Cancel</button>
          <button type="submit" class="offer-btn">Confirm Offer</button>
        </div>
      </form>
    </div>
  </div>
{/if}

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
    gap: 0.3rem;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 0.75rem 0.8rem;
    background: rgba(255,255,255,0.025);
  }

  .shift-headline {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: start;
  }

  .shift-copy {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
  }

  .shift-headline > :last-child {
    flex: 0 0 auto;
  }

  .offer-state,
  .offer-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .offer-state {
    margin-top: 0.15rem;
  }

  .offer-request-note {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.76rem;
    line-height: 1.4;
  }

  .offer-badge {
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fcd34d;
    border-radius: 999px;
    padding: 0.22rem 0.55rem;
    font-size: 0.72rem;
    background: rgba(255,255,255,0.03);
  }

  .offer-badge.requested {
    border-color: rgba(22, 163, 74, 0.24);
    color: #bbf7d0;
  }

  .offer-badge.pending {
    border-color: rgba(59, 130, 246, 0.22);
    color: #bfdbfe;
  }

  .offer-btn {
    border: 1px solid rgba(255,255,255,0.1);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025)),
      color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    border-radius: 10px;
    padding: 0.44rem 0.7rem;
    font-size: 0.76rem;
    min-height: 2rem;
    cursor: pointer;
  }

  .offer-actions .offer-btn,
  .offer-popup-actions .offer-btn:last-child {
    border-color: rgba(195, 32, 43, 0.22);
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
  }

  .offer-popup-actions .offer-btn:first-child,
  .shift-headline form .offer-btn,
  .shift-headline > .offer-btn {
    border-color: rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: var(--color-text);
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

  .offers-shell {
    margin-inline: clamp(0.75rem, 2.6vw, var(--space-4));
    margin-bottom: 1rem;
    padding: 0.95rem 1rem;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    display: grid;
    gap: 0.85rem;
  }

  .availability-shell {
    margin-inline: clamp(0.75rem, 2.6vw, var(--space-4));
    padding: 0.95rem 1rem;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    display: grid;
    gap: 0.85rem;
  }

  .availability-actions {
    display: flex;
    justify-content: flex-end;
  }

  .availability-save-btn {
    min-width: 11rem;
  }

  .offers-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }

  .offers-head h3 {
    margin: 0.18rem 0 0;
  }

  .timeoff-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
  }

  .timeoff-form label {
    display: grid;
    gap: 0.35rem;
  }

  .timeoff-form label span {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .timeoff-form input {
    width: 100%;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 0.42rem 0.56rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.8rem;
  }

  .timeoff-note {
    grid-column: 1 / -1;
  }

  .offers-head small,
  .offers-empty,
  .offer-time,
  .offer-detail,
  .offer-owner {
    color: var(--color-text-muted);
  }

  .offer-list {
    display: grid;
    gap: 0.7rem;
  }

  .offer-card {
    display: flex;
    justify-content: space-between;
    gap: 0.9rem;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 0.85rem;
    background: rgba(255,255,255,0.025);
  }

  .offer-copy {
    display: grid;
    gap: 0.18rem;
  }

  .offer-time,
  .offer-detail,
  .offer-owner,
  .offers-empty {
    margin: 0;
    line-height: 1.45;
  }

  .popup-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(4, 5, 7, 0.72);
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 30;
  }

  .offer-popup {
    width: min(100%, 28rem);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
      color-mix(in srgb, var(--color-surface) 95%, black 5%);
    box-shadow: 0 18px 48px rgba(4, 5, 7, 0.35);
    padding: 1rem;
    display: grid;
    gap: 0.9rem;
  }

  .offer-popup-copy,
  .offer-popup-form,
  .offer-popup-form label {
    display: grid;
    gap: 0.45rem;
  }

  .offer-popup-copy h3 {
    margin: 0;
  }

  .offer-popup-time,
  .offer-popup-note,
  .offer-popup-form label span {
    margin: 0;
    color: var(--color-text-muted);
  }

  .offer-popup-form label span {
    font-size: 0.76rem;
  }

  .offer-popup-form select {
    width: 100%;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 0.42rem 0.56rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.8rem;
  }

  .offer-popup-actions {
    display: flex;
    justify-content: end;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  @media (max-width: 760px) {
    .offer-card,
    .offers-head {
      flex-direction: column;
    }

    .timeoff-form {
      grid-template-columns: 1fr;
    }
  }
</style>

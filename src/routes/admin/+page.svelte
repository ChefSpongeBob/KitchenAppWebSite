<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { applyAction, enhance } from '$app/forms';
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import GuidedSpotlightTour from '$lib/components/ui/GuidedSpotlightTour.svelte';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { AppFeatureAccess } from '$lib/features/appFeatures';

  type Todo = {
    id: string;
    title: string;
    description: string;
    completed_at: number | null;
    created_at: number;
    assigned_name?: string | null;
    assigned_email?: string | null;
  };

  type UserOption = { id: string; display_name: string | null; email: string };
  type WhiteboardIdea = {
    id: string;
    content: string;
    votes: number;
    status: 'pending' | 'approved' | 'rejected';
    created_at: number;
    submitted_name?: string | null;
    submitted_email?: string | null;
  };
  type SavedReminder = { id: string; content: string; created_at: number; updated_at: number };
  type AvailabilityEntry = { weekday: number; isAvailable: boolean; startTime: string; endTime: string };
  type GuidedStep = {
    selector: string;
    title: string;
    description: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
  };

  export let data: {
    guided?: boolean;
    todos: Todo[];
    savedReminders: SavedReminder[];
    users: UserOption[];
    whiteboardIdeas: WhiteboardIdea[];
    announcement: { content: string; updatedAt: number };
    announcementHistory: Array<{
      id: string;
      content: string;
      createdBy: string | null;
      createdByName: string | null;
      createdByEmail: string | null;
      createdAt: number;
    }>;
    employeeSpotlight: { employeeName: string; shoutout: string; updatedAt: number };
    featureAccess: AppFeatureAccess;
    analytics: {
      windowDays: number;
      staffingSeries: Array<{ day: string; label: string; staffed: number; target: number }>;
    };
    schedule: {
      pendingTimeOff: Array<{
        id: string;
        userId: string;
        userName: string | null;
        userEmail: string;
        startDate: string;
        endDate: string;
        note: string;
      }>;
      pendingAvailability: Array<{
        id: string;
        userId: string;
        userName: string | null;
        userEmail: string;
        availability: AvailabilityEntry[];
        updatedAt: number;
      }>;
    };
    temperatureAnomalies: Array<{
      id: string;
      sensorId: number;
      name: string;
      eventType: 'high' | 'low' | 'stale' | 'offline' | 'recovered';
      temperature: number | null;
      threshold: number | null;
      lastSeenAt: number;
    }>;
    summary: {
      pendingUsers: number;
      pendingIdeas: number;
      staffedEmployees: number;
      todoActive: number;
      todoCompleted: number;
      nodesOperational: number;
      nodesTracked: number;
      schedulePending: number;
      temperatureAnomalies: number;
    };
  };

  let adminMessage = '';
  let showGuidedTour = data.guided ?? false;
  const chartWidth = 520;
  const chartHeight = 150;
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const windowOptions = [
    { value: 1, label: '24H' },
    { value: 7, label: '7D' },
    { value: 30, label: '30D' }
  ];

  const guidedSteps: GuidedStep[] = [
    {
      selector: '[data-guide="admin-command-center"]',
      title: 'Ops Command Center',
      description: 'Review the operation snapshot before opening a workspace.',
      placement: 'bottom'
    },
    ...(data.featureAccess.temps
      ? [{
          selector: '[data-guide="admin-temperature"]',
          title: 'Temperature Exceptions',
          description: 'Only sensors that need attention appear here. Open monitoring for full readings.',
          placement: 'bottom' as const
        }]
      : []),
    ...(data.featureAccess.scheduling
      ? [{
          selector: '[data-guide="admin-schedule"]',
          title: 'Schedule and People',
          description: 'Open the builder, review requests, or move directly into employee management.',
          placement: 'bottom' as const
        }]
      : []),
    {
      selector: '[data-guide="admin-reminders"]',
      title: 'Reminders',
      description: 'Keep short manager notes and current action items together.',
      placement: 'left'
    },
    ...(data.featureAccess.whiteboard
      ? [{
          selector: '[data-guide="admin-whiteboard"]',
          title: 'Whiteboard Manager',
          description: 'Review submitted ideas and moderate them without leaving the dashboard.',
          placement: 'top' as const
        }]
      : []),
    ...(data.featureAccess.todo
      ? [{
          selector: '[data-guide="admin-todos"]',
          title: 'Assigned Tasks',
          description: 'Assign work and see aging open tasks side by side.',
          placement: 'top' as const
        }]
      : []),
    ...(data.featureAccess.announcements
      ? [{
          selector: '[data-guide="admin-announcements"]',
          title: 'Announcement Manager',
          description: 'Publish the current update and review its recent history.',
          placement: 'top' as const
        }]
      : []),
    {
      selector: '[data-guide="admin-workspaces"]',
      title: 'Workspace Setup',
      description: 'Open ownership, feature controls, or the content builder.',
      placement: 'top'
    },
    {
      selector: '[data-guide="sidebar-toggle"]',
      title: 'Manager Menu',
      description: 'The sidebar keeps every manager route available from the rest of the app.',
      placement: 'right'
    }
  ];

  const withAdminFeedback: SubmitFunction = () => {
    adminMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Manager changes saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That action could not be completed.', 'error');
      }
      adminMessage =
        result.type === 'success'
          ? result.data?.message ?? 'Manager changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That action could not be completed.'
            : '';
    };
  };

  const withAdminResetFeedback: SubmitFunction = ({ formElement }) => {
    adminMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        formElement.reset();
        await invalidateAll();
        pushToast(result.data?.message ?? 'Manager changes saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That action could not be completed.', 'error');
      }
      adminMessage =
        result.type === 'success'
          ? result.data?.message ?? 'Manager changes saved.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That action could not be completed.'
            : '';
    };
  };

  async function clearGuidedQuery() {
    if (typeof window === 'undefined') return;
    const current = new URL(window.location.href);
    if (!current.searchParams.has('guided')) return;
    current.searchParams.delete('guided');
    const query = current.searchParams.toString();
    await goto(`${current.pathname}${query ? `?${query}` : ''}${current.hash}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true
    });
  }

  async function handleGuidedTourClose() {
    showGuidedTour = false;
    try {
      await fetch('/admin?/complete_guided_tour', { method: 'POST', body: new FormData() });
    } catch {
      // Closing the guide should never block the dashboard.
    }
    await clearGuidedQuery();
  }

  function toChartPoints(values: number[], maxValue: number) {
    const xPad = 18;
    const yPad = 18;
    const usableW = chartWidth - xPad * 2;
    const usableH = chartHeight - yPad * 2;
    return values.map((value, index) => ({
      x: xPad + (usableW * index) / Math.max(values.length - 1, 1),
      y: yPad + usableH - (value / Math.max(maxValue, 1)) * usableH,
      value
    }));
  }

  function pathFromPoints(points: Array<{ x: number; y: number }>) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  }

  function formatDate(value: number | string) {
    const date = typeof value === 'number'
      ? new Date(value * 1000)
      : new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
    return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function availabilitySummary(entries: AvailabilityEntry[]) {
    const available = entries.filter((entry) => entry.isAvailable);
    if (available.length === 0) return 'Unavailable all week';
    return available
      .map((entry) => `${weekdayLabels[entry.weekday]} ${formatTime(entry.startTime)}-${formatTime(entry.endTime)}`)
      .join(' | ');
  }

  function taskAgeDays(createdAt: number) {
    return Math.max(0, Math.floor((Date.now() / 1000 - createdAt) / 86400));
  }

  function anomalyLabel(eventType: string) {
    if (eventType === 'high') return 'High';
    if (eventType === 'low') return 'Low';
    if (eventType === 'offline') return 'Offline';
    return 'No recent reading';
  }

  function temperaturePosition(value: number | null) {
    if (value === null || !Number.isFinite(value)) return 0;
    return Math.max(3, Math.min(100, ((value + 20) / 140) * 100));
  }

  $: staffingValues = data.analytics.staffingSeries.map((point) => point.staffed);
  $: staffingTargets = data.analytics.staffingSeries.map((point) => point.target);
  $: staffingMax = Math.max(...staffingValues, ...staffingTargets, 1);
  $: staffingPoints = toChartPoints(staffingValues, staffingMax);
  $: staffingTargetPoints = toChartPoints(staffingTargets, staffingMax);
  $: openTodos = data.todos.filter((todo) => !todo.completed_at).sort((a, b) => a.created_at - b.created_at);
  $: systemReminders = [
    data.summary.pendingUsers > 0 ? `${data.summary.pendingUsers} employee account approvals waiting.` : null,
    data.summary.schedulePending > 0 ? `${data.summary.schedulePending} schedule requests waiting.` : null,
    data.summary.pendingIdeas > 0 ? `${data.summary.pendingIdeas} whiteboard ideas waiting.` : null,
    data.summary.temperatureAnomalies > 0 ? `${data.summary.temperatureAnomalies} temperature exceptions need attention.` : null
  ].filter((entry): entry is string => Boolean(entry));
</script>

<Layout>
  <PageHeader title="Manager Dashboard" />

  {#if showGuidedTour}
    <GuidedSpotlightTour
      title="Manager First-Open Guide"
      steps={guidedSteps}
      on:finish={handleGuidedTourClose}
      on:dismiss={handleGuidedTourClose}
    />
  {/if}

  {#if adminMessage}
    <p class="feedback-banner">{adminMessage}</p>
  {/if}

  <section class="command-strip" data-guide="admin-command-center" aria-label="Operations command center">
    <div class="command-title">
      <span>Live</span>
      <h2>Ops Command Center</h2>
    </div>
    <div class="snapshot-grid">
      <div><span>Staffed Today</span><strong>{data.summary.staffedEmployees}</strong></div>
      <div><span>Schedule Requests</span><strong>{data.summary.schedulePending}</strong></div>
      <div><span>Open Tasks</span><strong>{data.summary.todoActive}</strong></div>
      <div><span>Temp Exceptions</span><strong>{data.summary.temperatureAnomalies}</strong></div>
      <div><span>Sensors Online</span><strong>{data.summary.nodesOperational}/{data.summary.nodesTracked}</strong></div>
    </div>
  </section>

  <section class="operations-grid">
    {#if data.featureAccess.temps}
      <article class="workspace-panel temperature-panel" data-guide="admin-temperature">
        <header class="section-head">
          <div>
            <span>Monitoring</span>
            <h2>Temperature Exceptions</h2>
          </div>
          <a href="/temper" class="word-link">View monitoring</a>
        </header>

        {#if data.temperatureAnomalies.length === 0}
          <div class="clear-state">
            <span class="material-icons" aria-hidden="true">check_circle</span>
            <p>No temperature exceptions.</p>
          </div>
        {:else}
          <div class="anomaly-list">
            {#each data.temperatureAnomalies as anomaly}
              <div class="anomaly-row anomaly-{anomaly.eventType}">
                <div>
                  <strong>{anomaly.name}</strong>
                  <small>{anomalyLabel(anomaly.eventType)}</small>
                </div>
                <div class="anomaly-meter" aria-hidden="true">
                  <i style={`width:${temperaturePosition(anomaly.temperature)}%`}></i>
                </div>
                <span>{anomaly.temperature === null ? '--' : `${anomaly.temperature.toFixed(1)}F`}</span>
              </div>
            {/each}
          </div>
        {/if}
      </article>
    {/if}

    <article class="workspace-panel schedule-panel" data-guide="admin-schedule">
      <header class="section-head schedule-head">
        <div>
          <span>Workforce</span>
          <h2>Schedule & People</h2>
        </div>
        {#if data.featureAccess.scheduling}
          <nav class="window-switch" aria-label="Schedule chart window">
            {#each windowOptions as option}
              <a href={`/admin?window=${option.value}`} class:active={data.analytics.windowDays === option.value}>{option.label}</a>
            {/each}
          </nav>
        {/if}
      </header>

      {#if data.featureAccess.scheduling}
        <div class="schedule-chart">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Scheduled staff coverage">
            <path class="chart-target" d={pathFromPoints(staffingTargetPoints)} />
            <path class="chart-line" d={pathFromPoints(staffingPoints)} />
            {#each staffingPoints as point, index}
              <circle cx={point.x} cy={point.y} r="3.2">
                <title>{data.analytics.staffingSeries[index].label}: {point.value} scheduled</title>
              </circle>
            {/each}
          </svg>
          <div class="chart-labels">
            {#each data.analytics.staffingSeries as point}<span>{point.label}</span>{/each}
          </div>
        </div>

        <div class="schedule-links">
          <a href="/admin/schedule-settings">Schedule Settings</a>
          <a href="/admin/schedule">Schedule Builder</a>
        </div>

        <div class="request-grid">
          <section>
            <h3>Time Off <span>{data.schedule.pendingTimeOff.length}</span></h3>
            {#if data.schedule.pendingTimeOff.length === 0}
              <p class="empty-line">No pending requests.</p>
            {:else}
              {#each data.schedule.pendingTimeOff.slice(0, 5) as request}
                <div class="request-row">
                  <div>
                    <strong>{request.userName ?? request.userEmail}</strong>
                    <small>{formatDate(request.startDate)}{request.endDate !== request.startDate ? ` - ${formatDate(request.endDate)}` : ''}</small>
                    {#if request.note}<small>{request.note}</small>{/if}
                  </div>
                  <div class="inline-actions">
                    <form method="POST" action="?/approve_time_off" use:enhance={withAdminFeedback}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button type="submit">Approve</button>
                    </form>
                    <form method="POST" action="?/decline_time_off" use:enhance={withAdminFeedback}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button type="submit" class="danger-text">Decline</button>
                    </form>
                  </div>
                </div>
              {/each}
            {/if}
          </section>

          <section>
            <h3>Availability <span>{data.schedule.pendingAvailability.length}</span></h3>
            {#if data.schedule.pendingAvailability.length === 0}
              <p class="empty-line">No pending changes.</p>
            {:else}
              {#each data.schedule.pendingAvailability.slice(0, 5) as request}
                <div class="request-row">
                  <div>
                    <strong>{request.userName ?? request.userEmail}</strong>
                    <small>{availabilitySummary(request.availability)}</small>
                  </div>
                  <div class="inline-actions">
                    <form method="POST" action="?/approve_availability" use:enhance={withAdminFeedback}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button type="submit">Approve</button>
                    </form>
                    <form method="POST" action="?/decline_availability" use:enhance={withAdminFeedback}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <button type="submit" class="danger-text">Decline</button>
                    </form>
                  </div>
                </div>
              {/each}
            {/if}
          </section>
        </div>
      {/if}

      <nav class="people-links" aria-label="Employee management">
        <a href="/admin/users" data-guide="admin-staff-manager">
          <span class="material-icons" aria-hidden="true">groups</span>
          <span><strong>People</strong><small>Staff and permissions</small></span>
        </a>
        <a href="/admin/onboarding#employee-packets" data-guide="admin-onboarding">
          <span class="material-icons" aria-hidden="true">assignment_ind</span>
          <span><strong>Onboarding</strong><small>Employee progress</small></span>
        </a>
        <a href="/admin/onboarding#packet-builder">
          <span class="material-icons" aria-hidden="true">description</span>
          <span><strong>Packet Builder</strong><small>Forms and policies</small></span>
        </a>
      </nav>
    </article>
  </section>

  <section class="communications-grid">
    {#if data.featureAccess.announcements}
      <article class="workspace-panel announcement-preview">
        <header class="section-head">
          <div><span>Live Update</span><h2>Announcement</h2></div>
          <a href="#announcement-manager" class="word-link">Manage</a>
        </header>
        <p class:empty-copy={!data.announcement.content}>{data.announcement.content || 'No announcement posted.'}</p>
        {#if data.announcement.updatedAt}<small>Updated {formatDate(data.announcement.updatedAt)}</small>{/if}
      </article>
    {/if}

    <aside class="workspace-panel reminders-panel" data-guide="admin-reminders">
      <header class="section-head">
        <div><span>Notes</span><h2>Reminders</h2></div>
        <strong>{data.savedReminders.length}</strong>
      </header>
      <form method="POST" action="?/create_reminder" use:enhance={withAdminResetFeedback} class="line-form">
        <input name="content" placeholder="Add reminder" aria-label="Reminder" required />
        <button type="submit">Add</button>
      </form>
      <div class="reminder-list">
        {#each data.savedReminders as reminder}
          <div class="editable-line">
            <form method="POST" action="?/update_reminder" use:enhance={withAdminFeedback}>
              <input type="hidden" name="id" value={reminder.id} />
              <input name="content" value={reminder.content} aria-label="Reminder text" required />
              <button type="submit">Save</button>
            </form>
            <form method="POST" action="?/delete_reminder" use:enhance={withAdminFeedback}>
              <input type="hidden" name="id" value={reminder.id} />
              <button type="submit" class="danger-text">Delete</button>
            </form>
          </div>
        {/each}
        {#if data.savedReminders.length === 0 && systemReminders.length === 0}<p class="empty-line">Clear.</p>{/if}
        {#each systemReminders as reminder}<p class="system-reminder">{reminder}</p>{/each}
      </div>
    </aside>
  </section>

  {#if data.featureAccess.whiteboard}
    <section class="workspace-panel whiteboard-manager" data-guide="admin-whiteboard">
      <header class="section-head">
        <div><span>Ideas</span><h2>Whiteboard Manager</h2></div>
        <strong>{data.whiteboardIdeas.length}</strong>
      </header>
      {#if data.whiteboardIdeas.length === 0}
        <p class="empty-line">No ideas submitted.</p>
      {:else}
        <div class="idea-list">
          {#each data.whiteboardIdeas as idea}
            <article class="idea-row">
              <div>
                <p>{idea.content}</p>
                <small>{idea.submitted_name ?? idea.submitted_email ?? 'Unknown'} | {idea.votes} {idea.votes === 1 ? 'vote' : 'votes'} | {idea.status}</small>
              </div>
              <div class="inline-actions">
                <form method="POST" action="?/approve_whiteboard" use:enhance={withAdminFeedback}>
                  <input type="hidden" name="id" value={idea.id} />
                  <button type="submit" class:active-action={idea.status === 'approved'}>Approve</button>
                </form>
                <form method="POST" action="?/reject_whiteboard" use:enhance={withAdminFeedback}>
                  <input type="hidden" name="id" value={idea.id} />
                  <button type="submit" class:active-action={idea.status === 'rejected'}>Reject</button>
                </form>
                <form method="POST" action="?/delete_whiteboard" use:enhance={withAdminFeedback}>
                  <input type="hidden" name="id" value={idea.id} />
                  <button type="submit" class="danger-text">Remove</button>
                </form>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if data.featureAccess.todo}
    <section class="todo-grid" data-guide="admin-todos">
      <article class="workspace-panel todo-assignment">
        <header class="section-head"><div><span>Assign</span><h2>New ToDo</h2></div></header>
        <form method="POST" action="?/create_todo" use:enhance={withAdminResetFeedback} class="todo-form">
          <label><span>Task</span><input name="title" required /></label>
          <label><span>Description</span><textarea name="description" rows="3"></textarea></label>
          <label>
            <span>Assigned To</span>
            <select name="assigned_to">
              <option value="">Anyone</option>
              {#each data.users as user}<option value={user.id}>{user.display_name ?? user.email}</option>{/each}
            </select>
          </label>
          <button type="submit">Assign Task</button>
        </form>
      </article>

      <article class="workspace-panel open-tasks">
        <header class="section-head"><div><span>Current</span><h2>Open Tasks</h2></div><strong>{openTodos.length}</strong></header>
        {#if openTodos.length === 0}
          <p class="empty-line">No open tasks.</p>
        {:else}
          <div class="task-list">
            {#each openTodos as todo}
              <article class:overdue={taskAgeDays(todo.created_at) > 3} class="task-row">
                <div>
                  <strong>{todo.title}</strong>
                  {#if todo.description}<small>{todo.description}</small>{/if}
                  <small>{todo.assigned_name ?? todo.assigned_email ?? 'Anyone'} | {taskAgeDays(todo.created_at)}d open</small>
                </div>
                <form method="POST" action="?/delete_todo" use:enhance={withAdminFeedback}>
                  <input type="hidden" name="id" value={todo.id} />
                  <button type="submit" class="danger-text">Delete</button>
                </form>
              </article>
            {/each}
          </div>
        {/if}
      </article>
    </section>
  {/if}

  {#if data.featureAccess.announcements}
    <section class="workspace-panel announcement-manager" id="announcement-manager" data-guide="admin-announcements">
      <header class="section-head">
        <div><span>Homepage</span><h2>Announcement Manager</h2></div>
        <small>History retains nine months</small>
      </header>
      <div class="announcement-workspace">
        <form method="POST" action="?/save_announcement" use:enhance={withAdminFeedback} class="announcement-form">
          <label>
            <span>Current Announcement</span>
            <textarea name="content" rows="6" placeholder="Write an update for the team...">{data.announcement.content}</textarea>
          </label>
          <button type="submit">Publish Announcement</button>
        </form>
        <div class="history-list">
          <h3>History</h3>
          {#if data.announcementHistory.length === 0}
            <p class="empty-line">No saved announcements yet.</p>
          {:else}
            {#each data.announcementHistory as entry}
              <article>
                <div><p>{entry.content}</p><small>{entry.createdByName ?? entry.createdByEmail ?? 'Manager'} | {formatDate(entry.createdAt)}</small></div>
                <form method="POST" action="?/delete_announcement_history" use:enhance={withAdminFeedback}>
                  <input type="hidden" name="history_id" value={entry.id} />
                  <button type="submit" class="danger-text">Delete</button>
                </form>
              </article>
            {/each}
          {/if}
        </div>
      </div>

      {#if data.featureAccess.employee_spotlight}
        <details class="spotlight-editor">
          <summary>Employee Spotlight <span>{data.employeeSpotlight.employeeName || 'Not set'}</span></summary>
          <form method="POST" action="?/save_employee_spotlight" use:enhance={withAdminFeedback}>
            <input name="employee_name" placeholder="Employee name" value={data.employeeSpotlight.employeeName} />
            <textarea name="shoutout" rows="3" placeholder="Add the homepage spotlight...">{data.employeeSpotlight.shoutout}</textarea>
            <button type="submit">Save Spotlight</button>
          </form>
        </details>
      {/if}
    </section>
  {/if}

  <nav class="workspace-links" data-guide="admin-workspaces" aria-label="Manager workspaces">
    <a href="/admin/app-editor#business-registry">
      <span class="material-icons" aria-hidden="true">storefront</span>
      <span><small>Ownership</small><strong>Business Registry</strong></span>
    </a>
    <a href="/admin/app-editor">
      <span class="material-icons" aria-hidden="true">tune</span>
      <span><small>App Editor</small><strong>Feature Matrix</strong></span>
    </a>
    <a href="/admin/creator" data-guide="admin-creator">
      <span class="material-icons" aria-hidden="true">construction</span>
      <span><small>Builder</small><strong>Creator Studio</strong></span>
    </a>
  </nav>
</Layout>

<style>
  :global(.main-content:has(.command-strip)) {
    max-width: 1180px;
  }

  .feedback-banner {
    margin: 0 0 0.8rem;
    padding: 0.65rem 0;
    border-top: 1px solid color-mix(in srgb, var(--color-success) 38%, var(--color-divider));
    border-bottom: 1px solid color-mix(in srgb, var(--color-success) 38%, var(--color-divider));
    color: var(--color-text);
    font-size: 0.82rem;
  }

  .command-strip,
  .workspace-panel,
  .workspace-links {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .command-strip {
    display: grid;
    grid-template-columns: minmax(180px, 0.65fr) minmax(0, 2.35fr);
    align-items: stretch;
    margin-bottom: 0.85rem;
  }

  .command-title {
    padding: 0.85rem 1rem 0.85rem 0;
    display: grid;
    align-content: center;
    border-right: 1px solid var(--color-divider);
  }

  .command-title span,
  .section-head > div > span,
  .todo-form label > span,
  .announcement-form label > span {
    color: var(--color-text-muted);
    font-size: 0.66rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .command-title h2,
  .section-head h2 {
    margin: 0.14rem 0 0;
    font-size: 1rem;
    letter-spacing: -0.015em;
  }

  .snapshot-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .snapshot-grid div {
    padding: 0.72rem 0.8rem;
    display: grid;
    gap: 0.16rem;
    border-right: 1px solid var(--color-divider);
  }

  .snapshot-grid div:last-child { border-right: 0; }
  .snapshot-grid span { color: var(--color-text-muted); font-size: 0.68rem; }
  .snapshot-grid strong { font-size: 1.15rem; font-weight: var(--weight-semibold); }

  .operations-grid,
  .communications-grid,
  .todo-grid {
    display: grid;
    gap: 0.8rem;
    margin-bottom: 0.8rem;
  }

  .operations-grid { grid-template-columns: minmax(260px, 0.75fr) minmax(0, 1.55fr); }
  .communications-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .todo-grid { grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.28fr); }
  .workspace-panel { padding: 0.9rem 0; min-width: 0; }

  .section-head {
    min-height: 2.2rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.72rem;
  }

  .section-head > strong,
  .section-head > small {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    font-weight: var(--weight-medium);
  }

  .word-link,
  .schedule-links a,
  button {
    width: auto;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.24rem 0.08rem;
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: var(--weight-medium);
    cursor: pointer;
  }

  .word-link:hover,
  .schedule-links a:hover,
  button:hover,
  button:focus-visible { border-bottom-color: var(--color-text); }
  .danger-text { color: color-mix(in srgb, var(--color-error) 78%, var(--color-text)); }
  .active-action { font-weight: var(--weight-bold); border-bottom-color: var(--color-text); }

  input,
  textarea,
  select {
    width: 100%;
    min-width: 0;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.5rem 0.12rem;
    font: inherit;
    font-size: 0.82rem;
  }

  input:focus,
  textarea:focus,
  select:focus { outline: none; border-bottom-color: var(--color-text); }
  textarea { resize: vertical; }

  .clear-state {
    min-height: 180px;
    display: grid;
    place-content: center;
    justify-items: center;
    color: var(--color-text-muted);
  }

  .clear-state .material-icons { color: var(--color-success); font-size: 1.6rem; }
  .clear-state p { margin: 0.35rem 0 0; font-size: 0.8rem; }
  .anomaly-list { display: grid; }

  .anomaly-row {
    display: grid;
    grid-template-columns: minmax(110px, 0.85fr) minmax(70px, 1fr) auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.65rem 0.55rem;
    border-bottom: 1px solid var(--color-divider);
    border-left: 3px solid var(--color-error);
  }

  .anomaly-row:last-child { border-bottom: 0; }
  .anomaly-low { border-left-color: #3b82f6; }
  .anomaly-stale { border-left-color: #d69b31; }
  .anomaly-row div { display: grid; gap: 0.12rem; }
  .anomaly-row strong { font-size: 0.82rem; }
  .anomaly-row small { color: var(--color-text-muted); font-size: 0.7rem; }
  .anomaly-row > span { font-size: 1rem; font-weight: var(--weight-semibold); }
  .anomaly-meter { height: 3px; background: var(--color-divider); overflow: hidden; }
  .anomaly-meter i { display: block; height: 100%; background: currentColor; }

  .schedule-head { align-items: center; }
  .window-switch { display: flex; gap: 0.6rem; }
  .window-switch a { color: var(--color-text-muted); text-decoration: none; font-size: 0.7rem; padding-bottom: 0.15rem; }
  .window-switch a.active { color: var(--color-text); border-bottom: 1px solid var(--color-text); font-weight: var(--weight-bold); }
  .schedule-chart svg { display: block; width: 100%; height: 118px; overflow: visible; }
  .chart-line { fill: none; stroke: var(--color-text); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .chart-target { fill: none; stroke: var(--color-text-muted); stroke-width: 1.5; stroke-dasharray: 5 5; }
  .schedule-chart circle { fill: var(--color-surface); stroke: var(--color-text); stroke-width: 1.6; }
  .chart-labels { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); color: var(--color-text-muted); font-size: 0.62rem; }
  .schedule-links { display: flex; gap: 1.1rem; justify-content: flex-end; margin: 0.45rem 0 0.8rem; }

  .request-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--color-divider); }
  .request-grid > section { min-width: 0; padding-top: 0.65rem; }
  .request-grid > section:first-child { padding-right: 0.75rem; border-right: 1px solid var(--color-divider); }
  .request-grid > section:last-child { padding-left: 0.75rem; }
  .request-grid h3 { margin: 0 0 0.35rem; font-size: 0.78rem; }
  .request-grid h3 span { color: var(--color-text-muted); margin-left: 0.25rem; }
  .request-row { padding: 0.5rem 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; border-bottom: 1px solid var(--color-divider); }
  .request-row > div:first-child { min-width: 0; display: grid; gap: 0.12rem; }
  .request-row strong { font-size: 0.76rem; }
  .request-row small { color: var(--color-text-muted); font-size: 0.67rem; line-height: 1.35; overflow-wrap: anywhere; }
  .inline-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

  .people-links {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin-top: 0.8rem;
    border-top: 1px solid var(--color-divider);
  }

  .people-links a {
    min-width: 0;
    padding: 0.68rem 0.6rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: inherit;
    text-decoration: none;
    border-right: 1px solid var(--color-divider);
  }

  .people-links a:last-child { border-right: 0; }
  .people-links a:hover { background: color-mix(in srgb, var(--color-surface-alt) 45%, transparent); }
  .people-links .material-icons { color: var(--color-text-muted); font-size: 1.15rem; }
  .people-links a > span:last-child { min-width: 0; display: grid; gap: 0.08rem; }
  .people-links strong { font-size: 0.76rem; }
  .people-links small { color: var(--color-text-muted); font-size: 0.64rem; }

  .announcement-preview > p { margin: 0; min-height: 4rem; line-height: 1.55; font-size: 0.88rem; white-space: pre-wrap; }
  .announcement-preview > small { color: var(--color-text-muted); font-size: 0.68rem; }
  .empty-copy { color: var(--color-text-muted); }
  .line-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.55rem; align-items: end; }
  .reminder-list { display: grid; margin-top: 0.5rem; }
  .editable-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.45rem; border-bottom: 1px solid var(--color-divider); }
  .editable-line > form:first-child { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.45rem; align-items: end; }
  .editable-line > form:last-child { display: flex; align-items: end; }
  .system-reminder,
  .empty-line { margin: 0; padding: 0.48rem 0; color: var(--color-text-muted); font-size: 0.75rem; border-bottom: 1px solid var(--color-divider); }

  .whiteboard-manager,
  .announcement-manager { margin-bottom: 0.8rem; }
  .idea-list { display: grid; }
  .idea-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1rem; align-items: center; padding: 0.65rem 0; border-bottom: 1px solid var(--color-divider); }
  .idea-row:last-child { border-bottom: 0; }
  .idea-row p { margin: 0 0 0.2rem; line-height: 1.45; }
  .idea-row small { color: var(--color-text-muted); font-size: 0.68rem; text-transform: capitalize; }

  .todo-form { display: grid; gap: 0.55rem; }
  .todo-form label { display: grid; gap: 0.12rem; }
  .todo-form > button { justify-self: start; margin-top: 0.2rem; }
  .task-list { display: grid; }
  .task-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.75rem; padding: 0.6rem 0 0.6rem 0.55rem; border-bottom: 1px solid var(--color-divider); border-left: 2px solid transparent; }
  .task-row.overdue { border-left-color: var(--color-error); background: color-mix(in srgb, var(--color-error) 5%, transparent); }
  .task-row > div { display: grid; gap: 0.14rem; }
  .task-row strong { font-size: 0.82rem; }
  .task-row small { color: var(--color-text-muted); font-size: 0.69rem; }

  .announcement-workspace { display: grid; grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr); gap: 1rem; }
  .announcement-form { display: grid; align-content: start; gap: 0.6rem; }
  .announcement-form label { display: grid; gap: 0.2rem; }
  .announcement-form button { justify-self: start; }
  .history-list { min-width: 0; border-left: 1px solid var(--color-divider); padding-left: 1rem; }
  .history-list h3 { margin: 0 0 0.35rem; font-size: 0.8rem; }
  .history-list article { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.7rem; padding: 0.55rem 0; border-bottom: 1px solid var(--color-divider); }
  .history-list p { margin: 0 0 0.15rem; font-size: 0.78rem; line-height: 1.45; white-space: pre-wrap; }
  .history-list small { color: var(--color-text-muted); font-size: 0.66rem; }
  .spotlight-editor { margin-top: 0.9rem; border-top: 1px solid var(--color-divider); }
  .spotlight-editor summary { padding: 0.65rem 0; display: flex; justify-content: space-between; gap: 0.7rem; cursor: pointer; font-size: 0.8rem; }
  .spotlight-editor summary span { color: var(--color-text-muted); }
  .spotlight-editor form { display: grid; grid-template-columns: minmax(180px, 0.5fr) minmax(0, 1fr) auto; gap: 0.65rem; align-items: end; padding-bottom: 0.65rem; }

  .workspace-links { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 0.5rem; }
  .workspace-links a { min-width: 0; padding: 0.8rem; display: flex; align-items: center; gap: 0.65rem; color: inherit; text-decoration: none; border-right: 1px solid var(--color-divider); }
  .workspace-links a:last-child { border-right: 0; }
  .workspace-links a:hover { background: color-mix(in srgb, var(--color-surface-alt) 45%, transparent); }
  .workspace-links .material-icons { color: var(--color-text-muted); }
  .workspace-links a > span:last-child { display: grid; gap: 0.1rem; }
  .workspace-links small { color: var(--color-text-muted); font-size: 0.66rem; }
  .workspace-links strong { font-size: 0.84rem; }

  @media (max-width: 980px) {
    .command-strip { grid-template-columns: 1fr; }
    .command-title { border-right: 0; border-bottom: 1px solid var(--color-divider); }
    .snapshot-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .operations-grid,
    .communications-grid,
    .todo-grid { grid-template-columns: 1fr; }
    .announcement-workspace { grid-template-columns: 1fr; }
    .history-list { border-left: 0; border-top: 1px solid var(--color-divider); padding: 0.8rem 0 0; }
  }

  @media (max-width: 700px) {
    .snapshot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .request-grid { grid-template-columns: 1fr; }
    .request-grid > section:first-child { padding-right: 0; border-right: 0; }
    .request-grid > section:last-child { padding-left: 0; border-top: 1px solid var(--color-divider); margin-top: 0.55rem; }
    .people-links,
    .workspace-links { grid-template-columns: 1fr; }
    .people-links a,
    .workspace-links a { border-right: 0; border-bottom: 1px solid var(--color-divider); }
    .people-links a:last-child,
    .workspace-links a:last-child { border-bottom: 0; }
    .idea-row,
    .task-row,
    .request-row,
    .anomaly-row { grid-template-columns: 1fr; }
    .inline-actions { justify-content: flex-start; }
    .spotlight-editor form { grid-template-columns: 1fr; }
  }

  @media (max-width: 480px) {
    .snapshot-grid { grid-template-columns: 1fr; }
    .snapshot-grid div { border-right: 0; border-bottom: 1px solid var(--color-divider); }
    .snapshot-grid div:last-child { border-bottom: 0; }
    .schedule-head { align-items: flex-start; flex-direction: column; }
    .line-form,
    .editable-line,
    .editable-line > form:first-child { grid-template-columns: 1fr; }
    .history-list article { grid-template-columns: 1fr; }
  }
</style>

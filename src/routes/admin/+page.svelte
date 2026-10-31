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
    workspaceAccess: {
      vendors: boolean;
      reports: boolean;
    };
    analytics: {
      windowDays: number;
      staffingSeries: Array<{ day: string; label: string; staffed: number; target: number }>;
    };
    temperatureAnomalies: Array<{
      sensorId: number;
      name: string;
      eventType: 'high' | 'low' | 'offline';
      temperature: number | null;
      threshold: number | null;
      lastSeenAt: number | null;
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

  function taskAgeDays(createdAt: number) {
    return Math.max(0, Math.floor((Date.now() / 1000 - createdAt) / 86400));
  }

  function anomalyLabel(eventType: string) {
    if (eventType === 'high') return 'High';
    if (eventType === 'low') return 'Low';
    return 'Offline';
  }

  function anomalyLastSeen(value: number | null) {
    if (!value) return 'No check-in yet';
    return `Last check-in ${new Date(value * 1000).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
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

  <div class="admin-console">
    <section class="command-strip" data-guide="admin-command-center" aria-label="Operations command center">
      <div class="command-title">
        <span class="live-mark" aria-hidden="true"></span>
        <div><span>Live operations</span><h2>Ops Command Center</h2></div>
      </div>
      <div class="snapshot-grid">
        <div><span>Staffed Today</span><strong>{data.summary.staffedEmployees}</strong></div>
        <div><span>Schedule Requests</span><strong>{data.summary.schedulePending}</strong></div>
        <div><span>Open Tasks</span><strong>{data.summary.todoActive}</strong></div>
        <div><span>Temp Exceptions</span><strong>{data.summary.temperatureAnomalies}</strong></div>
        <div><span>Sensors Online</span><strong>{data.summary.nodesOperational}<small> / {data.summary.nodesTracked}</small></strong></div>
      </div>
    </section>

    <section class:single-panel={!data.featureAccess.temps} class="operations-grid">
      {#if data.featureAccess.temps}
        <article class="saas-panel temperature-panel" data-guide="admin-temperature">
          <header class="panel-heading">
            <div class="heading-copy">
              <span class="eyebrow">Temperature</span>
              <h2>Exceptions</h2>
              <p>Nodes requiring attention.</p>
            </div>
            <a href="/temper" class="text-action">Open monitoring</a>
          </header>

          {#if data.temperatureAnomalies.length === 0}
            <div class="calm-state">
              <span class="material-icons" aria-hidden="true">check_circle</span>
              <div><strong>All clear</strong><small>No temperature exceptions.</small></div>
            </div>
          {:else}
            <div class="anomaly-plot">
              {#each data.temperatureAnomalies as anomaly}
                <div class="sensor-signal signal-{anomaly.eventType}">
                  <div class="sensor-copy">
                    <strong>{anomaly.name}</strong>
                    <small>{anomalyLabel(anomaly.eventType)}</small>
                    {#if anomaly.eventType === 'offline'}<small>{anomalyLastSeen(anomaly.lastSeenAt)}</small>{/if}
                  </div>
                  <div class="signal-rail" aria-hidden="true">
                    <i style={`width:${temperaturePosition(anomaly.temperature)}%`}></i>
                  </div>
                  <span class="sensor-reading">{anomaly.temperature === null ? '--' : `${anomaly.temperature.toFixed(1)}F`}</span>
                </div>
              {/each}
            </div>
          {/if}
        </article>
      {/if}

      <article class="saas-panel schedule-panel" data-guide="admin-schedule">
        <header class="panel-heading schedule-head">
          <div class="heading-copy">
            <span class="eyebrow">Workforce</span>
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

          <nav class="schedule-actions" aria-label="Scheduling workspaces">
            <a href="/admin/schedule" class="module-button"><span class="material-icons" aria-hidden="true">calendar_month</span>Schedule Builder</a>
            <a href="/admin/schedule?tool=approvals" class="module-button secondary"><span class="material-icons" aria-hidden="true">task_alt</span>Requests ({data.summary.schedulePending})</a>
            <a href="/admin/schedule?tool=setup" class="module-button secondary"><span class="material-icons" aria-hidden="true">settings</span>Schedule Setup</a>
          </nav>
        {/if}

        <nav class="people-links" aria-label="Employee management">
          <a href="/admin/users" data-guide="admin-staff-manager">
            <span class="material-icons" aria-hidden="true">groups</span>
            <span><strong>People</strong><small>Staff and permissions</small></span>
            <span class="material-icons arrow" aria-hidden="true">arrow_forward</span>
          </a>
          <a href="/admin/onboarding?view=packets" data-guide="admin-onboarding">
            <span class="material-icons" aria-hidden="true">assignment_ind</span>
            <span><strong>Onboarding</strong><small>Employee progress</small></span>
            <span class="material-icons arrow" aria-hidden="true">arrow_forward</span>
          </a>
          <a href="/admin/onboarding?view=forms">
            <span class="material-icons" aria-hidden="true">description</span>
            <span><strong>Packet Builder</strong><small>Forms and policies</small></span>
            <span class="material-icons arrow" aria-hidden="true">arrow_forward</span>
          </a>
        </nav>
      </article>
    </section>

    <section class:single-panel={!data.featureAccess.announcements} class="communications-grid">
      {#if data.featureAccess.announcements}
        <article class="saas-panel announcement-preview">
          <header class="panel-heading">
            <div class="heading-copy"><span class="eyebrow">Live Update</span><h2>Announcement</h2></div>
            <a href="#announcement-manager" class="text-action">Manage</a>
          </header>
          <div class="announcement-copy" class:empty-copy={!data.announcement.content}>
            <span class="material-icons" aria-hidden="true">campaign</span>
            <p>{data.announcement.content || 'No announcement posted.'}</p>
          </div>
          {#if data.announcement.updatedAt}<small class="updated-label">Updated {formatDate(data.announcement.updatedAt)}</small>{/if}
        </article>
      {/if}

      <aside class="saas-panel reminders-panel" data-guide="admin-reminders">
        <header class="panel-heading">
          <div class="heading-copy"><span class="eyebrow">Manager Notes</span><h2>Reminders</h2></div>
          <span class="count-badge">{data.savedReminders.length + systemReminders.length}</span>
        </header>
        <div class="reminder-preview">
          {#each systemReminders.slice(0, 2) as reminder}
            <p class="system-reminder"><span class="material-icons" aria-hidden="true">priority_high</span>{reminder}</p>
          {/each}
          {#each data.savedReminders.slice(0, 3) as reminder}
            <p><span class="material-icons" aria-hidden="true">check_circle</span>{reminder.content}</p>
          {/each}
          {#if data.savedReminders.length === 0 && systemReminders.length === 0}
            <p class="compact-empty">Nothing needs attention.</p>
          {/if}
        </div>
        <details class="management-drawer">
          <summary>Manage reminders <span class="material-icons chevron" aria-hidden="true">expand_more</span></summary>
          <div class="drawer-content">
            <form method="POST" action="?/create_reminder" use:enhance={withAdminResetFeedback} class="line-form">
              <input name="content" placeholder="Add reminder" aria-label="Reminder" required />
              <button type="submit" class="compact-action">Add</button>
            </form>
            <div class="reminder-editor-list">
              {#each data.savedReminders as reminder}
                <div class="editable-line">
                  <form method="POST" action="?/update_reminder" use:enhance={withAdminFeedback}>
                    <input type="hidden" name="id" value={reminder.id} />
                    <input name="content" value={reminder.content} aria-label="Reminder text" required />
                    <button type="submit" class="compact-action">Save</button>
                  </form>
                  <form method="POST" action="?/delete_reminder" use:enhance={withAdminFeedback}>
                    <input type="hidden" name="id" value={reminder.id} />
                    <button type="submit" class="compact-action danger-text">Delete</button>
                  </form>
                </div>
              {/each}
            </div>
          </div>
        </details>
      </aside>
    </section>

    {#if data.featureAccess.whiteboard}
      <section class="saas-panel manager-panel whiteboard-manager" data-guide="admin-whiteboard">
        <header class="panel-heading">
          <div class="heading-copy"><span class="eyebrow">Team Input</span><h2>Whiteboard Manager</h2></div>
          <span class="count-badge">{data.whiteboardIdeas.length}</span>
        </header>
        {#if data.whiteboardIdeas.length === 0}
          <p class="panel-empty">No ideas submitted.</p>
        {:else}
          <div class="idea-list">
            {#each data.whiteboardIdeas as idea}
              <article class="idea-row">
                <div class="idea-copy">
                  <p>{idea.content}</p>
                  <small><strong>{idea.submitted_name ?? idea.submitted_email ?? 'Unknown'}</strong><span>{idea.votes} {idea.votes === 1 ? 'vote' : 'votes'}</span><span class="status-label status-{idea.status}">{idea.status}</span></small>
                </div>
                <div class="inline-actions">
                  <form method="POST" action="?/approve_whiteboard" use:enhance={withAdminFeedback}>
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="compact-action" class:active-action={idea.status === 'approved'}>Approve</button>
                  </form>
                  <form method="POST" action="?/reject_whiteboard" use:enhance={withAdminFeedback}>
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="compact-action" class:active-action={idea.status === 'rejected'}>Reject</button>
                  </form>
                  <form method="POST" action="?/delete_whiteboard" use:enhance={withAdminFeedback}>
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="compact-action danger-text">Remove</button>
                  </form>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

    {#if data.featureAccess.todo}
      <section class="saas-panel todo-console" data-guide="admin-todos">
        <header class="panel-heading">
          <div class="heading-copy"><span class="eyebrow">Assignments</span><h2>ToDo Manager</h2></div>
          <span class="count-badge">{openTodos.length} open</span>
        </header>
        <div class="todo-grid">
          <div class="todo-assignment">
            <span class="material-icons assignment-icon" aria-hidden="true">add_task</span>
            <h3>Assign a task</h3>
            <p>Create work for an individual employee or the whole team.</p>
            <details class="management-drawer assignment-drawer">
              <summary>New assignment <span class="material-icons chevron" aria-hidden="true">expand_more</span></summary>
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
                <button type="submit" class="compact-action primary-action">Assign Task</button>
              </form>
            </details>
          </div>

          <div class="open-tasks">
            <div class="subsection-heading"><h3>Open Tasks</h3><small>Red indicates more than three days open.</small></div>
            {#if openTodos.length === 0}
              <p class="panel-empty">No open tasks.</p>
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
                      <button type="submit" class="compact-action danger-text">Delete</button>
                    </form>
                  </article>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </section>
    {/if}

    {#if data.featureAccess.announcements}
      <section class="saas-panel announcement-manager" id="announcement-manager" data-guide="admin-announcements">
        <header class="panel-heading">
          <div class="heading-copy"><span class="eyebrow">Homepage</span><h2>Announcement Manager</h2></div>
          <span class="count-badge">{data.announcementHistory.length} saved</span>
        </header>

        <div class="announcement-feature">
          <div class="current-announcement">
            <span>Current announcement</span>
            <p class:empty-copy={!data.announcement.content}>{data.announcement.content || 'No announcement posted.'}</p>
            {#if data.announcement.updatedAt}<small>Updated {formatDate(data.announcement.updatedAt)}</small>{/if}
          </div>
          <div class="announcement-tools">
            <details class="management-drawer">
              <summary>Edit announcement <span class="material-icons chevron" aria-hidden="true">expand_more</span></summary>
              <form method="POST" action="?/save_announcement" use:enhance={withAdminFeedback} class="announcement-form">
                <label>
                  <span>Announcement</span>
                  <textarea name="content" rows="5" placeholder="Write an update for the team...">{data.announcement.content}</textarea>
                </label>
                <button type="submit" class="compact-action primary-action">Publish Announcement</button>
              </form>
            </details>
            <details class="management-drawer">
              <summary>Announcement history <span class="material-icons chevron" aria-hidden="true">expand_more</span></summary>
              <div class="history-list">
                {#if data.announcementHistory.length === 0}
                  <p class="compact-empty">No saved announcements yet.</p>
                {:else}
                  {#each data.announcementHistory as entry}
                    <article>
                      <div><p>{entry.content}</p><small>{entry.createdByName ?? entry.createdByEmail ?? 'Manager'} | {formatDate(entry.createdAt)}</small></div>
                      <form method="POST" action="?/delete_announcement_history" use:enhance={withAdminFeedback}>
                        <input type="hidden" name="history_id" value={entry.id} />
                        <button type="submit" class="compact-action danger-text">Delete</button>
                      </form>
                    </article>
                  {/each}
                {/if}
              </div>
            </details>
            {#if data.featureAccess.employee_spotlight}
              <details class="management-drawer spotlight-editor">
                <summary>Employee Spotlight <span class="summary-value">{data.employeeSpotlight.employeeName || 'Not set'}</span><span class="material-icons chevron" aria-hidden="true">expand_more</span></summary>
                <form method="POST" action="?/save_employee_spotlight" use:enhance={withAdminFeedback}>
                  <input name="employee_name" placeholder="Employee name" value={data.employeeSpotlight.employeeName} />
                  <textarea name="shoutout" rows="3" placeholder="Add the homepage spotlight...">{data.employeeSpotlight.shoutout}</textarea>
                  <button type="submit" class="compact-action primary-action">Save Spotlight</button>
                </form>
              </details>
            {/if}
          </div>
        </div>
      </section>
    {/if}

    <section class="workspace-section" data-guide="admin-workspaces">
      <header class="workspace-heading"><span>Management</span><h2>Workspace Setup</h2></header>
      <nav class="workspace-links" aria-label="Manager workspaces">
        <a href="/admin/business-registry">
          <span class="workspace-icon material-icons" aria-hidden="true">storefront</span>
          <span class="workspace-copy"><small>Ownership</small><strong>Business Registry</strong><p>Business details and registration.</p></span>
          <span class="material-icons workspace-arrow" aria-hidden="true">north_east</span>
        </a>
        <a href="/admin/feature-matrix">
          <span class="workspace-icon material-icons" aria-hidden="true">tune</span>
          <span class="workspace-copy"><small>App Editor</small><strong>Feature Matrix</strong><p>Control which modules are available.</p></span>
          <span class="material-icons workspace-arrow" aria-hidden="true">north_east</span>
        </a>
        <a href="/admin/creator" data-guide="admin-creator">
          <span class="workspace-icon material-icons" aria-hidden="true">construction</span>
          <span class="workspace-copy"><small>Builder</small><strong>Creator Studio</strong><p>Build lists, recipes, documents, and menus.</p></span>
          <span class="material-icons workspace-arrow" aria-hidden="true">north_east</span>
        </a>
        {#if data.workspaceAccess.vendors}
          <a href="/admin/vendors">
            <span class="workspace-icon material-icons" aria-hidden="true">local_shipping</span>
            <span class="workspace-copy"><small>Operations</small><strong>Vendor Manager</strong><p>Add and maintain vendor contacts.</p></span>
            <span class="material-icons workspace-arrow" aria-hidden="true">north_east</span>
          </a>
        {/if}
        {#if data.workspaceAccess.reports}
          <a href="/reports">
            <span class="workspace-icon material-icons" aria-hidden="true">analytics</span>
            <span class="workspace-copy"><small>Exports</small><strong>Reports</strong><p>Open operational history and downloads.</p></span>
            <span class="material-icons workspace-arrow" aria-hidden="true">north_east</span>
          </a>
        {/if}
      </nav>
    </section>
  </div>
</Layout>

<style>
  :global(.main-content:has(.admin-console)) {
    max-width: 1240px;
  }

  .admin-console {
    display: grid;
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .feedback-banner {
    margin: 0 0 0.8rem;
    padding: 0.7rem 0;
    border-top: 1px solid color-mix(in srgb, var(--color-success) 38%, var(--color-divider));
    border-bottom: 1px solid color-mix(in srgb, var(--color-success) 38%, var(--color-divider));
    background: transparent;
    color: var(--color-text);
    font-size: 0.8rem;
  }

  .command-strip,
  .operations-grid,
  .communications-grid,
  .manager-panel,
  .todo-console,
  .announcement-manager,
  .workspace-links {
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .command-strip {
    display: grid;
    grid-template-columns: minmax(210px, 0.72fr) minmax(0, 2.28fr);
    align-items: stretch;
  }

  .command-title {
    padding: 0.9rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.72rem;
    border-right: 1px solid var(--color-divider);
  }

  .command-title > div,
  .heading-copy,
  .workspace-heading,
  .workspace-copy,
  .sensor-copy,
  .task-row > div {
    min-width: 0;
    display: grid;
    gap: 0.12rem;
  }

  .command-title span:not(.live-mark),
  .eyebrow,
  .workspace-heading > span,
  .workspace-copy > small,
  .todo-form label > span,
  .announcement-form label > span,
  .current-announcement > span {
    color: var(--color-text-muted);
    font-size: 0.64rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .live-mark {
    width: 0.5rem;
    height: 0.5rem;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--color-success);
  }

  .command-title h2,
  .panel-heading h2,
  .workspace-heading h2 {
    margin: 0;
    font-size: 1rem;
    letter-spacing: -0.025em;
  }

  .snapshot-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .snapshot-grid div {
    min-width: 0;
    padding: 0.75rem 0.8rem;
    display: grid;
    align-content: center;
    gap: 0.12rem;
    border-right: 1px solid var(--color-divider);
    background: transparent;
    transition: background 160ms var(--ease-out);
  }

  .snapshot-grid div:last-child {
    border-right: 0;
  }

  .snapshot-grid div:hover {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
  }

  .snapshot-grid span {
    color: var(--color-text-muted);
    font-size: 0.65rem;
    white-space: nowrap;
  }

  .snapshot-grid strong {
    font-size: 1.18rem;
    font-weight: var(--weight-semibold);
  }

  .snapshot-grid strong small {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: var(--weight-medium);
  }

  .operations-grid,
  .communications-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
  }

  .operations-grid {
    grid-template-columns: minmax(280px, 0.78fr) minmax(0, 1.52fr);
  }

  .operations-grid.single-panel,
  .communications-grid.single-panel {
    grid-template-columns: 1fr;
  }

  .saas-panel {
    min-width: 0;
    padding: 1rem;
    border: 0;
    border-right: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .operations-grid > .saas-panel:last-child,
  .communications-grid > .saas-panel:last-child,
  .single-panel > .saas-panel {
    border-right: 0;
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.85rem;
  }

  .heading-copy p {
    margin: 0.1rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    line-height: 1.4;
  }

  .text-action,
  .module-button,
  .compact-action {
    width: auto;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    padding: 0.25rem 0.05rem;
    font: inherit;
    font-size: 0.7rem;
    font-weight: var(--weight-semibold);
    line-height: 1.2;
    text-decoration: none;
    cursor: pointer;
  }

  .text-action:hover,
  .text-action:focus-visible,
  .module-button:hover,
  .module-button:focus-visible,
  .compact-action:hover,
  .compact-action:focus-visible {
    border-bottom-color: var(--color-text);
    outline: none;
  }

  .primary-action,
  .active-action {
    color: var(--color-text);
    font-weight: var(--weight-bold);
    border-bottom-color: var(--color-text);
  }

  .danger-text {
    color: color-mix(in srgb, var(--color-error) 80%, var(--color-text));
    border-bottom-color: color-mix(in srgb, var(--color-error) 42%, var(--color-divider));
  }

  .calm-state {
    min-height: 130px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.7rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .calm-state .material-icons {
    color: var(--color-success);
    font-size: 1.35rem;
  }

  .calm-state > div {
    display: grid;
    gap: 0.1rem;
  }

  .calm-state strong,
  .sensor-copy strong {
    font-size: 0.8rem;
  }

  .calm-state small,
  .sensor-copy small {
    color: var(--color-text-muted);
    font-size: 0.67rem;
  }

  .anomaly-plot,
  .idea-list,
  .task-list,
  .history-list,
  .reminder-editor-list {
    display: grid;
    gap: 0;
  }

  .sensor-signal {
    display: grid;
    grid-template-columns: minmax(100px, 0.82fr) minmax(75px, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem 0.15rem 0.65rem 0.65rem;
    border-bottom: 1px solid var(--color-divider);
    border-left: 3px solid var(--color-error);
    background: transparent;
  }

  .sensor-signal:last-child {
    border-bottom: 0;
  }

  .signal-low {
    border-left-color: #3b82f6;
  }

  .signal-stale,
  .signal-offline {
    border-left-color: #c98c21;
  }

  .sensor-copy strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .signal-rail {
    height: 3px;
    overflow: hidden;
    background: var(--color-divider);
  }

  .signal-rail i {
    display: block;
    height: 100%;
    background: currentColor;
  }

  .sensor-reading {
    font-size: 0.94rem;
    font-weight: var(--weight-semibold);
  }

  .schedule-head {
    align-items: center;
  }

  .window-switch {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .window-switch a {
    padding-bottom: 0.18rem;
    border-bottom: 1px solid transparent;
    color: var(--color-text-muted);
    font-size: 0.66rem;
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }

  .window-switch a.active {
    color: var(--color-text);
    border-bottom-color: var(--color-text);
    font-weight: var(--weight-bold);
  }

  .schedule-chart {
    padding: 0.3rem 0.15rem 0;
  }

  .schedule-chart svg {
    display: block;
    width: 100%;
    height: 112px;
    overflow: visible;
  }

  .chart-line {
    fill: none;
    stroke: var(--color-text);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chart-target {
    fill: none;
    stroke: var(--color-text-muted);
    stroke-width: 1.25;
    stroke-dasharray: 4 5;
  }

  .schedule-chart circle {
    fill: var(--color-surface);
    stroke: var(--color-text);
    stroke-width: 1.7;
  }

  .chart-labels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    color: var(--color-text-muted);
    font-size: 0.6rem;
    text-align: center;
  }

  .schedule-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin: 0.7rem 0;
  }

  .module-button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .module-button .material-icons {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .people-links {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin-top: 0.8rem;
    border-top: 1px solid var(--color-divider);
  }

  .people-links a {
    min-width: 0;
    min-height: 4rem;
    padding: 0.7rem 0.65rem;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    border-right: 1px solid var(--color-divider);
    color: inherit;
    text-decoration: none;
    transition: background 160ms var(--ease-out);
  }

  .people-links a:last-child {
    border-right: 0;
  }

  .people-links a:hover,
  .people-links a:focus-visible {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
    outline: none;
  }

  .people-links > a > .material-icons:first-child,
  .people-links .arrow {
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .people-links a > span:nth-child(2) {
    min-width: 0;
    display: grid;
    gap: 0.06rem;
  }

  .people-links strong {
    font-size: 0.74rem;
  }

  .people-links small {
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: 0.62rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .announcement-preview,
  .reminders-panel {
    display: flex;
    flex-direction: column;
  }

  .announcement-copy {
    flex: 1;
    min-height: 90px;
    padding: 0.8rem 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-content: start;
    gap: 0.65rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .announcement-copy .material-icons {
    color: var(--color-text-muted);
    font-size: 1.1rem;
  }

  .announcement-copy p {
    margin: 0;
    font-size: 0.84rem;
    line-height: 1.55;
    white-space: pre-wrap;
  }

  .updated-label {
    margin-top: 0.55rem;
    color: var(--color-text-muted);
    font-size: 0.64rem;
  }

  .empty-copy,
  .panel-empty,
  .compact-empty {
    color: var(--color-text-muted);
  }

  .reminder-preview {
    flex: 1;
    display: grid;
    align-content: start;
    gap: 0;
    border-top: 1px solid var(--color-divider);
  }

  .reminder-preview p {
    margin: 0;
    padding: 0.58rem 0;
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
    font-size: 0.73rem;
    line-height: 1.4;
  }

  .reminder-preview .material-icons {
    margin-top: 0.02rem;
    color: var(--color-text-muted);
    font-size: 0.88rem;
  }

  .reminder-preview .system-reminder .material-icons {
    color: #c98c21;
  }

  .management-drawer {
    min-width: 0;
    margin-top: 0.65rem;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
  }

  details > summary {
    list-style: none;
  }

  details > summary::-webkit-details-marker {
    display: none;
  }

  .management-drawer > summary {
    min-height: 2.65rem;
    padding: 0.55rem 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    color: var(--color-text);
    cursor: pointer;
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
  }

  .management-drawer[open] {
    background: transparent;
  }

  .count-badge {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: var(--weight-semibold);
  }

  .chevron {
    color: var(--color-text-muted);
    font-size: 1rem;
    transition: transform 160ms ease;
  }

  details[open] > summary .chevron {
    transform: rotate(180deg);
  }

  .drawer-content,
  .history-list {
    padding: 0 0 0.65rem;
  }

  .line-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: end;
  }

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
    font-size: 0.78rem;
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-bottom-color: var(--color-text);
  }

  textarea {
    resize: vertical;
  }

  .reminder-editor-list {
    margin-top: 0.5rem;
  }

  .editable-line {
    padding: 0.45rem 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.4rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .editable-line > form:first-child {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.4rem;
  }

  .editable-line > form:last-child,
  .inline-actions {
    display: flex;
    align-items: center;
  }

  .inline-actions {
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .manager-panel,
  .todo-console,
  .announcement-manager {
    padding: 1rem 0;
  }

  .panel-empty,
  .compact-empty {
    margin: 0;
    font-size: 0.72rem;
  }

  .panel-empty {
    min-height: 74px;
    display: grid;
    place-items: center;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .compact-empty {
    padding: 0.55rem 0;
  }

  .idea-row,
  .task-row,
  .history-list article {
    min-width: 0;
    padding: 0.68rem 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    border-bottom: 1px solid var(--color-divider);
    background: transparent;
  }

  .idea-row:last-child,
  .task-row:last-child,
  .history-list article:last-child {
    border-bottom: 0;
  }

  .idea-copy {
    min-width: 0;
  }

  .idea-copy p {
    margin: 0 0 0.28rem;
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .idea-copy small {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--color-text-muted);
    font-size: 0.63rem;
  }

  .idea-copy small strong {
    color: var(--color-text);
  }

  .status-label {
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .status-approved {
    color: color-mix(in srgb, var(--color-success) 80%, var(--color-text));
  }

  .status-rejected {
    color: color-mix(in srgb, var(--color-error) 80%, var(--color-text));
  }

  .todo-grid {
    display: grid;
    grid-template-columns: minmax(230px, 0.62fr) minmax(0, 1.38fr);
    gap: 0;
  }

  .todo-assignment {
    padding: 0 1rem 0 0;
    border-right: 1px solid var(--color-divider);
    background: transparent;
  }

  .assignment-icon {
    color: var(--color-text-muted);
    font-size: 1.25rem;
  }

  .todo-assignment h3,
  .subsection-heading h3 {
    margin: 0.4rem 0 0.15rem;
    font-size: 0.82rem;
  }

  .todo-assignment > p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    line-height: 1.45;
  }

  .assignment-drawer {
    margin-top: 0.8rem;
  }

  .todo-form,
  .announcement-form {
    display: grid;
    gap: 0.55rem;
    padding: 0 0 0.65rem;
  }

  .todo-form label,
  .announcement-form label {
    display: grid;
    gap: 0.2rem;
  }

  .todo-form > button,
  .announcement-form > button,
  .spotlight-editor form > button {
    justify-self: start;
  }

  .open-tasks {
    min-width: 0;
    padding-left: 1rem;
  }

  .subsection-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.7rem;
    margin-bottom: 0.5rem;
  }

  .subsection-heading h3 {
    margin: 0;
  }

  .subsection-heading small,
  .task-row small,
  .history-list small {
    color: var(--color-text-muted);
    font-size: 0.63rem;
    line-height: 1.35;
  }

  .task-list {
    max-height: 375px;
    overflow: auto;
  }

  .task-row {
    padding-left: 0.65rem;
    border-left: 3px solid transparent;
  }

  .task-row.overdue {
    border-left-color: var(--color-error);
    background: transparent;
  }

  .task-row strong {
    font-size: 0.75rem;
  }

  .announcement-feature {
    display: grid;
    grid-template-columns: minmax(280px, 0.9fr) minmax(0, 1.1fr);
    gap: 0;
    border-top: 1px solid var(--color-divider);
  }

  .current-announcement {
    min-height: 190px;
    padding: 1rem 1rem 1rem 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--color-divider);
    background: transparent;
  }

  .current-announcement p {
    flex: 1;
    margin: 1rem 0;
    font-size: clamp(0.92rem, 1.7vw, 1.15rem);
    line-height: 1.55;
    white-space: pre-wrap;
  }

  .current-announcement small {
    color: var(--color-text-muted);
    font-size: 0.64rem;
  }

  .announcement-tools {
    padding-left: 1rem;
    display: grid;
    align-content: start;
    gap: 0.55rem;
  }

  .announcement-tools .management-drawer {
    margin-top: 0;
  }

  .history-list {
    max-height: 320px;
    overflow: auto;
  }

  .history-list p {
    margin: 0 0 0.2rem;
    font-size: 0.72rem;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .spotlight-editor summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .summary-value {
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: 0.66rem;
    font-weight: var(--weight-medium);
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .spotlight-editor form {
    display: grid;
    grid-template-columns: minmax(160px, 0.5fr) minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: end;
    padding: 0 0 0.65rem;
  }

  .workspace-section {
    margin-top: 0.15rem;
  }

  .workspace-heading {
    margin-bottom: 0.65rem;
  }

  .workspace-links {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
  }

  .workspace-links a {
    min-width: 0;
    min-height: 118px;
    padding: 1rem;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
    border: 0;
    border-right: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: inherit;
    text-decoration: none;
    transition: background 160ms var(--ease-out);
  }

  .workspace-links a:nth-child(3n) {
    border-right: 0;
  }

  .workspace-links a:hover,
  .workspace-links a:focus-visible {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
    outline: none;
  }

  .workspace-icon {
    color: var(--color-text-muted);
    font-size: 1.2rem;
  }

  .workspace-copy {
    align-content: start;
    gap: 0.18rem;
  }

  .workspace-copy strong {
    font-size: 0.9rem;
  }

  .workspace-copy p {
    margin: 0.35rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.7rem;
    line-height: 1.45;
  }

  .workspace-arrow {
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  @media (max-width: 1040px) {
    .operations-grid {
      grid-template-columns: minmax(240px, 0.72fr) minmax(0, 1.28fr);
    }

    .snapshot-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .snapshot-grid div:nth-child(3) {
      border-right: 0;
    }

    .snapshot-grid div:nth-child(-n + 3) {
      border-bottom: 1px solid var(--color-divider);
    }

    .workspace-links {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .workspace-links a:nth-child(3n) {
      border-right: 1px solid var(--color-divider);
    }

    .workspace-links a:nth-child(even) {
      border-right: 0;
    }
  }

  @media (max-width: 880px) {
    .command-strip,
    .operations-grid,
    .communications-grid,
    .todo-grid,
    .announcement-feature {
      grid-template-columns: 1fr;
    }

    .command-title {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .operations-grid > .saas-panel,
    .communications-grid > .saas-panel {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .operations-grid > .saas-panel:last-child,
    .communications-grid > .saas-panel:last-child {
      border-bottom: 0;
    }

    .todo-assignment {
      padding: 0 0 1rem;
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .open-tasks {
      padding: 1rem 0 0;
    }

    .current-announcement {
      min-height: 140px;
      padding: 1rem 0;
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .announcement-tools {
      padding: 1rem 0 0;
    }
  }

  @media (max-width: 700px) {
    .admin-console {
      gap: 0.75rem;
    }

    .saas-panel {
      padding: 0.85rem 0;
    }

    .snapshot-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .snapshot-grid div,
    .snapshot-grid div:nth-child(3) {
      border-right: 1px solid var(--color-divider);
      border-bottom: 1px solid var(--color-divider);
    }

    .snapshot-grid div:nth-child(even) {
      border-right: 0;
    }

    .snapshot-grid div:last-child {
      grid-column: 1 / -1;
      border-right: 0;
      border-bottom: 0;
    }

    .people-links,
    .workspace-links {
      grid-template-columns: 1fr;
    }

    .people-links a,
    .workspace-links a,
    .workspace-links a:nth-child(3n),
    .workspace-links a:nth-child(even) {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .people-links a:last-child,
    .workspace-links a:last-child {
      border-bottom: 0;
    }

    .schedule-actions {
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .idea-row,
    .task-row,
    .history-list article {
      grid-template-columns: 1fr;
    }

    .inline-actions {
      justify-content: flex-start;
    }

    .spotlight-editor form {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 500px) {
    .panel-heading,
    .schedule-head,
    .subsection-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .window-switch {
      align-self: stretch;
      justify-content: space-between;
    }

    .schedule-actions {
      flex-direction: column;
      align-items: flex-start;
    }

    .sensor-signal,
    .editable-line,
    .editable-line > form:first-child {
      grid-template-columns: 1fr;
    }

    .sensor-signal {
      align-items: start;
    }

    .signal-rail {
      width: 100%;
    }
  }
</style>

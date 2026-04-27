<script lang="ts">
  import { goto } from '$app/navigation';
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import GuidedSpotlightTour from '$lib/components/ui/GuidedSpotlightTour.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { AppFeatureAccess, AppFeatureKey, AppFeatureMode, AppFeatureModes } from '$lib/features/appFeatures';

  type Todo = {
    id: string;
    title: string;
    description: string;
    completed_at: number | null;
    assigned_name?: string | null;
    assigned_email?: string | null;
  };

  type UserOption = {
    id: string;
    display_name: string | null;
    email: string;
  };

  type NodeName = {
    sensor_id: number;
    name: string;
  };

  type WhiteboardIdea = {
    id: string;
    content: string;
    votes: number;
    status: 'pending' | 'approved' | 'rejected';
    submitted_name?: string | null;
    submitted_email?: string | null;
  };

  type Announcement = {
    content: string;
    updatedAt: number;
  };

  type EmployeeSpotlight = {
    employeeName: string;
    shoutout: string;
    updatedAt: number;
  };

  type Tone = 'ok' | 'warn' | 'muted';
  type GuidedStep = {
    selector: string;
    title: string;
    description: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
  };

  export let data: {
    guided?: boolean;
    todos: Todo[];
    users: UserOption[];
    nodeNames: NodeName[];
    whiteboardIdeas: WhiteboardIdea[];
    announcement: Announcement;
    employeeSpotlight: EmployeeSpotlight;
    featureAccess: AppFeatureAccess;
    featureModes: AppFeatureModes;
    analytics: {
      windowDays: number;
      staffingSeries: Array<{ day: string; label: string; staffed: number; target: number }>;
      todoSeries: Array<{ day: string; label: string; created: number; completed: number; open: number }>;
      tempSeries: Array<{ day: string; label: string; avgTemp: number; highCount: number }>;
      featureStatus: Array<{ key: AppFeatureKey; label: string; mode: AppFeatureMode; live: boolean }>;
      kpis: {
        staffing: { value: number; delta: number };
        throughput: { value: number; delta: number };
        anomalies: { value: number; delta: number };
        nodes: { value: number; delta: number };
      };
      commandFeed: Array<{ title: string; detail: string; tone: Tone }>;
    };
    summary: {
      pendingUsers: number;
      pendingIdeas: number;
      staffedEmployees: number;
      todoActive: number;
      todoCompleted: number;
      nodesOperational: number;
      nodesTracked: number;
    };
  };

  let adminMessage = '';
  let guided = data.guided ?? false;
  let showGuidedTour = guided;
  const guidedSteps: GuidedStep[] = [
    {
      selector: '[data-guide="admin-command-center"]',
      title: 'Ops Command Center',
      description: 'This is your live overview of staffing, throughput, and service signals.',
      placement: 'bottom'
    },
    {
      selector: '[data-guide="admin-kpis"]',
      title: 'KPI Snapshot',
      description: 'Track staffing, task completion, anomalies, and node health at a glance.',
      placement: 'bottom'
    },
    {
      selector: '[data-guide="admin-charts"]',
      title: 'Trend Charts',
      description: 'Use these charts to spot staffing gaps, task bottlenecks, and temp drift quickly.',
      placement: 'top'
    },
    {
      selector: '[data-guide="admin-feature-matrix"]',
      title: 'Feature Matrix',
      description: 'Every module status appears here so you can confirm what is live right now.',
      placement: 'top'
    },
    {
      selector: '[data-guide="admin-feature-controls"]',
      title: 'Feature Controls',
      description: 'Open App Editor first to enable only the modules this operation needs.',
      placement: 'bottom'
    },
    {
      selector: '[data-guide="admin-registry"]',
      title: 'Business Registry',
      description: 'Complete ownership, legal, and business profile records here.',
      placement: 'top'
    },
    {
      selector: '[data-guide="admin-reminders"]',
      title: 'Action Queue',
      description: 'Check pending approvals, whiteboard moderation, and unresolved daily tasks.',
      placement: 'left'
    }
  ];
  const windowOptions = [
    { value: 1, label: '24H' },
    { value: 7, label: '7D' },
    { value: 30, label: '30D' }
  ];
  const chartWidth = 540;
  const chartHeight = 170;

  const withAdminFeedback: SubmitFunction = () => {
    adminMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast('Admin changes saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That action could not be completed.', 'error');
      }
      adminMessage =
        result.type === 'success'
          ? 'Admin changes saved.'
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

  async function markGuidedTourComplete() {
    try {
      await fetch('?/complete_guided_tour', { method: 'POST' });
    } catch {
      // Best-effort save only; do not block UI close.
    }
  }

  async function handleGuidedTourClose() {
    showGuidedTour = false;
    await markGuidedTourComplete();
    await clearGuidedQuery();
  }

  function pluralize(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function deltaText(delta: number) {
    if (delta === 0) return 'No change';
    return `${delta > 0 ? '+' : ''}${delta}`;
  }

  function deltaClass(delta: number, inverted = false) {
    if (delta === 0) return 'neutral';
    const good = inverted ? delta < 0 : delta > 0;
    return good ? 'up' : 'down';
  }

  function modeClass(mode: AppFeatureMode) {
    if (mode === 'off') return 'off';
    if (mode === 'admin') return 'admin';
    return 'all';
  }

  function modeVisibility(mode: AppFeatureMode) {
    if (mode === 'off') return 'Hidden';
    if (mode === 'admin') return 'Admin Only';
    return 'Everyone';
  }

  function barHeight(value: number, maxValue: number) {
    if (maxValue <= 0) return 2;
    if (value <= 0) return 2;
    return Math.max(8, Math.min(100, (value / maxValue) * 100));
  }

  function toChartPoints(values: number[], width: number, height: number, minValue: number, maxValue: number) {
    const safeMin = Number.isFinite(minValue) ? minValue : 0;
    const safeMax = Number.isFinite(maxValue) && maxValue > safeMin ? maxValue : safeMin + 1;
    const xPad = 18;
    const yPad = 18;
    const span = safeMax - safeMin || 1;
    const usableW = width - xPad * 2;
    const usableH = height - yPad * 2;

    return values.map((value, index) => {
      const x = xPad + (usableW * index) / Math.max(values.length - 1, 1);
      const y = yPad + usableH - ((value - safeMin) / span) * usableH;
      return { x, y, value };
    });
  }

  function pathFromPoints(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) return '';
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  }

  $: staffingValues = data.analytics.staffingSeries.map((point) => point.staffed);
  $: staffingTargets = data.analytics.staffingSeries.map((point) => point.target);
  $: staffingMax = Math.max(...staffingValues, ...staffingTargets, 1);
  $: staffingPoints = toChartPoints(staffingValues, chartWidth, chartHeight, 0, staffingMax);
  $: staffingTargetPoints = toChartPoints(staffingTargets, chartWidth, chartHeight, 0, staffingMax);

  $: tempValues = data.analytics.tempSeries.map((point) => point.avgTemp);
  $: tempMax = Math.max(...tempValues, 1);
  $: tempMin = Math.min(...tempValues, 0);
  $: tempPoints = toChartPoints(tempValues, chartWidth, chartHeight, tempMin, tempMax);

  $: todoMax = Math.max(
    1,
    ...data.analytics.todoSeries.map((point) => Math.max(point.created, point.completed, point.open))
  );

  $: reminders = [
    data.summary.pendingUsers > 0
      ? `${pluralize(data.summary.pendingUsers, 'user')} waiting for account approval.`
      : null,
    data.featureAccess.whiteboard && data.summary.pendingIdeas > 0
      ? `${pluralize(data.summary.pendingIdeas, 'whiteboard idea')} awaiting review.`
      : null,
    data.featureAccess.todo && data.summary.todoActive > 0
      ? `${pluralize(data.summary.todoActive, 'task')} still active in ToDo.`
      : null,
    data.featureAccess.temps && data.summary.nodesTracked > 0 && data.summary.nodesOperational === 0
      ? 'No node telemetry seen in the last 15 minutes.'
      : null,
    data.featureAccess.announcements && !data.announcement.content
      ? 'Announcements is empty. Add a shift update for the team.'
      : null,
    data.featureAccess.employee_spotlight && !data.employeeSpotlight.employeeName
      ? 'Employee Spotlight is empty. Add a team highlight.'
      : null
  ].filter((entry): entry is string => Boolean(entry));

</script>

<Layout>
  <PageHeader
    title="Admin Dashboard"
  />

  {#if showGuidedTour}
    <GuidedSpotlightTour
      title="Admin First-Open Guide"
      steps={guidedSteps}
      on:finish={handleGuidedTourClose}
      on:dismiss={handleGuidedTourClose}
    />
  {/if}

  <section class="panel command-center" data-guide="admin-command-center" aria-label="Operations command center">
    <div class="command-head">
      <div>
        <p class="control-kicker">Live Interface</p>
        <h2>Ops Command Center</h2>
      </div>
      <nav class="window-switch" aria-label="Analytics window">
        {#each windowOptions as option}
          <a
            href={`/admin?window=${option.value}`}
            class:active={data.analytics.windowDays === option.value}
          >
            {option.label}
          </a>
        {/each}
      </nav>
    </div>

    <div class="kpi-grid" data-guide="admin-kpis">
      <article class="kpi-card">
        <p>Staffed Today</p>
        <h3>{data.analytics.kpis.staffing.value}</h3>
        <small class={deltaClass(data.analytics.kpis.staffing.delta)}>
          {deltaText(data.analytics.kpis.staffing.delta)} vs previous day
        </small>
      </article>
      <article class="kpi-card">
        <p>Tasks Completed</p>
        <h3>{data.analytics.kpis.throughput.value}</h3>
        <small class={deltaClass(data.analytics.kpis.throughput.delta)}>
          {deltaText(data.analytics.kpis.throughput.delta)} vs previous window
        </small>
      </article>
      <article class="kpi-card">
        <p>Temp Anomalies</p>
        <h3>{data.analytics.kpis.anomalies.value}</h3>
        <small class={deltaClass(data.analytics.kpis.anomalies.delta, true)}>
          {deltaText(data.analytics.kpis.anomalies.delta)} vs previous window
        </small>
      </article>
      <article class="kpi-card">
        <p>Live Nodes</p>
        <h3>{data.analytics.kpis.nodes.value}</h3>
        <small class={deltaClass(data.analytics.kpis.nodes.delta)}>
          {deltaText(data.analytics.kpis.nodes.delta)} baseline drift
        </small>
      </article>
    </div>

    <div class="chart-grid" data-guide="admin-charts">
      <article class="chart-card">
        <div class="chart-head">
          <h3>Staffing Coverage</h3>
          <small>Scheduled vs target staff</small>
        </div>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Staffing trend">
          <path class="chart-target" d={pathFromPoints(staffingTargetPoints)} />
          <path class="chart-line" d={pathFromPoints(staffingPoints)} />
          {#each staffingPoints as point, index}
            <circle cx={point.x} cy={point.y} r="3.3" class="chart-dot">
              <title>{data.analytics.staffingSeries[index].label}: {point.value} staffed</title>
            </circle>
          {/each}
        </svg>
        <div class="chart-labels">
          {#each data.analytics.staffingSeries as point}
            <span>{point.label}</span>
          {/each}
        </div>
      </article>

      <article class="chart-card">
        <div class="chart-head">
          <h3>ToDo Throughput</h3>
          <small>Created and completed tasks</small>
        </div>
        <div class="todo-bars" role="img" aria-label="ToDo throughput bars">
          {#each data.analytics.todoSeries as point}
            <div class="todo-col" title={`${point.label}: ${point.created} created, ${point.completed} completed, ${point.open} open`}>
              <div class="bars-wrap">
                <span class="bar created" style={`height:${barHeight(point.created, todoMax)}%`}></span>
                <span class="bar completed" style={`height:${barHeight(point.completed, todoMax)}%`}></span>
              </div>
              <small>{point.label}</small>
              <small class="open-qty">Open {point.open}</small>
            </div>
          {/each}
        </div>
      </article>

      <article class="chart-card">
        <div class="chart-head">
          <h3>Temp Stability</h3>
          <small>Average temp + anomaly hits</small>
        </div>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Temperature trend">
          <path class="chart-line temp-line" d={pathFromPoints(tempPoints)} />
          {#each tempPoints as point, index}
            <circle cx={point.x} cy={point.y} r="3.2" class="chart-dot temp-dot">
              <title>{data.analytics.tempSeries[index].label}: {point.value.toFixed(1)}F avg</title>
            </circle>
          {/each}
        </svg>
        <div class="temp-hit-row">
          {#each data.analytics.tempSeries as point}
            <span class:hot={point.highCount > 0} title={`${point.label}: ${point.highCount} anomaly hit(s)`}>
              {point.highCount}
            </span>
          {/each}
        </div>
      </article>
    </div>

    <div class="command-bottom">
      <article class="matrix-card" data-guide="admin-feature-matrix">
        <div class="chart-head">
          <h3>Feature Matrix</h3>
          <small>Live state by module</small>
        </div>
        <div class="matrix-table" role="table" aria-label="Feature matrix">
          <div class="matrix-head" role="row">
            <span>Module</span>
            <span>Status</span>
            <span>Visibility</span>
          </div>
          {#each data.analytics.featureStatus as feature}
            <div class="matrix-row" role="row">
              <span class="module-cell">{feature.label}</span>
              <span class={`status-cell ${modeClass(feature.mode)}`}>
                <i aria-hidden="true"></i>
                {feature.mode === 'off' ? 'Hidden' : 'Live'}
              </span>
              <span class={`visibility-cell ${modeClass(feature.mode)}`}>{modeVisibility(feature.mode)}</span>
            </div>
          {/each}
        </div>
      </article>

      <article class="feed-card">
        <div class="chart-head">
          <h3>Command Feed</h3>
          <small>Current operation signals</small>
        </div>
        <ul>
          {#each data.analytics.commandFeed as item}
            <li class={`tone-${item.tone}`}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </li>
          {/each}
        </ul>
      </article>
    </div>
  </section>

  <section class="control-center" aria-label="Admin control center">
    <article class="panel control-overview">
      <div class="control-head">
        <p class="control-kicker">Operations Snapshot</p>
        <h2>Control Center</h2>
      </div>
      <div class="metric-grid">
        <article class="metric-item">
          <p class="metric-label">Staffed Employees</p>
          <p class="metric-value">{data.summary.staffedEmployees}</p>
          <p class="metric-note">Employees currently scheduled today.</p>
        </article>
        <article class="metric-item">
          <p class="metric-label">Whiteboard Pending</p>
          <p class="metric-value">{data.summary.pendingIdeas}</p>
          <p class="metric-note">Ideas currently waiting for moderation.</p>
        </article>
        <article class="metric-item">
          <p class="metric-label">ToDo Active</p>
          <p class="metric-value">{data.summary.todoActive}</p>
          <p class="metric-note">Tasks still open and in-progress.</p>
        </article>
        <article class="metric-item">
          <p class="metric-label">ToDo Completed</p>
          <p class="metric-value">{data.summary.todoCompleted}</p>
          <p class="metric-note">Completed items still in the log.</p>
        </article>
        <article class="metric-item">
          <p class="metric-label">Nodes Operational</p>
          <p class="metric-value">{data.summary.nodesOperational}/{data.summary.nodesTracked}</p>
          <p class="metric-note">Live telemetry seen in the last 15 minutes.</p>
        </article>
      </div>
    </article>

    <aside class="panel reminders-panel" data-guide="admin-reminders">
      <div class="control-head">
        <p class="control-kicker">Action Queue</p>
        <h2>Reminders</h2>
      </div>
      {#if reminders.length === 0}
        <p class="reminders-empty">No outstanding reminders. Control center is clear.</p>
      {:else}
        <ul class="reminders-list">
          {#each reminders as reminder}
            <li>{reminder}</li>
          {/each}
        </ul>
      {/if}
    </aside>
  </section>

  <section class="admin-quick-tiles" aria-label="Admin quick tools">
    <article class="panel quick-link-tile">
      <a href="/" class="quick-link">
        <span class="panel-kicker">Navigation</span>
        <h2>Site Homepage</h2>
        <p>Open the public launch homepage without signing out.</p>
      </a>
    </article>

    <article class="panel quick-link-tile">
      <a href="/admin/app-editor" data-guide="admin-feature-controls" class="quick-link">
        <span class="panel-kicker">App Editor</span>
        <h2>Feature Controls</h2>
        <p>Turn modules on, set admin-only, or hide modules without deleting data.</p>
      </a>
    </article>

    <article class="panel quick-link-tile">
      <a href="/admin/app-editor#business-registry" data-guide="admin-registry" class="quick-link">
        <span class="panel-kicker">Ownership</span>
        <h2>Business Registry</h2>
        <p>Update legal entity, contact, website, and address records.</p>
      </a>
    </article>

    <article class="panel quick-link-tile">
      <a href="/admin/creator" class="quick-link">
        <span class="panel-kicker">Builder</span>
        <h2>Creator Studio</h2>
        <p>Open the dedicated editor page for lists, recipes, and document uploads.</p>
      </a>
    </article>

    {#if data.featureAccess.todo}
    <details class="panel quick-tile" id="todos">
      <summary>
        <div>
          <span class="panel-kicker">Quick Actions</span>
          <h2>ToDo</h2>
        </div>
        <span>{data.todos.length}</span>
      </summary>

      <form method="POST" action="?/create_todo" use:enhance={withAdminFeedback} class="add-row">
        <input name="title" placeholder="Task title" required />
        <input name="description" placeholder="Description" />
        <select name="assigned_to">
          <option value="">Assign: Anyone</option>
          {#each data.users as user}
            <option value={user.id}>{user.display_name ?? user.email}</option>
          {/each}
        </select>
        <button type="submit">Add Task</button>
      </form>

      <table class="sheet action-sheet user-sheet">
        <thead>
          <tr>
            <th>Title</th>
            <th>Description</th>
            <th>Assigned</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.todos as todo}
            <tr>
              <td>{todo.title}</td>
              <td>{todo.description || 'No description'}</td>
              <td>{todo.assigned_name ?? todo.assigned_email ?? 'Anyone'}</td>
              <td>{todo.completed_at ? 'Completed' : 'Active'}</td>
              <td>
                <form method="POST" action="?/delete_todo" use:enhance={withAdminFeedback} class="inline">
                  <input type="hidden" name="id" value={todo.id} />
                  <button type="submit" class="danger text-action" aria-label="Delete task">Delete</button>
                </form>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
    {/if}

    {#if data.featureAccess.announcements}
    <details class="panel quick-tile" id="announcement">
      <summary>
        <div>
          <span class="panel-kicker">Homepage</span>
          <h2>Announcements</h2>
        </div>
        <span>{data.announcement.content ? 'Live' : 'Empty'}</span>
      </summary>

      <form method="POST" action="?/save_announcement" use:enhance={withAdminFeedback} class="add-row docs-form">
        <textarea
          name="content"
          rows="5"
          placeholder="Write the message shown on the homepage..."
        >{data.announcement.content}</textarea>
        <button type="submit">Save Announcement</button>
      </form>
    </details>
    {/if}

    {#if data.featureAccess.employee_spotlight}
    <details class="panel quick-tile" id="employee-spotlight">
      <summary>
        <div>
          <span class="panel-kicker">Homepage</span>
          <h2>Employee Spotlight</h2>
        </div>
        <span>{data.employeeSpotlight.employeeName ? 'Live' : 'Empty'}</span>
      </summary>

      <form method="POST" action="?/save_employee_spotlight" use:enhance={withAdminFeedback} class="add-row docs-form">
        <input
          name="employee_name"
          placeholder="Employee name"
          value={data.employeeSpotlight.employeeName}
        />
        <textarea
          name="shoutout"
          rows="4"
          placeholder="Add the shoutout shown on the homepage..."
        >{data.employeeSpotlight.shoutout}</textarea>
        <button type="submit">Save Employee Spotlight</button>
      </form>
    </details>
    {/if}
  </section>

  {#if adminMessage}
    <p class="feedback-banner">{adminMessage}</p>
  {/if}

  <section class="panel-grid">
    {#if data.featureAccess.whiteboard}
    <div class="stack">
      <details class="panel" id="whiteboard">
        <summary>
          <div>
            <span class="panel-kicker">Moderation</span>
            <h2>Whiteboard</h2>
          </div>
          <span>{data.whiteboardIdeas.length} ideas</span>
        </summary>

        <div class="whiteboard-list">
          {#if data.whiteboardIdeas.length === 0}
            <p class="empty-note">No whiteboard ideas yet.</p>
          {:else}
            {#each data.whiteboardIdeas as idea}
              <article class="whiteboard-card">
                <div class="whiteboard-head">
                  <p class="whiteboard-content">{idea.content}</p>
                  <span class="status status-{idea.status}">{idea.status}</span>
                </div>

                <div class="whiteboard-meta">
                  <span><strong>Votes:</strong> {idea.votes}</span>
                  <span><strong>Submitted By:</strong> {idea.submitted_name ?? idea.submitted_email ?? 'Unknown'}</span>
                </div>

                <div class="whiteboard-actions">
                  <form method="POST" action="?/approve_whiteboard" use:enhance={withAdminFeedback}>
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="text-action">Approve</button>
                  </form>
                  <form method="POST" action="?/reject_whiteboard" use:enhance={withAdminFeedback}>
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="warn-action text-action">Reject</button>
                  </form>
                  <form method="POST" action="?/delete_whiteboard" use:enhance={withAdminFeedback}>
                    <input type="hidden" name="id" value={idea.id} />
                    <button type="submit" class="danger text-action">Delete</button>
                  </form>
                </div>
              </article>
            {/each}
          {/if}
        </div>
      </details>
    </div>
    {/if}

    {#if data.featureAccess.temps}
    <div class="stack">
      <details class="panel" id="nodes">
        <summary>
          <div>
            <span class="panel-kicker">Temper</span>
            <h2>Node Names</h2>
          </div>
          <span>{data.nodeNames.length} saved</span>
        </summary>

        <form method="POST" action="?/add_node_name" use:enhance={withAdminFeedback} class="add-row">
          <input name="sensor_id" type="number" min="1" placeholder="Node ID" required />
          <input name="name" placeholder="Display name" required />
          <button type="submit">Save Node</button>
        </form>

        <table class="sheet action-sheet">
          <thead>
            <tr>
              <th>Node ID</th>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#if data.nodeNames.length === 0}
              <tr><td colspan="3">No node names yet.</td></tr>
            {:else}
              {#each data.nodeNames as node}
                <tr>
                  <td>{node.sensor_id}</td>
                  <td>{node.name}</td>
                  <td>
                    <form method="POST" action="?/delete_node_name" use:enhance={withAdminFeedback} class="inline">
                      <input type="hidden" name="sensor_id" value={node.sensor_id} />
                      <button type="submit" class="danger text-action" aria-label="Delete node name">Delete</button>
                    </form>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </details>
    </div>
    {/if}
  </section>
</Layout>

<style>
  .command-center {
    padding: 1rem 1.05rem 1.05rem 1.1rem;
    margin-bottom: 0.72rem;
    display: grid;
    gap: 0.86rem;
  }

  .command-head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 0.85rem;
    flex-wrap: wrap;
  }

  .command-head h2 {
    margin: 0.22rem 0 0;
    font-size: 1.15rem;
    letter-spacing: -0.02em;
  }

  .window-switch {
    display: inline-flex;
    gap: 0.38rem;
  }

  .window-switch a {
    text-decoration: none;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 0.32rem 0.62rem;
    background: rgba(255, 255, 255, 0.02);
  }

  .window-switch a.active {
    color: var(--color-text);
    border-color: rgba(132, 146, 166, 0.38);
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.2), rgba(132, 146, 166, 0.05));
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .kpi-card {
    padding: 0.72rem 0.74rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    display: grid;
    gap: 0.2rem;
  }

  .kpi-card p {
    margin: 0;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .kpi-card h3 {
    margin: 0;
    font-size: 1.22rem;
    line-height: 1.1;
  }

  .kpi-card small {
    font-size: 0.74rem;
    color: var(--color-text-muted);
  }

  .kpi-card small.up {
    color: #22c55e;
  }

  .kpi-card small.down {
    color: #f87171;
  }

  .kpi-card small.neutral {
    color: var(--color-text-muted);
  }

  .chart-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .chart-card {
    padding: 0.7rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.015);
    display: grid;
    gap: 0.45rem;
  }

  .chart-head {
    display: grid;
    gap: 0.15rem;
  }

  .chart-head h3 {
    margin: 0;
    font-size: 0.9rem;
  }

  .chart-head small {
    color: var(--color-text-muted);
    font-size: 0.72rem;
  }

  .chart-card svg {
    width: 100%;
    height: auto;
    max-height: 146px;
    overflow: visible;
  }

  .chart-line {
    fill: none;
    stroke: #60a5fa;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chart-target {
    fill: none;
    stroke: rgba(132, 146, 166, 0.7);
    stroke-width: 1.9;
    stroke-dasharray: 6 5;
  }

  .chart-dot {
    fill: #93c5fd;
    stroke: rgba(15, 23, 42, 0.4);
    stroke-width: 1;
  }

  .temp-line {
    stroke: #34d399;
  }

  .temp-dot {
    fill: #6ee7b7;
  }

  .chart-labels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 0.3rem;
    font-size: 0.67rem;
    color: var(--color-text-muted);
  }

  .todo-bars {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(24px, 1fr));
    gap: 0.35rem;
    align-items: end;
    min-height: 140px;
  }

  .todo-col {
    display: grid;
    gap: 0.2rem;
    justify-items: center;
    align-content: end;
  }

  .bars-wrap {
    height: 82px;
    display: flex;
    align-items: end;
    gap: 3px;
  }

  .bar {
    width: 8px;
    border-radius: 8px;
    display: block;
  }

  .bar.created {
    background: rgba(96, 165, 250, 0.9);
  }

  .bar.completed {
    background: rgba(52, 211, 153, 0.9);
  }

  .todo-col small {
    font-size: 0.65rem;
    color: var(--color-text-muted);
  }

  .todo-col .open-qty {
    color: var(--color-text-soft);
  }

  .temp-hit-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 0.28rem;
  }

  .temp-hit-row span {
    display: inline-flex;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.16rem 0.22rem;
    font-size: 0.68rem;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.02);
  }

  .temp-hit-row span.hot {
    color: #fca5a5;
    border-color: rgba(248, 113, 113, 0.35);
    background: rgba(120, 12, 18, 0.18);
  }

  .command-bottom {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
    gap: 0.55rem;
  }

  .matrix-card,
  .feed-card {
    padding: 0.72rem 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.015);
    display: grid;
    gap: 0.45rem;
  }

  .matrix-table {
    display: grid;
    gap: 0.2rem;
  }

  .matrix-head,
  .matrix-row {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(88px, 0.7fr) minmax(112px, 0.8fr);
    gap: 0.4rem;
    align-items: center;
  }

  .matrix-head {
    padding: 0 0.18rem 0.24rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--color-text-muted);
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .matrix-row {
    padding: 0.26rem 0.18rem;
    border-radius: 8px;
  }

  .matrix-row:nth-child(even) {
    background: rgba(255, 255, 255, 0.02);
  }

  .module-cell {
    font-size: 0.74rem;
    color: var(--color-text);
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .status-cell {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.69rem;
    color: var(--color-text-muted);
  }

  .status-cell i {
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 999px;
    background: rgba(132, 146, 166, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.25);
    flex: 0 0 auto;
  }

  .status-cell.all,
  .status-cell.admin {
    color: #86efac;
  }

  .status-cell.off {
    color: #fca5a5;
  }

  .status-cell.all i {
    background: #16a34a;
  }

  .status-cell.admin i {
    background: #f59e0b;
  }

  .status-cell.off i {
    background: #ef4444;
  }

  .visibility-cell {
    display: inline-flex;
    justify-content: center;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.15rem 0.4rem;
    font-size: 0.66rem;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.02);
  }

  .visibility-cell.all {
    color: #86efac;
    border-color: rgba(34, 197, 94, 0.34);
    background: rgba(15, 118, 41, 0.14);
  }

  .visibility-cell.admin {
    color: #fcd34d;
    border-color: rgba(245, 158, 11, 0.34);
    background: rgba(120, 86, 10, 0.14);
  }

  .visibility-cell.off {
    color: #fca5a5;
    border-color: rgba(248, 113, 113, 0.35);
    background: rgba(120, 12, 18, 0.16);
  }

  :global(html[data-theme='light']) .status-cell.all {
    color: #14532d;
  }

  :global(html[data-theme='light']) .status-cell.admin {
    color: #78350f;
  }

  :global(html[data-theme='light']) .status-cell.off {
    color: #7f1d1d;
  }

  :global(html[data-theme='light']) .status-cell.all i {
    background: #15803d;
    border-color: rgba(21, 128, 61, 0.4);
  }

  :global(html[data-theme='light']) .status-cell.admin i {
    background: #b45309;
    border-color: rgba(180, 83, 9, 0.42);
  }

  :global(html[data-theme='light']) .status-cell.off i {
    background: #b91c1c;
    border-color: rgba(185, 28, 28, 0.42);
  }

  :global(html[data-theme='light']) .visibility-cell.all {
    color: #14532d;
    border-color: rgba(21, 128, 61, 0.4);
    background: rgba(34, 197, 94, 0.2);
  }

  :global(html[data-theme='light']) .visibility-cell.admin {
    color: #78350f;
    border-color: rgba(180, 83, 9, 0.4);
    background: rgba(245, 158, 11, 0.22);
  }

  :global(html[data-theme='light']) .visibility-cell.off {
    color: #7f1d1d;
    border-color: rgba(185, 28, 28, 0.38);
    background: rgba(248, 113, 113, 0.2);
  }

  .feed-card ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.4rem;
  }

  .feed-card li {
    display: grid;
    gap: 0.12rem;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .feed-card li:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .feed-card li strong {
    font-size: 0.75rem;
    color: var(--color-text);
  }

  .feed-card li span {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    line-height: 1.35;
  }

  .feed-card li.tone-ok strong {
    color: #86efac;
  }

  .feed-card li.tone-warn strong {
    color: #fca5a5;
  }

  :global(html[data-mobile-view='compact']) .command-center {
    padding: 0.74rem 0.78rem 0.8rem;
    gap: 0.62rem;
  }

  :global(html[data-mobile-view='compact']) .command-head h2 {
    font-size: 1.02rem;
  }

  :global(html[data-mobile-view='compact']) .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.42rem;
  }

  :global(html[data-mobile-view='compact']) .kpi-card {
    padding: 0.58rem 0.62rem;
  }

  :global(html[data-mobile-view='compact']) .chart-grid {
    grid-template-columns: 1fr;
    gap: 0.42rem;
  }

  :global(html[data-mobile-view='compact']) .chart-card {
    padding: 0.6rem 0.62rem;
  }

  :global(html[data-mobile-view='compact']) .chart-card svg {
    max-height: 118px;
  }

  :global(html[data-mobile-view='compact']) .chart-labels span:nth-child(odd) {
    display: none;
  }

  :global(html[data-mobile-view='compact']) .todo-col .open-qty {
    display: none;
  }

  :global(html[data-mobile-view='compact']) .command-bottom {
    grid-template-columns: 1fr;
    gap: 0.42rem;
  }

  :global(html[data-mobile-view='compact']) .matrix-head,
  :global(html[data-mobile-view='compact']) .matrix-row {
    grid-template-columns: minmax(0, 1fr) minmax(80px, 0.65fr) minmax(92px, 0.72fr);
    gap: 0.32rem;
  }

  :global(html[data-mobile-view='compact']) .module-cell {
    font-size: 0.7rem;
  }

  :global(html[data-mobile-view='compact']) .window-switch {
    width: 100%;
  }

  :global(html[data-mobile-view='compact']) .window-switch a {
    flex: 1 1 0;
    text-align: center;
    padding: 0.28rem 0.5rem;
  }

  .control-center,
  .admin-quick-tiles {
    display: grid;
    gap: 0.8rem;
  }

  .control-center {
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.75fr);
    margin: 0.15rem 0 0.7rem;
    align-items: stretch;
  }

  .control-overview,
  .reminders-panel {
    padding: 1rem 1rem 1rem 1.1rem;
    overflow: hidden;
  }

  .control-head {
    display: grid;
    gap: 0.2rem;
    margin-bottom: 0.75rem;
  }

  .control-kicker {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .control-head h2 {
    margin: 0;
    font-size: 1.2rem;
    letter-spacing: -0.02em;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    overflow: hidden;
  }

  .metric-item {
    padding: 0.68rem 0.72rem;
    min-height: 120px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  .metric-item:last-child {
    border-right: 0;
  }

  .metric-label {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .metric-value {
    margin: 0;
    font-size: 1.3rem;
    font-weight: var(--weight-semibold);
    line-height: 1.05;
  }

  .metric-note {
    margin: 0.34rem 0 0;
    color: var(--color-text-muted);
    font-size: 0.75rem;
    line-height: 1.35;
  }

  .reminders-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.45rem;
  }

  .reminders-list li,
  .reminders-empty {
    margin: 0;
    padding: 0.42rem 0 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--color-text-soft);
    font-size: 0.79rem;
    line-height: 1.4;
  }

  .reminders-list li:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .admin-quick-tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
    margin: 0 0 0.55rem;
  }

  .quick-tile {
    box-shadow: 0 10px 20px rgba(4, 5, 7, 0.14);
  }

  .quick-link-tile {
    box-shadow: 0 10px 20px rgba(4, 5, 7, 0.14);
  }

  .quick-link {
    display: block;
    padding: 0.75rem 0.85rem 0.72rem 0.95rem;
    text-decoration: none;
    color: inherit;
    min-height: 100%;
  }

  .quick-link h2 {
    margin: 0.15rem 0 0.36rem;
    font-size: 0.95rem;
  }

  .quick-link p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .quick-link:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .quick-link:focus-visible {
    outline: 2px solid rgba(132, 146, 166, 0.65);
    outline-offset: -2px;
    border-radius: inherit;
  }

  .quick-tile summary {
    padding: 0.75rem 0.85rem 0.72rem 0.95rem;
  }

  .quick-tile h2 {
    margin-top: 0.15rem;
    font-size: 0.95rem;
  }

  .quick-tile[open] {
    grid-column: 1 / -1;
  }


  .panel {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .panel::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.9), rgba(132, 146, 166, 0.2));
  }

  .panel-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .panel-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
  }

  .stack {
    display: grid;
    gap: 0.9rem;
  }

  .panel {
    overflow: hidden;
  }

  .panel summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
    list-style: none;
    padding: 1rem 1rem 0.95rem 1.1rem;
  }

  .panel summary::-webkit-details-marker {
    display: none;
  }

  .panel summary span:last-child {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .panel h2 {
    margin: 0.2rem 0 0;
  }

  .panel[open] > :global(form),
  .panel[open] > :global(table),
  .panel[open] > :global(div) {
    margin-left: 1.1rem;
    margin-right: 1rem;
  }

  .panel[open] > :global(table) {
    margin-bottom: 1rem;
  }

  .panel[open]:last-child {
    padding-bottom: 0.9rem;
  }

  .sheet {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .sheet th {
    text-align: left;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    padding: 0.55rem 0.42rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .sheet td {
    padding: 0.48rem 0.42rem;
    vertical-align: middle;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .sheet tbody tr:last-child td {
    border-bottom: none;
  }

  .add-row,
  .inline {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .add-row {
    margin: 0 1rem 0.9rem 1.1rem;
  }

  .feedback-banner {
    margin: 0;
    padding: 0.72rem 0.9rem;
    border: 1px solid rgba(22, 163, 74, 0.22);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.18), rgba(22, 163, 74, 0.06));
    color: #bbf7d0;
  }

  input,
  textarea,
  select {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.42rem 0.55rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.82rem;
    width: 100%;
  }

  button {
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
    color: var(--color-primary-contrast);
    padding: 0.4rem 0.62rem;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-medium);
  }

  .text-action {
    width: auto;
    min-width: 6.2rem;
    min-height: 2rem;
    white-space: nowrap;
  }

  .icon-btn {
    width: 1.9rem;
    height: 1.9rem;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  .danger {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
  }

  .warn-action {
    border-color: rgba(245, 158, 11, 0.28);
    color: #fcd34d;
    background: linear-gradient(180deg, rgba(120, 86, 10, 0.42), rgba(120, 86, 10, 0.14));
  }

  .status {
    display: inline-flex;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.18rem 0.5rem;
    font-size: 0.72rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .status-pending {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .status-approved {
    border-color: #16a34a;
    color: #16a34a;
  }

  .status-rejected {
    border-color: #ef4444;
    color: #ef4444;
  }

  .docs-form {
    align-items: flex-start;
  }

  .docs-form textarea {
    min-height: 160px;
    resize: vertical;
    flex: 1 1 100%;
  }

  .whiteboard-list {
    display: grid;
    gap: 0.75rem;
    margin: 0 1rem 1rem 1.1rem;
  }

  .whiteboard-card {
    padding: 0.85rem 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.025);
  }

  .whiteboard-head {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: start;
  }

  .whiteboard-content {
    margin: 0;
    color: var(--color-text);
    overflow-wrap: anywhere;
  }

  .whiteboard-meta {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 0.7rem;
    color: var(--color-text-muted);
    font-size: 0.84rem;
  }

  .whiteboard-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.8rem;
  }

  .empty-note {
    margin: 0;
    color: var(--color-text-muted);
  }

  @media (max-width: 1100px) {
    .kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .chart-grid {
      grid-template-columns: 1fr;
    }

    .command-bottom {
      grid-template-columns: 1fr;
    }

    .control-center {
      grid-template-columns: 1fr;
    }

    .metric-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .metric-item:nth-child(3n) {
      border-right: 0;
    }

    .admin-quick-tiles,
    .panel-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

  }

  @media (max-width: 900px) {
    .command-center {
      padding: 0.85rem;
    }

    .sheet {
      min-width: 680px;
    }

    .action-sheet {
      min-width: 0;
      width: 100%;
      table-layout: fixed;
    }

    .action-sheet th:last-child,
    .action-sheet td:last-child {
      width: 132px;
    }

    .action-sheet td {
      overflow-wrap: anywhere;
    }

    .action-sheet .inline {
      flex-wrap: nowrap;
      gap: 0.3rem;
    }

    .add-row > *,
    .inline > * {
      flex: 1 1 100%;
      min-width: 0;
    }

    .action-sheet td:last-child .inline {
      flex: 0 0 auto;
    }

    .action-sheet td:last-child .inline > * {
      flex: 0 0 auto;
      min-width: 0;
    }

  }

  @media (max-width: 700px) {
    .window-switch {
      width: 100%;
    }

    .window-switch a {
      flex: 1 1 0;
      text-align: center;
    }

    .metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .metric-item {
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .metric-item:nth-child(2n) {
      border-right: 0;
    }

    .metric-item:nth-last-child(-n + 2) {
      border-bottom: 0;
    }

    .admin-quick-tiles,
    .panel-grid {
      grid-template-columns: 1fr;
    }

    .whiteboard-head {
      flex-direction: column;
      align-items: start;
    }

    .whiteboard-actions form {
      width: 100%;
    }

    .text-action {
      width: 100%;
    }
  }

  @media (max-width: 520px) {
    .metric-grid {
      grid-template-columns: 1fr;
    }

    .metric-item {
      border-right: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      min-height: 0;
    }

    .metric-item:last-child {
      border-bottom: 0;
    }
  }

</style>




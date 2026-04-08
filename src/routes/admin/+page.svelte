<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

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

  export let data: {
    todos: Todo[];
    users: UserOption[];
    nodeNames: NodeName[];
    whiteboardIdeas: WhiteboardIdea[];
    announcement: Announcement;
    employeeSpotlight: EmployeeSpotlight;
    summary: {
      pendingUsers: number;
      openTodos: number;
      pendingIdeas: number;
      nodeCount: number;
    };
  };

  let adminMessage = '';

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

  const editorLinks = [
    {
      href: '/admin/schedule',
      title: 'Schedule',
      description: 'Build and post weekly shifts.'
    },
    {
      href: '/admin/schedule-settings',
      title: 'Schedule Settings',
      description: 'Manage roles, departments, and autofill behavior.'
    },
    {
      href: '/admin/users',
      title: 'Users',
      description: 'Approve, deny, and manage staff access.'
    },
    {
      href: '/admin/lists',
      title: 'Lists',
      description: 'Edit prep, inventory, and order sheets.'
    },
    {
      href: '/admin/recipes',
      title: 'Recipes',
      description: 'Add and remove recipes by category.'
    },
    {
      href: '/admin/documents',
      title: 'Documents',
      description: 'Update docs, handbook pages, and file links.'
    },
    {
      href: '/admin/camera',
      title: 'Camera Activity',
      description: 'View camera clips and live feed settings.'
    }
  ];
</script>

<Layout>
  <PageHeader
    title="Admin Dashboard"
    subtitle="Handle approvals and updates from one admin page."
  />

  <section class="hero-grid" aria-label="Admin overview">
    <article class="hero-card">
      <span class="eyebrow">Pending Users</span>
      <strong>{data.summary.pendingUsers}</strong>
      <p>Accounts waiting for approval.</p>
    </article>
    <article class="hero-card">
      <span class="eyebrow">Open Tasks</span>
      <strong>{data.summary.openTodos}</strong>
      <p>Tasks still waiting to be finished.</p>
    </article>
    <article class="hero-card">
      <span class="eyebrow">Pending Ideas</span>
      <strong>{data.summary.pendingIdeas}</strong>
      <p>Ideas waiting for approval.</p>
    </article>
    <article class="hero-card">
      <span class="eyebrow">Named Nodes</span>
      <strong>{data.summary.nodeCount}</strong>
      <p>Named temperature nodes.</p>
    </article>
  </section>

  <section class="editor-grid" aria-label="Admin editors">
    {#each editorLinks as link}
      <a class="editor-link" href={link.href}>
        <span class="editor-kicker">Editor</span>
        <h2>{link.title}</h2>
        <p>{link.description}</p>
        <span class="editor-cta">Open</span>
      </a>
    {/each}
  </section>

  <nav class="jump-nav" aria-label="Admin quick sections">
    <a href="#todos">Todo</a>
    <a href="#whiteboard">Whiteboard</a>
    <a href="#announcement">Announcement</a>
    <a href="#employee-spotlight">Employee</a>
    <a href="#nodes">Node Names</a>
  </nav>

  <section class="stack">
    {#if adminMessage}
      <p class="feedback-banner">{adminMessage}</p>
    {/if}

    <details class="panel" id="todos">
      <summary>
        <div>
          <span class="panel-kicker">Quick Actions</span>
          <h2>Todo</h2>
        </div>
        <span>{data.todos.length} items</span>
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

    <details class="panel" id="announcement">
      <summary>
        <div>
          <span class="panel-kicker">Homepage</span>
          <h2>Announcement</h2>
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

    <details class="panel" id="employee-spotlight">
      <summary>
        <div>
          <span class="panel-kicker">Homepage</span>
          <h2>Employee Of The Day</h2>
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

  </section>
</Layout>

<style>
  .hero-grid,
  .editor-grid {
    display: grid;
    gap: 0.8rem;
  }

  .hero-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin: 0.5rem 0 1rem;
  }

  .hero-card,
  .editor-link,
  .panel {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .hero-card,
  .editor-link {
    overflow: hidden;
    padding: 1rem;
  }

  .hero-card::before,
  .editor-link::before,
  .panel::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.9), rgba(195, 32, 43, 0.2));
  }

  .eyebrow,
  .panel-kicker,
  .editor-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .hero-card strong {
    display: block;
    margin-top: 0.45rem;
    font-size: 2rem;
    line-height: 1;
  }

  .hero-card p,
  .editor-link p {
    margin: 0.45rem 0 0;
    color: var(--color-text-muted);
  }

  .editor-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: 1rem;
  }

  .editor-link {
    text-decoration: none;
    color: inherit;
    transition: transform 150ms var(--ease-out), border-color 150ms var(--ease-out);
  }

  .editor-link:hover,
  .editor-link:focus-visible {
    transform: translateY(-2px);
    border-color: rgba(195, 32, 43, 0.28);
    outline: none;
  }

  .editor-link h2 {
    margin: 0.45rem 0 0;
    font-size: 1rem;
  }

  .editor-cta {
    display: inline-flex;
    margin-top: 0.9rem;
    border-radius: 999px;
    border: 1px solid rgba(195, 32, 43, 0.22);
    padding: 0.28rem 0.7rem;
    font-size: 0.78rem;
    color: var(--color-text-soft);
    background: rgba(195, 32, 43, 0.08);
  }

  .jump-nav {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 0 0 1rem;
  }

  .jump-nav a {
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    font-size: 0.76rem;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
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
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
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
    .hero-grid,
    .editor-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .hero-card,
    .editor-link {
      padding: 0.82rem;
    }

    .hero-card strong {
      font-size: 1.6rem;
    }

    .editor-link h2 {
      font-size: 0.92rem;
    }

    .editor-link p,
    .hero-card p {
      font-size: 0.8rem;
    }
  }

  @media (max-width: 900px) {
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

</style>

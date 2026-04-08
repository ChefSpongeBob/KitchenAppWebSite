<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import ScheduleAdminTabs from '$lib/components/ui/ScheduleAdminTabs.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import { scheduleDepartments, type ScheduleDepartment } from '$lib/assets/schedule';
  import type { SubmitFunction } from '@sveltejs/kit';

  type UserOption = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    is_active: number;
    can_manage_specials: number;
    approved_departments: ScheduleDepartment[];
  };

  type InviteOption = {
    id: string;
    email: string;
    invite_code: string;
    created_at: number;
    expires_at: number | null;
    used_at: number | null;
    revoked_at: number | null;
  };

  export let data: {
    users: UserOption[];
    invites: InviteOption[];
    emailConfigured: boolean;
  };

  $: restrictedUsers = data.users.filter((user) => user.is_active !== 1);
  $: activeUsers = data.users.filter((user) => user.is_active === 1);
  $: activeInvites = data.invites.filter((invite) => invite.revoked_at === null && invite.used_at === null);
  $: usedInvites = data.invites.filter((invite) => invite.used_at !== null);

  const formatDate = (value: number | null) =>
    value ? new Date(value * 1000).toLocaleDateString() : 'None';

  const departmentSummary = (user: UserOption) =>
    user.approved_departments.length > 0 ? user.approved_departments.join(', ') : 'No schedule departments';

  const isDepartmentApproved = (user: UserOption, department: ScheduleDepartment) =>
    user.approved_departments.includes(department);

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'User access updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That user change could not be saved.', 'error');
      }
    };
  };
</script>

<Layout>
  <PageHeader
    title="User Access"
    subtitle="Approve, deny, and manage staff access."
  />
  <ScheduleAdminTabs active="users" />

  <nav class="subnav">
    <a href="/admin">Back to Dashboard</a>
  </nav>

  <section class="summary-grid" aria-label="User summary">
    <article class="summary-card">
      <span class="eyebrow">Restricted</span>
      <strong>{restrictedUsers.length}</strong>
      <p>Accounts currently blocked from signing in.</p>
    </article>
    <article class="summary-card">
      <span class="eyebrow">Active</span>
      <strong>{activeUsers.length}</strong>
      <p>Accounts currently allowed to sign in.</p>
    </article>
    <article class="summary-card">
      <span class="eyebrow">Invites</span>
      <strong>{activeInvites.length}</strong>
      <p>Pre-authorized registrations ready to use.</p>
    </article>
  </section>

  <section class="stack">
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Invites</span>
          <h2>Registration Invites</h2>
        </div>
        <span>{activeInvites.length} active</span>
      </header>

      {#if !data.emailConfigured}
        <p class="config-banner">
          Invite and approval emails are not configured yet. Add `RESEND_API_KEY` and
          `RESEND_FROM_EMAIL` to enable sending.
        </p>
      {/if}

      <form method="POST" action="?/create_user_invite" use:enhance={withFeedback} class="invite-form">
        <input
          name="email"
          type="email"
          placeholder="staff@email.com"
          aria-label="Invite email"
          required
        />
        <button type="submit">Create Invite</button>
      </form>

      <div class="user-grid">
        {#if activeInvites.length === 0}
          <article class="user-card empty-card">No active invites.</article>
        {:else}
          {#each activeInvites as invite}
            <article class="user-card">
              <div class="user-head">
                <div>
                  <h3>{invite.email}</h3>
                  <p>Expires {formatDate(invite.expires_at)}</p>
                </div>
                <span class="status status-approved">Ready</span>
              </div>

              <dl class="meta">
                <div>
                  <dt>Invite Code</dt>
                  <dd class="code-value">{invite.invite_code}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(invite.created_at)}</dd>
                </div>
              </dl>

              <div class="actions">
                <form method="POST" action="?/revoke_user_invite" use:enhance={withFeedback}>
                  <input type="hidden" name="invite_id" value={invite.id} />
                  <button type="submit" class="warn-action">Revoke Invite</button>
                </form>
              </div>
            </article>
          {/each}
        {/if}
      </div>

      {#if usedInvites.length > 0}
        <details class="used-invites">
          <summary>Used Invites ({usedInvites.length})</summary>
          <div class="user-grid compact-grid">
            {#each usedInvites as invite}
              <article class="user-card compact-card">
                <div class="user-head">
                  <div>
                    <h3>{invite.email}</h3>
                    <p>Used {formatDate(invite.used_at)}</p>
                  </div>
                  <span class="status">Used</span>
                </div>
              </article>
            {/each}
          </div>
        </details>
      {/if}
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Restricted</span>
          <h2>Restricted Users</h2>
        </div>
        <span>{restrictedUsers.length} users</span>
      </header>

      <div class="user-grid">
        {#if restrictedUsers.length === 0}
          <article class="user-card empty-card">No restricted users.</article>
        {:else}
          {#each restrictedUsers as user}
            <article class="user-card">
              <div class="user-head">
                <div>
                  <h3>{user.display_name ?? 'Unnamed User'}</h3>
                  <p>{user.email}</p>
                </div>
                <span class="status status-restricted">Restricted</span>
              </div>

              <dl class="meta">
                <div>
                  <dt>Role</dt>
                  <dd>{user.role}</dd>
                </div>
                <div>
                  <dt>Schedule</dt>
                  <dd>{departmentSummary(user)}</dd>
                </div>
              </dl>

              <div class="department-editor">
                <span>Departments</span>
                <div class="department-chips">
                  {#each scheduleDepartments as department}
                    <form method="POST" action="?/toggle_schedule_department" use:enhance={withFeedback}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <input type="hidden" name="department" value={department} />
                      <button
                        type="submit"
                        class="department-chip"
                        class:department-chip-active={isDepartmentApproved(user, department)}
                      >
                        {department}
                      </button>
                    </form>
                  {/each}
                </div>
              </div>

              <div class="actions">
                <form method="POST" action="?/approve_user" use:enhance={withFeedback}>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button type="submit">Allow Access</button>
                </form>
                <form method="POST" action="?/deny_user" use:enhance={withFeedback}>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button type="submit" class="warn-action">Keep Blocked</button>
                </form>
              </div>
            </article>
          {/each}
        {/if}
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Active</span>
          <h2>Active Users</h2>
        </div>
        <span>{activeUsers.length} users</span>
      </header>

      <div class="user-grid">
        {#if activeUsers.length === 0}
          <article class="user-card empty-card">No active users.</article>
        {:else}
          {#each activeUsers as user}
            <article class="user-card">
              <div class="user-head">
                <div>
                  <h3>{user.display_name ?? 'Unnamed User'}</h3>
                  <p>{user.email}</p>
                </div>
                <span class="status status-approved">Active</span>
              </div>

              <dl class="meta">
                <div>
                  <dt>Role</dt>
                  <dd>{user.role}</dd>
                </div>
                <div>
                  <dt>Specials</dt>
                  <dd>{user.role === 'admin' || user.can_manage_specials === 1 ? 'Allowed' : 'Off'}</dd>
                </div>
                <div>
                  <dt>Schedule</dt>
                  <dd>{departmentSummary(user)}</dd>
                </div>
              </dl>

              <div class="department-editor">
                <span>Departments</span>
                <div class="department-chips">
                  {#each scheduleDepartments as department}
                    <form method="POST" action="?/toggle_schedule_department" use:enhance={withFeedback}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <input type="hidden" name="department" value={department} />
                      <button
                        type="submit"
                        class="department-chip"
                        class:department-chip-active={isDepartmentApproved(user, department)}
                      >
                        {department}
                      </button>
                    </form>
                  {/each}
                </div>
              </div>

              <div class="actions">
                <form method="POST" action="?/deny_user" use:enhance={withFeedback}>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button type="submit" class="warn-action">Restrict</button>
                </form>

                {#if user.role !== 'admin'}
                  <form method="POST" action="?/make_user_admin" use:enhance={withFeedback}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <button type="submit">Make Admin</button>
                  </form>
                {/if}

                <form method="POST" action="?/toggle_specials_access" use:enhance={withFeedback}>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button
                    type="submit"
                    class:success-action={user.can_manage_specials === 1 || user.role === 'admin'}
                  >
                    {user.can_manage_specials === 1 || user.role === 'admin'
                      ? 'Specials Allowed'
                      : 'Grant Specials'}
                  </button>
                </form>

                <form method="POST" action="?/delete_user" use:enhance={withFeedback}>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button type="submit" class="danger-action">Delete</button>
                </form>
              </div>
            </article>
          {/each}
        {/if}
      </div>
    </section>
  </section>
</Layout>

<style>
  .subnav {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 0.5rem 0 1rem;
  }

  .subnav a {
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .summary-grid,
  .user-grid {
    display: grid;
    gap: 0.8rem;
  }

  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0.5rem 0 1rem;
  }

  .summary-card,
  .panel,
  .user-card {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .summary-card,
  .user-card {
    overflow: hidden;
    padding: 1rem;
  }

  .summary-card::before,
  .panel::before,
  .user-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.9), rgba(195, 32, 43, 0.2));
  }

  .eyebrow,
  .panel-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .summary-card strong {
    display: block;
    margin-top: 0.45rem;
    font-size: 2rem;
    line-height: 1;
  }

  .summary-card p {
    margin: 0.45rem 0 0;
    color: var(--color-text-muted);
  }

  .stack {
    display: grid;
    gap: 0.9rem;
  }

  .panel {
    padding: 1rem;
  }

  .config-banner {
    margin: 0 0 0.9rem;
    padding: 0.72rem 0.9rem;
    border-radius: 12px;
  }

  .config-banner {
    border: 1px solid rgba(245, 158, 11, 0.26);
    background: linear-gradient(180deg, rgba(120, 86, 10, 0.3), rgba(120, 86, 10, 0.12));
    color: #fde68a;
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    margin-bottom: 0.9rem;
  }

  .panel-head h2,
  .user-head h3 {
    margin: 0.2rem 0 0;
  }

  .panel-head > span {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .user-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .user-head {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: start;
  }

  .user-head p {
    margin: 0.2rem 0 0;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
    margin: 0.9rem 0;
  }

  .meta div {
    padding: 0.6rem 0.7rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .meta dt {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin-bottom: 0.22rem;
  }

  .meta dd {
    margin: 0;
    color: var(--color-text);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: stretch;
  }

  .department-editor {
    display: grid;
    gap: 0.45rem;
    margin: 0 0 0.9rem;
  }

  .department-editor > span {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .department-chips {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .department-chips form {
    flex: 0 0 auto;
  }

  .department-chip {
    width: auto;
    min-height: 2.1rem;
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-text);
    padding-inline: 0.8rem;
  }

  .department-chip.department-chip-active {
    border-color: rgba(22, 163, 74, 0.24);
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.22), rgba(22, 163, 74, 0.08));
    color: #dcfce7;
  }

  .actions form {
    flex: 1 1 150px;
  }

  .invite-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.6rem;
    margin-bottom: 0.9rem;
  }

  .code-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    letter-spacing: 0.04em;
  }

  .used-invites {
    margin-top: 0.9rem;
  }

  .used-invites summary {
    cursor: pointer;
    color: var(--color-text-muted);
  }

  .compact-grid {
    margin-top: 0.75rem;
  }

  .compact-card {
    padding: 0.8rem;
  }

  button {
    width: 100%;
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    min-height: 2.6rem;
    padding: 0.55rem 0.78rem;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-medium);
    line-height: 1.2;
  }

  .warn-action {
    border-color: rgba(245, 158, 11, 0.28);
    color: #fcd34d;
    background: linear-gradient(180deg, rgba(120, 86, 10, 0.42), rgba(120, 86, 10, 0.14));
  }

  .danger-action {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
  }

  .success-action {
    border-color: rgba(22, 163, 74, 0.32);
    color: #bbf7d0;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.34), rgba(22, 163, 74, 0.12));
  }

  .status {
    display: inline-flex;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.18rem 0.5rem;
    font-size: 0.72rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .status-restricted {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .status-approved {
    border-color: #16a34a;
    color: #16a34a;
  }

  .empty-card {
    color: var(--color-text-muted);
  }

  @media (max-width: 900px) {
    .user-grid,
    .summary-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 640px) {
    .panel {
      padding: 0.9rem;
    }

    .panel-head,
    .user-head {
      flex-direction: column;
      align-items: start;
    }

    .meta {
      grid-template-columns: minmax(0, 1fr);
    }

    .actions form {
      flex-basis: 100%;
    }

    .invite-form {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>

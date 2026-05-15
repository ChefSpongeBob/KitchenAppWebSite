<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type UserOption = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    is_active: number;
    can_manage_specials: number;
    approved_departments: string[];
  };

  type InviteOption = {
    id: string;
    email: string;
    invite_code: string;
    employment_type: string;
    job_title: string;
    department: string;
    primary_schedule_department: string;
    start_date: string;
    pay_type: string;
    onboarding_required: number;
    created_at: number;
    expires_at: number | null;
    used_at: number | null;
    revoked_at: number | null;
  };

  export let data: {
    users: UserOption[];
    invites: InviteOption[];
    departments: string[];
  };

  let staffSearch = '';

  $: restrictedUsers = data.users.filter((user) => user.is_active !== 1);
  $: activeUsers = data.users.filter((user) => user.is_active === 1);
  $: adminUsers = activeUsers.filter((user) => user.role === 'admin');
  $: activeInvites = data.invites.filter((invite) => invite.revoked_at === null && invite.used_at === null);
  $: usedInvites = data.invites.filter((invite) => invite.used_at !== null);
  $: filteredStaff = activeUsers.filter((user) => {
    const query = staffSearch.trim().toLowerCase();
    if (!query) return true;
    const haystack = [user.display_name ?? '', user.email, user.role, ...user.approved_departments]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  const formatDate = (value: number | null) => (value ? new Date(value * 1000).toLocaleDateString() : 'None');

  const departmentSummary = (user: UserOption) =>
    user.approved_departments.length > 0 ? user.approved_departments.join(', ') : 'No schedule departments';

  const displayName = (user: UserOption) => user.display_name?.trim() || 'Unnamed User';

  const initialsFor = (user: UserOption) => {
    const source = displayName(user) === 'Unnamed User' ? user.email : displayName(user);
    return source.trim().charAt(0).toUpperCase();
  };

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
  <PageHeader title="Employees" />

  <section class="people-board">
    <section class="people-hero" aria-label="People overview">
      <div>
        <span class="kicker">People Operations</span>
        <h2>Staff access, invites, and employee records</h2>
        <p>Manage who can enter the workspace, review restricted accounts, and open employee profiles from one cleaner roster.</p>
      </div>

      <div class="people-metrics">
        <div>
          <span>Active</span>
          <strong>{activeUsers.length}</strong>
        </div>
        <div>
          <span>Admins</span>
          <strong>{adminUsers.length}</strong>
        </div>
        <div>
          <span>Restricted</span>
          <strong>{restrictedUsers.length}</strong>
        </div>
        <div>
          <span>Invites</span>
          <strong>{activeInvites.length}</strong>
        </div>
      </div>
    </section>

    <section class="people-workspace">
      <div class="roster-region">
        <header class="section-toolbar">
          <div>
            <span class="kicker">Roster</span>
            <h2>Current Staff</h2>
          </div>
          <label class="search-box">
            <span>Search employees</span>
            <input bind:value={staffSearch} type="search" placeholder="Name, email, role, department" aria-label="Search employees" />
          </label>
        </header>

        <div class="staff-table" aria-label="Staff roster">
          <div class="table-header" aria-hidden="true">
            <span>Employee</span>
            <span>Role</span>
            <span>Departments</span>
            <span>Actions</span>
          </div>

          {#if filteredStaff.length === 0}
            <p class="empty table-empty">{activeUsers.length === 0 ? 'No staff yet.' : 'No staff match that search.'}</p>
          {:else}
            {#each filteredStaff as user}
              <div class="staff-row">
                <a href={`/admin/users/${user.id}`} class="staff-identity">
                  <span class="avatar" aria-hidden="true">{initialsFor(user)}</span>
                  <span class="identity-copy">
                    <strong>{displayName(user)}</strong>
                    <small>{user.email}</small>
                  </span>
                </a>
                <span class="role-pill" class:role-admin={user.role === 'admin'}>{user.role === 'admin' ? 'Admin' : 'Staff'}</span>
                <span class="department-copy">{departmentSummary(user)}</span>
                <div class="row-actions">
                  <a href={`/admin/users/${user.id}`} class="inline-action">Open</a>
                  <form method="POST" action="?/deny_user" use:enhance={withFeedback}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <button type="submit" class="warn-action">Restrict</button>
                  </form>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <aside class="people-side" aria-label="Invite and review tools">
        <section class="side-section invite-section">
          <header class="side-head">
            <div>
              <span class="kicker">Invites</span>
              <h2>Registration Access</h2>
            </div>
            <span>{activeInvites.length} active</span>
          </header>

          <form method="POST" action="?/create_user_invite" use:enhance={withFeedback} class="invite-form">
            <input name="email" type="email" placeholder="staff@email.com" aria-label="Invite email" required />
            <details class="invite-context">
              <summary>Employment</summary>
              <div class="invite-context-grid">
                <label>
                  <span>Type</span>
                  <select name="employment_type">
                    <option value="employee">Employee</option>
                    <option value="contractor">Contractor</option>
                  </select>
                </label>
                <label>
                  <span>Job Title</span>
                  <input name="job_title" />
                </label>
                <label>
                  <span>Department</span>
                  <select name="department">
                    <option value="">Unassigned</option>
                    {#each data.departments as department}
                      <option value={department}>{department}</option>
                    {/each}
                  </select>
                </label>
                <label>
                  <span>Start Date</span>
                  <input name="start_date" type="date" />
                </label>
                <label>
                  <span>Pay Type</span>
                  <select name="pay_type">
                    <option value="">Unset</option>
                    <option value="hourly">Hourly</option>
                    <option value="salary">Salary</option>
                  </select>
                </label>
              </div>
            </details>
            <button type="submit">Invite</button>
          </form>

          <div class="invite-list">
            {#if activeInvites.length === 0}
              <p class="empty">No active invites.</p>
            {:else}
              {#each activeInvites as invite}
                <div class="invite-row">
                  <div>
                    <strong>{invite.email}</strong>
                    <span>{[invite.job_title, invite.department, invite.start_date].filter(Boolean).join(' | ') || 'Pending setup'}</span>
                    <span>Expires {formatDate(invite.expires_at)}</span>
                  </div>
                  <code>{invite.invite_code}</code>
                  <form method="POST" action="?/revoke_user_invite" use:enhance={withFeedback}>
                    <input type="hidden" name="invite_id" value={invite.id} />
                    <button type="submit" class="text-action warn-text">Revoke</button>
                  </form>
                </div>
              {/each}
            {/if}
          </div>

          {#if usedInvites.length > 0}
            <details class="used-invites">
              <summary>Used invites ({usedInvites.length})</summary>
              <div class="used-list">
                {#each usedInvites as invite}
                  <div>
                    <strong>{invite.email}</strong>
                    <span>Used {formatDate(invite.used_at)}</span>
                  </div>
                {/each}
              </div>
            </details>
          {/if}
        </section>

        <section class="side-section attention-section">
          <header class="side-head">
            <div>
              <span class="kicker">Access Review</span>
              <h2>Restricted Accounts</h2>
            </div>
            <span>{restrictedUsers.length}</span>
          </header>

          {#if restrictedUsers.length === 0}
            <p class="empty">No accounts need review.</p>
          {:else}
            <div class="restricted-list">
              {#each restrictedUsers as user}
                <div class="restricted-row">
                  <div>
                    <strong>{displayName(user)}</strong>
                    <span>{user.email}</span>
                  </div>
                  <div class="restricted-actions">
                    <a href={`/admin/users/${user.id}`} class="inline-action">Open</a>
                    <form method="POST" action="?/approve_user" use:enhance={withFeedback}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <button type="submit">Allow</button>
                    </form>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      </aside>
    </section>
  </section>
</Layout>

<style>
  .people-board {
    display: grid;
    gap: 1rem;
    margin-top: 0.65rem;
  }

  .people-hero,
  .people-workspace {
    border: 1px solid var(--surface-outline);
    border-radius: 24px;
    background: var(--surface-wash), var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  .people-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.78fr);
    gap: 1rem;
    align-items: end;
    padding: clamp(1rem, 2vw, 1.35rem);
  }

  .people-hero h2,
  .section-toolbar h2,
  .side-head h2 {
    margin: 0.18rem 0 0;
    color: var(--color-text);
    line-height: 1.1;
  }

  .people-hero h2 {
    font-size: clamp(1.45rem, 3vw, 2.1rem);
    letter-spacing: -0.045em;
  }

  .people-hero p {
    margin: 0.45rem 0 0;
    max-width: 48rem;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .kicker,
  .search-box span,
  .table-header,
  .people-metrics span {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .people-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid var(--color-divider);
    border-radius: 18px;
    overflow: hidden;
    background: color-mix(in srgb, var(--color-surface-alt) 42%, transparent);
  }

  .people-metrics div {
    display: grid;
    gap: 0.25rem;
    padding: 0.78rem;
    border-right: 1px solid var(--color-divider);
  }

  .people-metrics div:last-child {
    border-right: 0;
  }

  .people-metrics strong {
    font-size: 1.45rem;
    line-height: 1;
  }

  .people-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
    gap: 0;
    overflow: hidden;
  }

  .roster-region,
  .people-side {
    min-width: 0;
    padding: clamp(0.9rem, 1.8vw, 1.15rem);
  }

  .people-side {
    border-left: 1px solid var(--color-divider);
    display: grid;
    align-content: start;
    gap: 1rem;
    background: color-mix(in srgb, var(--color-surface-alt) 18%, transparent);
  }

  .section-toolbar,
  .side-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.9rem;
  }

  .side-head > span,
  .invite-row span,
  .restricted-row span,
  .used-list span,
  .identity-copy small,
  .department-copy,
  .empty {
    color: var(--color-text-muted);
  }

  .search-box {
    width: min(100%, 23rem);
    display: grid;
    gap: 0.3rem;
  }

  input {
    width: 100%;
    min-height: 2.45rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 0.58rem 0.72rem;
    background: var(--surface-wash), var(--color-surface-alt);
    color: var(--color-text);
    font: inherit;
    font-size: 0.84rem;
  }

  .staff-table {
    display: grid;
    border: 1px solid var(--color-divider);
    border-radius: 18px;
    overflow: hidden;
  }

  .table-header,
  .staff-row {
    display: grid;
    grid-template-columns: minmax(15rem, 1.15fr) minmax(6rem, 0.35fr) minmax(12rem, 1fr) auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.72rem 0.82rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .table-header {
    background: color-mix(in srgb, var(--color-surface-alt) 34%, transparent);
  }

  .staff-row:last-child {
    border-bottom: 0;
  }

  .staff-identity {
    display: grid;
    grid-template-columns: 2.35rem minmax(0, 1fr);
    gap: 0.65rem;
    align-items: center;
    color: inherit;
    text-decoration: none;
    min-width: 0;
  }

  .avatar {
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--color-surface-alt) 74%, var(--color-text) 10%);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    font-weight: var(--weight-bold);
  }

  .identity-copy {
    display: grid;
    gap: 0.12rem;
    min-width: 0;
  }

  .identity-copy strong,
  .identity-copy small,
  .department-copy {
    overflow-wrap: anywhere;
  }

  .role-pill {
    width: fit-content;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.25rem 0.58rem;
    background: color-mix(in srgb, var(--color-surface-alt) 42%, transparent);
    color: var(--color-text-muted);
    font-size: 0.74rem;
    font-weight: var(--weight-semibold);
  }

  .role-pill.role-admin {
    border-color: color-mix(in srgb, #60a5fa 34%, var(--color-border));
    color: #bfdbfe;
  }

  .row-actions,
  .restricted-actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  button,
  .inline-action {
    min-height: 2.25rem;
    border: 1px solid var(--color-border);
    border-radius: 11px;
    background: color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-text) 5%);
    color: var(--color-primary-contrast);
    padding: 0.48rem 0.68rem;
    font: inherit;
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }

  .warn-action {
    border-color: color-mix(in srgb, #f59e0b 38%, var(--color-border));
    color: #fcd34d;
    background: color-mix(in srgb, #78350f 28%, var(--color-surface));
  }

  .text-action {
    min-height: auto;
    border: 0;
    background: transparent;
    padding: 0;
    color: var(--color-text-muted);
  }

  .warn-text {
    color: #fcd34d;
  }

  .side-section {
    display: grid;
    gap: 0.75rem;
  }

  .invite-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
  }

  .invite-context {
    grid-column: 1 / -1;
  }

  .invite-context summary {
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.85rem;
  }

  .invite-context-grid {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-top: 0.55rem;
  }

  .invite-context-grid label {
    display: grid;
    gap: 0.25rem;
  }

  .invite-context-grid span {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .invite-list,
  .restricted-list,
  .used-list {
    display: grid;
    gap: 0.55rem;
  }

  .invite-row,
  .restricted-row,
  .used-list div {
    display: grid;
    gap: 0.48rem;
    padding: 0.72rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .invite-row div,
  .restricted-row div:first-child,
  .used-list div {
    min-width: 0;
  }

  .invite-row strong,
  .restricted-row strong,
  .used-list strong {
    display: block;
    overflow-wrap: anywhere;
  }

  code {
    color: var(--color-text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }

  .used-invites summary {
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 0.85rem;
  }

  .empty {
    margin: 0;
    padding: 0.35rem 0;
    line-height: 1.45;
  }

  .table-empty {
    padding: 0.9rem;
  }

  @media (max-width: 1080px) {
    .people-hero,
    .people-workspace {
      grid-template-columns: 1fr;
    }

    .people-side {
      border-left: 0;
      border-top: 1px solid var(--color-divider);
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 820px) {
    .section-toolbar,
    .side-head {
      align-items: stretch;
      flex-direction: column;
    }

    .search-box {
      width: 100%;
    }

    .people-side {
      grid-template-columns: 1fr;
    }

    .people-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .people-metrics div:nth-child(2) {
      border-right: 0;
    }

    .people-metrics div:nth-child(-n + 2) {
      border-bottom: 1px solid var(--color-divider);
    }

    .table-header {
      display: none;
    }

    .staff-row {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .row-actions,
    .restricted-actions {
      width: 100%;
      align-items: stretch;
    }

    .row-actions form,
    .restricted-actions form,
    .row-actions button,
    .restricted-actions button,
    .inline-action {
      width: 100%;
    }
  }

  @media (max-width: 560px) {
    .people-metrics,
    .invite-form {
      grid-template-columns: 1fr;
    }

    .invite-context-grid {
      grid-template-columns: 1fr;
    }

    .people-metrics div {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .people-metrics div:last-child {
      border-bottom: 0;
    }

    .row-actions,
    .restricted-actions {
      flex-direction: column;
    }
  }
</style>

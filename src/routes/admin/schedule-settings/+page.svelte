<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
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
    approved_departments: ScheduleDepartment[];
  };

  type RoleDefinition = {
    id: string;
    department: ScheduleDepartment;
    roleName: string;
    sortOrder: number;
  };

  export let data: {
    users: UserOption[];
    settings: {
      autofillNewWeeks: boolean;
      roleOptionsByDepartment: Record<ScheduleDepartment, string[]>;
    };
    roles: RoleDefinition[];
  };

  let newRoleDepartment: ScheduleDepartment = 'FOH';

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Schedule settings updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That schedule setting could not be saved.', 'error');
      }
    };
  };

  const userLabel = (user: UserOption) => user.display_name ?? user.email;
  const departmentSummary = (user: UserOption) =>
    user.approved_departments.length > 0 ? user.approved_departments.join(', ') : 'No departments';
  const isDepartmentApproved = (user: UserOption, department: ScheduleDepartment) =>
    user.approved_departments.includes(department);
  const rolesForDepartment = (department: ScheduleDepartment) =>
    data.roles.filter((role) => role.department === department);
</script>

<Layout>
  <PageHeader
    title="Schedule Settings"
    subtitle="Manage schedule behavior, roles, and department access."
  />

  <nav class="subnav">
    <a href="/admin">Back to Dashboard</a>
    <a href="/admin/schedule">Schedule Builder</a>
    <a href="/admin/users">Users</a>
  </nav>

  <section class="stack">
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Behavior</span>
          <h2>Autofill Schedule</h2>
        </div>
      </header>

      <p class="panel-note">
        This keeps the builder ready to fill from the previous week. When enabled, the week builder
        treats autofill as the preferred quick-start action.
      </p>

      <form method="POST" action="?/save_autofill" use:enhance={withFeedback} class="autofill-form">
        <label class="toggle-row">
          <input
            type="checkbox"
            name="autofill_new_weeks"
            value="1"
            checked={data.settings.autofillNewWeeks}
          />
          <span>Enable schedule autofill from the previous week</span>
        </label>
        <button type="submit">Save Autofill Setting</button>
      </form>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Roles</span>
          <h2>Department Roles</h2>
        </div>
      </header>

      <form method="POST" action="?/create_role" use:enhance={withFeedback} class="create-role-form">
        <label>
          <span>Department</span>
          <select name="department" bind:value={newRoleDepartment}>
            {#each scheduleDepartments as department}
              <option value={department}>{department}</option>
            {/each}
          </select>
        </label>
        <label class="role-name-field">
          <span>Role Name</span>
          <input name="role_name" placeholder="New role title" required />
        </label>
        <button type="submit">Add Role</button>
      </form>

      <div class="roles-grid">
        {#each scheduleDepartments as department}
          <article class="role-card">
            <div class="role-card-head">
              <strong>{department}</strong>
              <span>{rolesForDepartment(department).length} roles</span>
            </div>

            <div class="role-list">
              {#each rolesForDepartment(department) as role}
                <div class="role-row">
                  <span>{role.roleName}</span>
                  <form method="POST" action="?/delete_role" use:enhance={withFeedback}>
                    <input type="hidden" name="role_id" value={role.id} />
                    <button type="submit" class="danger-btn">Delete</button>
                  </form>
                </div>
              {/each}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Assignments</span>
          <h2>Employee Departments</h2>
        </div>
      </header>

      <div class="user-grid">
        {#each data.users as user}
          <article class="user-card">
            <div class="user-card-head">
              <div>
                <strong>{userLabel(user)}</strong>
                <p>{user.email}</p>
              </div>
              <span>{departmentSummary(user)}</span>
            </div>

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
          </article>
        {/each}
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

  .stack {
    display: grid;
    gap: 0.9rem;
  }

  .panel,
  .role-card,
  .user-card {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .panel,
  .role-card,
  .user-card {
    overflow: hidden;
  }

  .panel::before,
  .role-card::before,
  .user-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.9), rgba(195, 32, 43, 0.2));
  }

  .panel {
    padding: 1rem;
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    margin-bottom: 0.9rem;
  }

  .panel-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .panel-head h2 {
    margin: 0.2rem 0 0;
  }

  .panel-note {
    margin: 0 0 0.9rem;
    color: var(--color-text-muted);
    max-width: 54rem;
  }

  .autofill-form,
  .create-role-form {
    display: grid;
    gap: 0.7rem;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: var(--color-text);
  }

  .toggle-row input {
    width: auto;
  }

  .create-role-form {
    grid-template-columns: 180px minmax(0, 1fr) auto;
    align-items: end;
  }

  .create-role-form label {
    display: grid;
    gap: 0.25rem;
  }

  .create-role-form label span {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .roles-grid,
  .user-grid {
    display: grid;
    gap: 0.8rem;
  }

  .roles-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 1rem;
  }

  .role-card,
  .user-card {
    padding: 1rem;
  }

  .role-card-head,
  .user-card-head {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: start;
  }

  .role-card-head span,
  .user-card-head span,
  .user-card-head p {
    color: var(--color-text-muted);
    margin: 0.2rem 0 0;
    font-size: 0.8rem;
  }

  .role-list {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.9rem;
  }

  .role-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.03);
  }

  .department-chips {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
    margin-top: 0.9rem;
  }

  .department-chips form {
    flex: 0 0 auto;
  }

  input,
  select {
    width: 100%;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 0.42rem 0.56rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.82rem;
  }

  button {
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    min-height: 2.4rem;
    padding: 0.5rem 0.8rem;
    cursor: pointer;
    font-size: 0.78rem;
  }

  .department-chip {
    width: auto;
    min-height: 2.1rem;
    border-color: rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: var(--color-text);
    padding-inline: 0.8rem;
  }

  .department-chip.department-chip-active {
    border-color: rgba(22, 163, 74, 0.24);
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.22), rgba(22, 163, 74, 0.08));
    color: #dcfce7;
  }

  .danger-btn {
    width: auto;
    min-height: 2rem;
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
    padding-inline: 0.7rem;
  }

  @media (max-width: 1000px) {
    .roles-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .create-role-form {
      grid-template-columns: 1fr;
    }
  }
</style>

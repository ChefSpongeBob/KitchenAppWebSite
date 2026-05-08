<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { ScheduleDepartment } from '$lib/assets/schedule';
  import type { SubmitFunction } from '@sveltejs/kit';

  type RoleDefinition = {
    id: string;
    department: ScheduleDepartment;
    roleName: string;
    sortOrder: number;
  };

  export let data: {
    departments: ScheduleDepartment[];
    roles: RoleDefinition[];
  };

  let newRoleDepartment: ScheduleDepartment = data.departments[0] ?? 'FOH';

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Department roles updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That role change could not be saved.', 'error');
      }
    };
  };

  const rolesForDepartment = (department: ScheduleDepartment) =>
    data.roles.filter((role) => role.department === department);
</script>

<Layout>
  <PageHeader
    title="Department Roles"
  />

  <section class="roles-shell">
    <header class="roles-head">
      <h2>Departments</h2>
      <a href="/admin/schedule-settings">Settings</a>
    </header>

    <div class="create-row">
      <form
        method="POST"
        action="?/create_department"
        use:enhance={withFeedback}
        class="create-department-form"
      >
        <label class="role-name-field">
          <span>Department</span>
          <input name="department_name" placeholder="New department name" required />
        </label>
        <button type="submit">Add Department</button>
      </form>

      <form method="POST" action="?/create_role" use:enhance={withFeedback} class="create-role-form">
        <label>
          <span>Department</span>
          <select name="department" bind:value={newRoleDepartment}>
            {#each data.departments as department}
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
    </div>

    <div class="roles-grid">
      {#each data.departments as department}
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
</Layout>

<style>
  .roles-shell,
  .role-card {
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--color-surface) 94%, transparent);
    overflow: hidden;
  }

  .roles-shell {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }

  .roles-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
  }

  .roles-head h2 {
    margin: 0;
    font-size: 1rem;
  }

  .roles-head a {
    min-height: 2.2rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.78rem;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text);
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
  }

  .create-row {
    display: grid;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-divider);
  }

  .create-role-form {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr) auto;
    gap: 0.7rem;
    align-items: end;
  }

  .create-department-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.7rem;
    align-items: end;
  }

  .create-role-form label,
  .create-department-form label {
    display: grid;
    gap: 0.25rem;
  }

  .create-role-form label span,
  .create-department-form label span {
    color: var(--color-text-muted);
    font-size: 0.74rem;
  }

  .roles-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.8rem;
  }

  .role-card {
    padding: 0.85rem;
  }

  .role-card-head {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: start;
  }

  .role-card-head span {
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
    padding: 0.55rem 0;
    border-top: 1px solid var(--color-divider);
  }

  input,
  select {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.42rem 0.56rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.82rem;
  }

  button {
    min-height: 2.35rem;
    padding: 0.55rem 0.85rem;
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
    color: var(--color-primary-contrast);
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: var(--weight-medium);
  }

  .danger-btn {
    min-height: 2.1rem;
    padding-inline: 0.8rem;
  }

    @media (max-width: 920px) {
    .roles-grid {
      grid-template-columns: 1fr;
    }

    .create-role-form {
      grid-template-columns: 1fr;
    }

    .create-department-form {
      grid-template-columns: 1fr;
    }
  }
</style>



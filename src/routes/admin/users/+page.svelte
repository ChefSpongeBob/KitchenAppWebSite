<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import { businessRoleLabel, isBusinessAdminRole, permissionTemplateLabel } from '$lib/auth/roles';
  import type { SubmitFunction } from '@sveltejs/kit';

  type UserOption = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    permission_template: string;
    is_active: number;
    can_manage_specials: number;
    can_manage_announcements: number;
    approved_departments: string[];
  };

  export let data: {
    users: UserOption[];
  };

  let staffSearch = '';

  $: staffUsers = data.users;
  $: managerUsers = staffUsers.filter((user) => isBusinessAdminRole(user.role));
  $: filteredStaff = staffUsers.filter((user) => {
    const query = staffSearch.trim().toLowerCase();
    if (!query) return true;
    const haystack = [
      user.display_name ?? '',
      user.email,
      user.role,
      user.permission_template,
      permissionTemplateLabel(user.permission_template),
      ...user.approved_departments
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  const roleLabel = (role: string) => businessRoleLabel(role);

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
        <h2>Staff access and employee records</h2>
        <p>Manage staff profiles, schedule areas, and permissions from one cleaner roster.</p>
      </div>

      <div class="people-metrics">
        <div>
          <span>Employees</span>
          <strong>{staffUsers.length}</strong>
        </div>
        <div>
          <span>Managers</span>
          <strong>{managerUsers.length}</strong>
        </div>
        <div>
          <span>Departments</span>
          <strong>{new Set(staffUsers.flatMap((user) => user.approved_departments)).size}</strong>
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
            <span>Permissions</span>
            <span>Departments</span>
            <span>Actions</span>
          </div>

          {#if filteredStaff.length === 0}
            <p class="empty table-empty">{staffUsers.length === 0 ? 'No staff yet.' : 'No staff match that search.'}</p>
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
                <span class="access-summary">
                  <span class="role-pill" class:role-admin={isBusinessAdminRole(user.role)}>
                    {roleLabel(user.role)}
                  </span>
                  <small>{permissionTemplateLabel(user.permission_template)}</small>
                </span>
                <span class="department-copy">{departmentSummary(user)}</span>
                <div class="row-actions">
                  <a href={`/admin/users/${user.id}`} class="inline-action">Permissions</a>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
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
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .people-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.78fr);
    gap: 1rem;
    align-items: end;
    padding: clamp(1rem, 2vw, 1.35rem);
  }

  .people-hero h2,
  .section-toolbar h2 {
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    overflow: hidden;
    background: transparent;
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
    display: block;
    overflow: hidden;
  }

  .roster-region {
    min-width: 0;
    padding: clamp(0.9rem, 1.8vw, 1.15rem);
  }

  .section-toolbar {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.9rem;
  }

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
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    padding: 0.58rem 0;
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-size: 0.84rem;
  }

  .staff-table {
    display: grid;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
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
    background: transparent;
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
    border-radius: 0;
    display: grid;
    place-items: center;
    background: transparent;
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

  .access-summary {
    display: grid;
    gap: 0.18rem;
    align-content: center;
    width: fit-content;
  }

  .access-summary small {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: var(--weight-semibold);
  }

  .role-pill {
    width: fit-content;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    padding: 0.25rem 0.58rem;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.74rem;
    font-weight: var(--weight-semibold);
  }

  .role-pill.role-admin {
    border-color: color-mix(in srgb, var(--color-accent) 42%, var(--color-border));
    color: var(--color-text-soft);
  }

  .row-actions {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .inline-action {
    min-height: 2.25rem;
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
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

  .empty {
    margin: 0;
    padding: 0.35rem 0;
    line-height: 1.45;
  }

  .table-empty {
    padding: 0.9rem;
  }

  @media (max-width: 1080px) {
    .people-hero {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 820px) {
    .section-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .search-box {
      width: 100%;
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

    .row-actions {
      width: 100%;
      align-items: stretch;
    }

    .inline-action {
      width: 100%;
    }
  }

  @media (max-width: 560px) {
    .people-metrics {
      grid-template-columns: 1fr;
    }

    .people-metrics div {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .people-metrics div:last-child {
      border-bottom: 0;
    }

    .row-actions {
      flex-direction: column;
    }
  }
</style>

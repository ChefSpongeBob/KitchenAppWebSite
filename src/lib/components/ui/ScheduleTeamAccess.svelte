<script lang="ts">
  import { applyAction, enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import {
    businessAccessOptions,
    businessCapabilityOptions,
    businessRoleLabel,
    normalizeBusinessRole,
    permissionTemplateLabel,
    permissionTemplateOptions,
    type BusinessCapability,
    type BusinessCapabilityOverrides
  } from '$lib/auth/roles';
  import type { SubmitFunction } from '@sveltejs/kit';

  type TeamUser = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    permission_template: string;
    is_active: number;
    approved_departments: string[];
    capability_overrides: BusinessCapabilityOverrides;
    effective_capabilities: BusinessCapability[];
  };

  type RoleDefinition = {
    id: string;
    department: string;
    roleName: string;
    sortOrder: number;
  };

  type RoleAccess = {
    restrictToSelected: boolean;
    roleDefinitionIds: string[];
  };

  export let users: TeamUser[];
  export let departments: string[];
  export let roleDefinitions: RoleDefinition[];
  export let roleAccessByUser: Record<string, RoleAccess>;
  export let canManagePermissions: boolean;
  export let actorIsOwner: boolean;
  export let currentUserId: string | null;
  export let editableCapabilities: BusinessCapability[];

  let search = '';
  let selectedUserId = users[0]?.id ?? '';
  let roleMode = 'all';

  $: filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [
      user.display_name ?? '',
      user.email,
      businessRoleLabel(user.role),
      permissionTemplateLabel(user.permission_template),
      ...user.approved_departments
    ].join(' ').toLowerCase().includes(query);
  });
  $: if (!users.some((user) => user.id === selectedUserId)) selectedUserId = users[0]?.id ?? '';
  $: selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  $: selectedRoleAccess = selectedUser
    ? roleAccessByUser[selectedUser.id] ?? { restrictToSelected: false, roleDefinitionIds: [] }
    : { restrictToSelected: false, roleDefinitionIds: [] };
  $: if (selectedUserId) roleMode = selectedRoleAccess.restrictToSelected ? 'selected' : 'all';
  $: selectedRoleIds = new Set(selectedRoleAccess.roleDefinitionIds);
  $: selectedRoles = roleDefinitions.filter(
    (role) => selectedUser?.approved_departments.includes(role.department)
  );
  $: selectedTargetRole = normalizeBusinessRole(selectedUser?.role);
  $: canEditSelectedPermissions = Boolean(
    selectedUser &&
      canManagePermissions &&
      selectedTargetRole !== 'owner' &&
      (actorIsOwner || (selectedTargetRole !== 'manager' && selectedUser.id !== currentUserId))
  );
  $: canEditSelectedSchedule = Boolean(
    selectedUser && (actorIsOwner || (selectedTargetRole !== 'owner' && selectedTargetRole !== 'manager'))
  );

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidate('app:admin-schedule');
        pushToast(result.data?.message ?? 'Team access updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'Unable to update team access.', 'error');
      }
    };
  };

  function displayName(user: TeamUser) {
    return user.display_name?.trim() || user.email;
  }
</script>

<section class="team-access" aria-label="Schedule team and access">
  <aside class="team-roster">
    <header>
      <div><span>Team</span><strong>{users.length} employees</strong></div>
      <input bind:value={search} type="search" placeholder="Search employees" aria-label="Search employees" />
    </header>
    <div class="team-list">
      {#if filteredUsers.length === 0}
        <p>No employees match that search.</p>
      {:else}
        {#each filteredUsers as user}
          <button
            type="button"
            class:active={selectedUserId === user.id}
            on:click={() => (selectedUserId = user.id)}
          >
            <span class="avatar" aria-hidden="true">{displayName(user).charAt(0).toUpperCase()}</span>
            <span><strong>{displayName(user)}</strong><small>{businessRoleLabel(user.role)}</small></span>
          </button>
        {/each}
      {/if}
    </div>
  </aside>

  <div class="access-panel">
    {#if selectedUser}
      <header class="access-heading">
        <div>
          <span>Schedule Access</span>
          <h2>{displayName(selectedUser)}</h2>
          <p>{selectedUser.email}</p>
        </div>
        <a href={`/admin/users/${selectedUser.id}`}>Employee Record</a>
      </header>

      <div class="access-sections">
        <section>
          <header><div><span>Account</span><strong>{businessRoleLabel(selectedUser.role)}</strong></div></header>
          <form method="POST" action="?/update_permissions" use:enhance={withFeedback} class="account-form">
            <input type="hidden" name="user_id" value={selectedUser.id} />
            <label>
              <span>Access level</span>
              <select name="business_role" disabled={!canEditSelectedPermissions}>
                {#each businessAccessOptions as option}
                  <option
                    value={option.value}
                    selected={option.value === normalizeBusinessRole(selectedUser.role)}
                    disabled={!actorIsOwner && (option.value === 'manager' || option.value === 'owner')}
                  >{option.label}</option>
                {/each}
              </select>
            </label>
            <label>
              <span>Permission template</span>
              <select name="permission_template" disabled={!canEditSelectedPermissions}>
                {#each permissionTemplateOptions as option}
                  <option
                    value={option.value}
                    selected={option.value === selectedUser.permission_template}
                    disabled={!actorIsOwner && (option.value.includes('manager') || option.value === 'owner')}
                  >{option.label}</option>
                {/each}
              </select>
            </label>
            <button type="submit" disabled={!canEditSelectedPermissions}>Save Account</button>
          </form>
          {#if selectedTargetRole === 'owner'}<p class="access-note">Owner access is locked.</p>{/if}
        </section>

        <section>
          <header><div><span>App Permissions</span><strong>{selectedUser.effective_capabilities.length} enabled</strong></div></header>
          <form method="POST" action="?/update_capabilities" use:enhance={withFeedback} class="capability-form">
            <input type="hidden" name="user_id" value={selectedUser.id} />
            <div class="capability-grid">
              {#each businessCapabilityOptions as capability}
                <label>
                  <input
                    type="checkbox"
                    name="capabilities"
                    value={capability.value}
                    checked={selectedUser.effective_capabilities.includes(capability.value)}
                    disabled={!canEditSelectedPermissions || !editableCapabilities.includes(capability.value)}
                  />
                  <span>{capability.label}</span>
                </label>
              {/each}
            </div>
            <button type="submit" disabled={!canEditSelectedPermissions}>Save Permissions</button>
          </form>
        </section>

        <section>
          <header><div><span>Schedule Departments</span><strong>{selectedUser.approved_departments.length} assigned</strong></div></header>
          {#if departments.length === 0}
            <p class="access-note">Create a department in Roles &amp; Departments first.</p>
          {:else}
            <div class="department-list">
              {#each departments as department}
                {@const approved = selectedUser.approved_departments.includes(department)}
                <form method="POST" action="?/toggle_schedule_department" use:enhance={withFeedback}>
                  <input type="hidden" name="user_id" value={selectedUser.id} />
                  <input type="hidden" name="department" value={department} />
                  <button type="submit" class:active={approved} aria-pressed={approved} disabled={!canEditSelectedSchedule}>
                    {department}<small>{approved ? 'Assigned' : 'Not assigned'}</small>
                  </button>
                </form>
              {/each}
            </div>
          {/if}
        </section>

        <section>
          <header><div><span>Schedule Roles</span><strong>{selectedRoleAccess.restrictToSelected ? `${selectedRoleIds.size} selected` : 'All assigned'}</strong></div></header>
          <form method="POST" action="?/save_schedule_roles" use:enhance={withFeedback} class="role-access-form">
            <input type="hidden" name="user_id" value={selectedUser.id} />
            <label class="role-mode">
              <span>Role access</span>
              <select bind:value={roleMode} disabled={!canEditSelectedSchedule}>
                <option value="all">All roles in assigned departments</option>
                <option value="selected">Only selected roles</option>
              </select>
              <input type="hidden" name="restrict_to_selected" value={roleMode === 'selected' ? '1' : '0'} />
            </label>
            {#if selectedRoles.length > 0}
              <div class="role-grid">
                {#each selectedRoles as role}
                  <label>
                    <input
                      type="checkbox"
                      name="role_ids"
                      value={role.id}
                      checked={selectedRoleIds.has(role.id)}
                      disabled={!canEditSelectedSchedule || roleMode !== 'selected'}
                    />
                    <span><strong>{role.roleName}</strong><small>{role.department}</small></span>
                  </label>
                {/each}
              </div>
            {:else}
              <p class="access-note">Assign a department with active roles first.</p>
            {/if}
            <button type="submit" disabled={!canEditSelectedSchedule}>Save Schedule Roles</button>
          </form>
        </section>
      </div>
    {:else}
      <p class="access-note">No employees are available in your schedule scope.</p>
    {/if}
  </div>
</section>

<style>
  .team-access { display: grid; grid-template-columns: minmax(15rem, 0.34fr) minmax(0, 1fr); min-height: 34rem; border-top: 1px solid var(--color-divider); }
  .team-roster { min-width: 0; padding-right: 1rem; border-right: 1px solid var(--color-divider); }
  .team-roster > header { display: grid; gap: 0.7rem; padding: 1rem 0; }
  .team-roster header div, .access-sections section > header div { display: flex; justify-content: space-between; gap: 1rem; }
  .team-roster header span, .access-heading span, .access-sections header span, label > span { color: var(--color-text-muted); font-size: 0.68rem; font-weight: var(--weight-bold); letter-spacing: 0.07em; text-transform: uppercase; }
  input[type='search'], select { width: 100%; min-height: 2.45rem; padding: 0.45rem 0; border: 0; border-bottom: 1px solid var(--color-divider-strong); border-radius: 0; background: transparent; color: var(--color-text); font: inherit; }
  .team-list { display: grid; }
  .team-list > p, .access-note { color: var(--color-text-muted); font-size: 0.8rem; }
  .team-list button { display: grid; grid-template-columns: 2rem minmax(0, 1fr); align-items: center; gap: 0.65rem; width: 100%; padding: 0.7rem 0.2rem; border: 0; border-bottom: 1px solid var(--color-divider); border-radius: 0; background: transparent; color: var(--color-text); text-align: left; cursor: pointer; }
  .team-list button.active { font-weight: var(--weight-bold); background: linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 78%); }
  .team-list button > span:last-child { display: grid; min-width: 0; }
  .team-list small { color: var(--color-text-muted); }
  .avatar { display: grid; width: 2rem; height: 2rem; place-items: center; border: 1px solid var(--color-divider-strong); border-radius: 50%; font-size: 0.72rem; }
  .access-panel { min-width: 0; padding-left: 1.25rem; }
  .access-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--color-divider); }
  .access-heading h2, .access-heading p { margin: 0; }
  .access-heading h2 { font-size: 1.35rem; }
  .access-heading p { color: var(--color-text-muted); font-size: 0.8rem; }
  .access-heading a, form > button { padding: 0.25rem 0; border: 0; border-bottom: 1px solid currentColor; border-radius: 0; background: transparent; color: var(--color-text); font: inherit; font-size: 0.72rem; font-weight: var(--weight-bold); text-decoration: none; text-transform: uppercase; cursor: pointer; }
  form > button:disabled { opacity: 0.42; cursor: not-allowed; }
  .access-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 1.5rem; }
  .access-sections > section { min-width: 0; padding: 1rem 0 1.2rem; border-bottom: 1px solid var(--color-divider); }
  .account-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) auto; align-items: end; gap: 0.8rem; margin-top: 0.75rem; }
  .account-form label, .role-mode { display: grid; gap: 0.2rem; }
  .capability-form, .role-access-form { display: grid; gap: 0.75rem; margin-top: 0.75rem; }
  .capability-grid, .role-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.2rem 0.8rem; }
  .capability-grid label, .role-grid label { display: flex; align-items: center; gap: 0.5rem; min-height: 2rem; font-size: 0.76rem; }
  .capability-grid input, .role-grid input { accent-color: var(--color-accent); }
  .role-grid label > span { display: grid; color: var(--color-text); letter-spacing: 0; text-transform: none; }
  .role-grid small { color: var(--color-text-muted); font-weight: var(--weight-regular); }
  .department-list { display: flex; flex-wrap: wrap; gap: 0.65rem; padding-top: 0.75rem; }
  .department-list form { margin: 0; }
  .department-list button { display: grid; gap: 0.05rem; padding: 0.35rem 0; border: 0; border-bottom: 1px solid var(--color-divider-strong); border-radius: 0; background: transparent; color: var(--color-text-muted); font: inherit; text-align: left; cursor: pointer; }
  .department-list button.active { border-bottom-width: 2px; color: var(--color-text); font-weight: var(--weight-bold); }
  .department-list small { font-size: 0.62rem; font-weight: var(--weight-regular); }
  @media (max-width: 900px) {
    .team-access, .access-sections { grid-template-columns: 1fr; }
    .team-roster { padding-right: 0; border-right: 0; border-bottom: 1px solid var(--color-divider); }
    .team-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .access-panel { padding-left: 0; }
  }
  @media (max-width: 620px) {
    .team-list, .capability-grid, .role-grid, .account-form { grid-template-columns: 1fr; }
    .access-heading { align-items: start; flex-direction: column; }
  }
</style>

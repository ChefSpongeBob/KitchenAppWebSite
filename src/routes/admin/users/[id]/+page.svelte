<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { ScheduleDepartment } from '$lib/assets/schedule';
  import type { SubmitFunction } from '@sveltejs/kit';

  type Employee = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    is_active: number;
    can_manage_specials: number;
    approved_departments: ScheduleDepartment[];
  };

  type EmployeeProfile = {
    user_id: string;
    phone: string;
    birthday: string;
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    postal_code: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relationship: string;
  };

  export let data: {
    employee: Employee;
    profile: EmployeeProfile;
    departments: ScheduleDepartment[];
  };

  const departmentSummary = (employee: Employee) =>
    employee.approved_departments.length > 0
      ? employee.approved_departments.join(', ')
      : 'No schedule departments';

  const isDepartmentApproved = (employee: Employee, department: ScheduleDepartment) =>
    employee.approved_departments.includes(department);

  const formatBirthday = (value: string) =>
    value ? new Date(`${value}T00:00:00`).toLocaleDateString() : 'Not set';

  const addressSummary = (profile: EmployeeProfile) => {
    const parts = [
      profile.address_line_1,
      profile.address_line_2,
      [profile.city, profile.state].filter(Boolean).join(', '),
      profile.postal_code
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' | ') : 'No address on file';
  };

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Employee access updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That employee update could not be saved.', 'error');
      }
    };
  };
</script>

<Layout>
  <PageHeader
    title={data.employee.display_name ?? 'Unnamed Employee'}
  />

  <section class="profile-header">
    <div class="profile-identity">
      <div class="profile-avatar" aria-hidden="true">
        {(data.employee.display_name ?? data.employee.email).trim().charAt(0).toUpperCase()}
      </div>
      <div class="profile-copy">
        <span class="eyebrow">Employee Profile</span>
        <h2>{data.employee.display_name ?? 'Unnamed Employee'}</h2>
        <p>{data.employee.email}</p>
      </div>
    </div>

    <div class="profile-meta">
      <div class="meta-item">
        <span>Status</span>
        <strong>{data.employee.is_active === 1 ? 'Active' : 'Restricted'}</strong>
      </div>
      <div class="meta-item">
        <span>Role</span>
        <strong>{data.employee.role === 'admin' ? 'Admin' : 'Staff'}</strong>
      </div>
      <div class="meta-item">
        <span>Departments</span>
        <strong>{departmentSummary(data.employee)}</strong>
      </div>
      <div class="meta-item">
        <span>Birthday</span>
        <strong>{formatBirthday(data.profile.birthday)}</strong>
      </div>
    </div>
  </section>

  <section class="stack">
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Profile</span>
          <h2>Employee Information</h2>
        </div>
      </header>

      <p class="panel-note">
        Store contact and personal details here so employee records stay in one secure admin-only place.
      </p>

      <form method="POST" action="?/save_profile" use:enhance={withFeedback} class="profile-form">
        <input type="hidden" name="user_id" value={data.employee.id} />

        <div class="field-grid">
          <label>
            <span>Phone</span>
            <input
              name="phone"
              type="tel"
              value={data.profile.phone}
              placeholder="(555) 555-5555"
            />
          </label>
          <label>
            <span>Birthday</span>
            <input name="birthday" type="date" value={data.profile.birthday} />
          </label>
        </div>

        <div class="field-grid">
          <label class="field-wide">
            <span>Address Line 1</span>
            <input
              name="address_line_1"
              value={data.profile.address_line_1}
              placeholder="Street address"
            />
          </label>
          <label class="field-wide">
            <span>Address Line 2</span>
            <input
              name="address_line_2"
              value={data.profile.address_line_2}
              placeholder="Apartment, suite, etc."
            />
          </label>
        </div>

        <div class="field-grid field-grid-three">
          <label>
            <span>City</span>
            <input name="city" value={data.profile.city} />
          </label>
          <label>
            <span>State</span>
            <input name="state" value={data.profile.state} />
          </label>
          <label>
            <span>Postal Code</span>
            <input name="postal_code" value={data.profile.postal_code} />
          </label>
        </div>

        <div class="field-grid field-grid-three">
          <label>
            <span>Emergency Contact</span>
            <input
              name="emergency_contact_name"
              value={data.profile.emergency_contact_name}
              placeholder="Full name"
            />
          </label>
          <label>
            <span>Emergency Phone</span>
            <input
              name="emergency_contact_phone"
              type="tel"
              value={data.profile.emergency_contact_phone}
              placeholder="(555) 555-5555"
            />
          </label>
          <label>
            <span>Relationship</span>
            <input
              name="emergency_contact_relationship"
              value={data.profile.emergency_contact_relationship}
              placeholder="Parent, partner, friend"
            />
          </label>
        </div>

        <div class="profile-foot">
          <div class="profile-summary">
            <strong>Address on File</strong>
            <span>{addressSummary(data.profile)}</span>
          </div>
          <button type="submit">Save Profile</button>
        </div>
      </form>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Schedule</span>
          <h2>Departments</h2>
        </div>
      </header>

      <p class="panel-note">
        Use schedule departments to control which sections this employee can view and work within in the schedule system.
      </p>

      <div class="department-chips">
        {#each data.departments as department}
          <form method="POST" action="?/toggle_schedule_department" use:enhance={withFeedback}>
            <input type="hidden" name="user_id" value={data.employee.id} />
            <input type="hidden" name="department" value={department} />
            <button
              type="submit"
              class="department-chip"
              class:department-chip-active={isDepartmentApproved(data.employee, department)}
            >
              {department}
            </button>
          </form>
        {/each}
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Permissions</span>
          <h2>Access Controls</h2>
        </div>
      </header>

      <div class="action-grid">
        {#if data.employee.is_active === 1}
          <form method="POST" action="?/deny_user" use:enhance={withFeedback}>
            <input type="hidden" name="user_id" value={data.employee.id} />
            <button type="submit" class="warn-action">Restrict Access</button>
          </form>
        {:else}
          <form method="POST" action="?/approve_user" use:enhance={withFeedback}>
            <input type="hidden" name="user_id" value={data.employee.id} />
            <button type="submit">Allow Access</button>
          </form>
        {/if}

        {#if data.employee.role !== 'admin'}
          <form method="POST" action="?/make_user_admin" use:enhance={withFeedback}>
            <input type="hidden" name="user_id" value={data.employee.id} />
            <button type="submit">Make Admin</button>
          </form>
        {/if}

        <form method="POST" action="?/toggle_specials_access" use:enhance={withFeedback}>
          <input type="hidden" name="user_id" value={data.employee.id} />
          <button
            type="submit"
            class:success-action={data.employee.can_manage_specials === 1 || data.employee.role === 'admin'}
          >
            {data.employee.can_manage_specials === 1 || data.employee.role === 'admin'
              ? 'Specials Allowed'
              : 'Grant Specials'}
          </button>
        </form>

        <form method="POST" action="?/delete_user" use:enhance={withFeedback}>
          <input type="hidden" name="user_id" value={data.employee.id} />
          <button type="submit" class="danger-action">Delete Employee</button>
        </form>
      </div>
    </section>
  </section>
</Layout>

<style>
  .profile-header,
  .panel {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
    overflow: hidden;
  }

  .profile-header::before,
  .panel::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.9), rgba(132, 146, 166, 0.2));
  }

  .profile-header {
    padding: 1rem;
    display: grid;
    gap: 1rem;
    margin: 0.5rem 0 1rem;
  }

  .profile-identity {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .profile-avatar {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 1.55rem;
    font-weight: 700;
    color: var(--color-primary-contrast);
    border: 1px solid rgba(132, 146, 166, 0.24);
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .profile-copy h2 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.4rem, 2vw, 1.9rem);
    line-height: 1.05;
  }

  .profile-copy p {
    margin: 0.35rem 0 0;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  .profile-meta {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .meta-item {
    display: grid;
    gap: 0.2rem;
  }

  .meta-item span {
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  .meta-item strong {
    font-size: 0.98rem;
    line-height: 1.3;
  }

  .eyebrow,
  .panel-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .stack {
    display: grid;
    gap: 0.9rem;
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

  .panel-head h2 {
    margin: 0.2rem 0 0;
  }

  .panel-note {
    margin: 0 0 0.9rem;
    color: var(--color-text-muted);
    max-width: 46rem;
  }

  .profile-form {
    display: grid;
    gap: 0.9rem;
  }

  .field-grid {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-grid-three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .field-wide {
    grid-column: span 1;
  }

  label {
    display: grid;
    gap: 0.35rem;
  }

  label span {
    font-size: 0.76rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  input {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.55rem 0.68rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.84rem;
  }

  .profile-foot {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 0.2rem;
  }

  .profile-summary {
    display: grid;
    gap: 0.2rem;
  }

  .profile-summary span {
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .department-chips {
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
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

  .action-grid {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  button {
    width: 100%;
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
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

  .success-action {
    border-color: rgba(22, 163, 74, 0.32);
    color: #bbf7d0;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.34), rgba(22, 163, 74, 0.12));
  }

  .danger-action {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
  }

  @media (max-width: 780px) {
    .profile-meta,
    .action-grid,
    .field-grid,
    .field-grid-three {
      grid-template-columns: 1fr;
    }

    .profile-identity {
      align-items: flex-start;
    }

    .profile-foot {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>


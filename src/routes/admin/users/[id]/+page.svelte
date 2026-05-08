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

  type EmployeeOnboardingPackage = {
    id: string;
    status: 'sent' | 'in_progress' | 'submitted' | 'approved';
    payroll_classification: 'employee' | 'contractor';
    sent_at: number;
    completed_at: number | null;
    approved_at: number | null;
  };

  type EmployeeOnboardingItem = {
    id: string;
    item_type: 'form' | 'document' | 'acknowledgement';
    form_key: string;
    title: string;
    description: string;
    status: 'pending' | 'submitted' | 'approved' | 'needs_changes';
    file_url: string;
    file_name: string;
    form_payload: string;
    source_file_url: string;
    source_file_name: string;
    signed_name: string;
    manager_note: string;
    submitted_at: number | null;
  };

  type SessionSummary = {
    id: string;
    lastSeenAt: number;
    expiresAt: number;
    revokedAt: number | null;
    current: boolean;
  };

  export let data: {
    employee: Employee;
    profile: EmployeeProfile;
    onboarding: {
      package: EmployeeOnboardingPackage | null;
      items: EmployeeOnboardingItem[];
    };
    sessions: SessionSummary[];
    departments: ScheduleDepartment[];
  };

  const displayName = (employee: Employee) => employee.display_name?.trim() || 'Unnamed Employee';

  const initialsFor = (employee: Employee) => {
    const source = displayName(employee) === 'Unnamed Employee' ? employee.email : displayName(employee);
    return source.trim().charAt(0).toUpperCase();
  };

  const departmentSummary = (employee: Employee) =>
    employee.approved_departments.length > 0
      ? employee.approved_departments.join(', ')
      : 'No schedule departments';

  const isDepartmentApproved = (employee: Employee, department: ScheduleDepartment) =>
    employee.approved_departments.includes(department);

  const formatBirthday = (value: string) =>
    value ? new Date(`${value}T00:00:00`).toLocaleDateString() : 'Not set';

  const formatDateTime = (value: number | null) =>
    value ? new Date(value * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

  const formatOnboardingStatus = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formLabelMap: Record<string, string> = {
    legal_name: 'Legal name',
    preferred_name: 'Preferred name',
    birthday: 'Birthday',
    phone: 'Phone',
    address_line_1: 'Address line 1',
    address_line_2: 'Address line 2',
    city: 'City',
    state: 'State',
    postal_code: 'Postal code',
    emergency_contact_name: 'Emergency contact',
    emergency_contact_phone: 'Emergency phone',
    emergency_contact_relationship: 'Relationship',
    worker_classification: 'Classification',
    start_date: 'Start date',
    pay_type: 'Pay type',
    direct_deposit_authorized: 'Direct deposit',
    bank_name: 'Bank name',
    routing_last_four: 'Routing last four',
    account_last_four: 'Account last four'
  };

  function payloadEntries(item: EmployeeOnboardingItem) {
    try {
      const payload = JSON.parse(item.form_payload || '{}') as Record<string, string>;
      return Object.entries(payload).filter(([, value]) => Boolean(value));
    } catch {
      return [];
    }
  }

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

  $: onboardingApprovedCount = data.onboarding.items.filter((item) => item.status === 'approved').length;
  $: onboardingSubmittedCount = data.onboarding.items.filter(
    (item) => item.status === 'submitted' || item.status === 'approved'
  ).length;
  $: needsOnboardingReview = data.onboarding.items.filter(
    (item) => item.status === 'submitted' || item.status === 'needs_changes'
  ).length;
  $: activeSessionCount = data.sessions.filter((session) => !session.revokedAt).length;
</script>

<Layout>
  <PageHeader title={displayName(data.employee)} />

  <section class="employee-shell">
    <section class="employee-hero">
      <div class="employee-identity">
        <span class="profile-avatar" aria-hidden="true">{initialsFor(data.employee)}</span>
        <div>
          <span class="kicker">Employee Profile</span>
          <h2>{displayName(data.employee)}</h2>
          <p>{data.employee.email}</p>
        </div>
      </div>

      <div class="employee-metrics">
        <div>
          <span>Status</span>
          <strong>{data.employee.is_active === 1 ? 'Active' : 'Restricted'}</strong>
        </div>
        <div>
          <span>Role</span>
          <strong>{data.employee.role === 'admin' ? 'Admin' : 'Staff'}</strong>
        </div>
        <div>
          <span>Departments</span>
          <strong>{data.employee.approved_departments.length}</strong>
        </div>
        <div>
          <span>Review</span>
          <strong>{needsOnboardingReview}</strong>
        </div>
      </div>
    </section>

    <section class="employee-grid">
      <aside class="profile-side" aria-label="Employee access controls">
        <section class="side-section">
          <span class="kicker">Snapshot</span>
          <div class="snapshot-list">
            <div>
              <span>Birthday</span>
              <strong>{formatBirthday(data.profile.birthday)}</strong>
            </div>
            <div>
              <span>Phone</span>
              <strong>{data.profile.phone || 'Not set'}</strong>
            </div>
            <div>
              <span>Emergency</span>
              <strong>{data.profile.emergency_contact_name || 'Not set'}</strong>
            </div>
            <div>
              <span>Schedule Areas</span>
              <strong>{departmentSummary(data.employee)}</strong>
            </div>
          </div>
        </section>

        <section class="side-section">
          <span class="kicker">Access Controls</span>
          <div class="action-stack">
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

            <form method="POST" action="?/revoke_employee_sessions" use:enhance={withFeedback}>
              <input type="hidden" name="user_id" value={data.employee.id} />
              <button type="submit" class="warn-action">Revoke Sessions ({activeSessionCount})</button>
            </form>

            <form method="POST" action="?/delete_user" use:enhance={withFeedback}>
              <input type="hidden" name="user_id" value={data.employee.id} />
              <button type="submit" class="danger-action">Delete Employee</button>
            </form>
          </div>
        </section>

        <section class="side-section">
          <span class="kicker">Schedule Departments</span>
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
      </aside>

      <div class="profile-main">
        <section class="workspace-section">
          <header class="section-head">
            <div>
              <span class="kicker">Employee Record</span>
              <h2>Contact and emergency information</h2>
            </div>
            <span class="address-chip">{addressSummary(data.profile)}</span>
          </header>

          <form method="POST" action="?/save_profile" use:enhance={withFeedback} class="profile-form">
            <input type="hidden" name="user_id" value={data.employee.id} />

            <div class="field-grid two">
              <label>
                <span>Phone</span>
                <input name="phone" type="tel" value={data.profile.phone} placeholder="(555) 555-5555" />
              </label>
              <label>
                <span>Birthday</span>
                <input name="birthday" type="date" value={data.profile.birthday} />
              </label>
            </div>

            <div class="field-grid two">
              <label>
                <span>Address Line 1</span>
                <input name="address_line_1" value={data.profile.address_line_1} placeholder="Street address" />
              </label>
              <label>
                <span>Address Line 2</span>
                <input name="address_line_2" value={data.profile.address_line_2} placeholder="Apartment, suite, etc." />
              </label>
            </div>

            <div class="field-grid three">
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

            <div class="field-grid three">
              <label>
                <span>Emergency Contact</span>
                <input name="emergency_contact_name" value={data.profile.emergency_contact_name} placeholder="Full name" />
              </label>
              <label>
                <span>Emergency Phone</span>
                <input name="emergency_contact_phone" type="tel" value={data.profile.emergency_contact_phone} placeholder="(555) 555-5555" />
              </label>
              <label>
                <span>Relationship</span>
                <input name="emergency_contact_relationship" value={data.profile.emergency_contact_relationship} placeholder="Parent, partner, friend" />
              </label>
            </div>

            <div class="form-actions">
              <span>Changes save to this employee record only.</span>
              <button type="submit">Save Profile</button>
            </div>
          </form>
        </section>

        <section class="workspace-section onboarding-review">
          <header class="section-head">
            <div>
              <span class="kicker">Onboarding Review</span>
              <h2>Packet status</h2>
            </div>
            {#if data.onboarding.package}
              <span class={`status-pill status-pill-${data.onboarding.package.status}`}>
                {formatOnboardingStatus(data.onboarding.package.status)}
              </span>
            {/if}
          </header>

          {#if !data.onboarding.package}
            <p class="section-note">Send an onboarding package when this employee is ready to complete required forms and acknowledgements.</p>
            <form method="POST" action="?/send_onboarding_package" use:enhance={withFeedback} class="send-onboarding">
              <input type="hidden" name="user_id" value={data.employee.id} />
              <label>
                <span>Classification</span>
                <select name="payroll_classification">
                  <option value="employee">Employee</option>
                  <option value="contractor">Contractor</option>
                </select>
              </label>
              <button type="submit">Send Onboarding</button>
            </form>
          {:else}
            <div class="onboarding-summary">
              <div>
                <span>Sent</span>
                <strong>{formatDateTime(data.onboarding.package.sent_at)}</strong>
              </div>
              <div>
                <span>Completed</span>
                <strong>{onboardingSubmittedCount} / {data.onboarding.items.length}</strong>
              </div>
              <div>
                <span>Approved</span>
                <strong>{onboardingApprovedCount} / {data.onboarding.items.length}</strong>
              </div>
            </div>

            <div class="onboarding-list">
              {#each data.onboarding.items as item}
                <article class="onboarding-item" class:item-approved={item.status === 'approved'}>
                  <div class="onboarding-item-main">
                    <div>
                      <span class="item-type">{formatOnboardingStatus(item.item_type)}</span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    <span class={`status-pill status-pill-${item.status}`}>{formatOnboardingStatus(item.status)}</span>
                  </div>

                  <div class="onboarding-evidence">
                    {#if item.source_file_url}
                      <a href={item.source_file_url} target="_blank" rel="noreferrer">
                        {item.source_file_name || 'View packet document'}
                      </a>
                    {/if}
                    {#if item.file_url}
                      <a href={item.file_url} target="_blank" rel="noreferrer">View upload</a>
                      <span>{item.file_name || 'Uploaded document'}</span>
                    {:else if item.item_type === 'form' && payloadEntries(item).length > 0}
                      <span>Form submitted</span>
                      <span>{payloadEntries(item).length} fields</span>
                    {:else if item.signed_name}
                      <span>Signed by {item.signed_name}</span>
                    {:else}
                      <span>No submission yet</span>
                    {/if}
                    {#if item.submitted_at}
                      <span>{formatDateTime(item.submitted_at)}</span>
                    {/if}
                  </div>

                  {#if item.manager_note}
                    <p class="manager-note">{item.manager_note}</p>
                  {/if}

                  {#if item.item_type === 'form' && payloadEntries(item).length > 0}
                    <dl class="onboarding-form-review">
                      {#each payloadEntries(item) as [key, value]}
                        <div>
                          <dt>{formLabelMap[key] ?? formatOnboardingStatus(key)}</dt>
                          <dd>{value}</dd>
                        </div>
                      {/each}
                    </dl>
                  {/if}

                  {#if item.status === 'submitted'}
                    <div class="review-actions">
                      <form method="POST" action="?/approve_onboarding_item" use:enhance={withFeedback}>
                        <input type="hidden" name="item_id" value={item.id} />
                        <button type="submit" class="success-action">Approve</button>
                      </form>
                      <form method="POST" action="?/request_onboarding_changes" use:enhance={withFeedback}>
                        <input type="hidden" name="item_id" value={item.id} />
                        <input name="manager_note" placeholder="What needs to change?" />
                        <button type="submit" class="warn-action">Request Changes</button>
                      </form>
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          {/if}
        </section>
      </div>
    </section>
  </section>
</Layout>

<style>
  .employee-shell {
    display: grid;
    gap: 1rem;
    margin-top: 0.65rem;
  }

  .employee-hero,
  .employee-grid {
    border: 1px solid var(--surface-outline);
    border-radius: 24px;
    background: var(--surface-wash), var(--color-surface);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .employee-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.78fr);
    gap: 1rem;
    align-items: end;
    padding: clamp(1rem, 2vw, 1.35rem);
  }

  .employee-identity {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    min-width: 0;
  }

  .profile-avatar {
    width: 4rem;
    height: 4rem;
    border: 1px solid var(--color-border);
    border-radius: 18px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--color-surface-alt) 78%, var(--color-text) 12%);
    color: var(--color-text);
    font-size: 1.5rem;
    font-weight: var(--weight-bold);
    flex: 0 0 auto;
  }

  .employee-identity h2,
  .section-head h2 {
    margin: 0.18rem 0 0;
    color: var(--color-text);
    line-height: 1.1;
  }

  .employee-identity h2 {
    font-size: clamp(1.45rem, 3vw, 2.05rem);
    letter-spacing: -0.045em;
  }

  .employee-identity p {
    margin: 0.38rem 0 0;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  .kicker,
  label span,
  .employee-metrics span,
  .snapshot-list span,
  .onboarding-summary span,
  .item-type,
  .onboarding-evidence,
  .form-actions span {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .employee-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid var(--color-divider);
    border-radius: 18px;
    overflow: hidden;
    background: color-mix(in srgb, var(--color-surface-alt) 42%, transparent);
  }

  .employee-metrics div {
    display: grid;
    gap: 0.25rem;
    padding: 0.78rem;
    border-right: 1px solid var(--color-divider);
  }

  .employee-metrics div:last-child {
    border-right: 0;
  }

  .employee-metrics strong {
    font-size: 1.15rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .employee-grid {
    display: grid;
    grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr);
  }

  .profile-side {
    display: grid;
    align-content: start;
    gap: 1.1rem;
    padding: clamp(0.9rem, 1.8vw, 1.15rem);
    border-right: 1px solid var(--color-divider);
    background: color-mix(in srgb, var(--color-surface-alt) 18%, transparent);
  }

  .side-section {
    display: grid;
    gap: 0.75rem;
  }

  .snapshot-list {
    display: grid;
    border: 1px solid var(--color-divider);
    border-radius: 18px;
    overflow: hidden;
  }

  .snapshot-list div {
    display: grid;
    gap: 0.18rem;
    padding: 0.72rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .snapshot-list div:last-child {
    border-bottom: 0;
  }

  .snapshot-list strong {
    color: var(--color-text);
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .action-stack {
    display: grid;
    gap: 0.55rem;
  }

  .department-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .profile-main {
    min-width: 0;
    display: grid;
  }

  .workspace-section {
    padding: clamp(0.95rem, 2vw, 1.2rem);
    border-bottom: 1px solid var(--color-divider);
  }

  .workspace-section:last-child {
    border-bottom: 0;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 1rem;
    margin-bottom: 0.9rem;
  }

  .address-chip {
    max-width: min(100%, 24rem);
    border: 1px solid var(--color-divider);
    border-radius: 999px;
    padding: 0.36rem 0.68rem;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }

  .profile-form {
    display: grid;
    gap: 0.85rem;
  }

  .field-grid {
    display: grid;
    gap: 0.75rem;
  }

  .field-grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-grid.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  label {
    display: grid;
    gap: 0.35rem;
  }

  input,
  select {
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

  .form-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 0.15rem;
  }

  button {
    width: 100%;
    min-height: 2.45rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-text) 5%);
    color: var(--color-primary-contrast);
    padding: 0.55rem 0.78rem;
    font: inherit;
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
    cursor: pointer;
  }

  .form-actions button,
  .send-onboarding button {
    width: auto;
    min-width: 10rem;
  }

  .warn-action {
    border-color: color-mix(in srgb, #f59e0b 38%, var(--color-border));
    color: #fcd34d;
    background: color-mix(in srgb, #78350f 28%, var(--color-surface));
  }

  .success-action,
  .department-chip.department-chip-active {
    border-color: color-mix(in srgb, #16a34a 40%, var(--color-border));
    color: #bbf7d0;
    background: color-mix(in srgb, #16a34a 18%, transparent);
  }

  .danger-action {
    border-color: color-mix(in srgb, #ef4444 36%, var(--color-border));
    color: #ffb6b6;
    background: color-mix(in srgb, #7f1d1d 32%, var(--color-surface));
  }

  .department-chip {
    width: auto;
    min-height: 2.1rem;
    padding-inline: 0.72rem;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-surface-alt) 38%, transparent);
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    min-height: 1.8rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    color: var(--color-text-muted);
    background: color-mix(in srgb, var(--color-surface-alt) 44%, transparent);
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .status-pill-approved {
    border-color: color-mix(in srgb, #16a34a 38%, var(--color-border));
    color: #bbf7d0;
    background: color-mix(in srgb, #16a34a 14%, transparent);
  }

  .status-pill-submitted,
  .status-pill-in_progress {
    border-color: color-mix(in srgb, #3b82f6 34%, var(--color-border));
    color: #bfdbfe;
    background: color-mix(in srgb, #3b82f6 14%, transparent);
  }

  .status-pill-needs_changes {
    border-color: color-mix(in srgb, #f59e0b 38%, var(--color-border));
    color: #fcd34d;
    background: color-mix(in srgb, #f59e0b 14%, transparent);
  }

  .section-note {
    margin: 0 0 0.9rem;
    color: var(--color-text-muted);
    line-height: 1.5;
  }

  .send-onboarding {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) auto;
    gap: 0.75rem;
    align-items: end;
  }

  .onboarding-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border: 1px solid var(--color-divider);
    border-radius: 18px;
    overflow: hidden;
    margin-bottom: 0.85rem;
  }

  .onboarding-summary div {
    display: grid;
    gap: 0.2rem;
    padding: 0.72rem;
    border-right: 1px solid var(--color-divider);
  }

  .onboarding-summary div:last-child {
    border-right: 0;
  }

  .onboarding-list {
    display: grid;
    gap: 0.65rem;
  }

  .onboarding-item {
    display: grid;
    gap: 0.7rem;
    padding: 0.85rem;
    border: 1px solid var(--color-divider);
    border-radius: 16px;
    background: color-mix(in srgb, var(--color-surface-alt) 28%, transparent);
  }

  .onboarding-item.item-approved {
    border-color: color-mix(in srgb, #16a34a 30%, var(--color-border));
  }

  .onboarding-item-main {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }

  .onboarding-item h3 {
    margin: 0.18rem 0;
    font-size: 1rem;
  }

  .onboarding-item p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.45;
  }

  .onboarding-evidence {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .onboarding-evidence a {
    color: var(--color-primary-contrast);
    text-decoration: none;
  }

  .onboarding-form-review {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin: 0;
  }

  .onboarding-form-review div {
    display: grid;
    gap: 0.16rem;
    padding: 0.55rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .onboarding-form-review dt {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .onboarding-form-review dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .manager-note {
    padding: 0.7rem;
    border-radius: 12px;
    background: color-mix(in srgb, #f59e0b 12%, transparent);
  }

  .review-actions {
    display: grid;
    gap: 0.65rem;
    grid-template-columns: minmax(8rem, 0.35fr) minmax(14rem, 1fr);
  }

  .review-actions form {
    display: flex;
    gap: 0.55rem;
  }

  @media (max-width: 1080px) {
    .employee-hero,
    .employee-grid {
      grid-template-columns: 1fr;
    }

    .profile-side {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 860px) {
    .profile-side,
    .employee-metrics,
    .field-grid.two,
    .field-grid.three,
    .onboarding-summary,
    .review-actions,
    .onboarding-form-review,
    .send-onboarding {
      grid-template-columns: 1fr;
    }

    .employee-metrics div {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .employee-metrics div:last-child {
      border-bottom: 0;
    }

    .section-head,
    .form-actions,
    .onboarding-item-main {
      align-items: stretch;
      flex-direction: column;
    }

    .form-actions button,
    .send-onboarding button,
    .review-actions form,
    .review-actions button {
      width: 100%;
    }

    .review-actions form {
      flex-direction: column;
    }
  }

  @media (max-width: 560px) {
    .employee-identity {
      align-items: flex-start;
      flex-direction: column;
    }

    .profile-avatar {
      width: 3.35rem;
      height: 3.35rem;
      border-radius: 16px;
    }
  }
</style>

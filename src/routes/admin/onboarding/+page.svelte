<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import type { SubmitFunction } from '@sveltejs/kit';

  type OnboardingTemplateItem = {
    id: string;
    item_type: 'form' | 'document' | 'acknowledgement';
    form_key: string;
    title: string;
    description: string;
    source_file_url: string;
    source_file_name: string;
    sort_order: number;
    is_active: number;
  };

  type OnboardingRow = {
    user_id: string;
    display_name: string | null;
    email: string;
    role: string;
    is_active: number;
    package_id: string | null;
    package_status: 'not_sent' | 'sent' | 'in_progress' | 'submitted' | 'approved';
    payroll_classification: 'employee' | 'contractor' | null;
    sent_at: number | null;
    completed_at: number | null;
    approved_at: number | null;
    total_items: number;
    pending_items: number;
    submitted_items: number;
    approved_items: number;
    needs_changes_items: number;
  };

  type UserOption = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    is_active: number;
  };

  type InviteOption = {
    id: string;
    email: string;
    invite_code: string;
    role: string;
    permission_template: string;
    employment_type: string;
    job_title: string;
    department: string;
    primary_schedule_department: string;
    schedule_departments: string[];
    start_date: string;
    pay_type: string;
    onboarding_required: number;
    created_at: number;
    expires_at: number | null;
    used_at: number | null;
    revoked_at: number | null;
  };

  export let data: {
    templateItems: OnboardingTemplateItem[];
    onboardingRows: OnboardingRow[];
    users: UserOption[];
    invites: InviteOption[];
    departments: string[];
  };

  let feedbackMessage = '';

  $: staffUsers = data.users.filter((user) => !['owner', 'admin', 'manager'].includes(user.role));
  $: activeInvites = data.invites.filter((invite) => invite.revoked_at === null && invite.used_at === null);
  $: usedInvites = data.invites.filter((invite) => invite.used_at !== null);
  $: needsReview = data.onboardingRows.filter((row) => row.package_status === 'submitted' || row.submitted_items > 0);
  $: activeRows = data.onboardingRows.filter((row) => row.package_status === 'sent' || row.package_status === 'in_progress');
  $: completedRows = data.onboardingRows.filter((row) => row.package_status === 'approved');
  $: missingRows = data.onboardingRows.filter((row) => row.package_status === 'not_sent');
  $: packetRows = [...data.onboardingRows].sort((a, b) => statusRank(a.package_status) - statusRank(b.package_status));

  const withFeedback: SubmitFunction = () => {
    feedbackMessage = '';
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Onboarding updated.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That onboarding change could not be saved.', 'error');
      }
      feedbackMessage =
        result.type === 'success'
          ? result.data?.message ?? 'Onboarding updated.'
          : result.type === 'failure'
            ? result.data?.error ?? 'That onboarding change could not be saved.'
            : '';
    };
  };

  function statusRank(value: OnboardingRow['package_status']) {
    return { submitted: 0, in_progress: 1, sent: 2, not_sent: 3, approved: 4 }[value] ?? 5;
  }

  function formatStatus(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDate(value: number | null) {
    return value ? new Date(value * 1000).toLocaleDateString() : 'Not started';
  }

  const accessTypes = [
    { value: 'staff', label: 'Employee' },
    { value: 'admin', label: 'Admin' },
    { value: 'owner', label: 'Owner' }
  ];

  const permissionTemplates = [
    { value: 'staff', label: 'Staff' },
    { value: 'shift_lead', label: 'Shift Lead' },
    { value: 'hourly_manager', label: 'Hourly Manager' },
    { value: 'foh_manager', label: 'FOH Manager' },
    { value: 'boh_manager', label: 'BOH Manager' },
    { value: 'general_manager', label: 'General Manager' },
    { value: 'owner', label: 'Owner' }
  ];

  const labelFor = (items: Array<{ value: string; label: string }>, value: string) =>
    items.find((item) => item.value === value)?.label ?? value;

  const roleLabel = (role: string) => {
    const normalized = role.toLowerCase();
    if (normalized === 'owner') return 'Owner';
    if (normalized === 'admin' || normalized === 'manager') return 'Admin';
    return 'Employee';
  };

  const inviteDepartmentSummary = (invite: InviteOption) => {
    const departments = invite.schedule_departments.length
      ? invite.schedule_departments
      : [invite.primary_schedule_department || invite.department].filter(Boolean);
    return departments.length ? departments.join(', ') : 'No departments';
  };

  function progressText(row: OnboardingRow) {
    if (!row.package_id) return 'No packet';
    if (row.total_items === 0) return '0 requirements';
    return `${row.approved_items}/${row.total_items} approved`;
  }
</script>

<Layout>
  <PageHeader title="Employee Onboarding" />

  <section class="onboarding-console">
    <div class="metric-strip" aria-label="Onboarding status">
      <div>
        <span>Needs Review</span>
        <strong>{needsReview.length}</strong>
      </div>
      <div>
        <span>In Progress</span>
        <strong>{activeRows.length}</strong>
      </div>
      <div>
        <span>Completed</span>
        <strong>{completedRows.length}</strong>
      </div>
      <div>
        <span>No Packet</span>
        <strong>{missingRows.length}</strong>
      </div>
    </div>

    {#if feedbackMessage}
      <p class="feedback-banner">{feedbackMessage}</p>
    {/if}

    <section class="workspace-section invite-section" aria-label="Registration access">
      <header class="section-head">
        <div>
          <span class="section-kicker">Invites</span>
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
              <span>Access</span>
              <select name="access_type">
                {#each accessTypes as accessType}
                  <option value={accessType.value}>{accessType.label}</option>
                {/each}
              </select>
            </label>
            <label>
              <span>Template</span>
              <select name="permission_template">
                {#each permissionTemplates as template}
                  <option value={template.value}>{template.label}</option>
                {/each}
              </select>
            </label>
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
              <span>Primary Department</span>
              <select name="primary_schedule_department">
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
            <fieldset class="department-checks">
              <legend>Schedule Departments</legend>
              {#if data.departments.length === 0}
                <p>No departments yet.</p>
              {:else}
                {#each data.departments as department}
                  <label>
                    <input type="checkbox" name="schedule_departments" value={department} />
                    <span>{department}</span>
                  </label>
                {/each}
              {/if}
            </fieldset>
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
                <span>{[invite.job_title, labelFor(permissionTemplates, invite.permission_template), roleLabel(invite.role)].filter(Boolean).join(' | ')}</span>
                <span>{inviteDepartmentSummary(invite)}</span>
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

    <section class="tool-row" aria-label="Onboarding tools">
      <div class="tool-copy">
        <span class="section-kicker">Send Packet</span>
        <h2>Start employee onboarding</h2>
      </div>

      <form method="POST" action="?/send_package" use:enhance={withFeedback} class="send-form">
        <label>
          <span>Employee</span>
          <select name="user_id" required>
            <option value="">Choose employee</option>
            {#each staffUsers as user}
              <option value={user.id}>{user.display_name ?? user.email}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Classification</span>
          <select name="payroll_classification">
            <option value="employee">Employee</option>
            <option value="contractor">Contractor</option>
          </select>
        </label>
        <button type="submit">Send Onboarding</button>
      </form>
    </section>

    <section class="workspace-section" aria-label="Employee onboarding packets">
      <header class="section-head">
        <div>
          <span class="section-kicker">Dashboard</span>
          <h2>Employee packets</h2>
        </div>
        <span>{packetRows.length} employees</span>
      </header>

      <div class="packet-table">
        <div class="table-header" aria-hidden="true">
          <span>Employee</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Last Step</span>
          <span>Action</span>
        </div>

        {#if packetRows.length === 0}
          <p class="empty table-empty">No employees to onboard yet.</p>
        {:else}
          {#each packetRows as row}
            <div class="packet-line">
              <div class="employee-cell">
                <strong>{row.display_name ?? row.email}</strong>
                <small>{row.email}</small>
              </div>
              <span class="status-pill status-pill-{row.package_status}">{formatStatus(row.package_status)}</span>
              <span data-label="Progress">{progressText(row)}</span>
              <span data-label="Last Step">{row.approved_at ? `Approved ${formatDate(row.approved_at)}` : row.sent_at ? `Sent ${formatDate(row.sent_at)}` : 'Not started'}</span>
              <a href={`/admin/users/${row.user_id}`} class="inline-link">Open</a>
            </div>
          {/each}
        {/if}
      </div>
    </section>

    <details class="workspace-section packet-setup" open>
      <summary>
        <span>
          <span class="section-kicker">Packet Setup</span>
          <strong>Required documents and acknowledgements</strong>
        </span>
        <em>{data.templateItems.length} item{data.templateItems.length === 1 ? '' : 's'}</em>
      </summary>

      <form
        method="POST"
        action="?/create_item"
        enctype="multipart/form-data"
        use:enhance={withFeedback}
        class="packet-form"
      >
        <label>
          <span>Type</span>
          <select name="item_type">
            <option value="form">Employee Form</option>
            <option value="document">Employee Document</option>
            <option value="acknowledgement">Policy Acknowledgement</option>
          </select>
        </label>

        <label>
          <span>Form</span>
          <select name="form_key">
            <option value="personal_information">Personal Information</option>
            <option value="emergency_contact">Emergency Contact</option>
            <option value="payroll_setup">Payroll Setup</option>
          </select>
        </label>

        <label>
          <span>Title</span>
          <input name="title" placeholder="I-9 employment eligibility" required />
        </label>

        <label>
          <span>Order</span>
          <input name="sort_order" type="number" step="1" value={data.templateItems.length} />
        </label>

        <label class="wide">
          <span>Employee Instructions</span>
          <textarea name="description" rows="3" placeholder="What the employee must complete or acknowledge"></textarea>
        </label>

        <label>
          <span>Source PDF/Image</span>
          <input name="source_file" type="file" accept="application/pdf,image/*" />
        </label>

        <label>
          <span>Status</span>
          <select name="is_active">
            <option value="1" selected>Active</option>
            <option value="0">Hidden</option>
          </select>
        </label>

        <button type="submit">Add Requirement</button>
      </form>

      <div class="requirement-list" aria-label="Onboarding packet requirements">
        {#if data.templateItems.length === 0}
          <p class="empty">No packet requirements yet. Defaults will be used until this packet is customized.</p>
        {:else}
          {#each data.templateItems as item}
            <details class="requirement-row">
              <summary>
                <span>
                  <strong>{item.title}</strong>
                  <small>{formatStatus(item.item_type)}</small>
                </span>
                <em>{item.is_active === 1 ? 'Active' : 'Hidden'}</em>
              </summary>

              <form
                method="POST"
                action="?/update_item"
                enctype="multipart/form-data"
                use:enhance={withFeedback}
                class="packet-form compact"
              >
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="existing_source_file_url" value={item.source_file_url} />
                <input type="hidden" name="existing_source_file_name" value={item.source_file_name} />

                <label>
                  <span>Type</span>
                  <select name="item_type">
                    <option value="form" selected={item.item_type === 'form'}>Employee Form</option>
                    <option value="document" selected={item.item_type === 'document'}>Employee Document</option>
                    <option value="acknowledgement" selected={item.item_type === 'acknowledgement'}>Policy Acknowledgement</option>
                  </select>
                </label>

                <label>
                  <span>Form</span>
                  <select name="form_key">
                    <option value="personal_information" selected={item.form_key === 'personal_information'}>Personal Information</option>
                    <option value="emergency_contact" selected={item.form_key === 'emergency_contact'}>Emergency Contact</option>
                    <option value="payroll_setup" selected={item.form_key === 'payroll_setup'}>Payroll Setup</option>
                  </select>
                </label>

                <label>
                  <span>Title</span>
                  <input name="title" value={item.title} required />
                </label>

                <label>
                  <span>Order</span>
                  <input name="sort_order" type="number" step="1" value={item.sort_order} />
                </label>

                <label class="wide">
                  <span>Employee Instructions</span>
                  <textarea name="description" rows="3">{item.description}</textarea>
                </label>

                <label>
                  <span>Replace Source</span>
                  <input name="source_file" type="file" accept="application/pdf,image/*" />
                </label>

                <label>
                  <span>Status</span>
                  <select name="is_active">
                    <option value="1" selected={item.is_active === 1}>Active</option>
                    <option value="0" selected={item.is_active === 0}>Hidden</option>
                  </select>
                </label>

                {#if item.source_file_url}
                  <a href={item.source_file_url} target="_blank" rel="noreferrer" class="source-link">
                    {item.source_file_name || 'View source document'}
                  </a>
                {/if}

                <button type="submit">Save Requirement</button>
              </form>

              <form method="POST" action="?/delete_item" use:enhance={withFeedback} class="delete-form">
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" class="danger">Delete Requirement</button>
              </form>
            </details>
          {/each}
        {/if}
      </div>
    </details>
  </section>
</Layout>

<style>
  .onboarding-console {
    display: grid;
    gap: 0.8rem;
    margin-top: 0.65rem;
  }

  .metric-strip,
  .tool-row,
  .workspace-section {
    border: 1px solid var(--surface-outline);
    border-radius: var(--radius-lg);
    background: var(--surface-wash), var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  .metric-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    overflow: hidden;
  }

  .metric-strip div {
    padding: 0.82rem 1rem;
    border-right: 1px solid var(--color-divider);
  }

  .metric-strip div:last-child {
    border-right: 0;
  }

  .metric-strip span,
  .section-kicker,
  label span,
  .employee-cell small,
  .requirement-row small,
  .empty,
  .packet-setup summary em,
  .requirement-row summary em,
  .section-head > span,
  .table-header {
    color: var(--color-text-muted);
  }

  .metric-strip span,
  .section-kicker,
  label span,
  .table-header {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.68rem;
  }

  .metric-strip strong {
    display: block;
    margin-top: 0.24rem;
    font-size: 1.65rem;
    line-height: 1;
  }

  .tool-row {
    display: grid;
    grid-template-columns: minmax(12rem, 0.35fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: end;
    padding: 1rem;
  }

  .tool-copy h2,
  .section-head h2 {
    margin: 0.2rem 0 0;
  }

  .send-form,
  .packet-form {
    display: grid;
    gap: 0.6rem;
    align-items: end;
  }

  .send-form {
    grid-template-columns: minmax(14rem, 1fr) minmax(12rem, 0.42fr) auto;
  }

  .invite-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
    margin-top: 0.8rem;
  }

  .invite-context {
    grid-column: 1 / -1;
  }

  .invite-context summary,
  .used-invites summary {
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

  .department-checks {
    grid-column: 1 / -1;
    border: 1px solid var(--color-divider);
    border-radius: var(--radius-sm);
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.65rem;
    margin: 0;
    padding: 0.55rem 0.65rem;
  }

  .department-checks legend {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    padding: 0 0.2rem;
    text-transform: uppercase;
  }

  .department-checks label {
    align-items: center;
    display: flex;
    gap: 0.3rem;
    line-height: 1;
  }

  .department-checks input {
    accent-color: var(--color-success, #2f6f4e);
    height: 0.86rem;
    margin: 0;
    width: 0.86rem;
  }

  .department-checks span {
    font-size: 0.72rem;
    letter-spacing: 0.04em;
  }

  .department-checks p {
    color: var(--color-text-muted);
    margin: 0;
  }

  .invite-list,
  .used-list {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.75rem;
  }

  .invite-row,
  .used-list div {
    display: grid;
    gap: 0.48rem;
    padding: 0.72rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .invite-row span,
  .used-list span {
    color: var(--color-text-muted);
  }

  .invite-row strong,
  .used-list strong {
    display: block;
    overflow-wrap: anywhere;
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

  code {
    color: var(--color-text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }

  .workspace-section {
    padding: 1rem;
  }

  .section-head,
  .packet-setup > summary,
  .requirement-row > summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
  }

  .packet-table {
    display: grid;
    gap: 0;
    margin-top: 0.8rem;
    border: 1px solid var(--color-divider);
    border-radius: 14px;
    overflow: hidden;
  }

  .table-header,
  .packet-line {
    display: grid;
    grid-template-columns: minmax(12rem, 1.2fr) minmax(8rem, 0.65fr) minmax(8rem, 0.65fr) minmax(9rem, 0.75fr) auto;
    gap: 0.8rem;
    align-items: center;
    padding: 0.68rem 0.8rem;
  }

  .table-header {
    background: color-mix(in srgb, var(--color-surface-alt) 38%, transparent);
    border-bottom: 1px solid var(--color-divider);
  }

  .packet-line {
    border-bottom: 1px solid var(--color-divider);
  }

  .packet-line:last-child {
    border-bottom: 0;
  }

  .employee-cell {
    display: grid;
    gap: 0.14rem;
    min-width: 0;
  }

  .employee-cell strong,
  .employee-cell small,
  .packet-line span {
    overflow-wrap: anywhere;
  }

  .status-pill {
    display: inline-flex;
    width: fit-content;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 0.3rem 0.55rem;
    color: var(--color-text-muted);
    font-size: 0.66rem;
    font-style: normal;
    line-height: 1;
    white-space: nowrap;
  }

  .status-pill-approved {
    border-color: color-mix(in srgb, #16a34a 38%, var(--color-border));
    color: color-mix(in srgb, var(--color-success) 74%, var(--color-text));
    background: color-mix(in srgb, #16a34a 14%, transparent);
  }

  .status-pill-submitted,
  .status-pill-in_progress {
    border-color: color-mix(in srgb, #3b82f6 34%, var(--color-border));
    color: #bfdbfe;
    background: color-mix(in srgb, #3b82f6 14%, transparent);
  }

  .status-pill-sent,
  .status-pill-not_sent {
    border-color: color-mix(in srgb, #f59e0b 38%, var(--color-border));
    color: #fcd34d;
    background: color-mix(in srgb, #f59e0b 14%, transparent);
  }

  .inline-link,
  button,
  .source-link {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-text) 5%);
    color: var(--color-primary-contrast);
    min-height: 2.35rem;
    padding: 0.5rem 0.72rem;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-medium);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .packet-form {
    grid-template-columns: minmax(150px, 0.8fr) minmax(190px, 1fr) minmax(90px, 0.35fr);
    margin-top: 0.85rem;
    padding-top: 0.8rem;
    border-top: 1px solid var(--color-divider);
  }

  .packet-form.compact {
    margin-top: 0.65rem;
  }

  .wide {
    grid-column: 1 / -1;
  }

  label {
    display: grid;
    gap: 0.25rem;
  }

  input,
  select,
  textarea {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.5rem 0.62rem;
    background: var(--surface-wash), var(--color-surface-alt);
    color: var(--color-text);
    font-size: 0.82rem;
  }

  .packet-setup > summary,
  .requirement-row > summary {
    cursor: pointer;
    list-style: none;
  }

  .packet-setup > summary::-webkit-details-marker,
  .requirement-row > summary::-webkit-details-marker {
    display: none;
  }

  .packet-setup summary span,
  .requirement-row summary span {
    display: grid;
    gap: 0.18rem;
  }

  .requirement-list {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.8rem;
  }

  .requirement-row {
    padding: 0.72rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .delete-form {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  button.danger {
    border-color: color-mix(in srgb, #ef4444 38%, var(--color-border));
    background: color-mix(in srgb, #7f1d1d 30%, var(--color-surface));
    color: #fecaca;
  }

  .feedback-banner {
    margin: 0;
    padding: 0.65rem 0.82rem;
    border: 1px solid color-mix(in srgb, #16a34a 34%, var(--color-border));
    border-radius: 10px;
    background: color-mix(in srgb, #16a34a 14%, transparent);
    color: color-mix(in srgb, var(--color-success) 74%, var(--color-text));
    font-size: 0.8rem;
  }

  .table-empty {
    margin: 0;
    padding: 0.85rem;
  }

  @media (max-width: 1050px) {
    .tool-row,
    .send-form,
    .invite-form,
    .packet-form,
    .packet-form.compact {
      grid-template-columns: 1fr;
    }

    .invite-context-grid {
      grid-template-columns: 1fr;
    }

    .table-header {
      display: none;
    }

    .packet-line {
      grid-template-columns: 1fr;
      gap: 0.45rem;
      align-items: start;
    }

    .packet-line > [data-label] {
      display: grid;
      gap: 0.15rem;
    }

    .packet-line > [data-label]::before {
      content: attr(data-label);
      color: var(--color-text-muted);
      font-size: 0.66rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .inline-link,
    button,
    .source-link,
    .delete-form {
      width: 100%;
    }
  }

  @media (max-width: 760px) {
    .metric-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .metric-strip div:nth-child(2) {
      border-right: 0;
    }

    .metric-strip div:nth-child(-n + 2) {
      border-bottom: 1px solid var(--color-divider);
    }

    .section-head,
    .packet-setup > summary,
    .requirement-row > summary {
      align-items: stretch;
      flex-direction: column;
    }
  }

  @media (max-width: 480px) {
    .metric-strip {
      grid-template-columns: 1fr;
    }

    .metric-strip div {
      border-right: 0;
      border-bottom: 1px solid var(--color-divider);
    }

    .metric-strip div:last-child {
      border-bottom: 0;
    }
  }
</style>

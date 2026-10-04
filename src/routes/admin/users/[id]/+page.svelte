<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import OnboardingFormPreview from '$lib/components/ui/OnboardingFormPreview.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
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
  import type { ScheduleDepartment } from '$lib/assets/schedule';
  import type { SubmitFunction } from '@sveltejs/kit';

  type Employee = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    permission_template: string;
    is_active: number;
    approved_departments: ScheduleDepartment[];
    capability_overrides: BusinessCapabilityOverrides;
    effective_capabilities: BusinessCapability[];
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
    status: 'sent' | 'in_progress' | 'submitted' | 'returned' | 'approved';
    payroll_classification: 'employee' | 'contractor';
    sent_at: number;
    completed_at: number | null;
    approved_at: number | null;
    submitted_at: number | null;
    manager_note: string;
    version: number;
  };

  type EmployeeI9Verification = {
    id: string;
    status: 'pending' | 'verified';
    document_selection: string;
    employee_first_day: string;
    examined_at: string;
    verifier_name: string;
    verifier_title: string;
    attested_at: number | null;
    completed_i9_file_url: string;
    completed_i9_file_name: string;
    document_copies: { id: string; file_url: string; file_name: string; uploaded_at: number }[];
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

  type EmployeePosPermissions = {
    pos_external_id: string;
    can_clock_in: number;
    can_use_pos: number;
    can_open_cash_drawer: number;
    can_refund: number;
    can_void: number;
    can_manager_override: number;
  };

  type EmployeeCertification = {
    id: string;
    certification_type: string;
    title: string;
    issuer: string;
    certificate_number: string;
    issued_at: number | null;
    expires_at: number | null;
    status: string;
  };

  type EmployeeVerificationCheck = {
    id: string;
    check_type: string;
    status: string;
    provider_reference: string;
    result_summary: string;
    requested_at: number | null;
    completed_at: number | null;
    reviewed_at: number | null;
  };

  type EmployeeDocumentAccessAudit = {
    id: string;
    action: string;
    actor_name: string | null;
    actor_email: string | null;
    created_at: number;
  };

  type EmployeeComplianceDocument = {
    id: string;
    document_type: string;
    status: string;
    file_url: string;
    file_name: string;
    signed_name: string;
    submitted_at: number | null;
    reviewed_at: number | null;
    locked_at: number | null;
    updated_at: number;
  };

  export let data: {
    employee: Employee;
    profile: EmployeeProfile;
    onboarding: {
      package: EmployeeOnboardingPackage | null;
      items: EmployeeOnboardingItem[];
      i9Verification: EmployeeI9Verification | null;
    };
    hrSettings: { retain_i9_document_copies: number; everify_participant: number };
    hrPos: {
      pos: EmployeePosPermissions;
      certifications: EmployeeCertification[];
      verificationChecks: EmployeeVerificationCheck[];
      directHrAccess: boolean;
      documentAudit: EmployeeDocumentAccessAudit[];
      complianceDocuments: EmployeeComplianceDocument[];
    } | null;
    canReadSensitiveProfile: boolean;
    canManageHrPos: boolean;
    canManageOnboarding: boolean;
    departments: ScheduleDepartment[];
    canEditPermissions: boolean;
    canManageManagerAccess: boolean;
    editableCapabilities: BusinessCapability[];
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

  const hasCapability = (capability: BusinessCapability) =>
    data.employee.effective_capabilities.includes(capability);

  const formatBirthday = (value: string) =>
    value ? new Date(`${value}T00:00:00`).toLocaleDateString() : 'Not set';

  const formatDateTime = (value: number | null) =>
    value ? new Date(value * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

  const formatOnboardingStatus = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formatRecordDate = (value: number | null) =>
    value ? new Date(value * 1000).toLocaleDateString([], { dateStyle: 'medium' }) : 'Not set';

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

  const deleteEmployee: SubmitFunction = ({ cancel }) => {
    if (!window.confirm(`Delete ${displayName(data.employee)} from this business?`)) {
      cancel();
      return;
    }

    return async ({ result }) => {
      if (result.type === 'redirect') {
        pushToast('Employee deleted.', 'success');
        await goto(result.location, { invalidateAll: true });
      } else if (result.type === 'failure') {
        await applyAction(result);
        pushToast(result.data?.error ?? 'That employee could not be deleted.', 'error');
      } else if (result.type === 'error') {
        pushToast('That employee could not be deleted.', 'error');
      }
    };
  };

  $: onboardingSubmittedCount = data.onboarding.items.filter(
    (item) => item.status === 'submitted' || item.status === 'approved'
  ).length;
  $: needsOnboardingReview = data.onboarding.package?.status === 'submitted' ? 1 : 0;
  $: i9Item = data.onboarding.items.find((item) => item.form_key === 'federal_i9');
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
          <span>Role</span>
          <strong>{businessRoleLabel(data.employee.role)}</strong>
        </div>
        <div>
          <span>Template</span>
          <strong>{permissionTemplateLabel(data.employee.permission_template)}</strong>
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
          <span class="kicker">Permissions</span>
          <div class="action-stack">
            <form method="POST" action="?/update_permissions" use:enhance={withFeedback} class="permission-form">
              <input type="hidden" name="user_id" value={data.employee.id} />
              <label>
                <span>Account Type</span>
                <select name="business_role" disabled={!data.canEditPermissions}>
                  {#each businessAccessOptions as option}
                    <option
                      value={option.value}
                      selected={option.value === normalizeBusinessRole(data.employee.role)}
                      disabled={!data.canManageManagerAccess && (option.value === 'manager' || option.value === 'owner')}
                    >
                      {option.label}
                    </option>
                  {/each}
                </select>
              </label>
              <label>
                <span>Permission Template</span>
                <select name="permission_template" disabled={!data.canEditPermissions}>
                  {#each permissionTemplateOptions as option}
                    <option
                      value={option.value}
                      selected={option.value === data.employee.permission_template}
                      disabled={!data.canManageManagerAccess && option.value.includes('manager')}
                    >
                      {option.label}
                    </option>
                  {/each}
                </select>
              </label>
              <button type="submit" disabled={!data.canEditPermissions}>Save Type</button>
              {#if normalizeBusinessRole(data.employee.role) === 'owner'}
                <small>Owner access is locked.</small>
              {:else}
                <small>{permissionTemplateLabel(data.employee.permission_template)}</small>
              {/if}
            </form>

            <form method="POST" action="?/update_capabilities" use:enhance={withFeedback} class="capability-form">
              <input type="hidden" name="user_id" value={data.employee.id} />
              <div class="capability-list">
                {#each businessCapabilityOptions as capability}
                  <label class="capability-row">
                    <input
                      type="checkbox"
                      name="capabilities"
                      value={capability.value}
                      checked={hasCapability(capability.value)}
                      disabled={!data.canEditPermissions || !data.editableCapabilities.includes(capability.value)}
                    />
                    <span>{capability.label}</span>
                  </label>
                {/each}
              </div>
              <button type="submit" disabled={!data.canEditPermissions}>Save Access</button>
            </form>

            <form method="POST" action="?/delete_user" use:enhance={deleteEmployee}>
              <input type="hidden" name="user_id" value={data.employee.id} />
              <button type="submit" class="danger-action">Delete Employee</button>
            </form>
          </div>
        </section>

        <section class="side-section">
          <span class="kicker">Schedule Departments</span>
          <div class="department-chips">
            {#each data.departments as department}
              {@const approved = isDepartmentApproved(data.employee, department)}
              <form method="POST" action="?/toggle_schedule_department" use:enhance={withFeedback}>
                <input type="hidden" name="user_id" value={data.employee.id} />
                <input type="hidden" name="department" value={department} />
                <button
                  type="submit"
                  class="department-chip"
                  class:department-chip-active={approved}
                  aria-pressed={approved}
                >
                  <span class="material-icons" aria-hidden="true">{approved ? 'check' : 'add'}</span>
                  <span>{department}</span>
                  <small>{approved ? 'On' : 'Off'}</small>
                </button>
              </form>
            {/each}
          </div>
        </section>
      </aside>

      <div class="profile-main">
        {#if data.canReadSensitiveProfile}
        <section class="workspace-section">
          <header class="section-head">
            <div>
              <span class="kicker">Employee Record</span>
              <h2>Protected employee information</h2>
            </div>
            <span class="address-chip">{addressSummary(data.profile)}</span>
          </header>

          <div class="protected-record-grid">
            <div><span>Phone</span><strong>{data.profile.phone || 'Not provided'}</strong></div>
            <div><span>Date of birth</span><strong>{formatBirthday(data.profile.birthday)}</strong></div>
            <div><span>Address</span><strong>{addressSummary(data.profile)}</strong></div>
            <div><span>Emergency contact</span><strong>{data.profile.emergency_contact_name || 'Not provided'}</strong></div>
            <div><span>Emergency phone</span><strong>{data.profile.emergency_contact_phone || 'Not provided'}</strong></div>
            <div><span>Relationship</span><strong>{data.profile.emergency_contact_relationship || 'Not provided'}</strong></div>
          </div>
          <p class="section-note">Accepted employment information is read-only. Issue a new onboarding packet when a legal record must be corrected.</p>
        </section>
        {/if}

        {#if data.canManageHrPos && data.hrPos}
          <section class="workspace-section hr-pos-section">
            <header class="section-head">
              <div>
                <span class="kicker">HR / POS</span>
                <h2>Access and records</h2>
              </div>
              <form method="POST" action="?/toggle_hr_access" use:enhance={withFeedback}>
                <input type="hidden" name="user_id" value={data.employee.id} />
                <button type="submit" class="line-action">
                  {data.hrPos.directHrAccess ? 'Remove HR Access' : 'Grant HR Access'}
                </button>
              </form>
            </header>

            <div class="hr-pos-grid">
              <form method="POST" action="?/save_pos_permissions" use:enhance={withFeedback} class="record-panel">
                <input type="hidden" name="user_id" value={data.employee.id} />
                <header>
                  <strong>POS</strong>
                  <span>{data.hrPos.pos.can_use_pos ? 'Enabled' : 'Limited'}</span>
                </header>
                <label>
                  <span>POS ID</span>
                  <input name="pos_external_id" value={data.hrPos.pos.pos_external_id} placeholder="Optional" />
                </label>
                <div class="compact-checks">
                  <label><input type="checkbox" name="can_clock_in" checked={data.hrPos.pos.can_clock_in === 1} /> Clock in</label>
                  <label><input type="checkbox" name="can_use_pos" checked={data.hrPos.pos.can_use_pos === 1} /> Use POS</label>
                  <label><input type="checkbox" name="can_open_cash_drawer" checked={data.hrPos.pos.can_open_cash_drawer === 1} /> Cash drawer</label>
                  <label><input type="checkbox" name="can_refund" checked={data.hrPos.pos.can_refund === 1} /> Refunds</label>
                  <label><input type="checkbox" name="can_void" checked={data.hrPos.pos.can_void === 1} /> Voids</label>
                  <label><input type="checkbox" name="can_manager_override" checked={data.hrPos.pos.can_manager_override === 1} /> Manager override</label>
                </div>
                <button type="submit">Save POS</button>
              </form>

              {#if data.canReadSensitiveProfile}
              <section class="record-panel">
                <header>
                  <strong>Certifications</strong>
                  <span>{data.hrPos.certifications.length}</span>
                </header>
                <form method="POST" action="?/add_certification" use:enhance={withFeedback} class="mini-form">
                  <input type="hidden" name="user_id" value={data.employee.id} />
                  <input name="title" placeholder="Title" required />
                  <input name="certification_type" placeholder="Type" />
                  <input name="issuer" placeholder="Issuer" />
                  <input name="certificate_number" placeholder="Number" />
                  <input name="issued_at" type="date" />
                  <input name="expires_at" type="date" />
                  <select name="status">
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                  </select>
                  <button type="submit">Add</button>
                </form>
                <div class="record-list">
                  {#each data.hrPos.certifications as cert}
                    <div class="record-row">
                      <div>
                        <strong>{cert.title}</strong>
                        <span>{cert.issuer || cert.certification_type} | {formatRecordDate(cert.expires_at)}</span>
                      </div>
                      <form method="POST" action="?/delete_certification" use:enhance={withFeedback}>
                        <input type="hidden" name="certification_id" value={cert.id} />
                        <button type="submit" class="danger-link">Delete</button>
                      </form>
                    </div>
                  {:else}
                    <p class="quiet-note">No certifications.</p>
                  {/each}
                </div>
              </section>

              <section class="record-panel">
                <header>
                  <strong>Verification</strong>
                  <span>{data.hrPos.verificationChecks.length}</span>
                </header>
                <form method="POST" action="?/add_verification_check" use:enhance={withFeedback} class="mini-form">
                  <input type="hidden" name="user_id" value={data.employee.id} />
                  <input name="check_type" placeholder="Check type" required />
                  <input name="provider_reference" placeholder="Reference" />
                  <select name="status">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="failed">Failed</option>
                  </select>
                  <input name="result_summary" placeholder="Result" />
                  <button type="submit">Add</button>
                </form>
                <div class="record-list">
                  {#each data.hrPos.verificationChecks as check}
                    <form method="POST" action="?/update_verification_check" use:enhance={withFeedback} class="record-row editable-row">
                      <input type="hidden" name="check_id" value={check.id} />
                      <div>
                        <strong>{formatOnboardingStatus(check.check_type)}</strong>
                        <span>{check.provider_reference || 'No reference'} | {formatRecordDate(check.reviewed_at)}</span>
                      </div>
                      <select name="status">
                        <option value="pending" selected={check.status === 'pending'}>Pending</option>
                        <option value="approved" selected={check.status === 'approved'}>Approved</option>
                        <option value="failed" selected={check.status === 'failed'}>Failed</option>
                      </select>
                      <input name="result_summary" value={check.result_summary} placeholder="Result" />
                      <button type="submit">Save</button>
                    </form>
                  {:else}
                    <p class="quiet-note">No checks.</p>
                  {/each}
                </div>
              </section>
              {/if}

              <section class="record-panel">
                <header>
                  <strong>Employment Documents</strong>
                  <span>{data.hrPos.complianceDocuments.length}</span>
                </header>
                <div class="record-list">
                  {#each data.hrPos.complianceDocuments as document}
                    <div class="record-row">
                      <div>
                        <strong>{formatOnboardingStatus(document.document_type)}</strong>
                        <span>{formatOnboardingStatus(document.status)} | {formatDateTime(document.reviewed_at ?? document.submitted_at)}</span>
                      </div>
                      {#if document.file_url}<a href={document.file_url} target="_blank">View</a>{/if}
                    </div>
                  {:else}
                    <p class="quiet-note">No employment documents.</p>
                  {/each}
                </div>
              </section>

              <section class="record-panel">
                <header>
                  <strong>Document Audit</strong>
                  <span>{data.hrPos.documentAudit.length}</span>
                </header>
                <div class="record-list">
                  {#each data.hrPos.documentAudit as entry}
                    <div class="audit-row">
                      <strong>{formatOnboardingStatus(entry.action)}</strong>
                      <span>{entry.actor_name || entry.actor_email || 'System'} | {formatDateTime(entry.created_at)}</span>
                    </div>
                  {:else}
                    <p class="quiet-note">No document access yet.</p>
                  {/each}
                </div>
              </section>
            </div>
          </section>
        {/if}

        <section class="workspace-section onboarding-review">
          <header class="section-head">
            <div>
              <span class="kicker">Employment Records</span>
              <h2>Onboarding packet</h2>
            </div>
            {#if data.onboarding.package}
              <span class={`status-pill status-pill-${data.onboarding.package.status}`}>
                {formatOnboardingStatus(data.onboarding.package.status)}
              </span>
            {/if}
          </header>

          {#if !data.onboarding.package}
            <p class="section-note">Send an onboarding packet when this employee is ready to complete employment forms.</p>
            {#if data.canManageOnboarding}
            <form method="POST" action="?/send_onboarding_package" use:enhance={withFeedback} class="send-onboarding">
              <input type="hidden" name="user_id" value={data.employee.id} />
              <input type="hidden" name="payroll_classification" value="employee" />
              <button type="submit">Send Onboarding</button>
            </form>
            {/if}
          {:else}
            <div class="onboarding-summary">
              <div><span>Packet</span><strong>{data.onboarding.package.version}</strong></div>
              <div><span>Sent</span><strong>{formatDateTime(data.onboarding.package.sent_at)}</strong></div>
              <div><span>Submitted</span><strong>{onboardingSubmittedCount} / {data.onboarding.items.length}</strong></div>
            </div>

            {#if data.onboarding.package.status === 'approved' && data.canManageOnboarding}
              <form method="POST" action="?/send_onboarding_package" use:enhance={withFeedback} class="send-onboarding">
                <input type="hidden" name="user_id" value={data.employee.id} />
                <input type="hidden" name="payroll_classification" value="employee" />
                <button type="submit">Issue New Packet</button>
              </form>
            {/if}

            {#if data.onboarding.package.manager_note}
              <p class="manager-note">{data.onboarding.package.manager_note}</p>
            {/if}

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
                    <span>{item.file_name || (item.signed_name ? `Signed by ${item.signed_name}` : 'No submission yet')}</span>
                    {#if item.submitted_at}<span>{formatDateTime(item.submitted_at)}</span>{/if}
                  </div>
                  {#if item.source_file_url}
                    <OnboardingFormPreview src={item.source_file_url} title={item.title} fileName={item.source_file_name} label="Assigned form" />
                  {/if}
                  {#if item.file_url}
                    <OnboardingFormPreview src={item.file_url} title={`${item.title} submission`} fileName={item.file_name} label="Submitted record" />
                  {/if}
                </article>
              {/each}
            </div>

            {#if data.onboarding.package.status === 'submitted' && i9Item && data.canReadSensitiveProfile}
              <details class="i9-verification" open={data.onboarding.i9Verification?.status !== 'verified'}>
                <summary>
                  <span><span class="kicker">Employer Step</span><strong>Physical I-9 verification</strong></span>
                  <em>{data.onboarding.i9Verification?.status === 'verified' ? 'Verified' : 'Required'}</em>
                </summary>

                {#if data.onboarding.i9Verification?.status === 'verified'}
                  <div class="verification-record">
                    <span>{data.onboarding.i9Verification.document_selection === 'list_a' ? 'List A' : 'List B + List C'}</span>
                    <span>Examined {data.onboarding.i9Verification.examined_at}</span>
                    <span>{data.onboarding.i9Verification.verifier_name}, {data.onboarding.i9Verification.verifier_title}</span>
                    <a href={data.onboarding.i9Verification.completed_i9_file_url} target="_blank">Completed Form I-9</a>
                    {#each data.onboarding.i9Verification.document_copies as copy}
                      <a href={copy.file_url} target="_blank">{copy.file_name}</a>
                    {/each}
                  </div>
                {:else}
                  <form method="POST" action="?/verify_i9" enctype="multipart/form-data" use:enhance={withFeedback} class="packet-form">
                    <input type="hidden" name="package_id" value={data.onboarding.package.id} />
                    <label>
                      <span>Documents presented</span>
                      <select name="document_selection" required>
                        <option value="">Select</option>
                        <option value="list_a">One List A document</option>
                        <option value="list_b_and_c">One List B and one List C document</option>
                      </select>
                    </label>
                    <label><span>Employee first day</span><input name="employee_first_day" type="date" required /></label>
                    <label><span>Physical examination date</span><input name="examined_at" type="date" required /></label>
                    <label><span>Authorized verifier</span><input name="verifier_name" required /></label>
                    <label><span>Verifier title</span><input name="verifier_title" required /></label>
                    <label class="wide"><span>Completed Form I-9 with Section 2</span><input name="completed_i9" type="file" accept=".pdf,application/pdf" required /></label>
                    {#if data.hrSettings.retain_i9_document_copies === 1 || data.hrSettings.everify_participant === 1}
                      <label class="wide"><span>Retained document copies</span><input name="document_copies" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple /></label>
                    {/if}
                    {#if data.hrSettings.everify_participant === 1}
                      <label class="toggle-card wide"><input type="checkbox" name="photo_matching_document_present" value="1" /><span>Employee presented an E-Verify photo-matching document</span></label>
                    {/if}
                    <label class="toggle-card wide">
                      <input type="checkbox" name="attested" value="1" required />
                      <span>I physically examined the original documents in the employee's presence, they reasonably appear genuine and relate to the employee, and I completed Section 2.</span>
                    </label>
                    <button type="submit">Record Verification</button>
                  </form>
                {/if}
              </details>
            {/if}

            {#if data.onboarding.package.status === 'submitted' && data.canReadSensitiveProfile && data.canManageOnboarding}
              <div class="packet-review-actions">
                <form method="POST" action="?/approve_onboarding_packet" use:enhance={withFeedback}>
                  <input type="hidden" name="package_id" value={data.onboarding.package.id} />
                  <button type="submit">Accept Packet</button>
                </form>
                <form method="POST" action="?/return_onboarding_packet" use:enhance={withFeedback}>
                  <input type="hidden" name="package_id" value={data.onboarding.package.id} />
                  <input name="manager_note" placeholder="What must be corrected?" required />
                  <button type="submit">Return Packet</button>
                </form>
              </div>
            {/if}
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
  .onboarding-evidence {
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

  .permission-form {
    display: grid;
    gap: 0.55rem;
    padding: 0.65rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .permission-form label {
    display: grid;
    gap: 0.25rem;
  }

  .permission-form span,
  .permission-form small {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: var(--weight-semibold);
  }

  .capability-form {
    display: grid;
    gap: 0.7rem;
  }

  .capability-list {
    display: grid;
    gap: 0.15rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    padding: 0.35rem 0;
  }

  .capability-row {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.55rem;
    min-height: 2rem;
    color: var(--color-text);
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
  }

  .capability-row input {
    width: 0.95rem;
    min-height: 0.95rem;
    accent-color: var(--color-accent);
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

  .protected-record-grid,
  .verification-record {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-top: 1px solid var(--color-divider);
  }

  .protected-record-grid > div,
  .verification-record > * {
    display: grid;
    gap: 0.2rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-divider);
  }

  .protected-record-grid span,
  .verification-record span {
    color: var(--color-text-muted);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .i9-verification {
    margin-top: 1rem;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .i9-verification summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 0;
    cursor: pointer;
  }

  .i9-verification summary > span {
    display: grid;
    gap: 0.15rem;
  }

  .i9-verification summary em {
    color: var(--color-text-muted);
    font-style: normal;
  }

  .packet-form,
  .packet-review-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
    padding: 0.9rem 0;
  }

  .packet-form .wide,
  .packet-form > button {
    grid-column: 1 / -1;
  }

  .packet-review-actions form {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .packet-review-actions input {
    min-width: 0;
    flex: 1;
  }

  .hr-pos-section {
    display: grid;
    gap: 0.9rem;
  }

  .hr-pos-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
  }

  .record-panel {
    display: grid;
    align-content: start;
    gap: 0.75rem;
    padding: 0.85rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .record-panel header,
  .record-row,
  .audit-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
  }

  .record-panel header span,
  .record-row span,
  .audit-row span,
  .quiet-note {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .compact-checks {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem 0.7rem;
    padding: 0.25rem 0;
  }

  .compact-checks label {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.45rem;
    color: var(--color-text);
    font-size: 0.82rem;
  }

  .compact-checks input {
    width: 1rem;
    min-height: 1rem;
    accent-color: var(--color-accent);
  }

  .mini-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .mini-form button,
  .editable-row button,
  .line-action {
    width: auto;
  }

  .record-list {
    display: grid;
    gap: 0.45rem;
  }

  .record-row,
  .audit-row {
    min-height: 2.45rem;
    padding: 0.4rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .record-row div,
  .audit-row {
    min-width: 0;
  }

  .record-row strong,
  .audit-row strong {
    display: block;
    overflow-wrap: anywhere;
  }

  .editable-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 8rem minmax(8rem, 0.8fr) auto;
  }

  .danger-link {
    min-height: 2rem;
    width: auto;
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
    border-bottom-color: color-mix(in srgb, var(--color-error) 44%, var(--color-divider));
  }

  .line-action {
    min-height: 2.25rem;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
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
    border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border));
    color: color-mix(in srgb, var(--color-success) 74%, var(--color-text));
    background: transparent;
  }

  .access-state {
    display: flex;
    align-items: center;
    min-height: 2.45rem;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 0.55rem 0.78rem;
    font-size: 0.78rem;
    font-weight: var(--weight-semibold);
  }

  .danger-action {
    border-color: color-mix(in srgb, var(--color-error) 36%, var(--color-border));
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
    background: color-mix(in srgb, var(--color-error) 32%, var(--color-surface));
  }

  .department-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    width: auto;
    min-height: 2.1rem;
    border: 0;
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 0.32rem 0.15rem;
    color: var(--color-text);
    background: transparent;
  }

  .department-chip .material-icons {
    font-size: 0.95rem;
    line-height: 1;
  }

  .department-chip small {
    color: var(--color-text-muted);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
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
    border-color: color-mix(in srgb, var(--color-success) 38%, var(--color-border));
    color: color-mix(in srgb, var(--color-success) 74%, var(--color-text));
    background: color-mix(in srgb, var(--color-success) 14%, transparent);
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
    border-color: color-mix(in srgb, var(--color-success) 30%, var(--color-border));
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

  .manager-note {
    padding: 0.7rem;
    border-radius: 12px;
    background: color-mix(in srgb, #f59e0b 12%, transparent);
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
    .hr-pos-grid,
    .mini-form,
    .editable-row,
    .field-grid.two,
    .field-grid.three,
    .onboarding-summary,
    .protected-record-grid,
    .verification-record,
    .packet-form,
    .packet-review-actions,
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

    .send-onboarding button {
      width: 100%;
    }

    .packet-review-actions form {
      align-items: stretch;
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

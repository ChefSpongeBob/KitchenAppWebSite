<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import PeopleHrNav from '$lib/components/ui/PeopleHrNav.svelte';
	import OnboardingFormPreview from '$lib/components/ui/OnboardingFormPreview.svelte';
	import { applyAction, enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { pushToast } from '$lib/client/toasts';
	import {
		businessCapabilityOptions,
		businessRoleLabel,
		type BusinessCapability,
		type BusinessCapabilityOverrides
	} from '$lib/auth/roles';
	import type { ScheduleDepartment } from '$lib/assets/schedule';
	import type { SubmitFunction } from '@sveltejs/kit';

	type EmployeeSection =
		| 'profile'
		| 'employment'
		| 'onboarding'
		| 'documents'
		| 'access'
		| 'activity';
	type Employee = {
		id: string;
		display_name: string | null;
		email: string;
		role: string;
		permission_template: string;
		position_id: string | null;
		position_name: string | null;
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
	type EmploymentRecord = {
		employment_status: string;
		employment_type: string;
		job_title: string;
		department: string;
		primary_schedule_department: string;
		hire_date: string;
		start_date: string;
		termination_date: string;
		pay_type: string;
		manager_user_id: string | null;
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
	type RoleDefinition = { id: string; department: string; roleName: string; sortOrder: number };
	type BusinessPosition = {
		id: string;
		name: string;
		account_type: 'manager' | 'staff' | 'external';
		is_active: number;
	};

	export let data: {
		activeSection: EmployeeSection;
		employee: Employee;
		profile: EmployeeProfile;
		employment: EmploymentRecord;
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
		canManagePeople: boolean;
		canReviewOnboarding: boolean;
		canManageOnboarding: boolean;
		canManageScheduleAssignments: boolean;
		canEditHrRecords: boolean;
		canManageHrPos: boolean;
		canManagePermissions: boolean;
		positions: BusinessPosition[];
		departments: ScheduleDepartment[];
		roleDefinitions: RoleDefinition[];
		scheduleRoleAccess: { restrictToSelected: boolean; roleDefinitionIds: string[] };
		managerOptions: { id: string; displayName: string | null; email: string }[];
		canEditPermissions: boolean;
		canDeleteEmployee: boolean;
		canManageManagerAccess: boolean;
		actorIsOwner: boolean;
		editableCapabilities: BusinessCapability[];
	};

	const displayName = (employee: Employee) => employee.display_name?.trim() || 'Unnamed Employee';
	const initialsFor = (employee: Employee) =>
		(displayName(employee) === 'Unnamed Employee' ? employee.email : displayName(employee))
			.trim()
			.charAt(0)
			.toUpperCase();
	const isDepartmentApproved = (department: ScheduleDepartment) =>
		data.employee.approved_departments.includes(department);
	const hasCapability = (capability: BusinessCapability) =>
		data.employee.effective_capabilities.includes(capability);
	const formatBirthday = (value: string) =>
		value ? new Date(`${value}T00:00:00`).toLocaleDateString() : 'Not set';
	const formatDateTime = (value: number | null) =>
		value
			? new Date(value * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
			: 'Not set';
	const formatRecordDate = (value: number | null) =>
		value ? new Date(value * 1000).toLocaleDateString([], { dateStyle: 'medium' }) : 'Not set';
	const formatStatus = (status: string) =>
		status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	const addressSummary = (profile: EmployeeProfile) => {
		const parts = [
			profile.address_line_1,
			profile.address_line_2,
			[profile.city, profile.state].filter(Boolean).join(', '),
			profile.postal_code
		].filter(Boolean);
		return parts.length > 0 ? parts.join(' | ') : 'No address on file';
	};
	const sectionHref = (section: EmployeeSection) =>
		`/admin/users/${data.employee.id}?section=${section}`;

	const withFeedback: SubmitFunction =
		() =>
		async ({ result }) => {
			await applyAction(result);
			if (result.type === 'success') {
				await invalidateAll();
				pushToast(result.data?.message ?? 'Employee record updated.', 'success');
			} else if (result.type === 'failure') {
				pushToast(result.data?.error ?? 'That employee update could not be saved.', 'error');
			}
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
			} else {
				await applyAction(result);
				pushToast(
					result.type === 'failure'
						? (result.data?.error ?? 'That employee could not be deleted.')
						: 'That employee could not be deleted.',
					'error'
				);
			}
		};
	};

	$: onboardingSubmittedCount = data.onboarding.items.filter((item) =>
		['submitted', 'approved'].includes(item.status)
	).length;
	$: i9Item = data.onboarding.items.find((item) => item.form_key === 'federal_i9');
</script>

<Layout>
	<PageHeader title="People & HR" />
	<div class="people-nav-wrap">
		<PeopleHrNav
			active="team"
			canReviewOnboarding={data.canReviewOnboarding}
			canViewSensitive={data.canReadSensitiveProfile}
			canManagePermissions={data.canManagePermissions}
		/>
	</div>

	<section class="employee-shell">
		<a class="back-link" href="/admin/users?view=team"
			><span class="material-icons" aria-hidden="true">arrow_back</span> Team</a
		>

		<header class="employee-hero">
			<div class="employee-identity">
				<span class="profile-avatar" aria-hidden="true">{initialsFor(data.employee)}</span>
				<div>
					<h1>{displayName(data.employee)}</h1>
					<p>{data.employee.email}</p>
				</div>
			</div>
			<div class="employee-summary">
				<span>{businessRoleLabel(data.employee.role)}</span>
				<span>{data.employee.position_name || 'No position assigned'}</span>
				<span>{formatStatus(data.employment.employment_status)}</span>
			</div>
		</header>

		<nav class="record-nav" aria-label="Employee record sections">
			<a href={sectionHref('profile')} class:active={data.activeSection === 'profile'}>Profile</a>
			<a href={sectionHref('employment')} class:active={data.activeSection === 'employment'}
				>Employment</a
			>
			{#if data.canReviewOnboarding}
				<a href={sectionHref('onboarding')} class:active={data.activeSection === 'onboarding'}
					>Onboarding</a
				>
			{/if}
			{#if data.canReadSensitiveProfile}
				<a href={sectionHref('documents')} class:active={data.activeSection === 'documents'}
					>Documents &amp; Compliance</a
				>
			{/if}
			{#if data.canManagePermissions}
				<a href={sectionHref('access')} class:active={data.activeSection === 'access'}>Access</a>
			{/if}
			{#if data.canReadSensitiveProfile}
				<a href={sectionHref('activity')} class:active={data.activeSection === 'activity'}
					>Activity</a
				>
			{/if}
		</nav>

		{#if data.activeSection === 'profile'}
			<section class="workspace-section">
				<header class="section-head">
					<div>
						<span class="kicker">Profile</span>
						<h2>Employee information</h2>
					</div>
				</header>
				<div class="record-grid basic-grid">
					<div><span>Name</span><strong>{displayName(data.employee)}</strong></div>
					<div><span>Email</span><strong>{data.employee.email}</strong></div>
					<div>
						<span>Account</span><strong>{data.employee.is_active ? 'Active' : 'Inactive'}</strong>
					</div>
					<div>
						<span>Business role</span><strong>{businessRoleLabel(data.employee.role)}</strong>
					</div>
				</div>
				{#if data.canReadSensitiveProfile}
					<div class="record-grid sensitive-grid">
						<div><span>Phone</span><strong>{data.profile.phone || 'Not provided'}</strong></div>
						<div>
							<span>Date of birth</span><strong>{formatBirthday(data.profile.birthday)}</strong>
						</div>
						<div><span>Address</span><strong>{addressSummary(data.profile)}</strong></div>
						<div>
							<span>Emergency contact</span><strong
								>{data.profile.emergency_contact_name || 'Not provided'}</strong
							>
						</div>
						<div>
							<span>Emergency phone</span><strong
								>{data.profile.emergency_contact_phone || 'Not provided'}</strong
							>
						</div>
						<div>
							<span>Relationship</span><strong
								>{data.profile.emergency_contact_relationship || 'Not provided'}</strong
							>
						</div>
					</div>
					<p class="section-note">
						Accepted legal information is read-only. Issue a new onboarding packet when it must be
						corrected.
					</p>
				{:else}
					<p class="section-note">
						Protected personal information is available only to authorized HR users.
					</p>
				{/if}
			</section>
		{:else if data.activeSection === 'employment'}
			<section class="workspace-section">
				<header class="section-head">
					<div>
						<span class="kicker">Employment</span>
						<h2>Job record</h2>
					</div>
				</header>
				<form
					method="POST"
					action="?/update_employment"
					use:enhance={withFeedback}
					class="employment-form"
				>
					<input type="hidden" name="user_id" value={data.employee.id} />
					<label
						><span>Status</span><select name="employment_status" disabled={!data.canManagePeople}>
							{#each ['onboarding', 'active', 'inactive', 'terminated'] as status}<option
									value={status}
									selected={data.employment.employment_status === status}
									>{formatStatus(status)}</option
								>{/each}
						</select></label
					>
					<label
						><span>Worker type</span><select
							name="employment_type"
							disabled={!data.canManagePeople}
						>
							{#each ['employee', 'contractor', 'owner'] as type}<option
									value={type}
									selected={data.employment.employment_type === type}>{formatStatus(type)}</option
								>{/each}
						</select></label
					>
					<label><span>Position</span><input value={data.employee.position_name || data.employment.job_title || 'Unassigned'} disabled /></label>
					<label
						><span>Primary department</span><select
							name="primary_schedule_department"
							disabled={!data.canManagePeople}
						>
							<option value="">Not assigned</option>
							{#each data.departments as department}<option
									value={department}
									selected={data.employment.primary_schedule_department === department}
									>{department}</option
								>{/each}
						</select></label
					>
					<label
						><span>Reports to</span><select name="manager_user_id" disabled={!data.canManagePeople}>
							<option value="">Not assigned</option>
							{#each data.managerOptions as manager}<option
									value={manager.id}
									selected={data.employment.manager_user_id === manager.id}
									>{manager.displayName || manager.email}</option
								>{/each}
						</select></label
					>
					<label
						><span>Pay type</span><select name="pay_type" disabled={!data.canManagePeople}>
							<option value="" selected={!data.employment.pay_type}>Not set</option>
							<option value="hourly" selected={data.employment.pay_type === 'hourly'}>Hourly</option
							>
							<option value="salary" selected={data.employment.pay_type === 'salary'}>Salary</option
							>
						</select></label
					>
					<label
						><span>Hire date</span><input
							type="date"
							name="hire_date"
							value={data.employment.hire_date}
							disabled={!data.canManagePeople}
						/></label
					>
					<label
						><span>Start date</span><input
							type="date"
							name="start_date"
							value={data.employment.start_date}
							disabled={!data.canManagePeople}
						/></label
					>
					<label
						><span>Termination date</span><input
							type="date"
							name="termination_date"
							value={data.employment.termination_date}
							disabled={!data.canManagePeople}
						/></label
					>
					{#if data.canManagePeople}<button type="submit">Save Employment</button>{/if}
				</form>
			</section>

			{#if data.canDeleteEmployee}
				<section class="workspace-section danger-zone">
					<header class="section-head">
						<div>
							<span class="kicker">Account</span>
							<h2>Remove employee</h2>
						</div>
					</header>
					<form method="POST" action="?/delete_user" use:enhance={deleteEmployee}>
						<input type="hidden" name="user_id" value={data.employee.id} /><button
							type="submit"
							class="danger-link">Delete Employee</button
						>
					</form>
				</section>
			{/if}

			<section class="workspace-section">
				<header class="section-head">
					<div>
						<span class="kicker">Scheduling</span>
						<h2>Departments and roles</h2>
					</div>
				</header>
				<div class="department-list">
					{#each data.departments as department}
						{@const approved = isDepartmentApproved(department)}
						<form method="POST" action="?/toggle_schedule_department" use:enhance={withFeedback}>
							<input type="hidden" name="user_id" value={data.employee.id} />
							<input type="hidden" name="department" value={department} />
							<button
								type="submit"
								class:active={approved}
								aria-pressed={approved}
								disabled={!data.canManageScheduleAssignments}
							>
								<span class="material-icons" aria-hidden="true">{approved ? 'check' : 'add'}</span
								>{department}
							</button>
						</form>
					{:else}
						<p class="section-note">
							Create schedule departments in Schedule Setup before assigning employees.
						</p>
					{/each}
				</div>

				<form
					method="POST"
					action="?/save_schedule_roles"
					use:enhance={withFeedback}
					class="role-access-form"
				>
					<input type="hidden" name="user_id" value={data.employee.id} />
					<label class="role-mode"
						><span>Role availability</span><select
							name="restrict_to_selected"
							disabled={!data.canManageScheduleAssignments}
						>
							<option value="0" selected={!data.scheduleRoleAccess.restrictToSelected}
								>All roles in assigned departments</option
							>
							<option value="1" selected={data.scheduleRoleAccess.restrictToSelected}
								>Only selected roles</option
							>
						</select></label
					>
					<div class="role-groups">
						{#each data.departments.filter( (department) => isDepartmentApproved(department) ) as department}
							{@const departmentRoles = data.roleDefinitions.filter(
								(role) => role.department === department
							)}
							{#if departmentRoles.length > 0}
								<fieldset>
									<legend>{department}</legend>
									{#each departmentRoles as role}
										<label class="check-row"
											><input
												type="checkbox"
												name="role_ids"
												value={role.id}
												checked={data.scheduleRoleAccess.roleDefinitionIds.includes(role.id)}
												disabled={!data.canManageScheduleAssignments}
											/><span>{role.roleName}</span></label
										>
									{/each}
								</fieldset>
							{/if}
						{/each}
					</div>
					{#if data.canManageScheduleAssignments}<button type="submit">Save Schedule Roles</button
						>{/if}
				</form>
			</section>
		{:else if data.activeSection === 'onboarding'}
			<section class="workspace-section onboarding-review">
				<header class="section-head">
					<div>
						<span class="kicker">Onboarding</span>
						<h2>Employee packet</h2>
					</div>
					{#if data.onboarding.package}<span class="status-pill"
							>{formatStatus(data.onboarding.package.status)}</span
						>{/if}
				</header>
				{#if !data.onboarding.package}
					<p class="section-note">No onboarding packet has been issued.</p>
					{#if data.canManageOnboarding}
						<form
							method="POST"
							action="?/send_onboarding_package"
							use:enhance={withFeedback}
							class="line-form"
						>
							<input type="hidden" name="user_id" value={data.employee.id} /><input
								type="hidden"
								name="payroll_classification"
								value="employee"
							/><button type="submit">Send Onboarding</button>
						</form>
					{/if}
				{:else}
					<div class="record-grid packet-summary">
						<div><span>Version</span><strong>{data.onboarding.package.version}</strong></div>
						<div>
							<span>Sent</span><strong>{formatDateTime(data.onboarding.package.sent_at)}</strong>
						</div>
						<div>
							<span>Submitted</span><strong
								>{onboardingSubmittedCount} / {data.onboarding.items.length}</strong
							>
						</div>
					</div>
					{#if data.onboarding.package.status === 'approved' && data.canManageOnboarding}
						<form
							method="POST"
							action="?/send_onboarding_package"
							use:enhance={withFeedback}
							class="line-form"
						>
							<input type="hidden" name="user_id" value={data.employee.id} /><input
								type="hidden"
								name="payroll_classification"
								value="employee"
							/><button type="submit">Issue New Packet</button>
						</form>
					{/if}
					{#if data.onboarding.package.manager_note}<p class="manager-note">
							{data.onboarding.package.manager_note}
						</p>{/if}
					<div class="onboarding-list">
						{#each data.onboarding.items as item}
							<article class="onboarding-item">
								<div>
									<span class="item-type">{formatStatus(item.item_type)}</span>
									<h3>{item.title}</h3>
									<p>{item.description}</p>
								</div>
								<div class="item-status">
									<strong>{formatStatus(item.status)}</strong><span
										>{item.file_name ||
											(item.signed_name ? `Signed by ${item.signed_name}` : 'No submission')}</span
									>
								</div>
								{#if item.source_file_url}<OnboardingFormPreview
										src={item.source_file_url}
										title={item.title}
										fileName={item.source_file_name}
										label="Assigned form"
									/>{/if}
								{#if item.file_url}<OnboardingFormPreview
										src={item.file_url}
										title={`${item.title} submission`}
										fileName={item.file_name}
										label="Submitted record"
									/>{/if}
							</article>
						{/each}
					</div>
					{#if data.onboarding.package.status === 'submitted' && i9Item && data.canReadSensitiveProfile}
						<details
							class="i9-verification"
							open={data.onboarding.i9Verification?.status !== 'verified'}
						>
							<summary
								><strong>Physical I-9 verification</strong><span
									>{data.onboarding.i9Verification?.status === 'verified'
										? 'Verified'
										: 'Required'}</span
								></summary
							>
							{#if data.onboarding.i9Verification?.status === 'verified'}
								<div class="verification-record">
									<span
										>{data.onboarding.i9Verification.document_selection === 'list_a'
											? 'List A'
											: 'List B + List C'}</span
									>
									<span>Examined {data.onboarding.i9Verification.examined_at}</span>
									<span
										>{data.onboarding.i9Verification.verifier_name}, {data.onboarding.i9Verification
											.verifier_title}</span
									>
									<a href={data.onboarding.i9Verification.completed_i9_file_url} target="_blank"
										>Completed Form I-9</a
									>
								</div>
							{:else}
								<form
									method="POST"
									action="?/verify_i9"
									enctype="multipart/form-data"
									use:enhance={withFeedback}
									class="packet-form"
								>
									<input type="hidden" name="package_id" value={data.onboarding.package.id} />
									<label
										><span>Documents presented</span><select name="document_selection" required
											><option value="">Select</option><option value="list_a"
												>One List A document</option
											><option value="list_b_and_c">One List B and one List C document</option
											></select
										></label
									>
									<label
										><span>Employee first day</span><input
											name="employee_first_day"
											type="date"
											required
										/></label
									>
									<label
										><span>Physical examination date</span><input
											name="examined_at"
											type="date"
											required
										/></label
									>
									<label
										><span>Authorized verifier</span><input name="verifier_name" required /></label
									>
									<label><span>Verifier title</span><input name="verifier_title" required /></label>
									<label class="wide"
										><span>Completed Form I-9 with Section 2</span><input
											name="completed_i9"
											type="file"
											accept=".pdf,application/pdf"
											required
										/></label
									>
									{#if data.hrSettings.retain_i9_document_copies === 1 || data.hrSettings.everify_participant === 1}<label
											class="wide"
											><span>Retained document copies</span><input
												name="document_copies"
												type="file"
												accept=".pdf,.jpg,.jpeg,.png,.webp"
												multiple
											/></label
										>{/if}
									<label class="check-row wide"
										><input type="checkbox" name="attested" value="1" required /><span
											>I physically examined the original documents and completed Section 2.</span
										></label
									>
									<button type="submit">Record Verification</button>
								</form>
							{/if}
						</details>
					{/if}
					{#if data.onboarding.package.status === 'submitted' && data.canReadSensitiveProfile && data.canReviewOnboarding}
						<div class="review-actions">
							<form method="POST" action="?/approve_onboarding_packet" use:enhance={withFeedback}>
								<input type="hidden" name="package_id" value={data.onboarding.package.id} /><button
									type="submit">Accept Packet</button
								>
							</form>
							<form method="POST" action="?/return_onboarding_packet" use:enhance={withFeedback}>
								<input type="hidden" name="package_id" value={data.onboarding.package.id} /><input
									name="manager_note"
									placeholder="What must be corrected?"
									required
								/><button type="submit">Return Packet</button>
							</form>
						</div>
					{/if}
				{/if}
			</section>
		{:else if data.activeSection === 'documents' && data.hrPos}
			<section class="workspace-section">
				<header class="section-head">
					<div>
						<span class="kicker">Compliance</span>
						<h2>Certifications and checks</h2>
					</div>
				</header>
				<div class="split-workspace">
					<section class="record-panel">
						<header>
							<strong>Certifications</strong><span>{data.hrPos.certifications.length}</span>
						</header>
						{#if data.canEditHrRecords}
							<form
								method="POST"
								action="?/add_certification"
								use:enhance={withFeedback}
								class="mini-form"
							>
								<input type="hidden" name="user_id" value={data.employee.id} /><input
									name="title"
									placeholder="Title"
									required
								/><input name="certification_type" placeholder="Type" /><input
									name="issuer"
									placeholder="Issuer"
								/><input name="certificate_number" placeholder="Number" /><input
									name="issued_at"
									type="date"
								/><input name="expires_at" type="date" /><select name="status"
									><option value="active">Active</option><option value="pending">Pending</option
									><option value="expired">Expired</option></select
								><button type="submit">Add</button>
							</form>
						{/if}
						<div class="record-list">
							{#each data.hrPos.certifications as cert}<div class="record-row">
									<div>
										<strong>{cert.title}</strong><span
											>{cert.issuer || cert.certification_type} | {formatRecordDate(
												cert.expires_at
											)}</span
										>
									</div>
									{#if data.canEditHrRecords}<form
											method="POST"
											action="?/delete_certification"
											use:enhance={withFeedback}
										>
											<input type="hidden" name="certification_id" value={cert.id} /><button
												type="submit"
												class="danger-link">Delete</button
											>
										</form>{/if}
								</div>{:else}<p class="section-note">No certifications.</p>{/each}
						</div>
					</section>
					<section class="record-panel">
						<header>
							<strong>Verification</strong><span>{data.hrPos.verificationChecks.length}</span>
						</header>
						{#if data.canEditHrRecords}
							<form
								method="POST"
								action="?/add_verification_check"
								use:enhance={withFeedback}
								class="mini-form"
							>
								<input type="hidden" name="user_id" value={data.employee.id} /><input
									name="check_type"
									placeholder="Check type"
									required
								/><input name="provider_reference" placeholder="Reference" /><select name="status"
									><option value="pending">Pending</option><option value="approved">Approved</option
									><option value="failed">Failed</option></select
								><input name="result_summary" placeholder="Result" /><button type="submit"
									>Add</button
								>
							</form>
						{/if}
						<div class="record-list">
							{#each data.hrPos.verificationChecks as check}{#if data.canEditHrRecords}<form
										method="POST"
										action="?/update_verification_check"
										use:enhance={withFeedback}
										class="record-row editable-row"
									>
										<input type="hidden" name="check_id" value={check.id} />
										<div>
											<strong>{formatStatus(check.check_type)}</strong><span
												>{check.provider_reference || 'No reference'} | {formatRecordDate(
													check.reviewed_at
												)}</span
											>
										</div>
										<select name="status"
											><option value="pending" selected={check.status === 'pending'}>Pending</option
											><option value="approved" selected={check.status === 'approved'}
												>Approved</option
											><option value="failed" selected={check.status === 'failed'}>Failed</option
											></select
										><input
											name="result_summary"
											value={check.result_summary}
											placeholder="Result"
										/><button type="submit">Save</button>
									</form>{:else}<div class="record-row">
										<div>
											<strong>{formatStatus(check.check_type)}</strong><span
												>{check.provider_reference || 'No reference'} | {formatStatus(
													check.status
												)}</span
											>
										</div>
										<span>{check.result_summary || 'No result recorded'}</span>
									</div>{/if}{:else}<p class="section-note">No checks.</p>{/each}
						</div>
					</section>
				</div>
			</section>
			<section class="workspace-section">
				<header class="section-head">
					<div>
						<span class="kicker">Documents</span>
						<h2>Employment records</h2>
					</div>
					<span>{data.hrPos.complianceDocuments.length}</span>
				</header>
				<div class="record-list">
					{#each data.hrPos.complianceDocuments as document}<div class="record-row">
							<div>
								<strong>{formatStatus(document.document_type)}</strong><span
									>{formatStatus(document.status)} | {formatDateTime(
										document.reviewed_at ?? document.submitted_at
									)}</span
								>
							</div>
							{#if document.file_url}<a href={document.file_url} target="_blank">View</a>{/if}
						</div>{:else}<p class="section-note">No employment documents.</p>{/each}
				</div>
			</section>
		{:else if data.activeSection === 'access'}
			<section class="workspace-section">
				<header class="section-head">
					<div>
						<span class="kicker">Application</span>
						<h2>Role and permissions</h2>
					</div>
				</header>
				<div class="split-workspace access-workspace">
					<form
						method="POST"
						action="?/update_permissions"
						use:enhance={withFeedback}
						class="record-panel"
					>
						<input type="hidden" name="user_id" value={data.employee.id} />
						<label><span>Position</span><select name="position_id" disabled={!data.canEditPermissions} required>
							<option value="" selected={!data.employee.position_id}>Choose position</option>
							{#each data.positions as position}<option
								value={position.id}
								selected={position.id === data.employee.position_id}
								disabled={position.account_type === 'manager' && !data.canManageManagerAccess}
								>{position.name} ({businessRoleLabel(position.account_type)})</option>{/each}
						</select></label>
						<button type="submit" disabled={!data.canEditPermissions}>Save Position</button>
					</form>
					<form
						method="POST"
						action="?/update_capabilities"
						use:enhance={withFeedback}
						class="record-panel"
					>
						<input type="hidden" name="user_id" value={data.employee.id} />
						<div class="capability-list">
							{#each businessCapabilityOptions as capability}<label class="check-row"
									><input
										type="checkbox"
										name="capabilities"
										value={capability.value}
										checked={hasCapability(capability.value)}
										disabled={!data.canEditPermissions ||
											!data.editableCapabilities.includes(capability.value)}
									/><span>{capability.label}</span></label
								>{/each}
						</div>
						<button type="submit" disabled={!data.canEditPermissions}>Save Access</button>
					</form>
				</div>
			</section>
			{#if data.hrPos && data.canManageHrPos}
				<section class="workspace-section">
					<header class="section-head">
						<div>
							<span class="kicker">Operational Access</span>
							<h2>POS and HR</h2>
						</div>
						<form method="POST" action="?/toggle_hr_access" use:enhance={withFeedback}>
							<input type="hidden" name="user_id" value={data.employee.id} /><button type="submit"
								>{data.hrPos.directHrAccess ? 'Remove HR Access' : 'Grant HR Access'}</button
							>
						</form>
					</header>
					<form
						method="POST"
						action="?/save_pos_permissions"
						use:enhance={withFeedback}
						class="pos-form"
					>
						<input type="hidden" name="user_id" value={data.employee.id} /><label
							><span>POS ID</span><input
								name="pos_external_id"
								value={data.hrPos.pos.pos_external_id}
								placeholder="Optional"
							/></label
						>
						<div class="capability-list">
							<label class="check-row"
								><input
									type="checkbox"
									name="can_clock_in"
									checked={data.hrPos.pos.can_clock_in === 1}
								/><span>Clock in</span></label
							><label class="check-row"
								><input
									type="checkbox"
									name="can_use_pos"
									checked={data.hrPos.pos.can_use_pos === 1}
								/><span>Use POS</span></label
							><label class="check-row"
								><input
									type="checkbox"
									name="can_open_cash_drawer"
									checked={data.hrPos.pos.can_open_cash_drawer === 1}
								/><span>Cash drawer</span></label
							><label class="check-row"
								><input
									type="checkbox"
									name="can_refund"
									checked={data.hrPos.pos.can_refund === 1}
								/><span>Refunds</span></label
							><label class="check-row"
								><input
									type="checkbox"
									name="can_void"
									checked={data.hrPos.pos.can_void === 1}
								/><span>Voids</span></label
							><label class="check-row"
								><input
									type="checkbox"
									name="can_manager_override"
									checked={data.hrPos.pos.can_manager_override === 1}
								/><span>Manager override</span></label
							>
						</div>
						<button type="submit">Save POS</button>
					</form>
				</section>
			{/if}
		{:else if data.activeSection === 'activity' && data.hrPos}
			<section class="workspace-section">
				<header class="section-head">
					<div>
						<span class="kicker">Audit</span>
						<h2>Sensitive record activity</h2>
					</div>
					<span>{data.hrPos.documentAudit.length}</span>
				</header>
				<div class="record-list">
					{#each data.hrPos.documentAudit as entry}<div class="record-row">
							<strong>{formatStatus(entry.action)}</strong><span
								>{entry.actor_name || entry.actor_email || 'System'} | {formatDateTime(
									entry.created_at
								)}</span
							>
						</div>{:else}<p class="section-note">No document activity.</p>{/each}
				</div>
			</section>
		{/if}
	</section>
</Layout>

<style>
	.people-nav-wrap {
		margin-top: 0.55rem;
	}
	.employee-shell {
		display: grid;
		gap: 0;
		margin-top: 0.7rem;
		border-top: 1px solid var(--color-divider);
	}
	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		width: fit-content;
		padding: 0.65rem 0;
		color: var(--color-text-muted);
		font-size: 0.78rem;
		font-weight: var(--weight-semibold);
		text-decoration: none;
	}
	.back-link .material-icons {
		font-size: 1rem;
	}
	.employee-hero {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.8rem 0 1rem;
		border-bottom: 1px solid var(--color-divider);
	}
	.employee-identity {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		min-width: 0;
	}
	.profile-avatar {
		width: 3.25rem;
		height: 3.25rem;
		display: grid;
		place-items: center;
		background: var(--color-text);
		color: var(--color-surface);
		font-size: 1.25rem;
		font-weight: var(--weight-bold);
	}
	.employee-identity h1 {
		margin: 0;
		color: var(--color-text);
		font-size: clamp(1.35rem, 3vw, 1.9rem);
		letter-spacing: -0.04em;
	}
	.employee-identity p {
		margin: 0.2rem 0 0;
		color: var(--color-text-muted);
		overflow-wrap: anywhere;
	}
	.employee-summary {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.4rem 0.9rem;
		color: var(--color-text-muted);
		font-size: 0.74rem;
		font-weight: var(--weight-semibold);
	}
	.employee-summary span + span {
		padding-left: 0.9rem;
		border-left: 1px solid var(--color-divider);
	}
	.record-nav {
		display: flex;
		gap: 1.15rem;
		overflow-x: auto;
		border-bottom: 1px solid var(--color-divider);
		scrollbar-width: thin;
	}
	.record-nav a {
		position: relative;
		flex: 0 0 auto;
		padding: 0.8rem 0;
		color: var(--color-text-muted);
		font-size: 0.78rem;
		font-weight: var(--weight-semibold);
		text-decoration: none;
	}
	.record-nav a.active {
		color: var(--color-text);
		font-weight: var(--weight-bold);
	}
	.record-nav a.active::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 2px;
		background: var(--color-text);
	}
	.workspace-section {
		padding: clamp(1rem, 2.5vw, 1.5rem) 0;
		border-bottom: 1px solid var(--color-divider);
	}
	.section-head {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.section-head h2 {
		margin: 0.18rem 0 0;
		color: var(--color-text);
		font-size: 1.2rem;
	}
	.section-head > span,
	.record-panel header span {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}
	.kicker,
	label > span,
	.record-grid span,
	.item-type {
		color: var(--color-text-muted);
		font-size: 0.67rem;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.record-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border-top: 1px solid var(--color-divider);
	}
	.record-grid > div {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
		padding: 0.8rem;
		border-bottom: 1px solid var(--color-divider);
		border-right: 1px solid var(--color-divider);
	}
	.record-grid > div:nth-child(4n) {
		border-right: 0;
	}
	.record-grid strong {
		overflow-wrap: anywhere;
	}
	.sensitive-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 1rem;
	}
	.sensitive-grid > div:nth-child(4n) {
		border-right: 1px solid var(--color-divider);
	}
	.sensitive-grid > div:nth-child(3n) {
		border-right: 0;
	}
	.section-note {
		margin: 0.8rem 0 0;
		color: var(--color-text-muted);
		font-size: 0.82rem;
		line-height: 1.55;
	}
	.employment-form,
	.packet-form {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}
	label {
		display: grid;
		gap: 0.28rem;
	}
	.employment-form > button,
	.packet-form > button,
	.packet-form .wide {
		grid-column: 1 / -1;
	}
	.department-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.department-list button {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		opacity: 0.64;
	}
	.department-list button.active {
		opacity: 1;
		font-weight: var(--weight-bold);
	}
	.department-list .material-icons {
		font-size: 1rem;
	}
	.role-access-form {
		display: grid;
		gap: 0.85rem;
		margin-top: 1.2rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-divider);
	}
	.role-mode {
		max-width: 25rem;
	}
	.role-groups {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}
	fieldset {
		display: grid;
		align-content: start;
		gap: 0.38rem;
		margin: 0;
		padding: 0.7rem 0;
		border: 0;
		border-top: 1px solid var(--color-divider);
	}
	legend {
		padding: 0 0 0.45rem;
		font-weight: var(--weight-bold);
	}
	.check-row {
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.48rem;
		color: var(--color-text);
		font-size: 0.8rem;
	}
	.check-row input {
		width: 0.95rem;
		min-height: 0.95rem;
		accent-color: var(--color-text);
	}
	.line-form {
		margin-top: 0.85rem;
	}
	.packet-summary {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.packet-summary > div:nth-child(4n) {
		border-right: 1px solid var(--color-divider);
	}
	.packet-summary > div:nth-child(3n) {
		border-right: 0;
	}
	.manager-note {
		padding: 0.7rem 0;
		border-bottom: 1px solid var(--color-divider);
		color: var(--color-text-muted);
	}
	.onboarding-list {
		display: grid;
	}
	.onboarding-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.8rem 1rem;
		padding: 0.9rem 0;
		border-bottom: 1px solid var(--color-divider);
	}
	.onboarding-item h3,
	.onboarding-item p {
		margin: 0.2rem 0 0;
	}
	.onboarding-item p,
	.item-status span {
		color: var(--color-text-muted);
		font-size: 0.8rem;
	}
	.item-status {
		display: grid;
		justify-items: end;
		align-content: start;
		gap: 0.2rem;
		text-align: right;
	}
	.onboarding-item :global(.form-preview) {
		grid-column: 1 / -1;
	}
	.i9-verification {
		margin-top: 1rem;
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}
	.i9-verification summary {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 0;
		cursor: pointer;
	}
	.verification-record {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		padding: 0.8rem 0;
	}
	.review-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		padding-top: 1rem;
	}
	.review-actions form {
		display: flex;
		gap: 0.55rem;
	}
	.split-workspace {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.2rem;
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
	.record-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.8rem;
	}
	.mini-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.record-list {
		display: grid;
	}
	.record-row {
		min-width: 0;
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--color-divider);
	}
	.record-row:last-child {
		border-bottom: 0;
	}
	.record-row > div {
		display: grid;
		gap: 0.18rem;
		min-width: 0;
	}
	.record-row span {
		color: var(--color-text-muted);
		font-size: 0.75rem;
		overflow-wrap: anywhere;
	}
	.editable-row {
		display: grid;
		grid-template-columns: minmax(10rem, 1fr) minmax(7rem, 0.5fr) minmax(8rem, 0.8fr) auto;
	}
	.capability-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem 0.8rem;
	}
	.pos-form {
		display: grid;
		gap: 0.8rem;
		max-width: 48rem;
	}
	.danger-zone {
		border-bottom: 0;
	}
	.danger-link {
		color: var(--color-danger-text);
	}
	@media (max-width: 800px) {
		.employee-hero {
			align-items: flex-start;
			flex-direction: column;
		}
		.employee-summary {
			justify-content: flex-start;
		}
		.record-grid,
		.sensitive-grid,
		.employment-form,
		.packet-form,
		.role-groups,
		.split-workspace {
			grid-template-columns: 1fr;
		}
		.record-grid > div,
		.sensitive-grid > div,
		.record-grid > div:nth-child(3n),
		.record-grid > div:nth-child(4n) {
			border-right: 0;
		}
		.editable-row {
			grid-template-columns: 1fr;
			align-items: stretch;
		}
		.capability-list {
			grid-template-columns: 1fr;
		}
		.section-head {
			align-items: flex-start;
		}
	}
</style>

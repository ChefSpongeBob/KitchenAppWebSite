<script lang="ts">
	import Layout from '$lib/components/ui/Layout.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import PeopleHrNav from '$lib/components/ui/PeopleHrNav.svelte';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { pushToast } from '$lib/client/toasts';
	import {
		businessCapabilityOptions,
		businessRoleLabel,
		isBusinessAdminRole,
		resolveBusinessCapabilities,
		type BusinessCapability,
		type BusinessCapabilityOverrides
	} from '$lib/auth/roles';
	import type { SubmitFunction } from '@sveltejs/kit';

	type UserOption = {
		id: string;
		display_name: string | null;
		email: string;
		role: string;
		permission_template: string;
		position_id: string | null;
		position_name: string | null;
		is_active: number;
		approved_departments: string[];
		effective_capabilities: string[];
	};

	type BusinessPosition = {
		id: string;
		name: string;
		description: string;
		account_type: 'manager' | 'staff' | 'external';
		base_template: string;
		is_active: number;
		capability_overrides: BusinessCapabilityOverrides;
		effective_capabilities: BusinessCapability[];
	};

	type OnboardingRow = {
		user_id: string;
		display_name: string | null;
		email: string;
		package_status: 'not_sent' | 'sent' | 'in_progress' | 'submitted' | 'returned' | 'approved';
		total_items: number;
		approved_items: number;
		needs_changes_items: number;
	};

	type CertificationRow = {
		id: string;
		user_id: string;
		employee_name: string | null;
		employee_email: string;
		title: string;
		expires_at: number | null;
		status: string;
	};

	type VerificationRow = {
		id: string;
		user_id: string;
		employee_name: string | null;
		employee_email: string;
		check_type: string;
		status: string;
	};

	type DocumentRow = {
		id: string;
		user_id: string;
		employee_name: string | null;
		employee_email: string;
		document_type: string;
		status: string;
		submitted_at: number | null;
	};

	export let data: {
		activeView: 'overview' | 'team' | 'hr' | 'access';
		users: UserOption[];
		positions: BusinessPosition[];
		onboardingRows: OnboardingRow[];
		expiringCertifications: CertificationRow[];
		pendingVerifications: VerificationRow[];
		pendingDocuments: DocumentRow[];
		canReviewOnboarding: boolean;
		canManageOnboarding: boolean;
		canViewSensitive: boolean;
		canManagePermissions: boolean;
		canManageManagers: boolean;
		actorIsOwner: boolean;
		actorPositionId: string | null;
		editableCapabilities: BusinessCapability[];
	};

	let staffSearch = '';
	let newPositionAccountType: BusinessPosition['account_type'] = 'staff';

	$: activeUsers = data.users.filter((user) => user.is_active === 1);
	$: managerUsers = activeUsers.filter((user) => isBusinessAdminRole(user.role));
	$: onboardingReview = data.onboardingRows.filter((row) => row.package_status === 'submitted');
	$: onboardingInProgress = data.onboardingRows.filter((row) =>
		['sent', 'in_progress', 'returned'].includes(row.package_status)
	);
	$: onboardingMissing = data.onboardingRows.filter((row) => row.package_status === 'not_sent');
	$: filteredStaff = data.users.filter((user) => {
		const query = staffSearch.trim().toLowerCase();
		if (!query) return true;
		return [
			user.display_name ?? '',
			user.email,
			user.role,
			user.position_name ?? '',
			...user.approved_departments
		]
			.join(' ')
			.toLowerCase()
			.includes(query);
	});

	const displayName = (user: { display_name: string | null; email: string }) =>
		user.display_name?.trim() || user.email;
	const initialsFor = (user: UserOption) => displayName(user).charAt(0).toUpperCase();
	const departmentSummary = (user: UserOption) =>
		user.approved_departments.length
			? user.approved_departments.join(', ')
			: 'No schedule departments';
	const formatStatus = (value: string) =>
		value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	const formatDate = (value: number | null) =>
		value ? new Date(value * 1000).toLocaleDateString([], { dateStyle: 'medium' }) : 'No date';
	const accountTypeLabel = (value: BusinessPosition['account_type']) =>
		value === 'staff' ? 'Team Member' : value === 'manager' ? 'Manager' : 'External';
	const defaultPositionCapabilities = (accountType: BusinessPosition['account_type']) =>
		resolveBusinessCapabilities(
			accountType,
			accountType === 'manager' ? 'general_manager' : accountType === 'external' ? 'contractor' : 'staff'
		);
	const canEditPosition = (position: BusinessPosition) =>
		position.id !== data.actorPositionId &&
		(position.account_type !== 'manager' || data.canManageManagers);
	const withFeedback: SubmitFunction = () => async ({ result }) => {
		await applyAction(result);
		if (result.type === 'success') {
			await invalidateAll();
			pushToast(result.data?.message ?? 'Position updated.', 'success');
		} else if (result.type === 'failure') {
			pushToast(result.data?.error ?? 'That position change could not be saved.', 'error');
		}
	};
</script>

<Layout>
	<PageHeader title="People & HR" />

	<section class="people-board">
		<PeopleHrNav
			active={data.activeView}
			canReviewOnboarding={data.canReviewOnboarding}
			canViewSensitive={data.canViewSensitive}
			canManagePermissions={data.canManagePermissions}
		/>

		{#if data.activeView === 'overview'}
			<section class="overview-strip" aria-label="People and HR overview">
				<div><span>Active Team</span><strong>{activeUsers.length}</strong></div>
				<div><span>Managers</span><strong>{managerUsers.length}</strong></div>
				<div><span>Needs Review</span><strong>{onboardingReview.length}</strong></div>
				<div><span>In Progress</span><strong>{onboardingInProgress.length}</strong></div>
			</section>

			<section class="overview-grid">
				<div class="workspace-section">
					<header class="section-toolbar">
						<div>
							<span class="kicker">Attention</span>
							<h2>HR queue</h2>
						</div>
						{#if data.canReviewOnboarding}<a href="/admin/onboarding">Open Onboarding</a>{/if}
					</header>
					<div class="queue-list">
						{#if onboardingReview.length === 0 && onboardingMissing.length === 0}
							<p class="empty">No onboarding items need attention.</p>
						{:else}
							{#each onboardingReview.slice(0, 6) as row}
								<a href={`/admin/users/${row.user_id}?section=onboarding`}>
									<span
										><strong>{displayName(row)}</strong><small>Packet ready for review</small></span
									>
									<em>Review</em>
								</a>
							{/each}
							{#each onboardingMissing.slice(0, 4) as row}
								<a href={`/admin/users/${row.user_id}?section=onboarding`}>
									<span><strong>{displayName(row)}</strong><small>No onboarding packet</small></span
									>
									<em>Open</em>
								</a>
							{/each}
						{/if}
					</div>
				</div>

				<aside class="quick-actions" aria-label="People and HR actions">
					<span class="kicker">Actions</span>
					{#if data.canManageOnboarding}<a href="/admin/onboarding#invites">Invite Employee</a>{/if}
					{#if data.canManageOnboarding}<a href="/admin/onboarding#packets">Send Packet</a>{/if}
					<a href="/admin/users?view=team">Search Team</a>
					{#if data.canViewSensitive}<a href="/admin/users?view=hr">Review Compliance</a>{/if}
				</aside>
			</section>

			<section class="workspace-section team-preview">
				<header class="section-toolbar">
					<div>
						<span class="kicker">Directory</span>
						<h2>Team</h2>
					</div>
					<a href="/admin/users?view=team">View All</a>
				</header>
				<div class="compact-team">
					{#each activeUsers.slice(0, 8) as user}
						<a href={`/admin/users/${user.id}?section=profile`}>
							<span class="avatar">{initialsFor(user)}</span>
							<span
								><strong>{displayName(user)}</strong><small
									>{user.position_name || businessRoleLabel(user.role)} | {departmentSummary(user)}</small
								></span
							>
						</a>
					{/each}
				</div>
			</section>
		{:else if data.activeView === 'team'}
			<section class="workspace-section">
				<header class="section-toolbar">
					<div>
						<span class="kicker">Directory</span>
						<h2>Current Team</h2>
					</div>
					<label class="search-box">
						<span>Search</span>
						<input
							bind:value={staffSearch}
							type="search"
							placeholder="Name, email, role, department"
						/>
					</label>
				</header>

				<div class="staff-table" aria-label="Staff roster">
					<div class="table-header">
						<span>Employee</span><span>Access</span><span>Assignments</span><span></span>
					</div>
					{#if filteredStaff.length === 0}
						<p class="empty table-empty">No employees match that search.</p>
					{:else}
						{#each filteredStaff as user}
							<div class="staff-row">
								<a href={`/admin/users/${user.id}?section=profile`} class="staff-identity">
									<span class="avatar">{initialsFor(user)}</span>
									<span><strong>{displayName(user)}</strong><small>{user.email}</small></span>
								</a>
								<span
									><strong>{user.position_name || businessRoleLabel(user.role)}</strong><small
										>{businessRoleLabel(user.role)}</small
									></span
								>
								<span
									><strong>{departmentSummary(user)}</strong><small
										>{user.is_active ? 'Active' : 'Inactive'}</small
									></span
								>
								<a href={`/admin/users/${user.id}?section=profile`} class="inline-action">Open</a>
							</div>
						{/each}
					{/if}
				</div>
			</section>
		{:else if data.activeView === 'hr'}
			<section class="hr-grid">
				<div class="workspace-section">
					<header class="section-toolbar">
						<div>
							<span class="kicker">Onboarding</span>
							<h2>Packet review</h2>
						</div>
					</header>
					<div class="queue-list">
						{#if onboardingReview.length === 0}
							<p class="empty">No submitted packets are waiting.</p>
						{:else}
							{#each onboardingReview as row}
								<a href={`/admin/users/${row.user_id}?section=onboarding`}>
									<span
										><strong>{displayName(row)}</strong><small
											>{row.approved_items}/{row.total_items} approved</small
										></span
									>
									<em>Review</em>
								</a>
							{/each}
						{/if}
					</div>
				</div>

				<div class="workspace-section">
					<header class="section-toolbar">
						<div>
							<span class="kicker">Certifications</span>
							<h2>Expiring soon</h2>
						</div>
					</header>
					<div class="queue-list">
						{#if data.expiringCertifications.length === 0}<p class="empty">
								No certifications expire within 45 days.
							</p>{/if}
						{#each data.expiringCertifications as item}
							<a href={`/admin/users/${item.user_id}?section=documents`}>
								<span
									><strong>{item.employee_name || item.employee_email}</strong><small
										>{item.title}</small
									></span
								>
								<em>{formatDate(item.expires_at)}</em>
							</a>
						{/each}
					</div>
				</div>

				<div class="workspace-section">
					<header class="section-toolbar">
						<div>
							<span class="kicker">Verification</span>
							<h2>Open checks</h2>
						</div>
					</header>
					<div class="queue-list">
						{#if data.pendingVerifications.length === 0}<p class="empty">
								No verification checks are open.
							</p>{/if}
						{#each data.pendingVerifications as item}
							<a href={`/admin/users/${item.user_id}?section=documents`}>
								<span
									><strong>{item.employee_name || item.employee_email}</strong><small
										>{formatStatus(item.check_type)}</small
									></span
								>
								<em>{formatStatus(item.status)}</em>
							</a>
						{/each}
					</div>
				</div>

				<div class="workspace-section">
					<header class="section-toolbar">
						<div>
							<span class="kicker">Documents</span>
							<h2>Needs attention</h2>
						</div>
					</header>
					<div class="queue-list">
						{#if data.pendingDocuments.length === 0}<p class="empty">
								No employee documents need attention.
							</p>{/if}
						{#each data.pendingDocuments as item}
							<a href={`/admin/users/${item.user_id}?section=documents`}>
								<span
									><strong>{item.employee_name || item.employee_email}</strong><small
										>{formatStatus(item.document_type)}</small
									></span
								>
								<em>{formatStatus(item.status)}</em>
							</a>
						{/each}
					</div>
				</div>
			</section>
		{:else if data.activeView === 'access'}
			<section class="workspace-section position-workspace">
				<header class="section-toolbar">
					<div><span class="kicker">Defaults</span><h2>Positions</h2></div>
				</header>
				<details class="position-editor create-position">
					<summary>+ New position</summary>
					<form method="POST" action="?/create_position" use:enhance={withFeedback}>
						<div class="position-fields">
							<label><span>Name</span><input name="name" required maxlength="80" /></label>
							<label><span>Account type</span><select name="account_type" bind:value={newPositionAccountType}>
								<option value="staff">Team Member</option>
								<option value="manager" disabled={!data.canManageManagers}>Manager</option>
								<option value="external">External</option>
							</select></label>
							<label class="wide"><span>Description</span><input name="description" maxlength="240" /></label>
						</div>
						<div class="permission-grid">
							{#each businessCapabilityOptions as capability}
								<label class="permission-option"><input type="checkbox" name="capabilities" value={capability.value}
									checked={defaultPositionCapabilities(newPositionAccountType).includes(capability.value)}
									disabled={!data.editableCapabilities.includes(capability.value)} /><span>{capability.label}</span></label>
							{/each}
						</div>
						<button type="submit">Create Position</button>
					</form>
				</details>
				<div class="position-list">
					{#each data.positions as position}
						<details class="position-editor" class:archived={position.is_active !== 1}>
							<summary><span><strong>{position.name}</strong><small>{accountTypeLabel(position.account_type)} | {position.effective_capabilities.length} permissions</small></span><em>{position.is_active === 1 ? 'Active' : 'Archived'}</em></summary>
							<form method="POST" action="?/update_position" use:enhance={withFeedback}>
								<input type="hidden" name="position_id" value={position.id} />
								<div class="position-fields">
									<label><span>Name</span><input name="name" value={position.name} required maxlength="80" disabled={!canEditPosition(position)} /></label>
									<label><span>Account type</span><select name="account_type" disabled={!canEditPosition(position)}>
										<option value="staff" selected={position.account_type === 'staff'}>Team Member</option>
										<option value="manager" selected={position.account_type === 'manager'} disabled={!data.canManageManagers}>Manager</option>
										<option value="external" selected={position.account_type === 'external'}>External</option>
									</select></label>
									<label class="wide"><span>Description</span><input name="description" value={position.description} maxlength="240" disabled={!canEditPosition(position)} /></label>
								</div>
								<div class="permission-grid">
									{#each businessCapabilityOptions as capability}
										<label class="permission-option"><input type="checkbox" name="capabilities" value={capability.value}
											checked={position.effective_capabilities.includes(capability.value)}
											disabled={!canEditPosition(position) || !data.editableCapabilities.includes(capability.value)} /><span>{capability.label}</span></label>
									{/each}
								</div>
								{#if canEditPosition(position)}<button type="submit">Save Position</button>{/if}
							</form>
							{#if canEditPosition(position)}
								<form method="POST" action="?/toggle_position" use:enhance={withFeedback} class="position-toggle">
									<input type="hidden" name="position_id" value={position.id} />
									<button type="submit">{position.is_active === 1 ? 'Archive' : 'Restore'}</button>
								</form>
							{/if}
						</details>
					{/each}
				</div>
			</section>
			<section class="workspace-section">
				<header class="section-toolbar">
					<div>
						<span class="kicker">Access</span>
						<h2>Employee permissions</h2>
					</div>
					<label class="search-box"
						><span>Search</span><input
							bind:value={staffSearch}
							type="search"
							placeholder="Name, position, department"
						/></label
					>
				</header>
				<div class="staff-table access-table">
					<div class="table-header">
						<span>Employee</span><span>Position</span><span>Capabilities</span><span></span>
					</div>
					{#each filteredStaff as user}
						<div class="staff-row">
							<span class="staff-identity"
								><span class="avatar">{initialsFor(user)}</span><span
									><strong>{displayName(user)}</strong><small>{user.email}</small></span
								></span
							>
							<span
								><strong>{user.position_name || 'Unassigned'}</strong><small
									>{businessRoleLabel(user.role)}</small
								></span
							>
							<span
								><strong>{user.effective_capabilities.length} enabled</strong><small
									>{departmentSummary(user)}</small
								></span
							>
							<a href={`/admin/users/${user.id}?section=access`} class="inline-action">Manage</a>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</section>
</Layout>

<style>
	.people-board,
	.workspace-section,
	.overview-grid,
	.hr-grid,
	.quick-actions,
	.queue-list,
	.compact-team {
		display: grid;
	}
	.people-board {
		gap: 1rem;
		margin-top: 0.65rem;
	}
	.overview-strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}
	.overview-strip div {
		display: grid;
		gap: 0.2rem;
		padding: 0.8rem 1rem;
		border-right: 1px solid var(--color-divider);
	}
	.overview-strip div:last-child {
		border-right: 0;
	}
	.overview-strip span,
	.kicker,
	.search-box span,
	.table-header {
		color: var(--color-text-muted);
		font-size: 0.68rem;
		font-weight: var(--weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.overview-strip strong {
		font-size: 1.45rem;
		letter-spacing: -0.04em;
	}
	.overview-grid {
		grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.3fr);
		gap: 1.5rem;
	}
	.hr-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.5rem;
	}
	.workspace-section {
		align-content: start;
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
		padding: 1rem 0;
	}
	.section-toolbar {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.75rem;
	}
	.section-toolbar h2 {
		margin: 0.15rem 0 0;
		font-size: clamp(1.1rem, 2vw, 1.4rem);
		letter-spacing: -0.035em;
	}
	.section-toolbar > a,
	.quick-actions a,
	.inline-action {
		color: var(--color-text);
		font-size: 0.74rem;
		font-weight: var(--weight-semibold);
		text-decoration: none;
		border-bottom: 1px solid var(--color-divider-strong);
	}
	.quick-actions {
		align-content: start;
		gap: 0.25rem;
		padding: 1rem 0;
		border-top: 1px solid var(--color-divider);
		border-bottom: 1px solid var(--color-divider);
	}
	.quick-actions a {
		padding: 0.72rem 0;
	}
	.queue-list a,
	.compact-team a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-width: 0;
		padding: 0.7rem 0;
		border-top: 1px solid var(--color-divider);
		color: var(--color-text);
		text-decoration: none;
	}
	.queue-list a > span,
	.compact-team a > span:last-child,
	.staff-row > span,
	.staff-identity > span:last-child {
		display: grid;
		min-width: 0;
		gap: 0.12rem;
	}
	.queue-list small,
	.compact-team small,
	.staff-row small,
	.empty {
		color: var(--color-text-muted);
		font-size: 0.76rem;
		overflow-wrap: anywhere;
	}
	.queue-list em {
		color: var(--color-text-muted);
		font-size: 0.7rem;
		font-style: normal;
		text-transform: uppercase;
	}
	.compact-team {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 1.5rem;
	}
	.compact-team a {
		justify-content: start;
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 2.15rem;
		height: 2.15rem;
		flex: 0 0 auto;
		border: 1px solid var(--color-divider-strong);
		border-radius: 50%;
		font-size: 0.72rem;
		font-weight: var(--weight-semibold);
	}
	.search-box {
		display: grid;
		gap: 0.25rem;
		min-width: min(22rem, 100%);
	}
	.search-box input {
		width: 100%;
		min-height: 2.35rem;
		padding: 0.35rem 0;
		border: 0;
		border-bottom: 1px solid var(--color-divider-strong);
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
	}
	.staff-table {
		display: grid;
	}
	.table-header,
	.staff-row {
		display: grid;
		grid-template-columns: minmax(13rem, 1.25fr) minmax(9rem, 0.7fr) minmax(12rem, 1fr) auto;
		align-items: center;
		gap: 1rem;
	}
	.table-header {
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--color-divider-strong);
	}
	.staff-row {
		min-height: 4.2rem;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--color-divider);
	}
	.staff-identity {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-width: 0;
		color: var(--color-text);
		text-decoration: none;
	}
	.staff-row strong {
		overflow-wrap: anywhere;
	}
	.table-empty {
		padding: 1rem 0;
	}
	.position-workspace {
		gap: 0;
	}
	.position-list {
		display: grid;
	}
	.position-editor {
		border-top: 1px solid var(--color-divider);
		padding: 0.7rem 0;
	}
	.position-editor:last-child {
		border-bottom: 1px solid var(--color-divider);
	}
	.position-editor.archived {
		opacity: 0.68;
	}
	.position-editor summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
	}
	.position-editor summary::-webkit-details-marker {
		display: none;
	}
	.position-editor summary > span,
	.position-editor form,
	.position-fields label {
		display: grid;
		gap: 0.25rem;
	}
	.position-editor summary small,
	.position-editor summary em,
	.position-fields label > span {
		color: var(--color-text-muted);
		font-size: 0.72rem;
		font-style: normal;
	}
	.position-editor form {
		gap: 1rem;
		padding: 1rem 0 0;
	}
	.position-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem 1.25rem;
	}
	.position-fields .wide {
		grid-column: 1 / -1;
	}
	.position-fields input,
	.position-fields select {
		min-height: 2.3rem;
		border: 0;
		border-bottom: 1px solid var(--color-divider-strong);
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
	}
	.permission-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.45rem 1rem;
	}
	.permission-option {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
	}
	.permission-option input {
		width: 0.9rem;
		height: 0.9rem;
	}
	.position-toggle {
		padding-top: 0.4rem !important;
	}
	@media (max-width: 900px) {
		.overview-grid,
		.hr-grid {
			grid-template-columns: 1fr;
		}
		.table-header {
			display: none;
		}
		.staff-row {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 0.65rem;
		}
		.staff-row > span:not(.staff-identity),
		.staff-row > a.staff-identity {
			grid-column: 1;
		}
		.staff-row > .inline-action {
			grid-column: 2;
			grid-row: 1;
		}
		.permission-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 620px) {
		.overview-strip,
		.compact-team {
			grid-template-columns: 1fr;
		}
		.overview-strip div {
			border-right: 0;
			border-bottom: 1px solid var(--color-divider);
		}
		.overview-strip div:last-child {
			border-bottom: 0;
		}
		.section-toolbar {
			align-items: stretch;
			flex-direction: column;
		}
		.search-box {
			min-width: 0;
		}
		.position-fields,
		.permission-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

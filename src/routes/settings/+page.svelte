<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
  import AvailabilityEditor from '$lib/components/ui/AvailabilityEditor.svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { pushToast } from '$lib/client/toasts';
  import { type ScheduleDepartment } from '$lib/assets/schedule';
  import type { SubmitFunction } from '@sveltejs/kit';

  type Profile = {
    real_name: string;
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

  type AvailabilityEntry = {
    weekday: number;
    isAvailable: boolean;
    startTime: string;
    endTime: string;
  };

  type PendingBirthdayRequest = {
    requested_birthday: string;
    requested_at: number;
  } | null;

  type EmployeeOnboardingPackage = {
    id: string;
    status: 'sent' | 'in_progress' | 'submitted' | 'approved';
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

  export let data: {
    activeTab: string;
    user: {
      id: string;
      username: string;
      email: string;
    };
    profile: Profile;
    onboarding: {
      package: EmployeeOnboardingPackage | null;
      items: EmployeeOnboardingItem[];
    };
    approvedDepartments: ScheduleDepartment[];
    availability: AvailabilityEntry[];
    preferences: {
      emailUpdates: boolean;
      smsUpdates: boolean;
      darkMode: boolean;
      language: string;
    };
    sessions: {
      id: string;
      deviceName: string | null;
      platform: string | null;
      userAgent: string | null;
      lastSeenAt: number;
      expiresAt: number;
      revokedAt: number | null;
      current: boolean;
    }[];
    pendingBirthdayRequest: PendingBirthdayRequest;
  };

  const tabs = ['availability', 'profile', 'onboarding', 'app'] as const;
  type TabKey = (typeof tabs)[number];

  function normalizeTab(value: string): TabKey {
    if (value === 'personal' || value === 'contact') return 'profile';
    return tabs.includes(value as TabKey) ? (value as TabKey) : 'profile';
  }

  let activeTab: TabKey = normalizeTab(data.activeTab);

  let availabilityEntries = data.availability.map((entry) => ({ ...entry }));
  let availabilitySeed = JSON.stringify(data.availability);

  const withFeedback: SubmitFunction = () => {
    return async ({ result }) => {
      await applyAction(result);
      if (result.type === 'success') {
        await invalidateAll();
        pushToast(result.data?.message ?? 'Saved.', 'success');
      } else if (result.type === 'failure') {
        pushToast(result.data?.error ?? 'That update could not be saved.', 'error');
      }
    };
  };

  $: if (JSON.stringify(data.availability) !== availabilitySeed) {
    availabilitySeed = JSON.stringify(data.availability);
    availabilityEntries = data.availability.map((entry) => ({ ...entry }));
  }

  const departmentSummary =
    data.approvedDepartments.length > 0 ? data.approvedDepartments.join(', ') : 'No schedule departments';

  function formatBirthday(value: string) {
    return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : 'Not set';
  }

  function formatPendingDate(value: number) {
    return new Date(value * 1000).toLocaleDateString();
  }

  function formatDateTime(value: number | null) {
    return value ? new Date(value * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';
  }

  function sessionLabel(session: (typeof data.sessions)[number]) {
    return session.deviceName || session.platform || session.userAgent?.split(' ')[0] || 'Session';
  }

  function formatStatus(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  $: activeSessions = data.sessions.filter((session) => !session.revokedAt);

  function payloadFor(item: EmployeeOnboardingItem) {
    try {
      return JSON.parse(item.form_payload || '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }

  function formValue(item: EmployeeOnboardingItem, key: string, fallback = '') {
    return payloadFor(item)[key] ?? fallback;
  }

  function completedSummary(item: EmployeeOnboardingItem) {
    if (item.file_name) return `Uploaded: ${item.file_name}`;
    if (item.item_type === 'form') return `Submitted by ${item.signed_name || 'employee'}`;
    return `Completed by ${item.signed_name || 'employee'}`;
  }

  $: profileDisplayName = data.profile.real_name || data.user.username || 'Profile';
  $: profileInitial = profileDisplayName.trim().charAt(0).toUpperCase() || 'P';
  $: onboardingDoneCount = data.onboarding.items.filter(
    (item) => item.status === 'submitted' || item.status === 'approved'
  ).length;
</script>

<Layout>
  <PageHeader title="Profile & Settings" />

  <section class="profile-header">
    <div class="profile-identity">
      <div class="profile-avatar" aria-hidden="true">{profileInitial}</div>
      <div class="profile-copy">
        <h2>{profileDisplayName}</h2>
        <p>@{data.user.username || 'username'} | {data.user.email || 'No email on file'}</p>
      </div>
    </div>

    <div class="profile-meta">
      <div class="meta-item">
        <span>Departments</span>
        <strong>{departmentSummary}</strong>
      </div>
      <div class="meta-item">
        <span>Birthday</span>
        <strong>{formatBirthday(data.profile.birthday)}</strong>
      </div>
      <div class="meta-item">
        <span>Status</span>
        <strong>{data.pendingBirthdayRequest ? 'Birthday request pending' : 'Profile active'}</strong>
      </div>
    </div>
  </section>

  <nav class="settings-nav" aria-label="Settings sections">
    <button type="button" class:active={activeTab === 'availability'} on:click={() => (activeTab = 'availability')}>
      Availability
    </button>
    <button type="button" class:active={activeTab === 'profile'} on:click={() => (activeTab = 'profile')}>
      Profile
    </button>
    <button type="button" class:active={activeTab === 'onboarding'} on:click={() => (activeTab = 'onboarding')}>
      Onboarding
    </button>
    <button type="button" class:active={activeTab === 'app'} on:click={() => (activeTab = 'app')}>
      App
    </button>
  </nav>

  {#if activeTab === 'availability'}
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Schedule</span>
          <h2>Availability</h2>
        </div>
      </header>

      <AvailabilityEditor
        entries={availabilityEntries}
        action="?/save_availability"
        enhanceFn={withFeedback}
        submitLabel="Save Availability"
      />
    </section>
  {/if}

  {#if activeTab === 'profile'}
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Profile</span>
          <h2>Personal Info</h2>
        </div>
      </header>

      <form method="POST" action="?/save_personal_info" use:enhance={withFeedback} class="stack-form">
        <div class="field-grid">
          <label>
            <span>Username</span>
            <input name="username" value={data.user.username} required />
          </label>

          <label>
            <span>Real Name</span>
            <input name="real_name" value={data.profile.real_name} placeholder="Your full name" />
          </label>
        </div>

        <div class="birthday-inline">
          <label>
            <span>Birthday</span>
            <input value={formatBirthday(data.profile.birthday)} readonly disabled />
          </label>

          <details class="birthday-request">
            <summary>Edit Birthday</summary>

            <div class="birthday-inline__row">
              <input
                form="birthday-request-form"
                name="requested_birthday"
                type="date"
                value={data.pendingBirthdayRequest?.requested_birthday ?? data.profile.birthday}
                required
              />
              <button form="birthday-request-form" type="submit" class="secondary-button">Submit</button>
            </div>

            {#if data.pendingBirthdayRequest}
              <p class="form-note">
                Pending request for {formatBirthday(data.pendingBirthdayRequest.requested_birthday)} submitted
                {formatPendingDate(data.pendingBirthdayRequest.requested_at)}.
              </p>
            {/if}
          </details>
        </div>

        <div class="form-actions">
          <button type="submit">Save Personal Info</button>
        </div>
      </form>

      <form
        id="birthday-request-form"
        method="POST"
        action="?/request_birthday_edit"
        use:enhance={withFeedback}
        class="hidden-form"
      ></form>

      <form method="POST" action="?/save_contact_info" use:enhance={withFeedback} class="stack-form">
        <header class="form-section-head">
          <span class="panel-kicker">Contact</span>
          <h2>Contact Info</h2>
        </header>

        <div class="field-grid">
          <label>
            <span>Email</span>
            <input name="email" type="email" value={data.user.email} required />
          </label>
          <label>
            <span>Phone</span>
            <input name="phone" type="tel" value={data.profile.phone} placeholder="(555) 555-5555" />
          </label>
        </div>

        <div class="field-grid">
          <label>
            <span>Address Line 1</span>
            <input name="address_line_1" value={data.profile.address_line_1} />
          </label>
          <label>
            <span>Address Line 2</span>
            <input name="address_line_2" value={data.profile.address_line_2} />
          </label>
          <label>
            <span>City</span>
            <input name="city" value={data.profile.city} />
          </label>
        </div>

        <div class="field-grid field-grid-three">
          <label>
            <span>State</span>
            <input name="state" value={data.profile.state} />
          </label>
          <label>
            <span>Postal Code</span>
            <input name="postal_code" value={data.profile.postal_code} />
          </label>
          <span></span>
        </div>

        <div class="field-grid field-grid-three">
          <label>
            <span>Emergency Contact</span>
            <input name="emergency_contact_name" value={data.profile.emergency_contact_name} />
          </label>
          <label>
            <span>Emergency Phone</span>
            <input name="emergency_contact_phone" type="tel" value={data.profile.emergency_contact_phone} />
          </label>
          <label>
            <span>Relationship</span>
            <input name="emergency_contact_relationship" value={data.profile.emergency_contact_relationship} />
          </label>
        </div>

        <div class="form-actions">
          <button type="submit">Save Contact Info</button>
        </div>
      </form>
    </section>
  {/if}

  {#if activeTab === 'onboarding'}
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Employee Setup</span>
          <h2>Onboarding</h2>
        </div>
        {#if data.onboarding.package}
          <span class="status-pill status-pill-{data.onboarding.package.status}">
            {formatStatus(data.onboarding.package.status)}
          </span>
        {/if}
      </header>

      {#if !data.onboarding.package}
        <p class="panel-note">No onboarding package has been assigned yet.</p>
      {:else}
        <div class="onboarding-summary">
          <div>
            <span>Progress</span>
            <strong>{onboardingDoneCount} / {data.onboarding.items.length}</strong>
          </div>
          <div>
            <span>Sent</span>
            <strong>{formatDateTime(data.onboarding.package.sent_at)}</strong>
          </div>
          <div>
            <span>Approved</span>
            <strong>{formatDateTime(data.onboarding.package.approved_at)}</strong>
          </div>
        </div>

        <div class="onboarding-list">
          {#each data.onboarding.items as item}
            <article class={`onboarding-item ${item.status === 'approved' ? 'item-approved' : ''}`}>
              <div class="onboarding-item__head">
                <div>
                  <span class="item-type">{formatStatus(item.item_type)}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <span class="status-pill status-pill-{item.status}">{formatStatus(item.status)}</span>
              </div>

              {#if item.manager_note}
                <p class="manager-note">{item.manager_note}</p>
              {/if}

              {#if item.source_file_url}
                <p class="form-note">
                  <a href={item.source_file_url} target="_blank" rel="noreferrer">
                    {item.source_file_name || 'View onboarding document'}
                  </a>
                </p>
              {/if}

              {#if item.status === 'approved'}
                <p class="form-note">
                  {completedSummary(item)}
                </p>
              {:else}
                <form
                  method="POST"
                  action="?/submit_onboarding_item"
                  enctype="multipart/form-data"
                  use:enhance={withFeedback}
                  class="onboarding-form"
                >
                  <input type="hidden" name="item_id" value={item.id} />

                  {#if item.item_type === 'form'}
                    {#if item.form_key === 'personal_information'}
                      <div class="field-grid">
                        <label>
                          <span>Legal Name</span>
                          <input name="legal_name" value={formValue(item, 'legal_name', data.profile.real_name)} required />
                        </label>
                        <label>
                          <span>Preferred Name</span>
                          <input name="preferred_name" value={formValue(item, 'preferred_name', data.user.username)} />
                        </label>
                        <label>
                          <span>Birthday</span>
                          <input name="birthday" type="date" value={formValue(item, 'birthday', data.profile.birthday)} required />
                        </label>
                        <label>
                          <span>Phone</span>
                          <input name="phone" type="tel" value={formValue(item, 'phone', data.profile.phone)} required />
                        </label>
                        <label>
                          <span>Address Line 1</span>
                          <input name="address_line_1" value={formValue(item, 'address_line_1', data.profile.address_line_1)} required />
                        </label>
                        <label>
                          <span>Address Line 2</span>
                          <input name="address_line_2" value={formValue(item, 'address_line_2', data.profile.address_line_2)} />
                        </label>
                        <label>
                          <span>City</span>
                          <input name="city" value={formValue(item, 'city', data.profile.city)} required />
                        </label>
                        <label>
                          <span>State</span>
                          <input name="state" value={formValue(item, 'state', data.profile.state)} required />
                        </label>
                        <label>
                          <span>Postal Code</span>
                          <input name="postal_code" value={formValue(item, 'postal_code', data.profile.postal_code)} required />
                        </label>
                      </div>
                    {:else if item.form_key === 'emergency_contact'}
                      <div class="field-grid">
                        <label>
                          <span>Emergency Contact</span>
                          <input name="emergency_contact_name" value={formValue(item, 'emergency_contact_name', data.profile.emergency_contact_name)} required />
                        </label>
                        <label>
                          <span>Emergency Phone</span>
                          <input name="emergency_contact_phone" type="tel" value={formValue(item, 'emergency_contact_phone', data.profile.emergency_contact_phone)} required />
                        </label>
                        <label>
                          <span>Relationship</span>
                          <input name="emergency_contact_relationship" value={formValue(item, 'emergency_contact_relationship', data.profile.emergency_contact_relationship)} required />
                        </label>
                      </div>
                    {:else}
                      <div class="field-grid">
                        <label>
                          <span>Classification</span>
                          <select name="worker_classification">
                            <option value="employee" selected={formValue(item, 'worker_classification') !== 'contractor'}>Employee</option>
                            <option value="contractor" selected={formValue(item, 'worker_classification') === 'contractor'}>Contractor</option>
                          </select>
                        </label>
                        <label>
                          <span>Start Date</span>
                          <input name="start_date" type="date" value={formValue(item, 'start_date')} required />
                        </label>
                        <label>
                          <span>Pay Type</span>
                          <select name="pay_type">
                            <option value="hourly" selected={formValue(item, 'pay_type') !== 'salary'}>Hourly</option>
                            <option value="salary" selected={formValue(item, 'pay_type') === 'salary'}>Salary</option>
                          </select>
                        </label>
                        <label class="toggle-card">
                          <input
                            type="checkbox"
                            name="direct_deposit_authorized"
                            value="1"
                            checked={formValue(item, 'direct_deposit_authorized') === 'yes'}
                          />
                          <div>
                            <strong>Direct Deposit Authorization</strong>
                          </div>
                        </label>
                        <label>
                          <span>Bank Name</span>
                          <input name="bank_name" value={formValue(item, 'bank_name')} />
                        </label>
                        <label>
                          <span>Routing Last Four</span>
                          <input name="routing_last_four" inputmode="numeric" maxlength="4" value={formValue(item, 'routing_last_four')} />
                        </label>
                        <label>
                          <span>Account Last Four</span>
                          <input name="account_last_four" inputmode="numeric" maxlength="4" value={formValue(item, 'account_last_four')} />
                        </label>
                      </div>
                    {/if}
                    <label>
                      <span>Typed Name</span>
                      <input name="signed_name" value={item.signed_name} placeholder={profileDisplayName} required />
                    </label>
                  {:else if item.item_type === 'document'}
                    <label>
                      <span>Document</span>
                      <input name="file" type="file" accept="application/pdf,image/*" />
                    </label>
                    {#if item.file_name}
                      <p class="form-note">Current upload: {item.file_name}</p>
                    {/if}
                  {:else}
                    <label class="toggle-card">
                      <input type="checkbox" name="acknowledged" value="1" />
                      <div>
                        <strong>I have reviewed and understand this item.</strong>
                      </div>
                    </label>
                    <label>
                      <span>Typed Name</span>
                      <input name="signed_name" value={item.signed_name} placeholder={profileDisplayName} required />
                    </label>
                  {/if}

                  <div class="form-actions">
                    <button type="submit">
                      {item.status === 'needs_changes' ? 'Resubmit' : 'Submit'}
                    </button>
                  </div>
                </form>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if activeTab === 'app'}
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Preferences</span>
          <h2>App Settings</h2>
        </div>
      </header>

      <form method="POST" action="?/save_app_settings" use:enhance={withFeedback} class="stack-form">
        <label>
          <span>Language</span>
          <select name="language">
            <option value="en" selected={data.preferences.language === 'en'}>EN</option>
            <option value="es" selected={data.preferences.language === 'es'}>ES</option>
            <option value="fr" selected={data.preferences.language === 'fr'}>FR</option>
          </select>
        </label>

        <div class="toggle-grid">
          <label class="toggle-card">
            <input type="checkbox" name="email_updates" value="1" checked={data.preferences.emailUpdates} />
            <div>
              <strong>Email Notifications</strong>
            </div>
          </label>

          <label class="toggle-card">
            <input type="checkbox" name="sms_updates" value="1" checked={data.preferences.smsUpdates} />
            <div>
              <strong>SMS Notifications</strong>
            </div>
          </label>

          <label class="toggle-card">
            <input type="checkbox" name="dark_mode" value="1" checked={data.preferences.darkMode} />
            <div>
              <strong>Dark Mode</strong>
            </div>
          </label>
        </div>

        <div class="utility-links">
          <a href="/forgot-password">Change Password</a>
          <a href="/app/about">Contact / Support</a>
          <a href="/account-deletion">Account Deletion</a>
        </div>


        <div class="form-actions">
          <button type="submit">Save App Settings</button>
        </div>
      </form>

        <section class="session-list">
          <div class="session-list__head">
            <strong>Sessions</strong>
            <form method="POST" action="?/revoke_other_sessions" use:enhance={withFeedback}>
              <button type="submit" class="secondary-button">Revoke Others</button>
            </form>
          </div>

          {#each activeSessions as session}
            <div class="session-row">
              <div>
                <strong>{sessionLabel(session)}{session.current ? ' - Current' : ''}</strong>
                <span>Last seen {formatDateTime(session.lastSeenAt)}</span>
              </div>
              {#if !session.current}
                <form method="POST" action="?/revoke_session" use:enhance={withFeedback}>
                  <input type="hidden" name="session_id" value={session.id} />
                  <button type="submit" class="secondary-button">Revoke</button>
                </form>
              {/if}
            </div>
          {/each}
        </section>
      <form method="POST" action="/logout" class="logout-form">
        <button class="logout-btn" type="submit">Logout</button>
      </form>

      <AppInstallCard />
    </section>
  {/if}
</Layout>

<style>
  .profile-header,
  .panel {
    position: relative;
    border: 1px solid var(--surface-outline);
    border-radius: var(--radius-lg);
    background: var(--surface-wash), var(--color-surface);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .profile-header::before,
  .panel::before {
    content: none;
  }

  .profile-header,
  .panel {
    padding: 1rem;
  }

  .eyebrow,
  .panel-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .profile-header {
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
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface-alt) 82%, var(--color-text) 18%);
    box-shadow: none;
  }

  .profile-copy h2 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.4rem, 2vw, 1.9rem);
    line-height: 1.05;
  }

  .profile-copy p {
    margin: 0.35rem 0 0;
    color: var(--color-text-muted);
  }

  .profile-meta {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding-top: 0.85rem;
    border-top: 1px solid var(--color-divider);
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

  .settings-nav {
    display: flex;
    gap: 0.55rem;
    flex-wrap: nowrap;
    overflow-x: auto;
    margin-bottom: 1rem;
    padding-bottom: 0.2rem;
    scrollbar-width: none;
  }

  .settings-nav::-webkit-scrollbar {
    display: none;
  }

  .settings-nav button {
    width: auto;
    flex: 0 0 auto;
    min-height: 2.4rem;
    padding-inline: 0.9rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .settings-nav button.active {
    border-color: color-mix(in srgb, var(--color-text-muted) 42%, transparent);
    background: color-mix(in srgb, var(--color-surface-alt) 74%, var(--color-text) 6%);
    color: var(--color-primary-contrast);
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    margin-bottom: 0.9rem;
  }

  .panel-head h2,
  .form-section-head h2 {
    margin: 0.2rem 0 0;
  }

  .panel-note,
  .form-note {
    margin: 0;
    color: var(--color-text-muted);
  }

  .form-note {
    font-size: 0.84rem;
  }

  .stack-form {
    display: grid;
    gap: 0.9rem;
  }

  .stack-form + .stack-form {
    margin-top: 1.2rem;
    padding-top: 1.1rem;
    border-top: 1px solid var(--color-divider);
  }

  .form-section-head {
    display: grid;
    gap: 0.1rem;
  }

  .toggle-grid {
    display: grid;
    gap: 0.8rem;
  }

  .field-grid {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .birthday-inline {
    display: grid;
    gap: 0.8rem;
    padding: 0.9rem;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-surface-alt) 44%, transparent);
  }

  .birthday-inline__row {
    display: flex;
    gap: 0.7rem;
    align-items: end;
  }

  .birthday-request {
    display: grid;
    gap: 0.75rem;
  }

  .birthday-request summary {
    cursor: pointer;
    list-style: none;
    color: var(--color-text);
    font-size: 0.84rem;
    font-weight: var(--weight-medium);
  }

  .birthday-request summary::-webkit-details-marker {
    display: none;
  }

  .birthday-request summary::after {
    content: 'Expand';
    margin-left: 0.55rem;
    color: var(--color-text-muted);
    font-size: 0.76rem;
    font-weight: var(--weight-regular);
  }

  .birthday-request[open] summary::after {
    content: 'Hide';
  }

  .birthday-inline__row input {
    flex: 1 1 auto;
  }

  .field-grid-three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toggle-card,
  .form-actions,
  .utility-links {
    display: flex;
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

  input,
  select {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.55rem 0.68rem;
    background: var(--surface-wash), var(--color-surface-alt);
    color: var(--color-text);
    font-size: 0.84rem;
  }

  .toggle-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toggle-card {
    gap: 0.7rem;
    align-items: start;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 0.9rem;
    background: color-mix(in srgb, var(--color-surface-alt) 42%, transparent);
  }

  .toggle-card input {
    width: auto;
    margin-top: 0.15rem;
  }

  .toggle-card strong {
    display: block;
    margin-bottom: 0.2rem;
  }

  .toggle-card span {
    color: var(--color-text-muted);
    font-size: 0.82rem;
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
    font-weight: var(--weight-medium);
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

  .onboarding-summary {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 0.9rem;
  }

  .onboarding-summary div {
    display: grid;
    gap: 0.2rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .onboarding-summary span,
  .item-type {
    color: var(--color-text-muted);
    font-size: 0.76rem;
  }

  .onboarding-list,
  .onboarding-form {
    display: grid;
    gap: 0.8rem;
  }

  .onboarding-item {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem;
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-surface-alt) 42%, transparent);
  }

  .onboarding-item.item-approved {
    border-color: color-mix(in srgb, #16a34a 30%, var(--color-border));
  }

  .onboarding-item__head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: start;
  }

  .onboarding-item h3 {
    margin: 0.2rem 0;
    font-size: 1rem;
  }

  .onboarding-item p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .manager-note {
    padding: 0.7rem;
    border-radius: 12px;
    background: color-mix(in srgb, #f59e0b 12%, transparent);
  }

  .utility-links {
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .utility-links a {
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .session-list {
    display: grid;
    gap: 0.65rem;
    margin-top: 0.9rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--color-divider);
  }

  .session-list__head,
  .session-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .session-row {
    padding: 0.7rem 0;
    border-top: 1px solid var(--color-divider);
  }

  .session-row div {
    display: grid;
    gap: 0.2rem;
  }

  .session-row span {
    color: var(--color-text-muted);
    font-size: 0.78rem;
  }

  .form-actions {
    justify-content: flex-end;
  }

  button,
  .logout-btn {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-text) 5%);
    color: var(--color-primary-contrast);
    min-height: 2.6rem;
    padding: 0.55rem 0.85rem;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: var(--weight-medium);
  }

  .logout-btn {
    border-color: color-mix(in srgb, #ef4444 36%, var(--color-border));
    color: #ffb6b6;
    background: color-mix(in srgb, #7f1d1d 34%, var(--color-surface));
  }

  .logout-form {
    margin-top: 0.85rem;
  }

  .secondary-button {
    width: auto;
    min-width: 7rem;
  }

  .hidden-form {
    display: none;
  }

  @media (max-width: 900px) {
    .profile-meta,
    .onboarding-summary,
    .toggle-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .profile-identity {
      align-items: flex-start;
    }

    .field-grid,
    .field-grid-three {
      grid-template-columns: 1fr;
    }

    .birthday-inline__row {
      flex-direction: column;
      align-items: stretch;
    }

    .onboarding-item__head {
      flex-direction: column;
      align-items: stretch;
    }

    .form-actions {
      justify-content: stretch;
    }

    button,
    .logout-btn {
      width: 100%;
    }
  }
</style>




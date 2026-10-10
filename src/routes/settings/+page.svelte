<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';
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

  export let data: {
    activeTab: string;
    user: {
      id: string;
      username: string;
      email: string;
    };
    profile: Profile;
    approvedDepartments: ScheduleDepartment[];
    availability: AvailabilityEntry[];
    pendingAvailability: { id: string; updatedAt: number } | null;
    preferences: {
      emailUpdates: boolean;
      smsUpdates: boolean;
      pushUpdates: boolean;
      darkMode: boolean;
      language: string;
    };
    employeeOnboarding: {
      id: string;
      status: string;
      highlighted: boolean;
    } | null;
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
  };

  const tabs = ['availability', 'profile', 'app'] as const;
  type TabKey = (typeof tabs)[number];

  function normalizeTab(value: string): TabKey {
    if (value === 'personal' || value === 'contact') return 'profile';
    return tabs.includes(value as TabKey) ? (value as TabKey) : 'profile';
  }

  let activeTab: TabKey = normalizeTab(data.activeTab);

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

  const departmentSummary =
    data.approvedDepartments.length > 0 ? data.approvedDepartments.join(', ') : 'No schedule departments';

  function sessionLabel(session: (typeof data.sessions)[number]) {
    return session.deviceName || session.platform || session.userAgent?.split(' ')[0] || 'Session';
  }

  function formatDateTime(value: number) {
    return new Date(value * 1000).toLocaleString();
  }

  $: activeSessions = data.sessions.filter((session) => !session.revokedAt);

  $: profileDisplayName = data.profile.real_name || data.user.username || 'Profile';
  $: profileInitial = profileDisplayName.trim().charAt(0).toUpperCase() || 'P';
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
        <span>Status</span>
        <strong>Profile active</strong>
      </div>
    </div>
  </section>

  {#if data.employeeOnboarding}
    <section class:highlighted={data.employeeOnboarding.highlighted} class="onboarding-prompt">
      <div>
        <span>Employee Onboarding</span>
        <h2>{data.employeeOnboarding.status === 'submitted' ? 'Onboarding submitted' : 'Complete your company onboarding'}</h2>
        <p>
          {data.employeeOnboarding.status === 'submitted'
            ? 'Your packet is waiting for review.'
            : 'Open your secure packet and check your email for onboarding requests.'}
        </p>
      </div>
      <a href="/onboarding">Open onboarding</a>
    </section>
  {/if}

  <nav class="settings-nav" aria-label="Settings sections">
    <button type="button" class:active={activeTab === 'availability'} on:click={() => (activeTab = 'availability')}>
      Availability
    </button>
    <button type="button" class:active={activeTab === 'profile'} on:click={() => (activeTab = 'profile')}>
      Profile
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

      <p class="pending-note">
        {data.pendingAvailability
          ? 'Your latest availability change is waiting for manager approval.'
          : 'Availability and time off are managed with your schedule.'}
      </p>
      <a class="schedule-settings-link" href="/my-schedule?view=availability">Open Schedule Availability</a>
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

        </div>


        <div class="form-actions">
          <button type="submit">Save Personal Info</button>
        </div>
      </form>
      <form method="POST" action="?/save_contact_info" use:enhance={withFeedback} class="stack-form">
        <header class="form-section-head">
          <span class="panel-kicker">Account</span>
          <h2>Contact</h2>
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
        <div class="form-actions"><button type="submit">Save Contact</button></div>
      </form>
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
			  <small>Optional schedule, shift, onboarding status, and restaurant-operation messages. Essential account, security, and employment-record emails may still be sent when necessary.</small>
            </div>
          </label>

          <label class="toggle-card">
            <input type="checkbox" name="sms_updates" value="1" checked={data.preferences.smsUpdates} />
            <div>
              <strong>SMS Notifications</strong>
			  <small>Allow automated operational texts. Message frequency varies; message and data rates may apply. Reply STOP to opt out or HELP for help.</small>
            </div>
          </label>

          <label class="toggle-card">
            <input type="checkbox" name="push_updates" value="1" checked={data.preferences.pushUpdates} />
            <div>
              <strong>Push Notifications</strong>
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
      <form method="POST" action="/logout" class="logout-form" use:enhance>
        <button class="logout-btn" type="submit">Logout</button>
      </form>

      <AppInstallCard />
    </section>
  {/if}
</Layout>

<style>
  .pending-note {
    margin: 0 0 0.8rem;
    padding: 0.55rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .schedule-settings-link {
    justify-self: start;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid currentColor;
    color: var(--color-text);
    font-size: 0.78rem;
    font-weight: var(--weight-bold);
    text-decoration: none;
    text-transform: uppercase;
  }

  .profile-header,
  .onboarding-prompt,
  .panel {
    position: relative;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    overflow: hidden;
  }

  .profile-header::before,
  .panel::before {
    content: none;
  }

  .profile-header,
  .onboarding-prompt,
  .panel {
    padding: 1rem;
  }

  .onboarding-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 0 1rem;
  }

  .onboarding-prompt.highlighted {
    border-color: color-mix(in srgb, var(--color-text) 30%, var(--color-divider));
  }

  .onboarding-prompt div {
    display: grid;
    gap: 0.2rem;
  }

  .onboarding-prompt span {
    color: var(--color-text-muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .onboarding-prompt h2,
  .onboarding-prompt p {
    margin: 0;
  }

  .onboarding-prompt h2 {
    font-size: 1rem;
  }

  .onboarding-prompt p {
    color: var(--color-text-muted);
    font-size: 0.82rem;
  }

  .onboarding-prompt a {
    flex: 0 0 auto;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid currentColor;
    color: var(--color-text);
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-decoration: none;
    text-transform: uppercase;
  }

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
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .settings-nav button.active {
    border-color: var(--color-text);
    background: transparent;
    color: var(--color-text);
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
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    padding: 0.55rem 0;
    background: transparent;
    color: var(--color-text);
    font-size: 0.84rem;
  }

  .toggle-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toggle-card {
    gap: 0.7rem;
    align-items: start;
    border: 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
    border-radius: 0;
    padding: 0.9rem 0;
    background: transparent;
  }

  .toggle-card input {
    width: auto;
    margin-top: 0.15rem;
  }

  .toggle-card strong {
    display: block;
    margin-bottom: 0.2rem;
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
    border: 0;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    background: transparent;
    color: var(--color-text);
    min-height: 2.6rem;
    padding: 0.55rem 0.85rem;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: var(--weight-medium);
  }

  .logout-btn {
    border-color: color-mix(in srgb, var(--color-error) 36%, var(--color-border));
    color: color-mix(in srgb, var(--color-error) 76%, var(--color-text));
    background: transparent;
  }

  .logout-form {
    margin-top: 0.85rem;
  }

  .secondary-button {
    width: auto;
    min-width: 7rem;
  }

  @media (max-width: 900px) {
    .onboarding-prompt {
      align-items: flex-start;
      flex-direction: column;
    }

    .profile-meta,
    .toggle-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .profile-identity {
      align-items: flex-start;
    }

    .field-grid {
      grid-template-columns: 1fr;
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

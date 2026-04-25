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

  export let data: {
    user: {
      id: string;
      username: string;
      email: string;
    };
    profile: Profile;
    approvedDepartments: ScheduleDepartment[];
    availability: AvailabilityEntry[];
    preferences: {
      emailUpdates: boolean;
      smsUpdates: boolean;
      darkMode: boolean;
      language: string;
    };
    pendingBirthdayRequest: PendingBirthdayRequest;
  };

  const tabs = ['availability', 'personal', 'contact', 'app'] as const;
  type TabKey = (typeof tabs)[number];
  let activeTab: TabKey = 'personal';

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

  $: profileDisplayName = data.profile.real_name || data.user.username || 'Profile';
  $: profileInitial = profileDisplayName.trim().charAt(0).toUpperCase() || 'P';
</script>

<Layout>
  <PageHeader title="My Profile" />

  <section class="profile-header">
    <div class="profile-identity">
      <div class="profile-avatar" aria-hidden="true">{profileInitial}</div>
      <div class="profile-copy">
        <span class="eyebrow">Staff Profile</span>
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

  <nav class="tab-bar" aria-label="My profile sections">
    <button type="button" class:active={activeTab === 'availability'} on:click={() => (activeTab = 'availability')}>
      Availability
    </button>
    <button type="button" class:active={activeTab === 'personal'} on:click={() => (activeTab = 'personal')}>
      Personal Info
    </button>
    <button type="button" class:active={activeTab === 'contact'} on:click={() => (activeTab = 'contact')}>
      Contact Info
    </button>
    <button type="button" class:active={activeTab === 'app'} on:click={() => (activeTab = 'app')}>
      App Settings
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

      <p class="panel-note">Managers use this recurring availability when they build the weekly schedule.</p>

      <AvailabilityEditor
        entries={availabilityEntries}
        action="?/save_availability"
        enhanceFn={withFeedback}
        submitLabel="Save Availability"
      />
    </section>
  {/if}

  {#if activeTab === 'personal'}
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Identity</span>
          <h2>Personal Info</h2>
        </div>
      </header>

      <form method="POST" action="?/save_personal_info" use:enhance={withFeedback} class="stack-form">
        <header class="form-head">
          <h3>Identity</h3>
          <p>Username and real name save directly to your profile.</p>
        </header>

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

            <p class="form-note">Birthday changes require admin approval.</p>

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
    </section>
  {/if}

  {#if activeTab === 'contact'}
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Contact</span>
          <h2>Contact Info</h2>
        </div>
      </header>

      <form method="POST" action="?/save_contact_info" use:enhance={withFeedback} class="stack-form">
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
              <span>Receive schedule and app updates by email.</span>
            </div>
          </label>

          <label class="toggle-card">
            <input type="checkbox" name="sms_updates" value="1" checked={data.preferences.smsUpdates} />
            <div>
              <strong>SMS Notifications</strong>
              <span>Keep text notifications available for future alerts.</span>
            </div>
          </label>

          <label class="toggle-card">
            <input type="checkbox" name="dark_mode" value="1" checked={data.preferences.darkMode} />
            <div>
              <strong>Dark Mode</strong>
              <span>Save your theme preference to your profile.</span>
            </div>
          </label>
        </div>

        <div class="utility-links">
          <a href="/forgot-password">Change Password</a>
          <a href="/about">Contact / Support</a>
        </div>

        <div class="form-actions">
          <button type="submit">Save App Settings</button>
        </div>
      </form>

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
  }

  .profile-meta {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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

  .tab-bar {
    display: flex;
    gap: 0.55rem;
    flex-wrap: nowrap;
    overflow-x: auto;
    margin-bottom: 1rem;
    padding-bottom: 0.2rem;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-bar button {
    width: auto;
    flex: 0 0 auto;
    min-height: 2.4rem;
    padding-inline: 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .tab-bar button.active {
    border-color: rgba(132, 146, 166, 0.26);
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
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
  .form-head h3 {
    margin: 0.2rem 0 0;
  }

  .panel-note,
  .form-head p,
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
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
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
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 0.55rem 0.68rem;
    background: color-mix(in srgb, var(--color-surface-alt) 92%, black 8%);
    color: var(--color-text);
    font-size: 0.84rem;
  }

  .toggle-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toggle-card {
    gap: 0.7rem;
    align-items: start;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 0.9rem;
    background: rgba(255, 255, 255, 0.03);
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

  .utility-links {
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .utility-links a {
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .form-actions {
    justify-content: flex-end;
  }

  button,
  .logout-btn {
    border: 1px solid rgba(132, 146, 166, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(132, 146, 166, 0.22), rgba(132, 146, 166, 0.08));
    color: var(--color-primary-contrast);
    min-height: 2.6rem;
    padding: 0.55rem 0.85rem;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: var(--weight-medium);
  }

  .logout-btn {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
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

    .form-actions {
      justify-content: stretch;
    }

    button,
    .logout-btn {
      width: 100%;
    }
  }
</style>




<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import AppInstallCard from '$lib/components/ui/AppInstallCard.svelte';

  type SettingsState = Record<string, string | boolean>;
  export let data: { display_name?: string; email?: string; email_updates?: boolean };

  let settings: SettingsState = {
    username: "",
    email: "",
    emailNotifications: true,
    darkMode: false,
    language: "en"
  };

  // Cards: keep your style, add a Logout card
  const cards: Array<Record<string, any>> = [
    { id: 1, title: "Username", desc: "Your display name in the app.", type: "text", key: "username", placeholder: "Enter username" },
    { id: 2, title: "Email", desc: "Sign-in and contact email.", type: "email", key: "email", placeholder: "Enter email" },
    { id: 3, title: "Email Notifications", desc: "Receive emails for updates and alerts.", type: "checkbox", key: "emailNotifications" },
    { id: 4, title: "Dark Mode", desc: "Toggle dark theme across the app.", type: "checkbox", key: "darkMode" },
    { id: 5, title: "Language", desc: "Select your preferred language.", type: "select", key: "language", options: ["en", "es", "fr"] },
    { id: 6, title: "Logout", desc: "Sign out of this device.", type: "logout" }
  ];

  onMount(() => {
    // Local settings
    const saved = localStorage.getItem("app-settings");
    if (saved) settings = JSON.parse(saved);

    // Real DB username (authoritative)
    if (data?.display_name) {
      settings.username = data.display_name;
    }
    if (data?.email) {
      settings.email = data.email;
    }
    settings.emailNotifications = data?.email_updates ?? settings.emailNotifications;
  });

  async function saveSettings() {
    // Save local-only settings
    localStorage.setItem("app-settings", JSON.stringify(settings));

    // Save profile fields to real DB
    const fd = new FormData();
    fd.set("display_name", String(settings.username));
    fd.set("email", String(settings.email).trim().toLowerCase());
    fd.set("email_updates", settings.emailNotifications ? "1" : "0");

    const res = await fetch("/settings?/save_profile", {
      method: "POST",
      body: fd
    });

    if (!res.ok) {
      alert("Settings saved locally, but profile failed to save to server.");
      return;
    }

    alert("Settings saved!");
  }
</script>

<style>
  .settings-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-4);
    max-width: 900px;
    margin: 2rem auto;
    padding: 0 var(--space-4);
  }

  .setting-card {
    position: relative;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out), border-color 120ms var(--ease-out);
    overflow: hidden;
  }

  .setting-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.9), rgba(195, 32, 43, 0.2));
  }

  .setting-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: rgba(195, 32, 43, 0.18);
  }

  .setting-card h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--weight-semibold);
    margin-bottom: var(--space-2);
    color: var(--color-text);
  }

  .setting-card p {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    margin-bottom: var(--space-3);
  }

  input[type="text"],
  input[type="email"],
  select {
    width: 100%;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-surface-alt);
    color: var(--color-text);
  }

  input[type="checkbox"] {
    transform: scale(1.15);
    cursor: pointer;
    margin-right: var(--space-2);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    font-weight: var(--weight-medium);
    color: var(--color-text);
  }

  .save-btn {
    grid-column: 1 / -1;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    padding: var(--space-4) var(--space-6);
    font-weight: var(--weight-semibold);
    cursor: pointer;
    margin-top: var(--space-4);
    justify-self: center;
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
  }

  .save-btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .tap:active {
    transform: scale(0.97);
  }

  .logout-btn {
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
    color: #ffb6b6;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    padding: var(--space-3) var(--space-4);
    font-weight: var(--weight-semibold);
    cursor: pointer;
    width: fit-content;
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
  }

  .logout-btn:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  @media (max-width: 760px) {
    .settings-container {
      grid-template-columns: 1fr;
      gap: var(--space-3);
      margin: 1rem auto 0.5rem;
      padding: 0;
    }

    .setting-card {
      padding: var(--space-4);
    }

    .save-btn {
      width: 100%;
      justify-self: stretch;
      margin-top: var(--space-2);
    }
  }
</style>

<Layout>
  <PageHeader title="Settings" />

  <div class="settings-container">
    {#each cards as card, index}
      <div
        class="setting-card"
        in:fade={{ delay: index * 80, duration: 180 }}
      >
        <h3>{card.title}</h3>
        <p>{card.desc}</p>

        {#if card.type === "text"}
          <input type="text" bind:value={settings[card.key] as string} placeholder={card.placeholder} />
        {:else if card.type === "email"}
          <input type="email" bind:value={settings[card.key] as string} placeholder={card.placeholder} />
        {:else if card.type === "checkbox"}
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={settings[card.key] as boolean} />
            Enabled
          </label>
        {:else if card.type === "select"}
          <select bind:value={settings[card.key] as string}>
            {#each card.options as opt}
              <option value={opt}>{opt.toUpperCase()}</option>
            {/each}
          </select>
        {:else if card.type === "logout"}
          <form method="POST" action="/logout">
            <button class="logout-btn tap" type="submit">Logout</button>
          </form>
        {/if}
      </div>
    {/each}

    <button class="save-btn tap" on:click={saveSettings}>Save Settings</button>
  </div>
  <AppInstallCard />
</Layout>

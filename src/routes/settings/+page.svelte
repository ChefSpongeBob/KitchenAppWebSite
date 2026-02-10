<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  let settings = {
    username: "",
    emailNotifications: true,
    darkMode: false,
    language: "en"
  };

  const cards = [
    { id: 1, title: "Username", desc: "Your display name in the app.", type: "text", key: "username", placeholder: "Enter username" },
    { id: 2, title: "Email Notifications", desc: "Receive emails for updates and alerts.", type: "checkbox", key: "emailNotifications" },
    { id: 3, title: "Dark Mode", desc: "Toggle dark theme across the app.", type: "checkbox", key: "darkMode" },
    { id: 4, title: "Language", desc: "Select your preferred language.", type: "select", key: "language", options: ["en", "es", "fr"] }
  ];

  onMount(() => {
    const saved = localStorage.getItem("app-settings");
    if (saved) settings = JSON.parse(saved);
  });

  function saveSettings() {
    localStorage.setItem("app-settings", JSON.stringify(settings));
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
    background: var(--color-surface);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    transition: transform 120ms var(--ease-out), box-shadow 120ms var(--ease-out);
  }

  .setting-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
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
  select {
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

  /* Save button subtle like a card */
  .save-btn {
    grid-column: 1 / -1;
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
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
</style>

<div class="settings-container">
  {#each cards as card, index}
    <div
      class="setting-card"
      in:fade={{ delay: index * 80, duration: 180 }}
    >
      <h3>{card.title}</h3>
      <p>{card.desc}</p>

      {#if card.type === "text"}
        <input type="text" bind:value={settings[card.key]} placeholder={card.placeholder} />
      {:else if card.type === "checkbox"}
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={settings[card.key]} />
          Enabled
        </label>
      {:else if card.type === "select"}
        <select bind:value={settings[card.key]}>
          {#each card.options as opt}
            <option value={opt}>{opt.toUpperCase()}</option>
          {/each}
        </select>
      {/if}
    </div>
  {/each}

  <button class="save-btn tap" on:click={saveSettings}>Save Settings</button>
</div>

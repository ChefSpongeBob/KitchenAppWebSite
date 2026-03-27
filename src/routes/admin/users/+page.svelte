<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import { enhance } from '$app/forms';

  type UserOption = {
    id: string;
    display_name: string | null;
    email: string;
    role: string;
    is_active: number;
    can_manage_specials: number;
  };

  export let data: {
    users: UserOption[];
  };

  $: pendingUsers = data.users.filter((user) => user.is_active !== 1);
  $: activeUsers = data.users.filter((user) => user.is_active === 1);
</script>

<Layout>
  <PageHeader
    title="User Access"
    subtitle="Approve, deny, and manage staff access."
  />

  <nav class="subnav">
    <a href="/admin">Back to Dashboard</a>
  </nav>

  <section class="summary-grid" aria-label="User summary">
    <article class="summary-card">
      <span class="eyebrow">Pending</span>
      <strong>{pendingUsers.length}</strong>
      <p>Accounts waiting for approval.</p>
    </article>
    <article class="summary-card">
      <span class="eyebrow">Active</span>
      <strong>{activeUsers.length}</strong>
      <p>Accounts currently allowed to sign in.</p>
    </article>
  </section>

  <section class="stack">
    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Pending</span>
          <h2>Awaiting Approval</h2>
        </div>
        <span>{pendingUsers.length} users</span>
      </header>

      <div class="user-grid">
        {#if pendingUsers.length === 0}
          <article class="user-card empty-card">No pending users.</article>
        {:else}
          {#each pendingUsers as user}
            <article class="user-card">
              <div class="user-head">
                <div>
                  <h3>{user.display_name ?? 'Unnamed User'}</h3>
                  <p>{user.email}</p>
                </div>
                <span class="status status-pending">Pending</span>
              </div>

              <dl class="meta">
                <div>
                  <dt>Role</dt>
                  <dd>{user.role}</dd>
                </div>
              </dl>

              <div class="actions">
                <form method="POST" action="?/approve_user" use:enhance>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button type="submit">Approve</button>
                </form>
                <form method="POST" action="?/deny_user" use:enhance>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button type="submit" class="warn-action">Deny</button>
                </form>
              </div>
            </article>
          {/each}
        {/if}
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <span class="panel-kicker">Active</span>
          <h2>Approved Users</h2>
        </div>
        <span>{activeUsers.length} users</span>
      </header>

      <div class="user-grid">
        {#if activeUsers.length === 0}
          <article class="user-card empty-card">No active users.</article>
        {:else}
          {#each activeUsers as user}
            <article class="user-card">
              <div class="user-head">
                <div>
                  <h3>{user.display_name ?? 'Unnamed User'}</h3>
                  <p>{user.email}</p>
                </div>
                <span class="status status-approved">Approved</span>
              </div>

              <dl class="meta">
                <div>
                  <dt>Role</dt>
                  <dd>{user.role}</dd>
                </div>
                <div>
                  <dt>Specials</dt>
                  <dd>{user.role === 'admin' || user.can_manage_specials === 1 ? 'Allowed' : 'Off'}</dd>
                </div>
              </dl>

              <div class="actions">
                <form method="POST" action="?/deny_user" use:enhance>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button type="submit" class="warn-action">Deny</button>
                </form>

                {#if user.role !== 'admin'}
                  <form method="POST" action="?/make_user_admin" use:enhance>
                    <input type="hidden" name="user_id" value={user.id} />
                    <button type="submit">Make Admin</button>
                  </form>
                {/if}

                <form method="POST" action="?/toggle_specials_access" use:enhance>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button
                    type="submit"
                    class:success-action={user.can_manage_specials === 1 || user.role === 'admin'}
                  >
                    {user.can_manage_specials === 1 || user.role === 'admin'
                      ? 'Specials Allowed'
                      : 'Grant Specials'}
                  </button>
                </form>

                <form method="POST" action="?/delete_user" use:enhance>
                  <input type="hidden" name="user_id" value={user.id} />
                  <button type="submit" class="danger-action">Delete</button>
                </form>
              </div>
            </article>
          {/each}
        {/if}
      </div>
    </section>
  </section>
</Layout>

<style>
  .subnav {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin: 0.5rem 0 1rem;
  }

  .subnav a {
    text-decoration: none;
    color: var(--color-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    padding: 0.32rem 0.7rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .summary-grid,
  .user-grid {
    display: grid;
    gap: 0.8rem;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0.5rem 0 1rem;
  }

  .summary-card,
  .panel,
  .user-card {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01) 48%, rgba(255, 255, 255, 0)),
      color-mix(in srgb, var(--color-surface) 94%, black 6%);
    box-shadow: 0 18px 36px rgba(4, 5, 7, 0.18);
  }

  .summary-card,
  .user-card {
    overflow: hidden;
    padding: 1rem;
  }

  .summary-card::before,
  .panel::before,
  .user-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.9), rgba(195, 32, 43, 0.2));
  }

  .eyebrow,
  .panel-kicker {
    display: inline-flex;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }

  .summary-card strong {
    display: block;
    margin-top: 0.45rem;
    font-size: 2rem;
    line-height: 1;
  }

  .summary-card p {
    margin: 0.45rem 0 0;
    color: var(--color-text-muted);
  }

  .stack {
    display: grid;
    gap: 0.9rem;
  }

  .panel {
    padding: 1rem;
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: end;
    margin-bottom: 0.9rem;
  }

  .panel-head h2,
  .user-head h3 {
    margin: 0.2rem 0 0;
  }

  .panel-head > span {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .user-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .user-head {
    display: flex;
    justify-content: space-between;
    gap: 0.8rem;
    align-items: start;
  }

  .user-head p {
    margin: 0.2rem 0 0;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
    margin: 0.9rem 0;
  }

  .meta div {
    padding: 0.6rem 0.7rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .meta dt {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    margin-bottom: 0.22rem;
  }

  .meta dd {
    margin: 0;
    color: var(--color-text);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: stretch;
  }

  .actions form {
    flex: 1 1 150px;
  }

  button {
    width: 100%;
    border: 1px solid rgba(195, 32, 43, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(195, 32, 43, 0.22), rgba(195, 32, 43, 0.08));
    color: var(--color-primary-contrast);
    min-height: 2.6rem;
    padding: 0.55rem 0.78rem;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: var(--weight-medium);
    line-height: 1.2;
  }

  .warn-action {
    border-color: rgba(245, 158, 11, 0.28);
    color: #fcd34d;
    background: linear-gradient(180deg, rgba(120, 86, 10, 0.42), rgba(120, 86, 10, 0.14));
  }

  .danger-action {
    border-color: rgba(239, 68, 68, 0.3);
    color: #ffb6b6;
    background: linear-gradient(180deg, rgba(120, 12, 18, 0.45), rgba(120, 12, 18, 0.16));
  }

  .success-action {
    border-color: rgba(22, 163, 74, 0.32);
    color: #bbf7d0;
    background: linear-gradient(180deg, rgba(22, 163, 74, 0.34), rgba(22, 163, 74, 0.12));
  }

  .status {
    display: inline-flex;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.18rem 0.5rem;
    font-size: 0.72rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .status-pending {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .status-approved {
    border-color: #16a34a;
    color: #16a34a;
  }

  .empty-card {
    color: var(--color-text-muted);
  }

  @media (max-width: 900px) {
    .user-grid,
    .summary-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 640px) {
    .panel {
      padding: 0.9rem;
    }

    .panel-head,
    .user-head {
      flex-direction: column;
      align-items: start;
    }

    .meta {
      grid-template-columns: minmax(0, 1fr);
    }

    .actions form {
      flex-basis: 100%;
    }
  }
</style>

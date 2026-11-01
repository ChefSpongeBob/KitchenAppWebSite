<script lang="ts">
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
</script>

<h2>Staff</h2>
{#if form && 'error' in form}<p class="staff-feedback error" role="alert">{form.error}</p>
{:else if form && 'success' in form}<p class="staff-feedback" role="status">Staff access saved.</p>{/if}
{#if !data.changesUnlocked}<p><a href="/staff/security?next=/staff/team">Verify Staff Access</a></p>{/if}
<details>
  <summary>Add Staff</summary>
  <form method="POST" class="staff-toolbar">
    <input type="hidden" name="revision" value="0" /><input type="hidden" name="active" value="1" />
    <label>Existing Account Email<input name="email" type="email" required maxlength="254" /></label>
    <label>Role<select name="role"><option value="support">Support</option><option value="equipment">Equipment</option><option value="owner">Owner</option></select></label>
    <label>Reason<input name="reason" required maxlength="200" /></label>
    <label class="staff-confirm"><input type="checkbox" name="confirmed" value="yes" required />Confirm staff access</label>
    <button type="submit" disabled={!data.changesUnlocked}>Add Staff</button>
  </form>
</details>
<p>Owner: staff and equipment controls. Support: business and delivery status. Equipment: gateway reservations. No role grants employee HR access.</p>
{#each data.members as member}
  <section class="staff-member">
    <h3>{member.display_name || member.email}</h3>
    <p>{member.email} / {member.staff_role} / {member.is_active && member.account_active ? 'Active' : 'Revoked or inactive'}</p>
    {#if member.user_id !== data.currentUser}
      <details><summary>Edit Access</summary>
        <form method="POST" class="staff-toolbar">
          <input type="hidden" name="user_id" value={member.user_id} /><input type="hidden" name="revision" value={member.revision} />
          <label>Role<select name="role" value={member.staff_role}><option value="support">Support</option><option value="equipment">Equipment</option><option value="owner">Owner</option></select></label>
          <label>Access<select name="active" value={member.account_active ? String(member.is_active) : '0'}><option value="1" disabled={!member.account_active}>Active</option><option value="0">Revoked</option></select></label>
          <label>Reason<input name="reason" required maxlength="200" /></label>
          <label class="staff-confirm"><input type="checkbox" name="confirmed" value="yes" required />Confirm staff access</label>
          <button type="submit" disabled={!data.changesUnlocked}>Save Access</button>
        </form>
      </details>
    {:else}<p>Your account</p>{/if}
  </section>
{/each}
<nav class="staff-pagination" aria-label="Staff pages">
  {#if data.page > 1}<a href={`?page=${data.page - 1}`}>Previous</a>{/if}<span>Page {data.page}</span>
  {#if data.hasNext && data.page < 1000}<a href={`?page=${data.page + 1}`}>Next</a>{/if}
</nav>

<style>
  .staff-member { padding: 1rem 0; border-bottom: 1px solid var(--color-divider); }
  h3 { font-size: 0.95rem; margin: 0; }
  p { font-size: 0.8rem; }
  details form { margin-top: 1rem; }
</style>

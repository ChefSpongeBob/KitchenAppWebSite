<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
  const labels: Record<string, string> = { gateway_reserved: 'Gateway Reserved', gateway_reservation_released: 'Reservation Released', platform_owner_bootstrapped: 'Platform Owner Enabled', staff_membership_added: 'Staff Added', staff_access_revoked: 'Staff Access Revoked', staff_access_updated: 'Staff Access Updated', staff_password_confirmed: 'Password Confirmed', staff_email_verified: 'Email Verified', staff_verification_email_changed: 'New Email Verified', staff_verification_email_updated: 'Verification Email Updated' };
</script>
<h2>Activity</h2>
<div class="staff-table-wrap"><table>
  <thead><tr><th>When</th><th>Action</th><th>Business</th><th>Gateway</th><th>Staff Account</th><th>Target Account</th><th>Reason</th></tr></thead>
  <tbody>{#each data.events as event}<tr><td>{new Date(event.created_at * 1000).toLocaleString()}</td><td>{labels[event.action] ?? event.action}</td><td>{event.business_id ?? '-'}</td><td>{event.device_serial ?? '-'}</td><td>{event.actor_user_id ?? '-'}</td><td>{event.target_user_id ?? '-'}</td><td>{event.reason}</td></tr>
  {:else}<tr><td colspan="7">No staff activity yet.</td></tr>{/each}</tbody>
</table></div>
<nav class="staff-pagination" aria-label="Activity pages">
  {#if data.page > 1}<a href={`?page=${data.page - 1}`}>Previous</a>{/if}<span>Page {data.page}</span>
  {#if data.hasNext && data.page < 1000}<a href={`?page=${data.page + 1}`}>Next</a>{/if}
</nav>

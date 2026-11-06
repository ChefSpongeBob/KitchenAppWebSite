<script lang="ts">
  import { enhance } from '$app/forms';
  import { SUPPORT_CATEGORIES } from '#lib/support.ts';
  export let submissionId: string;
  export let businessId: string | undefined = undefined;
  export let action = '?/create';
  let sending = false;
</script>
<form method="POST" {action} class="support-request-form staff-form-grid" use:enhance={() => {
  sending = true; return async ({ update }) => { try { await update({ navigate: false }); } finally { sending = false; } };
}}>
  <input type="hidden" name="submission_id" value={submissionId} />
  {#if businessId}<input type="hidden" name="business_id" value={businessId} />{/if}
  <label>Category<select name="category" required>{#each Object.entries(SUPPORT_CATEGORIES) as [value, label]}<option {value}>{label}</option>{/each}</select></label>
  <label>Priority<select name="priority"><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label>
  <label class="staff-full-width">Subject<input name="subject" required maxlength="160" /></label>
  <label class="staff-full-width">Message<textarea name="body" required maxlength="4000" rows="5"></textarea></label>
  <p class="staff-full-width support-note">Do not include passwords, tax forms, banking details, or identity documents.</p>
  <div class="staff-full-width"><button type="submit" disabled={sending}>{sending ? 'Saving...' : businessId ? 'Record Request' : 'Send Request'}</button></div>
</form>
<style>
  .support-request-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; }
  label { display: grid; gap: 0.3rem; font-size: 0.8rem; min-width: 0; }
  .staff-full-width { grid-column: 1 / -1; }
  input, textarea, select { width: 100%; min-width: 0; box-sizing: border-box; }
  textarea { resize: vertical; min-height: 7rem; }
  .support-note { font-size: 0.74rem; color: var(--color-text-muted); margin: 0; }
  @media (max-width: 500px) { .support-request-form { grid-template-columns: 1fr; } }
</style>

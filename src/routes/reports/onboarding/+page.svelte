<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  export let data;

  $: csvHref = `/reports/onboarding.csv?start=${data.startDate}&end=${data.endDate}`;
</script>

<Layout>
  <PageHeader title="Onboarding Report" />

  <div class="report-toolbar">
    <a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
    <a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>CSV</a>
  </div>

  <section class="report-table-wrap">
    {#if data.rows.length}
      <table class="report-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Status</th>
            <th>Class</th>
            <th>Items</th>
            <th>Sent</th>
            <th>Approved</th>
          </tr>
        </thead>
        <tbody>
          {#each data.rows as row}
            <tr>
              <td>
                <strong>{row.employee_name}</strong>
                <span>{row.employee_email}</span>
              </td>
              <td>{row.package_status}</td>
              <td>{row.payroll_classification}</td>
              <td>
                <strong>{row.approved_items}/{row.item_count} approved</strong>
                <span>{row.pending_items} pending, {row.submitted_items} submitted, {row.changes_requested_items} changes</span>
              </td>
              <td>{row.sent_at ? new Date(row.sent_at * 1000).toLocaleDateString() : '-'}</td>
              <td>
                {#if row.approved_at}
                  {new Date(row.approved_at * 1000).toLocaleDateString()}
                  <span>{row.approved_by_name}</span>
                {:else}
                  -
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="empty-state">No onboarding packages yet.</p>
    {/if}
  </section>
</Layout>

<style>
  .report-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.9rem;
    align-items: center;
    padding: 0.7rem 0;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .report-toolbar a {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border-bottom: 1px solid var(--color-divider);
    color: var(--color-text);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }

  .report-toolbar .material-icons {
    color: var(--color-text-muted);
    font-size: 1rem;
    line-height: 1;
  }

  .report-table-wrap {
    overflow-x: auto;
    border-top: 1px solid var(--color-divider);
    border-bottom: 1px solid var(--color-divider);
  }

  .report-table {
    width: 100%;
    min-width: 820px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 0.75rem 0.55rem;
    border-bottom: 1px solid var(--color-divider);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: var(--color-text-muted);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  td span {
    display: block;
    margin-top: 0.2rem;
    color: var(--color-text-muted);
    font-size: 0.88rem;
  }

  .empty-state {
    margin: 0;
    padding: 1rem 0;
    color: var(--color-text-muted);
  }
</style>

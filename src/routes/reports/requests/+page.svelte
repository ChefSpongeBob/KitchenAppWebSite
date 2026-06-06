<script lang="ts">
  import Layout from '$lib/components/ui/Layout.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

  export let data;

  $: csvHref = `/reports/requests.csv?start=${data.startDate}&end=${data.endDate}`;
</script>

<Layout>
  <PageHeader title="Schedule Requests" />

  <div class="report-toolbar">
    <a href="/reports"><span class="material-icons" aria-hidden="true">arrow_back</span>Reports</a>
    <a href={csvHref}><span class="material-icons" aria-hidden="true">download</span>CSV</a>
  </div>

  <section class="report-table-wrap">
    {#if data.rows.length}
      <table class="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Employee</th>
            <th>Status</th>
            <th>Shift</th>
            <th>Notes</th>
            <th>Resolved By</th>
          </tr>
        </thead>
        <tbody>
          {#each data.rows as row}
            <tr>
              <td>{row.request_date}</td>
              <td>{row.request_type.replace(/_/g, ' ')}</td>
              <td>
                <strong>{row.employee_name}</strong>
                <span>{row.employee_email}</span>
              </td>
              <td>{row.status}</td>
              <td>
                {#if row.department || row.role_name}
                  <strong>{row.department} {row.role_name}</strong>
                {/if}
                {#if row.start_time}
                  <span>{row.start_time} - {row.end_label || 'Close'}</span>
                {/if}
                {#if row.detail}
                  <span>{row.detail}</span>
                {/if}
              </td>
              <td>
                {#if row.note}<span>{row.note}</span>{/if}
                {#if row.manager_note}<span>{row.manager_note}</span>{/if}
              </td>
              <td>{row.resolved_by_name || '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="empty-state">No schedule requests yet.</p>
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
    min-width: 900px;
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

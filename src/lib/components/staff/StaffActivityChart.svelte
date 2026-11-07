<script lang="ts">
  import { onMount } from 'svelte';
  export let points: Array<{ at: number; errors: number; businesses: number }>;
  export let hours: number;
  export let since: number;
  export let checkedAt: number;
  let chartHost: HTMLDivElement;
  let width = 840;
  const height = 266, left = 34, right = 34, top = 20, bottom = 34;
  $: plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const steps = [0, 0.25, 0.5, 0.75, 1];
  onMount(() => {
    const observer = new ResizeObserver(([entry]) => { width = Math.max(300, Math.round(entry.contentRect.width)); });
    observer.observe(chartHost);
    return () => observer.disconnect();
  });
  function ceiling(value: number) {
    const step = Math.max(1, 10 ** Math.floor(Math.log10(Math.max(value, 1))));
    return Math.max(1, Math.ceil(value / step) * step);
  }
  $: bucketSeconds = hours === 168 ? 86400 : 3600;
  $: start = Math.floor(since / bucketSeconds) * bucketSeconds;
  $: end = Math.max(start + 1, checkedAt);
  $: errorMax = ceiling(Math.max(0, ...points.map(point => point.errors)));
  $: businessMax = ceiling(Math.max(0, ...points.map(point => point.businesses)));
  const y = (value: number, max: number) => top + plotHeight - (value / max) * plotHeight;
  $: plotted = points.map(point => ({ ...point, x: left + ((point.at - start) / (end - start)) * plotWidth,
    errorY: y(point.errors, errorMax), businessY: y(point.businesses, businessMax) }));
  function segments(values: typeof plotted, key: 'errorY' | 'businessY', step: number) {
    return values.map((point, index) => `${index && point.at - values[index - 1].at === step ? 'L' : 'M'}${point.x},${point[key]}`).join(' ');
  }
  $: failurePath = segments(plotted, 'errorY', bucketSeconds);
  $: tenantPath = segments(plotted, 'businessY', bucketSeconds);
  function label(at: number) {
    return new Date(at * 1000).toLocaleString(undefined, hours === 168
      ? { month: 'short', day: 'numeric' } : hours === 24
        ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { hour: 'numeric', minute: '2-digit' });
  }
</script>

<figure class="activity-chart">
  <div class="chart-legend"><span class="failure-key">Failures <small>left axis</small></span><span class="tenant-key">Affected tenants <small>right axis</small></span></div>
  <div class="chart-canvas" bind:this={chartHost}>
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {#each steps as step}
        <line class="grid-line" x1={left} x2={width - right} y1={top + plotHeight * step} y2={top + plotHeight * step} />
        {#if points.length && (step === 0 || step === 1 || step === 0.5 && errorMax >= 2)}
          <text class="failure-axis" x={left - 10} y={top + plotHeight * step + 4} text-anchor="end">{Math.round(errorMax * (1 - step))}</text>
        {/if}
        {#if points.length && (step === 0 || step === 1 || step === 0.5 && businessMax >= 2)}
          <text class="tenant-axis" x={width - right + 10} y={top + plotHeight * step + 4}>{Math.round(businessMax * (1 - step))}</text>
        {/if}
      {/each}
      {#each [0, 0.25, 0.5, 0.75, 1] as step}
        <line class="vertical-line" x1={left + plotWidth * step} x2={left + plotWidth * step} y1={top} y2={top + plotHeight} />
      {/each}
      {#if points.length}
        <path class="series failures" d={failurePath} />
        <path class="series tenants" d={tenantPath} />
        {#each plotted as point (point.at)}
          <g><title>{new Date(point.at * 1000).toLocaleString()}: {point.errors} failures; {point.businesses} affected tenants</title>
            <circle class="failure-point" cx={point.x} cy={point.errorY} r={points.length === 1 ? 5 : 2.5} />
            <circle class="tenant-point" cx={point.x} cy={point.businessY} r={points.length === 1 ? 3 : 2.5} />
          </g>
        {/each}
      {/if}
      <text class="time-axis" x={left} y={height - 6}>{label(start)}</text>
      <text class="time-axis" x={width - right} y={height - 6} text-anchor="end">{label(end)}</text>
    </svg>
    {#if !points.length}<div class="chart-empty"><span class="material-icons" aria-hidden="true">query_stats</span><strong>No observations yet</strong><span>Activity appears here as it is recorded.</span></div>{/if}
  </div>
  {#if points.length}<table class="chart-data"><caption>Application failures and affected tenants</caption><thead><tr><th>Period</th><th>Failures</th><th>Affected tenants</th></tr></thead><tbody>{#each points as point}<tr><td>{new Date(point.at * 1000).toLocaleString()}</td><td>{point.errors}</td><td>{point.businesses}</td></tr>{/each}</tbody></table>{/if}
  <figcaption>{points.length === 1 ? 'One observation; more are needed for a trend.' : 'Observed failures and distinct tenants per period. Gaps are unobserved.'}</figcaption>
</figure>

<style>
  .activity-chart { margin: 0; min-width: 0; }
  .chart-legend { display: flex; flex-wrap: wrap; gap: 0.7rem 1.5rem; font-size: 0.7rem; margin-bottom: 0.75rem; }
  .chart-legend > span { display: flex; gap: 0.4rem; align-items: center; }
  .chart-legend > span::before { content: ''; width: 13px; height: 2px; background: var(--staff-failure); }
  .chart-legend .tenant-key::before { background: var(--staff-tenant); }
  small { color: var(--color-text-muted); font-size: 0.65rem; }
  .chart-canvas { position: relative; min-width: 0; }
  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .grid-line { stroke: var(--color-divider); stroke-width: 1; }
  .vertical-line { stroke: var(--color-divider); stroke-dasharray: 2 7; opacity: 0.5; }
  text { font: 11px 'Consolas', 'SFMono-Regular', monospace; }
  .failure-axis { fill: var(--staff-failure); }
  .tenant-axis { fill: var(--staff-tenant); }
  .time-axis { fill: var(--color-text-muted); }
  .series { fill: none; stroke-width: 2; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .failures { stroke: var(--staff-failure); }
  .tenants { stroke: var(--staff-tenant); }
  .failure-point { fill: var(--staff-failure); }
  .tenant-point { fill: var(--staff-tenant); }
  .chart-empty { position: absolute; inset: 0 0 2rem; display: grid; place-content: center; justify-items: center; gap: 0.4rem; font-size: 0.72rem; color: var(--color-text-muted); }
  .chart-empty .material-icons { font-size: 1.5rem; margin-bottom: 0.25rem; color: var(--staff-tenant); }
  .chart-empty strong { color: var(--color-text); font-size: 0.85rem; font-weight: 500; }
  figcaption { color: var(--color-text-muted); font-size: 0.65rem; margin-top: 0.65rem; line-height: 1.5; }
  .activity-chart .chart-data { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (max-width: 560px) {
    svg { min-height: 180px; }
    .chart-empty { font-size: 0.65rem; }
    .chart-legend { font-size: 0.65rem; gap: 0.4rem 1rem; }
    .chart-legend small { font-size: 0.6rem; }
  }
</style>

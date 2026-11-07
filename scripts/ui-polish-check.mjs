import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const checks = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function expect(path, label, predicate) {
  const fullPath = resolve(root, path);
  if (!existsSync(fullPath)) {
    checks.push({ ok: false, label, detail: `${path} does not exist.` });
    return;
  }

  const source = read(path);
  checks.push({ ok: Boolean(predicate(source)), label, detail: path });
}

function expectMissing(path, label) {
  checks.push({ ok: !existsSync(resolve(root, path)), label, detail: path });
}

expect('src/lib/components/ui/PageHeader.svelte', 'page headers suppress legacy subtitles', (source) =>
  source.includes('export let subtitle') &&
  source.includes('data-legacy-subtitle') &&
  !source.includes('<p>{subtitle}</p>')
);

expect('src/routes/tools/safety-healthcode/+page.svelte', 'safety tool has no legacy intro subheader', (source) =>
  !source.includes('safety-note') &&
  !source.includes('health_and_safety') &&
  !source.includes('Use this as a quick kitchen reference')
);

expect('src/lib/components/ui/EmptyState.svelte', 'empty state actions have keyboard focus treatment', (source) =>
  source.includes('.action-btn:focus-visible') &&
  source.includes('outline-offset')
);

expect('src/app.css', 'global controls have visible keyboard focus', (source) =>
  source.includes(':where(a, button, input, select, textarea, [tabindex]):focus-visible') &&
  source.includes('outline-offset: 4px')
);

expect('src/app.css', 'reduced motion preference is respected globally', (source) =>
  source.includes('@media (prefers-reduced-motion: reduce)') &&
  source.includes('animation: none !important')
);

expectMissing('static/kitchen-icons', 'old kitchen icon folder stays removed');

expect('src/routes/+layout.svelte', 'shared word buttons retain selected and destructive manager states', (source) =>
  source.includes(':global(button:not(.card-hit):not(.shift-toggle).active-action)') &&
  source.includes(':global(button:not(.card-hit):not(.shift-toggle).danger-text)')
);

expect('src/routes/admin/+page.svelte', 'moderation state is exposed without changing its form actions', (source) =>
  source.includes('aria-pressed={idea.status === \'approved\'}') &&
  source.includes('aria-pressed={idea.status === \'rejected\'}') &&
  source.includes('action="?/approve_whiteboard"') &&
  source.includes('action="?/reject_whiteboard"')
);

expect('src/routes/admin/+page.svelte', 'chart range is regular when inactive and bold when selected', (source) => {
  const regular = source.match(/\.window-switch a\s*\{([^}]+)\}/)?.[1] ?? '';
  const selected = source.match(/\.window-switch a\.active\s*\{([^}]+)\}/)?.[1] ?? '';
  return regular.includes('font-weight: var(--weight-regular)') &&
    selected.includes('font-weight: var(--weight-bold)') &&
    source.includes("aria-current={data.analytics.windowDays === option.value ? 'true' : undefined}");
});

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}`);
  if (!check.ok) console.log(`  ${check.detail}`);
}

if (failed.length) {
  console.error(`\nUI polish check failed: ${failed.length} issue(s).`);
  process.exit(1);
}

console.log('\nUI polish check passed.');

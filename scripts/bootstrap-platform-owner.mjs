import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const args = new Map(process.argv.slice(2).filter(arg => arg.includes('=')).map(arg => {
  const index = arg.indexOf('=');
  return [arg.slice(2, index), arg.slice(index + 1)];
}));
const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local');
const email = String(args.get('email') ?? '').trim().toLowerCase();
if (remote === local || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    args.get('confirm') !== 'grant-initial-platform-owner') {
  console.error('Specify --local or --remote, --email=<existing account>, and --confirm=grant-initial-platform-owner.');
  process.exit(1);
}
if (remote && !process.env.CLOUDFLARE_API_TOKEN) {
  for (const file of ['.dev.vars', '.env.production.local']) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, 'utf8').split(/\r?\n/).find(line => /^\s*CLOUDFLARE_API_TOKEN\s*=/.test(line));
    if (line) { process.env.CLOUDFLARE_API_TOKEN = line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, ''); break; }
  }
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
function query(sql) {
  const child = spawnSync(process.execPath, [join(process.cwd(), 'node_modules/wrangler/bin/wrangler.js'),
    'd1', 'execute', 'crimini-production', remote ? '--remote' : '--local', '--json', '--command', sql],
  { encoding: 'utf8', env: process.env, shell: false });
  if (child.status !== 0) throw new Error('D1 operation failed. Verify credentials and apply migration 0107 first.');
  const result = JSON.parse(child.stdout);
  if (!result.length || result.some(part => !part.success)) throw new Error('D1 operation failed.');
  return result;
}
const accounts = query(`SELECT id FROM users WHERE lower(email) = ${quote(email)} AND COALESCE(is_active, 1) = 1 LIMIT 2;`)[0].results;
if (accounts.length !== 1) throw new Error('Exactly one existing active account must match. No account was created.');
const id = accounts[0].id;
const now = Math.floor(Date.now() / 1000);
query(`INSERT INTO platform_staff_members (user_id, staff_role, is_active, granted_by, created_at, updated_at)
  SELECT ${quote(id)}, 'owner', 1, NULL, ${now}, ${now}
  WHERE NOT EXISTS (SELECT 1 FROM platform_staff_members WHERE staff_role = 'owner' AND is_active = 1);
`);
const staff = query(`SELECT user_id, staff_role, is_active FROM platform_staff_members WHERE user_id = ${quote(id)};`)[0].results[0];
if (!staff || staff.staff_role !== 'owner' || staff.is_active !== 1) throw new Error('Initial owner grant refused; an owner already exists.');
console.log(`Verified platform owner for the existing account in ${remote ? 'production' : 'localdev'}. Restaurant roles and credentials were not changed.`);

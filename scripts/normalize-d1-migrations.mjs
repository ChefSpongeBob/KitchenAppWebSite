import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = new Set(process.argv.slice(2));
const isRemote = argv.has('--remote');
const isDryRun = argv.has('--dry-run');
const dbNameArg = process.argv.find((arg) => arg.startsWith('--db='));
const dbName = dbNameArg ? dbNameArg.slice('--db='.length) : 'kitchen';

const root = process.cwd();
const migrationsDir = path.join(root, 'migrations');

function runWrangler(command) {
  const wranglerBin = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const args = [wranglerBin, 'd1', 'execute', dbName];
  if (isRemote) args.push('--remote');
  else args.push('--local');
  args.push('--command', command, '--json');

  const proc = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8'
  });

  const combined = `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`.trim();
  if (proc.status !== 0) {
    throw new Error(`Wrangler command failed:\n${combined}`);
  }
  const parsed = JSON.parse(proc.stdout ?? '[]');
  return Array.isArray(parsed) ? parsed : [];
}

function parseWranglerResults(output) {
  if (!Array.isArray(output) || output.length === 0) return [];
  return output?.[0]?.results ?? [];
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function loadMigrationFiles() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    throw new Error('No migration files found in ./migrations');
  }
  return files;
}

function pickTimestampColumn(columns) {
  const names = new Set(columns.map((column) => column.name));
  const candidates = ['applied_at', 'applied_on', 'created_at', 'ts'];
  return candidates.find((name) => names.has(name)) ?? null;
}

function buildInsertSql(migrationName, timestampColumn) {
  const nameValue = sqlQuote(migrationName);
  if (timestampColumn) {
    return `INSERT OR IGNORE INTO d1_migrations (name, ${timestampColumn}) VALUES (${nameValue}, strftime('%s','now'));`;
  }
  return `INSERT OR IGNORE INTO d1_migrations (name) VALUES (${nameValue});`;
}

function main() {
  const mode = isRemote ? 'remote' : 'local';
  console.log(`Normalizing d1_migrations (${mode}) for DB "${dbName}"...`);

  const migrations = loadMigrationFiles();
  const columns = parseWranglerResults(runWrangler('PRAGMA table_info(d1_migrations);'));

  if (!columns.some((column) => column.name === 'name')) {
    throw new Error('d1_migrations table is missing required "name" column.');
  }

  const timestampColumn = pickTimestampColumn(columns);
  const statements = migrations.map((name) => buildInsertSql(name, timestampColumn));
  const sql = statements.join('\n');

  if (isDryRun) {
    console.log(`Dry run only. Would insert/ignore ${migrations.length} migration rows.`);
    console.log(statements.slice(0, 5).join('\n'));
    if (migrations.length > 5) {
      console.log(`... (${migrations.length - 5} more statements)`);
    }
    return;
  }

  runWrangler(sql);
  const trackedRows = parseWranglerResults(runWrangler('SELECT COUNT(*) AS count FROM d1_migrations;'));
  const trackedCount = Number(trackedRows?.[0]?.count ?? 0);
  console.log(`Done. d1_migrations row count: ${trackedCount}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

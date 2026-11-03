import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
export const kit = {
  fail: (status, data) => ({ status, data }),
  error: (status, message) => { throw Object.assign(new Error(message), { status, body: { message } }); },
  redirect: (status, location) => { throw Object.assign(new Error('Redirect'), { status, location }); },
  isRedirect: error => Boolean(error?.location),
  isHttpError: error => Boolean(error?.status && !error?.location),
  json: (body, init) => Response.json(body, init)
};

export function createTestD1(source) {
  const sqlite = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
  sqlite.exec(source ?? readFileSync('scripts/fixtures/current-schema.sql', 'utf8'));
  sqlite.exec('PRAGMA foreign_keys=ON');
  if (source === undefined) {
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(readFileSync('migrations/0111_tenant_content_slug_uniqueness.sql', 'utf8'));
      sqlite.exec(readFileSync('migrations/0112_staff_email_verification.sql', 'utf8'));
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
  let queryCount = 0;
  function prepare(sql) {
    let values = [];
    const statement = {
      bind(...input) { values = input; return statement; },
      async first(column) {
        queryCount++;
        const row = sqlite.prepare(sql).get(...values) ?? null;
        return column && row ? row[column] : row;
      },
      async all() {
        queryCount++;
        return { success: true, results: sqlite.prepare(sql).all(...values), meta: {} };
      },
      async run() {
        queryCount++;
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
      }
    };
    return statement;
  }
  const db = { prepare, async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  return { sqlite, db, get queryCount() { return queryCount; }, close: () => sqlite.close() };
}

export function loadServerModules(overrides = {}) {
  const cache = new Map();
  const common = { '$app/env': { dev: false, building: false, browser: false }, '@sveltejs/kit': kit, ...overrides };
  function load(file) {
    const path = resolve(file);
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    cache.set(path, exports);
    const source = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
    }).outputText;
    new Function('require', 'exports', source)(name => {
      if (name in common) return common[name];
      if (name.startsWith('#lib/') || name.startsWith('.')) {
        const base = name.startsWith('#lib/') ? resolve('src/lib', name.slice(5)) : resolve(dirname(path), name);
        const target = [base, base + '.ts', base + '.js', base + '/index.ts'].find(candidate => existsSync(candidate));
        if (!target) throw Error(`Missing module ${name} from ${file}`);
        return load(target);
      }
      return require(name);
    }, exports);
    return exports;
  }
  return load;
}

export function formRequest(fields, path = '/admin/schedule') {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
  return new Request('https://criminiops.com' + path, { method: 'POST', body,
    headers: { origin: 'https://criminiops.com' } });
}

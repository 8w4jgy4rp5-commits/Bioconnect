const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
// Test-only Auth shim; this is never deployed as a migration.
const bootstrap = `
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.jwt',true),'')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`;
const ids = { a: '00000000-0000-4000-8000-000000000001', b: '00000000-0000-4000-8000-000000000002' };
async function createDB(postgres = false) {
  let engine, pg, client, raw;
  if (postgres) {
    const Embedded = (await import(require('url').pathToFileURL(require.resolve('embedded-postgres')).href)).default;
    const data = process.env.BIOCONNECT_TEST_DB_DIR || path.join(require('os').tmpdir(), 'bioconnect-pg-' + randomUUID());
    pg = new Embedded({ databaseDir: data, user: 'postgres', password: 'local-test-only', port: 55439,
      // PostgreSQL 18 Windows I/O workers can outlive embedded-postgres's taskkill.
      // Synchronous disk I/O avoids orphan workers; transaction concurrency is unchanged.
      persistent: false, initdbFlags: ['--locale=C', '--encoding=UTF8'],
      postgresFlags: ['-c', 'io_method=sync'], onLog: () => {}, onError: console.error });
    await pg.initialise(); await pg.start();
    client = pg.getPgClient(); await client.connect();
    raw = async (sql, args) => client.query(sql,args);
  } else {
    const { PGlite } = require('@electric-sql/pglite'); engine = new PGlite();
    raw = (sql,args) => args ? engine.query(sql,args) : engine.exec(sql).then(res => res.at(-1));
  }
  await raw(bootstrap);
  await raw(fs.readFileSync(path.join(__dirname, '../supabase/migrations/202610050001_monetization.sql'),'utf8'));
  await raw(`insert into auth.users values ('${ids.a}'),('${ids.b}')`);
  let queue = Promise.resolve();
  const query = (sql,args) => raw(sql,args);
  async function transaction(owner, role, sql, args) {
    let c = client;
    if (postgres) { c = pg.getPgClient(); await c.connect(); }
    const q = postgres ? (s,a) => c.query(s,a) : (s,a) => engine.query(s,a);
    try {
      await q('begin'); await q("select set_config('test.jwt',$1,true)",[owner || '']);
      await q('set local role ' + role);
      const result = await q(sql,args); await q('commit'); return result.rows;
    } catch(e) { await q('rollback'); throw e; }
    finally { if (postgres) await c.end(); }
  }
  function as(owner, sql, args = [], role = 'authenticated') {
    if (postgres) return transaction(owner,role,sql,args);
    const promise = queue.then(() => transaction(owner,role,sql,args));
    queue = promise.catch(() => {}); return promise;
  }
  return { query, as, ids, close: async () => { if (engine) await engine.close(); if (client) await client.end(); if (pg) await pg.stop(); } };
}
module.exports = { createDB, ids };

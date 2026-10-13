// ตัวทดสอบในเครื่อง: Postgres จริง (embedded) + engine + handler ชุดเดียวกับที่ขึ้น Supabase
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import http from 'node:http';
import fs from 'node:fs';
import { createEngine } from '../supabase/functions/api/engine.js';
import { ensureSchema } from '../supabase/functions/api/bootstrap.js';
import { memoryStorage, testSms } from '../supabase/functions/api/adapters.js';
import { createHandler, once } from '../supabase/functions/api/server.js';
import seed from '../supabase/functions/api/seed.js';

export async function startStack({ port = 54329, db = 'sbp_' + Date.now(), httpPort = 0, smsOn = true } = {}) {
  const pg = new EmbeddedPostgres({ databaseDir: new URL('../.local/pgdata', import.meta.url).pathname, user: 'postgres', password: 'pw', port, persistent: true, onLog: () => {}, onError: () => {} });
  try { await pg.start(); } catch (e) { /* อาจรันอยู่แล้ว */ }
  const admin = postgres({ host: '127.0.0.1', port, user: 'postgres', password: 'pw', database: 'postgres', onnotice: () => {} });
  await admin.unsafe(`create database ${db}`);
  await admin.end();
  const sql = postgres({ host: '127.0.0.1', port, user: 'postgres', password: 'pw', database: db, prepare: false, max: 4, onnotice: () => {} });
  const storage = memoryStorage();
  const sms = testSms(smsOn);
  const engine = createEngine({ sql, storage, sms, log: { log() {}, error: (...a) => console.error(...a) } });
  const ready = once(async () => {
    await ensureSchema(sql, { SCHEMA: engine.SCHEMA, seed, defaults: engine.core._t.DEFAULT_SETTINGS, nowIso: engine.core._t.nowIso });
    await storage.init();
  });
  const handle = createHandler({ engine, ready, log: { error: (...a) => console.error(...a) } });
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handle(new Request('http://x' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  });
  await new Promise(r => server.listen(httpPort, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  async function call(fn, ...args) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://sbp-test.pages.dev' }, body: JSON.stringify({ fn, args }) });
    const j = await r.json();
    if (!j.ok) throw new Error('HTTP ' + r.status + ' ' + j.error);
    return j.value;
  }
  async function stop() { server.close(); await sql.end(); }
  const row = async (t, k, v) => { const r = await sql.unsafe(`select data from sbp.${t.toLowerCase()} where data->>$1 = $2 limit 1`, [k, String(v)]); return r[0] ? r[0].data : null; };
  const rows = async t => (await sql.unsafe(`select data from sbp.${t.toLowerCase()} order by rid`)).map(r => r.data);
  const setupCode = () => fs.readFileSync(new URL('../.setup-code.txt', import.meta.url), 'utf8').trim();
  return { url, call, sms, storage, sql, engine, stop, pg, db, core: engine.core, row, rows, setupCode,
    smsBox: () => sms.box, hasFile: id => storage._map.has(id), wipeCache: () => sql.unsafe('delete from sbp.cache'),
    http: true, linkRe: /^https:\/\/sbp-test\.pages\.dev\?quote=[a-f0-9]{64}$/ };
}

// เปิด Postgres แล้วรัน test/deno-smoke.ts บน Deno (runtime เดียวกับ Supabase)
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { spawnSync } from 'node:child_process';
const pg = new EmbeddedPostgres({ databaseDir: new URL('../.local/pgdata', import.meta.url).pathname, user: 'postgres', password: 'pw', port: 54329, persistent: true, onLog: () => {}, onError: () => {} });
try { await pg.start(); } catch (e) { console.log('pg start:', e && e.message); }
const a = postgres({ host: '127.0.0.1', port: 54329, user: 'postgres', password: 'pw', database: 'postgres', onnotice: () => {} });
await a.unsafe('drop database if exists sbp_deno'); await a.unsafe('create database sbp_deno'); await a.end();
const deno = new URL('../node_modules/.bin/deno', import.meta.url).pathname;
const r = spawnSync(deno, ['run', '-A', 'test/deno-smoke.ts'], { stdio: 'inherit', cwd: process.env.DENO_DIR_TEST || '/tmp/claude-0/denotest' });
await pg.stop();
process.exit(r.status || 0);

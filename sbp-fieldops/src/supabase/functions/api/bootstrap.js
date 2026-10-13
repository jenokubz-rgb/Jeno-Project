// bootstrap.js — สร้างตาราง + เติมข้อมูลตั้งต้นครั้งแรก (รันซ้ำได้ ไม่ทับข้อมูลเดิม)
import { randomBytes } from 'node:crypto';

export async function ensureSchema(sql, { schema = 'sbp', SCHEMA, seed, defaults, nowIso }) {
  await sql.begin(async tx => {
    await tx.unsafe('select pg_advisory_xact_lock(770114)');
    await tx.unsafe(`create schema if not exists ${schema}`);
    for (const name of Object.keys(SCHEMA)) {
      const t = `${schema}.${name.toLowerCase()}`;
      await tx.unsafe(`create table if not exists ${t} (rid bigserial primary key, data jsonb not null, updated_at timestamptz not null default now())`);
      await tx.unsafe(`alter table ${t} enable row level security`);
    }
    await tx.unsafe(`create table if not exists ${schema}.props (key text primary key, value text not null)`);
    await tx.unsafe(`create table if not exists ${schema}.cache (key text primary key, value text not null, expires_at timestamptz not null)`);
    await tx.unsafe(`alter table ${schema}.props enable row level security`);
    await tx.unsafe(`alter table ${schema}.cache enable row level security`);
    // Supabase: ไม่เปิดตารางให้ API สาธารณะ (anon/authenticated) เข้าถึงโดยตรง — ผ่าน Edge Function เท่านั้น
    await tx.unsafe(`do $$ begin
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on schema ${schema} from anon, authenticated';
        execute 'revoke all on all tables in schema ${schema} from anon, authenticated';
      end if; end $$`);

    const [{ n }] = await tx.unsafe(`select count(*)::int as n from ${schema}.users`);
    if (n > 0) return;

    const ins = async (name, rows) => {
      const hdr = SCHEMA[name];
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map(r => {
          const o = {};
          for (const h of hdr) o[h] = r[h] === undefined || r[h] === null ? '' : r[h];
          return JSON.stringify(o);
        });
        await tx.unsafe(`insert into ${schema}.${name.toLowerCase()} (data) select x::jsonb from unnest($1::text[]) as x`, [chunk]);
      }
    };
    const now = nowIso();
    await ins('Users', seed.users.map(u => ({ ...u, phone: '', pin_hash: '', must_change: 'Y', active: u.active || 'Y', session_ver: 1, recovery_hash: '', last_login: '', created_at: now })));
    await ins('Customers', seed.customers.map(c => ({ ...c, created_at: c.created_at || now })));
    await ins('Catalog', seed.catalog);
    await ins('Settings', defaults.map(s => ({ key: s[0], value: seed.settings && seed.settings[s[0]] !== undefined ? seed.settings[s[0]] : s[1], note: s[2] })));
    const props = {
      TOKEN_SECRET: randomBytes(32).toString('hex'),
      SETUP_SALT: seed.setup.salt,
      SETUP_HASH: seed.setup.hash,
      SEED_VERSION: seed.version
    };
    for (const [k, v] of Object.entries(props)) {
      await tx.unsafe(`insert into ${schema}.props (key, value) values ($1, $2) on conflict (key) do nothing`, [k, v]);
    }
  });
}

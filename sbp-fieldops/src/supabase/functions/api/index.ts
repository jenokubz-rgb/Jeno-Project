// @ts-nocheck
// SBP FieldOps API — Supabase Edge Function
// ตัวแปรที่ Supabase ใส่ให้อัตโนมัติ: SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ตัวแปรที่ตั้งเอง (Edge Functions → Secrets): THAIBULKSMS_KEY, THAIBULKSMS_SECRET, THAIBULKSMS_SENDER
import postgres from 'npm:postgres@3.4.5';
import { createEngine } from './engine.js';
import { ensureSchema } from './bootstrap.js';
import { supabaseStorage, memoryStorage, thaiBulkSms, testSms } from './adapters.js';
import { createHandler, once } from './server.js';
import seed from './seed.js';

const env = (k: string) => Deno.env.get(k) || '';
const dbUrl = env('SUPABASE_DB_URL') || env('DATABASE_URL');
const sql = postgres(dbUrl, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 15, onnotice: () => {} });

const storageKey = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY');
const storage = env('SUPABASE_URL') && storageKey ? supabaseStorage(env('SUPABASE_URL'), storageKey) : memoryStorage();

const sms = env('SMS_TEST') === '1'
  ? testSms(true)
  : thaiBulkSms({ key: env('THAIBULKSMS_KEY'), secret: env('THAIBULKSMS_SECRET'), sender: env('THAIBULKSMS_SENDER') });

const engine = createEngine({ sql, storage, sms });
const ready = once(async () => {
  await ensureSchema(sql, { SCHEMA: engine.SCHEMA, seed, defaults: engine.core._t.DEFAULT_SETTINGS, nowIso: engine.core._t.nowIso });
  await storage.init();
});

const handle = createHandler({ engine, ready });
if (env('SMS_TEST') === '1') globalThis.__smsBox = sms.box;

Deno.serve(handle);

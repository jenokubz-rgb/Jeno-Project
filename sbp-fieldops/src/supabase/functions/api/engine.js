// engine.js — ตัวกลางระหว่างตรรกะธุรกิจ (core.js) กับฐานข้อมูล Postgres + ที่เก็บรูป + SMS
//
// วิธีทำงานต่อหนึ่งคำขอ:
//   1) เปิด transaction + ล็อกระดับระบบ (คำขอที่เขียนข้อมูลเข้าคิวทีละคำขอ ข้อมูลไม่ชนกัน)
//   2) โหลดตารางที่ต้องใช้ แล้วรัน core แบบ synchronous บนสำเนาในหน่วยความจำ
//      ถ้า core ขอตารางที่ยังไม่โหลด → โหลดเพิ่มแล้วรันใหม่ตั้งแต่ต้น (ยังไม่มีอะไรถูกบันทึก)
//   3) อัปโหลดรูปที่รอไว้ แล้วบันทึกทุกการเปลี่ยนแปลงในครั้งเดียว → commit
//   4) ส่ง SMS ที่รอไว้ (หลัง commit)
import { createHash, createHmac, randomUUID, randomInt, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { makeCore } from './core.js';

const TZ_OFFSET_MS = 7 * 3600000; // Asia/Bangkok (ไม่มีเวลาออมแสง)
const LOCK_KEY = 770113;
const MAX_ATTEMPTS = 40;

class Need extends Error {
  constructor(kind, key) { super('NEED ' + kind + ':' + key); this.need = { kind, key }; }
}

// ------------------------------------------------------------ GAS-compatible helpers
function signedBytes(buf) { return Array.from(new Int8Array(buf.buffer, buf.byteOffset, buf.length)); }
function toBuf(bytes) { return Buffer.from(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes.map ? bytes.map(b => b & 255) : bytes)); }

function formatDate(date, _tz, fmt) {
  const d = new Date(new Date(date).getTime() + TZ_OFFSET_MS);
  const p2 = n => String(n).padStart(2, '0');
  const map = {
    yyyy: String(d.getUTCFullYear()), yy: p2(d.getUTCFullYear() % 100), MM: p2(d.getUTCMonth() + 1),
    dd: p2(d.getUTCDate()), HH: p2(d.getUTCHours()), mm: p2(d.getUTCMinutes()), ss: p2(d.getUTCSeconds())
  };
  return String(fmt).replace(/'([^']*)'|yyyy|yy|MM|dd|HH|mm|ss/g, (m, lit) => (lit !== undefined ? lit : map[m]));
}

function makeBlob(bytes, type, name) {
  const buf = toBuf(bytes);
  return { getBytes: () => buf, getContentType: () => type, getName: () => name, _buf: buf };
}

// ------------------------------------------------------------ engine
export function createEngine({ sql, storage, sms, schemaName = 'sbp', log = console }) {
  const g = { ctx: null };
  const T = name => schemaName + '.' + name.toLowerCase();

  // shim ของบริการ Google Apps Script ที่ core ใช้ — ทุกตัวอ่าน/เขียนผ่าน g.ctx ของคำขอปัจจุบัน
  g.Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    getUuid: () => randomUUID(),
    formatDate,
    computeDigest: (alg, s) => signedBytes(createHash(alg).update(String(s), 'utf8').digest()),
    computeHmacSha256Signature: (v, k) => signedBytes(createHmac('sha256', String(k)).update(String(v), 'utf8').digest()),
    base64Decode: s => new Uint8Array(Buffer.from(String(s), 'base64')),
    base64Encode: b => toBuf(b).toString('base64'),
    newBlob: makeBlob,
    randomDigits: n => { let s = ''; while (s.length < n) s += String(randomInt(0, 10)); return s; }
  };
  g.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: k => { const c = g.ctx; return c.propsW.has(k) ? c.propsW.get(k) : (c.raw.props.has(k) ? c.raw.props.get(k) : null); },
      setProperty: (k, v) => { g.ctx.propsW.set(k, String(v)); },
      deleteProperty: k => { g.ctx.propsW.set(k, null); }
    })
  };
  g.CacheService = {
    getScriptCache: () => ({
      get: k => { const c = g.ctx; if (c.cacheW.has(k)) { const w = c.cacheW.get(k); return w ? w.v : null; } const r = c.raw.cache.get(k); return r ? r : null; },
      put: (k, v, ttl) => { g.ctx.cacheW.set(k, { v: String(v), ttl: Math.min(Number(ttl) || 600, 21600) }); },
      remove: k => { g.ctx.cacheW.set(k, null); }
    })
  };
  g.LockService = { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) };
  g.ScriptApp = { getService: () => ({ getUrl: () => g.ctx.origin || '' }) };
  g.Logger = { log: m => log.log(m) };
  g.SMS = {
    configured: () => !!(sms && sms.configured()),
    send: (to, text) => { g.ctx.smsOut.push({ to, text }); }
  };
  g.DriveApp = {
    createFile: blob => {
      const id = randomBytes(12).toString('hex');
      g.ctx.uploads.push({ id, type: blob.getContentType(), bytes: blob._buf || toBuf(blob.getBytes()) });
      return { getId: () => id };
    },
    getFileById: id => {
      const c = g.ctx;
      const up = c.uploads.find(u => u.id === id);
      const f = up || c.raw.files.get(id);
      if (!f) { c.need = c.need || { kind: 'file', key: id }; throw new Need('file', id); }
      return { getBlob: () => makeBlob(f.bytes, f.type, id) };
    }
  };
  g.DB = makeDB(g);

  const core = makeCore(g);
  const SCHEMA = core._t.SCHEMA;
  g.DB._schema = SCHEMA;
  const learned = new Map(); // คำสั่ง → ตารางที่เคยต้องใช้ (โหลดล่วงหน้าครั้งต่อไป)

  async function loadTable(tx, raw, name) {
    if (!SCHEMA[name]) throw new Error('ไม่รู้จักตาราง ' + name);
    const rows = await tx.unsafe(`select rid, data from ${T(name)} order by rid`);
    raw.tables.set(name, rows.map(r => ({ rid: Number(r.rid), data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data })));
  }

  async function run(fnName, args, opts = {}) {
    const key = fnName === 'api' ? 'api:' + String(args[1] || '') : fnName;
    return await sql.begin(async tx => {
      await tx.unsafe(`select pg_advisory_xact_lock(${LOCK_KEY})`);
      const raw = { tables: new Map(), props: new Map(), cache: new Map(), files: new Map() };
      for (const r of await tx.unsafe(`select key, value from ${schemaName}.props`)) raw.props.set(r.key, r.value);
      for (const r of await tx.unsafe(`select key, value from ${schemaName}.cache where expires_at > now()`)) raw.cache.set(r.key, r.value);
      for (const name of new Set(['Users', 'Settings', ...(learned.get(key) || [])])) await loadTable(tx, raw, name);

      let result, ctx;
      for (let attempt = 0; ; attempt++) {
        if (attempt >= MAX_ATTEMPTS) throw new Error('คำขอซับซ้อนเกินไป');
        ctx = newCtx(raw, opts.origin);
        g.ctx = ctx;
        try {
          result = core[fnName].apply(null, args);
        } catch (e) {
          if (!(e instanceof Need) && !ctx.need) { g.ctx = null; throw e; }
        } finally { g.ctx = null; }
        if (!ctx.need) break;
        const n = ctx.need;
        if (n.kind === 'table') {
          await loadTable(tx, raw, n.key);
          const set = learned.get(key) || new Set(); set.add(n.key); learned.set(key, set);
        } else if (n.kind === 'file') {
          const f = await storage.get(n.key);
          if (!f) throw new Error('ไม่พบไฟล์รูป');
          raw.files.set(n.key, f);
        }
      }
      await commit(tx, ctx);
      return { result, smsOut: ctx.smsOut };
    }).then(async ({ result, smsOut }) => {
      for (const m of smsOut) {
        try { await sms.send(m.to, m.text); } catch (e) {
          log.error('SMS ส่งไม่สำเร็จ', e && e.message);
          return { ok: false, error: 'ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่ หรือขอรหัสเข้าใช้ชั่วคราวจากผู้จัดการ' };
        }
      }
      return result;
    });
  }

  function newCtx(raw, origin) {
    return {
      raw, origin, need: null, t: new Map(), inserts: [], dirty: new Set(), deletes: [],
      propsW: new Map(), cacheW: new Map(), uploads: [], smsOut: []
    };
  }

  async function commit(tx, ctx) {
    for (const u of ctx.uploads) await storage.put(u.id, u.bytes, u.type);
    const strip = r => { const o = {}; for (const k of Object.keys(r)) if (k !== '_rid') o[k] = r[k]; return o; };
    for (const { name, row } of ctx.inserts) {
      if (row._deleted) continue;
      await tx.unsafe(`insert into ${T(name)} (data) values ($1::text::jsonb)`, [JSON.stringify(strip(row))]);
    }
    for (const row of ctx.dirty) {
      if (row._rid > 0 && !row._deleted) {
        await tx.unsafe(`update ${T(row._table)} set data = $1::text::jsonb, updated_at = now() where rid = $2`, [JSON.stringify(strip(row)), row._rid]);
      }
    }
    for (const { name, rid } of ctx.deletes) await tx.unsafe(`delete from ${T(name)} where rid = $1`, [rid]);
    for (const [k, v] of ctx.propsW) {
      if (v === null) await tx.unsafe(`delete from ${schemaName}.props where key = $1`, [k]);
      else await tx.unsafe(`insert into ${schemaName}.props (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value`, [k, v]);
    }
    for (const [k, w] of ctx.cacheW) {
      if (w === null) await tx.unsafe(`delete from ${schemaName}.cache where key = $1`, [k]);
      else await tx.unsafe(`insert into ${schemaName}.cache (key, value, expires_at) values ($1, $2, now() + make_interval(secs => $3))
        on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at`, [k, w.v, w.ttl]);
    }
    if (Math.random() < 0.05) await tx.unsafe(`delete from ${schemaName}.cache where expires_at < now()`);
  }

  return { run, core, SCHEMA };
}

// ------------------------------------------------------------ in-memory table view (เหมือน DB เดิมของ Google Sheets)
function makeDB(g) {
  let tmp = 0;
  function table(name) {
    const c = g.ctx;
    let t = c.t.get(name);
    if (t) return t;
    const raw = c.raw.tables.get(name);
    if (!raw) { c.need = c.need || { kind: 'table', key: name }; throw new Need('table', name); }
    const rows = raw.map(r => Object.assign(structuredClone(r.data), { _rid: r.rid }));
    for (const ins of c.inserts) if (ins.name === name && !ins.row._deleted) rows.push(ins.row);
    for (const row of rows) Object.defineProperty(row, '_table', { value: name, enumerable: false, writable: true });
    t = { rows, idx: {} };
    c.t.set(name, t);
    return t;
  }
  function cols(name) {
    const s = g.ctx && g.ctx.schema ? g.ctx.schema[name] : null;
    return s || DB._schema[name];
  }
  const DB = {
    _schema: {},
    reset() {},
    all(name) { return table(name).rows; },
    find(name, key, val) {
      const t = table(name);
      if (!t.idx[key]) { t.idx[key] = new Map(); for (const r of t.rows) if (!t.idx[key].has(r[key])) t.idx[key].set(r[key], r); }
      return t.idx[key].get(val) || null;
    },
    insert(name, obj) {
      const hdr = cols(name);
      const row = {};
      for (const h of hdr) { const v = obj[h]; row[h] = v === undefined || v === null ? '' : v; }
      Object.defineProperty(row, '_rid', { value: --tmp, enumerable: false, writable: true });
      Object.defineProperty(row, '_table', { value: name, enumerable: false, writable: true });
      g.ctx.inserts.push({ name, row });
      const t = g.ctx.t.get(name);
      if (t) { t.rows.push(row); t.idx = {}; }
    },
    update(name, key, val, patch) {
      const r = DB.find(name, key, val);
      if (!r) throw new Error('ไม่พบ ' + val);
      const hdr = cols(name);
      for (const f of Object.keys(patch)) {
        if (hdr.indexOf(f) < 0) continue;
        const v = patch[f] === undefined || patch[f] === null ? '' : patch[f];
        r[f] = v;
      }
      const t = table(name); t.idx = {};
      if (r._rid > 0) g.ctx.dirty.add(r);
    },
    deleteWhere(name, pred) {
      const t = table(name);
      const keep = [];
      for (const r of t.rows) {
        if (pred(r)) {
          r._deleted = true;
          if (r._rid > 0) g.ctx.deletes.push({ name, rid: r._rid });
        } else keep.push(r);
      }
      t.rows = keep; t.idx = {};
    }
  };
  return DB;
}

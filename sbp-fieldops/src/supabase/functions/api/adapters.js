// adapters.js — ที่เก็บรูป (Supabase Storage) และการส่ง SMS (ThaiBulkSMS)
import { Buffer } from 'node:buffer';

const BUCKET = 'photos';

/** Supabase Storage (bucket ส่วนตัว — รูปเปิดได้ผ่านระบบเท่านั้น) */
export function supabaseStorage(url, key) {
  const base = String(url || '').replace(/\/$/, '');
  const headers = extra => {
    const h = { apikey: key, ...extra };
    if (!String(key).startsWith('sb_')) h.Authorization = 'Bearer ' + key; // คีย์แบบเก่า (JWT)
    return h;
  };
  return {
    async init() {
      const r = await fetch(`${base}/storage/v1/bucket`, {
        method: 'POST', headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: 6 * 1024 * 1024 })
      });
      if (!r.ok && r.status !== 409) {
        const t = await r.text();
        if (!/exist/i.test(t)) throw new Error('สร้างที่เก็บรูปไม่สำเร็จ: ' + r.status + ' ' + t.slice(0, 200));
      } else if (!r.ok) await r.text();
    },
    async put(id, bytes, type) {
      const r = await fetch(`${base}/storage/v1/object/${BUCKET}/${id}`, {
        method: 'POST', headers: headers({ 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '31536000' }),
        body: bytes
      });
      if (!r.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ (' + r.status + ')');
      await r.text();
    },
    async get(id) {
      const r = await fetch(`${base}/storage/v1/object/${BUCKET}/${id}`, { headers: headers({}) });
      if (r.status === 404 || r.status === 400) { await r.text(); return null; }
      if (!r.ok) throw new Error('โหลดรูปไม่สำเร็จ (' + r.status + ')');
      return { bytes: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'image/jpeg' };
    }
  };
}

/** ที่เก็บรูปในหน่วยความจำ (ใช้ทดสอบในเครื่อง) */
export function memoryStorage() {
  const m = new Map();
  return {
    async init() {},
    async put(id, bytes, type) { m.set(id, { bytes: Buffer.from(bytes), type }); },
    async get(id) { return m.get(id) || null; },
    _map: m
  };
}

/** ThaiBulkSMS — ส่ง SMS ด้วย API v2 (Basic auth ด้วย API Key/Secret) */
export function thaiBulkSms({ key, secret, sender }) {
  return {
    configured: () => !!(key && secret),
    async send(to, text) {
      const form = new URLSearchParams({ msisdn: to, message: text });
      if (sender) form.set('sender', sender);
      const r = await fetch('https://api-v2.thaibulksms.com/sms', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'
        },
        body: form.toString()
      });
      const body = await r.text();
      if (!r.ok) throw new Error('ThaiBulkSMS ' + r.status + ' ' + body.slice(0, 300));
      return body;
    }
  };
}

/** SMS สำหรับทดสอบ: เก็บข้อความไว้ ไม่ส่งจริง */
export function testSms(enabled = true) {
  const box = [];
  return { configured: () => enabled, async send(to, text) { box.push({ to, text, at: Date.now() }); }, box };
}

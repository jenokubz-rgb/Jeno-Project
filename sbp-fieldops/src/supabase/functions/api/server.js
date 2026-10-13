// server.js — รับคำขอจากหน้าเว็บ (POST {fn, args}) แล้วส่งให้ engine
const PUBLIC_FNS = new Set(['publicStatus', 'setupInit', 'otpRequest', 'otpVerify', 'pinLogin', 'recoveryLogin', 'api', 'publicQuote', 'publicAck']);
const MAX_BODY = 8 * 1024 * 1024;

export function createHandler({ engine, ready, log = console }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400'
  };
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });

  return async function handle(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET') return json({ ok: true, service: 'sbp-fieldops', time: new Date().toISOString() });
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    let body;
    try {
      const len = Number(req.headers.get('content-length') || 0);
      if (len > MAX_BODY) return json({ ok: false, error: 'ข้อมูลใหญ่เกินไป' }, 413);
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ ok: false, error: 'ข้อมูลใหญ่เกินไป' }, 413);
      body = JSON.parse(text);
    } catch (e) { return json({ ok: false, error: 'คำขอไม่ถูกต้อง' }, 400); }
    const fn = String(body && body.fn || '');
    const args = Array.isArray(body && body.args) ? body.args.slice(0, 5) : [];
    if (!PUBLIC_FNS.has(fn)) return json({ ok: false, error: 'ไม่รู้จักคำสั่ง' }, 400);
    let origin = String(req.headers.get('origin') || '');
    if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) origin = '';
    try {
      await ready();
      const value = await engine.run(fn, args, { origin });
      return json({ ok: true, value });
    } catch (e) {
      log.error('SBP', fn, e && (e.stack || e.message));
      return json({ ok: false, error: 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' }, 500);
    }
  };
}

/** เรียก ready() ซ้ำได้ — ถ้าครั้งแรกล้มเหลว (เช่น ฐานข้อมูลยังไม่พร้อม) จะลองใหม่ในคำขอถัดไป */
export function once(fn) {
  let p = null;
  return () => {
    if (!p) p = fn().catch(e => { p = null; throw e; });
    return p;
  };
}

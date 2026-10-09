// r21 production package check (dist/release/SBP-AirCare-ABC-<rev>/): open each a/b/c.html straight from disk (file://)
// at 1366 and 390 and check what a customer and the back office would get:
//   customer-facing <title> · no hub / dev links · quick quote prices · not connected → honest hand-off (no "sent" claim)
//   · connected (the <meta name="sbp-ticket-endpoint"> filled with a mocked https endpoint) → ticket number on the page,
//     Beta bar says requests reach the team, and the ticket names the edition it came from · no page errors · no sideways scroll
// usage: node tests/release-check.mjs [dir=dist/release/SBP-AirCare-ABC-r21]      (no dev server needed)
import { launch } from './_lib.mjs';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const dir = resolve(process.argv[2] || 'dist/release/SBP-AirCare-ABC-r21');
const MOCK = 'https://ticket.mock.invalid/exec';
const out = []; const ok = (name, pass, info = '') => { out.push({ name, pass: !!pass, info }); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const tmp = mkdtempSync(join(tmpdir(), 'sbp-rel-'));
const b = await launch();
for (const v of 'abc') {
  const html = readFileSync(join(dir, `${v}.html`), 'utf8');
  ok(`${v.toUpperCase()}: ชื่อแท็บเป็นชื่อธุรกิจ (ไม่มี "แบบ A/B/C")`, !/<title>[^<]*แบบ [ABC]/.test(html) && /<title>SBP AirCare/.test(html));
  ok(`${v.toUpperCase()}: ไม่มีลิงก์หน้ารวม/ชุดพัฒนา`, !/index3\.html|claude\.ai\/artifact/.test(html));
  // connected copy: same file with the endpoint meta filled in (what the README tells the owner to do)
  const conn = join(tmp, `${v}.html`);
  writeFileSync(conn, html.replace('<meta name="sbp-ticket-endpoint" content="">', `<meta name="sbp-ticket-endpoint" content="${MOCK}">`));
  for (const [w, file, mode] of [[1366, join(dir, `${v}.html`), 'offline'], [390, conn, 'connected']]) {
    const mob = w < 600;
    const ctx = await b.newContext({ viewport: { width: w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU stall|context lost/i.test(m.text())) errs.push(m.text().slice(0, 160)); });
    const sent = [];
    await p.route(MOCK, async r => { let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {} sent.push(body);
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body.action === 'slots' ? { ok: true, capacity: 2, days: [] } : { ok: true, id: 'SBP-691009-007', status: 'new', statusTh: 'รับเรื่องแล้ว' }) }); });
    await p.goto('file://' + file);
    await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    const tag = `${v.toUpperCase()} ${w} ${mode === 'connected' ? 'เชื่อมหลังบ้าน' : 'ไม่เชื่อม'}`;
    const q = await p.evaluate(() => document.querySelector('#quickRoot .jc-total .jc-num')?.textContent || '');
    ok(`${tag}: ประเมินราคาทันที ฿4,500`, /4,500/.test(q), q);
    const beta = await p.evaluate(() => document.querySelector('.sx-beta, [class*="beta"]')?.textContent || '');
    ok(`${tag}: แถบ Beta บอกสถานะการเชื่อมตามจริง`, mode === 'connected' ? /ส่งถึงทีมโดยตรง/.test(beta) : /ยังไม่ส่งคำขอถึงทีม/.test(beta), beta.replace(/\s+/g, ' ').slice(0, 90));
    // quick quote → basket → formal quote request
    await p.evaluate(() => document.querySelector('#quickRoot .jc-add').click()); await p.waitForTimeout(800);
    await p.evaluate(() => { const set = (id, x) => { const el = document.getElementById(id); el.value = x; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('s-q-name', 'ทดสอบ ระบบ'); set('s-q-tel', '0812345678'); const c = document.getElementById('s-q-consent'); if (c && !c.checked) c.click();
      document.querySelector('.s-cart form').requestSubmit(); });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => { const c = document.querySelector('.s-cart'); return { id: c.querySelector('.s-tk-id b')?.textContent || '', hand: !!c.querySelector('.s-hand'), claim: /เข้าระบบของบริษัทแล้ว/.test(c.innerText) }; });
    if (mode === 'connected') {
      const t = sent.find(x => x.action === 'create')?.ticket || {};
      ok(`${tag}: ส่งใบเสนอราคา → เลขที่คำขอจากหลังบ้านขึ้นบนหน้า`, r.id === 'SBP-691009-007' && r.claim, r.id);
      ok(`${tag}: ticket ระบุแบบที่ส่งมา + ราคาที่ลูกค้าเห็น ไม่มีอัตราภายใน`, new RegExp(`แบบ ${v.toUpperCase()}`).test(t.source || '') && t.kind === 'quote' && !/"sp"|"pj"|cost|margin/i.test(JSON.stringify(t)), (t.source || '').slice(0, 40));
    } else ok(`${tag}: ไม่เชื่อม → สรุปให้ส่งเอง ไม่อ้างว่าส่งแล้ว`, r.hand && !r.claim && !sent.length);
    ok(`${tag}: ไม่มี error · ไม่เลื่อนแนวนอน`, !errs.length && await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
}
await b.close();
const fail = out.filter(x => !x.pass).length;
console.log('RESULT ' + JSON.stringify({ test: 'release-check', dir, pass: out.length - fail, total: out.length, fails: out.filter(x => !x.pass).map(x => x.name) }));
process.exit(fail ? 1 : 0);

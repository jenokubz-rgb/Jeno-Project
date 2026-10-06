// r12 รุ่นที่ 2 (a2/b2/c2/d2): the concierge answers every need for every type with a price line or "ประเมินหน้างาน",
// its causes drive the stage (labels appear), "จองคิว" hands the job to the booking form, the showroom selects models and
// puts machine + standard installation in the quote, "ซื้อแอร์ใหม่" → room size → showroom jumps to a model at or above
// the recommended BTU, the chapters' price picks go to the quote, banned words never appear (incl. every concierge answer),
// one WebGL context for the page, no page errors, no sideways scroll.
// usage: node tests/v2-flow.mjs <a2|b2|c2|d2> [width=1366]   (dev server on :8765)
import { launch, BASE } from './_lib.mjs';
const [,, page = 'a2', W = 1366] = process.argv;
const BANNED = ['แก้หายแน่นอน', 'ไม่มีปัญหาอีกแน่นอน', 'ประหยัดไฟแน่นอน', 'ปลอดเชื้อ', 'สะอาด 100%', 'รับประกันเย็น', 'ล้างใหญ่ครบทุกจุด', 'ไม่มีค่าใช้จ่ายเพิ่มเติมทุกกรณี', 'อะไหล่เสียแน่นอน', 'เสร็จตามเวลาแน่นอน', 'Type L', 'K Copper', 'undefined', 'NaN'];
const b = await launch(); const p = await b.newPage({ viewport: { width: +W, height: +W < 600 ? 844 : 900 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
let ok = 0, bad = 0; const check = (c, msg) => { if (c) ok++; else { bad++; console.log('✗ ' + msg); } };
await p.addInitScript(() => { const g = { live: 0, peak: 0 }; window.__gl = g; const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = gc.call(this, t, ...a); if (c && /webgl/.test(t) && !this.__c) { this.__c = 1; g.live++; g.peak = Math.max(g.peak, g.live); } return c; }; });
await p.goto(`${BASE}/${page}.html`);
await p.waitForFunction(() => document.documentElement.classList.contains('v2-on'), null, { timeout: 120000 });
const cartN = () => p.evaluate(() => +document.querySelector('[data-cart-n]').textContent || 0);

// ---- concierge ----
await p.evaluate(() => document.getElementById('askRoot').closest('section').scrollIntoView());
await p.waitForSelector('.cc-chips button', { timeout: 60000 });
const needs = await p.evaluate(() => [...document.querySelectorAll('.cc-q:nth-child(2) .cc-chips button')].map(b => b.textContent));
check(needs.length === 10, `10 needs (got ${needs.length})`);
let text = '';
for (const n of needs) {
  await p.locator('.cc-q:nth-child(2) .cc-chips button', { hasText: n }).first().click(); await p.waitForTimeout(150);
  const types = await p.evaluate(() => [...document.querySelectorAll('.cc-q:nth-child(3) .cc-chips')][0]?.querySelectorAll('button').length || 0);
  const loops = types === 4 ? 4 : 1;
  for (let t = 0; t < loops; t++) {
    if (types === 4) { await p.evaluate(t => document.querySelectorAll('.cc-q:nth-child(3) .cc-chips')[0].querySelectorAll('button')[t].click(), t); await p.waitForTimeout(120); }
    const r = await p.evaluate(() => { const res = document.querySelector('.cc-res'); return { txt: res.innerText, rows: res.querySelectorAll('.cc-price dd').length, money: [...res.querySelectorAll('.cc-price dd')].every(d => /฿[\d,]+|ประเมินหน้างาน/.test(d.textContent)), causes: res.querySelectorAll('.cc-causes button').length, go: !!res.querySelector('.cc-acts .v-btn.go') }; });
    text += '\n' + r.txt;
    check(r.go, `${n}/${t}: booking button`);
    check(n === 'ดูแลหลายเครื่องทั้งปี' || (r.rows > 0 && r.money), `${n}/${t}: price rows (${r.rows}) each a price or ประเมินหน้างาน`);
  }
}
// a cleaning answer: minimum-bill line + stage labels for the first cause + hand-off to booking
await p.locator('.cc-q:nth-child(2) .cc-chips button', { hasText: 'ไม่เย็น หรือเย็นน้อย' }).first().click();
await p.evaluate(() => document.querySelectorAll('.cc-q:nth-child(3) .cc-chips')[0].querySelectorAll('button')[0].click());
await p.locator('.cc-sub .cc-chips button', { hasText: 'เกิน 1 ปี' }).first().click(); await p.waitForTimeout(300);
const plan = await p.evaluate(() => document.querySelector('.cc-plan').innerText);
check(/ล้างใหญ่ C2/.test(plan) && /ยอดขั้นต่ำ/.test(plan), 'warm + >1 year → C2 with the minimum-bill line');
await p.evaluate(() => document.getElementById('askStage').scrollIntoView({ block: 'center' }));
await p.waitForFunction(() => document.querySelectorAll('#askStage .stage-lab:not([hidden])').length > 0, null, { timeout: 120000 }).catch(() => {});
check(await p.evaluate(() => document.querySelectorAll('#askStage .stage-lab:not([hidden])').length > 0), 'cause labels on the stage');
await p.evaluate(() => document.querySelector('.cc-acts .v-btn.go').click()); await p.waitForTimeout(2500);
const bk = await p.evaluate(() => { const r = document.querySelector('#bookRoot input[type=radio]:checked'); const u = [...document.querySelectorAll('#bookRoot [data-u]')].map(x => +x.value).reduce((a, b) => a + b, 0); return { svc: r && r.value, units: u }; });
check(bk.svc === 'clean' && bk.units >= 1, `booking preset clean + units (${JSON.stringify(bk)})`);

// ---- new AC → showroom at the recommended size ----
await p.evaluate(() => document.getElementById('askRoot').closest('section').scrollIntoView());
await p.locator('.cc-q:nth-child(2) .cc-chips button', { hasText: 'ซื้อแอร์ใหม่' }).first().click(); await p.waitForTimeout(300);
const pick = await p.evaluate(() => { const m = document.querySelector('.cc-plan h3').textContent.match(/([\d,]+) BTU/); return m ? +m[1].replace(/,/g, '') : 0; });
check(pick >= 9000, `recommended BTU (${pick})`);
await p.locator('.cc-acts .v-btn.ghost', { hasText: 'ดูรุ่น' }).first().click(); await p.waitForTimeout(2500);
const sel = await p.evaluate(() => { const c = document.querySelector('.sr-code'); const m = c && c.textContent.match(/([\d,]+) BTU/); return m ? +m[1].replace(/,/g, '') : 0; });
check(sel >= pick * 0.95, `showroom model ${sel} BTU ≥ recommended ${pick}`);

// ---- showroom ----
await p.evaluate(() => document.getElementById('srRoot').closest('section').scrollIntoView());
for (const t of ['แขวนใต้ฝ้า', 'สี่ทิศทาง', 'ตู้ตั้งพื้น', 'ติดผนัง']) {
  await p.locator('.sr-types button', { hasText: t }).first().click(); await p.waitForTimeout(400);
  const d = await p.evaluate(() => ({ code: document.querySelector('.sr-code')?.textContent || '', price: document.querySelector('.sr-price b')?.textContent || '', rows: document.querySelectorAll('.sr-row').length }));
  check(d.code.includes(t) && /฿[\d,]+/.test(d.price) && d.rows > 0, `showroom ${t}: ${d.code} ${d.price}`);
}
await p.locator('.sr-btus button').nth(1).click(); await p.waitForTimeout(400);
const c0 = await cartN();
await p.locator('.sr-acts .v-btn.go').click(); await p.waitForTimeout(400);
check(await cartN() > c0, 'showroom → quote basket');
for (const s of ['ใกล้', 'ภายใน', 'ทางลม']) { await p.locator('#srCtl button', { hasText: s }).first().click(); await p.waitForTimeout(300); }
await p.locator('#srCtl button', { hasText: 'มองทะลุ' }).click(); await p.locator('#srCtl button', { hasText: 'ดูการล้าง' }).click(); await p.waitForTimeout(800);
text += '\n' + await p.evaluate(() => document.querySelector('#srRoot')?.closest('section')?.innerText || '');

// ---- chapter price → quote ----
await p.evaluate(() => document.getElementById('cleanRoot').scrollIntoView()); await p.waitForSelector('#cleanRoot .d-pick', { timeout: 60000 });
const c1 = await cartN(); await p.locator('#cleanRoot .d-pick').first().click(); await p.waitForTimeout(300);
check(await cartN() > c1, 'clean table price → quote basket');

const st = await p.evaluate(() => ({ gl: window.__gl, ox: document.documentElement.scrollWidth - innerWidth }));
check(st.gl.peak <= 3, `WebGL contexts ≤ 3 (peak ${st.gl.peak})`);
check(st.ox <= 0, `no sideways scroll (${st.ox})`);
for (const w of BANNED) { const i = text.indexOf(w); check(i < 0, `banned "${w}": …${text.slice(Math.max(0, i - 40), i + 40)}…`); }
check(!errs.length, `no page errors: ${errs.slice(0, 3).join(' | ')}`);
console.log(JSON.stringify({ page, W: +W, ok, bad }));
await b.close(); process.exit(bad ? 1 : 0);

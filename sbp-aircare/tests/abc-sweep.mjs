// r21 A · B · C deep interaction sweep — presses every main control on every page (view) and checks the result:
// catalog (search · sort · details · add to quote · compare) · price centre (every tab · search · add) · annual contract
// builder · area check (core / extended / out) · booking (validation → full form → honest hand-off) · contact form ·
// site search ('/') · feedback dialog · FAQ · quote basket (VAT · travel · qty · remove) · estimate print layout ·
// close-then-reopen basket · phone menu → page switch · in-page links land somewhere. Page errors anywhere fail the run.
// usage: node tests/abc-sweep.mjs <a|b|c> [width=1366] [light|dark]   → one line per check + "RESULT {json}"; exit 1 on any fail
import { launch, BASE } from './_lib.mjs';
const [pg = 'a', w = '1366', scheme = 'light'] = process.argv.slice(2);
const mob = +w < 600;
const b = await launch();
const ctx = await b.newContext({ viewport: { width: +w, height: mob ? 844 : 900 }, colorScheme: scheme, isMobile: mob, hasTouch: mob });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU stall|context lost/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
const out = []; const ok = (name, pass, info = '') => { out.push({ name, pass: !!pass, info }); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const step = async (name, fn) => { try { await fn(); } catch (e) { ok(name, false, 'threw: ' + String(e.message || e).split('\n')[0].slice(0, 160)); } };
const go = async v => { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(2200); };
// press through the DOM: A scrolls smoothly, a pointer click can land while the page still moves on the slow test machine
const press = (sel, text, root = 'body') => p.evaluate(([sel, text, root]) => { const el = [...document.querySelector(root).querySelectorAll(sel)].find(e => (!text || e.textContent.includes(text)) && e.offsetParent !== null); if (!el) throw new Error(`no ${sel}${text ? ' "' + text + '"' : ''}`); el.click(); }, [sel, text, root]);
const fill = (sel, v) => p.evaluate(([sel, v]) => { const el = document.querySelector(sel); if (!el) throw new Error('no ' + sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
const cartN = () => p.evaluate(() => +(document.querySelector('[data-cart-btn]')?.dataset.n || 0));
const num = s => +String(s || '').replace(/[^\d]/g, '');
const closeCart = () => p.evaluate(() => { const d = document.querySelector('.s-cart'); if (d && !d.hidden) d.querySelector('.s-x')?.click(); });

await p.goto(`${BASE}/${pg}.html`);
await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
await p.waitForTimeout(1500);

// ---------- ซื้อแอร์ ----------
await go('shop');
await step('แคตตาล็อก: ค้นหา "12000"', async () => {
  const before = await p.evaluate(() => document.querySelectorAll('[data-cat-grid] > *').length);
  await fill('[data-cat-search]', '12000'); await p.waitForTimeout(900);
  const r = await p.evaluate(() => ({ n: document.querySelectorAll('[data-cat-grid] > *').length, txt: document.querySelector('[data-cat-grid]')?.innerText.slice(0, 400) || '' }));
  ok('แคตตาล็อก: ค้นหา "12000" ได้ผลลัพธ์', r.n > 0 && /12/.test(r.txt), `${before} → ${r.n} รายการ`);
  // r21: B register view — a column squeezed to 0 px wraps every letter and makes rows hundreds of px tall
  const rows = await p.evaluate(() => { const tr = [...document.querySelectorAll('[data-cat-grid] table tr')]; return tr.length ? { max: Math.max(...tr.map(x => x.getBoundingClientRect().height)), narrow: [...(tr[0]?.cells || [])].filter(td => td.getBoundingClientRect().width < 40).length } : null; });
  if (rows) ok('แคตตาล็อกแบบตาราง: แถวไม่สูงผิดปกติ ไม่มีคอลัมน์ถูกบีบ', rows.max < 160 && !rows.narrow, `แถวสูงสุด ${Math.round(rows.max)} px · คอลัมน์แคบ ${rows.narrow}`);
  await fill('[data-cat-search]', ''); await p.waitForTimeout(600);
});
await step('แคตตาล็อก: เรียงราคาต่ำ–สูง', async () => {
  await p.evaluate(() => { const s = document.querySelector('[data-cat-sort]'); s.value = 'price-asc'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(900);
  const prices = await p.evaluate(() => [...document.querySelectorAll('[data-cat-grid] > *')].slice(0, 6).map(c => { const m = c.innerText.match(/฿\s?([\d,]+)/); return m ? +m[1].replace(/,/g, '') : null; }).filter(x => x != null));
  ok('แคตตาล็อก: เรียงราคาต่ำ–สูงถูก', prices.length >= 2 && prices.every((x, i) => i === 0 || x >= prices[i - 1]), prices.join(' ≤ '));
  await p.evaluate(() => { const s = document.querySelector('[data-cat-sort]'); s.value = 'rec'; s.dispatchEvent(new Event('change', { bubbles: true })); });
});
await step('แคตตาล็อก: รายละเอียดรุ่น → ใส่ใบเสนอราคา', async () => {
  const n0 = await cartN();
  await p.evaluate(() => { const c = document.querySelector('[data-cat-grid] > *'); const bt = [...c.querySelectorAll('button,a')].find(x => /รายละเอียด|ดูรุ่น|เปิด/.test(x.textContent)) || c.querySelector('button.open'); bt.click(); });
  await p.waitForFunction(() => { const d = document.getElementById('drawer'); return d && d.getBoundingClientRect().width > 50 && getComputedStyle(d).visibility !== 'hidden' && (d.classList.contains('open') || d.getAttribute('aria-hidden') === 'false' || !d.hidden); }, null, { timeout: 15000 });
  const d = await p.evaluate(() => { const d = document.getElementById('drawer'); return { price: /฿\s?[\d,]{3,}/.test(d.innerText), add: [...d.querySelectorAll('button')].some(x => /ใส่ใบเสนอราคา/.test(x.textContent)) }; });
  ok('แผงสินค้าเปิด มีราคาและปุ่มใส่ใบเสนอราคา', d.price && d.add);
  await press('button', 'ใส่ใบเสนอราคา', '#drawer'); await p.waitForTimeout(800);
  const n1 = await cartN();
  ok('แผงสินค้า → ตะกร้าเพิ่ม', n1 > n0, `${n0} → ${n1}`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500); await closeCart(); await p.waitForTimeout(300);
});
await step('แคตตาล็อก: เทียบรุ่น', async () => {
  for (const k of [0, 1]) { await p.evaluate(k => { const it = document.querySelectorAll('[data-cat-grid] > *')[k]; const bt = it && [...it.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('เทียบ')); if (!bt) throw new Error('no compare button in item ' + k); bt.click(); }, k); await p.waitForTimeout(500); }
  const cmp = await p.evaluate(() => [...document.querySelectorAll('button')].some(x => /เทียบ\s*\(?\s*2|เทียบ 2 รุ่น|เปรียบเทียบ/.test(x.textContent) && x.offsetParent));
  ok('เลือกเทียบ 2 รุ่นแล้วมีปุ่มเปิดตารางเทียบ', cmp);
});

// ---------- ล้าง ติดตั้ง ซ่อม ----------
await go('service');
await step('ศูนย์ค่าบริการ: ทุกแท็บ', async () => {
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#priceCenter [role=tab]')].filter(b => b.offsetParent).map(b => b.textContent.trim()).filter((t, i, a) => t && a.indexOf(t) === i));
  const res = [];
  for (const t of tabs) { await press('#priceCenter [role=tab]', t); await p.waitForTimeout(500); res.push([t, await p.evaluate(() => document.querySelectorAll('#priceCenter tr, #priceCenter .s-row, #priceCenter li').length)]); }
  ok('ศูนย์ค่าบริการ: ทุกแท็บมีรายการ', tabs.length >= 5 && res.every(([, n]) => n > 0), res.map(([t, n]) => `${t.slice(0, 14)}:${n}`).join(' · '));
  await press('#priceCenter [role=tab]', tabs[0]); await p.waitForTimeout(400);
});
await step('ศูนย์ค่าบริการ: ค้นหา + เพิ่ม', async () => {
  await press('#priceCenter [role=tab]', 'ซ่อม'); await p.waitForTimeout(400);
  await fill('#priceCenter input.s-search', 'ปั๊ม'); await p.waitForTimeout(700);
  const t = await p.evaluate(() => document.querySelector('#priceCenter')?.innerText || '');
  ok('ศูนย์ค่าบริการ: ค้นหา "ปั๊ม" พบรายการ', /ปั๊ม/.test(t.split('\n').slice(3).join(' ')));
  await fill('#priceCenter input.s-search', ''); await p.waitForTimeout(400);
  await press('#priceCenter [role=tab]', 'ล้างแอร์'); await p.waitForTimeout(400);
  const n0 = await cartN(); await press('#priceCenter .s-add-btn'); await p.waitForTimeout(600);
  ok('ศูนย์ค่าบริการ: "+ เพิ่ม" → ตะกร้าเพิ่ม', (await cartN()) > n0);
  await closeCart(); await p.waitForTimeout(300);
});

// ---------- สำหรับองค์กร ----------
await go('business');
await step('ตัวคำนวณสัญญารายปี', async () => {
  await press('[data-b-preset]'); await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({ count: +String(document.querySelector('[data-b-out="count"]')?.textContent || '').replace(/[^\d]/g, ''), low: document.querySelector('[data-b-out="low"]')?.textContent || '' }));
  ok('ตัวคำนวณสัญญา: เลือกชุดตัวอย่างแล้วได้ราคาต่อปี', r.count > 0 && /฿|บาท/.test(r.low), `${r.count} เครื่อง · ${r.low.slice(0, 40)}`);
});
await step('ตารางราคาขั้นบันได + ประมาณการโครงการ', async () => {
  const r = await p.evaluate(() => ({ ladder: document.querySelectorAll('#amcRoot tr').length, proj: document.querySelectorAll('#projRoot button').length }));
  ok('หน้าองค์กร: ตารางขั้นบันไดและงานโครงการแสดง', r.ladder >= 5 && r.proj > 0, `ladder rows ${r.ladder} · project buttons ${r.proj}`);
});

// ---------- ติดต่อเรา ----------
await go('contact');
await step('ตรวจพื้นที่ 3 แบบ', async () => {
  const z = async q => { await fill('[data-z-input]', q); await p.waitForTimeout(900); return p.evaluate(() => { const r = document.querySelector('[data-z-result]'); return r && !r.hidden ? r.innerText.replace(/\s+/g, ' ').slice(0, 120) : ''; }); };
  const a = await z('บางนา'), c = await z('ศรีราชา'), d = await z('เชียงใหม่');
  ok('ตรวจพื้นที่: บางนา = ในพื้นที่ ไม่มีค่าเดินทาง', /ไม่มีค่าเดินทาง|พื้นที่ให้บริการ/.test(a), a.slice(0, 60));
  ok('ตรวจพื้นที่: ศรีราชา = มีค่าเดินทาง', /ค่าเดินทาง|฿/.test(c) && !/ไม่มีค่าเดินทาง/.test(c), c.slice(0, 60));
  ok('ตรวจพื้นที่: เชียงใหม่ = เกินระยะ/ไม่รับรายเครื่อง', /เกิน|ไม่พบ|โครงการ/.test(d), d.slice(0, 60));
});
await step('จองคิว: ตรวจช่องว่างก่อนส่ง', async () => {
  await p.evaluate(() => { const f = document.querySelector('#bookRoot form'); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true })); }); await p.waitForTimeout(700);
  const inv = await p.evaluate(() => document.querySelectorAll('#bookRoot [aria-invalid="true"]').length);
  ok('จองคิว: ส่งฟอร์มว่าง → ชี้ช่องที่ต้องกรอก', inv > 0, `${inv} ช่อง`);
});
await step('จองคิว: กรอกครบ → สรุปให้ส่งเอง (ยังไม่เชื่อมหลังบ้าน)', async () => {
  const d = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  await fill('#bookRoot [id^="bk-date-"]', d);
  await fill('#bookRoot [id^="bk-area-"]', 'บางนา'); await fill('#bookRoot [id^="bk-addr-"]', '99/1 ถนนบางนา-ตราด');
  await fill('#bookRoot [id^="bk-name-"]', 'ทดสอบ ระบบ'); await fill('#bookRoot [id^="bk-tel-"]', '0812345678');
  await p.evaluate(() => { const c = [...document.querySelectorAll('#bookRoot input[type=checkbox]')].find(x => /ยินยอม|consent/i.test(x.closest('label')?.textContent || x.id)); if (c && !c.checked) c.click(); });
  await p.evaluate(() => document.querySelector('#bookRoot form').requestSubmit()); await p.waitForTimeout(2000);
  const r = await p.evaluate(() => { const t = document.querySelector('#bookRoot')?.innerText || ''; return { hand: !!document.querySelector('#bookRoot .s-hand'), sentClaim: /ส่งเข้าระบบแล้ว|ส่งคำขอเรียบร้อย/.test(t), inv: [...document.querySelectorAll('#bookRoot [aria-invalid="true"]')].map(x => x.id) }; });
  ok('จองคิว: แสดงสรุปให้ส่งเอง ไม่อ้างว่าส่งแล้ว', r.hand && !r.sentClaim, r.inv.length ? 'ช่องผิด: ' + r.inv.join(',') : '');
});
await step('ฟอร์มติดต่อ', async () => {
  await p.evaluate(() => { const f = document.getElementById('qform'); f.requestSubmit(); }); await p.waitForTimeout(600);
  const inv = await p.evaluate(() => document.querySelectorAll('#qform [aria-invalid="true"]').length);
  ok('ฟอร์มติดต่อ: ส่งว่าง → ชี้ช่องที่ต้องกรอก', inv > 0, `${inv} ช่อง`);
  await p.evaluate(() => { const f = document.getElementById('qform'); const ins = [...f.querySelectorAll('input')].filter(i => i.offsetParent && i.type !== 'checkbox' && i.name !== 'website');
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    ins.forEach(i => set(i, /tel/.test(i.id + i.type + (i.inputMode || '')) ? '0812345678' : /mail/.test(i.id + i.type) ? 'test@example.com' : /n$|-n$|count|จำนวน/.test(i.id) ? '2' : 'ทดสอบ ระบบ'));
    const c = f.querySelector('input[type=checkbox]'); if (c && !c.checked) c.click(); f.requestSubmit(); });
  await p.waitForTimeout(2000);
  const r = await p.evaluate(() => ({ hand: !!document.querySelector('#quote .s-hand, #qform ~ .s-hand, #quote .s-hand-t'), inv: [...document.querySelectorAll('#qform [aria-invalid="true"]')].map(x => x.id + ':' + x.value) }));
  ok('ฟอร์มติดต่อ: กรอกครบ → สรุปให้ส่งเอง', r.hand, r.inv.join(' '));
});
await step('FAQ', async () => {
  await p.evaluate(() => document.querySelector('#faq summary')?.click()); await p.waitForTimeout(300);
  ok('FAQ: กดคำถามแล้วเปิดคำตอบ', await p.evaluate(() => !!document.querySelector('#faq details[open]')));
});

// ---------- ทั้งเว็บ ----------
await step('ค้นหาทั้งเว็บ', async () => {
  await go('home');
  await p.evaluate(() => document.querySelector('.sx-sbtn')?.click()); await p.waitForTimeout(500);
  const open = await p.evaluate(() => { const d = document.querySelector('.sx-sdlg'); return !!d && !d.hidden && d.getBoundingClientRect().height > 0; });
  await fill('.sx-sdlg .sx-sin', 'ล้าง'); await p.waitForTimeout(700);
  const n = await p.evaluate(() => document.querySelectorAll('.sx-sdlg [role=option], .sx-sdlg li, .sx-sdlg a').length);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const closed = await p.evaluate(() => { const d = document.querySelector('.sx-sdlg'); return !d || d.hidden || d.getBoundingClientRect().height === 0; });
  ok('ค้นหาทั้งเว็บ: เปิด พิมพ์ "ล้าง" ได้ผลลัพธ์ Esc ปิด', open && n > 0 && closed, `open ${open} · ${n} ผลลัพธ์ · closed ${closed}`);
});
await step('ฟอร์มความเห็น', async () => {
  await press('button', 'ให้ความเห็น'); await p.waitForTimeout(500);
  const open = await p.evaluate(() => { const d = document.querySelector('.sx-dlg'); return !!d && !d.hidden && d.getBoundingClientRect().height > 0; });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('ฟอร์มความเห็น: เปิดและปิดด้วย Esc', open && await p.evaluate(() => { const d = document.querySelector('.sx-dlg'); return !d || d.hidden || d.getBoundingClientRect().height === 0; }), `open ${open}`);
});
await step('ตะกร้า: VAT ค่าเดินทาง จำนวน ลบ', async () => {
  await p.evaluate(() => document.querySelector('[data-cart-btn]')?.click()); await p.waitForTimeout(700);
  const tot = () => p.evaluate(() => document.querySelector('.s-sum dd.tot')?.textContent || '');
  const t0 = num(await tot());
  await p.evaluate(() => document.querySelector('label[for="s-tax-invoice"]')?.click()); await p.waitForTimeout(400);
  const vat = await p.evaluate(() => /VAT 7%/.test(document.querySelector('.s-sum')?.innerText || ''));
  ok('ตะกร้า: นิติบุคคล → มีบรรทัด VAT 7%', vat && num(await tot()) > t0);
  await p.evaluate(() => document.querySelector('label[for="s-tax-none"]')?.click()); await p.waitForTimeout(300);
  await fill('#s-cart-zone', 'ศรีราชา'); await p.waitForTimeout(800);
  ok('ตะกร้า: พื้นที่ศรีราชา → มีค่าเดินทาง', await p.evaluate(() => /ค่าเดินทาง/.test(document.querySelector('.s-sum')?.innerText || '')));
  const q0 = num(await tot()); await p.evaluate(() => document.querySelector('.s-stp button[aria-label="เพิ่ม"]')?.click()); await p.waitForTimeout(400);
  ok('ตะกร้า: เพิ่มจำนวน → ยอดเพิ่ม', num(await tot()) > q0, `${q0} → ${num(await tot())}`);
  for (let i = 0; i < 12 && await p.evaluate(() => !!document.querySelector('.s-rm')); i++) { await p.evaluate(() => document.querySelector('.s-rm').click()); await p.waitForTimeout(250); }
  ok('ตะกร้า: ลบทุกรายการ → หน้าว่างพร้อมทางไปต่อ', await p.evaluate(() => !!document.querySelector('.s-cart .s-empty')));
  await closeCart();
});
await step('ตะกร้า: ปิดแล้วเปิดใหม่ทันที', async () => {
  // r21 bug: the close animation's timer hid a basket reopened within 250 ms (also product drawer / phone menu)
  await p.evaluate(() => document.querySelector('[data-cart-btn]')?.click()); await p.waitForTimeout(500);
  await p.evaluate(() => { document.querySelector('.s-cart .s-x').click(); document.querySelector('[data-cart-btn]').click(); }); await p.waitForTimeout(700);
  ok('ตะกร้า: ปิดแล้วเปิดใหม่ทันที → ยังเปิดอยู่', await p.evaluate(() => { const d = document.querySelector('.s-cart'); return !d.hidden && d.classList.contains('open'); }));
  await closeCart(); await p.waitForTimeout(400);
});
await step('ใบประเมินราคา: หน้าพิมพ์', async () => {
  await press('#quickRoot .jc-add'); await p.waitForTimeout(700);
  const pre = await p.evaluate(() => ({ cart: !document.querySelector('.s-cart')?.hidden, cls: document.querySelector('.s-cart')?.className, n: +(document.querySelector('[data-cart-btn]')?.dataset.n || 0), btn: !!document.querySelector('.s-doc-open')?.offsetParent, lines: document.querySelectorAll('.s-cart .s-rm').length, view: location.hash, quick: !!document.querySelector('#quickRoot .jc-add')?.offsetParent }));
  if (!pre.btn) return ok('พิมพ์: เห็นเฉพาะใบประเมินราคา (ไม่มีหัวเว็บ เนื้อหา ปุ่ม)', false, 'ไม่มีปุ่มดูใบประเมิน ' + JSON.stringify(pre));
  await press('.s-doc-open'); await p.waitForTimeout(500);
  await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const vis = el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0; return { doc: vis(document.querySelector('.s-doc')), head: vis(document.querySelector('header')), main: vis(document.querySelector('main')), act: vis(document.querySelector('.s-doc-act')) }; });
  await p.emulateMedia({ media: 'screen' });
  ok('พิมพ์: เห็นเฉพาะใบประเมินราคา (ไม่มีหัวเว็บ เนื้อหา ปุ่ม)', r.doc && !r.head && !r.main && !r.act, JSON.stringify({ ...pre, ...r }));
  await closeCart();
});
if (mob) await step('เมนูมือถือ', async () => {
  await go('home');
  await p.evaluate(() => document.querySelector('.s-mmenu')?.click()); await p.waitForTimeout(500);
  const links = await p.evaluate(() => [...document.querySelectorAll('[role=dialog] a, .s-mpanel a, .mpanel a')].filter(a => a.offsetParent).map(a => a.textContent.trim()).slice(0, 12));
  await p.evaluate(() => { const a = [...document.querySelectorAll('[role=dialog] a, .s-mpanel a, .mpanel a')].find(a => a.offsetParent && /ซื้อแอร์|สินค้า/.test(a.textContent)); a && a.click(); }); await p.waitForTimeout(1500);
  ok('เมนูมือถือ: เปิดแล้วไปหน้าซื้อแอร์ได้', links.length >= 4 && await p.evaluate(() => location.hash === '#shop' || !document.getElementById('catalog')?.closest('[hidden]')), links.slice(0, 6).join(' · '));
});
await step('ลิงก์ในหน้า', async () => {
  // every "#id" link lands somewhere (a section of any view, or a view name) · outside links are https · new tabs carry noopener
  const r = await p.evaluate(() => {
    const views = new Set([...document.querySelectorAll('header nav a[data-v]')].map(a => a.dataset.v));
    const a = [...document.querySelectorAll('a[href]')], dead = [], insecure = [], opener = [];
    for (const x of a) {
      const href = x.getAttribute('href');
      if (/^#./.test(href)) { const id = decodeURIComponent(href.slice(1)); if (!document.getElementById(id) && !views.has(id)) dead.push(href); }
      else if (/^http:/i.test(href)) insecure.push(href);
      if (x.target === '_blank' && !/noopener|noreferrer/.test(x.rel)) opener.push(href);
    }
    return { n: a.length, dead: [...new Set(dead)], insecure: [...new Set(insecure)], opener: [...new Set(opener)] };
  });
  ok('ลิงก์ในหน้า: ทุก #ลิงก์มีปลายทาง', !r.dead.length, `${r.n} ลิงก์${r.dead.length ? ' · ไม่มีปลายทาง ' + r.dead.slice(0, 6).join(' ') : ''}`);
  ok('ลิงก์ภายนอก: https และแท็บใหม่มี noopener', !r.insecure.length && !r.opener.length, [...r.insecure, ...r.opener].slice(0, 4).join(' '));
});
ok('ไม่มี error ใน console ตลอดการไล่กด', errs.length === 0, errs.slice(0, 3).join(' | '));
ok('ไม่เลื่อนแนวนอน', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
const fail = out.filter(x => !x.pass).length;
console.log('RESULT ' + JSON.stringify({ test: 'abc-sweep', page: pg, w: +w, scheme, pass: out.length - fail, total: out.length, fails: out.filter(x => !x.pass).map(x => x.name) }));
await b.close();
process.exit(fail ? 1 : 0);

// ทดสอบหน้าเว็บจริงบนเบราว์เซอร์ (มือถือ 390px) ต่อกับหลังบ้านจริง + Postgres จริง
// ครอบคลุม: ตั้งค่าครั้งแรก · OTP · รหัสชั่วคราว · รหัสกู้คืน · ทุกบทบาท ทุกหน้า ทุกปุ่มหลัก · หน้าใบเสนอราคาลูกค้า
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
const GAS = process.env.BACKEND === 'gas';
const { startStack } = await import(GAS ? './harness-gas.mjs' : './harness.mjs');

const OUT = process.argv[2] || '/tmp/claude-0/ui-out' + (GAS ? '-gas' : '');
fs.mkdirSync(OUT, { recursive: true });
const S = await startStack();
const WEB = new URL('../web/', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
// Apps Script: หน้าเว็บมาจาก doGet() จริง และ google.script.run ส่งไปเรียกฟังก์ชันในตัวจำลอง
const GS_SHIM = `<script>window.google={script:{run:(function mk(ok,fail){return new Proxy({},{get:function(_,k){
  if(k==='withSuccessHandler')return function(f){return mk(f,fail)};if(k==='withFailureHandler')return function(f){return mk(ok,f)};
  return function(){var a=Array.prototype.slice.call(arguments);window.__gs(String(k),JSON.stringify(a)).then(function(r){var v=JSON.parse(r);if(v&&v.__err)(fail||function(){})(new Error(v.__err));else (ok||function(){})(v)},function(e){(fail||function(){})(e)})}}})})(null,null)}};</script>`;
const web = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (GAS && (u.pathname === '/' || u.pathname === '/exec')) {
    const out = S.G.doGet({ parameter: Object.fromEntries(u.searchParams) });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + out.title + '</title>' + GS_SHIM + '</head><body style="margin:0">' + out.getContent().replace(/^<!DOCTYPE html>/i, '') + '</body></html>');
    return;
  }
  if (u.pathname === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(`window.SBP_CONFIG = { api: '${S.url}' };`); return; }
  const f = path.join(WEB, u.pathname === '/' ? 'index.html' : u.pathname.replace(/^\/+/, ''));
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise(r => web.listen(0, '127.0.0.1', r));
const SITE = 'http://127.0.0.1:' + web.address().port;

const issues = [];
let step = '';
const note = (k, m) => issues.push(`[${k}] (${step}) ${m}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
if (GAS) await ctx.exposeFunction('__gs', async (fn, argsJson) => {
  try { return JSON.stringify(await S.call(fn, ...JSON.parse(argsJson))); } catch (e) { return JSON.stringify({ __err: e.message }); }
});
const page = await ctx.newPage();
page.on('pageerror', e => note('pageerror', e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_FAILED|ERR_NAME|net::|Failed to load resource/.test(m.text())) note('console', m.text()); });
page.on('dialog', d => { note('dialog', d.message()); d.dismiss(); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const wait = ms => page.waitForTimeout(ms || 150);
const idle = async () => { for (let k = 0; k < 3; k++) { await wait(100); await page.waitForFunction(() => (typeof busyN === 'undefined' || busyN === 0) && !document.querySelector('.loading'), null, { timeout: 15000 }).catch(() => note('timeout', 'still loading')); } };
const hook = async () => page.evaluate(() => {
  if (window.__hooked) return; window.__hooked = true; window.__errs = [];
  const orig = toast; toast = function (m, e) { if (e) window.__errs.push(String(m)); return orig(m, e); };
});
const flush = async allow => {
  const errs = await page.evaluate(() => { const e = (window.__errs || []).slice(); window.__errs = []; return e; }).catch(() => []);
  errs.forEach(e => { if (!(allow && allow.test(e))) note('toast', e); });
  const box = page.locator('#main > .alert.red').first();
  if (await box.count() && await page.locator('#main [data-act=refresh]').count()) note('render', await box.innerText());
};
const go = async (name, p) => { await page.evaluate(([n, q]) => go(n, q || {}), [name, p]); await idle(); await flush(); };
async function modal(values, opt = {}) {
  const okm = await page.waitForSelector('.modal', { timeout: 5000 }).catch(() => null);
  if (!okm) { note('modal', 'no modal appeared'); return; }
  for (const [k, v] of Object.entries(values || {})) {
    const el = page.locator(`.modal [name="${k}"]`);
    if (!(await el.count())) { note('modal', 'missing field ' + k); continue; }
    const tag = await el.evaluate(e => e.tagName + ':' + e.type);
    if (tag.startsWith('SELECT')) await el.selectOption(v);
    else if (tag.endsWith('checkbox')) { if (v) await el.check(); else await el.uncheck(); }
    else await el.fill(String(v));
  }
  if (opt.cancel) await page.click('.modal [data-x]'); else await page.click('.modal button[type=submit]');
  await idle();
}
const closeModals = () => page.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; });
async function act(sel, values, opt) {
  const el = page.locator(sel).first();
  if (!(await el.count())) { note('missing', sel); return false; }
  await el.scrollIntoViewIfNeeded(); await el.click(); await wait(200);
  if (values !== undefined) await modal(values, opt);
  await idle(); await flush(opt && opt.allow);
  return true;
}
const modalText = async () => (await page.locator('.modal textarea').first().inputValue().catch(() => ''));

// ---------- 1) ตั้งค่าครั้งแรกผ่านหน้าเว็บ
step = 'setup';
await page.goto(SITE + '/');
await page.waitForSelector('#lf input[name=code]', { timeout: 20000 });
await hook();
const code = S.setupCode();
await page.fill('#lf input[name=code]', '11112222'); await page.fill('#lf input[name=phone]', '0810000001');
await page.click('#lf button[type=submit]'); await idle();
const e1 = await page.evaluate(() => window.__errs.splice(0));
if (!e1.some(e => /ไม่ถูกต้อง/.test(e))) note('setup', 'wrong setup code not rejected: ' + e1);
await page.fill('#lf input[name=code]', code);
await page.click('#lf button[type=submit]');
const PIN = {};
async function setPin(pin) {
  await page.waitForSelector('#lf input[name=new_pin]', { timeout: 15000 });
  await page.fill('#lf input[name=new_pin]', '111111'); await page.fill('#lf input[name=new_pin2]', '111111');
  await page.click('#lf button[type=submit]'); await idle();
  const weak = await page.evaluate(() => (window.__errs || []).splice(0));
  if (!weak.some(e => /เดาง่าย/.test(e))) note('pin', 'weak PIN not rejected: ' + weak);
  await page.fill('#lf input[name=new_pin]', pin); await page.fill('#lf input[name=new_pin2]', pin);
  await page.click('#lf button[type=submit]');
  await page.waitForSelector('nav.bottom', { timeout: 15000 }); await idle();
}
await page.screenshot({ path: OUT + '/00-set-pin.png' }).catch(() => {});
await setPin('583920'); PIN['U-CEO'] = '583920';
const onMe = await page.evaluate(() => S.cur && S.cur.name);
if (onMe !== 'me') note('setup', 'CEO not guided to recovery code (on ' + onMe + ')');
await page.screenshot({ path: OUT + '/01-ceo-first-login.png' });
step = 'ceo recovery code';
await act('[data-act=makeRecovery]');
const rcText = await modalText();
const RC = (/รหัสกู้คืน: (\d{5}-\d{5})/.exec(rcText) || [])[1];
if (!RC) note('recovery', 'no code shown: ' + rcText);
await closeModals(); await flush();
const ceoToken = await page.evaluate(() => S.token);

// ---------- 2) CEO: ใส่เบอร์ให้ทีม (1 คนผ่านหน้าเว็บ ที่เหลือผ่าน API)
const PH = { 'U-CEO': '0810000001' };
step = 'ceo users screen'; await go('users');
await page.screenshot({ path: OUT + '/02-users.png', fullPage: true });
await page.locator('.card:has([data-u*="U-SALES1"]) [data-act=userEdit]').click(); await modal({ phone: '081-000-0003' });
PH['U-SALES1'] = '0810000003';
const ul = await S.call('api', ceoToken, 'users.list', {});
let n = 4;
for (const u of ul.data) {
  if (PH[u.user_id]) continue;
  PH[u.user_id] = '08100000' + String(n++).padStart(2, '0');
  const r = await S.call('api', ceoToken, 'users.save', { user_id: u.user_id, name: u.name, role: u.role, team: u.team, phone: PH[u.user_id], target: u.target });
  if (!r.ok) note('users.save', r.error);
}
step = 'ceo issue temp code via UI'; await go('users');
await page.locator('.card:has([data-id="U-T3"][data-act=userCode])').locator('[data-act=userCode]').click(); await idle();
const tcText = await modalText();
const TC = (/รหัสเข้าใช้ครั้งแรก: (\d{6})/.exec(tcText) || [])[1];
if (!TC || tcText.indexOf(PH['U-T3']) < 0) note('tempcode', 'temp code modal wrong: ' + tcText);
await closeModals();

// ---------- 3) helper เข้าระบบด้วยรหัสชั่วคราว (ผ่านหน้าเว็บจริง)
async function loginWith(phone, codeStr) {
  await page.evaluate(() => { try { document.getElementById('modal-root').innerHTML = ''; logout(false); } catch (e) {} });
  await page.waitForSelector('#lf input[name=phone]', { timeout: 15000 });
  await page.fill('#lf input[name=phone]', phone);
  const have = page.locator('#havecode');
  if (await have.count()) await have.click(); else await page.click('#lf button[type=submit]');
  await page.waitForSelector('#lf input[name=code]', { timeout: 10000 });
  await page.fill('#lf input[name=code]', codeStr);
  await page.click('#lf button[type=submit]');
  await hook();
  const pin = String(700000 + Number(phone.slice(-2)) * 731);
  await setPin(pin);
  await idle(); await flush();
  return pin;
}
async function loginPin(phone, pin) {
  await page.evaluate(() => { try { document.getElementById('modal-root').innerHTML = ''; logout(false); } catch (e) {} });
  await page.waitForSelector('#lf input[name=pin]', { timeout: 15000 });
  await page.fill('#lf input[name=phone]', phone); await page.fill('#lf input[name=pin]', pin);
  await page.click('#lf button[type=submit]');
  await page.waitForSelector('nav.bottom', { timeout: 15000 });
  await idle(); await hook(); await flush();
}
async function login(id) {
  step = 'login ' + id;
  if (PIN[id]) { await loginPin(PH[id], PIN[id]); return; }
  const r = await S.call('api', ceoToken, 'users.tempCode', { user_id: id });
  if (!r.ok) { note('tempcode', r.error); return; }
  PIN[id] = await loginWith(PH[id], r.data.code);
}
step = 'tech login with UI-issued temp code'; PIN['U-T3'] = await loginWith(PH['U-T3'], TC);
step = 'tech login with phone + PIN'; await loginPin(PH['U-T3'], PIN['U-T3']);
await page.screenshot({ path: OUT + '/02b-login.png' }).catch(() => {});

// ---------- 4) OTP ทาง SMS ผ่านหน้าเว็บ
step = 'otp via sms';
await page.evaluate(() => { logout(false); });
await page.waitForSelector('#lf input[name=phone]');
await page.fill('#lf input[name=phone]', PH['U-T1']);
await page.click('#smscode'); await idle();
await page.waitForSelector('#lf input[name=code]', { timeout: 10000 });
const sms = S.smsBox()[S.smsBox().length - 1];
if (!sms || sms.to !== PH['U-T1']) note('otp', 'no SMS to tech lead');
const ref = await page.locator('#lf').innerText();
const otp = /: (\d{6}) \(Ref (\w+)\)/.exec(sms.text);
if (!otp || ref.indexOf(otp[2]) < 0) note('otp', 'ref not shown on page');
await page.fill('#lf input[name=code]', '000000'); await page.click('#lf button[type=submit]'); await idle();
const e2 = await page.evaluate(() => window.__errs.splice(0));
if (!e2.some(e => /ไม่ถูกต้อง/.test(e))) note('otp', 'wrong OTP not rejected');
await page.fill('#lf input[name=code]', otp[1]); await page.click('#lf button[type=submit]');
PIN['U-T1'] = '864213'; await setPin(PIN['U-T1']); await flush();
await page.screenshot({ path: OUT + '/03-tech-home.png' });

// ---------- 5) เตรียมงานจริงผ่าน API ให้ทุกหน้ามีข้อมูล
step = 'prepare data';
const T = {};
for (const id of ['U-MGR', 'U-SALES1', 'U-BO', 'U-T1', 'U-T2']) {
  if (PIN[id]) { T[id] = (await S.call('pinLogin', PH[id], PIN[id])).data.token; continue; }
  const r = await S.call('api', ceoToken, 'users.tempCode', { user_id: id });
  const v = await S.call('otpVerify', PH[id], r.data.code);
  PIN[id] = String(700000 + Number(PH[id].slice(-2)) * 731);
  T[id] = (await S.call('api', v.data.token, 'me.pin', { new_pin: PIN[id] })).data.token;
}
const A = async (u, a, p) => { const r = await S.call('api', T[u] || ceoToken, a, p || {}); if (!r.ok) throw new Error(a + ': ' + r.error); return r.data; };
const today = S.core._t.today();
const lead = await A('U-SALES1', 'leads.save', { cust_id: 'C0002', cust_name: 'ลูกค้าทดสอบ', site: 'ตึก A', contact: 'คุณบี', phone: '0899990000', job_type: 'ล้าง', units: 10, answers: { type: 'ติดผนัง', qty: '10 เครื่อง', access: 'ชั้น 2', symptom: 'ล้างประจำปี' } });
await A('U-SALES1', 'leads.stage', { lead_id: lead.lead_id, stage: 'QUOTE' });
const q = await A('U-BO', 'quotes.save', { lead_id: lead.lead_id, payment: 'เครดิต 30 วัน', price_level: 'std', lines: [{ item_id: 'CL-0001', qty: 10 }] });
await A('U-BO', 'quotes.submit', { quote_id: q.quote_id });
await A('U-MGR', 'quotes.approve', { quote_id: q.quote_id });
const qd = await A('U-SALES1', 'quotes.get', { quote_id: q.quote_id });
const won = await A('U-SALES1', 'quotes.won', { quote_id: q.quote_id, po: 'PO-UI-1' });
await A('U-MGR', 'plan.assign', { job_id: won.job_id, team: 'ทีม 1', date: today, time: '09:00', seq: 1 });
const q2 = await A('U-BO', 'quotes.save', { cust_id: 'C0003', job_type: 'ซ่อม', payment: 'เงินสด', price_level: 'std', lines: [{ item_id: 'CL-0003', qty: 3 }] });
await A('U-BO', 'quotes.submit', { quote_id: q2.quote_id, reason: 'ทดสอบ' });
const won2q = await A('U-BO', 'quotes.save', { cust_id: 'C0004', job_type: 'ล้าง', payment: 'เงินสด', price_level: 'std', lines: [{ item_id: 'CL-0001', qty: 3 }] });
await A('U-BO', 'quotes.submit', { quote_id: won2q.quote_id, reason: 'ทดสอบ' });
await A('U-MGR', 'quotes.approve', { quote_id: won2q.quote_id });
const won2 = await A('U-BO', 'quotes.won', { quote_id: won2q.quote_id });
await A('U-MGR', 'plan.assign', { job_id: won2.job_id, team: 'ทีม 2', date: today, time: '13:00', seq: 1 });
await A('U-SALES1', 'contracts.save', { cust_id: 'C0001', start_date: today, end_date: S.core._t.addDays(today, 364), value: 36000, units: 12, visits: 3, bill_cycle: 'ต่อรอบ' });
await A('U-SALES1', 'cases.open', { cust_id: 'C0006', symptom: 'น้ำหยดหลังล้าง' });

// ---------- 6) ลูกค้าเปิดลิงก์ใบเสนอราคา
step = 'customer quote page';
const cpage = await ctx.newPage();
cpage.on('pageerror', e => note('pageerror', e.message));
if (!S.linkRe.test(qd.link)) note('quote link', 'unexpected link ' + qd.link);
const link = SITE + '/?quote=' + qd.link.split('quote=')[1];
await cpage.goto(link + '&openExternalBrowser=1');
await cpage.waitForSelector('main', { timeout: 15000 });
await cpage.waitForTimeout(800);
const ctext = await cpage.locator('main').innerText();
if (!/ใบเสนอราคา/.test(ctext) || /cost|ต้นทุน|กำไร/.test(ctext)) note('quote page', 'bad content');
await cpage.screenshot({ path: OUT + '/04-customer-quote.png', fullPage: true });
await cpage.close();

// ---------- 7) ทุกบทบาท ทุกหน้า
const ROLES = ['U-CEO', 'U-MGR', 'U-SALES1', 'U-BO', 'U-T1', 'U-T3'];
for (const u of ROLES) {
  await login(u);
  const role = await page.evaluate(() => S.user.role);
  const screens = await page.evaluate(() => Array.from(new Set((NAV[S.user.role] || []).map(n => n[0]).concat(MORE.filter(m => m[3].indexOf(S.user.role) >= 0).map(m => m[0])))));
  for (const s of screens) { step = role + ' screen ' + s; await go(s); }
  for (const s of ['leads', 'quotes', 'jobsAll', 'billing', 'cases']) {
    if (screens.indexOf(s) < 0) continue;
    await go(s); const nchip = await page.locator('.chip').count();
    for (let i = 0; i < nchip; i++) { step = role + ' ' + s + ' chip ' + i; await page.locator('.chip').nth(i).click(); await idle(); await flush(); }
  }
  for (const [s, kind] of [['leads', 'lead'], ['quotes', 'quote'], ['customers', 'customer'], ['jobsAll', 'job'], ['contracts', 'contractEdit'], ['cases', 'case'], ['myjobs', 'job']]) {
    if (screens.indexOf(s) < 0) continue;
    step = role + ' open ' + kind;
    await go(s, ['quotes', 'leads', 'jobsAll'].includes(s) ? { f: 'all' } : s === 'cases' ? { all: 1 } : {});
    const c = page.locator(`[data-go="${kind}"]`).first();
    if (await c.count()) { await c.click(); await idle(); await flush(); }
  }
  for (const s of ['leads', 'customers', 'quotes', 'jobsAll']) {
    if (screens.indexOf(s) < 0) continue;
    step = role + ' search ' + s; await go(s);
    const f = page.locator('form[data-form=search] input[name=q]');
    if (await f.count()) { await f.fill('ลูกค้า'); await f.press('Enter'); await idle(); await flush(); }
  }
  if (u === 'U-CEO') await page.screenshot({ path: OUT + '/05-ceo-dashboard.png', fullPage: true });
}

// ---------- 8) งานหน้างาน: ช่างทีม 1 ปิดงานด้วยรูป + ลายเซ็นผ่านหน้าเว็บ
step = 'manager release plan'; await login('U-MGR'); await go('plan', {});
await act('[data-act=planRelease]'); await closeModals();
step = 'tech close job'; await login('U-T1'); await go('myjobs');
await page.locator('.card[data-go=job]').first().click(); await idle(); await flush();
if (await page.locator('[data-act=jobStart]').count()) await act('[data-act=jobStart]');
const img = OUT + '/sample.png';
await page.screenshot({ path: img });
for (const kind of ['before', 'after']) {
  const inp = page.locator(`input[data-upload=${kind}]`);
  if (await inp.count()) { await inp.setInputFiles(img); await wait(2500); await idle(); await flush(); } else note('upload', 'no input for ' + kind);
}
if (!(await page.locator('.ph[data-pid]').count())) note('photo', 'photos not shown after upload');
await page.evaluate(() => document.querySelectorAll('input[type=checkbox][data-ci]').forEach(c => { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }));
await act('[data-act=jobSave]');
await act('[data-act=jobClose]', undefined, { allow: /ลายเซ็น/ });
if (await page.locator('.modal').count()) await modal({ r: 'ลูกค้าไม่อยู่' });
await idle(); await flush();
await page.screenshot({ path: OUT + '/06-job-closed.png', fullPage: true });

// ---------- 9) หลังบ้าน: วางบิล
step = 'bo billing'; await login('U-BO'); await go('billing');
if (await page.locator('[data-sel]').count()) { await page.locator('[data-sel]').first().check(); await act('[data-act=billSend]', {}); await closeModals(); }
await go('billing', { tab: 'SENT' });
if (await page.locator('[data-act=billBilled]').count()) await act('[data-act=billBilled]', { bill_no: 'INV-UI-1' });

// ---------- 10) บัญชีของฉัน: ออกจากระบบทุกเครื่อง + รหัสกู้คืนของ CEO
step = 'sales logoutAll'; await login('U-SALES1'); await go('me');
await act('[data-act=logoutAll]', {});
await go('home');
step = 'ceo recovery login';
await page.evaluate(() => { logout(false); });
await page.waitForSelector('#rcv'); await page.click('#rcv');
await page.waitForSelector('#lf input[name=code]');
await page.fill('#lf input[name=phone]', PH['U-CEO']); await page.fill('#lf input[name=code]', RC);
await page.click('#lf button[type=submit]');
await page.waitForSelector('nav.bottom', { timeout: 15000 }); await idle(); await hook(); await flush();
if ((await page.evaluate(() => S.cur && S.cur.name)) !== 'me') note('recovery', 'not guided to create new recovery code');
step = 'ceo settings'; await go('settings'); await page.fill('[name=company_phone]', '02-000-0000'); await act('form[data-form=settings] button[type=submit]');
step = 'reload keeps session'; await page.reload(); await page.waitForSelector('nav.bottom', { timeout: 15000 }).catch(() => note('reload', 'logged out after reload'));

// ---------- 11) ตรวจข้อมูลในฐานข้อมูล
step = 'data checks';
const rows = t => S.rows(t);
const J = await rows('Jobs'), U = await rows('Users'), Sx = await rows('Settings'), L = await rows('Log');
const facts = {
  jobDone: J.some(j => j.job_id === won.job_id && j.status === 'DONE'),
  billed: J.some(j => j.bill_no === 'INV-UI-1'),
  photos: J.some(j => j.job_id === won.job_id && String(j.photos_after).length > 4),
  salesPhone: U.some(u => u.user_id === 'U-SALES1' && u.phone === '0810000003'),
  companyPhone: Sx.some(s => s.key === 'company_phone' && s.value === '02-000-0000'),
  loginLogs: L.filter(l => l.action === 'login').length >= 8,
  recoveryUsed: L.some(l => l.action === 'login' && l.ref === 'รหัสกู้คืน')
};
Object.keys(facts).forEach(k => { if (!facts[k]) note('not-done', k); });
console.log('data checks:', JSON.stringify(facts));
fs.writeFileSync(OUT + '/ui-issues.txt', issues.join('\n'));
console.log(issues.length ? issues.join('\n') : 'NO ISSUES');
console.log('\nissues:', issues.length);
await browser.close(); web.close(); await S.stop();
process.exit(issues.length ? 1 : 0);

// ตรวจเฉพาะ Apps Script: การย้ายจาก v1, ตัวโหลด, เวอร์ชันไฟล์, แคช, doGet
import { startStack } from './harness-gas.mjs';
const S = await startStack();
const G = S.G;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', m); } };
const props = () => G.PropertiesService.getScriptProperties();
const ss = G.SpreadsheetApp.getActiveSpreadsheet();
ok(S.pinTab, 'v1 had PIN_เริ่มต้น tab before upgrade');
ok(!ss.getSheetByName('PIN_เริ่มต้น'), 'upgrade removed PIN_เริ่มต้น tab');
ok(/รหัสตั้งค่าครั้งแรก: \d{8}/.test(S.setupMsg), 'setup shows first-time code in log');
const code1 = S.setupCode();
G.setup();
ok(S.setupCode() === code1, 're-running setup keeps the same setup code');
ok(ss.getSheetByName('Otps') && ss.getSheetByName('Users').getRange(1, 1, 1, 13).getValues()[0].includes('session_ver'), 'new sheet + columns added');
const users = await S.rows('Users');
ok(users.every(u => u.pin_hash === '' && u.must_change === 'Y'), 'old v1 PINs cleared, everyone sets new PIN');
ok(users.every(u => u.phone === '' || /^0/.test(String(u.phone))), 'phones stay text');
ok((await S.rows('Customers')).length === 59, 'duplicates merged once');
G.setup();
ok((await S.rows('Customers')).length === 59, 'setup is idempotent (no double merge)');
ok(!(await S.rows('Settings')).find(s => s.key === 'web_url').value, 'web_url empty before first visit');
// doGet
const page = G.doGet({ parameter: {} });
ok(page.title === 'SBP FieldOps' && page.getContent().indexOf('"mode":"app"') > 0 && page.getContent().indexOf('__SBP_BOOT__') < 0, 'doGet serves app with boot data');
ok((await S.rows('Settings')).find(s => s.key === 'web_url').value === 'https://script.google.com/macros/s/AKfyTEST/exec', 'first visit remembers /exec link for customer quotes');
const qp = G.doGet({ parameter: { quote: 'a'.repeat(64) } });
ok(qp.title === 'ใบเสนอราคา' && qp.getContent().indexOf('"mode":"quote"') > 0, 'doGet quote mode');
const bad = G.doGet({ parameter: { quote: '<script>' } });
ok(bad.getContent().indexOf('"mode":"app"') > 0 && bad.getContent().indexOf('<script>"') < 0, 'bad quote param ignored');
// ตัวโหลด: ดึงจาก GitHub เก็บใน Drive, ตั้งเวลาอัปเดต, ใช้ไฟล์ล่าสุด
const sysFolder = props().getProperty('SYS_FOLDER');
const sysFiles = () => Object.values(G.__GAS.STORE.files).filter(f => f.parent === sysFolder && !f.trashed).map(f => f.name).sort();
ok(sysFiles().length === 2 && sysFiles().every(n => /^sbp-(server|ui)-\d{8}-\d{4}\./.test(n)), 'system files pulled into Drive: ' + sysFiles());
ok(G.__triggers.filter(h => h === 'sbpAutoUpdate').length === 1, 'auto-update trigger installed once');
G.setup();
ok(G.__triggers.filter(h => h === 'sbpAutoUpdate').length === 1 && sysFiles().length === 2, 're-running setup: no duplicate trigger or files');
const before = G.sbp_().version;
const st = await S.call('publicStatus');
ok(st.ok && st.data.initialized === false && st.data.login === 'pin', 'publicStatus works through loader');
// GitHub ล่ม → ระบบยังทำงานจากสำเนาใน Drive
G.__repoDown = true; G.sbpAutoUpdate(); G.__GAS.STORE.cache = {}; G.SBP_INSTANCE_ = null;
ok((await S.call('publicStatus')).ok, 'works from Drive copy while GitHub is down');
G.__repoDown = false;
// เวอร์ชันใหม่บน GitHub → ตัวตั้งเวลาดึงมาใช้เอง
const fsm = await import('node:fs'); const path = await import('node:path'); const os = await import('node:os');
const repo2 = fsm.mkdtempSync(path.join(os.tmpdir(), 'repo2-')) + '/';
const dist = new URL('../dist/gas/', import.meta.url).pathname;
const man = JSON.parse(fsm.readFileSync(dist + 'latest.json', 'utf8'));
const newVer = '29991231-2359';
const srv = fsm.readFileSync(dist + man.files['sbp-server'], 'utf8').replace(/var SBP_SERVER_VERSION = "[^"]+"/, 'var SBP_SERVER_VERSION = "' + newVer + '"');
fsm.writeFileSync(repo2 + 'sbp-server-' + newVer + '.js', srv);
const crypto = await import('node:crypto');
fsm.writeFileSync(repo2 + 'latest.json', JSON.stringify({ version: newVer, files: { 'sbp-server': 'sbp-server-' + newVer + '.js', 'sbp-ui': man.files['sbp-ui'] },
  sha256: { 'sbp-server': crypto.createHash('sha256').update(srv, 'utf8').digest('hex') } }));
fsm.copyFileSync(dist + man.files['sbp-ui'], repo2 + man.files['sbp-ui']);
G.__repoDir = repo2;
G.SBP_INSTANCE_ = null;
G.sbpAutoUpdate();
G.SBP_INSTANCE_ = null;
ok(G.sbp_().version === newVer, 'auto-update pulled and activated new version (was ' + before + ')');
ok((await S.call('publicStatus')).ok, 'new version serves requests');
// ไฟล์เสีย (ค่าตรวจสอบไม่ตรง) → ไม่ใช้
fsm.writeFileSync(repo2 + 'latest.json', JSON.stringify({ version: '30000101-0000', files: { 'sbp-server': 'sbp-server-30000101-0000.js' }, sha256: { 'sbp-server': 'deadbeef' } }));
fsm.writeFileSync(repo2 + 'sbp-server-30000101-0000.js', 'broken');
G.sbpAutoUpdate(); G.SBP_INSTANCE_ = null;
ok(G.sbp_().version === newVer, 'corrupted download rejected, current version kept');
G.__repoDir = dist;
// แคชซอร์สเป็นชิ้น ไม่เกินขนาดแคช
const keys = Object.keys(G.__GAS.STORE.cache).filter(k => /^sbp_src_/.test(k));
ok(keys.length >= 4 && keys.every(k => String(G.__GAS.STORE.cache[k].v).length <= 25000), 'source cached in chunks ≤ 25k chars');
// ไฟล์ระบบหาย → แสดงข้อความไทย ไม่ใช่หน้าว่าง
G.__GAS.STORE.cache = {}; G.SBP_INSTANCE_ = null;
const saved = G.__GAS.STORE.files; G.__GAS.STORE.files = {};
const errPage = G.doGet({ parameter: {} });
ok(/ยังเปิดไม่ได้/.test(errPage.getContent()), 'missing system files → Thai error page');
ok(/ระบบขัดข้อง/.test((await S.call('publicStatus')).error || ''), 'missing system files → friendly API error');
G.__GAS.STORE.files = saved;
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

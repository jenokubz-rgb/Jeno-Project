// จำลอง Google Apps Script ทั้งระบบ: เริ่มจากสภาพจริงของเจ้าของ (ระบบ v1 ติดตั้งแล้ว + Seed) → วางตัวโหลด v2 → setup (ย้ายข้อมูล)
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export async function startStack({ smsOn = true } = {}) {
  require('./gas-mock.cjs');
  require('./gas-mock-ext.cjs');
  const G = globalThis;
  const root = new URL('..', import.meta.url).pathname;
  const run = (file, name) => vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: name });
  G.__GAS_URL = 'https://script.google.com/macros/s/AKfyTEST/exec';

  // 1) สภาพปัจจุบันของเจ้าของ: v1 + Seed.gs + setup แล้ว (มีแท็บ PIN_เริ่มต้น)
  run(root + 'test/fixtures/v1-Seed.gs', 'Seed.gs');
  run(root + 'test/fixtures/v1-Code.gs', 'v1-Code.gs');
  G.setup();
  const pinTab = !!G.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('PIN_เริ่มต้น');

  // 2) ตัวโหลดดึงไฟล์ระบบจาก GitHub (จำลองด้วย dist/gas)
  G.__repoDir = root + 'dist/gas/';
  // 3) วางตัวโหลด (Code.gs ใหม่แทนของเดิม) แล้ว setup
  vm.runInThisContext(fs.readFileSync(root + 'dist/gas/Code.gs', 'utf8'), { filename: 'Code.gs' });
  const logs = [];
  G.Logger = { log: m => logs.push(String(m)) };
  G.setup();
  const setupMsg = logs.join('\n');
  if (smsOn) { const p = G.PropertiesService.getScriptProperties(); p.setProperty('THAIBULKSMS_KEY', 'k'); p.setProperty('THAIBULKSMS_SECRET', 's'); }

  const inst = () => G.sbp_();
  const call = async (fn, ...args) => {
    if (typeof G[fn] !== 'function' || /_$/.test(fn)) throw new Error('not callable: ' + fn);
    const r = G[fn].apply(null, JSON.parse(JSON.stringify(args)));
    return r === undefined ? null : JSON.parse(JSON.stringify(r));
  };
  const strip = r => { const o = {}; for (const k of Object.keys(r)) if (k !== '_row') o[k] = r[k]; return o; };
  const rows = async t => { const DB = inst()._DB; DB.reset(); return DB.all(t).map(strip); };
  const row = async (t, k, v) => (await rows(t)).find(r => String(r[k]) === String(v)) || null;
  return {
    call, rows, row, core: inst()._core, G, setupMsg, pinTab,
    folder: G.PropertiesService.getScriptProperties().getProperty('SYS_FOLDER'),
    setupCode: () => G.PropertiesService.getScriptProperties().getProperty('SETUP_CODE'),
    smsBox: () => G.__smsBox, hasFile: id => !!G.__GAS.STORE.files[id], wipeCache: async () => { G.__GAS.STORE.cache = {}; },
    http: false, linkRe: /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec\?quote=[a-f0-9]{64}$/,
    stop: async () => {}
  };
}

// สร้างไฟล์ระบบสำหรับ Google Apps Script:
//   dist/gas/sbp-server-<ver>.js  (หลังบ้าน: server-gas.js + core.js)
//   dist/gas/sbp-ui-<ver>.html    (หน้าเว็บ: web/index.html แบบ google.script.run)
//   dist/gas/latest.json          (บอกตัวโหลดว่าเวอร์ชันล่าสุดคือไฟล์ไหน + ค่าตรวจสอบ)
//   dist/gas/Code.gs              (ตัวโหลด — เจ้าของวางครั้งเดียว)
// ใช้: node gas/build.mjs
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
import crypto from 'node:crypto';
const d = new Date(Date.now() + 7 * 3600000).toISOString();
const ver = d.slice(0, 10).replace(/-/g, '') + '-' + d.slice(11, 16).replace(':', '');

let core = fs.readFileSync(root + 'supabase/functions/api/core.js', 'utf8');
if (!core.includes('export function makeCore(g)')) throw new Error('core signature');
core = core.replace('export function makeCore(g)', 'function makeCore(g)');
const server = fs.readFileSync(root + 'gas/server-gas.js', 'utf8')
  .replace("'__VERSION__'", JSON.stringify(ver)) + '\n' + core;

let ui = fs.readFileSync(root + 'web/index.html', 'utf8');
const a = ui.indexOf('<script src="config.js"></script>');
const b = ui.indexOf('</script>', ui.indexOf('window.google = { script: { run: runner(null, null) } };')) + '</script>'.length;
if (a < 0 || b < a) throw new Error('shim block not found');
ui = ui.slice(0, a) + '<script>window.__SBP_BOOT = /*__SBP_BOOT__*/null;</script>' + ui.slice(b);
ui = ui.replace(/<link rel="manifest"[^>]*>\n|<link rel="apple-touch-icon"[^>]*>\n|<link rel="icon"[^>]*>\n|<meta name="apple-mobile-web-app-[^>]*>\n/g, '');
if (ui.includes('config.js') || ui.includes('manifest.webmanifest')) throw new Error('leftover static-host refs');

const loader = fs.readFileSync(root + 'gas/Code.gs', 'utf8');
const sha = t => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const files = { 'sbp-server': `sbp-server-${ver}.js`, 'sbp-ui': `sbp-ui-${ver}.html` };
const manifest = { version: ver, files, sha256: { 'sbp-server': sha(server), 'sbp-ui': sha(ui) } };

fs.mkdirSync(root + 'dist/gas', { recursive: true });
for (const f of fs.readdirSync(root + 'dist/gas')) fs.unlinkSync(root + 'dist/gas/' + f);
fs.writeFileSync(root + `dist/gas/sbp-server-${ver}.js`, server);
fs.writeFileSync(root + `dist/gas/sbp-ui-${ver}.html`, ui);
fs.writeFileSync(root + 'dist/gas/Code.gs', loader);
fs.writeFileSync(root + 'dist/gas/latest.json', JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ ver, server: server.length, ui: ui.length, loaderLines: loader.split('\n').length }));
// ค่านโยบายภายใน (จากไฟล์ seed ส่วนตัว ถ้ามีในเครื่อง) ต้องไม่หลุดเข้าไฟล์สาธารณะ
try {
  const seed = (await import(root + 'supabase/functions/api/seed.js')).default;
  for (const [k, v] of Object.entries(seed.settings || {})) if (Number(v) >= 1000 && new RegExp('(^|[^0-9.,])' + v + '([^0-9]|$)').test(server + ui)) throw new Error('internal value leaked: ' + k);
} catch (e) { if (/leaked/.test(e.message)) throw e; }

/**
 * SBP FieldOps v2 — ตัวโหลดระบบ บริษัท สหบูรพากรุ๊ป จำกัด
 * วางไฟล์นี้ครั้งเดียว ไม่ต้องแก้อีก: ระบบดึงเวอร์ชันใหม่จาก GitHub มาเก็บใน Google Drive ของคุณเองทุก 10 นาที
 * ข้อมูลงานทั้งหมดอยู่ใน Google ชีตนี้ · รูปหน้างานอยู่ใน Google Drive · บน GitHub มีแค่ตัวโปรแกรม
 */
var SBP_REPO = 'https://raw.githubusercontent.com/jenokubz-rgb/Jeno-Project/main/sbp-fieldops/';

/** ติดตั้ง/อัปเดต/ตรวจระบบ — เลือก setup แล้วกด ▷ เรียกใช้ (รันซ้ำได้ ไม่ทับข้อมูล) รหัสตั้งค่าครั้งแรกแสดงในบันทึกการดำเนินการ */
function setup() {
  sbpUpdate_(true);
  sbpTrigger_();
  sbpFlush_();
  var msg = sbp_().setup();
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('SBP FieldOps', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* เปิดจาก Apps Script editor */ }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('SBP FieldOps')
      .addItem('ติดตั้ง/อัปเดตระบบ และดูรหัสตั้งค่าครั้งแรก', 'setup')
      .addItem('สร้างงานจากสัญญาที่ถึงรอบ', 'menuGenerateVisits')
      .addToUi();
  } catch (e) { /* ignore */ }
}

function menuGenerateVisits() {
  var ui = SpreadsheetApp.getUi();
  var n = sbp_().generateVisits();
  ui.alert('สร้างงานจากสัญญา ' + n.created + ' งาน');
}

/** ตัวตั้งเวลา: ตรวจเวอร์ชันใหม่ทุก 10 นาที */
function sbpAutoUpdate() {
  try { if (sbpUpdate_(false)) sbpFlush_(); } catch (e) { Logger.log('อัปเดตไม่สำเร็จ: ' + e); }
}

// ---------------------------------------------------------------- หน้าเว็บ + คำสั่งจากหน้าเว็บ
function doGet(e) {
  try {
    return sbp_().doGet(e, sbpFile_('sbp-ui'));
  } catch (err) {
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;max-width:520px;margin:40px auto;padding:0 16px;line-height:1.6">' +
      '<h2>SBP FieldOps ยังเปิดไม่ได้</h2><p>' + String(err && err.message || err).replace(/</g, '&lt;') +
      '</p><p>ผู้ดูแลระบบ: เปิดไฟล์ฐานข้อมูล → เมนู SBP FieldOps → ติดตั้ง/อัปเดตระบบ</p></div>').setTitle('SBP FieldOps');
  }
}
function publicStatus() { return sbpCall_('publicStatus', arguments); }
function setupInit() { return sbpCall_('setupInit', arguments); }
function pinLogin() { return sbpCall_('pinLogin', arguments); }
function otpRequest() { return sbpCall_('otpRequest', arguments); }
function otpVerify() { return sbpCall_('otpVerify', arguments); }
function recoveryLogin() { return sbpCall_('recoveryLogin', arguments); }
function api() { return sbpCall_('api', arguments); }
function publicQuote() { return sbpCall_('publicQuote', arguments); }
function publicAck() { return sbpCall_('publicAck', arguments); }

// ---------------------------------------------------------------- ตัวโหลด (ชื่อลงท้าย _ หน้าเว็บเรียกไม่ได้)
function sbpCall_(fn, args) {
  try { return sbp_().call(fn, Array.prototype.slice.call(args)); }
  catch (err) { return { ok: false, error: 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่ (' + String(err && err.message || err).slice(0, 120) + ')' }; }
}

var SBP_INSTANCE_ = null;
function sbp_() {
  if (SBP_INSTANCE_) return SBP_INSTANCE_;
  SBP_INSTANCE_ = new Function(sbpFile_('sbp-server') + '\n;return sbpCreate();')();
  return SBP_INSTANCE_;
}

function sbpFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SYS_FOLDER');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* สร้างใหม่ */ } }
  var folder = DriveApp.createFolder('SBP FieldOps — ไฟล์ระบบ (ห้ามลบ ห้ามแก้)');
  props.setProperty('SYS_FOLDER', folder.getId());
  return folder;
}

/** ไฟล์ระบบเวอร์ชันล่าสุดในโฟลเดอร์ (ชื่อ prefix-YYYYMMDD-HHMM) */
function sbpLatest_(prefix) {
  var it = sbpFolder_().getFiles(), best = null;
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(prefix + '-') === 0 && !f.isTrashed() && (!best || f.getName() > best.getName())) best = f;
  }
  return best;
}

/** อ่านไฟล์ระบบ — เก็บในแคชเป็นชิ้น (ตรวจไฟล์ใหม่ทุก 5 นาที) */
function sbpFile_(prefix) {
  var cache = CacheService.getScriptCache();
  var id = cache.get('sbp_id_' + prefix);
  if (!id) {
    var best = sbpLatest_(prefix);
    if (!best) throw new Error('ยังไม่มีไฟล์ระบบ — ผู้ดูแลต้องรัน setup');
    id = best.getId();
    cache.put('sbp_id_' + prefix, id, 300);
  }
  var key = 'sbp_src_' + id;
  var n = Number(cache.get(key + '_n') || 0);
  if (n) {
    var keys = []; for (var i = 0; i < n; i++) keys.push(key + '_' + i);
    var parts = cache.getAll(keys), txt = '';
    for (var j = 0; j < n; j++) { if (parts[keys[j]] === undefined) { txt = null; break; } txt += parts[keys[j]]; }
    if (txt) return txt;
  }
  var src = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8');
  var chunks = {}, size = 25000, count = Math.ceil(src.length / size);
  for (var k = 0; k < count; k++) chunks[key + '_' + k] = src.substr(k * size, size);
  try { cache.putAll(chunks, 21600); cache.put(key + '_n', String(count), 21600); } catch (e) { /* แคชเต็ม อ่านจาก Drive */ }
  return src;
}

/** ดึงเวอร์ชันใหม่จาก GitHub มาเก็บใน Drive · คืนค่า true เมื่อมีเวอร์ชันใหม่ */
function sbpUpdate_(force) {
  var props = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(SBP_REPO + 'latest.json?t=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    if (force && !sbpLatest_('sbp-server')) throw new Error('ดาวน์โหลดไฟล์ระบบไม่ได้ (' + res.getResponseCode() + ') ลองรัน setup ใหม่อีกครั้ง');
    return false;
  }
  var m = JSON.parse(res.getContentText());
  if (!force && props.getProperty('SBP_VERSION') === m.version && sbpLatest_('sbp-server')) return false;
  var folder = sbpFolder_(), changed = false;
  Object.keys(m.files).forEach(function (prefix) {
    var name = m.files[prefix], cur = sbpLatest_(prefix);
    if (cur && cur.getName() >= name) return;
    var r = UrlFetchApp.fetch(SBP_REPO + 'dist/' + name, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('ดาวน์โหลด ' + name + ' ไม่ได้ (' + r.getResponseCode() + ')');
    var text = r.getContentText('UTF-8');
    var sum = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
      .map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
    if (m.sha256 && m.sha256[prefix] && m.sha256[prefix] !== sum) throw new Error('ไฟล์ ' + name + ' ไม่ครบ (ตรวจสอบไม่ผ่าน)');
    folder.createFile(name, text, MimeType.PLAIN_TEXT);
    changed = true;
    // เก็บไว้ 3 เวอร์ชันล่าสุด
    var all = [], it = folder.getFiles();
    while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf(prefix + '-') === 0 && !f.isTrashed()) all.push(f); }
    all.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; });
    all.slice(3).forEach(function (f) { f.setTrashed(true); });
  });
  props.setProperty('SBP_VERSION', m.version);
  return changed;
}

function sbpTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sbpAutoUpdate'; });
  if (!has) ScriptApp.newTrigger('sbpAutoUpdate').timeBased().everyMinutes(10).create();
}

function sbpFlush_() {
  CacheService.getScriptCache().removeAll(['sbp_id_sbp-server', 'sbp_id_sbp-ui']);
  SBP_INSTANCE_ = null;
}

/** อ้างถึงบริการที่ระบบใช้ ให้ Google ขออนุญาตครบในครั้งเดียว (ฟังก์ชันนี้ไม่ได้ถูกเรียกใช้) */
function sbpScopes_() {
  SpreadsheetApp.openById('x'); SpreadsheetApp.getActiveSpreadsheet(); DriveApp.getRootFolder(); DriveApp.createFolder('x');
  UrlFetchApp.fetch('https://example.com'); PropertiesService.getScriptProperties(); CacheService.getScriptCache();
  LockService.getScriptLock(); ScriptApp.getService(); HtmlService.createHtmlOutput('');
}

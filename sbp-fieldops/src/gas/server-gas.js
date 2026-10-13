// ============================================================ SBP FieldOps — หลังบ้านบน Google Apps Script
// ไฟล์นี้ถูกโหลดจาก Google Drive โดย Code.gs (ตัวโหลด) — อัปเดตได้โดยไม่ต้องวางโค้ดใหม่
// ข้อมูลอยู่ใน Google ชีตฐานข้อมูล · รูปอยู่ใน Google Drive · ตรรกะธุรกิจอยู่ใน makeCore (ใช้ร่วมกับเวอร์ชัน Supabase)
/* eslint-disable */
var SBP_SERVER_VERSION = '__VERSION__';

function sbpCreate() {
  'use strict';
  var TZ = 'Asia/Bangkok';

  // ---------------------------------------------------------- Google services (ห่อให้ core ใช้)
  var U = {
    DigestAlgorithm: Utilities.DigestAlgorithm, Charset: Utilities.Charset,
    getUuid: function () { return Utilities.getUuid(); },
    formatDate: function (d, tz, f) { return Utilities.formatDate(d, tz, f); },
    computeDigest: function (a, s, c) { return Utilities.computeDigest(a, s, c); },
    computeHmacSha256Signature: function (v, k, c) { return Utilities.computeHmacSha256Signature(v, k, c); },
    base64Decode: function (s) { return Utilities.base64Decode(s); },
    base64Encode: function (b) { return Utilities.base64Encode(b); },
    newBlob: function (b, t, n) { return Utilities.newBlob(b, t, n); },
    randomDigits: function (n) {
      var s = '';
      while (s.length < n) {
        var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + '|' + Math.random() + '|' + Date.now());
        for (var i = 0; i < b.length && s.length < n; i++) { var v = (b[i] + 256) % 256; if (v < 250) s += String(v % 10); }
      }
      return s;
    }
  };
  var noLock = { getScriptLock: function () { return { waitLock: function () {}, tryLock: function () { return true; }, releaseLock: function () {} }; } };
  var props = PropertiesService.getScriptProperties();

  function photoFolder() {
    var id = props.getProperty('FOLDER_ID');
    if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* ถูกลบ → สร้างใหม่ */ } }
    var f = DriveApp.createFolder('SBP FieldOps — รูปหน้างาน');
    props.setProperty('FOLDER_ID', f.getId());
    return f;
  }
  var Drive = {
    createFile: function (blob) { return photoFolder().createFile(blob); },
    getFileById: function (id) { return DriveApp.getFileById(id); }
  };

  // SMS (ThaiBulkSMS) — ใช้เมื่อใส่ THAIBULKSMS_KEY / THAIBULKSMS_SECRET ใน Script Properties
  var SMS = {
    configured: function () { return !!(props.getProperty('THAIBULKSMS_KEY') && props.getProperty('THAIBULKSMS_SECRET')); },
    send: function (to, text) {
      var payload = { msisdn: to, message: text };
      var sender = props.getProperty('THAIBULKSMS_SENDER');
      if (sender) payload.sender = sender;
      var r = UrlFetchApp.fetch('https://api-v2.thaibulksms.com/sms', {
        method: 'post', payload: payload, muteHttpExceptions: true,
        headers: { Authorization: 'Basic ' + Utilities.base64Encode(props.getProperty('THAIBULKSMS_KEY') + ':' + props.getProperty('THAIBULKSMS_SECRET')), Accept: 'application/json' }
      });
      if (r.getResponseCode() >= 300) throw new Error('ส่ง SMS ไม่สำเร็จ (' + r.getResponseCode() + ') กรุณาขอรหัสจากผู้จัดการ');
    }
  };

  function SS() {
    var id = props.getProperty('SHEET_ID');
    var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('ไม่พบ Google ชีตฐานข้อมูล');
    return ss;
  }

  // ---------------------------------------------------------- data layer (Google Sheets)
  var NUM = null; // ตั้งหลังสร้าง core
  var DB = {
    _c: {},
    reset: function () { this._c = {}; },
    sheet: function (name) {
      var sh = SS().getSheetByName(name);
      if (!sh) throw new Error('ไม่พบแท็บ ' + name + ' — เจ้าของระบบต้องกด SBP FieldOps → ติดตั้ง/ตรวจระบบ ในไฟล์ฐานข้อมูล');
      return sh;
    },
    _load: function (name) {
      if (this._c[name]) return this._c[name];
      var sh = this.sheet(name);
      var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
      var hdr = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
      var vals = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
      var rows = [];
      for (var i = 0; i < vals.length; i++) {
        if (vals[i][0] === '' || vals[i][0] === null) continue;
        var o = { _row: i + 2 };
        for (var j = 0; j < hdr.length; j++) {
          var v = vals[i][j];
          if (v instanceof Date) v = (hdr[j].indexOf('_at') > 0 || hdr[j] === 'ts')
            ? Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss") : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
          o[hdr[j]] = v;
        }
        rows.push(o);
      }
      this._c[name] = { hdr: hdr, rows: rows, idx: {} };
      return this._c[name];
    },
    all: function (name) { return this._load(name).rows; },
    find: function (name, key, val) {
      var t = this._load(name);
      if (!t.idx[key]) { t.idx[key] = {}; t.rows.forEach(function (r) { if (t.idx[key][r[key]] === undefined) t.idx[key][r[key]] = r; }); }
      return t.idx[key][val] || null;
    },
    insert: function (name, obj) {
      var sh = this.sheet(name);
      var hdr = this._c[name] ? this._c[name].hdr : sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      if (sh.getLastRow() + 1 >= sh.getMaxRows()) ensureCapacity(sh, hdr, false);
      sh.appendRow(hdr.map(function (h) { var v = obj[h]; return v === undefined || v === null ? '' : v; }));
      delete this._c[name];
    },
    update: function (name, key, val, patch) {
      var t = this._load(name);
      var r = this.find(name, key, val);
      if (!r) throw new Error('ไม่พบ ' + val);
      var sh = this.sheet(name);
      Object.keys(patch).forEach(function (f) {
        var col = t.hdr.indexOf(f);
        if (col < 0) return;
        var v = patch[f] === undefined || patch[f] === null ? '' : patch[f];
        sh.getRange(r._row, col + 1).setValue(v);
        r[f] = v;
      });
    },
    deleteWhere: function (name, pred) {
      var t = this._load(name);
      var sh = this.sheet(name);
      var rows = t.rows.filter(pred).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; });
      rows.forEach(function (rw) { sh.deleteRow(rw); });
      delete this._c[name];
    }
  };

  /** เผื่อแถวว่างและตั้งคอลัมน์ข้อความเป็น Plain text (กันเบอร์โทร/รหัสเสียเลข 0 นำหน้า) */
  function ensureCapacity(sh, hdr, formatAll) {
    var maxRows = sh.getMaxRows(), lastRow = Math.max(sh.getLastRow(), 1);
    var start = formatAll ? 2 : maxRows + 1;
    if (maxRows < lastRow + 1000) sh.insertRowsAfter(maxRows, lastRow + 1000 - maxRows);
    else if (!formatAll) return;
    var count = sh.getMaxRows() - start + 1;
    if (count <= 0) return;
    hdr.forEach(function (h, i) { if (NUM.indexOf(h) < 0) sh.getRange(start, i + 1, count, 1).setNumberFormat('@'); });
  }

  var core = makeCore({ Utilities: U, PropertiesService: PropertiesService, CacheService: CacheService, LockService: noLock,
    DriveApp: Drive, ScriptApp: ScriptApp, Logger: Logger, SMS: SMS, DB: DB });
  var SCHEMA = core._t.SCHEMA;
  NUM = core._t.NUMERIC;

  // ---------------------------------------------------------- ติดตั้ง / ปรับฐานข้อมูลเป็นเวอร์ชัน 2
  var MERGE = [['C0001', 'C0039'], ['C0003', 'C0019'], ['C0006', 'C0007'], ['C0016', 'C0018']];
  function setup() {
    var ss = SS();
    var out = [];
    Object.keys(SCHEMA).forEach(function (name) {
      var sh = ss.getSheetByName(name);
      if (!sh) { sh = ss.insertSheet(name); out.push('สร้างแท็บ ' + name); }
      var hdr = SCHEMA[name];
      var lastCol = Math.max(sh.getLastColumn(), 1);
      var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
      if (existing.join('') === '') { sh.getRange(1, 1, 1, hdr.length).setValues([hdr]); existing = hdr.slice(); }
      else hdr.forEach(function (h) { if (existing.indexOf(h) < 0) { sh.getRange(1, existing.length + 1).setValue(h); existing.push(h); } });
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, existing.length).setFontWeight('bold').setBackground('#1B2A4A').setFontColor('#FFFFFF');
      ensureCapacity(sh, existing, true);
    });
    DB.reset();
    var have = DB.all('Settings').map(function (s) { return s.key; });
    core._t.DEFAULT_SETTINGS.forEach(function (s) { if (have.indexOf(s[0]) < 0) DB.insert('Settings', { key: s[0], value: s[1], note: s[2] }); });
    if (!props.getProperty('PIN_SALT')) props.setProperty('PIN_SALT', Utilities.getUuid());
    if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
    photoFolder();

    // ปรับจากระบบ PIN เดิม (v1) → บัญชีเบอร์มือถือ (v2): ทุกคนตั้ง PIN ใหม่ ลบแท็บ PIN_เริ่มต้น
    if (props.getProperty('SCHEMA_V') !== '2') {
      DB.reset();
      DB.all('Users').forEach(function (u) {
        DB.update('Users', 'user_id', u.user_id, { pin_hash: '', must_change: 'Y', session_ver: Math.max(1, Number(u.session_ver) || 0) + 1, active: u.active === '' ? 'Y' : u.active });
      });
      var pinSheet = ss.getSheetByName('PIN_เริ่มต้น');
      if (pinSheet && ss.getSheets().length > 1) { ss.deleteSheet(pinSheet); out.push('ลบแท็บ PIN_เริ่มต้น (ระบบใหม่ไม่ใช้แล้ว)'); }
      out.push('ปรับบัญชีผู้ใช้เป็นแบบเบอร์มือถือ + PIN');
      // รวมลูกค้าซ้ำ 4 คู่ (เฉพาะที่ยังไม่มีงานผูก)
      DB.reset();
      var used = {};
      ['Leads', 'Quotes', 'Jobs', 'Contracts', 'Cases', 'Assets'].forEach(function (t) { DB.all(t).forEach(function (r) { used[r.cust_id] = true; }); });
      MERGE.forEach(function (m) {
        var a = DB.find('Customers', 'cust_id', m[0]), b = DB.find('Customers', 'cust_id', m[1]);
        if (!a || !b || used[m[1]]) return;
        var patch = {};
        if (String(b.name).length > String(a.name).length) patch.name = b.name;
        if (String(b.address).length > String(a.address).length) patch.address = b.address;
        Object.keys(a).forEach(function (k) { if (k !== '_row' && a[k] === '' && b[k] !== '' && b[k] !== undefined) patch[k] = b[k]; });
        patch.notes = (a.notes ? a.notes + ' · ' : '') + 'รวมรายการซ้ำ ' + m[1] + ' (' + b.name + ') เข้ามาแล้ว';
        DB.update('Customers', 'cust_id', m[0], patch);
        DB.deleteWhere('Customers', function (r) { return r.cust_id === m[1]; });
        DB.reset();
        out.push('รวมลูกค้า ' + m[1] + ' → ' + m[0]);
      });
      props.setProperty('SCHEMA_V', '2');
    }
    // รหัสตั้งค่าครั้งแรก (เจ้าของระบบเท่านั้นที่เห็น — แสดงใน log / กล่องข้อความของชีต)
    var code = '';
    if (!core._t.initialized()) {
      code = props.getProperty('SETUP_CODE');
      if (!code) {
        code = U.randomDigits(8);
        var salt = Utilities.getUuid();
        props.setProperty('SETUP_CODE', code);
        props.setProperty('SETUP_SALT', salt);
        props.setProperty('SETUP_HASH', sha256hex(salt + '|setup|' + code));
      }
    } else {
      props.deleteProperty('SETUP_CODE');
    }
    DB.reset();
    var msg = 'SBP FieldOps v2 (' + SBP_SERVER_VERSION + ') ติดตั้งเรียบร้อย' + (out.length ? '\n- ' + out.join('\n- ') : '') +
      '\nผู้ใช้ ' + DB.all('Users').length + ' · ลูกค้า ' + DB.all('Customers').length + ' · ราคา ' + DB.all('Catalog').length +
      (code ? '\n\nรหัสตั้งค่าครั้งแรก: ' + code + '\nเปิดลิงก์ระบบ → ใส่รหัสนี้ + เบอร์มือถือ CEO → ตั้ง PIN' : '\nระบบตั้งค่าครั้งแรกแล้ว');
    return msg;
  }
  function sha256hex(s) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
      .map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
  }

  // ---------------------------------------------------------- เรียกจากหน้าเว็บ: ทีละคำขอ (กันข้อมูลชน)
  var PUBLIC = ['publicStatus', 'setupInit', 'otpRequest', 'otpVerify', 'pinLogin', 'recoveryLogin', 'api', 'publicQuote', 'publicAck'];
  function call(fn, args) {
    if (PUBLIC.indexOf(fn) < 0) return { ok: false, error: 'ไม่รู้จักคำสั่ง' };
    var lock = LockService.getScriptLock();
    try { lock.waitLock(28000); } catch (e) { return { ok: false, error: 'มีคนบันทึกพร้อมกันหลายคน รอสักครู่แล้วลองใหม่' }; }
    try {
      DB.reset();
      return JSON.parse(JSON.stringify(core[fn].apply(null, Array.prototype.slice.call(args || [])) || null));
    } finally { DB.reset(); lock.releaseLock(); }
  }

  /** จำลิงก์เว็บแอป (/exec) ไว้สร้างลิงก์ใบเสนอราคาให้ลูกค้า — ครั้งแรกที่มีคนเปิดระบบ */
  function rememberUrl() {
    try {
      if (props.getProperty('WEB_URL_SET') === 'Y') return;
      var u = String(ScriptApp.getService().getUrl() || '');
      if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) return;
      var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
      try {
        DB.reset();
        var wu = DB.find('Settings', 'key', 'web_url');
        if (wu && !String(wu.value || '').trim()) DB.update('Settings', 'key', 'web_url', { value: u });
        props.setProperty('WEB_URL_SET', 'Y');
      } finally { DB.reset(); lock.releaseLock(); }
    } catch (e) { /* ไม่สำคัญพอให้หน้าเว็บล้ม */ }
  }

  function doGet(e, uiHtml) {
    rememberUrl();
    var p = (e && e.parameter) || {};
    var quote = /^[a-f0-9]{64}$/.test(String(p.quote || '')) ? String(p.quote) : '';
    var boot = JSON.stringify({ mode: quote ? 'quote' : 'app', quoteToken: quote, app: { name: 'SBP FieldOps', version: SBP_SERVER_VERSION, tz: TZ } }).replace(/</g, '\\u003c');
    var html = String(uiHtml).replace('/*__SBP_BOOT__*/null', boot);
    return HtmlService.createHtmlOutput(html)
      .setTitle(quote ? 'ใบเสนอราคา' : 'SBP FieldOps')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }

  function generateVisits() {
    var lock = LockService.getScriptLock(); lock.waitLock(28000);
    try { DB.reset(); return core._t.generateContractVisits({ user_id: 'SYSTEM', name: 'SYSTEM', role: 'CEO' }, {}); }
    finally { DB.reset(); lock.releaseLock(); }
  }

  return { version: SBP_SERVER_VERSION, call: call, doGet: doGet, setup: setup, generateVisits: generateVisits, _core: core, _DB: DB };
}

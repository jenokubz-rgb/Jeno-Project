// ============================================================ SBP FieldOps — หลังบ้านบน Google Apps Script
// ไฟล์นี้ถูกโหลดจาก Google Drive โดย Code.gs (ตัวโหลด) — อัปเดตได้โดยไม่ต้องวางโค้ดใหม่
// ข้อมูลอยู่ใน Google ชีตฐานข้อมูล · รูปอยู่ใน Google Drive · ตรรกะธุรกิจอยู่ใน makeCore (ใช้ร่วมกับเวอร์ชัน Supabase)
/* eslint-disable */
var SBP_SERVER_VERSION = "20261013-2116";

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

// SBP FieldOps — ตรรกะธุรกิจทั้งหมด (สิทธิ์ ด่านกำไร ใบเสนอราคา งาน วางบิล ประกัน สัญญา)
// ยกมาจากระบบ Google Apps Script เดิม (ทดสอบผ่านแล้ว) ทำงานบนฐานข้อมูล Postgres ผ่าน engine.js
// ฟังก์ชันทั้งหมดเป็นแบบ synchronous — engine โหลดข้อมูลที่ต้องใช้ให้ก่อน แล้วบันทึกทีเดียวตอนจบคำขอ
/* eslint-disable */
function makeCore(g) {
'use strict';
var Utilities = g.Utilities, PropertiesService = g.PropertiesService, CacheService = g.CacheService,
  LockService = g.LockService, DriveApp = g.DriveApp, ScriptApp = g.ScriptApp, Logger = g.Logger,
  SMS = g.SMS, DB = g.DB;

var APP = { name: 'SBP FieldOps', version: '2.0.0', tz: 'Asia/Bangkok' };

var ROLES = {
  CEO: 'CEO', MANAGER: 'ผู้จัดการ', SALES: 'เซลล์หน้าบ้าน', BACKOFFICE: 'เซลล์หลังบ้าน',
  LEAD: 'หัวหน้าทีม', TECH: 'ช่าง'
};

var SCHEMA = {
  Users: ['user_id', 'name', 'role', 'team', 'phone', 'target', 'pin_hash', 'must_change', 'active', 'session_ver', 'recovery_hash', 'last_login', 'created_at'],
  Otps: ['otp_id', 'phone', 'user_id', 'kind', 'ref', 'code_hash', 'expires_ms', 'attempts', 'used', 'created_ms', 'created_by', 'created_at'],
  Customers: ['cust_id', 'name', 'type', 'tax_id', 'branch', 'address', 'zone', 'contact', 'phone', 'line_id',
    'credit_days', 'owner_id', 'notes', 'created_at'],
  Leads: ['lead_id', 'created_at', 'owner_id', 'cust_id', 'cust_name', 'site', 'zone', 'contact', 'phone', 'source',
    'job_type', 'lane', 'units', 'est_value', 'answers', 'photos', 'stage', 'next_action', 'next_date',
    'lost_reason', 'quote_id', 'job_id', 'note', 'updated_at'],
  Catalog: ['item_id', 'category', 'name', 'unit', 'price_std', 'price_special', 'price_project', 'cost',
    'team_day', 'warranty', 'scope', 'exclusions', 'active'],
  Quotes: ['quote_id', 'rev', 'lead_id', 'owner_id', 'cust_id', 'cust_name', 'cust_type', 'site', 'contact', 'phone',
    'job_type', 'created_by', 'created_at', 'payment', 'price_level', 'subtotal', 'discount', 'net', 'vat', 'total',
    'est_cost', 'team_days', 'contrib', 'contrib_td', 'gate_minbill', 'gate_td', 'approval_level', 'status',
    'approver_id', 'approved_at', 'approve_note', 'sent_at', 'valid_until', 'scope_note', 'exclusions',
    'public_token', 'customer_ack', 'customer_ack_at', 'lost_reason', 'job_id', 'updated_at'],
  QuoteLines: ['quote_id', 'line_no', 'item_id', 'description', 'qty', 'unit', 'price', 'amount', 'cost', 'team_day'],
  Jobs: ['job_id', 'quote_id', 'lead_id', 'owner_id', 'cust_id', 'cust_name', 'site', 'contact', 'phone', 'job_type',
    'scope', 'payment', 'amount', 'est_cost', 'team_days', 'status', 'team', 'plan_date', 'plan_time', 'seq',
    'released', 'checklist', 'measures', 'materials', 'extra_found', 'photos_before', 'photos_after', 'signature',
    'signer', 'started_at', 'finished_at', 'tech_note', 'bill_status', 'sent_at', 'bill_no', 'bill_date',
    'due_date', 'paid_date', 'actual_cost', 'contract_id', 'case_id', 'next_service', 'created_at', 'updated_at'],
  Assets: ['asset_id', 'cust_id', 'cust_name', 'site', 'location', 'brand', 'model', 'serial', 'btu', 'ac_type',
    'installed_at', 'warranty_until', 'last_service', 'last_job_id', 'notes', 'created_at'],
  Cases: ['case_id', 'created_at', 'created_by', 'cust_id', 'cust_name', 'job_id', 'asset_id', 'symptom', 'photos',
    'class', 'decision', 'status', 'fix_job_id', 'cost', 'root_cause', 'decided_by', 'closed_at'],
  Contracts: ['contract_id', 'cust_id', 'cust_name', 'name', 'start_date', 'end_date', 'value', 'units', 'visits',
    'interval_months', 'next_visit', 'bill_cycle', 'next_bill', 'owner_id', 'status', 'scope', 'notes', 'created_at'],
  Settings: ['key', 'value', 'note'],
  Log: ['ts', 'user_id', 'action', 'ref', 'detail']
};

var NUMERIC = ['target', 'credit_days', 'units', 'est_value', 'price_std', 'price_special', 'price_project', 'cost',
  'team_day', 'rev', 'subtotal', 'discount', 'net', 'vat', 'total', 'est_cost', 'team_days', 'contrib', 'contrib_td',
  'line_no', 'qty', 'price', 'amount', 'seq', 'actual_cost', 'value', 'visits', 'interval_months'];

// ตัวเลขนโยบายภายใน (ต้นทุน เป้า ด่านราคา) ไม่เก็บในโค้ด — ค่าจริงอยู่ในฐานข้อมูล (หน้า ตั้งค่าระบบ)
var DEFAULT_SETTINGS = [
  ['company_name', 'บริษัท สหบูรพากรุ๊ป จำกัด', 'ชื่อบนใบเสนอราคา'],
  ['company_address', 'พระราม 2 ซอย 31 กรุงเทพมหานคร', 'ที่อยู่บนใบเสนอราคา'],
  ['company_phone', '', 'เบอร์โทรบนใบเสนอราคา'],
  ['company_tax_id', '', 'เลขผู้เสียภาษี'],
  ['vat_rate', 0.07, ''],
  ['fixed_per_td', 0, 'ต้นทุนเต็มต่อทีม-วัน (บาท) — ต่ำกว่านี้ = ขาดทุน'],
  ['target_per_td', 0, 'เป้ากำไรส่วนเกินต่อทีม-วัน (บาท)'],
  ['comm_rate', 0, 'คอมมิชชันประมาณการในการคิดกำไรส่วนเกิน'],
  ['warranty_rate', 0, 'สำรองประกันประมาณการ'],
  ['min_bill_b2c', 0, 'Minimum Bill B2C'],
  ['min_bill_b2b', 0, 'Minimum Bill B2B'],
  ['min_bill_repair', 0, 'Minimum Bill งานซ่อม'],
  ['ceo_threshold', 0, 'ดีลตั้งแต่ยอดนี้ (ก่อน VAT) ต้อง CEO อนุมัติ'],
  ['teams', 2, 'จำนวนทีมช่าง'],
  ['team_names', 'ทีม 1,ทีม 2', 'ชื่อทีม คั่นด้วยจุลภาค'],
  ['workdays', 22, 'วันทำงานต่อเดือน'],
  ['monthly_target', 0, 'เป้ารายได้บริษัทต่อเดือน (ก่อน VAT)'],
  ['quote_valid_days', 30, 'อายุใบเสนอราคา (วัน)'],
  ['wait_send_alert_days', 1, 'งานรอส่งบัญชีเกินกี่วันให้เตือน'],
  ['overdue_hold_days', 15, 'ลูกหนี้เกินกำหนดกี่วันให้งดเครดิตใหม่'],
  ['web_url', '', 'ลิงก์หน้าเว็บระบบ (ใช้สร้างลิงก์ใบเสนอราคาให้ลูกค้า) — ว่างไว้ ระบบใช้ลิงก์ที่เปิดอยู่']
];

var CHECKLISTS = {
  'ล้าง': ['ตรวจอาการก่อนล้าง เปิดเครื่อง บันทึก Error', 'ป้องกันพื้นที่และทรัพย์สินลูกค้า', 'ถอดฟิลเตอร์/ฝาหน้า ตามวิธีที่ขาย (C1/C2)',
    'ล้างคอยล์เย็นและใบพัด', 'ล้างถาดน้ำทิ้ง ทดสอบน้ำไหล', 'ล้างคอยล์ร้อนตามจุดที่เข้าถึงได้', 'ประกอบกลับ ทดสอบการทำงาน',
    'เก็บพื้นที่ให้สะอาด', 'อธิบายผลงานและสิ่งที่พบให้ลูกค้า'],
  'ติดตั้ง': ['ตรวจรุ่น BTU น้ำยา ตรงใบงาน', 'ยืนยันตำแหน่งคอยล์เย็น/คอยล์ร้อนกับลูกค้า', 'เดินท่อน้ำยา หุ้มฉนวน รางครอบท่อ',
    'เดินไฟ เบรกเกอร์ ตามใบงาน', 'ท่อน้ำทิ้งมีความลาดเอียง ทดสอบน้ำ', 'แวคคั่มตามเวลามาตรฐาน', 'ตรวจรอยรั่วทุกจุดต่อ',
    'ทดสอบเดินเครื่อง วัดกระแส/แรงดัน', 'เก็บงาน ทำความสะอาด', 'อธิบายการใช้งานและการรับประกัน'],
  'ซ่อม': ['ยืนยันอาการกับลูกค้า', 'ตรวจและวัดค่า บันทึก Error', 'ระบุสาเหตุพร้อมหลักฐาน', 'แจ้งขอบเขต/ราคา ได้รับอนุมัติก่อนซ่อม',
    'ซ่อมตามที่อนุมัติ', 'ทดสอบหลังซ่อม', 'บันทึกอะไหล่เก่า/ใหม่', 'อธิบายผลและการรับประกัน'],
  'สำรวจ': ['ถ่าย Nameplate ทุกเครื่อง', 'วัดระยะท่อจริง', 'ตรวจไฟและเบรกเกอร์', 'ตรวจทางน้ำทิ้งและโครงสร้างรองรับ',
    'ระบุความเสี่ยง R0–R3 และงานสูง', 'บันทึกสิ่งที่ยังไม่รู้'],
  'สัญญา/PM': ['ตรวจสภาพเครื่องตามทะเบียน', 'ล้าง/บำรุงรักษาตามขอบเขตสัญญา', 'วัดค่าและบันทึก', 'บันทึกข้อบกพร่องที่พบ',
    'อัปเดตทะเบียนเครื่อง', 'นัดรอบถัดไปกับลูกค้า'],
  'งานแก้/ประกัน': ['ตรวจอาการตามเคส', 'ถ่ายรูปหลักฐาน', 'ระบุสาเหตุ', 'แก้ไขตามที่ผู้จัดการอนุมัติ', 'ทดสอบและอธิบายลูกค้า']
};

// ============================================================ entry points: บัญชีผู้ใช้ (เบอร์โทร + OTP)

var OTP_TTL_MS = 5 * 60000;          // OTP ทาง SMS ใช้ได้ 5 นาที
var TEMP_TTL_MS = 12 * 3600000;      // รหัสเข้าใช้ชั่วคราวที่ผู้จัดการออกให้ ใช้ได้ 12 ชั่วโมง
var OTP_GAP_MS = 60000;              // ขอรหัสใหม่ได้ทุก 60 วินาที
var OTP_PER_HOUR = 5;                // ขอได้ไม่เกิน 5 ครั้ง/ชั่วโมง/เบอร์
var FAIL_LIMIT = 5;                  // ใส่รหัสผิดเกิน 5 ครั้ง ล็อก 15 นาที

function initialized() { return PropertiesService.getScriptProperties().getProperty('INIT_DONE') === 'Y'; }

/** สถานะระบบสำหรับหน้าเข้าสู่ระบบ (ไม่ต้องล็อกอิน) */
function publicStatus() {
  try {
    return { ok: true, data: { initialized: initialized(), sms: SMS.configured(), login: 'pin', company: String(setting('company_name') || '') } };
  } catch (err) { return { ok: false, error: errText(err) }; }
}

/** ตั้งค่าครั้งแรก: รหัสตั้งค่า (ใช้ครั้งเดียว) + เบอร์มือถือ CEO → เข้าระบบเป็น CEO ทันที */
function setupInit(code, phone, name) {
  try {
    if (initialized()) return { ok: false, error: 'ระบบตั้งค่าครั้งแรกไปแล้ว ให้เข้าสู่ระบบด้วยเบอร์มือถือ' };
    var cache = CacheService.getScriptCache();
    var fails = num(cache.get('fail_setup'));
    if (fails >= FAIL_LIMIT) return { ok: false, error: 'ใส่รหัสตั้งค่าผิดหลายครั้ง กรุณารอ 15 นาที' };
    var props = PropertiesService.getScriptProperties();
    var want = props.getProperty('SETUP_HASH') || '';
    var got = sha256hex(String(props.getProperty('SETUP_SALT') || '') + '|setup|' + String(code || '').replace(/\D/g, ''));
    if (!want || got !== want) {
      cache.put('fail_setup', String(fails + 1), 900);
      return { ok: false, error: 'รหัสตั้งค่าครั้งแรกไม่ถูกต้อง' };
    }
    phone = normPhone(phone);
    if (!phone) return { ok: false, error: 'กรอกเบอร์มือถือ 10 หลัก เช่น 0812345678' };
    var ceo = DB.all('Users').filter(function (u) { return u.role === 'CEO' && isTrue(u.active); })[0];
    if (!ceo) throw new Error('ไม่พบผู้ใช้ CEO ในข้อมูลตั้งต้น');
    var patch = { phone: phone, last_login: nowIso(), must_change: 'Y', pin_hash: '' };
    if (clean(name, 60)) patch.name = clean(name, 60);
    DB.update('Users', 'user_id', ceo.user_id, patch);
    props.setProperty('INIT_DONE', 'Y');
    props.deleteProperty('SETUP_HASH');
    cache.remove('fail_setup');
    log(ceo.user_id, 'setup.init', maskPhone(phone), '');
    ceo = DB.find('Users', 'user_id', ceo.user_id);
    return { ok: true, data: { token: makeToken(ceo), user: publicUser(ceo), first: true } };
  } catch (err) { return { ok: false, error: errText(err) }; }
}

/** ขอรหัส OTP ทาง SMS */
function otpRequest(phone) {
  try {
    if (!initialized()) return { ok: false, code: 'SETUP', error: 'ระบบยังไม่ได้ตั้งค่าครั้งแรก' };
    phone = normPhone(phone);
    if (!phone) return { ok: false, error: 'กรอกเบอร์มือถือ 10 หลัก เช่น 0812345678' };
    var u = userByPhone(phone);
    if (!u) return { ok: false, error: 'เบอร์นี้ยังไม่มีบัญชีในระบบ กรุณาแจ้งผู้จัดการให้เพิ่มบัญชี' };
    var now = Date.now();
    var recent = DB.all('Otps').filter(function (o) { return o.phone === phone && o.kind === 'sms' && now - num(o.created_ms) < 3600000; });
    var last = recent.reduce(function (m, o) { return Math.max(m, num(o.created_ms)); }, 0);
    if (last && now - last < OTP_GAP_MS) {
      return { ok: false, error: 'เพิ่งส่งรหัสไป กรุณารอ ' + Math.ceil((OTP_GAP_MS - (now - last)) / 1000) + ' วินาทีแล้วขอใหม่' };
    }
    if (recent.length >= OTP_PER_HOUR) return { ok: false, error: 'ขอรหัสเกิน ' + OTP_PER_HOUR + ' ครั้งใน 1 ชั่วโมง กรุณารอ หรือขอรหัสเข้าใช้ชั่วคราวจากผู้จัดการ' };
    if (!SMS.configured()) {
      return { ok: false, code: 'NOSMS', error: 'ระบบยังไม่ได้เชื่อมต่อ SMS — ขอรหัสเข้าใช้ชั่วคราวจากผู้จัดการ (CEO/ผู้จัดการใช้รหัสกู้คืนได้)' };
    }
    var code = randomDigits(6);
    var ref = randomRef();
    DB.insert('Otps', {
      otp_id: 'O' + now.toString(36) + randomRef(), phone: phone, user_id: u.user_id, kind: 'sms', ref: ref,
      code_hash: hashCode(phone, code), expires_ms: now + OTP_TTL_MS, attempts: 0, used: '', created_ms: now,
      created_by: 'SMS', created_at: nowIso()
    });
    SMS.send(phone, 'รหัสเข้าระบบ SBP FieldOps: ' + code + ' (Ref ' + ref + ') ใช้ได้ 5 นาที ห้ามบอกรหัสนี้กับผู้อื่น');
    log(u.user_id, 'otp.request', maskPhone(phone), ref);
    return { ok: true, data: { ref: ref, expires_in: OTP_TTL_MS / 1000, wait: OTP_GAP_MS / 1000, masked: maskPhone(phone) } };
  } catch (err) { return { ok: false, error: errText(err) }; }
}

/** ยืนยันรหัส (OTP ทาง SMS หรือรหัสชั่วคราวจากผู้จัดการ) → ออกบัตรผ่าน 30 วัน */
function otpVerify(phone, code) {
  try {
    phone = normPhone(phone);
    code = String(code || '').replace(/\D/g, '');
    if (!phone || code.length !== 6) return { ok: false, error: 'กรอกเบอร์มือถือและรหัส 6 หลัก' };
    var cache = CacheService.getScriptCache();
    var failKey = 'fail_otp_' + phone;
    var fails = num(cache.get(failKey));
    if (fails >= FAIL_LIMIT) return { ok: false, error: 'ใส่รหัสผิดเกิน ' + FAIL_LIMIT + ' ครั้ง กรุณารอ 15 นาทีแล้วขอรหัสใหม่' };
    var u = userByPhone(phone);
    var now = Date.now();
    var h = hashCode(phone, code);
    var hit = u ? DB.all('Otps').filter(function (o) {
      return o.phone === phone && !isTrue(o.used) && num(o.expires_ms) > now && o.code_hash === h;
    })[0] : null;
    if (!hit) {
      cache.put(failKey, String(fails + 1), 900);
      return { ok: false, error: 'รหัสไม่ถูกต้องหรือหมดอายุ' + (fails + 1 >= FAIL_LIMIT ? '' : ' (เหลือ ' + (FAIL_LIMIT - fails - 1) + ' ครั้ง)') };
    }
    DB.update('Otps', 'otp_id', hit.otp_id, { used: 'Y', attempts: num(hit.attempts) + 1 });
    var up = { last_login: nowIso() };
    if (hit.kind === 'temp' || !u.pin_hash) up.must_change = 'Y'; // ครั้งแรก/ลืม PIN → ต้องตั้ง PIN ก่อนใช้งาน
    DB.update('Users', 'user_id', u.user_id, up);
    cache.remove(failKey);
    log(u.user_id, 'login', hit.kind === 'temp' ? 'รหัสชั่วคราว' : 'OTP', hit.ref || '');
    u = DB.find('Users', 'user_id', u.user_id);
    return { ok: true, data: { token: makeToken(u), user: publicUser(u) } };
  } catch (err) { return { ok: false, error: errText(err) }; }
}

/** เข้าระบบด้วยเบอร์มือถือ + PIN 6 หลัก */
function pinLogin(phone, pin) {
  try {
    if (!initialized()) return { ok: false, code: 'SETUP', error: 'ระบบยังไม่ได้ตั้งค่าครั้งแรก' };
    phone = normPhone(phone);
    pin = String(pin || '').replace(/\D/g, '');
    if (!phone) return { ok: false, error: 'กรอกเบอร์มือถือ 10 หลัก เช่น 0812345678' };
    if (pin.length !== 6) return { ok: false, error: 'กรอก PIN 6 หลัก' };
    var cache = CacheService.getScriptCache();
    var failKey = 'fail_pin_' + phone;
    var fails = num(cache.get(failKey));
    if (fails >= FAIL_LIMIT) return { ok: false, error: 'ใส่ PIN ผิดเกิน ' + FAIL_LIMIT + ' ครั้ง กรุณารอ 15 นาที หรือขอรหัสชั่วคราวจากผู้จัดการ' };
    var u = userByPhone(phone);
    if (!u) return { ok: false, error: 'เบอร์นี้ยังไม่มีบัญชีในระบบ กรุณาแจ้งผู้จัดการให้เพิ่มบัญชี' };
    if (!u.pin_hash) return { ok: false, code: 'NOPIN', error: 'ยังไม่ได้ตั้ง PIN — ใช้รหัสชั่วคราวจากผู้จัดการเข้าครั้งแรก' };
    if (hashPin(u.user_id, pin) !== u.pin_hash) {
      cache.put(failKey, String(fails + 1), 900);
      return { ok: false, error: 'PIN ไม่ถูกต้อง' + (fails + 1 >= FAIL_LIMIT ? '' : ' (เหลือ ' + (FAIL_LIMIT - fails - 1) + ' ครั้ง)') };
    }
    cache.remove(failKey);
    DB.update('Users', 'user_id', u.user_id, { last_login: nowIso() });
    log(u.user_id, 'login', 'PIN', '');
    u = DB.find('Users', 'user_id', u.user_id);
    return { ok: true, data: { token: makeToken(u), user: publicUser(u) } };
  } catch (err) { return { ok: false, error: errText(err) }; }
}

/** ทางสำรองของ CEO/ผู้จัดการ เมื่อ SMS ใช้ไม่ได้: เบอร์ + รหัสกู้คืนส่วนตัว (ใช้ได้ครั้งเดียว) */
function recoveryLogin(phone, code) {
  try {
    phone = normPhone(phone);
    code = String(code || '').replace(/\D/g, '');
    if (!phone || code.length !== 10) return { ok: false, error: 'กรอกเบอร์มือถือและรหัสกู้คืน 10 หลัก' };
    var cache = CacheService.getScriptCache();
    var failKey = 'fail_rc_' + phone;
    var fails = num(cache.get(failKey));
    if (fails >= FAIL_LIMIT) return { ok: false, error: 'ใส่รหัสผิดหลายครั้ง กรุณารอ 15 นาที' };
    var u = userByPhone(phone);
    if (!u || MGMT.indexOf(u.role) < 0 || !u.recovery_hash || hashCode('rc|' + u.user_id, code) !== u.recovery_hash) {
      cache.put(failKey, String(fails + 1), 900);
      return { ok: false, error: 'เบอร์หรือรหัสกู้คืนไม่ถูกต้อง' };
    }
    DB.update('Users', 'user_id', u.user_id, { recovery_hash: '', last_login: nowIso() });
    cache.remove(failKey);
    log(u.user_id, 'login', 'รหัสกู้คืน', '');
    u = DB.find('Users', 'user_id', u.user_id);
    return { ok: true, data: { token: makeToken(u), user: publicUser(u), recovery_used: true } };
  } catch (err) { return { ok: false, error: errText(err) }; }
}

function userByPhone(phone) {
  return DB.all('Users').filter(function (u) { return isTrue(u.active) && normPhone(u.phone) === phone; })[0] || null;
}

/** ทางเข้าเดียวของหน้าเว็บ: api(token, action, payload) */
function api(token, action, payload) {
  try {
    var user = auth(token);
    if (!user) return { ok: false, code: 'AUTH', error: 'กรุณาเข้าสู่ระบบใหม่' };
    var h = HANDLERS[action];
    if (!h) return { ok: false, error: 'ไม่รู้จักคำสั่ง ' + action };
    if (isTrue(user.must_change) && ['bootstrap', 'me.pin'].indexOf(action) < 0) return { ok: false, code: 'PIN', error: 'กรุณาตั้ง PIN ก่อนใช้งาน' };
    if (h.roles && h.roles.indexOf(user.role) < 0) return { ok: false, error: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' };
    var data = h.fn(user, payload || {});
    return { ok: true, data: plain(data) };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

/** หน้าใบเสนอราคาสำหรับลูกค้า (ไม่ต้องล็อกอิน ใช้ token สุ่ม) */
function publicQuote(token) {
  try {
    var q = findQuoteByToken(token);
    if (!q) return { ok: false, error: 'ไม่พบใบเสนอราคา หรือลิงก์หมดอายุ' };
    return { ok: true, data: plain(customerQuoteView(q)) };
  } catch (err) { return { ok: false, error: errText(err) }; }
}

function publicAck(token, name, note) {
  try {
    name = clean(name, 80);
    if (!name) return { ok: false, error: 'กรุณาระบุชื่อผู้ยืนยัน' };
    var q = findQuoteByToken(token);
    if (!q) return { ok: false, error: 'ไม่พบใบเสนอราคา' };
    if (['APPROVED', 'SENT'].indexOf(q.status) < 0) return { ok: false, error: 'ใบเสนอราคานี้ไม่อยู่ในสถานะให้ยืนยัน' };
    if (q.valid_until && q.valid_until < today()) return { ok: false, error: 'ใบเสนอราคาหมดอายุแล้ว กรุณาติดต่อเจ้าหน้าที่' };
    withLock(function () {
      DB.update('Quotes', 'quote_id', q.quote_id, {
        status: 'ACCEPTED', customer_ack: name + (note ? ' — ' + clean(note, 200) : ''),
        customer_ack_at: nowIso(), updated_at: nowIso()
      });
    });
    log('CUSTOMER', 'quote.ack', q.quote_id, name);
    return { ok: true, data: plain(customerQuoteView(DB.find('Quotes', 'quote_id', q.quote_id))) };
  } catch (err) { return { ok: false, error: errText(err) }; }
}





// ============================================================ handlers

var ALL = ['CEO', 'MANAGER', 'SALES', 'BACKOFFICE', 'LEAD', 'TECH'];
var OFFICE = ['CEO', 'MANAGER', 'SALES', 'BACKOFFICE'];
var MGMT = ['CEO', 'MANAGER'];
var BILLING = ['CEO', 'MANAGER', 'BACKOFFICE'];
var FIELD = ['CEO', 'MANAGER', 'LEAD', 'TECH'];

var HANDLERS = {
  'bootstrap': { roles: ALL, fn: bootstrap },
  'me.pin': { roles: ALL, fn: setMyPin },
  'me.recovery': { roles: MGMT, fn: makeRecoveryCode },
  'me.logoutAll': { roles: ALL, fn: logoutAll },
  'home': { roles: ALL, fn: home },

  'customers.list': { roles: OFFICE, fn: listCustomers },
  'customers.get': { roles: OFFICE, fn: getCustomer },
  'customers.save': { roles: OFFICE, fn: saveCustomer },

  'leads.list': { roles: OFFICE, fn: listLeads },
  'leads.get': { roles: OFFICE, fn: getLead },
  'leads.save': { roles: OFFICE, fn: saveLead },
  'leads.stage': { roles: OFFICE, fn: setLeadStage },
  'leads.photo': { roles: OFFICE, fn: uploadLeadPhoto },

  'catalog.search': { roles: OFFICE, fn: searchCatalog },

  'quotes.list': { roles: OFFICE, fn: listQuotes },
  'quotes.get': { roles: OFFICE, fn: getQuote },
  'quotes.save': { roles: ['CEO', 'MANAGER', 'BACKOFFICE'], fn: saveQuote },
  'quotes.submit': { roles: ['CEO', 'MANAGER', 'BACKOFFICE'], fn: submitQuote },
  'quotes.approve': { roles: MGMT, fn: approveQuote },
  'quotes.reject': { roles: MGMT, fn: rejectQuote },
  'quotes.sent': { roles: OFFICE, fn: markQuoteSent },
  'quotes.won': { roles: OFFICE, fn: markQuoteWon },
  'quotes.lost': { roles: OFFICE, fn: markQuoteLost },
  'quotes.revise': { roles: ['CEO', 'MANAGER', 'BACKOFFICE'], fn: reviseQuote },

  'plan.get': { roles: MGMT, fn: getPlan },
  'plan.assign': { roles: MGMT, fn: assignJob },
  'plan.release': { roles: MGMT, fn: releasePlan },
  'jobs.create': { roles: MGMT, fn: createManualJob },
  'jobs.mine': { roles: FIELD, fn: myJobs },
  'jobs.get': { roles: ALL, fn: getJob },
  'jobs.start': { roles: FIELD, fn: startJob },
  'jobs.save': { roles: FIELD, fn: saveJobProgress },
  'jobs.photo': { roles: FIELD, fn: uploadJobPhoto },
  'jobs.close': { roles: FIELD, fn: closeJob },
  'jobs.cancel': { roles: MGMT, fn: cancelJob },
  'jobs.cost': { roles: MGMT, fn: setJobCost },
  'jobs.list': { roles: ['CEO', 'MANAGER', 'BACKOFFICE'], fn: listJobs },
  'photo.get': { roles: ALL, fn: getPhoto },

  'billing.list': { roles: BILLING, fn: listBilling },
  'billing.sent': { roles: BILLING, fn: billingSent },
  'billing.billed': { roles: BILLING, fn: billingBilled },
  'billing.paid': { roles: BILLING, fn: billingPaid },
  'billing.nobill': { roles: MGMT, fn: billingNoBill },

  'assets.list': { roles: ALL, fn: listAssets },
  'assets.save': { roles: ALL, fn: saveAsset },

  'cases.list': { roles: OFFICE, fn: listCases },
  'cases.open': { roles: OFFICE, fn: openCase },
  'cases.decide': { roles: MGMT, fn: decideCase },
  'cases.close': { roles: MGMT, fn: closeCase },

  'contracts.list': { roles: OFFICE, fn: listContracts },
  'contracts.save': { roles: ['CEO', 'MANAGER', 'BACKOFFICE', 'SALES'], fn: saveContract },
  'contracts.generate': { roles: MGMT, fn: generateContractVisits },
  'contracts.billed': { roles: BILLING, fn: contractBilled },

  'dashboard': { roles: MGMT, fn: dashboard },

  'users.list': { roles: MGMT, fn: listUsers },
  'users.save': { roles: MGMT, fn: saveUser },
  'users.tempCode': { roles: MGMT, fn: issueTempCode },
  'users.revoke': { roles: MGMT, fn: revokeUser },
  'settings.save': { roles: ['CEO'], fn: saveSettings }
};

// ---------------------------------------------------------------- common

function bootstrap(user) {
  return {
    user: publicUser(user),
    roles: ROLES,
    settings: publicSettings(user),
    teams: teamNames(),
    checklists: CHECKLISTS,
    users: DB.all('Users').filter(function (u) { return isTrue(u.active); })
      .map(function (u) { return { user_id: u.user_id, name: u.name, role: u.role, team: u.team }; }),
    today: today(),
    tomorrow: addDays(today(), 1),
    sms: SMS.configured()
  };
}

/** ตั้ง/เปลี่ยน PIN ของตัวเอง — ครั้งแรกหรือหลังใช้รหัสชั่วคราวไม่ต้องใส่ PIN เดิม · เปลี่ยนแล้วเครื่องอื่นออกจากระบบ */
function setMyPin(user, p) {
  var pin = String(p.new_pin || '').replace(/\D/g, '');
  if (pin.length !== 6) throw new Error('PIN ต้องเป็นตัวเลข 6 หลัก');
  if (/^(\d)\1{5}$/.test(pin) || '0123456789012345678909876543210'.indexOf(pin) >= 0) throw new Error('PIN เดาง่ายเกินไป (เลขซ้ำหรือเรียงกัน) กรุณาตั้งใหม่');
  if (normPhone(user.phone) && normPhone(user.phone).indexOf(pin) >= 0) throw new Error('ห้ามใช้เลขจากเบอร์โทรเป็น PIN');
  if (!isTrue(user.must_change)) {
    if (!user.pin_hash || hashPin(user.user_id, String(p.old_pin || '')) !== user.pin_hash) throw new Error('PIN เดิมไม่ถูกต้อง');
    if (hashPin(user.user_id, pin) === user.pin_hash) throw new Error('PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม');
  }
  return withLock(function () {
    DB.update('Users', 'user_id', user.user_id, { pin_hash: hashPin(user.user_id, pin), must_change: '', session_ver: num(user.session_ver) + 1 });
    log(user.user_id, 'pin.set', user.user_id, '');
    var u = DB.find('Users', 'user_id', user.user_id);
    return { token: makeToken(u), user: publicUser(u) };
  });
}

/** รหัสกู้คืนส่วนตัวของ CEO/ผู้จัดการ (10 หลัก ใช้ได้ครั้งเดียว) — แสดงครั้งเดียว ระบบเก็บเฉพาะค่าแฮช */
function makeRecoveryCode(user) {
  var code = randomDigits(10);
  DB.update('Users', 'user_id', user.user_id, { recovery_hash: hashCode('rc|' + user.user_id, code) });
  log(user.user_id, 'recovery.create', user.user_id, '');
  return { code: code.slice(0, 5) + '-' + code.slice(5) };
}

/** ออกจากระบบทุกเครื่องของตัวเอง (เช่น มือถือหาย) แล้วออกบัตรผ่านใหม่ให้เครื่องนี้ */
function logoutAll(user) {
  DB.update('Users', 'user_id', user.user_id, { session_ver: num(user.session_ver) + 1 });
  log(user.user_id, 'session.revokeAll', user.user_id, '');
  return { token: makeToken(DB.find('Users', 'user_id', user.user_id)) };
}

/** หน้าแรกตามบทบาท */
function home(user) {
  var t = today(), tm = addDays(t, 1);
  var out = { role: user.role, today: t };
  if (user.role === 'LEAD' || user.role === 'TECH') {
    out.jobs = myJobs(user, {});
    return out;
  }
  var leads = DB.all('Leads'), quotes = DB.all('Quotes'), jobs = DB.all('Jobs');
  if (user.role === 'SALES') {
    var mine = leads.filter(function (l) { return l.owner_id === user.user_id; });
    out.followups = mine.filter(function (l) { return isOpenLead(l) && l.next_date && l.next_date <= t; }).map(leadCard);
    out.openLeads = mine.filter(isOpenLead).length;
    out.quotesToSend = quotes.filter(function (q) { return q.owner_id === user.user_id && q.status === 'APPROVED'; }).map(quoteCard);
    out.accepted = quotes.filter(function (q) { return q.owner_id === user.user_id && q.status === 'ACCEPTED'; }).map(quoteCard);
    out.month = salesMonth(user.user_id);
    return out;
  }
  if (user.role === 'BACKOFFICE' || user.role === 'MANAGER' || user.role === 'CEO') {
    out.leadsWaitingQuote = leads.filter(function (l) { return l.stage === 'QUOTE' && !l.quote_id; }).map(leadCard);
    out.quotesToSend = quotes.filter(function (q) { return q.status === 'APPROVED'; }).map(quoteCard);
    out.rejected = quotes.filter(function (q) { return q.status === 'REJECTED'; }).map(quoteCard);
    out.waitSend = jobs.filter(function (j) { return j.bill_status === 'WAIT_SEND'; }).map(jobCard);
    out.contractsToBill = DB.all('Contracts').filter(function (c) {
      return c.status === 'ACTIVE' && c.next_bill && c.next_bill <= t;
    }).map(contractCard);
  }
  if (user.role === 'MANAGER' || user.role === 'CEO') {
    out.approvals = quotes.filter(function (q) {
      return q.status === 'PENDING' && (user.role === 'CEO' || q.approval_level !== 'CEO');
    }).map(function (q) { return quoteCard(q, true); });
    out.waitPlan = jobs.filter(function (j) { return j.status === 'WAIT_PLAN'; }).map(jobCard);
    out.tomorrowReleased = jobs.some(function (j) { return j.plan_date === tm && isTrue(j.released); });
    out.tomorrowCount = jobs.filter(function (j) { return j.plan_date === tm && j.status !== 'CANCELLED'; }).length;
    out.cases = DB.all('Cases').filter(function (c) { return c.status !== 'CLOSED'; }).map(caseCard);
    out.alerts = alerts();
  }
  return out;
}

// ---------------------------------------------------------------- customers

function listCustomers(user, p) {
  var q = String(p.q || '').toLowerCase();
  return DB.all('Customers').filter(function (c) {
    return !q || (c.name + ' ' + c.address + ' ' + c.phone + ' ' + c.contact).toLowerCase().indexOf(q) >= 0;
  }).slice(0, 60).map(function (c) {
    return { cust_id: c.cust_id, name: c.name, type: c.type, address: c.address, phone: c.phone, contact: c.contact,
      credit_days: num(c.credit_days), owner_id: c.owner_id };
  });
}

function getCustomer(user, p) {
  var c = mustFind('Customers', 'cust_id', p.cust_id);
  var jobs = DB.all('Jobs').filter(function (j) { return j.cust_id === c.cust_id; }).map(function (j) {
    return hidePrice(user, jobCard(j));
  }).reverse();
  return {
    customer: c,
    jobs: jobs.slice(0, 50),
    assets: DB.all('Assets').filter(function (a) { return a.cust_id === c.cust_id; }),
    contracts: DB.all('Contracts').filter(function (k) { return k.cust_id === c.cust_id; }).map(contractCard),
    cases: DB.all('Cases').filter(function (k) { return k.cust_id === c.cust_id; }).map(caseCard),
    quotes: DB.all('Quotes').filter(function (q) { return q.cust_id === c.cust_id; }).map(quoteCard).reverse()
  };
}

function saveCustomer(user, p) {
  var name = clean(p.name, 150);
  if (!name) throw new Error('กรุณาระบุชื่อลูกค้า');
  var rec = {
    name: name, type: p.type === 'B2C' ? 'B2C' : 'B2B', tax_id: clean(p.tax_id, 20), branch: clean(p.branch, 60),
    address: clean(p.address, 300), zone: clean(p.zone, 60), contact: clean(p.contact, 80), phone: clean(p.phone, 40),
    line_id: clean(p.line_id, 60), credit_days: Math.max(0, num(p.credit_days)), notes: clean(p.notes, 500)
  };
  return withLock(function () {
    if (p.cust_id) {
      mustFind('Customers', 'cust_id', p.cust_id);
      DB.update('Customers', 'cust_id', p.cust_id, rec);
      log(user.user_id, 'customer.update', p.cust_id, name);
      return DB.find('Customers', 'cust_id', p.cust_id);
    }
    var dup = DB.all('Customers').filter(function (c) { return normName(c.name) === normName(name); })[0];
    if (dup) throw new Error('มีลูกค้าชื่อนี้แล้ว (' + dup.cust_id + ')');
    rec.cust_id = nextId('C');
    rec.owner_id = user.role === 'SALES' ? user.user_id : (p.owner_id || user.user_id);
    rec.created_at = nowIso();
    DB.insert('Customers', rec);
    log(user.user_id, 'customer.create', rec.cust_id, name);
    return rec;
  });
}

// ---------------------------------------------------------------- leads

var LEAD_STAGES = ['NEW', 'QUOTE', 'SURVEY', 'QUOTED', 'WON', 'LOST', 'HOLD'];

function listLeads(user, p) {
  var rows = DB.all('Leads');
  if (user.role === 'SALES') rows = rows.filter(function (l) { return l.owner_id === user.user_id; });
  if (p.stage) rows = rows.filter(function (l) { return l.stage === p.stage; });
  if (p.open) rows = rows.filter(isOpenLead);
  var q = String(p.q || '').toLowerCase();
  if (q) rows = rows.filter(function (l) { return (l.cust_name + ' ' + l.site + ' ' + l.lead_id).toLowerCase().indexOf(q) >= 0; });
  return rows.slice().reverse().slice(0, 200).map(leadCard);
}

function getLead(user, p) {
  var l = mustFind('Leads', 'lead_id', p.lead_id);
  if (user.role === 'SALES' && l.owner_id !== user.user_id) throw new Error('ไม่ใช่ Lead ของคุณ');
  var out = leadCard(l);
  out.answers = parseJson(l.answers, {});
  out.photos = parseJson(l.photos, []);
  out.contact = l.contact; out.phone = l.phone; out.zone = l.zone; out.source = l.source; out.note = l.note;
  out.lost_reason = l.lost_reason;
  var c = l.cust_id ? DB.find('Customers', 'cust_id', l.cust_id) : null;
  out.cust_type = c ? c.type : '';
  if (l.quote_id) out.quote = quoteCard(DB.find('Quotes', 'quote_id', l.quote_id) || {});
  return out;
}

function saveLead(user, p) {
  var custName = clean(p.cust_name, 150);
  if (!custName && !p.cust_id) throw new Error('กรุณาระบุลูกค้า');
  var rec = {
    site: clean(p.site, 300), zone: clean(p.zone, 60), contact: clean(p.contact, 80), phone: clean(p.phone, 40),
    source: clean(p.source, 40), job_type: clean(p.job_type, 30), lane: laneOf(p),
    units: Math.max(0, num(p.units)), est_value: Math.max(0, num(p.est_value)),
    answers: JSON.stringify(sanitizeObj(p.answers || {}, 500)), next_action: clean(p.next_action, 200),
    next_date: cleanDate(p.next_date), note: clean(p.note, 1000), updated_at: nowIso()
  };
  return withLock(function () {
    var old = p.lead_id ? mustFind('Leads', 'lead_id', p.lead_id) : null;
    if (old && user.role === 'SALES' && old.owner_id !== user.user_id) throw new Error('ไม่ใช่ Lead ของคุณ');
    var owner = old ? old.owner_id : (user.role === 'SALES' ? user.user_id : (p.owner_id || user.user_id));
    // ทุก Lead ต้องผูกกับทะเบียนลูกค้า เพื่อให้ประวัติงาน/เครื่อง/ประกันอยู่ที่เดียว
    var cust = p.cust_id ? DB.find('Customers', 'cust_id', p.cust_id) : null;
    if (!cust && custName) {
      cust = DB.all('Customers').filter(function (c) { return normName(c.name) === normName(custName); })[0] || null;
      if (!cust) {
        cust = { cust_id: nextId('C'), name: custName, type: p.cust_type === 'B2C' ? 'B2C' : 'B2B', tax_id: '', branch: '',
          address: rec.site, zone: rec.zone, contact: rec.contact, phone: rec.phone, line_id: '', credit_days: 0,
          owner_id: owner, notes: 'สร้างอัตโนมัติจาก Lead', created_at: nowIso() };
        DB.insert('Customers', cust);
        log(user.user_id, 'customer.create', cust.cust_id, custName);
      }
    }
    if (!cust) throw new Error('ไม่พบลูกค้า');
    rec.cust_id = cust.cust_id; rec.cust_name = cust.name;
    if (old) {
      // อัปเดตเฉพาะช่องที่ส่งมา (กันข้อมูลหายเมื่อแก้บางส่วน)
      Object.keys(rec).forEach(function (k) {
        var src = k === 'lane' ? 'units' : k;
        if (['cust_id', 'cust_name', 'updated_at'].indexOf(k) < 0 && p[src] === undefined) delete rec[k];
      });
      if (rec.lane !== undefined) rec.lane = laneOf({ units: p.units, est_value: p.est_value === undefined ? old.est_value : p.est_value,
        job_type: p.job_type === undefined ? old.job_type : p.job_type, answers: p.answers === undefined ? parseJson(old.answers, {}) : p.answers });
      DB.update('Leads', 'lead_id', old.lead_id, rec);
      log(user.user_id, 'lead.update', old.lead_id, '');
      return leadCard(DB.find('Leads', 'lead_id', old.lead_id));
    }
    rec.lead_id = nextId('L');
    rec.created_at = nowIso();
    rec.owner_id = user.role === 'SALES' ? user.user_id : (p.owner_id || cust.owner_id || user.user_id);
    rec.stage = 'NEW';
    rec.photos = '[]';
    DB.insert('Leads', rec);
    log(user.user_id, 'lead.create', rec.lead_id, rec.cust_name);
    return leadCard(rec);
  });
}

function setLeadStage(user, p) {
  var stage = String(p.stage || '');
  if (LEAD_STAGES.indexOf(stage) < 0) throw new Error('สถานะไม่ถูกต้อง');
  return withLock(function () {
    var l = mustFind('Leads', 'lead_id', p.lead_id);
    if (user.role === 'SALES' && l.owner_id !== user.user_id) throw new Error('ไม่ใช่ Lead ของคุณ');
    var patch = { stage: stage, updated_at: nowIso() };
    if (stage === 'LOST') {
      patch.lost_reason = clean(p.reason, 300);
      if (!patch.lost_reason) throw new Error('กรุณาระบุเหตุผลที่ไม่ได้งาน');
    }
    if (stage === 'QUOTE' || stage === 'SURVEY') {
      var a = parseJson(l.answers, {});
      var missing = ['type', 'qty', 'access', 'symptom'].filter(function (k) { return !a[k]; });
      if (missing.length && stage === 'QUOTE') throw new Error('ข้อมูล 8 คำถามยังไม่ครบ (' + missing.join(', ') + ') — เก็บเพิ่มหรือส่งสำรวจ');
    }
    DB.update('Leads', 'lead_id', p.lead_id, patch);
    log(user.user_id, 'lead.stage', p.lead_id, stage);
    return leadCard(DB.find('Leads', 'lead_id', p.lead_id));
  });
}

function uploadLeadPhoto(user, p) {
  var l = mustFind('Leads', 'lead_id', p.lead_id);
  if (user.role === 'SALES' && l.owner_id !== user.user_id) throw new Error('ไม่ใช่ Lead ของคุณ');
  var m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(p.data || ''));
  if (!m) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  if (m[2].length > 4 * 1024 * 1024) throw new Error('รูปใหญ่เกินไป');
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], l.lead_id + '_' + Date.now() + '.jpg');
  var id = DriveApp.createFile(blob).getId();
  return withLock(function () {
    var fresh = DB.find('Leads', 'lead_id', l.lead_id);
    var arr = parseJson(fresh.photos, []);
    if (arr.length >= 20) throw new Error('รูปเกิน 20 รูป');
    arr.push(id);
    DB.update('Leads', 'lead_id', l.lead_id, { photos: JSON.stringify(arr), updated_at: nowIso() });
    return { id: id };
  });
}

function laneOf(p) {
  var units = num(p.units), val = num(p.est_value), type = String(p.job_type || '');
  var a = p.answers || {};
  if (val >= num(setting('ceo_threshold')) || a.risk === 'R2' || a.risk === 'R3') return 'P';
  if (type === 'สำรวจ' || a.unknown === 'Y' || units > 40) return 'V';
  if (units >= 5 || type === 'สัญญา/PM') return 'S';
  return units > 0 && units <= 4 ? 'F' : 'S';
}

// ---------------------------------------------------------------- catalog

function searchCatalog(user, p) {
  if (p.ids && p.ids.length) {
    var want = {};
    p.ids.slice(0, 100).forEach(function (id) { want[String(id)] = true; });
    return DB.all('Catalog').filter(function (c) { return want[c.item_id]; }).map(function (c) { return catalogCard(c, user); });
  }
  var q = String(p.q || '').toLowerCase().trim();
  var cat = String(p.category || '');
  var words = q.split(/\s+/).filter(String);
  var out = [];
  var rows = DB.all('Catalog');
  for (var i = 0; i < rows.length && out.length < 40; i++) {
    var c = rows[i];
    if (c.active === 'N') continue;
    if (cat && c.category !== cat) continue;
    var hay = (c.item_id + ' ' + c.name).toLowerCase();
    if (words.every(function (w) { return hay.indexOf(w) >= 0; })) out.push(catalogCard(c, user));
  }
  return out;
}

function catalogCard(c, user) {
  var o = {
    item_id: c.item_id, category: c.category, name: c.name, unit: c.unit, price_std: num(c.price_std),
    price_special: num(c.price_special), price_project: num(c.price_project), team_day: num(c.team_day),
    warranty: c.warranty, active: c.active
  };
  if (canSeeCost(user)) o.cost = num(c.cost);
  return o;
}

// ---------------------------------------------------------------- quotes

function listQuotes(user, p) {
  var rows = DB.all('Quotes');
  if (user.role === 'SALES') rows = rows.filter(function (q) { return q.owner_id === user.user_id; });
  if (p.status) rows = rows.filter(function (q) { return String(p.status).split(',').indexOf(q.status) >= 0; });
  var s = String(p.q || '').toLowerCase();
  if (s) rows = rows.filter(function (q) { return (q.quote_id + ' ' + q.cust_name).toLowerCase().indexOf(s) >= 0; });
  return rows.slice().reverse().slice(0, 200).map(function (q) { return quoteCard(q, canSeeCost(user)); });
}

function getQuote(user, p) {
  var q = mustFind('Quotes', 'quote_id', p.quote_id);
  if (user.role === 'SALES' && q.owner_id !== user.user_id) throw new Error('ไม่ใช่ใบเสนอราคาของคุณ');
  var lines = DB.all('QuoteLines').filter(function (l) { return l.quote_id === q.quote_id; })
    .sort(function (a, b) { return num(a.line_no) - num(b.line_no); })
    .map(function (l) {
      var o = { item_id: l.item_id, description: l.description, qty: num(l.qty), unit: l.unit, price: num(l.price),
        amount: num(l.amount), team_day: num(l.team_day) };
      if (canSeeCost(user)) o.cost = num(l.cost);
      return o;
    });
  var out = quoteCard(q, canSeeCost(user));
  out.lines = lines;
  out.scope_note = q.scope_note; out.exclusions = q.exclusions; out.contact = q.contact; out.phone = q.phone;
  out.lost_reason = q.lost_reason;
  out.approve_note = q.approve_note; out.customer_ack = q.customer_ack; out.customer_ack_at = q.customer_ack_at;
  out.link = q.public_token ? webUrl() + '?quote=' + q.public_token : '';
  out.view = customerQuoteView(q, lines);
  return out;
}

/** บันทึกใบเสนอราคา (ร่าง) และคำนวณด่าน 3 ด่าน */
function saveQuote(user, p) {
  var lines = (p.lines || []).filter(function (l) { return l && (l.item_id || l.description) && num(l.qty) > 0; });
  if (!lines.length) throw new Error('ยังไม่มีรายการในใบเสนอราคา');
  if (lines.length > 80) throw new Error('รายการเกิน 80 บรรทัด');
  var lead = p.lead_id ? DB.find('Leads', 'lead_id', p.lead_id) : null;
  var cust = p.cust_id ? DB.find('Customers', 'cust_id', p.cust_id) : (lead && lead.cust_id ? DB.find('Customers', 'cust_id', lead.cust_id) : null);
  var level = ['std', 'special', 'project'].indexOf(p.price_level) >= 0 ? p.price_level : 'std';
  var cat = indexBy(DB.all('Catalog'), 'item_id');
  var belowFloor = false;
  var built = lines.map(function (l, i) {
    var c = l.item_id ? cat[l.item_id] : null;
    var listPrice = c ? num(level === 'project' ? c.price_project : level === 'special' ? c.price_special : c.price_std) : 0;
    var price = (l.price === '' || l.price === undefined || l.price === null) ? listPrice : num(l.price);
    if (c && num(c.price_project) > 0 && price < num(c.price_project) - 0.001) belowFloor = true;
    if (!c && price <= 0) throw new Error('บรรทัด ' + (i + 1) + ' ไม่มีราคา');
    var qty = num(l.qty);
    var costUnit = c ? num(c.cost) : (l.cost !== undefined && canSeeCost(user) ? num(l.cost) : round2(price * 0.6));
    return {
      line_no: i + 1, item_id: c ? c.item_id : '', description: clean(l.description || (c ? c.name : ''), 300),
      qty: qty, unit: clean(l.unit || (c ? c.unit : 'หน่วย'), 20), price: round2(price), amount: round2(price * qty),
      cost: round2(costUnit * qty), team_day: round4((c ? num(c.team_day) : num(l.team_day)) * qty)
    };
  });
  var subtotal = sum(built, 'amount');
  var discount = Math.max(0, num(p.discount));
  if (discount > subtotal) throw new Error('ส่วนลดมากกว่ายอดรวม');
  var net = round2(subtotal - discount);
  var vat = round2(net * num(setting('vat_rate')));
  var estCost = round2(sum(built, 'cost'));
  var teamDays = round4(sum(built, 'team_day'));
  var contrib = round2(net - estCost - net * (num(setting('comm_rate')) + num(setting('warranty_rate'))));
  var contribTd = teamDays > 0 ? round2(contrib / teamDays) : '';
  var custType = cust ? cust.type : (p.cust_type === 'B2C' ? 'B2C' : 'B2B');
  var jobType = clean(p.job_type || (lead && lead.job_type) || '', 30);
  var minBill = jobType === 'ซ่อม' ? num(setting('min_bill_repair')) : custType === 'B2C' ? num(setting('min_bill_b2c')) : num(setting('min_bill_b2b'));
  var gateMin = net >= minBill ? 'PASS' : 'FAIL';
  var gateTd = teamDays <= 0 ? 'N/A' : contribTd >= num(setting('target_per_td')) ? 'GOOD' : contribTd >= num(setting('fixed_per_td')) ? 'PASS' : 'FAIL';
  var ceo = net >= num(setting('ceo_threshold')) || belowFloor || (level === 'project' && gateTd === 'FAIL');
  var rec = {
    lead_id: lead ? lead.lead_id : '', owner_id: lead ? lead.owner_id : (cust ? cust.owner_id : user.user_id),
    cust_id: cust ? cust.cust_id : '', cust_name: cust ? cust.name : clean(p.cust_name || (lead && lead.cust_name), 150),
    cust_type: custType, site: clean(p.site || (lead && lead.site) || (cust && cust.address), 300),
    contact: clean(p.contact || (lead && lead.contact) || (cust && cust.contact), 80),
    phone: clean(p.phone || (lead && lead.phone) || (cust && cust.phone), 40),
    job_type: jobType, payment: clean(p.payment || 'เงินสด', 40), price_level: level,
    subtotal: round2(subtotal), discount: round2(discount), net: net, vat: vat, total: round2(net + vat),
    est_cost: estCost, team_days: teamDays, contrib: contrib, contrib_td: contribTd,
    gate_minbill: gateMin, gate_td: gateTd, approval_level: ceo ? 'CEO' : 'MANAGER',
    scope_note: clean(p.scope_note, 2000), exclusions: clean(p.exclusions, 2000), updated_at: nowIso()
  };
  if (!rec.cust_name) throw new Error('กรุณาระบุลูกค้า');
  return withLock(function () {
    var id = p.quote_id;
    if (id) {
      var q = mustFind('Quotes', 'quote_id', id);
      if (['DRAFT', 'REJECTED'].indexOf(q.status) < 0) throw new Error('แก้ได้เฉพาะใบร่างหรือใบที่ถูกตีกลับ — ใบที่ส่งแล้วให้ทำ Revision');
      rec.status = 'DRAFT';
      DB.update('Quotes', 'quote_id', id, rec);
      DB.deleteWhere('QuoteLines', function (l) { return l.quote_id === id; });
    } else {
      id = nextId('Q');
      rec.quote_id = id; rec.rev = 0; rec.created_by = user.user_id; rec.created_at = nowIso(); rec.status = 'DRAFT';
      rec.public_token = '';
      DB.insert('Quotes', rec);
      if (lead) DB.update('Leads', 'lead_id', lead.lead_id, { quote_id: id, stage: 'QUOTED', updated_at: nowIso() });
    }
    built.forEach(function (b) { b.quote_id = id; DB.insert('QuoteLines', b); });
    log(user.user_id, 'quote.save', id, rec.net);
    return getQuote(user, { quote_id: id });
  });
}

function submitQuote(user, p) {
  return withLock(function () {
    var q = mustFind('Quotes', 'quote_id', p.quote_id);
    if (['DRAFT', 'REJECTED'].indexOf(q.status) < 0) throw new Error('ส่งอนุมัติได้เฉพาะใบร่าง');
    if (q.gate_minbill === 'FAIL' && !clean(p.reason, 300)) throw new Error('ต่ำกว่า Minimum Bill — ต้องระบุเหตุผลเพื่อขออนุมัติ');
    var note = clean(p.reason, 300);
    DB.update('Quotes', 'quote_id', q.quote_id, { status: 'PENDING', approve_note: note ? 'เหตุผลขออนุมัติ: ' + note : '', updated_at: nowIso() });
    log(user.user_id, 'quote.submit', q.quote_id, q.approval_level);
    return quoteCard(DB.find('Quotes', 'quote_id', q.quote_id), canSeeCost(user));
  });
}

function approveQuote(user, p) {
  return withLock(function () {
    var q = mustFind('Quotes', 'quote_id', p.quote_id);
    if (q.status !== 'PENDING') throw new Error('ใบนี้ไม่ได้รออนุมัติ');
    if (q.approval_level === 'CEO' && user.role !== 'CEO') throw new Error('ใบนี้ต้องให้ CEO อนุมัติ');
    var days = num(setting('quote_valid_days')) || 30;
    DB.update('Quotes', 'quote_id', q.quote_id, {
      status: 'APPROVED', approver_id: user.user_id, approved_at: nowIso(),
      approve_note: [q.approve_note, clean(p.note, 300)].filter(String).join(' | '),
      valid_until: addDays(today(), days), public_token: q.public_token || randomToken(), updated_at: nowIso()
    });
    log(user.user_id, 'quote.approve', q.quote_id, '');
    return quoteCard(DB.find('Quotes', 'quote_id', q.quote_id), true);
  });
}

function rejectQuote(user, p) {
  var note = clean(p.note, 300);
  if (!note) throw new Error('กรุณาระบุสิ่งที่ต้องแก้');
  return withLock(function () {
    var q = mustFind('Quotes', 'quote_id', p.quote_id);
    if (q.status !== 'PENDING') throw new Error('ใบนี้ไม่ได้รออนุมัติ');
    DB.update('Quotes', 'quote_id', q.quote_id, { status: 'REJECTED', approver_id: user.user_id, approve_note: note, updated_at: nowIso() });
    log(user.user_id, 'quote.reject', q.quote_id, note);
    return quoteCard(DB.find('Quotes', 'quote_id', q.quote_id), true);
  });
}

function markQuoteSent(user, p) {
  return withLock(function () {
    var q = mustFind('Quotes', 'quote_id', p.quote_id);
    ownerGuard(user, q);
    if (q.status !== 'APPROVED') throw new Error('ส่งลูกค้าได้เฉพาะใบที่อนุมัติแล้ว');
    DB.update('Quotes', 'quote_id', q.quote_id, { status: 'SENT', sent_at: nowIso(), updated_at: nowIso() });
    if (q.lead_id) DB.update('Leads', 'lead_id', q.lead_id, { next_action: 'ติดตามใบเสนอราคา ' + q.quote_id, next_date: addDays(today(), 2), updated_at: nowIso() });
    log(user.user_id, 'quote.sent', q.quote_id, '');
    return quoteCard(DB.find('Quotes', 'quote_id', q.quote_id), canSeeCost(user));
  });
}

/** ลูกค้าตกลง → เปิดงาน (JobID) รอผู้จัดการจัดทีม */
function markQuoteWon(user, p) {
  return withLock(function () {
    var q = mustFind('Quotes', 'quote_id', p.quote_id);
    ownerGuard(user, q);
    if (['APPROVED', 'SENT', 'ACCEPTED'].indexOf(q.status) < 0) throw new Error('ใบนี้ยังไม่ได้อนุมัติ หรือปิดไปแล้ว');
    var po = clean(p.po, 120);
    if (q.cust_type !== 'B2C' && q.status !== 'ACCEPTED' && !po) throw new Error('งาน B2B ต้องระบุเลข PO หรือหลักฐานการยืนยัน');
    var lines = DB.all('QuoteLines').filter(function (l) { return l.quote_id === q.quote_id; });
    var scope = lines.map(function (l) { return '• ' + l.description + ' × ' + num(l.qty) + ' ' + l.unit; }).join('\n');
    var jobId = nextId('J');
    var job = {
      job_id: jobId, quote_id: q.quote_id, lead_id: q.lead_id, owner_id: q.owner_id, cust_id: q.cust_id,
      cust_name: q.cust_name, site: q.site, contact: q.contact, phone: q.phone, job_type: q.job_type || 'อื่นๆ',
      scope: scope + (q.scope_note ? '\n' + q.scope_note : ''), payment: q.payment, amount: num(q.net),
      est_cost: num(q.est_cost), team_days: num(q.team_days), status: 'WAIT_PLAN', team: '', plan_date: '',
      plan_time: '', seq: '', released: '', checklist: '', measures: '', materials: '', extra_found: '',
      photos_before: '[]', photos_after: '[]', signature: '', signer: '', bill_status: '',
      tech_note: po ? 'PO/หลักฐาน: ' + po : '', created_at: nowIso(), updated_at: nowIso()
    };
    DB.insert('Jobs', job);
    DB.update('Quotes', 'quote_id', q.quote_id, { status: 'WON', job_id: jobId, updated_at: nowIso() });
    if (q.lead_id) DB.update('Leads', 'lead_id', q.lead_id, { stage: 'WON', job_id: jobId, updated_at: nowIso() });
    log(user.user_id, 'quote.won', q.quote_id, jobId);
    return { job_id: jobId };
  });
}

function markQuoteLost(user, p) {
  var reason = clean(p.reason, 300);
  if (!reason) throw new Error('กรุณาระบุเหตุผลที่ไม่ได้งาน');
  return withLock(function () {
    var q = mustFind('Quotes', 'quote_id', p.quote_id);
    ownerGuard(user, q);
    DB.update('Quotes', 'quote_id', q.quote_id, { status: 'LOST', lost_reason: reason, updated_at: nowIso() });
    if (q.lead_id) DB.update('Leads', 'lead_id', q.lead_id, { stage: 'LOST', lost_reason: reason, updated_at: nowIso() });
    log(user.user_id, 'quote.lost', q.quote_id, reason);
    return true;
  });
}

/** ทำ Revision ใหม่จากใบที่ส่งแล้ว (ใบเดิมเป็น SUPERSEDED) */
function reviseQuote(user, p) {
  return withLock(function () {
    var q = mustFind('Quotes', 'quote_id', p.quote_id);
    if (['APPROVED', 'SENT', 'ACCEPTED', 'REJECTED'].indexOf(q.status) < 0) throw new Error('ใบนี้ทำ Revision ไม่ได้');
    var lines = DB.all('QuoteLines').filter(function (l) { return l.quote_id === q.quote_id; });
    var id = nextId('Q');
    var copy = {};
    SCHEMA.Quotes.forEach(function (h) { copy[h] = q[h]; });
    copy.quote_id = id; copy.rev = num(q.rev) + 1; copy.status = 'DRAFT'; copy.created_by = user.user_id;
    copy.created_at = nowIso(); copy.approver_id = ''; copy.approved_at = ''; copy.approve_note = 'Revision ของ ' + q.quote_id;
    copy.sent_at = ''; copy.public_token = ''; copy.customer_ack = ''; copy.customer_ack_at = ''; copy.job_id = '';
    copy.updated_at = nowIso();
    DB.insert('Quotes', copy);
    lines.forEach(function (l) { var c = {}; SCHEMA.QuoteLines.forEach(function (h) { c[h] = l[h]; }); c.quote_id = id; DB.insert('QuoteLines', c); });
    DB.update('Quotes', 'quote_id', q.quote_id, { status: 'SUPERSEDED', updated_at: nowIso() });
    if (q.lead_id) DB.update('Leads', 'lead_id', q.lead_id, { quote_id: id, updated_at: nowIso() });
    log(user.user_id, 'quote.revise', q.quote_id, id);
    return { quote_id: id };
  });
}

function customerQuoteView(q, lines) {
  lines = lines || DB.all('QuoteLines').filter(function (l) { return l.quote_id === q.quote_id; })
    .sort(function (a, b) { return num(a.line_no) - num(b.line_no); });
  return {
    company: { name: setting('company_name'), address: setting('company_address'), phone: setting('company_phone'), tax_id: setting('company_tax_id') },
    quote_id: q.quote_id, rev: num(q.rev), date: String(q.approved_at || q.created_at || '').slice(0, 10), valid_until: q.valid_until,
    cust_name: q.cust_name, site: q.site, contact: q.contact, phone: q.phone, payment: q.payment,
    lines: lines.map(function (l) { return { description: l.description, qty: num(l.qty), unit: l.unit, price: num(l.price), amount: num(l.amount) }; }),
    subtotal: num(q.subtotal), discount: num(q.discount), net: num(q.net), vat: num(q.vat), total: num(q.total),
    vat_rate: num(setting('vat_rate')), scope_note: q.scope_note, exclusions: q.exclusions, status: q.status,
    customer_ack: q.customer_ack, customer_ack_at: q.customer_ack_at,
    can_ack: ['APPROVED', 'SENT'].indexOf(q.status) >= 0 && !(q.valid_until && q.valid_until < today())
  };
}

function findQuoteByToken(token) {
  token = String(token || '');
  if (!/^[a-f0-9]{32,64}$/.test(token)) return null;
  return DB.all('Quotes').filter(function (q) { return q.public_token === token; })[0] || null;
}

// ---------------------------------------------------------------- plan & jobs

function getPlan(user, p) {
  var date = cleanDate(p.date) || today();
  var jobs = DB.all('Jobs');
  var day = jobs.filter(function (j) { return j.plan_date === date && j.status !== 'CANCELLED'; })
    .sort(function (a, b) { return (a.team + a.seq + a.plan_time).localeCompare(b.team + b.seq + b.plan_time); }).map(jobCard);
  var waiting = jobs.filter(function (j) { return j.status === 'WAIT_PLAN'; }).map(jobCard);
  var teams = teamNames();
  var load = {};
  teams.forEach(function (t) { load[t] = 0; });
  day.forEach(function (j) { if (load[j.team] !== undefined) load[j.team] += num(j.team_days); });
  return { date: date, teams: teams, jobs: day, waiting: waiting, load: load,
    released: day.length > 0 && day.every(function (j) { return isTrue(j.released); }) };
}

function assignJob(user, p) {
  var team = clean(p.team, 40), date = cleanDate(p.date);
  return withLock(function () {
    var j = mustFind('Jobs', 'job_id', p.job_id);
    if (['DONE', 'CANCELLED'].indexOf(j.status) >= 0) throw new Error('งานนี้ปิดแล้ว');
    if (!team || !date) {
      DB.update('Jobs', 'job_id', j.job_id, { team: '', plan_date: '', plan_time: '', seq: '', released: '', status: 'WAIT_PLAN', updated_at: nowIso() });
    } else {
      if (teamNames().indexOf(team) < 0) throw new Error('ไม่รู้จักทีม ' + team);
      DB.update('Jobs', 'job_id', j.job_id, {
        team: team, plan_date: date, plan_time: clean(p.time, 10), seq: Math.max(1, num(p.seq) || 1),
        status: j.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PLANNED', released: '', updated_at: nowIso()
      });
    }
    log(user.user_id, 'job.assign', j.job_id, team + ' ' + date);
    return jobCard(DB.find('Jobs', 'job_id', j.job_id));
  });
}

/** ปล่อยแผนงานของวันที่เลือก → คืนข้อความสำหรับส่งกลุ่ม LINE ทีม */
function releasePlan(user, p) {
  var date = cleanDate(p.date) || addDays(today(), 1);
  return withLock(function () {
    var jobs = DB.all('Jobs').filter(function (j) { return j.plan_date === date && j.status !== 'CANCELLED'; });
    jobs.forEach(function (j) { DB.update('Jobs', 'job_id', j.job_id, { released: 'Y', updated_at: nowIso() }); });
    var lines = ['แผนงาน ' + thaiDate(date)];
    teamNames().forEach(function (t) {
      var tj = jobs.filter(function (j) { return j.team === t; }).sort(function (a, b) { return num(a.seq) - num(b.seq); });
      lines.push('');
      lines.push('【' + t + '】 ' + (tj.length ? tj.length + ' งาน' : 'ว่าง'));
      tj.forEach(function (j, i) {
        lines.push((i + 1) + ') ' + (j.plan_time ? j.plan_time + ' ' : '') + j.cust_name + ' — ' + j.job_type + ' (' + j.job_id + ')');
        if (j.site) lines.push('   ที่: ' + j.site);
        if (j.contact || j.phone) lines.push('   ติดต่อ: ' + [j.contact, j.phone].filter(String).join(' '));
      });
    });
    lines.push('');
    lines.push('เปิดแอปดูรายละเอียดและเช็กลิสต์: ' + webUrl());
    log(user.user_id, 'plan.release', date, jobs.length);
    return { date: date, count: jobs.length, text: lines.join('\n') };
  });
}

function createManualJob(user, p) {
  var cust = p.cust_id ? mustFind('Customers', 'cust_id', p.cust_id) : null;
  var name = cust ? cust.name : clean(p.cust_name, 150);
  if (!name) throw new Error('กรุณาระบุลูกค้า');
  var reason = clean(p.reason, 300);
  if (!reason) throw new Error('งานที่ไม่มีใบเสนอราคาต้องระบุเหตุผล (เช่น งานประกัน งานสัญญา)');
  return withLock(function () {
    var id = nextId('J');
    DB.insert('Jobs', {
      job_id: id, owner_id: cust ? cust.owner_id : user.user_id, cust_id: cust ? cust.cust_id : '', cust_name: name,
      site: clean(p.site || (cust && cust.address), 300), contact: clean(p.contact || (cust && cust.contact), 80),
      phone: clean(p.phone || (cust && cust.phone), 40), job_type: clean(p.job_type || 'อื่นๆ', 30),
      scope: clean(p.scope, 2000), payment: clean(p.payment || 'ตามสัญญา', 40), amount: Math.max(0, num(p.amount)),
      est_cost: 0, team_days: Math.max(0, num(p.team_days)) || 0.5, status: 'WAIT_PLAN', photos_before: '[]',
      photos_after: '[]', tech_note: 'เปิดงานโดย ' + user.name + ': ' + reason, contract_id: clean(p.contract_id, 30),
      case_id: clean(p.case_id, 30), lead_id: clean(p.lead_id, 30), created_at: nowIso(), updated_at: nowIso()
    });
    if (p.lead_id && DB.find('Leads', 'lead_id', p.lead_id)) {
      DB.update('Leads', 'lead_id', p.lead_id, { stage: 'SURVEY', next_action: 'รอผลสำรวจจากงาน ' + id, updated_at: nowIso() });
    }
    log(user.user_id, 'job.create', id, reason);
    return { job_id: id };
  });
}

function myJobs(user, p) {
  var t = today(), tm = addDays(t, 1);
  var rows = DB.all('Jobs').filter(function (j) {
    if (j.status === 'CANCELLED') return false;
    var mineTeam = user.role === 'LEAD' || user.role === 'TECH' ? j.team === user.team : true;
    if (!mineTeam) return false;
    if (j.status === 'IN_PROGRESS') return true;
    if (j.plan_date === t) return true;
    if (j.plan_date === tm && isTrue(j.released)) return true;
    return false;
  }).sort(function (a, b) { return (a.plan_date + pad(a.seq) + a.plan_time).localeCompare(b.plan_date + pad(b.seq) + b.plan_time); });
  return rows.map(function (j) { return hidePrice(user, jobCard(j)); });
}

function getJob(user, p) {
  var j = mustFind('Jobs', 'job_id', p.job_id);
  if ((user.role === 'LEAD' || user.role === 'TECH') && j.team !== user.team) throw new Error('ไม่ใช่งานของทีมคุณ');
  if (user.role === 'SALES' && j.owner_id !== user.user_id) throw new Error('ไม่ใช่งานของลูกค้าคุณ');
  var out = jobCard(j);
  out.scope = j.scope; out.contact = j.contact; out.phone = j.phone; out.tech_note = j.tech_note;
  out.checklist = parseJson(j.checklist, null) || (CHECKLISTS[j.job_type] || CHECKLISTS['ล้าง']).map(function (t) { return { t: t, d: false }; });
  out.measures = parseJson(j.measures, {});
  out.materials = parseJson(j.materials, []);
  out.extra_found = j.extra_found;
  out.photos_before = parseJson(j.photos_before, []);
  out.photos_after = parseJson(j.photos_after, []);
  out.signature = j.signature; out.signer = j.signer;
  out.started_at = j.started_at; out.finished_at = j.finished_at;
  out.bill_no = j.bill_no; out.bill_date = j.bill_date; out.due_date = j.due_date; out.paid_date = j.paid_date;
  out.assets = DB.all('Assets').filter(function (a) { return a.last_job_id === j.job_id || (j.cust_id && a.cust_id === j.cust_id); }).slice(0, 60);
  if (canSeeCost(user)) { out.actual_cost = j.actual_cost === '' ? '' : num(j.actual_cost); out.est_cost = num(j.est_cost); }
  return hidePrice(user, out);
}

function startJob(user, p) {
  return withLock(function () {
    var j = fieldJob(user, p.job_id);
    if (j.status === 'DONE') throw new Error('งานนี้ปิดแล้ว');
    DB.update('Jobs', 'job_id', j.job_id, { status: 'IN_PROGRESS', started_at: j.started_at || nowIso(), updated_at: nowIso() });
    log(user.user_id, 'job.start', j.job_id, '');
    return true;
  });
}

function saveJobProgress(user, p) {
  return withLock(function () {
    var j = fieldJob(user, p.job_id);
    if (j.status === 'DONE') throw new Error('งานนี้ปิดแล้ว แก้ไม่ได้');
    var patch = { updated_at: nowIso() };
    if (p.checklist) patch.checklist = JSON.stringify((p.checklist || []).slice(0, 40).map(function (c) {
      return { t: clean(c.t, 200), d: !!c.d, n: clean(c.n, 200) };
    }));
    if (p.measures) patch.measures = JSON.stringify(sanitizeObj(p.measures, 60));
    if (p.materials) patch.materials = JSON.stringify((p.materials || []).slice(0, 40).map(function (m) {
      return { name: clean(m.name, 120), qty: num(m.qty), unit: clean(m.unit, 20) };
    }));
    if (p.extra_found !== undefined) patch.extra_found = clean(p.extra_found, 1000);
    if (p.tech_note !== undefined) patch.tech_note = clean(p.tech_note, 1000);
    DB.update('Jobs', 'job_id', j.job_id, patch);
    return true;
  });
}

function uploadJobPhoto(user, p) {
  var kind = ['before', 'after', 'signature'].indexOf(p.kind) >= 0 ? p.kind : 'after';
  var j = fieldJob(user, p.job_id);
  var m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(p.data || ''));
  if (!m) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  if (m[2].length > 4 * 1024 * 1024) throw new Error('รูปใหญ่เกินไป');
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], j.job_id + '_' + kind + '_' + Date.now() + (m[1] === 'image/png' ? '.png' : '.jpg'));
  var file = DriveApp.createFile(blob);
  var id = file.getId();
  return withLock(function () {
    var fresh = DB.find('Jobs', 'job_id', j.job_id);
    var patch = { updated_at: nowIso() };
    if (kind === 'signature') {
      patch.signature = id;
      patch.signer = clean(p.signer, 80);
    } else {
      var field = kind === 'before' ? 'photos_before' : 'photos_after';
      var arr = parseJson(fresh[field], []);
      if (arr.length >= 20) throw new Error('รูปเกิน 20 รูปต่อหมวด');
      arr.push(id);
      patch[field] = JSON.stringify(arr);
    }
    DB.update('Jobs', 'job_id', j.job_id, patch);
    return { id: id };
  });
}

function getPhoto(user, p) {
  var id = String(p.id || '');
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw new Error('รหัสรูปไม่ถูกต้อง');
  // อนุญาตเฉพาะรูปที่อยู่ในระบบ (ผูกกับงาน/Lead/เคส)
  var owner = DB.all('Jobs').filter(function (j) {
    return j.signature === id || String(j.photos_before).indexOf(id) >= 0 || String(j.photos_after).indexOf(id) >= 0;
  })[0];
  if (!owner) {
    var inLead = DB.all('Leads').some(function (l) { return String(l.photos).indexOf(id) >= 0; });
    var inCase = DB.all('Cases').some(function (c) { return String(c.photos).indexOf(id) >= 0; });
    if (!inLead && !inCase) throw new Error('ไม่พบรูป');
  } else if ((user.role === 'LEAD' || user.role === 'TECH') && owner.team !== user.team) {
    throw new Error('ไม่ใช่งานของทีมคุณ');
  }
  var blob = DriveApp.getFileById(id).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/** ปิดงาน: ต้องมีรูปหลังงานและลายเซ็น/ชื่อผู้รับงาน → เข้าคิว "รอส่งบัญชี" อัตโนมัติ */
function closeJob(user, p) {
  return withLock(function () {
    var j = fieldJob(user, p.job_id);
    if (j.status === 'DONE') throw new Error('งานนี้ปิดแล้ว');
    var after = parseJson(j.photos_after, []);
    if (!after.length) throw new Error('ต้องมีรูปหลังทำงานอย่างน้อย 1 รูป');
    if (!j.signature && !clean(p.no_sign_reason, 200)) throw new Error('ต้องมีลายเซ็นลูกค้า หรือระบุเหตุผลที่ไม่มี');
    var cl = parseJson(j.checklist, null) || (CHECKLISTS[j.job_type] || CHECKLISTS['ล้าง']).map(function (t) { return { t: t, d: false }; });
    var undone = cl.filter(function (c) { return !c.d && !c.n; });
    if (undone.length) throw new Error('เช็กลิสต์ยังไม่ครบ ' + undone.length + ' ข้อ (ติ๊ก หรือใส่หมายเหตุ)');
    var noBill = num(j.amount) <= 0 && (j.case_id || j.contract_id || j.job_type === 'สำรวจ');
    var patch = {
      status: 'DONE', finished_at: nowIso(), bill_status: noBill ? 'NOBILL' : 'WAIT_SEND',
      next_service: cleanDate(p.next_service), updated_at: nowIso()
    };
    if (!j.signature) patch.signer = 'ไม่มีลายเซ็น: ' + clean(p.no_sign_reason, 200);
    DB.update('Jobs', 'job_id', j.job_id, patch);
    // งานต่อยอดที่ช่างพบ → Lead ให้เซลล์เจ้าของบัญชี
    if (clean(j.extra_found, 1000)) {
      DB.insert('Leads', {
        lead_id: nextId('L'), created_at: nowIso(), owner_id: j.owner_id || '', cust_id: j.cust_id, cust_name: j.cust_name,
        site: j.site, contact: j.contact, phone: j.phone, source: 'ช่างพบหน้างาน', job_type: 'ซ่อม', lane: 'S',
        units: 0, est_value: 0, answers: JSON.stringify({ symptom: clean(j.extra_found, 500) }), photos: j.photos_after,
        stage: 'NEW', next_action: 'โทรเสนองานที่ช่างพบจากงาน ' + j.job_id, next_date: addDays(today(), 1),
        note: 'จากงาน ' + j.job_id, updated_at: nowIso()
      });
    }
    // อัปเดตสัญญา/ทะเบียนเครื่อง
    DB.all('Assets').filter(function (a) { return a.last_job_id === j.job_id; }).forEach(function (a) {
      DB.update('Assets', 'asset_id', a.asset_id, { last_service: today() });
    });
    log(user.user_id, 'job.close', j.job_id, patch.bill_status);
    return jobCard(DB.find('Jobs', 'job_id', j.job_id));
  });
}

function cancelJob(user, p) {
  var reason = clean(p.reason, 300);
  if (!reason) throw new Error('กรุณาระบุเหตุผล');
  return withLock(function () {
    var j = mustFind('Jobs', 'job_id', p.job_id);
    if (j.status === 'DONE') throw new Error('งานปิดแล้ว ยกเลิกไม่ได้');
    DB.update('Jobs', 'job_id', j.job_id, { status: 'CANCELLED', tech_note: (j.tech_note ? j.tech_note + '\n' : '') + 'ยกเลิก: ' + reason, updated_at: nowIso() });
    log(user.user_id, 'job.cancel', j.job_id, reason);
    return true;
  });
}

function setJobCost(user, p) {
  return withLock(function () {
    var j = mustFind('Jobs', 'job_id', p.job_id);
    DB.update('Jobs', 'job_id', j.job_id, { actual_cost: Math.max(0, num(p.actual_cost)), updated_at: nowIso() });
    log(user.user_id, 'job.cost', j.job_id, p.actual_cost);
    return jobCard(DB.find('Jobs', 'job_id', j.job_id));
  });
}

function listJobs(user, p) {
  var rows = DB.all('Jobs');
  if (p.status) rows = rows.filter(function (j) { return String(p.status).split(',').indexOf(j.status) >= 0; });
  var s = String(p.q || '').toLowerCase();
  if (s) rows = rows.filter(function (j) { return (j.job_id + ' ' + j.cust_name + ' ' + j.site).toLowerCase().indexOf(s) >= 0; });
  return rows.slice().reverse().slice(0, 200).map(jobCard);
}

// ---------------------------------------------------------------- billing tracker

function listBilling(user, p) {
  var st = String(p.status || 'WAIT_SEND');
  var t = today();
  return DB.all('Jobs').filter(function (j) { return j.bill_status === st; }).map(function (j) {
    var c = jobCard(j);
    var since = st === 'WAIT_SEND' ? j.finished_at : st === 'SENT' ? j.sent_at : st === 'BILLED' ? (j.due_date || j.bill_date) : j.paid_date;
    c.age = since ? daysBetween(String(since).slice(0, 10), t) : '';
    c.overdue = st === 'BILLED' && j.due_date && j.due_date < t ? daysBetween(j.due_date, t) : 0;
    return c;
  }).sort(function (a, b) { return num(b.age) - num(a.age); });
}

function billingSent(user, p) {
  var ids = (p.job_ids || []).slice(0, 100);
  if (!ids.length) throw new Error('ยังไม่ได้เลือกงาน');
  return withLock(function () {
    var lines = ['ส่งงานให้ฝ่ายบัญชีวางบิล — ' + thaiDate(today()), ''];
    var total = 0;
    ids.forEach(function (id, i) {
      var j = mustFind('Jobs', 'job_id', id);
      if (j.bill_status !== 'WAIT_SEND') throw new Error(id + ' ไม่ได้อยู่ในคิวรอส่งบัญชี');
      DB.update('Jobs', 'job_id', id, { bill_status: 'SENT', sent_at: nowIso(), updated_at: nowIso() });
      total += num(j.amount);
      lines.push((i + 1) + ') ' + id + ' | ' + j.cust_name + ' | ' + j.job_type + ' | ยอดก่อน VAT ' + fmt(num(j.amount)) +
        ' | ' + j.payment + (j.quote_id ? ' | ใบเสนอราคา ' + j.quote_id : '') + ' | เสร็จ ' + String(j.finished_at).slice(0, 10));
    });
    lines.push('');
    lines.push('รวม ' + ids.length + ' งาน ยอดก่อน VAT ' + fmt(total) + ' บาท');
    lines.push('เอกสารแนบ: ใบเสนอราคา/PO ใบงานที่ลูกค้าเซ็น รูปก่อน-หลัง (เปิดดูได้จากระบบ)');
    log(user.user_id, 'billing.sent', ids.join(','), total);
    return { text: lines.join('\n'), count: ids.length, total: total };
  });
}

function billingBilled(user, p) {
  var billNo = clean(p.bill_no, 60);
  if (!billNo) throw new Error('กรุณาใส่เลขบิลจากฝ่ายบัญชี');
  return withLock(function () {
    var j = mustFind('Jobs', 'job_id', p.job_id);
    if (['SENT', 'WAIT_SEND'].indexOf(j.bill_status) < 0) throw new Error('สถานะไม่ถูกต้อง');
    var billDate = cleanDate(p.bill_date) || today();
    var due = cleanDate(p.due_date) || addDays(billDate, creditDaysOf(j));
    DB.update('Jobs', 'job_id', j.job_id, { bill_status: 'BILLED', bill_no: billNo, bill_date: billDate, due_date: due,
      sent_at: j.sent_at || nowIso(), updated_at: nowIso() });
    log(user.user_id, 'billing.billed', j.job_id, billNo);
    return jobCard(DB.find('Jobs', 'job_id', j.job_id));
  });
}

function billingPaid(user, p) {
  return withLock(function () {
    var j = mustFind('Jobs', 'job_id', p.job_id);
    if (j.bill_status !== 'BILLED') throw new Error('ต้องบันทึกเลขบิลก่อน');
    DB.update('Jobs', 'job_id', j.job_id, { bill_status: 'PAID', paid_date: cleanDate(p.paid_date) || today(), updated_at: nowIso() });
    log(user.user_id, 'billing.paid', j.job_id, '');
    return jobCard(DB.find('Jobs', 'job_id', j.job_id));
  });
}

function billingNoBill(user, p) {
  var reason = clean(p.reason, 300);
  if (!reason) throw new Error('กรุณาระบุเหตุผลที่ไม่เรียกเก็บ');
  return withLock(function () {
    var j = mustFind('Jobs', 'job_id', p.job_id);
    DB.update('Jobs', 'job_id', j.job_id, { bill_status: 'NOBILL', tech_note: (j.tech_note ? j.tech_note + '\n' : '') + 'ไม่เรียกเก็บ: ' + reason + ' (' + user.name + ')', updated_at: nowIso() });
    log(user.user_id, 'billing.nobill', j.job_id, reason);
    return true;
  });
}

// ---------------------------------------------------------------- assets

function listAssets(user, p) {
  var rows = DB.all('Assets');
  if (p.cust_id) rows = rows.filter(function (a) { return a.cust_id === p.cust_id; });
  if (p.job_id) rows = rows.filter(function (a) { return a.last_job_id === p.job_id; });
  return rows.slice(0, 200);
}

function saveAsset(user, p) {
  var rec = {
    location: clean(p.location, 120), brand: clean(p.brand, 60), model: clean(p.model, 80), serial: clean(p.serial, 80),
    btu: clean(p.btu, 20), ac_type: clean(p.ac_type, 40), installed_at: cleanDate(p.installed_at),
    warranty_until: cleanDate(p.warranty_until), notes: clean(p.notes, 300)
  };
  return withLock(function () {
    if (p.asset_id) {
      mustFind('Assets', 'asset_id', p.asset_id);
      DB.update('Assets', 'asset_id', p.asset_id, rec);
      return DB.find('Assets', 'asset_id', p.asset_id);
    }
    var j = p.job_id ? fieldJob(user, p.job_id) : null;
    var cust = j ? { cust_id: j.cust_id, name: j.cust_name } : mustFind('Customers', 'cust_id', p.cust_id);
    rec.asset_id = nextId('A');
    rec.cust_id = cust.cust_id; rec.cust_name = cust.name; rec.site = j ? j.site : clean(p.site, 300);
    rec.last_job_id = j ? j.job_id : ''; rec.last_service = j ? today() : ''; rec.created_at = nowIso();
    DB.insert('Assets', rec);
    log(user.user_id, 'asset.create', rec.asset_id, rec.model);
    return rec;
  });
}

// ---------------------------------------------------------------- warranty cases

var CASE_CLASSES = ['ฝีมือ', 'อะไหล่', 'ผู้ผลิต', 'การใช้งาน', 'บุคคลที่สาม', 'ระบบเดิม', 'ไม่เกี่ยวข้อง', 'ยังไม่ทราบ'];

function listCases(user, p) {
  var rows = DB.all('Cases');
  if (p.open) rows = rows.filter(function (c) { return c.status !== 'CLOSED'; });
  return rows.slice().reverse().slice(0, 200).map(caseCard);
}

function openCase(user, p) {
  var symptom = clean(p.symptom, 1000);
  if (!symptom) throw new Error('กรุณาระบุอาการ');
  return withLock(function () {
    var job = p.job_id ? DB.find('Jobs', 'job_id', p.job_id) : null;
    var cust = p.cust_id ? DB.find('Customers', 'cust_id', p.cust_id) : null;
    if (!job && !cust) throw new Error('กรุณาเลือกงานเดิมหรือลูกค้า');
    var rec = {
      case_id: nextId('W'), created_at: nowIso(), created_by: user.user_id, cust_id: job ? job.cust_id : cust.cust_id,
      cust_name: job ? job.cust_name : cust.name, job_id: job ? job.job_id : '', asset_id: clean(p.asset_id, 30),
      symptom: symptom, photos: '[]', class: '', decision: '', status: 'OPEN', fix_job_id: '', cost: 0, root_cause: ''
    };
    DB.insert('Cases', rec);
    log(user.user_id, 'case.open', rec.case_id, symptom.slice(0, 60));
    return caseCard(rec);
  });
}

function decideCase(user, p) {
  var cls = String(p.class || ''), decision = String(p.decision || '');
  if (CASE_CLASSES.indexOf(cls) < 0) throw new Error('กรุณาเลือกประเภทสาเหตุ');
  if (['รับประกัน', 'คิดเงิน', 'ปฏิเสธ'].indexOf(decision) < 0) throw new Error('กรุณาเลือกคำตัดสิน');
  return withLock(function () {
    var c = mustFind('Cases', 'case_id', p.case_id);
    var patch = { class: cls, decision: decision, status: 'DECIDED', decided_by: user.user_id, root_cause: clean(p.root_cause, 500) };
    var out = {};
    if (decision !== 'ปฏิเสธ' && isTrue(p.create_job)) {
      var job = DB.find('Jobs', 'job_id', c.job_id) || {};
      var id = nextId('J');
      DB.insert('Jobs', {
        job_id: id, owner_id: job.owner_id || '', cust_id: c.cust_id, cust_name: c.cust_name, site: job.site || '',
        contact: job.contact || '', phone: job.phone || '', job_type: 'งานแก้/ประกัน',
        scope: 'เคส ' + c.case_id + ': ' + c.symptom, payment: decision === 'รับประกัน' ? 'ไม่เก็บเงิน (ประกัน)' : 'ตามใบเสนอราคา',
        amount: decision === 'รับประกัน' ? 0 : Math.max(0, num(p.amount)), est_cost: 0, team_days: 0.5, status: 'WAIT_PLAN',
        photos_before: '[]', photos_after: '[]', case_id: c.case_id, created_at: nowIso(), updated_at: nowIso()
      });
      patch.fix_job_id = id;
      out.job_id = id;
    }
    DB.update('Cases', 'case_id', c.case_id, patch);
    log(user.user_id, 'case.decide', c.case_id, decision);
    out.case = caseCard(DB.find('Cases', 'case_id', c.case_id));
    return out;
  });
}

function closeCase(user, p) {
  return withLock(function () {
    var c = mustFind('Cases', 'case_id', p.case_id);
    DB.update('Cases', 'case_id', c.case_id, { status: 'CLOSED', cost: Math.max(0, num(p.cost)), root_cause: clean(p.root_cause || c.root_cause, 500), closed_at: nowIso() });
    log(user.user_id, 'case.close', c.case_id, p.cost);
    return caseCard(DB.find('Cases', 'case_id', c.case_id));
  });
}

// ---------------------------------------------------------------- contracts

function listContracts(user, p) {
  var rows = DB.all('Contracts');
  if (user.role === 'SALES') rows = rows.filter(function (c) { return c.owner_id === user.user_id; });
  return rows.slice().reverse().map(contractCard);
}

function saveContract(user, p) {
  var cust = mustFind('Customers', 'cust_id', p.cust_id);
  var start = cleanDate(p.start_date), end = cleanDate(p.end_date);
  if (!start || !end || end < start) throw new Error('วันที่เริ่ม/สิ้นสุดไม่ถูกต้อง');
  var visits = Math.max(1, num(p.visits));
  var rec = {
    cust_id: cust.cust_id, cust_name: cust.name, name: clean(p.name || ('สัญญาล้างแอร์ ' + cust.name), 150),
    start_date: start, end_date: end, value: Math.max(0, num(p.value)), units: Math.max(0, num(p.units)), visits: visits,
    interval_months: Math.max(1, num(p.interval_months) || Math.round(12 / visits)),
    next_visit: cleanDate(p.next_visit) || start, bill_cycle: clean(p.bill_cycle || 'ต่อรอบ', 20),
    next_bill: cleanDate(p.next_bill) || cleanDate(p.next_visit) || start, status: p.status === 'ENDED' ? 'ENDED' : 'ACTIVE',
    scope: clean(p.scope, 1000), notes: clean(p.notes, 500)
  };
  return withLock(function () {
    if (p.contract_id) {
      var c = mustFind('Contracts', 'contract_id', p.contract_id);
      if (user.role === 'SALES' && c.owner_id !== user.user_id) throw new Error('ไม่ใช่สัญญาของคุณ');
      DB.update('Contracts', 'contract_id', p.contract_id, rec);
      return contractCard(DB.find('Contracts', 'contract_id', p.contract_id));
    }
    rec.contract_id = nextId('K'); rec.owner_id = user.role === 'SALES' ? user.user_id : (cust.owner_id || user.user_id);
    rec.created_at = nowIso();
    DB.insert('Contracts', rec);
    log(user.user_id, 'contract.create', rec.contract_id, rec.value);
    return contractCard(rec);
  });
}

/** สร้างงานล้างจากสัญญาที่ถึงรอบภายใน 14 วัน (ไม่สร้างซ้ำถ้ามีงานค้างอยู่) */
function generateContractVisits(user, p) {
  var horizon = addDays(today(), 14);
  return withLock(function () {
    var jobs = DB.all('Jobs');
    var created = [];
    DB.all('Contracts').forEach(function (c) {
      if (c.status !== 'ACTIVE' || !c.next_visit || c.next_visit > horizon || c.next_visit > c.end_date) return;
      var open = jobs.some(function (j) { return j.contract_id === c.contract_id && ['WAIT_PLAN', 'PLANNED', 'IN_PROGRESS'].indexOf(j.status) >= 0; });
      if (open) return;
      var cust = DB.find('Customers', 'cust_id', c.cust_id) || {};
      var perVisit = c.bill_cycle === 'ต่อรอบ' ? round2(num(c.value) / Math.max(1, num(c.visits))) : 0;
      var id = nextId('J');
      DB.insert('Jobs', {
        job_id: id, owner_id: c.owner_id, cust_id: c.cust_id, cust_name: c.cust_name, site: cust.address || '',
        contact: cust.contact || '', phone: cust.phone || '', job_type: 'สัญญา/PM',
        scope: 'รอบบริการตามสัญญา ' + c.contract_id + ' (' + num(c.units) + ' เครื่อง)\n' + (c.scope || ''),
        payment: c.bill_cycle === 'ต่อรอบ' ? 'ตามสัญญา (วางบิลต่อรอบ)' : 'ตามสัญญา (' + c.bill_cycle + ')', amount: perVisit,
        est_cost: 0, team_days: round4(num(c.units) / 22) || 0.5, status: 'WAIT_PLAN', photos_before: '[]', photos_after: '[]',
        contract_id: c.contract_id, created_at: nowIso(), updated_at: nowIso()
      });
      DB.update('Contracts', 'contract_id', c.contract_id, { next_visit: addMonths(c.next_visit, num(c.interval_months) || 6) });
      created.push(id);
    });
    log(user.user_id, 'contract.generate', created.join(','), created.length);
    return { created: created.length, job_ids: created };
  });
}

function contractBilled(user, p) {
  return withLock(function () {
    var c = mustFind('Contracts', 'contract_id', p.contract_id);
    var step = c.bill_cycle === 'รายเดือน' ? 1 : c.bill_cycle === 'รายปี' ? 12 : (num(c.interval_months) || 6);
    DB.update('Contracts', 'contract_id', c.contract_id, { next_bill: addMonths(c.next_bill || today(), step) });
    log(user.user_id, 'contract.billed', c.contract_id, clean(p.bill_no, 60));
    return contractCard(DB.find('Contracts', 'contract_id', c.contract_id));
  });
}

// ---------------------------------------------------------------- dashboard

function dashboard(user, p) {
  var month = /^\d{4}-\d{2}$/.test(String(p.month || '')) ? p.month : today().slice(0, 7);
  var t = today();
  var jobs = DB.all('Jobs');
  var done = jobs.filter(function (j) { return j.status === 'DONE' && String(j.finished_at).slice(0, 7) === month; });
  var revenue = sum(done, 'amount');
  var tdDone = done.reduce(function (s, j) { return s + num(j.team_days); }, 0);
  var cost = done.reduce(function (s, j) { return s + (j.actual_cost !== '' ? num(j.actual_cost) : num(j.est_cost)); }, 0);
  var rate = num(setting('comm_rate')) + num(setting('warranty_rate'));
  var contrib = revenue - cost - revenue * rate;
  var planned = jobs.filter(function (j) { return j.status !== 'CANCELLED' && String(j.plan_date).slice(0, 7) === month; });
  var tdPlanned = planned.reduce(function (s, j) { return s + num(j.team_days); }, 0);
  var capacity = num(setting('teams')) * num(setting('workdays'));
  var quotes = DB.all('Quotes');
  var openQ = quotes.filter(function (q) { return ['PENDING', 'APPROVED', 'SENT', 'ACCEPTED'].indexOf(q.status) >= 0; });
  var pipeline = sum(openQ, 'net') + DB.all('Leads').filter(function (l) { return ['NEW', 'QUOTE', 'SURVEY'].indexOf(l.stage) >= 0; })
    .reduce(function (s, l) { return s + num(l.est_value); }, 0);
  var waitSend = jobs.filter(function (j) { return j.bill_status === 'WAIT_SEND'; });
  var oldestWait = waitSend.reduce(function (m, j) { return Math.max(m, daysBetween(String(j.finished_at).slice(0, 10), t)); }, 0);
  var overdue = jobs.filter(function (j) { return j.bill_status === 'BILLED' && j.due_date && j.due_date < t; });
  var casesMonth = DB.all('Cases').filter(function (c) { return String(c.created_at).slice(0, 7) === month; }).length;
  var contracts = DB.all('Contracts').filter(function (c) { return c.status === 'ACTIVE'; });
  var byType = {};
  done.forEach(function (j) {
    var k = j.job_type || 'อื่นๆ';
    byType[k] = byType[k] || { type: k, jobs: 0, revenue: 0, team_days: 0, contrib: 0 };
    var c = j.actual_cost !== '' ? num(j.actual_cost) : num(j.est_cost);
    byType[k].jobs++; byType[k].revenue += num(j.amount); byType[k].team_days += num(j.team_days);
    byType[k].contrib += num(j.amount) - c - num(j.amount) * rate;
  });
  var types = Object.keys(byType).map(function (k) {
    var o = byType[k]; o.contrib_td = o.team_days ? round2(o.contrib / o.team_days) : null; o.revenue = round2(o.revenue);
    o.contrib = round2(o.contrib); o.team_days = round4(o.team_days); return o;
  }).sort(function (a, b) { return b.revenue - a.revenue; });
  var sales = DB.all('Users').filter(function (u) { return u.role === 'SALES' && isTrue(u.active); }).map(function (u) {
    var m = salesMonth(u.user_id, month); m.name = u.name; m.target = num(u.target); return m;
  });
  return {
    month: month,
    revenue: round2(revenue), target: num(setting('monthly_target')),
    contrib_td: tdDone ? round2(contrib / tdDone) : null, fixed_per_td: num(setting('fixed_per_td')), target_per_td: num(setting('target_per_td')),
    team_days_done: round4(tdDone), team_days_planned: round4(tdPlanned), capacity: capacity,
    pipeline: round2(pipeline), pipeline_x: num(setting('monthly_target')) ? round2(pipeline / num(setting('monthly_target'))) : null,
    wait_send: waitSend.length, wait_send_amount: round2(sum(waitSend, 'amount')), oldest_wait_days: oldestWait,
    overdue: overdue.length, overdue_amount: round2(sum(overdue, 'amount')),
    rework_pct: done.length ? round2(casesMonth / done.length * 100) : 0,
    contracts: contracts.length, contracts_value: round2(sum(contracts, 'value')),
    jobs_done: done.length, by_type: types, sales: sales, alerts: alerts()
  };
}

function alerts() {
  var t = today(), out = [];
  var jobs = DB.all('Jobs');
  var waitDays = num(setting('wait_send_alert_days')) || 1;
  jobs.forEach(function (j) {
    if (j.bill_status === 'WAIT_SEND') {
      var d = daysBetween(String(j.finished_at).slice(0, 10), t);
      if (d > waitDays) out.push({ level: d > 3 ? 'red' : 'amber', text: 'งานเสร็จแต่ยังไม่ส่งบัญชี ' + d + ' วัน: ' + j.job_id + ' ' + j.cust_name, ref: j.job_id });
    }
    if (j.bill_status === 'SENT' && j.sent_at && daysBetween(String(j.sent_at).slice(0, 10), t) > 3) {
      out.push({ level: 'amber', text: 'ส่งบัญชีแล้วแต่ยังไม่ได้เลขบิล: ' + j.job_id + ' ' + j.cust_name, ref: j.job_id });
    }
    if (j.bill_status === 'BILLED' && j.due_date && j.due_date < t) {
      var od = daysBetween(j.due_date, t);
      out.push({ level: od > num(setting('overdue_hold_days')) ? 'red' : 'amber', text: 'เกินกำหนดชำระ ' + od + ' วัน: ' + j.job_id + ' ' + j.cust_name, ref: j.job_id });
    }
    if (j.status === 'PLANNED' && j.plan_date && j.plan_date < t) out.push({ level: 'amber', text: 'งานเลยวันนัดแต่ยังไม่เริ่ม: ' + j.job_id + ' ' + j.cust_name, ref: j.job_id });
  });
  var tm = addDays(t, 1);
  var tomorrow = jobs.filter(function (j) { return j.plan_date === tm && j.status !== 'CANCELLED'; });
  if (tomorrow.length && !tomorrow.every(function (j) { return isTrue(j.released); })) out.push({ level: 'amber', text: 'ยังไม่ปล่อยแผนงานพรุ่งนี้ให้ทีมช่าง', ref: 'plan' });
  var pending = DB.all('Quotes').filter(function (q) { return q.status === 'PENDING'; });
  if (pending.length) out.push({ level: 'amber', text: 'ใบเสนอราคารออนุมัติ ' + pending.length + ' ใบ', ref: 'approvals' });
  DB.all('Contracts').forEach(function (c) {
    if (c.status === 'ACTIVE' && c.next_bill && c.next_bill <= t) out.push({ level: 'amber', text: 'สัญญาถึงรอบวางบิล: ' + c.contract_id + ' ' + c.cust_name, ref: c.contract_id });
    if (c.status === 'ACTIVE' && c.end_date && c.end_date >= t && daysBetween(t, c.end_date) <= 60) out.push({ level: 'amber', text: 'สัญญาใกล้หมด (' + c.end_date + ') เริ่มต่ออายุ: ' + c.cust_name, ref: c.contract_id });
  });
  return out.sort(function (a, b) { return (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1); }).slice(0, 60);
}

function salesMonth(userId, month) {
  month = month || today().slice(0, 7);
  var done = DB.all('Jobs').filter(function (j) { return j.owner_id === userId && j.status === 'DONE' && String(j.finished_at).slice(0, 7) === month; });
  var won = DB.all('Quotes').filter(function (q) { return q.owner_id === userId && q.status === 'WON' && String(q.updated_at).slice(0, 7) === month; });
  var open = DB.all('Quotes').filter(function (q) { return q.owner_id === userId && ['PENDING', 'APPROVED', 'SENT', 'ACCEPTED'].indexOf(q.status) >= 0; });
  return { revenue: round2(sum(done, 'amount')), won_value: round2(sum(won, 'net')), won: won.length, open_value: round2(sum(open, 'net')), open: open.length };
}

// ---------------------------------------------------------------- users & settings

function listUsers(user) {
  return DB.all('Users').map(function (u) {
    var o = publicUser(u); o.active = u.active; o.phone = u.phone; o.last_login = u.last_login;
    return o;
  });
}

function saveUser(user, p) {
  var role = String(p.role || '');
  if (!ROLES[role]) throw new Error('บทบาทไม่ถูกต้อง');
  var rec = { name: clean(p.name, 80), role: role, team: clean(p.team, 40), phone: normPhone(p.phone), target: Math.max(0, num(p.target)), active: p.active === 'N' ? 'N' : 'Y' };
  if (!rec.name) throw new Error('กรุณาระบุชื่อ');
  if (!rec.phone && rec.active === 'Y') throw new Error('กรุณาระบุเบอร์มือถือ 10 หลัก (ใช้รับรหัสเข้าระบบ)');
  if ((role === 'LEAD' || role === 'TECH') && teamNames().indexOf(rec.team) < 0) throw new Error('ช่างต้องสังกัดทีม: ' + teamNames().join(', '));
  if (user.role !== 'CEO' && MGMT.indexOf(role) >= 0) throw new Error('เพิ่มหรือแก้บัญชีระดับผู้บริหารได้เฉพาะ CEO');
  return withLock(function () {
    var dup = rec.phone ? DB.all('Users').filter(function (u) { return isTrue(u.active) && normPhone(u.phone) === rec.phone && u.user_id !== p.user_id; })[0] : null;
    if (dup && rec.active === 'Y') throw new Error('เบอร์นี้ใช้กับบัญชี ' + dup.name + ' แล้ว');
    if (p.user_id) {
      var old = mustFind('Users', 'user_id', p.user_id);
      if (user.role !== 'CEO' && MGMT.indexOf(old.role) >= 0) throw new Error('แก้บัญชีระดับผู้บริหารได้เฉพาะ CEO');
      if (p.user_id === user.user_id && rec.role !== user.role) throw new Error('เปลี่ยนบทบาทตัวเองไม่ได้');
      if (p.user_id === user.user_id && rec.active !== 'Y') throw new Error('ปิดบัญชีตัวเองไม่ได้');
      // เปลี่ยนเบอร์หรือปิดบัญชี = ตัดการเข้าระบบทุกเครื่องของคนนั้น
      if (normPhone(old.phone) !== rec.phone || rec.active !== old.active) rec.session_ver = num(old.session_ver) + 1;
      DB.update('Users', 'user_id', p.user_id, rec);
      log(user.user_id, 'user.update', p.user_id, role);
      return publicUser(DB.find('Users', 'user_id', p.user_id));
    }
    rec.user_id = nextId('U');
    rec.session_ver = 1; rec.recovery_hash = ''; rec.last_login = ''; rec.pin_hash = ''; rec.must_change = 'Y'; rec.created_at = nowIso();
    DB.insert('Users', rec);
    log(user.user_id, 'user.create', rec.user_id, role);
    return publicUser(rec);
  });
}

/** รหัสเข้าใช้ชั่วคราว 6 หลัก (ใช้ครั้งเดียว ภายใน 12 ชั่วโมง) — ใช้วันที่ SMS ไม่เข้า หรือก่อนเชื่อมต่อ SMS */
function issueTempCode(user, p) {
  return withLock(function () {
    var u = mustFind('Users', 'user_id', p.user_id);
    if (!isTrue(u.active)) throw new Error('บัญชีนี้ถูกปิดอยู่');
    if (!normPhone(u.phone)) throw new Error('ใส่เบอร์มือถือของ ' + u.name + ' ก่อน');
    if (user.role !== 'CEO' && MGMT.indexOf(u.role) >= 0 && u.user_id !== user.user_id) throw new Error('ออกรหัสให้ผู้บริหารได้เฉพาะ CEO');
    var code = randomDigits(6), now = Date.now();
    DB.insert('Otps', {
      otp_id: 'T' + now.toString(36) + randomRef(), phone: normPhone(u.phone), user_id: u.user_id, kind: 'temp', ref: '',
      code_hash: hashCode(normPhone(u.phone), code), expires_ms: now + TEMP_TTL_MS, attempts: 0, used: '', created_ms: now,
      created_by: user.user_id, created_at: nowIso()
    });
    log(user.user_id, 'user.tempCode', u.user_id, '');
    return { user_id: u.user_id, name: u.name, phone: normPhone(u.phone), code: code, hours: TEMP_TTL_MS / 3600000 };
  });
}

/** ตัดการเข้าระบบทุกเครื่องของผู้ใช้ (มือถือหาย ลาออก) */
function revokeUser(user, p) {
  return withLock(function () {
    var u = mustFind('Users', 'user_id', p.user_id);
    if (user.role !== 'CEO' && MGMT.indexOf(u.role) >= 0) throw new Error('ตัดการเข้าระบบของผู้บริหารได้เฉพาะ CEO');
    DB.update('Users', 'user_id', u.user_id, { session_ver: num(u.session_ver) + 1 });
    log(user.user_id, 'user.revoke', u.user_id, '');
    return { user_id: u.user_id, self: u.user_id === user.user_id };
  });
}

function saveSettings(user, p) {
  var allowed = DEFAULT_SETTINGS.map(function (s) { return s[0]; });
  return withLock(function () {
    Object.keys(p || {}).forEach(function (k) {
      if (allowed.indexOf(k) < 0) return;
      var v = typeof p[k] === 'number' ? p[k] : clean(p[k], 300);
      var row = DB.find('Settings', 'key', k);
      if (row) DB.update('Settings', 'key', k, { value: v }); else DB.insert('Settings', { key: k, value: v, note: '' });
    });
    DB.reset();
    log(user.user_id, 'settings.save', '', Object.keys(p || {}).join(','));
    return publicSettings(user);
  });
}

// ============================================================ cards (ข้อมูลย่อสำหรับหน้าจอ)

function leadCard(l) {
  return { lead_id: l.lead_id, created_at: String(l.created_at).slice(0, 10), owner_id: l.owner_id, cust_id: l.cust_id,
    cust_name: l.cust_name, site: l.site, job_type: l.job_type, lane: l.lane, units: num(l.units), est_value: num(l.est_value),
    stage: l.stage, next_action: l.next_action, next_date: l.next_date, quote_id: l.quote_id, job_id: l.job_id,
    contact: l.contact, phone: l.phone };
}

function quoteCard(q, withCost) {
  var o = { quote_id: q.quote_id, rev: num(q.rev), lead_id: q.lead_id, owner_id: q.owner_id, cust_id: q.cust_id, cust_name: q.cust_name,
    cust_type: q.cust_type, site: q.site, job_type: q.job_type, created_by: q.created_by, created_at: String(q.created_at || '').slice(0, 10),
    payment: q.payment, price_level: q.price_level, subtotal: num(q.subtotal), discount: num(q.discount), net: num(q.net), vat: num(q.vat),
    total: num(q.total), team_days: num(q.team_days), gate_minbill: q.gate_minbill, gate_td: q.gate_td, approval_level: q.approval_level,
    status: q.status, approver_id: q.approver_id, approve_note: q.approve_note, valid_until: q.valid_until, job_id: q.job_id,
    customer_ack: q.customer_ack };
  if (withCost) { o.est_cost = num(q.est_cost); o.contrib = num(q.contrib); o.contrib_td = q.contrib_td === '' ? null : num(q.contrib_td); }
  return o;
}

function jobCard(j) {
  return { job_id: j.job_id, quote_id: j.quote_id, owner_id: j.owner_id, cust_id: j.cust_id, cust_name: j.cust_name, site: j.site,
    contact: j.contact, phone: j.phone, job_type: j.job_type, payment: j.payment, amount: num(j.amount), team_days: num(j.team_days),
    status: j.status, team: j.team, plan_date: j.plan_date, plan_time: j.plan_time, seq: j.seq === '' ? '' : num(j.seq),
    released: isTrue(j.released), bill_status: j.bill_status, bill_no: j.bill_no, due_date: j.due_date,
    finished_at: String(j.finished_at || '').slice(0, 10), contract_id: j.contract_id, case_id: j.case_id,
    scope_short: String(j.scope || '').split('\n')[0].slice(0, 120) };
}

function caseCard(c) {
  return { case_id: c.case_id, created_at: String(c.created_at).slice(0, 10), cust_id: c.cust_id, cust_name: c.cust_name, job_id: c.job_id,
    asset_id: c.asset_id, symptom: c.symptom, class: c.class, decision: c.decision, status: c.status, fix_job_id: c.fix_job_id,
    cost: num(c.cost), root_cause: c.root_cause };
}

function contractCard(c) {
  return { contract_id: c.contract_id, cust_id: c.cust_id, cust_name: c.cust_name, name: c.name, start_date: c.start_date, end_date: c.end_date,
    value: num(c.value), units: num(c.units), visits: num(c.visits), interval_months: num(c.interval_months), next_visit: c.next_visit,
    bill_cycle: c.bill_cycle, next_bill: c.next_bill, owner_id: c.owner_id, status: c.status, scope: c.scope, notes: c.notes };
}

function publicUser(u) {
  return { user_id: u.user_id, name: u.name, role: u.role, role_name: ROLES[u.role] || u.role, team: u.team,
    target: num(u.target), must_change: isTrue(u.must_change), has_pin: !!u.pin_hash, phone_masked: maskPhone(u.phone),
    has_recovery: MGMT.indexOf(u.role) >= 0 ? !!u.recovery_hash : null };
}

function publicSettings(user) {
  var s = {};
  DB.all('Settings').forEach(function (r) { s[r.key] = r.value; });
  if (!canSeeCost(user)) { delete s.fixed_per_td; delete s.target_per_td; delete s.comm_rate; delete s.warranty_rate; }
  return s;
}

function hidePrice(user, o) {
  // ช่างไม่เห็นราคา/ต้นทุน และไม่เห็นเงื่อนไขชำระเงิน (ทีมไม่เก็บเงิน — บัญชีเป็นผู้วางบิล/เก็บเงิน)
  if (user.role === 'LEAD' || user.role === 'TECH') { delete o.amount; delete o.est_cost; delete o.actual_cost; delete o.payment; }
  return o;
}

// ============================================================ helpers

/** token = user_id.หมดอายุ(base36).HMAC — ไม่พึ่ง Cache จึงไม่หลุดเอง เปลี่ยน/รีเซ็ต PIN แล้ว token เก่าใช้ไม่ได้ */
var TOKEN_DAYS = 30;
function makeToken(u) {
  var exp = (Date.now() + TOKEN_DAYS * 86400000).toString(36);
  return u.user_id + '.' + exp + '.' + tokenSig(u.user_id, exp, num(u.session_ver));
}
function tokenSig(userId, exp, ver) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('TOKEN_SECRET');
  if (!secret) { secret = randomToken(); props.setProperty('TOKEN_SECRET', secret); }
  var bytes = Utilities.computeHmacSha256Signature(userId + '|' + exp + '|' + ver, secret, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}
function auth(token) {
  var m = /^([A-Za-z0-9_-]{1,40})\.([0-9a-z]{1,12})\.([a-f0-9]{64})$/.exec(String(token || ''));
  if (!m) return null;
  if (parseInt(m[2], 36) < Date.now()) return null;
  var u = DB.find('Users', 'user_id', m[1]);
  if (!u || !isTrue(u.active)) return null;
  if (tokenSig(u.user_id, m[2], num(u.session_ver)) !== m[3]) return null;
  return u;
}

function canSeeCost(user) { return user && (user.role === 'CEO' || user.role === 'MANAGER'); }

function ownerGuard(user, q) {
  if (user.role === 'SALES' && q.owner_id !== user.user_id) throw new Error('ไม่ใช่ใบเสนอราคาของคุณ');
}

function fieldJob(user, jobId) {
  var j = mustFind('Jobs', 'job_id', jobId);
  if ((user.role === 'LEAD' || user.role === 'TECH') && j.team !== user.team) throw new Error('ไม่ใช่งานของทีมคุณ');
  return j;
}

function creditDaysOf(j) {
  var c = j.cust_id ? DB.find('Customers', 'cust_id', j.cust_id) : null;
  var m = /(\d+)\s*วัน/.exec(String(j.payment || ''));
  if (m) return num(m[1]);
  return c ? num(c.credit_days) : 0;
}

function isOpenLead(l) { return ['NEW', 'QUOTE', 'SURVEY', 'QUOTED', 'HOLD'].indexOf(l.stage) >= 0; }

function teamNames() {
  return String(setting('team_names') || 'ทีม 1,ทีม 2').split(',').map(function (s) { return s.trim(); }).filter(String);
}

function setting(key) {
  var r = DB.find('Settings', 'key', key);
  if (r) return r.value;
  for (var i = 0; i < DEFAULT_SETTINGS.length; i++) if (DEFAULT_SETTINGS[i][0] === key) return DEFAULT_SETTINGS[i][1];
  return '';
}

function webUrl() {
  var s = String(setting('web_url') || '').trim();
  if (/^https:\/\/\S+$/.test(s)) return s.replace(/\?.*$/, '');
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}




function hashPin(userId, pin) {
  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty('PIN_SALT');
  if (!salt) { salt = Utilities.getUuid(); props.setProperty('PIN_SALT', salt); }
  return sha256hex(salt + '|' + userId + '|' + pin);
}
function sha256hex(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}
/** แฮชรหัส (OTP/รหัสชั่วคราว/รหัสกู้คืน) ผูกกับเบอร์หรือผู้ใช้ + ความลับของระบบ */
function hashCode(scope, code) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('TOKEN_SECRET');
  if (!secret) { secret = randomToken(); props.setProperty('TOKEN_SECRET', secret); }
  return sha256hex(secret + '|' + scope + '|' + code);
}
function randomDigits(n) { return Utilities.randomDigits(n); }
function randomRef() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ', s = '', d = Utilities.randomDigits(8); for (var i = 0; i < 4; i++) s += a[(Number(d.slice(i * 2, i * 2 + 2))) % a.length]; return s; }
/** เบอร์มือถือไทย 10 หลัก (รับ +66 / 66 / มีขีด) */
function normPhone(v) {
  var d = String(v || '').replace(/\D/g, '');
  if (d.indexOf('66') === 0 && d.length === 11) d = '0' + d.slice(2);
  return /^0[689]\d{8}$/.test(d) ? d : '';
}
function maskPhone(v) { var d = normPhone(v); return d ? d.slice(0, 3) + '-xxx-' + d.slice(6) : ''; }
function randomToken() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

function nextId(prefix) {
  var props = PropertiesService.getScriptProperties();
  var ym = Utilities.formatDate(new Date(), APP.tz, 'yyMM');
  var key = 'SEQ_' + prefix + '_' + ym;
  var n = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(n));
  var width = prefix === 'C' || prefix === 'U' ? 3 : 4;
  return prefix + ym + '-' + ('0000' + n).slice(-width);
}


function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { DB.reset(); return fn(); } finally { DB.reset(); lock.releaseLock(); }
}

function log(userId, action, ref, detail) {
  try { DB.insert('Log', { ts: nowIso(), user_id: userId, action: action, ref: String(ref || '').slice(0, 300), detail: String(detail === undefined ? '' : detail).slice(0, 300) }); } catch (e) { /* ignore */ }
}

function mustFind(sheet, key, val) {
  var r = DB.find(sheet, key, val);
  if (!r) throw new Error('ไม่พบข้อมูล ' + val);
  return r;
}

function clean(v, max) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  return s.slice(0, max || 500);
}

function cleanDate(v) {
  var s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function sanitizeObj(o, max) {
  var out = {};
  Object.keys(o || {}).slice(0, 40).forEach(function (k) {
    var key = String(k).replace(/[^\w฀-๿]/g, '').slice(0, 40);
    if (key) out[key] = clean(o[k], max);
  });
  return out;
}

function parseJson(s, dflt) { try { return s ? JSON.parse(s) : dflt; } catch (e) { return dflt; } }
function num(v) { var n = Number(String(v === undefined || v === null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function round2(n) { return Math.round(num(n) * 100) / 100; }
function round4(n) { return Math.round(num(n) * 10000) / 10000; }
function sum(rows, f) { return rows.reduce(function (s, r) { return s + num(r[f]); }, 0); }
function isTrue(v) { return v === true || v === 'Y' || v === 'TRUE' || v === 'true' || v === 1; }
function pad(v) { return ('000' + (v === '' ? 999 : num(v))).slice(-3); }
function normName(s) { return String(s || '').replace(/\s+/g, '').replace(/บริษัท|จำกัด|\(มหาชน\)/g, '').toLowerCase(); }
function indexBy(rows, key) { var o = {}; rows.forEach(function (r) { o[r[key]] = r; }); return o; }
function fmt(n) { return num(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

function today() { return Utilities.formatDate(new Date(), APP.tz, 'yyyy-MM-dd'); }
function nowIso() { return Utilities.formatDate(new Date(), APP.tz, "yyyy-MM-dd'T'HH:mm:ss"); }
function addDays(d, n) {
  var p = d.split('-').map(Number);
  var x = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return x.toISOString().slice(0, 10);
}
function addMonths(d, n) {
  var p = String(d).split('-').map(Number);
  var x = new Date(Date.UTC(p[0], p[1] - 1 + n, 1));
  var last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(p[2], last));
  return x.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  if (!cleanDate(a) || !cleanDate(b)) return 0;
  var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
function thaiDate(d) {
  var m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var w = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var p = d.split('-').map(Number);
  var x = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return w[x.getUTCDay()] + ' ' + p[2] + ' ' + m[p[1] - 1] + ' ' + (p[0] + 543);
}


/** ทำให้ค่าที่ส่งกลับหน้าเว็บเป็นข้อมูลล้วน (google.script.run ส่ง Date/undefined ไม่ได้) */
function plain(v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
function errText(err) { return String((err && err.message) || err || 'เกิดข้อผิดพลาด'); }

// ============================================================ exports
return {
  publicStatus: publicStatus, setupInit: setupInit, otpRequest: otpRequest, otpVerify: otpVerify, pinLogin: pinLogin,
  recoveryLogin: recoveryLogin, api: api, publicQuote: publicQuote, publicAck: publicAck,
  _t: { SCHEMA: SCHEMA, NUMERIC: NUMERIC, DEFAULT_SETTINGS: DEFAULT_SETTINGS, CHECKLISTS: CHECKLISTS,
    today: today, addDays: addDays, addMonths: addMonths, nowIso: nowIso, makeToken: makeToken, hashCode: hashCode,
    normPhone: normPhone, generateContractVisits: generateContractVisits, hashPin: hashPin, ROLES: ROLES,
    initialized: initialized, setting: setting }
};
}

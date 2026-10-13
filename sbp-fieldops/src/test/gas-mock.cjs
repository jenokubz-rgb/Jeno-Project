/* Google Apps Script service mocks — works in Node and in the browser (used for tests and the demo build). */
(function (G) {
  'use strict';
  // ---------- SHA-256 (sync, pure JS)
  function utf8Bytes(str) { const u = unescape(encodeURIComponent(str)); const b = []; for (let i = 0; i < u.length; i++) b.push(u.charCodeAt(i)); return b; }
  function sha256Bytes(str) { return sha256Raw(utf8Bytes(str)); }
  function hmacSha256(msg, key) {
    let k = utf8Bytes(key);
    if (k.length > 64) k = sha256Raw(k).map(v => (v + 256) % 256);
    while (k.length < 64) k.push(0);
    const inner = sha256Raw(k.map(v => v ^ 0x36).concat(utf8Bytes(msg))).map(v => (v + 256) % 256);
    return sha256Raw(k.map(v => v ^ 0x5c).concat(inner));
  }
  function sha256Raw(input) {
    const bytes = input.slice();
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const l = bytes.length * 8;
    bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 0xff);
    const W = new Array(64);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = [H[0] + a | 0, H[1] + b | 0, H[2] + c | 0, H[3] + d | 0, H[4] + e | 0, H[5] + f | 0, H[6] + g | 0, H[7] + h | 0];
    }
    const out = [];
    H.forEach(w => { for (let i = 3; i >= 0; i--) { const v = (w >>> (i * 8)) & 0xff; out.push(v > 127 ? v - 256 : v); } });
    return out;
  }
  const uuid = () => (G.crypto && G.crypto.randomUUID) ? G.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const b64enc = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b < 0 ? b + 256 : b); }); return G.btoa(s); };
  const b64dec = str => { const s = G.atob(str); const out = []; for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); return out; };

  // ---------- clock (tests can shift "now")
  const CLOCK = { offsetMs: 0, now() { return new Date(Date.now() + this.offsetMs); } };

  // ---------- Spreadsheet
  function toCell(v, fmt) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return v;
    let s = String(v);
    if (s.charAt(0) === "'") return s.slice(1);
    if (fmt === '@') return s;
    if (/^-?\d+(\.\d+)?$/.test(s) && !/^0\d/.test(s)) return Number(s);
    if (/^0\d+$/.test(s)) return Number(s); // Sheets drops leading zero in non-text columns
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2], -7)); }
    return s;
  }
  function Sheet(name) { this.name = name; this.data = []; this.fmt = {}; this.maxRows = 1000; this.maxCols = 26; }
  Sheet.prototype = {
    getName() { return this.name; },
    getLastRow() { for (let i = this.data.length - 1; i >= 0; i--) if (this.data[i] && this.data[i].some(v => v !== '' && v !== null && v !== undefined)) return i + 1; return 0; },
    getLastColumn() { let m = 0; this.data.forEach(r => { if (!r) return; for (let j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] !== undefined) { m = Math.max(m, j + 1); break; } }); return m; },
    getMaxRows() { return Math.max(this.maxRows, this.data.length); },
    insertRowsAfter(after, n) { this.maxRows = this.getMaxRows() + n; return this; },
    insertSheet() { return this; },
    setFrozenRows() { return this; },
    clear() { this.data = []; this.fmt = {}; return this; },
    _get(r, c) { const row = this.data[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; },
    _set(r, c, v) {
      while (this.data.length < r) this.data.push([]);
      const row = this.data[r - 1];
      while (row.length < c) row.push('');
      row[c - 1] = toCell(v, this.fmt[r + ':' + c] || this.fmt['col:' + c + ':' + r]);
      if (r > this.maxRows) this.maxRows = r;
    },
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); },
    appendRow(vals) { const r = this.getLastRow() + 1; vals.forEach((v, j) => this._set(r, j + 1, v)); return this; },
    deleteRow(r) { this.data.splice(r - 1, 1); const nf = {}; Object.keys(this.fmt).forEach(k => { const m = /^(\d+):(\d+)$/.exec(k); if (!m) return; const rr = Number(m[1]); if (rr < r) nf[k] = this.fmt[k]; else if (rr > r) nf[(rr - 1) + ':' + m[2]] = this.fmt[k]; }); this.fmt = nf; return this; }
  };
  function Range(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  Range.prototype = {
    getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh._get(this.r + i, this.c + j)); out.push(row); } return out; },
    getValue() { return this.sh._get(this.r, this.c); },
    setValues(v) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, v[i][j]); return this; },
    setValue(v) { this.sh._set(this.r, this.c, v); return this; },
    setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.fmt[(this.r + i) + ':' + (this.c + j)] = f; return this; },
    setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }
  };
  function Spreadsheet() { this.sheets = {}; this.order = []; }
  Spreadsheet.prototype = {
    getSheetByName(n) { return this.sheets[n] || null; },
    insertSheet(n) { const s = new Sheet(n); this.sheets[n] = s; this.order.push(n); return s; },
    getSheets() { return this.order.map(n => this.sheets[n]); },
    deleteSheet(sh) { delete this.sheets[sh.name]; this.order = this.order.filter(n => n !== sh.name); }
  };

  const STORE = { ss: new Spreadsheet(), props: {}, cache: {}, files: {}, folders: {}, nextFile: 1 };

  G.__GAS = { STORE, CLOCK, Spreadsheet, sha256Bytes,
    serialize() {
      return JSON.stringify({ props: STORE.props, files: STORE.files, folders: STORE.folders, nextFile: STORE.nextFile,
        sheets: STORE.ss.order.map(n => { const s = STORE.ss.sheets[n]; return { n, d: s.data.map(r => r.map(v => v instanceof Date ? { $d: v.toISOString() } : v)), f: s.fmt, m: s.maxRows }; }) });
    },
    restore(json) {
      const o = JSON.parse(json);
      STORE.props = o.props; STORE.files = o.files; STORE.folders = o.folders; STORE.nextFile = o.nextFile; STORE.ss = new Spreadsheet();
      o.sheets.forEach(x => { const s = STORE.ss.insertSheet(x.n); s.data = x.d.map(r => r.map(v => v && v.$d ? new Date(v.$d) : v)); s.fmt = x.f; s.maxRows = x.m; });
    }
  };

  G.SpreadsheetApp = {
    getActiveSpreadsheet() { return STORE.ss; },
    openById() { return STORE.ss; },
    getUi() { throw new Error('no ui'); }
  };
  G.PropertiesService = { getScriptProperties() { return {
    getProperty(k) { return STORE.props[k] === undefined ? null : STORE.props[k]; },
    setProperty(k, v) { STORE.props[k] = String(v); return this; }
  }; } };
  G.CacheService = { getScriptCache() { return {
    get(k) { const e = STORE.cache[k]; if (!e) return null; if (e.exp < CLOCK.now().getTime()) { delete STORE.cache[k]; return null; } return e.v; },
    put(k, v, sec) { STORE.cache[k] = { v: String(v), exp: CLOCK.now().getTime() + (sec || 600) * 1000 }; },
    remove(k) { delete STORE.cache[k]; }
  }; } };
  G.LockService = { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } };
  const pad = (n, w) => ('000' + n).slice(-(w || 2));
  G.Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    getUuid: uuid,
    computeDigest(alg, str) { return sha256Bytes(String(str)); },
    computeHmacSha256Signature(value, key) { return hmacSha256(String(value), String(key)); },
    formatDate(d, tz, f) {
      const t = new Date(d.getTime() + 7 * 3600000); // Asia/Bangkok
      const Y = t.getUTCFullYear(), M = pad(t.getUTCMonth() + 1), D = pad(t.getUTCDate()), h = pad(t.getUTCHours()), m = pad(t.getUTCMinutes()), s = pad(t.getUTCSeconds());
      if (f === 'yyyy-MM-dd') return `${Y}-${M}-${D}`;
      if (f === 'yyMM') return String(Y).slice(2) + M;
      if (f === "yyyy-MM-dd'T'HH:mm:ss") return `${Y}-${M}-${D}T${h}:${m}:${s}`;
      throw new Error('fmt ' + f);
    },
    base64Decode: b64dec, base64Encode: b64enc,
    newBlob(bytes, type, name) { return { bytes, type, name, getBytes() { return bytes; }, getContentType() { return type; }, getName() { return name; } }; }
  };
  function Folder(id, name) { this.id = id; this.name = name; }
  Folder.prototype = {
    getId() { return this.id; },
    getFoldersByName(n) { const list = Object.keys(STORE.folders).filter(k => STORE.folders[k].parent === this.id && STORE.folders[k].name === n); let i = 0; return { hasNext: () => i < list.length, next: () => new Folder(list[i], STORE.folders[list[i++]].name) }; },
    createFolder(n) { const id = 'fold' + (STORE.nextFile++) + 'xxxxxxxxxx'; STORE.folders[id] = { name: n, parent: this.id }; return new Folder(id, n); },
    createFile(blob) { const id = 'file' + (STORE.nextFile++) + 'xxxxxxxxxxxx'; STORE.files[id] = { type: blob.type, b64: b64enc(blob.bytes), name: blob.name, parent: this.id }; return { getId: () => id }; }
  };
  G.DriveApp = {
    createFolder(n) { const id = 'fold' + (STORE.nextFile++) + 'xxxxxxxxxx'; STORE.folders[id] = { name: n, parent: null }; return new Folder(id, n); },
    getFolderById(id) { if (!STORE.folders[id]) throw new Error('no folder'); return new Folder(id, STORE.folders[id].name); },
    getFileById(id) { const f = STORE.files[id]; if (!f) throw new Error('no file'); return { getBlob() { return G.Utilities.newBlob(b64dec(f.b64), f.type, f.name); } }; }
  };
  G.ScriptApp = { getService() { return { getUrl() { return G.__GAS_URL || 'https://script.google.com/macros/s/DEMO/exec'; } }; } };
  G.HtmlService = { XFrameOptionsMode: { DEFAULT: 'DEFAULT' },
    createHtmlOutput(html) { const o = { html, setTitle() { return o; }, getContent() { return html; } }; return o; },
    createTemplateFromFile(name) { throw new Error('No HTML file named ' + name + ' was found.'); } };
  G.Logger = { log() {} };
  // Date shim so Code.gs "new Date()" follows the test clock
  const RealDate = Date;
  G.__useClock = function () {
    function D() { if (arguments.length === 0) return CLOCK.now(); return new (Function.prototype.bind.apply(RealDate, [null].concat(Array.prototype.slice.call(arguments))))(); }
    D.UTC = RealDate.UTC; D.now = () => CLOCK.now().getTime(); D.parse = RealDate.parse; D.prototype = RealDate.prototype;
    return D;
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

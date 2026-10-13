/* ส่วนเสริม gas-mock สำหรับระบบ v2 (ตัวโหลดอ่านไฟล์จาก Drive, แคชเป็นชิ้น, ส่ง SMS ผ่าน UrlFetchApp) */
'use strict';
const G = globalThis;
const { STORE } = G.__GAS;
const utf8 = b64 => Buffer.from(b64, 'base64').toString('utf8');
function fileObj(id) {
  const f = STORE.files[id];
  return {
    getId: () => id, getName: () => f.name, isTrashed: () => !!f.trashed, setTrashed: v => { f.trashed = !!v; },
    getBlob: () => {
      const blob = G.Utilities.newBlob(Array.from(Buffer.from(f.b64, 'base64')), f.type, f.name);
      blob.getDataAsString = () => utf8(f.b64);
      return blob;
    }
  };
}
const origGetFolder = G.DriveApp.getFolderById;
G.DriveApp.getFolderById = function (id) {
  const folder = origGetFolder.call(this, id);
  folder.getFiles = () => {
    const ids = Object.keys(STORE.files).filter(k => STORE.files[k].parent === id);
    let i = 0;
    return { hasNext: () => i < ids.length, next: () => fileObj(ids[i++]) };
  };
  return folder;
};
G.DriveApp.getFileById = id => { if (!STORE.files[id]) throw new Error('no file'); return fileObj(id); };
G.DriveApp.getRootFolder = () => ({ getId: () => 'root' });
G.__addDriveFile = (folderId, name, text, type) => {
  const id = 'sys' + (STORE.nextFile++) + 'xxxxxxxxxxxxxxxx';
  STORE.files[id] = { type: type || 'text/plain', b64: Buffer.from(text, 'utf8').toString('base64'), name, parent: folderId };
  return id;
};
G.__addFolder = name => { const id = 'fold' + (STORE.nextFile++) + 'sysxxxxxxx'; STORE.folders[id] = { name, parent: null }; return id; };

const origCache = G.CacheService.getScriptCache;
G.CacheService.getScriptCache = function () {
  const c = origCache.call(this);
  c.getAll = keys => { const o = {}; keys.forEach(k => { const v = c.get(k); if (v !== null) o[k] = v; }); return o; };
  c.putAll = (obj, sec) => { Object.keys(obj).forEach(k => { if (String(obj[k]).length > 100000) throw new Error('Argument too large'); c.put(k, obj[k], sec); }); };
  c.removeAll = keys => keys.forEach(k => c.remove(k));
  return c;
};
const origProps = G.PropertiesService.getScriptProperties;
G.PropertiesService.getScriptProperties = function () {
  const p = origProps.call(this);
  p.deleteProperty = k => { delete STORE.props[k]; return p; };
  return p;
};
G.LockService.getScriptLock = () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} });
G.HtmlService.createHtmlOutput = html => {
  const o = { html, title: '', setTitle(t) { o.title = t; return o; }, addMetaTag() { return o; }, setXFrameOptionsMode() { return o; }, getContent() { return html; } };
  return o;
};
G.__smsBox = [];
G.UrlFetchApp = {
  fetch(url, opt) {
    if (/thaibulksms/.test(url)) {
      G.__smsBox.push({ to: opt.payload.msisdn, text: opt.payload.message, sender: opt.payload.sender, auth: opt.headers.Authorization });
      return { getResponseCode: () => (G.__smsFail ? 500 : 201), getContentText: () => '{}' };
    }
    throw new Error('UrlFetchApp blocked in test: ' + url);
  }
};
// Utilities.base64Encode รับได้ทั้ง byte[] และ String (เหมือน Apps Script จริง)
const origB64 = G.Utilities.base64Encode;
G.Utilities.base64Encode = d => (typeof d === 'string' ? Buffer.from(d, 'utf8').toString('base64') : origB64(d));
// ---------- v2 ตัวโหลด: ดึงไฟล์จาก GitHub (จำลองจาก dist/gas), ตั้งเวลา, สร้างไฟล์ข้อความใน Drive
G.MimeType = { PLAIN_TEXT: 'text/plain' };
G.__repoDir = null; G.__repoFetches = 0;
const origFetch = G.UrlFetchApp.fetch;
G.UrlFetchApp.fetch = function (url, opt) {
  const m = /^https:\/\/raw\.githubusercontent\.com\/jenokubz-rgb\/Jeno-Project\/main\/sbp-fieldops\/([^?]+)/.exec(url);
  if (m) {
    G.__repoFetches++;
    const fs = require('fs');
    const rel = m[1].replace(/^dist\//, '');
    const f = (G.__repoDir || '') + rel;
    const okf = G.__repoDir && !G.__repoDown && fs.existsSync(f);
    const body = okf ? fs.readFileSync(f, 'utf8') : 'Not Found';
    return { getResponseCode: () => (okf ? 200 : 404), getContentText: () => body };
  }
  return origFetch.call(this, url, opt);
};
G.__triggers = [];
G.ScriptApp.getProjectTriggers = () => G.__triggers.map(h => ({ getHandlerFunction: () => h }));
G.ScriptApp.newTrigger = h => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => { G.__triggers.push(h); } }) }) });
// Folder: createFile(name, content, mime) + getFiles + isTrashed ; File: setTrashed
const origGetFolder2 = G.DriveApp.getFolderById;
G.DriveApp.getFolderById = function (id) {
  const folder = origGetFolder2.call(this, id);
  const origCreate = folder.createFile.bind(folder);
  folder.createFile = (a, content, mime) => {
    if (typeof a === 'string') { const fid = G.__addDriveFile(id, a, content, mime); return { getId: () => fid, getName: () => a }; }
    return origCreate(a);
  };
  folder.isTrashed = () => !!(STORE.folders[id] && STORE.folders[id].trashed);
  return folder;
};
const origCreateFolder = G.DriveApp.createFolder;
G.DriveApp.createFolder = function (n) { const f = origCreateFolder.call(this, n); return G.DriveApp.getFolderById(f.getId()); };
const origFileById = G.DriveApp.getFileById;
G.DriveApp.getFileById = id => { const f = origFileById(id); f.setTrashed = v => { STORE.files[id].trashed = !!v; }; return f; };

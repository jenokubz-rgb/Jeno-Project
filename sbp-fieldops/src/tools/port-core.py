# One-time port: Google Apps Script Code.gs -> supabase/functions/api/core.js
# (หลังจากนี้แก้ core.js โดยตรง)
import re, sys

src = open(sys.argv[1], encoding='utf-8').read()
start = src.index("var SBP_ = (function () {\n'use strict';\n") + len("var SBP_ = (function () {\n'use strict';\n")
end = src.index('// ============================================================ exports (closure)')
body = src[start:end]

# ตัดชั้นข้อมูล Google Sheets (DB) ออก — engine ส่ง DB เข้ามาแทน
i = body.index('// ============================================================ data layer (Google Sheets)')
body = body[:i]

def drop_fn(text, name):
    m = re.search(r'^(/\*\*[^\n]*\*/\n)?function ' + re.escape(name) + r'\(', text, re.M)
    assert m, name
    j = text.index('\n}\n', m.start())
    return text[:m.start()] + text[j + 3:]

for fn in ['doGet', 'indexTemplate', 'publicUsers', 'login', 'setup', 'loadSeed', 'onOpen',
           'menuGenerateVisits', 'SS', 'ensureCapacity', 'jobFolder', 'randomPin', 'hashPin']:
    body = drop_fn(body, fn)

# คอมเมนต์หัวข้อ setup ที่เหลือ
body = body.replace('// ============================================================ setup\n\n', '')
# ไม่ต้องกันสูตร Google Sheets แล้ว (ฐานข้อมูลจริง)
old = "  if (/^[=+\\-@]/.test(s)) s = \"'\" + s; // กันสูตรใน Google Sheets\n"
assert old in body
body = body.replace(old, '')

header = '''// SBP FieldOps — ตรรกะธุรกิจทั้งหมด (สิทธิ์ ด่านกำไร ใบเสนอราคา งาน วางบิล ประกัน สัญญา)
// ยกมาจากระบบ Google Apps Script เดิม (ทดสอบผ่านแล้ว) ทำงานบนฐานข้อมูล Postgres ผ่าน engine.js
// ฟังก์ชันทั้งหมดเป็นแบบ synchronous — engine โหลดข้อมูลที่ต้องใช้ให้ก่อน แล้วบันทึกทีเดียวตอนจบคำขอ
/* eslint-disable */
export function makeCore(g) {
'use strict';
var Utilities = g.Utilities, PropertiesService = g.PropertiesService, CacheService = g.CacheService,
  LockService = g.LockService, DriveApp = g.DriveApp, ScriptApp = g.ScriptApp, Logger = g.Logger,
  SMS = g.SMS, DB = g.DB;
'''
footer = '''
// ============================================================ exports
return {
  publicStatus: publicStatus, setupInit: setupInit, otpRequest: otpRequest, otpVerify: otpVerify,
  recoveryLogin: recoveryLogin, api: api, publicQuote: publicQuote, publicAck: publicAck,
  _t: { SCHEMA: SCHEMA, NUMERIC: NUMERIC, DEFAULT_SETTINGS: DEFAULT_SETTINGS, CHECKLISTS: CHECKLISTS,
    today: today, addDays: addDays, addMonths: addMonths, nowIso: nowIso, makeToken: makeToken, hashCode: hashCode,
    normPhone: normPhone, generateContractVisits: generateContractVisits }
};
}
'''
open(sys.argv[2], 'w', encoding='utf-8').write(header + body.rstrip() + '\n' + footer)
print('ok', len((header + body).splitlines()), 'lines')

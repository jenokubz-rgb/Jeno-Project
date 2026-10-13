// ทดสอบหลังบ้านครบวงจร (ยกชุดทดสอบ 154 จุดของระบบเดิมมา + บัญชีเบอร์มือถือ/PIN/OTP)
// BACKEND=gas → Google Apps Script (จำลอง) · ค่าเริ่มต้น → Supabase (Postgres จริงผ่าน HTTP)
const { startStack } = await import(process.env.BACKEND === 'gas' ? './harness-gas.mjs' : './harness.mjs');

const S = await startStack();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
async function throws(p, re, m) { try { await p; ok(false, m + ' (did not throw)'); } catch (e) { ok(re.test(e.message), m + ' (msg: ' + e.message + ')'); } }
const row = (t, k, v) => S.row(t, k, v);
const rows = t => S.rows(t);
const today = () => S.core._t.today();
const addDays = (d, n) => S.core._t.addDays(d, n);
const addMonths = (d, n) => S.core._t.addMonths(d, n);
const CHECKLISTS = S.core._t.CHECKLISTS;
const smsBox = () => S.smsBox();

// ---------- ตั้งค่าครั้งแรก
const st0 = await S.call('publicStatus');
eq([st0.ok, st0.data.initialized], [true, false], 'not initialized before setup');
const code = S.setupCode();
eq((await S.call('otpRequest', '0810000001')).code, 'SETUP', 'OTP blocked before setup');
ok(!(await S.call('setupInit', '12345678', '0810000001')).ok, 'wrong setup code rejected');
ok(!(await S.call('setupInit', code, '12345')).ok, 'bad phone rejected');
const st = await S.call('setupInit', code, '+66 81-000-0001');
ok(st.ok && st.data.user.role === 'CEO' && st.data.first && st.data.user.must_change, 'setup → CEO logged in, must set PIN');
ok(!(await S.call('setupInit', code, '0810000001')).ok, 'setup cannot run twice');
eq((await rows('Users')).length, 11, 'users seeded');
eq((await rows('Customers')).length, 59, 'customers seeded (4 duplicates merged)');
eq((await rows('Catalog')).length, 1076, 'catalog seeded');
ok(/รวมรายการซ้ำ C0039/.test((await row('Customers', 'cust_id', 'C0001')).notes), 'merge note kept');
ok(!(await row('Customers', 'cust_id', 'C0039')), 'merged duplicate removed');
eq((await row('Users', 'user_id', 'U-CEO')).phone, '0810000001', 'CEO phone normalized from +66');

const T = { 'U-CEO': st.data.token };
async function A(user, action, payload) {
  const r = await S.call('api', T[user], action, payload || {});
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
// ---------- PIN: ต้องตั้งก่อนใช้งาน
eq((await S.call('api', T['U-CEO'], 'home', {})).code, 'PIN', 'must set PIN before using the system');
ok((await S.call('api', T['U-CEO'], 'bootstrap', {})).ok, 'bootstrap allowed while setting PIN');
await throws(A('U-CEO', 'me.pin', { new_pin: '111111' }), /เดาง่าย/, 'repeated-digit PIN rejected');
await throws(A('U-CEO', 'me.pin', { new_pin: '123456' }), /เดาง่าย/, 'sequential PIN rejected');
await throws(A('U-CEO', 'me.pin', { new_pin: '000000' }), /เดาง่าย/, 'zero PIN rejected');
await throws(A('U-CEO', 'me.pin', { new_pin: '100000' }), /เบอร์โทร/, 'PIN from phone number rejected');
const PIN = { 'U-CEO': '583920' };
const sp = await A('U-CEO', 'me.pin', { new_pin: PIN['U-CEO'] });
ok(sp.token && sp.user.must_change === false, 'CEO PIN set, new token');
eq((await S.call('api', T['U-CEO'], 'home', {})).code, 'AUTH', 'old token revoked after PIN set');
T['U-CEO'] = sp.token;
ok((await A('U-CEO', 'home')) && true, 'CEO can use system after PIN');
const pl = await S.call('pinLogin', '081-000-0001', PIN['U-CEO']);
ok(pl.ok && pl.data.user.user_id === 'U-CEO', 'phone + PIN login');
ok(/PIN ไม่ถูกต้อง/.test((await S.call('pinLogin', '0810000001', '999999')).error), 'wrong PIN rejected');
ok(/10 หลัก/.test((await S.call('pinLogin', '123', '583920')).error), 'invalid phone on PIN login');

// ---------- บัญชีผู้ใช้: ใส่เบอร์ให้ทุกคน
const PH = {};
const ulist = await A('U-CEO', 'users.list');
let n = 2;
for (const u of ulist) {
  if (u.user_id === 'U-CEO') { PH[u.user_id] = '0810000001'; continue; }
  PH[u.user_id] = '08100000' + String(n++).padStart(2, '0');
  await A('U-CEO', 'users.save', { user_id: u.user_id, name: u.name, role: u.role, team: u.team, phone: PH[u.user_id], target: u.target });
}
await throws(A('U-CEO', 'users.save', { user_id: 'U-T1', name: 'ตาม', role: 'LEAD', team: 'ทีม 1', phone: PH['U-T2'] }), /ใช้กับบัญชี/, 'duplicate phone rejected');
await throws(A('U-CEO', 'users.save', { name: 'ไม่มีเบอร์', role: 'TECH', team: 'ทีม 1' }), /เบอร์มือถือ/, 'phone required');

// SMS ยังไม่เชื่อมต่อ → ใช้รหัสชั่วคราว; เชื่อมต่อแล้ว → OTP
async function loginTemp(id) {
  const tc = await A('U-CEO', 'users.tempCode', { user_id: id });
  ok(/^\d{6}$/.test(tc.code) && tc.hours === 12, 'temp code issued ' + id);
  const r = await S.call('otpVerify', PH[id], tc.code);
  ok(r.ok && r.data.user.must_change, 'temp code login → must set PIN ' + id + ' ' + (r.error || ''));
  ok(/^[A-Za-z0-9_-]+\.[0-9a-z]+\.[a-f0-9]{64}$/.test(r.data.token), 'signed token format');
  ok(!(await S.call('otpVerify', PH[id], tc.code)).ok, 'temp code single-use ' + id);
  T[id] = r.data.token;
  PIN[id] = String(700000 + Number(PH[id].slice(-2)) * 731);
  const p = await A(id, 'me.pin', { new_pin: PIN[id] });
  T[id] = p.token;
}
for (const id of ['U-MGR', 'U-SALES1', 'U-SALES2', 'U-BO', 'U-T1', 'U-T2']) await loginTemp(id);
// OTP ทาง SMS
const o1 = await S.call('otpRequest', PH['U-T3']);
ok(o1.ok && /^[A-Z]{4}$/.test(o1.data.ref) && o1.data.masked === PH['U-T3'].slice(0, 3) + '-xxx-' + PH['U-T3'].slice(6), 'OTP requested ' + JSON.stringify(o1));
const smsMsg = smsBox()[smsBox().length - 1];
eq(smsMsg.to, PH['U-T3'], 'SMS to right phone');
const otp = /: (\d{6}) \(Ref/.exec(smsMsg.text)[1];
ok(smsMsg.text.indexOf(o1.data.ref) > 0, 'SMS has ref');
const v3 = await S.call('otpVerify', PH['U-T3'], otp);
ok(v3.ok && v3.data.user.user_id === 'U-T3', 'OTP login');
T['U-T3'] = v3.data.token;
PIN['U-T3'] = '864213';
T['U-T3'] = (await A('U-T3', 'me.pin', { new_pin: PIN['U-T3'] })).token;
ok((await S.call('pinLogin', PH['U-T3'], PIN['U-T3'])).ok, 'tech logs in with PIN after OTP');
eq((await S.call('pinLogin', PH['U-T4'], '864213')).code, 'NOPIN', 'user without PIN told to use temp code');
await throws(A('U-T3', 'me.pin', { old_pin: '000001', new_pin: '975310' }), /PIN เดิม/, 'change PIN needs old PIN');
const ch = await A('U-T3', 'me.pin', { old_pin: PIN['U-T3'], new_pin: '975310' });
PIN['U-T3'] = '975310'; T['U-T3'] = ch.token;
ok(!(await S.call('pinLogin', PH['U-T3'], '864213')).ok && (await S.call('pinLogin', PH['U-T3'], '975310')).ok, 'PIN changed');
for (let i = 0; i < 5; i++) await S.call('pinLogin', PH['U-SALES2'], '222333');
ok(/เกิน 5 ครั้ง/.test((await S.call('pinLogin', PH['U-SALES2'], PIN['U-SALES2'])).error), 'PIN locked after 5 wrong tries');
// ลืม PIN: ผู้จัดการออกรหัสชั่วคราว → ตั้ง PIN ใหม่
const fg = await A('U-CEO', 'users.tempCode', { user_id: 'U-BO' });
const fv = await S.call('otpVerify', PH['U-BO'], fg.code);
ok(fv.ok && fv.data.user.must_change, 'forgot PIN → temp code → must set new PIN');
T['U-BO'] = (await S.call('api', fv.data.token, 'me.pin', { new_pin: '468024' })).data.token; PIN['U-BO'] = '468024';
ok(/รอ \d+ วินาที/.test((await S.call('otpRequest', PH['U-T3'])).error), 'OTP cooldown 60s');
ok(/ยังไม่มีบัญชี/.test((await S.call('otpRequest', '0899999999')).error), 'unknown phone');
ok(/10 หลัก/.test((await S.call('otpRequest', '12345')).error), 'invalid phone');
// ล็อกเมื่อใส่ผิด 5 ครั้ง
for (let i = 0; i < 5; i++) await S.call('otpVerify', PH['U-T5'], '111111');
const tc5 = await A('U-CEO', 'users.tempCode', { user_id: 'U-T5' });
ok(/เกิน 5 ครั้ง/.test((await S.call('otpVerify', PH['U-T5'], tc5.code)).error), 'locked after 5 wrong codes');
// ขอ OTP เกิน 5 ครั้ง/ชม.
const realNow = Date.now;
let shift = 0; Date.now = () => realNow() + shift;
for (let i = 0; i < 5; i++) { shift += 61000; await S.call('otpRequest', PH['U-T6']); }
shift += 61000;
ok(/เกิน 5 ครั้ง/.test((await S.call('otpRequest', PH['U-T6'])).error), 'OTP hourly limit');
// OTP หมดอายุ 5 นาที
shift += 3600000 + 61000;
await S.call('otpRequest', PH['U-T6']);
const otp6 = /: (\d{6}) /.exec(smsBox()[smsBox().length - 1].text)[1];
shift += 5 * 60000 + 1000;
ok(!(await S.call('otpVerify', PH['U-T6'], otp6)).ok, 'OTP expires after 5 minutes');
Date.now = realNow;
eq((await S.call('api', 'deadbeef', 'home', {})).code, 'AUTH', 'bad token → AUTH');

// รหัสกู้คืน CEO/ผู้จัดการ
await throws(A('U-T3', 'me.recovery'), /สิทธิ์/, 'tech has no recovery code');
const rc = await A('U-MGR', 'me.recovery');
ok(/^\d{5}-\d{5}$/.test(rc.code), 'recovery code format');
ok(!(await S.call('recoveryLogin', PH['U-MGR'], '0000000000')).ok, 'wrong recovery code');
const rl = await S.call('recoveryLogin', PH['U-MGR'], rc.code);
ok(rl.ok && rl.data.recovery_used && rl.data.user.has_recovery === false, 'recovery login works, single-use');
ok(!(await S.call('recoveryLogin', PH['U-MGR'], rc.code)).ok, 'recovery code cannot be reused');
ok(!(await S.call('recoveryLogin', PH['U-T3'], rc.code)).ok, 'recovery not for tech');
// ผู้จัดการ: จัดการบัญชีช่างได้ แต่ไม่ใช่ผู้บริหาร
await A('U-MGR', 'users.tempCode', { user_id: 'U-T4' });
await throws(A('U-MGR', 'users.tempCode', { user_id: 'U-CEO' }), /เฉพาะ CEO/, 'manager cannot issue code for CEO');
await throws(A('U-MGR', 'users.save', { name: 'x', role: 'MANAGER', phone: '0819999999' }), /เฉพาะ CEO/, 'manager cannot create manager');
await throws(A('U-SALES1', 'users.list'), /สิทธิ์/, 'sales cannot list users');

// ---------- bootstrap / roles
const bs = await A('U-T3', 'bootstrap');
ok(bs.settings.fixed_per_td === undefined, 'tech cannot see fixed_per_td');
ok(Number((await A('U-MGR', 'bootstrap')).settings.fixed_per_td) > 0, 'manager sees fixed_per_td');
await throws(A('U-T3', 'quotes.list'), /สิทธิ์/, 'tech cannot list quotes');
await throws(A('U-SALES1', 'dashboard'), /สิทธิ์/, 'sales cannot open dashboard');

// ---------- Sales: lead + new customer
const lead = await A('U-SALES1', 'leads.save', { cust_name: '=HYPERLINK("http://x")', cust_type: 'B2B', site: 'อาคารทดสอบ ชั้น 3', contact: 'คุณเอ', phone: '0812345678',
  source: 'โทรเข้า', job_type: 'ล้าง', units: 4, est_value: 3000, answers: { type: 'ติดผนัง', qty: '4 เครื่อง 12000', access: 'ชั้น 3 สูง 2.5 ม.' }, next_date: today(), next_action: 'โทรยืนยัน' });
ok(/^L\d{4}-\d{4}$/.test(lead.lead_id), 'lead id format ' + lead.lead_id);
eq(lead.lane, 'F', 'lane F for 4 units');
eq((await row('Leads', 'lead_id', lead.lead_id)).cust_name, '=HYPERLINK("http://x")', 'text stored literally');
const cust = await row('Customers', 'cust_id', lead.cust_id);
ok(cust && /^C\d{4}-\d{3}$/.test(cust.cust_id), 'customer auto-created ' + lead.cust_id);
eq(String(cust.phone), '0812345678', 'phone keeps leading zero');
await throws(A('U-SALES1', 'leads.stage', { lead_id: lead.lead_id, stage: 'QUOTE' }), /symptom/, 'QUOTE blocked until 8 questions complete');
await A('U-SALES1', 'leads.save', { lead_id: lead.lead_id, cust_id: lead.cust_id, cust_name: 'x', site: 'อาคารทดสอบ ชั้น 3', contact: 'คุณเอ', phone: '0812345678', job_type: 'ล้าง', units: 4,
  answers: { type: 'ติดผนัง', qty: '4 เครื่อง 12000', access: 'ชั้น 3', symptom: 'ล้างประจำปี' } });
await A('U-SALES1', 'leads.stage', { lead_id: lead.lead_id, stage: 'QUOTE' });
await throws(A('U-SALES2', 'leads.get', { lead_id: lead.lead_id }), /ไม่ใช่ Lead/, 'other sales cannot open lead');
eq((await A('U-SALES1', 'home')).followups.length, 1, 'sales follow-up today');
const lp = await A('U-SALES1', 'leads.photo', { lead_id: lead.lead_id, data: 'data:image/jpeg;base64,' + Buffer.from('leadphoto').toString('base64') });
ok(lp, 'lead photo uploaded');

// ---------- Back office: quote
eq((await A('U-BO', 'home')).leadsWaitingQuote.length, 1, 'backoffice sees lead waiting quote');
const found = await A('U-BO', 'catalog.search', { q: 'C1', category: 'ล้าง' });
ok(found.length > 0 && found[0].cost === undefined, 'catalog search hides cost from backoffice');
eq((await A('U-BO', 'catalog.search', { ids: ['CL-0001', 'NOPE'] })).length, 1, 'catalog by ids');
let q = await A('U-BO', 'quotes.save', { lead_id: lead.lead_id, payment: 'เครดิต 30 วัน', price_level: 'std', lines: [{ item_id: 'CL-0001', qty: 4 }], scope_note: 'ล้าง 4 เครื่อง', exclusions: 'ไม่รวมอะไหล่' });
eq(q.status, 'DRAFT', 'quote draft');
eq(q.net, 2600, 'net = 4 × 650');
eq(q.gate_minbill, 'FAIL', 'B2B min bill fails at 2600');
ok(q.est_cost === undefined && q.lines[0].cost === undefined, 'backoffice cannot see cost');
await throws(A('U-BO', 'quotes.submit', { quote_id: q.quote_id }), /Minimum Bill/, 'submit below min bill needs reason');
q = await A('U-BO', 'quotes.save', { quote_id: q.quote_id, lead_id: lead.lead_id, payment: 'เครดิต 30 วัน', price_level: 'std',
  lines: [{ item_id: 'CL-0001', qty: 8 }, { description: 'ค่าเดินทางพื้นที่พิเศษ', qty: 1, unit: 'เที่ยว', price: 500, team_day: 0 }] });
eq(q.net, 5700, 'net 8×650+500');
eq(q.gate_minbill, 'PASS', 'min bill passes');
await A('U-BO', 'quotes.submit', { quote_id: q.quote_id });
await throws(A('U-SALES1', 'quotes.approve', { quote_id: q.quote_id }), /สิทธิ์/, 'sales cannot approve');
const mh = await A('U-MGR', 'home');
eq(mh.approvals.length, 1, 'manager sees approval');
ok(mh.approvals[0].contrib_td !== undefined, 'manager sees contrib_td');
const qm = await A('U-MGR', 'quotes.get', { quote_id: q.quote_id });
ok(qm.est_cost > 0 && qm.lines[0].cost > 0, 'manager sees cost');
await A('U-MGR', 'quotes.approve', { quote_id: q.quote_id, note: 'ok' });
const qs = await A('U-SALES1', 'quotes.get', { quote_id: q.quote_id });
ok(S.linkRe.test(qs.link), 'customer link: ' + qs.link);

// ---------- customer link (public)
const token = qs.link.split('quote=')[1];
const pv = await S.call('publicQuote', token);
ok(pv.ok && pv.data.can_ack && pv.data.lines.length === 2, 'public quote view');
ok(JSON.stringify(pv.data).indexOf('cost') < 0 && JSON.stringify(pv.data).indexOf('contrib') < 0, 'public view leaks no cost/contrib');
ok(!(await S.call('publicQuote', 'abc')).ok, 'invalid token rejected');
ok(!(await S.call('publicAck', token, '', '')).ok, 'ack requires name');
const ack = await S.call('publicAck', token, 'คุณเอ ฝ่ายอาคาร', 'สะดวกเสาร์');
ok(ack.ok && ack.data.status === 'ACCEPTED', 'customer acknowledged');
ok(!(await S.call('publicAck', token, 'again', '')).ok, 'cannot ack twice');
eq((await A('U-SALES1', 'home')).accepted.length, 1, 'sales sees accepted');

// ---------- won → job
const won = await A('U-SALES1', 'quotes.won', { quote_id: q.quote_id });
ok(/^J\d{4}-\d{4}$/.test(won.job_id), 'job created ' + won.job_id);
const JOB = won.job_id;
eq((await row('Leads', 'lead_id', lead.lead_id)).stage, 'WON', 'lead WON');
let q2 = await A('U-BO', 'quotes.save', { cust_id: 'C0001', job_type: 'ติดตั้ง', payment: 'เงินสด', price_level: 'project', lines: [{ item_id: 'CL-0001', qty: 10, price: 400 }] });
eq(q2.approval_level, 'CEO', 'below project floor → CEO approval');
await A('U-BO', 'quotes.submit', { quote_id: q2.quote_id, reason: 'ราคาโครงการ ลูกค้าประจำ' });
await throws(A('U-MGR', 'quotes.approve', { quote_id: q2.quote_id }), /CEO/, 'manager cannot approve CEO-level');
await A('U-CEO', 'quotes.approve', { quote_id: q2.quote_id });
await throws(A('U-BO', 'quotes.won', { quote_id: q2.quote_id }), /PO/, 'B2B won requires PO');
const won2 = await A('U-BO', 'quotes.won', { quote_id: q2.quote_id, po: 'PO-123' });

// ---------- plan & release
const tm = addDays(today(), 1);
eq((await A('U-MGR', 'plan.get', { date: tm })).waiting.length, 2, 'two jobs waiting plan');
await A('U-MGR', 'plan.assign', { job_id: JOB, team: 'ทีม 1', date: tm, time: '09:00', seq: 1 });
await A('U-MGR', 'plan.assign', { job_id: won2.job_id, team: 'ทีม 2', date: today(), time: '13:00', seq: 1 });
eq((await A('U-T1', 'jobs.mine')).length, 0, 'tech does not see unreleased tomorrow job');
ok((await A('U-MGR', 'home')).alerts.some(a => /ปล่อยแผนงานพรุ่งนี้/.test(a.text)), 'alert: tomorrow not released');
const rel = await A('U-MGR', 'plan.release', { date: tm });
ok(/ทีม 1/.test(rel.text) && rel.text.indexOf(JOB) > 0 && rel.count === 1, 'release text contains job');
const mine = await A('U-T1', 'jobs.mine');
eq(mine.length, 1, 'tech sees released job');
ok(mine[0].amount === undefined, 'tech cannot see price in list');
const jt = await A('U-T3', 'jobs.get', { job_id: JOB });
ok(jt.amount === undefined && jt.est_cost === undefined, 'tech cannot see price in detail');
eq(jt.checklist.length, CHECKLISTS['ล้าง'].length, 'checklist from job type');
await throws(A('U-T2', 'jobs.get', { job_id: JOB }), /ทีม/, 'other team cannot open job');
eq((await A('U-T2', 'jobs.mine')).length, 1, 'team 2 sees today job');

// ---------- field work
await A('U-T1', 'jobs.start', { job_id: JOB });
await throws(A('U-T1', 'jobs.close', { job_id: JOB }), /รูปหลัง/, 'close requires after photo');
const jpg = Buffer.from('ffd8ffe000104a464946', 'hex');
const px = 'data:image/jpeg;base64,' + jpg.toString('base64');
await A('U-T1', 'jobs.photo', { job_id: JOB, kind: 'before', data: px });
await A('U-T1', 'jobs.photo', { job_id: JOB, kind: 'after', data: px });
await throws(A('U-T1', 'jobs.photo', { job_id: JOB, kind: 'after', data: 'data:text/html;base64,PHNjcmlwdD4=' }), /ไม่ถูกต้อง/, 'reject non-image upload');
await throws(A('U-T1', 'jobs.close', { job_id: JOB }), /ลายเซ็น/, 'close requires signature or reason');
await throws(A('U-T1', 'jobs.close', { job_id: JOB, no_sign_reason: 'ลูกค้าไม่อยู่' }), /เช็กลิสต์/, 'close requires checklist');
const cl = jt.checklist.map((c, i) => ({ t: c.t, d: i !== 5, n: i === 5 ? 'คอยล์ร้อนอยู่สูงเข้าไม่ได้' : '' }));
await A('U-T1', 'jobs.save', { job_id: JOB, checklist: cl, measures: { pressure: '120', current: '4.2' }, materials: [{ name: 'น้ำยาล้าง', qty: 1, unit: 'ขวด' }], extra_found: 'ห้องประชุม คาปาซิเตอร์บวม' });
await A('U-T1', 'assets.save', { job_id: JOB, location: 'ห้องประชุม', brand: 'Daikin', model: 'FTKM12', btu: '12000' });
await A('U-T1', 'jobs.photo', { job_id: JOB, kind: 'signature', data: 'data:image/png;base64,' + Buffer.from('sig').toString('base64'), signer: 'คุณเอ' });
const jg = await A('U-T1', 'jobs.get', { job_id: JOB });
eq([jg.photos_before.length, jg.photos_after.length, !!jg.signature], [1, 1, true], 'photos and signature stored');
const pid = jg.photos_after[0];
ok(S.hasFile(pid), 'photo in storage');
eq(await A('U-T1', 'photo.get', { id: pid }), px, 'photo readable by team (same bytes)');
await throws(A('U-T2', 'photo.get', { id: pid }), /ทีม/, 'photo blocked for other team');
const closed = await A('U-T1', 'jobs.close', { job_id: JOB, next_service: addDays(today(), 180) });
eq(closed.status, 'DONE', 'job done');
eq(closed.bill_status, 'WAIT_SEND', 'job enters WAIT_SEND');
const newLead = (await rows('Leads')).filter(l => l.source === 'ช่างพบหน้างาน');
eq(newLead.length, 1, 'extra_found becomes lead for sales');
eq(newLead[0].owner_id, 'U-SALES1', 'lead goes to account owner');
await throws(A('U-T1', 'jobs.save', { job_id: JOB, extra_found: 'x' }), /ปิดแล้ว/, 'cannot edit closed job');

// ---------- billing tracker
eq((await A('U-BO', 'billing.list', { status: 'WAIT_SEND' })).length, 1, 'one job waiting send');
const sent = await A('U-BO', 'billing.sent', { job_ids: [JOB] });
ok(sent.count === 1 && sent.total === 5700 && /ส่งงานให้ฝ่ายบัญชี/.test(sent.text), 'billing sent summary');
await throws(A('U-BO', 'billing.paid', { job_id: JOB }), /เลขบิล/, 'paid requires bill no first');
const billed = await A('U-BO', 'billing.billed', { job_id: JOB, bill_no: 'INV-6610-001' });
eq(billed.due_date, addDays(today(), 30), 'due date from credit 30 days');
await A('U-BO', 'billing.paid', { job_id: JOB });
eq((await row('Jobs', 'job_id', JOB)).bill_status, 'PAID', 'paid');
await throws(A('U-T1', 'billing.list', {}), /สิทธิ์/, 'tech cannot see billing');

// ---------- warranty case
const kase = await A('U-SALES1', 'cases.open', { job_id: JOB, symptom: 'น้ำหยดหลังล้าง 3 วัน' });
const dec = await A('U-MGR', 'cases.decide', { case_id: kase.case_id, class: 'ฝีมือ', decision: 'รับประกัน', root_cause: 'ท่อน้ำทิ้งหลุด', create_job: 'Y' });
ok(dec.job_id, 'fix job created');
await A('U-MGR', 'plan.assign', { job_id: dec.job_id, team: 'ทีม 1', date: today(), time: '15:00', seq: 2 });
const fj = await A('U-T1', 'jobs.get', { job_id: dec.job_id });
await A('U-T1', 'jobs.photo', { job_id: dec.job_id, kind: 'after', data: px });
await A('U-T1', 'jobs.save', { job_id: dec.job_id, checklist: fj.checklist.map(c => ({ t: c.t, d: true })) });
eq((await A('U-T1', 'jobs.close', { job_id: dec.job_id, no_sign_reason: 'ลูกค้าไม่อยู่' })).bill_status, 'NOBILL', 'warranty fix job → NOBILL');
await A('U-MGR', 'cases.close', { case_id: kase.case_id, cost: 350 });

// ---------- survey job
const sl = await A('U-SALES2', 'leads.save', { cust_name: 'บ้านคุณบี', cust_type: 'B2C', site: 'บางนา', job_type: 'ติดตั้ง', units: 2, answers: { unknown: 'Y' } });
await A('U-SALES2', 'leads.stage', { lead_id: sl.lead_id, stage: 'SURVEY' });
const sj = await A('U-MGR', 'jobs.create', { cust_id: sl.cust_id, job_type: 'สำรวจ', scope: 'วัดระยะท่อ', amount: 0, reason: 'สำรวจจาก Lead', lead_id: sl.lead_id });
ok((await row('Leads', 'lead_id', sl.lead_id)).next_action.indexOf(sj.job_id) > 0, 'lead linked to survey job');
await throws(A('U-MGR', 'jobs.create', { cust_id: sl.cust_id }), /เหตุผล/, 'manual job requires reason');

// ---------- contracts
const k = await A('U-SALES1', 'contracts.save', { cust_id: lead.cust_id, start_date: today(), end_date: addDays(today(), 364), value: 24000, units: 8, visits: 2, bill_cycle: 'ต่อรอบ' });
eq(k.interval_months, 6, 'interval defaults to 12/visits');
const gen = await A('U-MGR', 'contracts.generate', {});
eq(gen.created, 1, 'visit generated');
eq((await A('U-MGR', 'contracts.generate', {})).created, 0, 'no duplicate visit');
eq(Number((await row('Jobs', 'job_id', gen.job_ids[0])).amount), 12000, 'per-visit amount = value/visits');
ok((await A('U-MGR', 'home')).alerts.some(a => /สัญญาถึงรอบวางบิล/.test(a.text)), 'contract billing alert');
eq((await A('U-BO', 'contracts.billed', { contract_id: k.contract_id, bill_no: 'INV-K1' })).next_bill, addMonths(today(), 6), 'next bill moves 6 months');

// ---------- dashboard
const d = await A('U-CEO', 'dashboard', {});
eq(d.revenue, 5700, 'dashboard revenue counts done jobs');
eq(d.jobs_done, 2, 'two jobs done this month');
ok(d.by_type.length >= 1 && d.sales.length === 2, 'dashboard breakdowns');
eq(d.rework_pct, 50, 'rework % = 1 case / 2 done');

// ---------- revise flow
let q3 = await A('U-BO', 'quotes.save', { cust_id: 'C0002', job_type: 'ซ่อม', payment: 'เงินสด', lines: [{ item_id: 'CL-0001', qty: 2 }] });
await A('U-BO', 'quotes.submit', { quote_id: q3.quote_id });
await A('U-MGR', 'quotes.reject', { quote_id: q3.quote_id, note: 'เพิ่มค่าตรวจเช็ก' });
const rv = await A('U-BO', 'quotes.revise', { quote_id: q3.quote_id });
const rq = await A('U-BO', 'quotes.get', { quote_id: rv.quote_id });
eq([rq.rev, rq.status, rq.lines.length], [1, 'DRAFT', 1], 'revision copies lines as draft');
eq((await row('Quotes', 'quote_id', q3.quote_id)).status, 'SUPERSEDED', 'old quote superseded');
eq((await rows('QuoteLines')).filter(l => l.quote_id === rv.quote_id).length, 1, 'lines persisted for revision');

// ---------- users & settings
const nu = await A('U-CEO', 'users.save', { name: 'ช่างใหม่', role: 'TECH', team: 'ทีม 2', phone: '0619998888' });
ok(/^U\d{4}-\d{3}$/.test(nu.user_id) && nu.phone_masked === '061-xxx-8888', 'new user created with phone');
await throws(A('U-CEO', 'users.save', { name: 'x', role: 'TECH', team: 'ทีม 9', phone: '0619998887' }), /ทีม/, 'tech needs valid team');
await throws(A('U-T1', 'users.save', { name: 'x', role: 'TECH', team: 'ทีม 1', phone: '0619998886' }), /สิทธิ์/, 'tech cannot create users');
const s2 = await A('U-CEO', 'settings.save', { monthly_target: 1000000, evil_key: 'x' });
eq(Number(s2.monthly_target), 1000000, 'settings saved');
ok(s2.evil_key === undefined, 'unknown settings ignored');
ok((await A('U-T1', 'jobs.mine')).every(j => j.payment === undefined), 'tech does not see payment terms');

// ---------- token lifetime, revocation, inactive user
Date.now = () => realNow() + 7 * 3600 * 1000;
ok((await S.call('api', T['U-T3'], 'home', {})).ok, 'token still valid after 7h');
Date.now = () => realNow() + 31 * 86400000;
eq((await S.call('api', T['U-T3'], 'home', {})).code, 'AUTH', 'token expires after 30 days');
Date.now = realNow;
eq((await S.call('api', 'U-T3.zzzz.' + 'a'.repeat(64), 'home', {})).code, 'AUTH', 'forged token rejected');
eq((await S.call('api', T['U-T3'].replace(/^U-T3/, 'U-CEO'), 'home', {})).code, 'AUTH', 'token with swapped user rejected');
await A('U-MGR', 'users.revoke', { user_id: 'U-T3' });
eq((await S.call('api', T['U-T3'], 'home', {})).code, 'AUTH', 'revoke logs user out everywhere');
const la = await A('U-SALES2', 'me.logoutAll');
eq((await S.call('api', T['U-SALES2'], 'home', {})).code, 'AUTH', 'logoutAll revokes old token');
ok((await S.call('api', la.token, 'home', {})).ok, 'logoutAll gives this device a new token');
await A('U-CEO', 'users.save', { user_id: 'U-T1', name: 'ตาม', role: 'LEAD', team: 'ทีม 1', phone: PH['U-T1'], active: 'N' });
eq((await S.call('api', T['U-T1'], 'home', {})).code, 'AUTH', 'deactivated user logged out');
ok(/ยังไม่มีบัญชี/.test((await S.call('otpRequest', PH['U-T1'])).error), 'deactivated user cannot request OTP');
await S.wipeCache();
ok((await S.call('api', T['U-MGR'], 'home', {})).ok, 'session survives cache wipe');

if (S.http) {
// ---------- HTTP layer
const bad = await fetch(S.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fn: 'saveUser', args: [] }) });
eq(bad.status, 400, 'internal function not callable over HTTP');
const pre = await fetch(S.url, { method: 'OPTIONS' });
eq([pre.status, pre.headers.get('access-control-allow-origin')], [204, '*'], 'CORS preflight');
}
// ไม่มีข้อมูลค้างจากการรันซ้ำ: log มีครบตามลำดับ และไม่มีแถวซ้ำ
const logs = await rows('Log');
ok(logs.filter(l => l.action === 'job.close').length === 2, 'no duplicate writes from re-runs');
const ids = (await rows('Jobs')).map(j => j.job_id);
eq(ids.length, new Set(ids).size, 'job ids unique');

console.log(`\n${pass} passed, ${fail} failed`);
await S.stop();
process.exit(fail ? 1 : 0);

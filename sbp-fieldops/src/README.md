# SBP FieldOps v2 — ระบบงานบริการแอร์ บริษัท สหบูรพากรุ๊ป จำกัด

เว็บระบบสำหรับทีมบริการ: ลีด → ใบเสนอราคา → อนุมัติ → จัดทีม → แผนงานช่าง → ปิดงาน (รูป/ลายเซ็น/เช็กลิสต์) → ติดตามวางบิล → เคสประกัน → สัญญา PM → แดชบอร์ด
เข้าระบบด้วย **เบอร์มือถือ + OTP** (ThaiBulkSMS) อยู่ในระบบได้ 30 วันต่อเครื่อง

## โครงสร้าง

| ส่วน | อยู่ที่ | ทำหน้าที่ |
| --- | --- | --- |
| หน้าเว็บ | `web/` → Cloudflare Pages | แอปมือถือทุกบทบาท + หน้าใบเสนอราคาลูกค้า (`/?quote=...`) |
| หลังบ้าน | `supabase/functions/api/` → Supabase Edge Function | สิทธิ์ ด่านกำไร ตรรกะงานทั้งหมด |
| ฐานข้อมูล | Supabase Postgres (schema `sbp`) | 1 ตารางต่อเรื่อง (`users`, `jobs`, `quotes` …) เก็บเป็น JSONB |
| รูปหน้างาน | Supabase Storage bucket `photos` (ส่วนตัว) | เปิดได้ผ่านระบบเท่านั้น |

ไฟล์หลังบ้าน
- `core.js` — ตรรกะธุรกิจ (ยกจากระบบ Google เดิมที่ทดสอบแล้ว) + บัญชี OTP
- `engine.js` — โหลดข้อมูล รัน core บันทึกในธุรกรรมเดียว (คำขอเขียนเข้าคิวทีละคำขอ ข้อมูลไม่ชน)
- `bootstrap.js` — สร้างตาราง + ข้อมูลตั้งต้นครั้งแรก (ผู้ใช้ 11 · ลูกค้า 59 · ราคา 1,076)
- `adapters.js` — Supabase Storage, ThaiBulkSMS
- `server.js` / `index.ts` — รับคำขอ `POST {fn, args}`

## การอัปเดตระบบ
push เข้า `main` → GitHub Actions deploy หลังบ้านให้เอง (`.github/workflows/deploy.yml`) · หน้าเว็บ Cloudflare Pages deploy เองจาก `web/`

## ตั้งค่าที่ต้องทำครั้งเดียว
1. GitHub secret `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access Tokens)
2. แก้ `PROJECT_REF` ใน workflow และ `web/config.js`
3. Cloudflare Pages: เชื่อม repo · Build command ว่าง · Build output directory `web`
4. SMS (เมื่อพร้อม): Supabase → Edge Functions → Secrets
   - `THAIBULKSMS_KEY`, `THAIBULKSMS_SECRET`, `THAIBULKSMS_SENDER` (ชื่อผู้ส่งที่อนุมัติแล้ว)
   - ก่อนเชื่อม SMS: ผู้จัดการ/CEO กด "ออกรหัสเข้าใช้" ให้ทีม (6 หลัก ใช้ครั้งเดียว 12 ชม.)

## เข้าระบบครั้งแรก
เปิดเว็บ → หน้า "ตั้งค่าระบบครั้งแรก" → ใส่รหัสตั้งค่า 8 หลัก (ส่งให้เจ้าของแบบส่วนตัว) + เบอร์ CEO → เข้าเป็น CEO → สร้างรหัสกู้คืน → ใส่เบอร์ทีมในหน้า "ผู้ใช้และบัญชี"

## ทดสอบในเครื่อง
```
npm i
node test/e2e.mjs     # หลังบ้าน 164 จุด บน Postgres จริง
node test/ui.mjs      # หน้าเว็บจริงบน Chromium ทุกบทบาท
node test/deno-run.mjs  # ตรวจรันบน Deno (runtime เดียวกับ Supabase)
```

## ความปลอดภัย
- ตารางอยู่ใน schema `sbp` เปิด RLS และถอนสิทธิ์ anon/authenticated — เข้าได้ทาง Edge Function เท่านั้น
- OTP 5 นาที · ขอใหม่ได้ทุก 60 วินาที · ไม่เกิน 5 ครั้ง/ชม. · ใส่ผิด 5 ครั้งล็อก 15 นาที
- เก็บเฉพาะค่าแฮชของ OTP / รหัสชั่วคราว / รหัสกู้คืน
- บัตรผ่านลงลายเซ็น HMAC 30 วัน · ตัดการเข้าระบบรายคนได้ทันที (`session_ver`)
- ช่างไม่เห็นราคา/ต้นทุน/เงื่อนไขชำระเงิน · หน้าลูกค้าไม่มีต้นทุน

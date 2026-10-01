# Jeno-Project

Repo รวมงานหลายโปรเจกต์ — แต่ละโปรเจกต์อยู่ในโฟลเดอร์ของตัวเอง

## sbp-aircare/ — เว็บต้นแบบ SBP AirCare (แบบ A · B · C)

**อ่าน `sbp-aircare/CLAUDE.md` ให้ครบก่อนแก้อะไรในโฟลเดอร์นั้น** (สเปก, API ของโมดูล, กฎธุรกิจ §6.6, งานค้าง §7, roadmap §8)

- ทุกคำสั่ง npm / python รันใน `sbp-aircare/` (`cd sbp-aircare`)
- dev server: `npm run serve` → http://localhost:8765/a.html · b.html · c.html · preview.html
- ตรวจทุกครั้งที่แก้: `npm run smoke && npm run smoke:mobile && npm run textscan` · แตะข้อมูลราคา → `npm run recon` ต้องได้ `"mismatches": 0`
- build ไฟล์เดียว: `npm run build` → `dist/offline/*`, `dist/art/*` (gitignored)
- บน Claude Code web: hook `.claude/hooks/session-start.sh` ติดตั้ง npm + esbuild ให้เอง · Chromium อยู่ที่ `/opt/pw-browsers` — **ห้ามรัน `npx playwright install`**
- ⛔ `sbp-aircare/internal/sbp_real.json` (มีอัตราพิเศษ/โครงการ) **ห้าม commit / ห้ามเผยแพร่** — gitignored, เจ้าของอัปโหลดให้ในแต่ละ session เมื่อต้องรัน recon
- ⛔ ห้ามแก้ราคาหรือกฎธุรกิจใน `sbp-aircare/CLAUDE.md` §6.6 โดยไม่มีคำอนุมัติเป็นลายลักษณ์อักษรจากเจ้าของ
- หน้าทดสอบ A/B/C และหน้า a/b/c ที่เผยแพร่แล้ว (URL ใน `sbp-aircare/urls.json`) เป็นลิงก์ "ทุกคนที่มีลิงก์" — คนดูเห็นการอัปเดตทันที อย่า publish ทับโดยไม่ได้รับคำสั่ง
- ชุดทดลองพัฒนา (private, URL ใน `sbp-aircare/urls.dev.json`): `npm run build:dev` แล้ว publish `dist/art/{a,b,c,index}.html` ทับ URL ชุดนั้น · `npm run build` = ลิงก์ชุดที่แชร์อยู่
- ตอบผู้ใช้เป็นภาษาไทย

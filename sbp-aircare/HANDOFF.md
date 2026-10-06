# HANDOFF.md — SBP AirCare Website (ต้นแบบ A · B · C) · ส่งต่องาน

> **อ่านไฟล์นี้ก่อนไฟล์อื่น** — สรุปทุกอย่างที่ต้องรู้เพื่อพัฒนาต่อได้ทันที (สถานะ ณ **6 ต.ค. 2569 · Rev.09 r15**)
> รายละเอียดเชิงลึก (API ทุกโมดูล, สัญญา 3 มิติ, โค้ดกฎธุรกิจ, build.py เต็ม) อยู่ใน [`CLAUDE.md`](CLAUDE.md) · แผนส่งมอบทีม Dev ฉบับเต็มอยู่ใน [`SBP-WEB-011_Dev_Handoff_Plan.md`](SBP-WEB-011_Dev_Handoff_Plan.md)
> เจ้าของงาน: บริษัท สหบูรพากรุ๊ป จำกัด (แบรนด์ SBP AirCare / บริการ Sahaburapa Service) · repo `jenokubz-rgb/Jeno-Project` โฟลเดอร์ `sbp-aircare/`

---

## 0. สิ่งที่ต้องรู้ก่อนเริ่ม (อ่าน 1 นาที)

| เรื่อง | สถานะจริง ณ ตอนนี้ |
|---|---|
| **ซอร์สโค้ดอยู่ที่ไหน** | ★r14 **ขึ้น GitHub แล้ว** — repo `jenokubz-rgb/Jeno-Project` (Public ตามที่เจ้าของสั่ง 6 ต.ค. 2569: "Push และแก้ไขเป็น public เลย") branch `claude/funny-meitner-7fb8e4` โฟลเดอร์ `sbp-aircare/` · ไม่มีไฟล์ภายใน: `internal/`, `dist/`, `node_modules/` อยู่ใน `.gitignore` · ⚠️ repo เป็นสาธารณะ: ห้าม commit ตัวเลขต้นทุน กำไร ส่วนต่างเหนืออัตราพิเศษ หรือไฟล์ภายในใด ๆ |
| **เป็นเว็บแบบไหน** | ต้นแบบ (prototype) 4 แบบที่ใช้โมดูลร่วมกัน ต่างกันที่ภาษาภาพ — **เจ้าของยังไม่เลือกแบบ** · ★r11 แบบ D · Studio = หน้าเดียวโหลดเร็ว มี "ใบงาน" คำนวณราคาแล้วจองคิว (`d.html`) · ★r12 **รุ่นที่ 2 A2 · B2 · C2 · D2** = ภาพ 3 มิติแบบภาพยนตร์ + ปรึกษาอาการ + ลองแอร์ได้ทุกรุ่น (รุ่นแรก a/b/c/d ยังอยู่ครบ ไม่ถูกแก้) · ★r13 **รุ่นที่ 3 A3 · B3 · C3** = โทนสว่าง ภาพถ่ายประกอบ 9 หน้าตามงาน เนื้อหาครบเท่า A/B/C (เจ้าของเห็นว่ารุ่น 2 ไม่สวย ไม่เสมือนจริง) + หน้าเทียบกับต้นฉบับ (`index3`) · ★r14 **ตรวจพร้อมทดลองใช้ทั้ง 11 แบบ** — เริ่มที่หน้ารวมทดลองใช้ `index3` (ทุกแบบ + 6 งานให้ผู้ทดลองลองทำ) · ทุกแบบมีแถบ Beta + ฟอร์มให้ความเห็น |
| **มี backend ไหม** | ★r10 **มีแบบเบา: Google Sheet + Apps Script** (`backoffice/`) รับ ticket จองคิว/ใบเสนอราคา/ติดต่อ/ความเห็น + หน้าหลังบ้าน `backoffice.html` — **โค้ดพร้อม ทดสอบผ่านใน emulator แต่ยังไม่ได้ติดตั้งในบัญชี Google ของบริษัท** (`TICKET_ENDPOINT` ว่าง = เว็บแสดงสรุปให้ลูกค้าส่งเอง) · ราคาเป็นไฟล์ JSON · ไม่มี database อื่น · วิธีติดตั้ง `backoffice/README.md` |
| **Deploy ที่ไหน** | Claude Artifacts (หน้าเดียว ไฟล์เดียว ~2.7–2.9 MB ต่อแบบ) — ดู §6 |
| **ห้ามทำ** | แก้ราคา/กฎธุรกิจ (§7) · commit/เผยแพร่ `internal/sbp_real.json` · publish ทับลิงก์ชุดที่แชร์อยู่โดยไม่ได้รับคำสั่ง · รัน `npx playwright install` บน Claude Code web · ใส่โลโก้เลียนแบบ |
| **ทดสอบความลื่น / 3 มิติทุกรุ่น** | ★r15 ทุกแบบมีปุ่ม **"ทดสอบความลื่น"** ในแถบ Beta (หรือเติม `#perftest` ท้ายลิงก์) → ตัวเลขสด, ทัวร์อัตโนมัติ, ไล่ครบ 705 รุ่น, ส่งผลให้ทีม · หน้ารายละเอียดสินค้าทุกแบบมี **"ดูรุ่นนี้แบบ 3 มิติ"** (`model3d.js`) · ความละเอียดปรับเองตามเครื่อง + เตรียม shader ล่วงหน้า (`gl-pool.js`) — ดู CLAUDE.md §7.1b รอบ 15 |
| **ภาษา** | ข้อความที่ผู้ใช้เห็น = ไทย · คอมเมนต์โค้ด = อังกฤษ · ตอบเจ้าของเป็นภาษาไทย |

---

## 1. Tech Stack & Dependencies

### 1.1 ที่ใช้จริงในโค้ดตอนนี้

| ชั้น | ใช้อะไร | เวอร์ชัน | หมายเหตุ |
|---|---|---|---|
| ภาษา | HTML5 · CSS (custom properties) · **JavaScript ES modules (ES2022)** | — | ไม่มี TypeScript / JSX / transpile ตอน dev |
| Framework | **ไม่มี** (vanilla DOM) | — | สร้าง DOM ด้วย `h(tag, attrs, ...kids)`, `$()`, `$$()` จาก `assets/sbp-core.js` · ทุกโมดูล UI เป็น `mountX(root, cfg)` |
| CSS framework | **ไม่มี** (ไม่ใช้ Tailwind) | — | token ต่อแบบใน `:root` ของ `a/b/c.html` + alias `--s-*` ให้โมดูลร่วม |
| 3D | **three.js r170** (vendored, ห้ามแก้) | r170 | `assets/three.module.min.js` + addons `GLTFLoader.js`, `RoomEnvironment.js`, `BufferGeometryUtils.js` · ทุกโมเดลสร้างจากโค้ด (procedural) ไม่มีไฟล์ GLB |
| ฟอนต์ | self-hosted woff2 (`assets/fonts/`, `fonts.css`) | — | Anuphan · IBM Plex Sans Thai · IBM Plex Mono · Kanit (แยก subset ไทย/ละติน) — ห้ามโหลดจาก CDN |
| ข้อมูล | `assets/sbp-data.json` (Pricebook สาธารณะ 220 KB) · `assets/thai-provinces.json` (77 จังหวัด, Natural Earth public domain) · `assets/product-media.json` | Pricebook 2569 (29.09.2569) | ไม่มี database |
| Build | **Python 3.11** (`build.py`) + **esbuild 0.28.2** (เรียกผ่าน `npx --yes esbuild@0.28.2`) | 3.11.15 / 0.28.2 | รวมทุกอย่างเป็นไฟล์ HTML เดียว |
| Runtime สำหรับเครื่องมือ | **Node.js 22** | v22.22.0 | ใช้กับเทสต์เท่านั้น (เว็บไม่ต้องมี Node) |
| ทดสอบ | **Playwright 1.56.0** (Chromium + swiftshader) · **axe-core 4.13.0** | ตาม `package.json` devDependencies | `tests/*.mjs` |
| กระทบยอดราคา | `tools_recon.py` (Python ล้วน ไม่มี dependency) | — | ต้องได้ `"mismatches": 0` |
| Hosting | Claude Artifacts | — | ไม่มีโดเมนของตัวเอง |

`package.json` มีแค่ `devDependencies` 2 ตัว (playwright, axe-core) — **ไม่มี runtime dependency** · Python ใช้แค่ standard library

### 1.2 ที่ "แนะนำ" สำหรับเวอร์ชันใช้งานจริง (ยังไม่เริ่ม — อย่าเข้าใจผิดว่ามีแล้ว)

Next.js (App Router) + TypeScript · CSS variables จากต้นแบบ (+ CSS Modules หรือ Tailwind อ่าน token) · PostgreSQL/Supabase + สคริปต์นำเข้า Pricebook จาก Excel · API ใบเสนอราคาคำนวณยอดซ้ำฝั่ง server · Google Distance Matrix · แจ้งเตือนทีมขายผ่าน LINE OA / อีเมล — รายละเอียด `CLAUDE.md` §2.3 และ §8 Step 7

---

## 2. Project Structure

```
Jeno-Project/                      (repo — รวมหลายโปรเจกต์ แต่ตอนนี้มีโปรเจกต์เดียว)
├── README.md · CLAUDE.md          ภาพรวม repo + กฎระดับ repo (อ่าน sbp-aircare/CLAUDE.md ก่อนแก้)
├── .claude/settings.json          ลงทะเบียน SessionStart hook
├── .claude/hooks/session-start.sh บน Claude Code web: npm install + ดึง esbuild ไว้ล่วงหน้า + เตือนถ้าไม่มี internal/sbp_real.json
└── sbp-aircare/
    ├── HANDOFF.md                 ← ไฟล์นี้
    ├── CLAUDE.md                  สเปกเทคนิคเต็ม (API ทุกโมดูล, กฎ §6.6, บั๊ก §7.2, roadmap §8)
    ├── SBP-WEB-011_Dev_Handoff_Plan.md   แผนส่งมอบทีม Dev ฉบับเต็ม (คำตัดสินเจ้าของ, สเปกฟีเจอร์ 6A–6V, acceptance checklist)
    ├── package.json · package-lock.json  npm scripts + devDependencies
    ├── .gitignore                 node_modules/ dist/ internal/ _entry_*.mjs *.png
    ├── urls.json                  URL ลิงก์ชุดที่แชร์ "ทุกคนที่มีลิงก์" (build แปลงลิงก์ระหว่างหน้า)
    ├── urls.dev.json              URL ลิงก์ชุดทดลองพัฒนา (private)
    ├── build.py                   สร้างไฟล์เดียว → dist/offline/*, dist/art/*
    ├── tools_recon.py             กระทบยอดทุกราคาบนเว็บกับ Pricebook ภายใน
    │
    ├── a.html                     แบบ A · Bento Clean (สว่าง สะอาด แบบแอป) — markup + CSS tokens + <script type="module"> ตัวเดียว (wiring)
    ├── b.html                     แบบ B · Engineering Sheet (แบบวิศวกรรม เน้นองค์กร)
    ├── c.html                     แบบ C · Virtual Showroom (โชว์รูมมืด)
    ├── backoffice.html            ★r10 หน้าหลังบ้าน (ภายใน, noindex): คิวงาน/ticket · กำลังทีม 14 วัน · ยืนยันนัด จัดทีม — build เป็น dist/offline/backoffice.html เท่านั้น (ไม่ทำเป็น Artifact)
    ├── backoffice/                ★r10 ระบบ ticket: README.md (วิธีติดตั้งภาษาไทย) · apps-script/Code.gs + appsscript.json (วางใน Google Apps Script ของชีตบริษัท)
    ├── tools/                     ★r10 gas-emu.mjs (จำลอง Apps Script รัน Code.gs ตัวจริงใน Node) · backoffice-server.mjs (`npm run backoffice` หลังบ้านในเครื่อง + ไฟล์เว็บ)
    ├── preview.html               หน้าทดสอบ A/B/C: สลับแบบ/ขนาดจอ เทียบพร้อมกัน รายการทดลอง 15 ข้อ ให้คะแนน 6 ด้าน
    ├── test-*.html · test3d.html · testroom.html   หน้าทดสอบโมดูลเดี่ยว (debug / screenshot) — test-clean.html, test-ts.html ใช้ window.TS / window.READY
    ├── index.html · hub.tpl.html · hub.tpl2.html · hub-local.html   ⚠️ LEGACY ไม่ได้ใช้ใน build (ลบได้หลังเจ้าของยืนยัน)
    │
    ├── tests/                     Playwright (ต้องเปิด dev server ที่ :8765 ก่อน)
    │   ├── _lib.mjs               launch() แบบ swiftshader + scrollAll()
    │   ├── smoke.mjs              console error, WebGL context (live/peak/created), overflow แนวนอน — ไล่ทุก view
    │   ├── textscan.mjs           คำต้องห้าม / Type L / K Copper / ต้นทุน ในข้อความที่แสดง — ไล่ทุก view
    │   ├── story-shots.mjs · section-shots.mjs · shot.mjs   ถ่ายภาพตรวจงานออกแบบ
    │   ├── backoffice.mjs         ★r10 `npm run test:backoffice` — API หลังบ้าน 44 ข้อ (ไม่ใช้ browser)
    │   ├── booking-e2e.mjs        ★r10 จองคิว → ticket → หน้าหลังบ้าน → ลูกค้าเห็นสถานะ (เปิดเซิร์ฟเวอร์เอง) `node tests/booking-e2e.mjs [page] [width] [theme]`
    │   └── _*.tmp.mjs             สคริปต์ชั่วคราว (ไม่อยู่ใน zip)
    │
    ├── internal/sbp_real.json     ⛔ ไฟล์ภายใน (อัตราพิเศษ/โครงการ) — gitignored ไม่อยู่ใน zip เจ้าของอัปโหลดให้เมื่อต้องรัน recon
    ├── dist/                      ผล build (gitignored)
    │
    └── assets/
        ├── ข้อมูล      sbp-data.json · thai-provinces.json · product-media.json · products/ (รูปสินค้า — ยังว่าง) · logos/ (โลโก้ทางการ — ยังว่าง)
        ├── CSS         shared.css (โมดูลร่วม + site.js) · studio.css · services.css · fonts.css
        ├── แกนกลาง     sbp-core.js   ★ ข้อมูล + กฎธุรกิจ (VAT, โซน, ค่าเดินทาง, แพ็กเกจล้าง, สัญญา, BTU, COMPANY, h/$/$$)
        ├── โครงเว็บ     site.js       ★r5 6 หน้า (views) · เส้นทางลูกค้า · ข้อมูลบริษัท · ฟอร์มความเห็น · footer · ★r6 ค้นหาทั้งเว็บ · ข้อมูลสำคัญต่อหน้า
        │               icons.js      ★r6 ชุดไอคอน SVG เดียวทั้งเว็บ (`icon(name)`, `iconLabel(btn, name, text)`) แทนสัญลักษณ์ตัวอักษร ▶ ❚❚ ✓ ★ ✍
        ├── ขาย/ราคา    proto-ui.js (catalog, contract builder, zone, FAQ, viewer, drawer, toast)
        │               commerce.js (cart ใบเสนอราคา, product detail, price centre, ตารางวัสดุ)
        │               contact.js (ฟอร์มติดต่อ, askTeam, handoffBox สรุปคำขอ Beta, ★r6 guardForm ตรวจช่องกรอกเป็นภาษาไทยข้างช่อง, ★r10 submitTicket · ticketCard · consentBox · honeypot · requestBooking)
        ├── จองคิว      ★r10 ticket.js (TICKET_ENDPOINT + sendTicket / fetchSlots / trackTicket / staffApi) · booking.js + booking.css (ส่วน #booking) · backoffice-board.js (หน้าหลังบ้าน)
        │               journey.js (ตารางค่าเดินทาง, ปุ่มใบเสนอราคาลอย, เมนูมือถือ, แถบขั้นตอนใช้บริการ)
        ├── เนื้อหา      services.js (ขั้นตอนล้าง/ติดตั้ง/ซ่อม ตามแบบฟอร์มบริษัท) · knowledge.js (ศูนย์ความรู้ 12 หัวข้อ) · hw-data.js
        ├── เครื่องมือ    studio.js + studio-model.js + studio3d.js (ห้องจำลอง 48 ห้อง) · roomfit.js + roomfit3d.js + roomplan.js (ลองวางแอร์ในห้อง)
        │               jobguide.js + jobscene3d.js + crew3d.js + brand3d.js (ทีมช่างล้าง/ติดตั้ง 3 มิติ) · product-media.js (รูป/ภาพเรนเดอร์สินค้า)
        ├── 3 มิติ       ac3d.js (ตัวเครื่อง + viewer) · units3d.js · howitworks3d.js · throwsim3d.js · airflow3d.js · wisp3d.js (ลมธรรมชาติ)
        │               install3d.js · tech3d.js · techstory.js [C] · system3d.js + engdraw.js [B] · materials3d.js + matkit3d.js
        │               thaimap3d.js · trunk3d.js · roomkit3d.js · people3d.js · gl-pool.js (งบ WebGL ≤3)
        └── vendored    three.module.min.js · GLTFLoader.js · RoomEnvironment.js · BufferGeometryUtils.js (three.js r170 ห้ามแก้)
```

**ขนาดโค้ด:** ~15,800 บรรทัด (HTML/CSS/JS/Python/เทสต์ ไม่รวม three.js ~6,250 บรรทัด) · โมดูล JS ของโปรเจกต์ 38 ไฟล์ + three.js 4 ไฟล์

**สถาปัตยกรรม:** แต่ละ `a/b/c.html` มี `<script type="module">` ตัวเดียว: `await loadData()` → `await loadMedia()` → mount ทุกโมดูลลงใน section ของตัวเอง → **`mountSite()` ท้ายสุด** (แบ่ง section เป็น 6 หน้า) · โมดูล 3 มิติ boot แบบ lazy ด้วย `IntersectionObserver` (section ในหน้าที่ซ่อนอยู่จึงไม่โหลด 3D) · state อยู่ใน closure ของแต่ละ `mountX` ไม่มี store กลาง ยกเว้น `cart` (singleton + localStorage)

**Data flow ราคา:** Excel Pricebook ของบริษัท → (สคริปต์แปลง ad-hoc ไม่อยู่ใน repo ⚠️) → `assets/sbp-data.json` (สาธารณะ: อัตรามาตรฐาน + รุ่นที่อนุมัติ, `sp`/`pj` = null) + `internal/sbp_real.json` (ภายใน) → `loadData()` แปลงตอนโหลด (K Copper → O-TWO, ซ่อน -MASS / MAT-CU-L-*) → `tools_recon.py` ตรวจ 0 ผิด

**Section id ↔ หน้า (views) ของแต่ละแบบ** (กำหนดใน `mountSite({views})` ท้าย script ของแต่ละหน้า):

| หน้า | A | B (เรียง: หน้าแรก → องค์กร → บริการ → ซื้อ → ความรู้ → ติดต่อ) | C |
|---|---|---|---|
| หน้าแรก `home` | hero · start · flow · services | hero · start · flow | top · start · flow |
| ซื้อแอร์ `shop` | catalog · studio · fit | catalog · fit · studio | catalog · room · fit |
| ล้าง·ติดตั้ง·ซ่อม `service` | cleanflow · prices · quality · story · inside | cleanflow · howto · prices · quality | cleanflow · howto · prices · quality |
| สำหรับองค์กร `business` | b2b | b2b | b2b |
| ความรู้·ลองเอง `knowledge` | learn · howto | learn · inside | journey · learn |
| ติดต่อเรา `contact` | about · area · faq · quote | about · area · faq · quote | about · area · faq · quote |

---

## 3. Core Features & Status

สัญลักษณ์: ✅ เสร็จ (ระดับต้นแบบ ผ่านเทสต์) · 🟡 ใช้งานได้แต่มีข้อจำกัด/รอข้อมูล · ⛔ ยังไม่ทำ · ทุกข้อมีครบ 3 แบบ เว้นแต่ระบุ

### 3.1 โครงเว็บและประสบการณ์ลูกค้า (Rev.09 r5 — `site.js`)

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---|---|---|
| แบ่งเว็บ 6 หน้าตามการตัดสินใจของลูกค้า | ✅ | เมนูหลัก · หัวเรื่อง + ทางกลับหน้าแรก + ปุ่มไปหัวข้อ + การ์ด "ขั้นต่อไป" · ลิงก์ `#id`, `scrollIntoView()` ทุกที่สลับหน้าให้เอง · back/forward · deep link `#prices` ฯลฯ ใช้ได้ · เมนูแท็บเล็ตเป็นแถวที่ 2 · มือถือแถบล่าง เมนู/ติดต่อ/ใบเสนอราคา |
| หน้าแรก "วันนี้ต้องการอะไร" + เส้นทางลูกค้า | ✅ | 5 เส้นทาง (ล้าง · ซื้อ+ติดตั้ง · ติดตั้ง/ย้าย · ซ่อม · องค์กร) + FUJIVA → พาไปทีละขั้น ป้าย "ขั้นที่ n จาก N" + ปุ่มขั้นต่อไป · จำความคืบหน้า `localStorage['sbp-journey-v1']` · ★r6 ทุกการ์ดมีราคาเริ่มต้นจาก Pricebook · แต่ละแบบแสดงต่างกัน: A การ์ดแบบ bento · B ตารางทะเบียนแบบ (รหัส S-01…) · C โซนโชว์รูมกระจกมืด |
| ค้นหาทั้งเว็บ | ✅ | ★r6 ปุ่ม "ค้นหา" บน header หรือกด `/` → หน้า หัวข้อ เส้นทาง 705 รุ่น (ค้นตามขนาด เช่น 12000 = ±12%) ค่าบริการทุกรายการ ความรู้ FAQ → กดแล้วไปที่นั่น/เปิดรายละเอียดรุ่น/เปิดแท็บราคาพร้อมกรอง · ใช้คีย์บอร์ดได้ครบ (combobox + listbox) |
| ข้อมูลสำคัญต่อหน้า | ✅ | ★r6 แถบข้อเท็จจริงใต้หัวเรื่องของทุกหน้า (ราคาเริ่มต้น, จำนวนรุ่น, ยอดขั้นต่ำ, เงื่อนไขรับประกัน) จากข้อมูลชุดเดียวกับเครื่องมือ |
| ข้อมูลบริษัท / ติดต่อ / footer | 🟡 | จาก `COMPANY` ใน `sbp-core.js` (แหล่งเดียว) — **รอเจ้าของยืนยัน** · ยังไม่มีเลขผู้เสียภาษี / LINE OA / เวลาทำการ |
| ★r10 จองคิว (`booking.js` `#booking`) | 🟡 | 4 ขั้นในฟอร์มเดียว: งาน (ล้าง/ติดตั้ง/ซ่อม/ย้าย/สำรวจสัญญา/สำรวจโครงการ) + จำนวนเครื่องต่อประเภท (+ระดับล้าง/แพ็กเกจ, อาการ/รหัส error) → วันที่ (แถบวันว่าง 14 วันเมื่อเชื่อมหลังบ้าน · วันสำรอง · เช้า/บ่าย/นอกเวลา = ประเมินหน้างาน) → สถานที่ (ตรวจพื้นที่ · อาคาร · ข้อจำกัดเข้าพื้นที่) → ผู้ติดต่อ (+ใบกำกับภาษี, แนบรายการใบเสนอราคา) + ยินยอมใช้ข้อมูล → **เลขที่คำขอ SBP-yyMMdd-nnn** + ติดตามสถานะด้วยเลขที่ + เบอร์ · ปุ่ม "จองคิว" จากเส้นทางลูกค้า / ตะกร้า / หน้าองค์กร / แถบล่างมือถือ — **ส่งจริงเมื่อตั้ง `TICKET_ENDPOINT`** (Artifact ส่งไม่ได้ → สรุปให้ส่งเอง) |
| ส่งคำขอ (ฟอร์มติดต่อ + ใบเสนอราคา + ความเห็น) | 🟡 | ★r10 ทุกฟอร์มเป็น ticket เข้าหลังบ้านเดียวกัน (`contact.submitTicket`) เมื่อเชื่อมแล้ว · ไม่เชื่อม/ส่งไม่ได้ → แสดงเหตุผล + สรุปให้คัดลอก/เปิดอีเมล (`handoffBox`) ไม่บอกว่า "ส่งแล้ว" · ★r6 ตรวจช่องกรอกเป็นภาษาไทยข้างช่อง |
| ★r10 หลังบ้าน (`backoffice/` + `backoffice.html`) | 🟡 | Google Sheet ชีต `Tickets` (1 แถว/คำขอ) + Apps Script API (create/track/slots + list/update ด้วยรหัสเจ้าหน้าที่) · แจ้งอีเมลทีม (+LINE ถ้าตั้งค่า) · หน้าหลังบ้าน: ตัวเลขสรุป ตัวกรอง ตาราง กำลังทีม 14 วัน แก้สถานะ/ทีม/วันนัด/โน้ตภายใน พร้อมประวัติผู้แก้ คัดลอกข้อความยืนยันนัด · **รอติดตั้งในบัญชี Google บริษัท** |
| แบบฟอร์มความเห็น Beta | 🟡 | ปุ่ม "ให้ความเห็น" แถบบน + footer → ★r10 ticket ประเภทความเห็น (ไม่ระบุชื่อได้) เมื่อเชื่อมหลังบ้าน · ไม่เชื่อม = สรุปให้ส่งอีเมล |
| หน้าทดสอบ A/B/C (`preview.html`) | ✅ | สลับแบบ/ขนาดจอ · เทียบ 3 แบบ · รายการทดลอง 15 ข้อ · ให้คะแนน 6 ด้าน (`localStorage['sbp-preview-v1']`) |

### 3.1b ★r11 แบบ D · Studio (`d.html`)

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---|---|---|
| ใบงาน (hero) | ✅ | ล้าง · ติดตั้ง · ซ่อม · สัญญาองค์กร คิดราคาจาก Pricebook ทันที · ยอดขั้นต่ำงานล้างเป็นบรรทัดแยก + บอกว่าล้างเพิ่มได้อีกกี่เครื่อง · ปุ่มจองคิว (ส่งค่าทั้งหมดไปฟอร์มจองคิว) / ใส่ใบเสนอราคา · เลขที่คำขอขึ้นบนใบงานเมื่อหลังบ้านตอบกลับ · แถบสรุปลอยบนมือถือ |
| บทล้าง / ติดตั้ง / ซ่อม | ✅ | ขั้นตอนจากแบบฟอร์มบริษัท · ตารางราคากดแล้วเข้าใบงาน · เทียบแพ็กเกจ · วัสดุแต่ละระดับ · ค่าตรวจและตัวอย่างราคาซ่อม · ภาพ 3 มิติ (ทีมช่าง, ลองวางในห้อง) โหลดเมื่อกดเท่านั้น |
| ซื้อแอร์ · องค์กร · จองคิว · พื้นที่ · ติดต่อ | ✅ | แคตตาล็อก 705 รุ่น · องค์กร 3 แท็บ · ระบบจองคิว/ticket ชุดเดียวกับ A/B/C · ฟอร์มติดต่อเป็น ticket |
| เทียบกับเว็บ SBP AirCare Studio (chatgpt.site) | ⛔ | environment บล็อกโดเมนนี้ — รอเปิดสิทธิ์หรือภาพหน้าจอ/HTML จากเจ้าของ |

### 3.1c ★r12 รุ่นที่ 2 — A2 Residence · B2 Tower · C2 Noir · D2 Atelier (`a2–d2.html`)

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---|---|---|
| ภาพ 3 มิติแบบภาพยนตร์ (`cinema3d.js`) | ✅ | 4 ฉาก/อารมณ์ (บ้านยามเย็น · อาคารยามค่ำ · โรงภาพยนตร์สินค้า · แกลเลอรีสว่าง) · แสงเงา ระยะชัดลึก bloom เกรดสี · กล้องเปลี่ยนช็อตเอง ลากหมุน เอียงตามเมาส์ · เสียงลม (กดเปิด) · ตัวเครื่องแบบกลางไม่มียี่ห้อ · "แบบจำลองเพื่ออธิบาย" ทุกจุด |
| canvas เดียวทั้งหน้า (`stage.js`) | ✅ | ภาพย้ายไปส่วนที่กำลังดู (หน้าแรก → ปรึกษา → โชว์รูม) · ภาพนิ่งเปิดหน้า (`assets/posters/`) แสดงก่อน WebGL · ไม่มี WebGL = ภาพนิ่ง |
| ปรึกษาอาการ (`concierge.js`) | ✅ | ที่ไหน · 10 เรื่อง (ถึงรอบล้าง ไม่เย็น น้ำหยด เสียงดัง กลิ่น ค่าไฟ เปิดไม่ติด/รหัส ซื้อใหม่ ย้าย หลายเครื่องทั้งปี) · รายละเอียด → สิ่งที่เข้าใจ · สาเหตุที่พบบ่อย (กดแล้วภาพเปลี่ยน มองทะลุ/แยกชิ้นส่วน + ป้ายชื่อชิ้นส่วน) · งานที่แนะนำ + เหตุผล + ราคา Pricebook (ยอดขั้นต่ำงานล้างเป็นบรรทัดแยก) → จองคิว (เติมงาน/จำนวน/วิธีล้าง/แพ็กเกจ) · ใส่ใบเสนอราคา · ดูรุ่นตาม BTU ที่แนะนำ |
| โชว์รูมทุกรุ่น (`showroom.js`) | ✅ | 705 รุ่น 4 ประเภท กรองยี่ห้อ/ขนาด/ค้นหา · ตัวเครื่องตามขนาดสเปก (164 รุ่น) หรือขนาดทั่วไปของประเภท/BTU (บอกบนหน้า) · ราคาเครื่อง + พร้อมติดตั้งมาตรฐาน · สเปก · ใส่ใบเสนอราคา · นัดติดตั้ง · ตัวเลือกติดตั้ง/อุปกรณ์เสริม (drawer เดิม) |
| บทล้าง / ติดตั้ง / ซ่อม · จองคิว · พื้นที่ · FAQ · ติดต่อ | ✅ | โมดูลเดียวกับแบบ D (ราคาในตารางกดแล้วเข้าใบเสนอราคา) · B2/D2 มีส่วนองค์กร 3 แท็บ · B2 มีตัวประมาณการสัญญารายปี (ราคาขั้นบันได) ในหน้าแรก |
| เทียบกับเอกสารอ้างอิงของเจ้าของ (claude.ai/artifact/KstwqJu8GHdWS24GxBM8Ng) | ⛔ | เปิดไม่ได้ (อยู่นอกองค์กร) — รอสิทธิ์หรือเนื้อหาที่ export/วางมา |

### 3.1d ★r13 รุ่นที่ 3 — A3 แสงเช้า · B3 คู่มือช่าง · C3 โชว์รูม (`a3–c3.html` สร้างจาก `tools/v3gen.py`)

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---|---|---|
| 9 หน้าตามงาน | ✅ | หน้าแรก · ซื้อแอร์ · ล้างแอร์ · ติดตั้ง ย้าย · ซ่อม ตรวจเช็ก · สำหรับองค์กร · ราคา · ความรู้ · ติดต่อ — เมนูเห็นตลอด (มือถือ = แถวเลื่อน) · ย้อนกลับได้ · ลิงก์ตรงเข้าหน้า (`#cleaning` ฯลฯ) |
| เนื้อหาครบเท่า A/B/C | ✅ | ทุกโมดูลเดิม (แคตตาล็อก ห้องจำลอง ลองวางในห้อง ทีมช่างล้าง/ติดตั้ง ข้างในแอร์ วัสดุ งานโครงการ องค์กร ราคา ความรู้ จองคิว พื้นที่ FAQ เกี่ยวกับเรา) + เช็กอาการ (จากรุ่น 2) · เนื้อหาเดียวกันทั้ง 3 แบบ (`tools/v3/sections.html`) |
| โทนสว่าง / ภาพถ่ายประกอบ | ⚠️ | สว่างอย่างเดียว ✅ · ภาพ AI (Higgsfield) **ยังดาวน์โหลดไม่ได้** — network policy บล็อก `d8j0ntlcm91z4.cloudfront.net` → เจ้าของเพิ่มโดเมนใน Network access แล้วสร้างภาพตาม `assets/photos/photos.json` · ระหว่างนี้เลย์เอาต์ปิดช่องภาพเอง |
| หน้าเทียบ | ✅ | `preview3.html` → `index3`: ต้นฉบับ A · B · C + A3 · B3 · C3 + ตาราง 9 หน้า ↔ ตำแหน่งใน A/B/C |

### 3.2 การขายและราคา (ข้อมูลจริงจาก Pricebook 2569)

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---|---|---|
| Catalog | ✅ | 705 รุ่น 22 แบรนด์ จัดซีรีส์ · ค้นหา · กรองประเภท/แบรนด์/BTU/ราคา/Inverter · เทียบรุ่นสูงสุด 4 · การ์ด/ตาราง |
| หน้าสินค้า (drawer) | ✅ | ★r9 ราคาเดียว ก่อน VAT ปัดหลักร้อย · สลับ BTU · แพ็กเกจติดตั้ง มาตรฐาน/พรีเมียม/ไม่ติดตั้ง · อุปกรณ์เสริมตามขนาด · ตารางเทียบวัสดุ · สเปก · ใส่ใบเสนอราคา · "ลองวางในห้องของคุณ" |
| FUJIVA (แบรนด์บริษัท) | 🟡 | แสดงเป็น "รอนำเข้าราคา" + ปุ่มสอบถาม — **ยังไม่มีรุ่น/ราคาใน Pricebook** |
| รูปสินค้า | 🟡 | ช่องพร้อม (`product-media.json` + `assets/products/`) — **ยังไม่มีรูปจริง** แสดงภาพเรนเดอร์ 3 มิติกลาง ๆ ตามประเภท |
| ศูนย์ค่าบริการ | ✅ | ล้าง (3 แพ็กเกจ × C1/C2) · ติดตั้ง 167 รายการ · ซ่อม 86 · รื้อ/ย้าย/น้ำยา · วัสดุ · ค้นหาได้ · ทุกแถว "เพิ่ม" หรือ "ขอประเมิน" · VRV/VRF = ติดต่อแยก |
| ตัวคำนวณสัญญาล้างรายปี (B2B) | ✅ | จำนวนเครื่องต่อประเภท × รอบ/ปี × แพ็กเกจ → ราคาต่อปี + กำลังทีม · ★r9 ราคาขั้นบันได 10–29 ลด 3% · 30–59 ลด 5% · 60+ ลด 7% · 100+ ขอราคาโครงการ (แสดงขั้นปัจจุบัน ประหยัดต่อปี เพิ่มอีกกี่เครื่องได้ขั้นถัดไป) · ราคาใบกำกับภาษีแสดงคู่กัน |
| ใบเสนอราคาเบื้องต้น (ตะกร้า) | 🟡 | ★r9 เลือกผู้ซื้อ: บุคคลทั่วไป (ชำระตามราคา ไม่บวก VAT) / นิติบุคคลต้องการใบกำกับภาษี (+VAT 7% + ช่องชื่อ/เลขผู้เสียภาษี) · ปรับจำนวน · พื้นที่ → ค่าเดินทาง/ยกเว้น · ยอดขั้นต่ำงานล้าง · VAT · คัดลอกสรุป · เก็บใน `localStorage['sbp-quote-v2']` — ★r10 ส่งเป็น ticket ประเภทใบเสนอราคาเมื่อเชื่อมหลังบ้าน + ปุ่ม "จองคิวจากรายการนี้" |
| ★r9 หน้าองค์กร (`business.js`) | ✅ | `#amc` จุดเด่น 6 ข้อ (อ้างเอกสารจริง) + ตารางราคาขั้นบันไดพร้อมตัวอย่างงบต่อปี + เทียบแพ็กเกจ P1/P2/P3 · `#sop` สัญญาหนึ่งปี 6 ขั้น + ขั้นตอนต่อเครื่อง/รายการตรวจจากแบบฟอร์ม + ตัวอย่าง Service Report + เงื่อนไขสัญญา |
| ★r9 งานโครงการ (`business.js` `#projects`) | ✅ | สร้างใหม่ (เดินท่อรอ 2 ช่วง) · รีโนเวตไม่มีแอร์เดิม · เปลี่ยนแอร์เดิม + เทิร์น — ขั้นตอนงาน เอกสารส่งมอบ ประมาณการทีละห้อง (ติดตั้งมาตรฐาน + ท่อส่วนเกินจาก Pricebook · ที่เหลือประเมินหน้างาน) → ใส่ใบเสนอราคา / ขอสำรวจ · การ์ดหน้าแรก S-06 |
| ตรวจพื้นที่ + ค่าเดินทาง + แผนที่ไทย 3 มิติ | 🟡 | 77 จังหวัด ระบายสีตามโซน — ระยะทาง = เส้นตรงจากพิกัดอำเภอ × 1.35 (ประมาณ) |

### 3.3 ภาพอธิบาย / 3 มิติ (ทุกฉากมีข้อความ "แบบจำลองเพื่ออธิบาย")

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---|---|---|
| ตัวเครื่อง 3 มิติ (`ac3d.js`) | ✅ | คอยล์เย็น/ร้อน · แยกชิ้นส่วน · X-ray · ลม · ฝุ่น + ล้างเสมือน · ช่อง `loadModel(url)` สำหรับ GLB ทางการ (ยังไม่มีไฟล์) |
| แอร์ทำงานอย่างไร + ลมเย็นไปทางไหน | ✅ | 3 ประเภท 7 ขั้น · จำลองระยะลม 4 ประเภท + ตัวควบคุม A รีโมต / B แผงห้อง / C แผงกระจก |
| ห้องจำลอง (`studio*`) | ✅ | 48 ห้อง 9 กลุ่ม → BTU + รุ่นแนะนำพร้อมราคา · ฝุ่น 0–18 เดือน → ผลกระทบ (ค่าประมาณ) |
| ลองวางแอร์ในห้องของคุณ (`roomfit*` + ★r7 `siteplan.js`) | ✅ | ขนาดห้องจริง · เฟอร์นิเจอร์ 24 ชิ้น ห้องตัวอย่าง 7 แบบ จัดใหม่ตามขนาดห้อง · ลาก/หมุน/ลบ · ลากแอร์/หน้าต่าง/ประตูเลยมุมไปผนังถัดไป · ★r7 แบบสำรวจหน้างาน: อาคาร/ชั้น · ฝ้า 3 แบบ + ช่องเหนือฝ้า + ช่องเซอร์วิส · ผนัง 4 แบบ · แนวท่อ 4 แบบ ไปจุดเจาะที่ลากได้ · คอยล์ร้อน 6 ตำแหน่ง · น้ำทิ้ง/ปั๊ม · ระยะตู้ไฟ → ความยาวท่อจริง + งานเพิ่มผูก Pricebook (ไม่มีราคา = ประเมินหน้างาน) · ส่งแบบห้อง + รหัสแบบห้อง `SBP1.` ให้ทีม — ค่า `FIT_RULES` / ค่าในแบบสำรวจเป็นค่าแนะนำทั่วไป (รอหัวหน้าช่างตรวจ) |
| ★r7 งานล้าง/ติดตั้งแอร์แขวน · สี่ทิศทาง · ตู้ตั้ง | ✅ | ขั้นเข้าถึงเครื่องต่อประเภท (แขวน = เปิดฝาครอบใต้เครื่อง · สี่ทิศทาง = ถอดหน้ากาก · ตู้ตั้ง = ถอดฝาหน้า/แผงข้าง — ไม่ปลดเครื่องลง) · ช่างหัวหน้า/ผู้ช่วยต่อประเภท · กล้องฉากบนฝ้า · ศูนย์ขั้นตอนบริการมีแอร์ตู้ตั้งพื้น · [C] `techstory` ยังเป็นติดผนังอย่างเดียว |
| ทีมช่างล้าง/ติดตั้ง 3 มิติ (`jobguide` + `jobscene3d` + `crew3d`) | ✅ | ช่าง 2 คน + ลูกค้า · ล้าง C1/C2 · ติดตั้งมาตรฐาน/พรีเมียม × ติดผนัง/แขวน/สี่ทิศทาง/ตู้ตั้ง · 4 สถานที่ · ราคาจาก Pricebook |
| [B] ลำดับการทำงานของระบบ 3 มิติ (`system3d` + `engdraw`) | ✅ | 9 ขั้นต่อประเภท + ภาพตัดวิศวกรรม 2 มิติ |
| [C] ช่างทำงานในบ้านจำลอง (`techstory`) | ✅ | C1 14 · C2 17 · ติดตั้ง 13 · ซ่อม 10 ขั้น |
| โชว์รูมวัสดุ 3 มิติ | 🟡 | O-TWO · Aeroflex · Airpro · Yazaki · SCG · ขาแขวน · NANO — พิมพ์ชื่อยี่ห้อเป็นตัวอักษร (ยังไม่มีไฟล์โลโก้ + หนังสืออนุญาต) |
| ศูนย์ความรู้ (`knowledge.js`) | 🟡 | 12 หัวข้อ บ้าน/องค์กร + ปุ่ม "ลองเอง" — รอหัวหน้าช่างตรวจเนื้อหา |
| งบ WebGL (`gl-pool.js`) | ✅ | live context ≤ 3 ต่อหน้า (เครื่อง RAM ≤2 GB = 2) |

### 3.4 คุณภาพ / ผลตรวจล่าสุด (5 ต.ค. 2569)

- ★r14 ทุกแบบ (11): smoke 1366/390 0 error · textscan clean · test:v3/test:v2/test:d ผ่านทุกข้อ · booking e2e A, B3 21/21 · pricing 0 ปัญหา · backoffice 44/44 · recon 0 · axe 0 (เหลือ 2 ข้อชั่วคราวจากภาพ 3 มิติ — CLAUDE.md §7.1b รอบ 14)
- ★r13 รุ่นที่ 3: `npm run test:v3` ผ่านทุกข้อ (A3 84 · B3 86 · C3 มือถือ 83 · A3 มือถือ 84) · axe WCAG 2.2 AA 0 ทุก 9 หน้า (A3 1366/390 · B3 1366 · C3 390) · booking e2e A3 21/21 · smoke 1366 ทั้ง 3 แบบ 0 error 9 หน้า · textscan clean
- ★r12 รุ่นที่ 2: `npm run test:v2` 97/97 ทุกแบบ · axe WCAG 2.2 AA 0 (A2–D2 1366 + A2/D2 390) · smoke/textscan ดูผลล่าสุดใน §7.1 ของ CLAUDE.md

- ★r11 แบบ D: smoke 0 error (1366/390) · textscan สะอาด · axe WCAG 2.2 AA 0 (สว่าง/มืด/มือถือ) · `npm run test:d` 16/16 · booking-e2e 21/21 · มือถือ CPU ช้า 4 เท่า: แสดงผลแรก 0.8–0.95 วิ / หน้าค้างรวม 0.6–0.66 วิ (A: 1.1–1.8 วิ / 4.0–6.2 วิ)

- ★r10 ระบบจองคิว/ticket: `npm run test:backoffice` 44 ข้อผ่าน (Code.gs ตัวจริงใน emulator: ออกเลข, ตรวจข้อมูล, honeypot, กันสูตรในชีต, เบอร์ 0 นำหน้า, จำกัดความถี่, ติดตามสถานะไม่เห็นข้อมูลภายใน, รหัสเจ้าหน้าที่, ประวัติการแก้, นับคิว) · `tests/booking-e2e.mjs` 21 ข้อผ่านทั้ง A 1366 สว่าง · B 1366 มืด · C 390 สว่าง (จองคิว → ticket → หลังบ้านยืนยัน+จัดทีม → ลูกค้าเห็นสถานะ · ฟอร์มติดต่อ → ticket · ตะกร้า → ticket หลักร้อย · ไม่เชื่อม/ส่งไม่ได้ → สรุปซื่อตรง ไม่เก็บซ้ำ)

- ★r8 ความเร็ว: แก้บั๊กฉากทีมช่างค้างเมื่อสลับประเภท · ฉากต่อประเภทสร้างครั้งเดียวแล้วเก็บไว้ · ลมคำนวณครั้งเดียว · ไม่รั่วหน่วยความจำ · ฉากนอกจอ/หน้าอื่นไม่ทำงานจนกว่าจะเลื่อนถึง · แผนที่ไม่บล็อกการโหลด · ฟอนต์เฉพาะที่ใช้ (ไฟล์เล็กลง 6–27%) · มือถือวาดที่ ≤1.5× · smoke กดสลับประเภททุกโมดูลด้วย (รายละเอียด `CLAUDE.md` §7.1b รอบ 8)

- ★r7: smoke 0 error ทั้ง 1366 และ 390 (A/B/C ไล่ครบ 6 หน้า) · ไม่มีเลื่อนแนวนอน · `webglPeak` A 2 · B 3 · C 3 (มือถือ 2/2/2) · textscan สะอาด · recon 0 ผิด · ภาพตรวจด้วยตา: ฉากทีมช่างแขวน/สี่ทิศทาง/ตู้ตั้ง (ล้าง C2 + ติดตั้ง) และลองวางในห้อง 9 สถานการณ์ (เดสก์ท็อป + มือถือ) · ทดสอบลากแอร์ข้ามมุมห้องด้วยเมาส์จริง · build: a 2,807 KB · b 2,887 KB · c 2,946 KB · หน้าทดสอบ 4,540 KB

- ★r6 axe-core (WCAG 2.2 AA) ไล่ทุกหน้าของทั้ง 3 แบบ: แก้ที่พบครบ (ARIA ของรายการรุ่นใน "ลองวางในห้อง" · ขั้นตอนบริการที่จางจนตัวอักษรอ่านยาก) · ปุ่มควบคุมของแบบ B เป็นภาษาไทยทั้งหมด · ไอคอนเป็น SVG ชุดเดียว

- `npm run smoke` (1366×900) และ `smoke:mobile` (390×844): **0 error ทุกแบบ ไล่ครบ 6 หน้า** · ไม่มีเลื่อนแนวนอน · `webglPeak` A 2 · B 3 · C 3 (มือถือ 2/2/2)
- ★r6 axe-core WCAG 2.2 AA ทุกหน้า: **0 violations** (A, B, C มืด, C สว่าง)
- `npm run textscan`: สะอาดทั้ง 3 แบบ · `npm run recon`: สินค้า 705 · ติดตั้ง 173 · ล้าง 234 · ซ่อม 86 → **0 ผิด**
- build: a 2,716 KB · b 2,795 KB · c 2,854 KB · หน้าทดสอบ 4,458 KB

### 3.5 ยังไม่ทำ / นอกขอบเขตเฟสนี้

🟡 ★r10 backend แบบเบา (Google Sheet + Apps Script) พร้อมติดตั้ง — ยังไม่มี database จริง · ⛔ ชำระเงิน/มัดจำออนไลน์ · ⛔ analytics / funnel · ⛔ SEO (หน้าสินค้าแยก URL) · ⛔ ทดสอบมือถือจริง · ⛔ สคริปต์นำเข้า Pricebook ใน repo · นอกขอบเขตตามคำตัดสินเจ้าของ: ชำระเงินออนไลน์ · หน้าผลงาน/โลโก้ลูกค้า · รีวิว · บทความ SEO

### 3.6 บั๊ก / ข้อจำกัดที่รู้แล้ว (รายละเอียด `CLAUDE.md` §7.2)

| # | ปัญหา | ผลกระทบ |
|---|---|---|
| B4 | ★r10 มีระบบ ticket แล้ว แต่ **ยังไม่ได้ติดตั้ง Apps Script ในบัญชีบริษัท** และลิงก์ Artifact ส่งออกไม่ได้ (ข้อจำกัดของ claude.ai) | ถ้าเปิด beta บนลิงก์ Artifact ลีดยังขึ้นกับลูกค้าส่งเอง — ต้องย้ายไปโดเมนบริษัท + ตั้ง `TICKET_ENDPOINT` |
| B2 | ยังไม่ทดสอบมือถือจริง (ทดสอบแค่ headless swiftshader) | ความเร็ว/เฟรมเรตบนเครื่องราคาประหยัดไม่ทราบ |
| B3 | มุมกล้องบางขนาดจอ (~1100 px) ผนังบังช่าง/ราง ใน techstory (C) | ภาพแปลกช่วงจอกลาง |
| B5 | สคริปต์แปลง Excel → `sbp-data.json` ไม่อยู่ใน repo | แก้ราคารอบหน้าเสี่ยงผิด |
| B7 | ระยะทางประมาณจากพิกัดอำเภอ | ค่าเดินทางคลาดในพื้นที่ขอบโซน |
| B8 | axe-core ยังมีข้อสังเกตระดับ moderate บน A/B | ยังไม่ AA เต็ม |
| B9 | ไฟล์ legacy `index.html`, `hub*.html` | สับสน |
| B10 | หน้าทดสอบ 4.4 MB | ใช้ภายในเท่านั้น |

---

## 4. Environment Variables & Config

### 4.1 Environment variables ที่โค้ดอ่านจริง (มีแค่เครื่องมือ — ตัวเว็บไม่ต้องตั้งค่าอะไร)

| ตัวแปร | ใช้ที่ | ค่าเริ่มต้น | หมายเหตุ |
|---|---|---|---|
| `SBP_REAL` | `tools_recon.py` | `internal/sbp_real.json` | path ไฟล์ Pricebook ภายใน (หรือส่งเป็น argument แรก) |
| `BASE` | `tests/_lib.mjs` | `http://localhost:8765` | URL ของ dev server ที่เทสต์ยิงเข้า |
| `PLAYWRIGHT_BROWSERS_PATH` | Playwright | (ตั้งโดย environment) | บน Claude Code web = `/opt/pw-browsers` — **ห้าม** `npx playwright install` |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | npm install | (ตั้งโดย environment) | กันไม่ให้ npm ดาวน์โหลด browser ซ้ำ |
| `CLAUDE_CODE_REMOTE` · `CLAUDE_PROJECT_DIR` | `.claude/hooks/session-start.sh` | (ตั้งโดย Claude Code) | hook ทำงานเฉพาะบน Claude Code web |

★r10 เครื่องมือหลังบ้านในเครื่อง (`tools/backoffice-server.mjs`): `PORT` (8790) · `STAFF_TOKEN` (dev-token) · `DATA` (`backoffice/.dev-data.json`) · `FRESH=1` · `NOTIFY_EMAIL` · `SLOT_CAPACITY` · `tests/booking-e2e.mjs` ใช้พอร์ต 8792+

**ไม่มี API key / secret ใด ๆ ในโค้ด** · ★r10 เว็บเรียก API ภายนอกที่เดียว = `TICKET_ENDPOINT` ใน `assets/ticket.js` (URL เว็บแอป Apps Script ไม่ใช่ความลับ) · ความลับของหลังบ้าน (`STAFF_TOKEN`, `LINE_TOKEN`) อยู่ใน Script properties ของ Apps Script เท่านั้น ห้ามใส่ในโค้ด/URL

### 4.2 ไฟล์ config / ไฟล์ลับ

| ไฟล์ | ลับ? | หน้าที่ |
|---|---|---|
| `internal/sbp_real.json` | ⛔ **ลับ** — ห้าม commit / ห้ามใส่ zip / ห้ามขึ้นเว็บ | Pricebook ภายในเต็ม มี `sp`/`pj` (อัตราพิเศษ/โครงการ) — ใช้กับ `npm run recon` เท่านั้น · เจ้าของอัปโหลดให้ทุก session ที่ต้องใช้ |
| `urls.json` | ไม่ลับ | URL ลิงก์ชุดที่แชร์ (`a`, `b`, `c`, `index`, `hub`) → `npm run build` |
| `urls.dev.json` | ไม่ลับ | URL ลิงก์ชุดพัฒนา → `npm run build:dev` |
| `assets/product-media.json` + `assets/products/` | ไม่ลับ | รูปสินค้า (`models` / `series` / `brands`) — ดู `assets/products/README.md` |
| ★r10 `assets/ticket.js` → `TICKET_ENDPOINT` | ไม่ลับ | URL เว็บแอป Apps Script (`…/exec`) · ว่าง = ไม่เชื่อมหลังบ้าน |
| ★r10 Script properties (ใน Apps Script) | ⛔ **ลับ** | `STAFF_TOKEN` · `NOTIFY_EMAIL` · `TEAMS` · `SLOT_CAPACITY` · `LINE_TOKEN`/`LINE_TO` · `CUSTOMER_ACK` — `backoffice/README.md` §2 |
| ★r10 `backoffice/.dev-data.json` | ไม่ขึ้น git | ชีตจำลองของเซิร์ฟเวอร์ทดสอบในเครื่อง (gitignored) |
| `assets/logos/<key>.png` | ไม่ลับ แต่ต้องมีหนังสืออนุญาต | โลโก้วัสดุ `aeroflex scg yazaki airpro o-two nano` + ตราบริษัท `fujiva sbp` → build ฝังเป็น `__SBP_LOGOS` |

### 4.3 ค่าที่ build ฝังให้ (global ที่อนุญาต — ห้ามเพิ่ม global อื่น)

`globalThis.__SBP_DATA` (Pricebook) · `__SBP_TH` (แผนที่) · `__SBP_LOGOS` (ถ้ามีโลโก้) · `__SBP_MEDIA` (manifest รูปสินค้า) · `SBP_HUB` (ลิงก์หน้ารวม) · `window.SBP_URLS` (หน้าทดสอบ) · หน้าทดสอบโมดูล: `window.TS`, `window.READY`

### 4.4 localStorage (ทุกการอ่าน/เขียนครอบ try/catch — เว็บต้องทำงานได้แม้ไม่มี)

`sbp-quote-v2` (ใบเสนอราคา) · `sbp-journey-v1` (เส้นทางลูกค้า `{k, done}`) · `sbp-preview-v1` (หน้าทดสอบ) · ★r10 sessionStorage `sbp-staff-v1` (หน้าหลังบ้าน: ชื่อเจ้าหน้าที่ + รหัส + URL — หายเมื่อปิดแท็บ ไม่ใส่ใน URL)

### 4.5 ตัวแปรที่จะต้องมีในเวอร์ชันใช้งานจริง (ข้อเสนอ — ยังไม่มีในโค้ด ชื่อปรับได้)

| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `DATABASE_URL` หรือ `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` | ข้อมูลราคา + บันทึก Lead (service role ใช้ฝั่ง server เท่านั้น) |
| `GOOGLE_MAPS_API_KEY` | Distance Matrix คำนวณระยะทาง/ค่าเดินทางจากที่อยู่จริง (แก้ B7) |
| `LINE_CHANNEL_ACCESS_TOKEN` + `LINE_CHANNEL_SECRET` | แจ้งเตือนทีมขายผ่าน LINE Messaging API (LINE Notify ปิดบริการแล้ว) |
| `RESEND_API_KEY` หรือ `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` + `SALES_NOTIFY_EMAIL` | อีเมลแจ้งทีมขาย / ยืนยันลูกค้า |
| `NEXT_PUBLIC_SITE_URL` | URL เว็บจริง (ลิงก์ในอีเมล, SEO) |
| `NEXT_PUBLIC_GA_ID` (หรือเครื่องมือ analytics อื่น) | วัด funnel: ใส่ใบเสนอราคา → ส่งคำขอ |
| `RECAPTCHA_SECRET` / `TURNSTILE_SECRET` | กันสแปมฟอร์ม |

---

## 5. วิธีทำงาน (คำสั่งที่ใช้จริง)

```bash
cd sbp-aircare
npm install                         # บน Claude Code web hook ทำให้แล้ว · เครื่องตัวเอง: ติดตั้ง Chromium ของ Playwright เอง
npm run serve                       # http://localhost:8765/a.html · b.html · c.html · preview.html
# ตรวจทุกครั้งที่แก้ (ต้องเปิด serve ไว้ใน terminal อื่น หรือรันพร้อมกันในคำสั่งเดียว)
npm run smoke && npm run smoke:mobile && npm run textscan     # ใช้เวลารวม ~15–25 นาที (ไล่ทุกหน้า + ฉาก 3 มิติบน swiftshader)
npm run recon                       # แตะข้อมูลราคาเมื่อไร ต้อง "mismatches": 0 (ต้องมี internal/sbp_real.json)
npm run build:dev                   # dist/art/* ลิงก์ชุดพัฒนา → publish ทับ URL ใน urls.dev.json
npm run build                       # dist/art/* ลิงก์ชุดที่แชร์ → publish เฉพาะเมื่อเจ้าของสั่ง
```

- **Definition of Done:** smoke + smoke:mobile + textscan ผ่าน (recon ถ้าแตะราคา) · ฉาก 3 มิติที่แก้ ถ่ายภาพตรวจด้วยตา (desktop + มือถือ, สว่าง/มืด) · `npm run build` แล้วเปิด `dist/offline/*.html` ตรวจ · อัปเดต `CLAUDE.md` + `SBP-WEB-011_Dev_Handoff_Plan.md` + ไฟล์นี้
- **กฎ build:** แต่ละ `a/b/c.html` ต้องมี `<script type="module">` ตัวเดียว · stylesheet ต้องเขียน `<link rel="stylesheet" href="assets/ชื่อ.css">` ตรงตัว · import ต้องมีนามสกุล `.js`
- **สไตล์โค้ด:** 2 spaces · single quotes · semicolon · one-liner แน่น ๆ ตามไฟล์เดิม (อย่า reformat ทั้งไฟล์) · โมดูลร่วมใช้ token `--s-*` เท่านั้น · CSS prefix ต่อโมดูล (`s-`, `sx-`, `st-`, `sv-`, `hw-`, `ts-`, `sy3-`, `cg-` …)
- **กับดักที่เคยเจอ:**
  - section ห้ามใช้ attribute `data-view` (catalog/studio ใช้ชื่อนี้อยู่) — `site.js` ใช้ `data-sx`
  - โมดูลที่เขียน URL hash ได้ต้องไม่ทำตอนโหลดหน้า (เคยทำให้เปิดเว็บแล้วไปหน้า "ซื้อแอร์")
  - IntersectionObserver ที่ใช้ `threshold` ไม่ทำงานกับ section ที่สูงกว่า 5 เท่าของจอ — ใช้ `rootMargin` แทน
  - ฉาก 3 มิติใหม่ต้องลงทะเบียน `gl-pool.track()` เสมอ
  - เทสต์บน swiftshader ช้ามาก — screenshot ฉาก 3 มิติให้ timeout ≥ 180,000 ms

---

## 6. ลิงก์ที่เผยแพร่ (Claude Artifacts)

| ชุด | A | B | C | D (★r11) | หน้าทดสอบ |
|---|---|---|---|---|---|
| **พัฒนา (private)** — `urls.dev.json` | claude.ai/artifact/K1vDEg5dAmipKBSaexi6Sq | claude.ai/artifact/KpoG4oQVMFFWYThzarwUjs | claude.ai/artifact/3oZAqsBL7rtFnNYg8sCtFU | claude.ai/artifact/SCaGJ2rpX2k85o6fWpGcMc | claude.ai/artifact/HBLkCDMcMQu3C4d9D7yXPU (A/B/C/D) |
| **แชร์ "ทุกคนที่มีลิงก์"** — `urls.json` · ⚠️ คนดูเห็นทันทีเมื่อ publish | claude.ai/artifact/EymM19Ff1MDrV5w94kq8Jz | claude.ai/artifact/Ljne7eUGxzXs1Fbf3VAyj4 | claude.ai/artifact/WmbTyh3x5xz3jci7tq6zF5 | — (ยังไม่มีในชุดที่แชร์) | claude.ai/artifact/VGmjDYNJPN7AzoybNRRH6i |
| ★r12 **รุ่นที่ 2 (private)** — `urls.dev.json` key a2 b2 c2 d2 index2 | A2 claude.ai/artifact/F3dqLnymTTSWH55UTG78wC | B2 claude.ai/artifact/L9yfEVUYdtR6cPPCyKsHW9 | C2 claude.ai/artifact/QRWDuTSQMmE2FKBD1YmBKJ | D2 claude.ai/artifact/3dCYNawjJYxLFGZHvf7VKQ | claude.ai/artifact/RbGGBB9qwFcRTDzhjwNLh4 (A2/B2/C2/D2) |
| ★r13 **รุ่นที่ 3 (private)** — `urls.dev.json` key a3 b3 c3 index3 | A3 claude.ai/artifact/DN9HoujitYzPDhwoaMi6vZ | B3 claude.ai/artifact/HfL8ydX1oDy8nH7cMofyfk | C3 claude.ai/artifact/P4cx9g5VT6Kh31knF4vBYc | — | claude.ai/artifact/XuNkFBEUCRb9LXMwEhTWY9 (เทียบต้นฉบับ A/B/C กับ A3/B3/C3) |

★r14 **จุดเริ่มสำหรับผู้ทดลอง: หน้ารวมทดลองใช้ claude.ai/artifact/XuNkFBEUCRb9LXMwEhTWY9** (ลิงก์ไปทุกแบบ 11 แบบ · ปุ่ม "หน้ารวมทุกแบบ" ในทุกแบบกลับมาที่นี่) — ลิงก์ชุดพัฒนาเป็น private: ถ้าจะให้ลูกค้าทดลอง เจ้าของเปิดสิทธิ์ที่เมนู Share ของแต่ละหน้า (หน้ารวม + แบบที่จะให้ลอง) หรือสั่งให้ publish ทับชุดที่แชร์ (`urls.json`)

- ชุดที่แชร์ **ไม่ได้ถูก publish ทับในรอบพัฒนา r1–r5** (ยังเป็นรุ่นเก่ากว่าชุดพัฒนา) — publish ทับเฉพาะเมื่อเจ้าของสั่ง
- publish ด้วย Artifact tool โดยส่ง `url` ของชุดนั้นเสมอ (ไม่งั้นได้ลิงก์ใหม่) · artifact ที่สร้างเกินมา `claude.ai/artifact/SAnXMdrSSDUAPFdRzLNup9` รอเจ้าของตัดสินใจว่าจะลบ
- ข้อจำกัดของ Artifacts: fetch ไปโดเมนอื่นถูกบล็อก (CSP) → **ต่อ backend จากหน้า artifact ไม่ได้** · ลิงก์ `mailto:` / `tel:` อาจกดไม่ได้ (จึงแสดงอีเมล/เบอร์เป็นข้อความเลือกได้ + ปุ่มคัดลอก) · `alert/confirm/print` ใช้ไม่ได้

---

## 7. กฎธุรกิจที่ห้ามแก้โดยไม่มีคำอนุมัติเป็นลายลักษณ์อักษรจากเจ้าของ (ย่อจาก `CLAUDE.md` §6.6)

1. ราคาต้นทางเป็น**ก่อน VAT** · ★r9 (เจ้าของอนุมัติ 2 ต.ค. 2569) เว็บแสดง**ราคาเดียว ก่อน VAT ปัดเป็นหลักร้อย** (`r100` ใน `loadData`) · บุคคลทั่วไปชำระตามราคา · นิติบุคคลต้องการใบกำกับภาษี +VAT 7% (`TAX_MODES`, `cart.tax`) · ตรวจ `npm run pricing`
2. ห้ามแก้ราคา/อัตราใน `sbp-data.json` · ชุดราคาใหม่ SBP-PRC-001 **ยังไม่อนุมัติ** · แก้แล้วต้อง recon 0 ผิด
3. เว็บแสดง**อัตรามาตรฐาน** (`sp`/`pj` = null ใน browser) · ★r9 สัญญารายปีมีราคาขั้นบันไดสาธารณะ `VOLUME_TIERS` (0/3/5/7%) — ต้องไม่ต่ำกว่าอัตราพิเศษภายในทุกแถว (`npm run recon` → `ladder_guard.below_special: 0`)
4. ห้ามมีต้นทุน กำไร % ส่วนลดภายใน/อัตราอนุมัติ รายชื่อลูกค้า เงินเดือน ในโค้ดหรือข้อมูลฝั่ง browser (ยกเว้น % ขั้นบันไดสาธารณะข้อ 3)
5. รุ่นบนเว็บ = อนุมัติแล้วเท่านั้น (705) · ติดตั้งบนเว็บ = มาตรฐาน/พรีเมียม (ไม่มี -MASS)
6. ทองแดงบนเว็บ = **O-TWO 0.70 มม.** เท่านั้น · ไม่มีคำว่า "Type L" / "K Copper" บนเว็บ
7. ยอดขั้นต่ำ **4,500 บาทก่อน VAT ใช้กับงานล้างเท่านั้น**
8. ค่าเดินทาง: 5 จังหวัดหลัก 0 · ≤60 กม. 300 (ยกเว้น ≥4 เครื่อง) · 61–100 กม. 800 (ขั้นต่ำ 3, ยกเว้น ≥8) · 101–150 กม. 1,500 (ขั้นต่ำ 5) · >150 กม. ไม่รับรายเครื่อง
9. รับประกันติดตั้ง 3 ปี (ซื้อเครื่องจากบริษัท) / 1 ปี (ลูกค้าหาเครื่องเอง)
10. คำต้องห้าม (เช่น "แก้หายแน่นอน", "ปลอดเชื้อ", "สะอาด 100%", "รับประกันเย็น") — `tests/textscan.mjs`
11. ค่าที่วัดในขั้นตอนช่าง = **ตัวอย่างการบันทึก** ไม่ใช่เกณฑ์ผ่าน/ไม่ผ่าน · ห้ามเดาค่าแรงดัน/ขนาดท่อ/สายไฟ/เบรกเกอร์
12. ขั้นตอนช่างต้องตรงแบบฟอร์มบริษัท (ล้าง SBP-SR-ACCL-UNI-001 Rev.07 · ติดตั้ง SBP-SR-ACIN-UNI-001 Rev.04 · ซ่อม: ไม่ซ่อมก่อนลูกค้าอนุมัติ) — แก้ข้อความที่ `services.js` เท่านั้น
13. โลโก้: ไม่ดาวน์โหลด/ไม่วาดเลียนแบบ · ห้ามปั้นดีไซน์ผู้ผลิตแอร์ · FUJIVA/SBP อยู่บนของของทีมช่างเท่านั้น ไม่อยู่บนแอร์ของลูกค้า
14. VRV / VRF = ติดต่อแยก (ห้ามเข้าตะกร้า)
15. ข้อมูลบริษัทที่ยังไม่ยืนยัน (เลขผู้เสียภาษี, LINE OA, เวลาทำการ) **ห้ามเดาใส่**
16. ★r9 หน้าองค์กร: จุดเด่นอ้างได้เฉพาะที่มีเอกสาร · ห้ามสัญญาเวลาเข้างาน (SLA) และห้ามอ้างถึงคู่แข่ง · โลโก้ SP/FUJIVA ใช้ไฟล์ที่เจ้าของส่ง ห้ามแก้สี/รูปทรง
17. ★r10 จองคิว/ticket: หน้าเว็บบอก "ส่งแล้ว" ได้ **เฉพาะเมื่อหลังบ้านตอบเลขที่คำขอกลับมา** · ไม่สัญญาเวลาตอบกลับ/วันนัด (นัดยืนยันโดยทีมเสมอ) · ไม่แสดงเวลาทำการจนกว่าเจ้าของกำหนด · นอกเวลา/วันอาทิตย์ = ประเมินหน้างาน · ticket ส่งเฉพาะราคาที่ลูกค้าเห็น (ไม่มีอัตราพิเศษ/ต้นทุน) · ลูกค้าติดตามสถานะได้ด้วยเลขที่ + เบอร์ และไม่เห็นข้อมูลภายใน · ต้องมีความยินยอม (PDPA) ก่อนส่ง

---

## 8. Next Steps / Todo (เรียงตามลำดับความสำคัญ)

### P0 — ต้องทำก่อนให้ลูกค้าจริงทดลอง (beta)

0. ★r13 **ภาพประกอบรุ่นที่ 3**: เจ้าของเพิ่ม `d8j0ntlcm91z4.cloudfront.net` ใน Network access → สร้างภาพ 11 ภาพตาม `assets/photos/photos.json` (Higgsfield seedream_5_0_flash 0.5 เครดิต/ภาพ · เหลือ 9.5) → ตรวจว่าไม่มีโลโก้/ตัวอักษรบนเครื่อง → แปลงเป็น webp → `npm run v3` → ทดสอบ → `npm run build:dev` → publish a3/b3/c3 ทับ URL เดิม

1. ✅ ★r14 **ซอร์สขึ้น GitHub แล้ว** (repo Public ตามคำสั่งเจ้าของ) — ทุกครั้งที่ commit ตรวจ `git status` ว่าไม่มี `internal/`, `dist/`, `node_modules/` และไม่มีตัวเลขต้นทุน/กำไร/อัตราพิเศษในเอกสาร
2. **ยืนยันข้อมูลบริษัทใน `COMPANY` (`assets/sbp-core.js`)**
   - ที่อยู่ "593 ถ.พระราม 2 แขวงบางมด เขตจอมทอง กรุงเทพฯ 10150" — ข้อความส่วนพื้นที่ยังเขียน "พระราม 2 ซอย 31" ต้องให้ตรงกัน
   - เบอร์ 02-459-3291-9 · ชื่ออังกฤษ "Saha Burapa Group Co., Ltd." · "ประสบการณ์กว่า 30 ปี"
   - เพิ่มเลขผู้เสียภาษี · LINE OA (แล้วคืนปุ่ม LINE ในแถบล่างมือถือ `site.js` §9) · เวลาทำการ
   - ที่มาตอนนี้คือผลค้นหาสาธารณะ เพราะ environment บล็อก `sahaburapa.com` / `sahaburapagroup.com` — เพิ่มใน Network access ถ้าต้องอ่านเว็บบริษัทโดยตรง
3. **เปิดใช้ระบบจองคิว/ticket (★r10 โค้ดเสร็จแล้ว — เหลือติดตั้ง · ขั้นตอนเต็ม `backoffice/README.md`)**
   - สร้าง Google Sheet ในบัญชีบริษัท → วาง `backoffice/apps-script/Code.gs` + `appsscript.json` → ตั้ง Script properties (`STAFF_TOKEN`, `NOTIFY_EMAIL`, `SLOT_CAPACITY`, `TEAMS`) → Deploy เว็บแอป (ในฐานะฉัน · ทุกคน)
   - วาง URL `/exec` ใน `assets/ticket.js` `TICKET_ENDPOINT` → `npm run build`
   - Artifacts เรียก API ภายนอกไม่ได้ → ย้ายหน้าไปโฮสต์ static ของบริษัท (Cloudflare Pages / Netlify / Vercel หรือโฮสต์เดิมของ sahaburapa.com — ไฟล์จาก `dist/offline/` ใช้ได้ทันที)
   - หน้าหลังบ้าน `dist/offline/backoffice.html` ใช้ภายในเท่านั้น
   - เจ้าของต้องให้: ประกาศความเป็นส่วนตัว (PDPA) · จำนวนงานต่อช่วง (`SLOT_CAPACITY`) · รายชื่อทีม · อีเมล/LINE ที่รับแจ้ง
4. **ทดสอบมือถือจริง (B2)**
   - Android ราคาประหยัด 2–3 เครื่อง + iPhone Safari
   - ถ้าต่ำกว่า ~24 fps: ลด `pixelRatio` เป็น 1 · ลดอนุภาคลม · ปิดเงา · หรือแสดงภาพนิ่งตาม `deviceMemory` / `hardwareConcurrency`
5. **ตัดสินใจเรื่องลิงก์ beta**
   - แชร์ชุดพัฒนา (เปลี่ยนสิทธิ์จากเมนู Share ของแต่ละ artifact) หรือสั่ง `npm run build` แล้ว publish ทับชุดที่แชร์
   - ใช้หน้าทดสอบ A/B/C + ปุ่ม "ให้ความเห็น" เก็บคะแนน

6a. **★r9 ตัดสินเรื่องราคา (รายละเอียด `CLAUDE.md` §7.3 ข้อ 15–17)**
   - **VAT ของลูกค้าบุคคล:** ราคาที่ลูกค้าบุคคลจ่ายตอนนี้รวม VAT ในตัว → เครื่อง/ค่าติดตั้งที่เป็นหลักร้อยอยู่แล้ว รายได้สุทธิลด ~6.5% เทียบเดิม (เครื่องตั้งราคาตลาด +7% แทบไม่เหลือส่วนต่าง) — ยืนยันกับนักบัญชีก่อนเปิด beta
   - วิธีปัด (ครึ่งขึ้น) และอัตราต่อเมตรที่ต่ำกว่า 100 บาท 4 รายการ · ขั้นบันได 3/5/7% · แก้ Pricebook Excel ให้เป็นหลักร้อยตรงกับเว็บ

### P1 — ช่วง beta

6. **รวบรวมความเห็น beta → เจ้าของเลือกแบบ** A / B / C หรือผสม (คำแนะนำเดิม: ใช้ A เป็นโครงหลัก ยืมหน้าองค์กรจาก B และโชว์รูม/ห้องจำลองจาก C)
7. **ใส่ข้อมูลที่รอเจ้าของ** (`CLAUDE.md` §7.3)
   - ราคา FUJIVA ทุกรุ่น
   - รูปสินค้าจริง (`assets/products/` + `product-media.json`)
   - ไฟล์โลโก้ + หนังสืออนุญาต (`assets/logos/`)
   - ภาพทีมงานจริง
   - หัวหน้าช่างตรวจ `CLEAN_HOW` / `INSTALL_HOW` / `FIT_RULES` / ศูนย์ความรู้
8. **สคริปต์นำเข้า Pricebook (B5)**
   - `scripts/import_pricebook.py` (openpyxl): Excel → `internal/sbp_real.json` + `assets/sbp-data.json`
   - คง schema `pf`/`pool` เดิม (`CLAUDE.md` §4.2)
   - ยืนยันด้วย diff ว่างกับไฟล์ปัจจุบัน และ recon 0 ผิด
9. **ถ้าเจ้าของอนุมัติ SBP-PRC-001:** แก้ราคาด้วยสคริปต์ข้อ 8 เท่านั้น → recon → textscan → build · ★2 ต.ค. 2569 ตรวจแล้วเป็น Rev.02 (ไฟล์ภายใน + ชุดสคริปต์ `run_all.sh` อยู่นอก repo เพราะมีพื้นต้นทุน/อัตราพิเศษ): แก้ engine 3 จุด (ลดจากตลาดแหล่งเดียว · ปัดเศษจนขึ้นราคา · เครื่องต้องมี ≥ 2 ร้าน) และรอเจ้าของตัดสิน 7 เรื่องในชีต 12 ก่อนอนุมัติ
10. **แก้ B3** (มุมกล้อง techstory ที่จอ ~1100 px) และ **B8** (รัน axe-core แก้ moderate บน A/B)
11. **Analytics funnel แบบไม่เก็บข้อมูลส่วนตัว:**
    - เปิดหน้า → เลือกเส้นทาง → ใส่ใบเสนอราคา → สร้างสรุปคำขอ
    - วัดว่าแบบไหนพาลูกค้าไปถึงคำขอได้มากที่สุด
12. ลบไฟล์ legacy `index.html`, `hub*.html` หลังเจ้าของยืนยัน (B9)

### P2 — เวอร์ชันใช้งานจริง (หลังเลือกแบบ — `CLAUDE.md` §2.3, §8 Step 7)

13. **Next.js (App Router) + TypeScript**
    - ยก `sbp-core.js` + `studio-model.js` + `roomplan.js` เป็น `lib/domain/*.ts` พร้อม unit test (VAT, โซน, ค่าเดินทาง, สัญญา, BTU)
    - เพราะเป็นตรรกะล้วน ไม่มี DOM
14. **3 มิติเป็น client component** (dynamic import, `ssr:false`) คง `gl-pool` (≤3 context)
15. **PostgreSQL/Supabase** เก็บราคา (นำเข้าด้วยสคริปต์ข้อ 8) + ตาราง Lead
16. **API ใบเสนอราคา**
    - คำนวณยอดซ้ำฝั่ง server (ห้ามเชื่อยอดจาก browser) · บันทึก Lead
    - แจ้งทีมขายทาง LINE Messaging API / อีเมล
17. **Google Distance Matrix** คำนวณค่าเดินทางจากที่อยู่จริง (แก้ B7)
18. **SEO:** SSG หน้าสินค้า 705 รุ่น + schema.org Product/Offer (ราคารวม VAT) · sitemap · OG image
19. **ความเป็นส่วนตัว:**
    - นโยบายความเป็นส่วนตัว (PDPA) + ความยินยอมในฟอร์ม
    - ไม่เก็บข้อมูลลูกค้าใน localStorage เกินจำเป็น

---

_ไฟล์นี้สรุปจากการวิเคราะห์โค้ดทั้งหมด ณ 2 ต.ค. 2569 — เมื่อแก้โค้ดรอบถัดไป ให้อัปเดตหัวข้อ 3 (สถานะ), 6 (ลิงก์/เวอร์ชัน) และ 8 (Todo) ทุกครั้ง_

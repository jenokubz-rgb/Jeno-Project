#!/bin/bash
# สร้างไฟล์ระบบ Apps Script แล้วคัดลอกขึ้น repo สาธารณะ (เฉพาะตัวโปรแกรม ไม่มีข้อมูลบริษัท)
set -euo pipefail
SRC=$(cd "$(dirname "$0")/.." && pwd)
REPO=${1:-/home/claude/jeno-project}
DEST=$REPO/sbp-fieldops
node "$SRC/gas/build.mjs"
mkdir -p "$DEST/dist" "$DEST/src"
cp "$SRC"/dist/gas/sbp-server-*.js "$SRC"/dist/gas/sbp-ui-*.html "$DEST/dist/"
cp "$SRC/dist/gas/latest.json" "$DEST/latest.json"
cp "$SRC/dist/gas/Code.gs" "$DEST/Code.gs"
cp "$SRC/gas/README-repo.md" "$DEST/README.md"
# เก็บไฟล์ใน dist ไว้ 2 เวอร์ชันล่าสุด
for p in sbp-server sbp-ui; do ls -1 "$DEST/dist/$p-"* | sort -r | tail -n +3 | xargs -r rm -f; done
# ซอร์ส (ไม่รวมข้อมูล: seed.js, fixtures, .setup-code, ตัวสร้าง seed)
rm -rf "$DEST/src" && mkdir -p "$DEST/src"
(cd "$SRC" && git ls-files -co --exclude-standard | grep -vE '^(dist/|supabase/functions/api/seed\.js|test/fixtures/|tools/build-seed\.mjs|\.setup-code\.txt|deno\.lock)' \
  | while read -r f; do mkdir -p "$DEST/src/$(dirname "$f")"; cp "$f" "$DEST/src/$f"; done)
# ตรวจว่าค่านโยบายภายใน (จาก seed ส่วนตัวในเครื่อง) ไม่หลุดขึ้น repo
node --input-type=module -e "
import fs from 'node:fs'; import path from 'node:path';
const seed = (await import('$SRC/supabase/functions/api/seed.js')).default;
const vals = Object.values(seed.settings || {}).filter(v => Number(v) >= 1000).map(String);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const bad = walk('$DEST').filter(f => { const t = fs.readFileSync(f, 'utf8'); return vals.some(v => new RegExp('(^|[^0-9.,])' + v + '([^0-9]|$)').test(t)); });
if (bad.length) { console.error('LEAK', bad); process.exit(1); }"
echo "published $(head -c 40 "$DEST/latest.json" | tr -d '\n')"

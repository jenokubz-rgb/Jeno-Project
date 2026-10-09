#!/usr/bin/env python3
"""r20: production package of the original A · B · C from the offline build (owner 9 ต.ค. 2569: "เอาเฉพาะ A B C ต้นฉบับ")
default → dist/release/SBP-AirCare-ABC-<rev>/ + .zip: a.html · b.html · c.html · README-TH.md (no hub link, nothing else)
--full  → dist/release/SBP-AirCare-<rev>/ + .zip:
  web/        index.html (choose an edition) · a.html · b.html · c.html   — single files, everything embedded, upload as-is
  backoffice/ backoffice.html (INTERNAL — never on the public site) · apps-script/Code.gs + appsscript.json · README.md
  dev/        styleguide.html (design system for the dev team)
  README-TH.md  how to open, host, connect the back office (meta tag, no rebuild) and what the owner must confirm first
r21: <title> and og:title become the customer-facing business name in every packaged a/b/c.html
usage: npm run build (or build:dev) && npm run release   [--rev r20] [--full]"""
import base64, os, re, shutil, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REV = sys.argv[sys.argv.index('--rev') + 1] if '--rev' in sys.argv else 'r21'
OFF = os.path.join(ROOT, 'dist', 'offline')
FULL = '--full' in sys.argv
OUT = os.path.join(ROOT, 'dist', 'release', f'SBP-AirCare-{REV}' if FULL else f'SBP-AirCare-ABC-{REV}')
for f in ('a.html', 'b.html', 'c.html', 'backoffice.html', 'styleguide.html'):
    assert os.path.exists(os.path.join(OFF, f)), f'missing dist/offline/{f} — run npm run build first'
# r21: the tab title / share preview of a production file names the business, not the internal prototype ("แบบ A Bento")
TITLE = 'SBP AirCare · ล้าง ติดตั้ง ซ่อมแอร์ และซื้อแอร์พร้อมติดตั้ง | บริษัท สหบูรพากรุ๊ป จำกัด'
def customer(s, v):
    s, n1 = re.subn(r'<title>[^<]*</title>', f'<title>{TITLE}</title>', s, count=1)
    s, n2 = re.subn(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{TITLE}">', s, count=1)
    assert n1 == 1 and n2 == 1, v
    return s
def zipdir(out):
    z = out + '.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for base, _, files in os.walk(out):
            for f in sorted(files):
                p = os.path.join(base, f); zf.write(p, os.path.relpath(p, os.path.dirname(out)))
    print({'folder': os.path.relpath(out, ROOT), 'zip': os.path.relpath(z, ROOT), 'zip_kb': os.path.getsize(z) // 1024})
if not FULL:
    # A · B · C only: the three files side by side; the "back to hub" link has nowhere to go → removed
    if os.path.exists(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT)
    for v in 'abc':
        s = open(os.path.join(OFF, f'{v}.html'), encoding='utf-8').read()
        s = s.replace('globalThis.SBP_HUB="./index3.html"', 'globalThis.SBP_HUB=""').replace('globalThis.SBP_HUB="./index.html"', 'globalThis.SBP_HUB=""')
        s = re.sub(r' ?<a href="\./index3\.html">[^<]*</a>', '', s)   # the beta bar's hub link (r21: label "หน้ารวมทุกแบบ")
        assert 'index3.html' not in s, v
        open(os.path.join(OUT, f'{v}.html'), 'w', encoding='utf-8').write(customer(s, v))
    shutil.copy(os.path.join(ROOT, 'tools', 'release', 'README-ABC-TH.md'), os.path.join(OUT, 'README-TH.md'))
    zipdir(OUT); sys.exit(0)
if os.path.exists(OUT): shutil.rmtree(OUT)
for d in ('web', 'backoffice/apps-script', 'dev'): os.makedirs(os.path.join(OUT, d))
for v in 'abc':
    s = open(os.path.join(OFF, f'{v}.html'), encoding='utf-8').read()
    # the beta hub of the dev builds (index3) is not in the package → "back" goes to the package's own index
    s = s.replace('globalThis.SBP_HUB="./index3.html"', 'globalThis.SBP_HUB="./index.html"').replace('href="./index3.html"', 'href="./index.html"')
    open(os.path.join(OUT, 'web', f'{v}.html'), 'w', encoding='utf-8').write(customer(s, v))
logo = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(ROOT, 'assets', 'logos', 'sbp.png'), 'rb').read()).decode()
idx = open(os.path.join(ROOT, 'tools', 'release', 'index.html'), encoding='utf-8').read().replace('{{LOGO}}', logo).replace('{{REV}}', f'Rev.09 {REV}')
open(os.path.join(OUT, 'web', 'index.html'), 'w', encoding='utf-8').write(idx)
shutil.copy(os.path.join(OFF, 'backoffice.html'), os.path.join(OUT, 'backoffice', 'backoffice.html'))
for f in ('Code.gs', 'appsscript.json'): shutil.copy(os.path.join(ROOT, 'backoffice', 'apps-script', f), os.path.join(OUT, 'backoffice', 'apps-script', f))
shutil.copy(os.path.join(ROOT, 'backoffice', 'README.md'), os.path.join(OUT, 'backoffice', 'README.md'))
shutil.copy(os.path.join(OFF, 'styleguide.html'), os.path.join(OUT, 'dev', 'styleguide.html'))
shutil.copy(os.path.join(ROOT, 'tools', 'release', 'README-TH.md'), os.path.join(OUT, 'README-TH.md'))
zipdir(OUT)

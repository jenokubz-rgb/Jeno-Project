#!/usr/bin/env python3
"""r20: production package of A · B · C from the offline build → dist/release/SBP-AirCare-<rev>/ + .zip
  web/        index.html (choose an edition) · a.html · b.html · c.html   — single files, everything embedded, upload as-is
  backoffice/ backoffice.html (INTERNAL — never on the public site) · apps-script/Code.gs + appsscript.json · README.md
  dev/        styleguide.html (design system for the dev team)
  README-TH.md  how to open, host, connect the back office (meta tag, no rebuild) and what the owner must confirm first
usage: npm run build (or build:dev) && npm run release   [--rev r20]"""
import base64, os, shutil, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REV = sys.argv[sys.argv.index('--rev') + 1] if '--rev' in sys.argv else 'r20'
OFF = os.path.join(ROOT, 'dist', 'offline')
OUT = os.path.join(ROOT, 'dist', 'release', f'SBP-AirCare-{REV}')
for f in ('a.html', 'b.html', 'c.html', 'backoffice.html', 'styleguide.html'):
    assert os.path.exists(os.path.join(OFF, f)), f'missing dist/offline/{f} — run npm run build first'
if os.path.exists(OUT): shutil.rmtree(OUT)
for d in ('web', 'backoffice/apps-script', 'dev'): os.makedirs(os.path.join(OUT, d))
for v in 'abc':
    s = open(os.path.join(OFF, f'{v}.html'), encoding='utf-8').read()
    # the beta hub of the dev builds (index3) is not in the package → "back" goes to the package's own index
    s = s.replace('globalThis.SBP_HUB="./index3.html"', 'globalThis.SBP_HUB="./index.html"').replace('href="./index3.html"', 'href="./index.html"')
    open(os.path.join(OUT, 'web', f'{v}.html'), 'w', encoding='utf-8').write(s)
logo = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(ROOT, 'assets', 'logos', 'sbp.png'), 'rb').read()).decode()
idx = open(os.path.join(ROOT, 'tools', 'release', 'index.html'), encoding='utf-8').read().replace('{{LOGO}}', logo).replace('{{REV}}', f'Rev.09 {REV}')
open(os.path.join(OUT, 'web', 'index.html'), 'w', encoding='utf-8').write(idx)
shutil.copy(os.path.join(OFF, 'backoffice.html'), os.path.join(OUT, 'backoffice', 'backoffice.html'))
for f in ('Code.gs', 'appsscript.json'): shutil.copy(os.path.join(ROOT, 'backoffice', 'apps-script', f), os.path.join(OUT, 'backoffice', 'apps-script', f))
shutil.copy(os.path.join(ROOT, 'backoffice', 'README.md'), os.path.join(OUT, 'backoffice', 'README.md'))
shutil.copy(os.path.join(OFF, 'styleguide.html'), os.path.join(OUT, 'dev', 'styleguide.html'))
shutil.copy(os.path.join(ROOT, 'tools', 'release', 'README-TH.md'), os.path.join(OUT, 'README-TH.md'))
z = OUT + '.zip'
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for base, _, files in os.walk(OUT):
        for f in sorted(files):
            p = os.path.join(base, f); zf.write(p, os.path.relpath(p, os.path.dirname(OUT)))
print({'folder': os.path.relpath(OUT, ROOT), 'zip': os.path.relpath(z, ROOT), 'zip_kb': os.path.getsize(z) // 1024})

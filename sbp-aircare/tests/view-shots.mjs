// r21 visual review: screenshot every view (page) of A · B · C one screen at a time, the way a visitor scrolls through it
// (full-page captures are unreliable here: software-WebGL scenes do not finish rendering in a page-tall viewport).
// Each step scrolls one screen minus the sticky header, waits for lazy parts / 3D frames, then captures the viewport.
// Prints per-view height, sideways overflow and console errors.
// usage: node tests/view-shots.mjs <a|b|c> [width=1366] [light|dark] [outDir=tests/out/views] [views=all, comma list]
//   → <outDir>/<page>-<width>-<theme>-<view>-NN.jpg (JPEG q72 · tests/out is gitignored)
import { launch, BASE } from './_lib.mjs';
import { mkdirSync } from 'node:fs';
const [pg = 'a', w = '1366', scheme = 'light', out = 'tests/out/views', only = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const mob = +w < 600, H = mob ? 844 : 900;
const b = await launch();
const p = await b.newPage({ viewport: { width: +w, height: H }, colorScheme: scheme, isMobile: mob, hasTouch: mob, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU stall|context lost/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.goto(`${BASE}/${pg}.html`);
await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
await p.waitForTimeout(1500);
let views = await p.evaluate(() => [...new Set([...document.querySelectorAll('header nav a[data-v]')].map(a => a.dataset.v))]);
if (!views.length) views = ['home', 'shop', 'service', 'business', 'knowledge', 'contact'];
if (only) views = views.filter(v => only.split(',').includes(v));
for (const v of views) {
  await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(1800);
  await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(600);
  const head = await p.evaluate(() => Math.round(document.querySelector('header')?.getBoundingClientRect().height || 0));
  const step = H - Math.min(head, 140) - 24;
  let y = 0, n = 0, total = 0;
  do {
    await p.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y); await p.waitForTimeout(1300);
    total = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({ path: `${out}/${pg}-${w}-${scheme}-${v}-${String(n++).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 72, timeout: 240000 });
    y += step;
  } while (y < total - H + step && n < 60);
  const ox = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${v.padEnd(10)} h=${total} shots=${n} overflow=${ox}`);
}
console.log('RESULT ' + JSON.stringify({ test: 'view-shots', page: pg, w: +w, scheme, views: views.length, errors: errs.slice(0, 5) }));
await b.close();
process.exit(errs.length ? 1 : 0);

// r21 load metrics of a page (dev server or a built file): FCP · LCP · CLS · TBT (long tasks over 50 ms, first N seconds)
// · DOM nodes · transferred size. Phone profile = 390×844 touch, CPU slowed 4× (CDP), like a mid-range Android.
// usage: node tests/webvitals.mjs <url|file> [width=390] [seconds=10] [runs=3]   → one line per run + "RESULT {json}" (medians)
//   e.g. node tests/webvitals.mjs dist/release/SBP-AirCare-ABC-r21/a.html      node tests/webvitals.mjs http://localhost:8765/c.html 1366
// software WebGL on the test machine is slower than a real phone GPU — compare before/after, not against real-device numbers
import { launch } from './_lib.mjs';
import { resolve } from 'node:path';
import { statSync } from 'node:fs';
const [target, w = '390', secs = '10', runs = '3'] = process.argv.slice(2);
if (!target) { console.log('usage: node tests/webvitals.mjs <url|file> [width] [seconds] [runs]'); process.exit(2); }
const url = /^https?:|^file:/.test(target) ? target : 'file://' + resolve(target);
const mob = +w < 600;
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const res = [];
for (let r = 0; r < +runs; r++) {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: mob ? 844 : 900 }, isMobile: mob, hasTouch: mob });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  if (mob) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.addInitScript(() => {
    const m = globalThis.__wv = { fcp: 0, lcp: 0, cls: 0, tbt: 0, long: 0 };
    new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.name === 'first-contentful-paint') m.fcp = e.startTime; })).observe({ type: 'paint', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => { m.lcp = e.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) m.cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(l => l.getEntries().forEach(e => { m.long++; m.tbt += Math.max(0, e.duration - 50); })).observe({ type: 'longtask', buffered: true });
  });
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'load', timeout: 180000 });
  const loadMs = Date.now() - t0;
  await p.waitForTimeout(+secs * 1000);
  const m = await p.evaluate(() => ({ ...globalThis.__wv, dom: document.getElementsByTagName('*').length, dcl: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0 }));
  const one = { fcp: Math.round(m.fcp), lcp: Math.round(m.lcp), cls: +m.cls.toFixed(3), tbt: Math.round(m.tbt), longTasks: m.long, dcl: Math.round(m.dcl), load: loadMs, dom: m.dom };
  console.log(`run ${r + 1}: ` + JSON.stringify(one));
  res.push(one);
  await b.close();
}
const keys = Object.keys(res[0]), out = Object.fromEntries(keys.map(k => [k, med(res.map(x => x[k]))]));
let kb = null; try { if (!/^https?:/.test(url)) kb = Math.round(statSync(new URL(url)).size / 1024); } catch (e) {}
console.log('RESULT ' + JSON.stringify({ test: 'webvitals', target, w: +w, cpu: mob ? '4x' : '1x', secs: +secs, runs: +runs, kb, median: out }));

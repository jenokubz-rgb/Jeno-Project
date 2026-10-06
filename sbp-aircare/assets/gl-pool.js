// SBP AirCare — WebGL context budget (B1, Rev.09). Every 3D scene registers its renderer here; at most MAX contexts stay
// live — the ones nearest the viewport. A scene that scrolls away keeps its JS state (step, camera, sliders) but its GL
// context is released through WEBGL_lose_context; when it comes back near the viewport the context is restored and three.js
// re-uploads geometry/textures by itself. The only GPU-side content three cannot rebuild is a PMREM environment map,
// so the pool regenerates scene.environment on restore. No module needs a suspend/resume rewrite.
// Hysteresis keeps scenes from flapping at the edge; reduced-motion users get the same budget.
import * as THREE from './three.module.min.js';
import { RoomEnvironment } from './RoomEnvironment.js';

// r8: 4 live scenes on devices that report ≥ 4 GB (fewer re-uploads while scrolling a view with 4 scenes); 3 otherwise (iOS
// reports nothing), 2 on ≤ 2 GB devices
const MAX = navigator.deviceMemory ? (navigator.deviceMemory <= 2 ? 2 : navigator.deviceMemory >= 4 ? 4 : 3) : 3;
const NEAR = 0.9;                  // "near" = within 0.9 viewport heights above/below the screen
const entries = [];
let queued = 0;

function dist(e) {
  const r = e.el.getBoundingClientRect(), vh = innerHeight || 800;
  if (!r.width && !r.height) return Infinity;                 // hidden (display:none / collapsed)
  if (r.bottom < 0) return -r.bottom / vh;                    // above the screen
  if (r.top > vh) return (r.top - vh) / vh;                   // below the screen
  return 0;                                                   // on screen
}
function balance() {
  queued = 0;
  // disposed scenes leave the pool (only once their canvas has been on the page: track() may run before it is appended)
  for (let i = entries.length - 1; i >= 0; i--) { const e = entries[i]; if (e.renderer.domElement.isConnected) e.seen = true; else if (e.seen) entries.splice(i, 1); }
  entries.forEach(e => { e.d = dist(e); });
  const want = entries.filter(e => e.d <= NEAR).sort((a, b) => a.d - b.d || b.t - a.t).slice(0, MAX);
  const keep = new Set(want);
  const active = () => entries.filter(e => e.state === 'live' || e.state === 'restoring' || e.state === 'losing');
  // free only what is needed to fit the wanted scenes (farthest first). r8: a scene that scrolled away keeps its context while
  // there is room — releasing it early meant a full re-upload + shader re-compile (a visible stall) every time it came back
  let excess = active().length + want.filter(e => e.state === 'lost').length - MAX;
  active().filter(e => e.state === 'live' && e.ext && !keep.has(e)).sort((a, b) => b.d - a.d)
    .forEach(e => { if (excess > 0) { lose(e); excess--; } });
  // bring back wanted scenes only once their slot is really free (the async 'lost' event re-runs this)
  let room = MAX - active().length;
  want.forEach(e => { if (e.state === 'lost' && room > 0) { restore(e); room--; } });
}
const schedule = () => { if (!queued) queued = requestAnimationFrame(balance); };
function lose(e) { if (!e.ext) return; e.state = 'losing'; try { e.ext.loseContext(); } catch (_) { e.state = 'live'; } }
function restore(e) { if (!e.ext) return; e.state = 'restoring'; try { e.ext.restoreContext(); } catch (_) { e.state = 'lost'; } }

let wired = false;
function wire() {
  if (wired) return; wired = true;
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);
  setInterval(schedule, 1500);   // catches layout shifts (lazy sections growing) that fire no scroll event
}

// r8: after a restore, three.js's previous state objects still listen for 'dispose' on every geometry / material / texture;
// disposing one later made them delete the lost context's buffers ("object does not belong to this context" floods). The
// new state re-attaches its own listeners on first use, so the stale ones are dropped here (three r170 EventDispatcher).
function forget(root) {
  const seen = new Set(), f = o => { if (o && o._listeners && o._listeners.dispose && !seen.has(o)) { seen.add(o); delete o._listeners.dispose; } };
  root.traverse(n => { f(n.geometry); (Array.isArray(n.material) ? n.material : n.material ? [n.material] : []).forEach(m => { f(m); for (const k in m) { const v = m[k]; if (v && v.isTexture) f(v); } }); });
  if (root.environment) f(root.environment);
}
/** register a renderer; el = the element whose position decides priority. opts.scene → its RoomEnvironment map is rebuilt
 *  after a restore; opts.redraw() → called after a restore for scenes that render on demand. Returns { release() }. */
// r8: touch devices draw at ≤ 1.5× (≤ 1.25× on low-memory / few-core phones) instead of 2×: several animated scenes at 2× on a
// 3× phone screen were fill-rate bound (stutter, heat); the difference is hard to see at phone size
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const LOW = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
export const PR_CAP = COARSE ? (LOW ? 1.25 : 1.5) : 2;
export function track(renderer, el, opts = {}) {
  if (renderer.getPixelRatio() > PR_CAP) { const sz = renderer.getSize(new THREE.Vector2()); renderer.setPixelRatio(PR_CAP); if (sz.x && sz.y) renderer.setSize(sz.x, sz.y, false); }
  const gl = renderer.getContext();
  const e = { renderer, el, scene: opts.scene || null, env: !!(opts.scene && opts.scene.environment), redraw: opts.redraw || null, ext: gl && gl.getExtension('WEBGL_lose_context'), state: 'live', t: performance.now(), d: 0 };
  const cv = renderer.domElement;
  // loseContext() makes the context unusable at once but three.js only learns of it from the async event — until then a
  // render would compile programs on a dead context (getProgramInfoLog → null). So render only while the slot is live.
  const render0 = renderer.render.bind(renderer);
  renderer.render = (s, c) => { if (e.state === 'live') render0(s, c); };
  cv.addEventListener('webglcontextlost', () => { e.state = 'lost'; schedule(); });
  cv.addEventListener('webglcontextrestored', () => {
    e.state = 'live'; e.t = performance.now();
    if (e.scene) forget(e.scene);   // r8: before the next render (three.js has just rebuilt its state in its own handler)
    // three.js restores its own state on this event (registered first); rebuild the GPU-generated environment map after it
    setTimeout(() => {
      if (e.env && e.scene) { try { const pm = new THREE.PMREMGenerator(renderer); const old = e.scene.environment; e.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); old && old.dispose && old.dispose(); } catch (_) {} }
      e.redraw && e.redraw();
      schedule();
    }, 0);
  });
  // balance now, not on the next frame: scenes that boot back to back (fast scroll, single-file build) must not overshoot
  entries.push(e); wire(); if (queued) { cancelAnimationFrame(queued); } balance();
  // r12 move(el): the canvas was moved to another place on the page (one cinema serving several slots)
  return { release() { const i = entries.indexOf(e); if (i >= 0) entries.splice(i, 1); schedule(); }, move(el2) { e.el = el2; schedule(); } };
}
export const glBudget = () => ({ max: MAX, live: entries.filter(e => e.state === 'live').length, total: entries.length });

/** r8: free what a removed subtree holds on the GPU — geometries, and the materials / textures that are not shared (keep =
 *  a Set of shared materials; their textures are kept too). Disposing something still in use is safe in three.js (it is
 *  uploaded again on next use) but costs a re-upload, so pass the shared sets. */
export function disposeDeep(root, keep = null) {
  if (!root) return;
  const keepT = new Set(); if (keep) keep.forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) keepT.add(v); } });
  const doneM = new Set();
  root.traverse(o => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach(m => {
      if (doneM.has(m) || (keep && keep.has(m))) return; doneM.add(m);
      for (const k in m) { const v = m[k]; if (v && v.isTexture && !keepT.has(v)) v.dispose(); }
      m.dispose();
    });
  });
}

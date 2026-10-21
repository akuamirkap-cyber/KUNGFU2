// Verify the React menu renders the new cards/settings and that every button works
import { build } from 'esbuild';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
await build({ entryPoints: ['/home/user/sandbox/src/main.tsx'], bundle: true, platform: 'browser', format: 'iife', outfile: '/tmp/app.js', logLevel: 'silent', target: 'es2020', define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'empty' } });
const fs = require('fs');
const code = fs.readFileSync('/tmp/app.js', 'utf8');
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;
const noop = () => {};
const ctxStub = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set(t, k, v) { t[k] = v; return true; } });
w.HTMLCanvasElement.prototype.getContext = () => ctxStub;
w.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 270 });
let rafCb = null; w.requestAnimationFrame = (cb) => { rafCb = cb; return 1; }; w.cancelAnimationFrame = noop; w.innerWidth = 1440; w.innerHeight = 810;
w.eval(code);
for (let i = 0; i < 100 && !w.__kf; i++) await new Promise((r) => setTimeout(r, 20));
const txt = d.body.textContent;
const expect = ['KUNGFU', 'DRIFTER', 'STORY', 'SURVIVAL', 'NEW RUN', 'SURVIVE', 'BLOOD SYSTEM', 'NORMAL', 'GORE', 'COMBINED', 'SOUND ON', 'CONTROLS & MOVE LIST', 'NUNCHAKU', 'KATANA', 'AXE', 'DUAL BLADES'];
const missing = expect.filter((e) => !txt.includes(e));
console.log('menu texts present:', expect.length - missing.length, '/', expect.length, missing.length ? 'MISSING: ' + missing.join(', ') : '');
const btn = (label) => [...d.querySelectorAll('button')].find((b) => b.textContent.includes(label));
btn('GORE').click(); await new Promise((r) => setTimeout(r, 20)); console.log('blood after GORE click:', w.__kf.blood.mode);
btn('CONTROLS & MOVE LIST').click(); await new Promise((r) => setTimeout(r, 20)); console.log('controls panel open:', d.body.textContent.includes('BRUCE LEE TRIANGLE'));
btn('SURVIVE').click(); await new Promise((r) => setTimeout(r, 30)); console.log('after SURVIVE click: state', w.__kf.state, 'mode', w.__kf.mode, 'wave', w.__kf.wave);
for (let i = 0; i < 30 && rafCb; i++) { const cb = rafCb; rafCb = null; cb(i * 16.7); }
console.log(missing.length === 0 && w.__kf.mode === 'survival' ? 'MENU CHECK PASSED' : 'MENU CHECK FAILED');

import { build } from 'esbuild';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
await build({ entryPoints: ['/home/user/sandbox/src/main.tsx'], bundle: true, platform: 'browser', format: 'iife', outfile: '/tmp/app.js', logLevel: 'silent', target: 'es2020', define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'empty' } });
const fs = require('fs');
const code = fs.readFileSync('/tmp/app.js', 'utf8');
const dom = new JSDOM(`<!doctype html><html><body><iframe id="f"></iframe></body></html>`, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const iwin = dom.window.document.getElementById('f').contentWindow; const idoc = iwin.document;
idoc.open(); idoc.write('<!doctype html><html><body><div id="root"></div></body></html>'); idoc.close();
const noop = () => {};
const ctxStub = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set(t, k, v) { t[k] = v; return true; } });
iwin.HTMLCanvasElement.prototype.getContext = () => ctxStub;
iwin.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 270 });
let rafCb = null; iwin.requestAnimationFrame = (cb) => { rafCb = cb; return 1; }; iwin.cancelAnimationFrame = noop;
iwin.innerWidth = 1440; iwin.innerHeight = 810;
iwin.eval(code);
for (let i = 0; i < 100 && !iwin.__kf; i++) await new Promise((r) => setTimeout(r, 20));
const canvas = idoc.querySelector('canvas');
console.log('game instance exposed:', !!iwin.__kf, '| state:', iwin.__kf && iwin.__kf.state);
console.log('canvas tabIndex:', canvas.tabIndex, 'activeElement after mount:', idoc.activeElement === canvas ? 'canvas' : idoc.activeElement.tagName);
const btn = [...idoc.querySelectorAll('button')].find((b) => b.textContent.includes('NEW RUN'));
console.log('STORY button found:', !!btn);
btn.dispatchEvent(new iwin.MouseEvent('mousedown', { bubbles: true, button: 0 }));
btn.click();
await new Promise((r) => setTimeout(r, 50));
console.log('after NEW GAME: activeElement =', idoc.activeElement === canvas ? 'canvas (OK)' : idoc.activeElement.tagName, '| overlays left:', idoc.querySelectorAll('button').length);
// simulate frames + parent-document key input, check HUD still renders and player moves
for (let i = 0; i < 200 && rafCb; i++) { const cb = rafCb; rafCb = null; cb(i * 16.7); }
const KE = dom.window.KeyboardEvent;
dom.window.document.body.dispatchEvent(new KE('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
for (let i = 0; i < 60 && rafCb; i++) { const cb = rafCb; rafCb = null; cb(4000 + i * 16.7); }
const kf = iwin.__kf; console.log('frames ran OK | state:', kf.state, '| level', kf.levelN, '| key w held:', kf.input.key('w'), '| player moving:', kf.player.moving, '| hasFocus:', idoc.hasFocus());

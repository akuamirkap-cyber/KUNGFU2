import { build } from 'esbuild';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
await build({ stdin: { contents: "export * from './game/game'; export * from './game/input';", resolveDir: '/home/user/sandbox/src', loader: 'ts' }, bundle: true, platform: 'browser', format: 'iife', globalName: 'KF', outfile: '/tmp/kf.js', logLevel: 'silent', target: 'es2020' });
const fs = require('fs');
const code = fs.readFileSync('/tmp/kf.js', 'utf8');

// Parent page with an iframe (same origin). Game runs inside the iframe.
const dom = new JSDOM(`<!doctype html><html><body><iframe id="f"></iframe></body></html>`, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const parentWin = dom.window;
const iframe = parentWin.document.getElementById('f');
const iwin = iframe.contentWindow;
const idoc = iwin.document;
idoc.open(); idoc.write('<!doctype html><html><body><canvas id="c"></canvas></body></html>'); idoc.close();
// canvas 2d stub
const noop = () => {};
const ctxStub = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set(t, k, v) { t[k] = v; return true; } });
iwin.HTMLCanvasElement.prototype.getContext = () => ctxStub;
iwin.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 270 });
iwin.requestAnimationFrame = () => 0; iwin.cancelAnimationFrame = noop;
iwin.performance = iwin.performance || { now: () => Date.now() };
iwin.eval(code);
const canvas = idoc.getElementById('c');
const g = new iwin.KF.Game(canvas);
g.newGame(null); g.state = 'playing'; g.startLevel(2); g.wipe = null;
g.spawnQueue.length = 0; for (const e of [...g.enemies]) g.killEnemy(e, 0, 100, true);
const step = (n) => { for (let i = 0; i < n; i++) { g.frame(1 / 60); g.endFrameInput(); } };
step(120); // let the level-clear slow-mo finish
console.log('parentAttached =', g.input.parentAttached, 'timeScale', g.timeScale.toFixed(2));

// 1) keydown dispatched on the PARENT document (iframe not focused) -> should still move
const p = g.player; const x0 = p.x;
const KE = parentWin.KeyboardEvent;
parentWin.document.body.dispatchEvent(new KE('keydown', { key: 'd', code: 'KeyD', bubbles: true }));
console.log('key d registered from parent doc:', g.input.key('d') ? 'OK' : 'FAIL');
step(30);
parentWin.document.body.dispatchEvent(new KE('keyup', { key: 'd', code: 'KeyD', bubbles: true }));
console.log('parent-doc keydown moved player:', (p.x - x0).toFixed(1), 'px', (p.x - x0 > 20 ? 'OK' : 'FAIL'));

// 2) keydown on the iframe window itself (focused case)
const x1 = p.x; const IKE = iwin.KeyboardEvent;
idoc.body.dispatchEvent(new IKE('keydown', { key: 'Process', code: 'KeyD', bubbles: true })); // IME style
step(30);
idoc.body.dispatchEvent(new IKE('keyup', { key: 'Process', code: 'KeyD', bubbles: true }));
console.log('iframe IME keydown moved player:', (p.x - x1).toFixed(1), 'px', (p.x - x1 > 20 ? 'OK' : 'FAIL'));

// 3) clicking the canvas focuses it (so keyboard goes to the iframe afterwards)
canvas.dispatchEvent(new iwin.MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 10, clientY: 10 }));
console.log('activeElement after click is canvas:', idoc.activeElement === canvas ? 'OK' : 'FAIL (' + (idoc.activeElement && idoc.activeElement.tagName) + ')');

// 4) middle mouse fallback
const x2 = p.x;
g.input.mouse.x = 20; g.input.mouse.y = 135; g.input.mouse.mdown = true; step(1);
console.log('DEBUG mdown', g.input.mouse.mdown, 'down', g.input.mouse.down, 'moving', p.moving, 'vx', p.vx.toFixed(1), 'phase', p.attackPhase, 'stun', p.stunT.toFixed(2), 'hold', p.holdT.toFixed(2), 'state', g.state, 'hitstop', g.hitstop.toFixed(3), 'fatality', !!p.fatality, 'keys', [...g.input.keys].join(','));
step(29); g.input.mouse.mdown = false;
console.log('middle-mouse run moved player:', (x2 - p.x).toFixed(1), 'px', (x2 - p.x > 20 ? 'OK' : 'FAIL'));

import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const out = path.join(__dirname, '.chain.cjs');
await build({ stdin: { contents: "export * from './game/game'; export * from './game/moves';", resolveDir: path.join(__dirname, '../src'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' });
const noop = () => {};
function makeCtx() { return new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set(t, k, v) { t[k] = v; return true; } }); }
function makeCanvas() { return { width: 0, height: 0, style: {}, getContext: () => makeCtx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }), addEventListener: noop, removeEventListener: noop, focus: noop, tabIndex: 0 }; }
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval, clearInterval };
globalThis.document = { createElement: () => makeCanvas(), addEventListener: noop, removeEventListener: noop, hidden: false, hasFocus: () => true };
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = noop;
const { Game } = require(out);
const g = new Game(makeCanvas());
g.newGame(null); g.state = 'playing'; g.startLevel(12); g.wipe = null;
g.spawnQueue.length = 0; for (const e of [...g.enemies]) g.killEnemy(e, 0, 100, true);
const p = g.player;
const step = (n) => { for (let i = 0; i < n; i++) { g.frame(1 / 60); g.endFrameInput(); } };
const click = () => { g.input.mouse.pressed = true; g.input.mouse.down = true; };
const press = (k) => { g.input.keys.add(k); g.input.pressed.add(k); };
step(100); g.slowT = 0; g.timeScale = 1; g.enemies.length = 0; g.setWeapon('fist');
let failed = false;
// ---- 1) rhythm spam: click every 12 frames (0.2s) at a tough dummy
const e = g.spawnEnemyAt('brute', p.x + 16, p.y, false); e.spawnT = 0; e.hp = e.maxHp = 400; e.attackCd = 99; e.speed = 0; e.kbRes = 1;
g.input.mouse.x = p.x - g.cam.x + 40; g.input.mouse.y = p.y - g.cam.y - 6; step(1);
let hits = 0, lastHp = e.hp, maxChain = 0, fists = new Set(), moves = new Set();
for (let i = 0; i < 60 * 8; i++) {
  if (i % 12 === 0) click();
  step(1);
  if (e.hp < lastHp) { hits++; lastHp = e.hp; }
  maxChain = Math.max(maxChain, p.chain);
  if (p.moveKey) moves.add(p.moveKey);
  if (p.moveKey === 'CHAIN') fists.add(p.chainSide);
  e.x = p.x + 16; e.y = p.y; e.kx = e.ky = 0; e.z = 0; e.vz = 0; e.down = 0; e.stagger = 0; e.structure = 0;
}
console.log(`spam 0.2s: hits=${hits} in 8s | max chain=${maxChain} | fists used=${[...fists].join(',')} | moves=${[...moves].join(',')} | rage=${p.rage.toFixed(0)} | dmg dealt=${400 - e.hp}`);
if (maxChain < 15 || hits < 20 || fists.size < 2 || !moves.has('CHAIN')) { console.log('   FAIL: chain punch not working'); failed = true; }
// ---- 2) rhythm too slow (0.6s): no chain
p.chain = 0; p.attackPhase = 'none'; step(40); let ch2 = 0;
for (let i = 0; i < 60 * 3; i++) { if (i % 36 === 0) click(); step(1); ch2 = Math.max(ch2, p.chain); e.x = p.x + 16; e.y = p.y; e.kx = e.ky = 0; e.structure = 0; }
console.log(`spam 0.6s: max chain=${ch2} ->`, ch2 <= 1 ? 'OK (no chain)' : 'FAIL');
if (ch2 > 1) failed = true;
// ---- 3) the finish: a weak enemy -> chain ends with WING CHUN FINISH when it is nearly dead
e.dead = true; g.enemies.length = 0; p.chain = 0; p.attackPhase = 'none'; step(30);
const w = g.spawnEnemyAt('thug', p.x + 16, p.y, false); w.spawnT = 0; w.hp = w.maxHp = 20; w.attackCd = 99; w.speed = 0; w.kbRes = 1;
let finished = false, hpAtFinish = -1;
for (let i = 0; i < 60 * 6 && !w.dead; i++) { if (i % 12 === 0) click(); step(1); if (p.moveKey === 'CHAINEND' && !finished) { finished = true; hpAtFinish = w.hp; } w.x = p.x + 16; w.y = p.y; w.kx = w.ky = 0; w.z = 0; w.vz = 0; }
console.log(`finish: triggered=${finished} at target hp ${hpAtFinish}/20 | target dead=${w.dead}`);
if (!finished || hpAtFinish > Math.max(3, 20 * 0.22) + 1.5) { console.log('   FAIL: finish condition'); failed = true; }
// ---- 4) rage: fill the meter by chaining, activate with R, each LMB dashes to the nearest enemy and kills it
p.rage = 100; g.setWeapon('fist'); p.attackPhase = 'none'; p.chain = 0; step(10); press('r'); step(2);
console.log('rage on:', p.rageOn, 'timer', p.rageT.toFixed(1));
if (!p.rageOn) { console.log('   FAIL: rage did not start'); failed = true; }
g.enemies.length = 0;
const victims = [];
for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const v = g.spawnEnemyAt('thug', p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 50, false); v.spawnT = 0; v.attackCd = 99; v.speed = 0; victims.push(v); }
step(5);
let clicks = 0;
for (let i = 0; i < 60 * 6 && victims.some((v) => !v.dead); i++) {
  if (!p.rageDash && p.attackPhase === 'none' && i % 10 === 0) { click(); clicks++; }
  step(1);
}
console.log(`rage: clicks=${clicks} kills=${victims.filter((v) => v.dead).length}/4 | rageKills=${p.rageKills} | still raging=${p.rageOn}`);
if (victims.filter((v) => v.dead).length < 4) { console.log('   FAIL: rage did not execute everyone'); failed = true; }
console.log(failed ? 'CHAIN TEST FAILED' : 'CHAIN TEST PASSED');
process.exit(failed ? 1 : 0);

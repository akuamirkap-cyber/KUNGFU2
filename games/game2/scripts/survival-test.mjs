// Survival mode probe: run a naive bot through waves and report per-wave pressure
import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const out = path.join(__dirname, '.surv.cjs');
await build({ stdin: { contents: "export * from './game/game'; export * from './game/level';", resolveDir: path.join(__dirname, '../src'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' });
const noop = () => {};
function makeCtx() { return new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set(t, k, v) { t[k] = v; return true; } }); }
function makeCanvas() { return { width: 0, height: 0, style: {}, getContext: () => makeCtx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }), addEventListener: noop, removeEventListener: noop, focus: noop, tabIndex: 0 }; }
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval, clearInterval };
globalThis.document = { createElement: () => makeCanvas(), addEventListener: noop, removeEventListener: noop, hidden: false, hasFocus: () => true };
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = noop;
const { Game, flowField, flowDir } = require(out);
const godmode = process.argv[2] === 'god';
const casual = process.argv[2] === 'casual'; // no bullet dodging, no fatality/focus spam, fists only
const g = new Game(makeCanvas());
g.newSurvival();
const p = g.player;
const press = (k) => { g.input.keys.add(k); g.input.pressed.add(k); };
let frames = 0, lastWave = 0, waveStart = 0, dmg = 0, lastHp = p.hp, maxAlive = 0, spawnedThisWave = 0, lastKills = 0;
let flowCache = { x: -1, y: -1, f: null, t: -999 };
const moveTo = (tx, ty) => {
  if (frames - flowCache.t > 15 || Math.hypot(flowCache.x - tx, flowCache.y - ty) > 24) flowCache = { x: tx, y: ty, f: flowField(g.level, tx, ty), t: frames };
  let dir = g.hasLOS({ x: tx, y: ty }) ? null : flowDir(g.level, flowCache.f, p.x, p.y);
  if (!dir) { const d = Math.hypot(tx - p.x, ty - p.y) || 1; dir = { x: (tx - p.x) / d, y: (ty - p.y) / d }; }
  if (dir.x > 0.3) press('d'); else if (dir.x < -0.3) press('a');
  if (dir.y > 0.3) press('s'); else if (dir.y < -0.3) press('w');
};
const origSpawn = g.spawnEnemyAt.bind(g);
g.spawnEnemyAt = (...a) => { spawnedThisWave++; return origSpawn(...a); };
const report = [];
const maxWaves = parseInt(process.argv[3] || '14', 10);
while (frames < 60 * 60 * 25 && g.wave <= maxWaves) {
  frames++;
  if (g.state === 'mutation') { g.chooseMutation(0); }
  if (g.state === 'dead') { if (godmode) { p.hp = g.maxHp(); g.state = 'playing'; } else { g.respawn(); break; } }
  if (g.state === 'gameover') break;
  if (g.wave !== lastWave) {
    if (lastWave > 0) report.push({ wave: lastWave, secs: ((frames - waveStart) / 60).toFixed(0), spawned: spawnedThisWave, kills: g.kills - lastKills, maxAlive, dmg, tokens: g.maxTokens(), brut: g.brutality().toFixed(2), budgetLeft: g.waveBudget });
    lastWave = g.wave; waveStart = frames; dmg = 0; maxAlive = 0; spawnedThisWave = 0; lastKills = g.kills;
  }
  const alive = g.enemies.filter((e) => !e.dead && e.spawnT <= 0);
  maxAlive = Math.max(maxAlive, alive.length);
  let target = null, bd = 1e9;
  for (const e of alive) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; target = e; } }
  g.input.keys.clear();
  if (target) {
    g.input.mouse.x = target.x - g.cam.x; g.input.mouse.y = target.y - 6 - g.cam.y;
    if (bd > 18) moveTo(target.x, target.y);
    if (bd < 32 && frames % 5 === 0) { if (!casual && p.weapon !== 'katana') press('5'); if (casual && p.weapon !== 'fist') press('1'); g.input.mouse.pressed = true; g.input.mouse.down = true; }
    // dodge bullets: shadow step when one is about to hit
    if (!casual && frames % 2 === 0) for (const b of g.bullets) { if (b.owner !== 'enemy') continue; const t = ((p.x - b.x) * b.vx + (p.y - b.y) * b.vy) / (b.vx * b.vx + b.vy * b.vy + 1e-6); if (t > 0 && t < 0.25) { const cx = b.x + b.vx * t, cy = b.y + b.vy * t; if (Math.hypot(cx - p.x, cy - p.y) < 10) { press('shift'); break; } } }
    if (bd < 32 && frames % 29 === 0) g.input.mouse.rpressed = true;
    if (target.state === 'windup' && bd < 40 && target.stateT < 0.2 && frames % 3 === 0) press('c');
    if (frames % 80 === 0) press('shift');
    if (!casual && frames % 45 === 0) press('f');
    if (!casual && frames % 120 === 0) press('e');
    if (casual && frames % 200 === 0) press('f');
  }
  g.frame(1 / 60); g.endFrameInput();
  if (p.hp < lastHp) dmg += lastHp - p.hp;
  lastHp = p.hp;
}
console.log('wave  secs  spawned  kills  maxAlive  dmgTaken  tokens  brutality');
for (const r of report) console.log(String(r.wave).padStart(4), String(r.secs).padStart(5), String(r.spawned).padStart(8), String(r.kills).padStart(6), String(r.maxAlive).padStart(9), String(r.dmg).padStart(9), String(r.tokens).padStart(7), String(r.brut).padStart(10));
console.log('end: state', g.state, 'wave', g.wave, 'time', (g.survivalTime).toFixed(0) + 's', 'kills', g.kills, 'score', g.score, 'hp', p.hp, '/', g.maxHp(), 'mutations', g.mutations.length);

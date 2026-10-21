// Freestyle rhythm engine: tempo -> style, auto-combos, style switching, finishers, heat
import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const out = path.join(__dirname, '.rhythm.cjs');
await build({ stdin: { contents: "export * from './game/game'; export * from './game/moves';", resolveDir: path.join(__dirname, '../src'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' });
const noop = () => {};
function makeCtx() { return new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set(t, k, v) { t[k] = v; return true; } }); }
function makeCanvas() { return { width: 0, height: 0, style: {}, getContext: () => makeCtx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }), addEventListener: noop, removeEventListener: noop, focus: noop, tabIndex: 0 }; }
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval, clearInterval };
globalThis.document = { createElement: () => makeCanvas(), addEventListener: noop, removeEventListener: noop, hidden: false, hasFocus: () => true };
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = noop;
const { Game, MOVES } = require(out);
const g = new Game(makeCanvas());
g.newGame(null); g.state = 'playing'; g.startLevel(12); g.wipe = null;
g.spawnQueue.length = 0; for (const e of [...g.enemies]) g.killEnemy(e, 0, 100, true);
const p = g.player;
const step = (n) => { for (let i = 0; i < n; i++) { g.frame(1 / 60); g.endFrameInput(); } };
const click = () => { g.input.mouse.pressed = true; g.input.mouse.down = true; };
step(100); g.slowT = 0; g.timeScale = 1; g.enemies.length = 0; g.setWeapon('fist');
let failed = false;
function dummy(hp) { const e = g.spawnEnemyAt('brute', p.x + 16, p.y, false); e.spawnT = 0; e.hp = e.maxHp = hp; e.attackCd = 99; e.speed = 0; e.kbRes = 1; return e; }
function playTempo(e, gapFrames, seconds, label) {
  const moves = [], names = new Set(); let hits = 0, lastHp = e.hp, maxHeat = 0; const styles = new Set();
  p.rhythm = []; p.style = 'none'; p.styleStreak = 0; p.flowStep = 0; p.chain = 0; p.styleHeat = 0; p.attackPhase = 'none'; p.chainLast = -9;
  g.input.mouse.x = p.x - g.cam.x + 40; g.input.mouse.y = p.y - g.cam.y - 6; step(2);
  for (let i = 0; i < 60 * seconds; i++) {
    if (i % gapFrames === 0) click();
    step(1);
    if (e.hp < lastHp) { hits++; lastHp = e.hp; }
    if (p.moveKey && (moves.length === 0 || moves[moves.length - 1] !== p.moveKey)) { moves.push(p.moveKey); names.add(MOVES[p.moveKey]?.name); }
    styles.add(p.style); maxHeat = Math.max(maxHeat, p.styleHeat);
    e.x = p.x + 16; e.y = p.y; e.kx = e.ky = 0; e.z = 0; e.vz = 0; e.down = 0; e.stagger = 0; e.structure = 0;
  }
  console.log(`${label.padEnd(22)} gap=${(gapFrames / 60).toFixed(2)}s | styles=${[...styles].filter((s) => s !== 'none').join(',') || 'none'} | hits=${hits} | heat=${maxHeat.toFixed(2)} | moves: ${moves.slice(0, 12).join(' > ')}${moves.length > 12 ? ' ...' : ''}`);
  return { moves, hits, styles, maxHeat, names };
}
const e = dummy(2000);
const fast = playTempo(e, 10, 4, 'FAST (wing chun)');
if (!fast.styles.has('wingchun') || !fast.moves.includes('CHAIN')) { console.log('   FAIL: fast tempo should be wing chun'); failed = true; }
const med = playTempo(e, 27, 6, 'MEDIUM (black leg)');
const sanji = med.moves.filter((m) => m.startsWith('S')).length;
if (!med.styles.has('blackleg') || sanji < 5) { console.log('   FAIL: medium tempo should chain Black Leg kicks'); failed = true; }
const slow = playTempo(e, 48, 8, 'SLOW (kung fu)');
const kf = slow.moves.filter((m) => ['H', 'KF1', 'LH', 'KF2', 'LLLH', 'HHL', 'LHH', 'LLLLH', 'HLL'].includes(m)).length;
if (!slow.styles.has('kungfu') || kf < 4) { console.log('   FAIL: slow tempo should chain kung fu heavies'); failed = true; }
// transitions: fast -> medium -> slow in one sequence
{
  p.rhythm = []; p.style = 'none'; p.styleStreak = 0; p.flowStep = 0; p.chain = 0; p.styleHeat = 0; p.attackPhase = 'none'; p.chainLast = -9;
  const seq = []; const order = [];
  const plan = [[10, 8], [27, 6], [48, 5]];
  for (const [gap, n] of plan) for (let c = 0; c < n; c++) { click(); for (let f = 0; f < gap; f++) { step(1); e.x = p.x + 16; e.y = p.y; e.kx = e.ky = 0; e.structure = 0; e.z = 0; e.vz = 0; e.down = 0; } if (order[order.length - 1] !== p.style) order.push(p.style); if (p.moveKey && seq[seq.length - 1] !== p.moveKey) seq.push(p.moveKey); }
  console.log('TRANSITIONS           styles in order:', order.filter((s) => s !== 'none').join(' -> '), '| moves:', seq.join(' > '));
  const o = order.filter((s) => s !== 'none');
  if (!(o.includes('wingchun') && o.includes('blackleg') && o.includes('kungfu'))) { console.log('   FAIL: style transitions'); failed = true; }
}
// auto-finisher: a nearly dead enemy in black leg flow gets a finisher move
{
  g.enemies.length = 0; const w = dummy(60); w.kbRes = 1;
  p.rhythm = []; p.style = 'none'; p.styleStreak = 0; p.flowStep = 0; p.chain = 0; p.attackPhase = 'none'; p.chainLast = -9;
  let fin = null;
  for (let i = 0; i < 60 * 10 && !w.dead; i++) { if (i % 27 === 0) click(); step(1); if (w.hp <= 60 * 0.22 && p.moveKey && MOVES[p.moveKey]?.finisher && !fin) fin = MOVES[p.moveKey].name; w.x = p.x + 16; w.y = p.y; w.kx = w.ky = 0; w.z = 0; w.vz = 0; w.down = 0; w.stagger = 0; }
  console.log('AUTO FINISHER         black leg vs dying enemy ->', fin, '| dead:', w.dead);
  if (!fin) { console.log('   FAIL: no finisher'); failed = true; }
}
console.log(failed ? 'RHYTHM TEST FAILED' : 'RHYTHM TEST PASSED');
process.exit(failed ? 1 : 0);

import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const out = path.join(__dirname, '.hit.cjs');
await build({ stdin: { contents: "export * from './game/game'; export * from './game/stick'; export * from './game/moves';", resolveDir: path.join(__dirname, '../src'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' });
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
step(100); g.slowT = 0; g.timeScale = 1;
let failed = false;
const spawn = (dx, dy) => { const e = g.spawnEnemyAt('thug', p.x + dx, p.y + dy, false); e.spawnT = 0; e.hp = e.maxHp = 999; e.attackCd = 99; e.speed = 0; return e; };
const clear = () => { for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true); step(3); g.enemies.length = 0; p.attackPhase = 'none'; p.comboStr = ''; p.kx = p.ky = 0; p.vx = p.vy = 0; p.stunT = 0; };
// 1) Reach test: enemy just beyond fist reach must NOT be hit by a jab; enemy within reach must be hit, and only once the arm is out
console.log('--- fairness: jab vs distance');
for (const dx of [14, 20, 26, 32]) {
  clear();
  const e = spawn(dx, 0);
  g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6;
  step(1);
  g.startAttack('L');
  let hitFrame = -1, poseAtHit = 0;
  for (let i = 0; i < 20; i++) { step(1); if (hitFrame < 0 && e.hp < 999) { hitFrame = i; poseAtHit = g.attackPoseT(); } }
  console.log(`  dx=${dx}px -> ${hitFrame >= 0 ? 'HIT at frame ' + hitFrame + ' (anim t=' + poseAtHit.toFixed(2) + ')' : 'no hit'}`);
  if (dx <= 20 && hitFrame < 0) { console.log('   FAIL: in-reach enemy not hit'); failed = true; }
  if (dx >= 32 && hitFrame >= 0) { console.log('   FAIL: out-of-reach enemy was hit'); failed = true; }
  if (hitFrame >= 0 && poseAtHit < 0.3) { console.log('   FAIL: hit before the strike frame'); failed = true; }
}
// 2) Behind test: an enemy directly behind must not be hit by a forward jab, but IS hit by the 360 spinning backfist / sweep
console.log('--- fairness: behind');
{
  clear(); const e = spawn(-16, 0);
  g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6; step(1);
  g.startAttack('L'); step(20);
  console.log('  jab vs enemy behind:', e.hp < 999 ? 'HIT (FAIL)' : 'no hit (OK)'); if (e.hp < 999) failed = true;
  p.attackPhase = 'none'; p.comboStr = ''; e.hp = 999; e.x = p.x - 16; e.y = p.y; step(3);
  g.startAttack('HH'); step(45);
  console.log('  spinning backfist vs enemy behind:', e.hp < 999 ? 'HIT (OK)' : 'no hit (FAIL)'); if (e.hp >= 999) failed = true;
}
// 3) All fist combos connect on an adjacent enemy
console.log('--- all kung fu moves connect');
for (const key of ['L', 'LL', 'LLL', 'LLLL', 'LLLLL', 'H', 'LH', 'LLH', 'LLLH', 'LLLLH', 'HL', 'HLL', 'HLH', 'HH', 'HHL', 'LHL', 'LHH']) {
  clear(); p.airborne = false; p.z = 0; p.vz = 0; p.holdT = 0; p.dashT = 0; p.iframes = 0; g.hitstop = 0; g.slowT = 0; g.timeScale = 1; step(10);
  const e = spawn(15, 0);
  g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6; step(1); e.hp = 999;
  g.startAttack(key); let f = 0; while (p.attackPhase !== 'none' && f < 120) { step(1); f++; }
  const ok = e.hp < 999;
  console.log(`  ${key.padEnd(5)} ${MOVES[key].name.padEnd(18)} -> ${ok ? 'HIT' : 'MISS'} (${f} frames)`);
  if (!ok) failed = true;
}
// 4) Nunchaku: pick up, chain physics (tip reacts to gravity + hand motion), all moves connect, figure-8 multi-hits
console.log('--- nunchaku');
{
  clear(); p.hasNunchaku = true; g.setWeapon('nunchaku'); step(30);
  const tip0 = g.nunchaku.tip();
  const tucked = Math.hypot(tip0.x - p.x, tip0.y - (p.y - 8)) < 22;
  console.log('  resting chain tucked near the body (underarm):', tucked ? 'OK' : 'FAIL', `(tip rel=${(tip0.x - p.x).toFixed(1)},${(tip0.y - p.y).toFixed(1)})`);
  if (!tucked) failed = true;
  const e = spawn(22, 0);
  g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6; step(1);
  for (const key of ['NL', 'NLL', 'NLLL', 'NLLLL', 'NLLLLL', 'NH', 'NLH', 'NLLH', 'NHL', 'NHH', 'NRUN']) {
    e.hp = 999; e.x = p.x + 22; e.y = p.y; e.kx = e.ky = 0; e.down = 0; e.stun = 0; e.stagger = 0; e.z = 0; e.vz = 0; e.state = 'chase';
    p.attackPhase = 'none'; p.comboStr = ''; step(5);
    g.input.mouse.x = e.x - g.cam.x + 30; g.input.mouse.y = e.y - g.cam.y - 6; step(1); e.hp = 999;
    g.startAttack(key);
    let f = 0, maxTip = 0, hits = 0, lastHp = 999;
    while (p.attackPhase !== 'none' && f < 120) { step(1); f++; maxTip = Math.max(maxTip, g.nunchaku.tipSpeed); if (e.hp < lastHp) { hits++; lastHp = e.hp; } e.x = p.x + 22; e.y = p.y; e.kx = e.ky = 0; }
    console.log(`  ${key.padEnd(6)} ${MOVES[key].name.padEnd(17)} -> hits=${hits} maxTipSpeed=${maxTip.toFixed(0)}px/s (${f} frames)`);
    if (hits === 0) { console.log('   FAIL: no hit'); failed = true; }
    if (key === 'NH' && hits < 2) { console.log('   FAIL: multi-hit move only hit once'); failed = true; }
  }
}
// 5) Katana: all cuts connect, bleed applies, iaijutsu dooms then kills, far enemy not hit by a short cut
console.log('--- katana');
{
  clear(); p.hasKatana = true; g.setWeapon('katana'); step(20);
  const e = spawn(26, 0);
  g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6; step(1);
  for (const key of ['KL', 'KLL', 'KLLL', 'KLLLL', 'KH', 'KLH', 'KLLH', 'KHL', 'KHH']) {
    e.hp = 999; e.bleed = 0; e.x = p.x + 26; e.y = p.y; e.kx = e.ky = 0; e.down = 0; e.stun = 0; e.stagger = 0; e.z = 0; e.vz = 0; e.state = 'chase'; e.doom = 0;
    p.attackPhase = 'none'; p.comboStr = ''; step(5); e.hp = 999; e.bleed = 0;
    g.input.mouse.x = e.x - g.cam.x + 30; g.input.mouse.y = e.y - g.cam.y - 6; step(1); e.hp = 999;
    g.startAttack(key);
    let f = 0, hits = 0, lastHp = e.hp;
    while (p.attackPhase !== 'none' && f < 120) { step(1); f++; if (e.hp < lastHp) { hits++; lastHp = e.hp; } e.x = p.x + 26; e.y = p.y; e.kx = e.ky = 0; e.z = 0; e.vz = 0; }
    console.log(`  ${key.padEnd(6)} ${MOVES[key].name.padEnd(17)} -> hits=${hits} bleed=${e.bleed} arcs=${g.katana.arcs.length} (${f} frames)`);
    if (hits === 0) { console.log('   FAIL: no hit'); failed = true; }
    if (e.bleed === 0 && hits > 0) { console.log('   FAIL: no bleed applied'); failed = true; }
  }
  // far enemy must not be hit by IAI DRAW (range 30 + blade 24 => ~50px reach max)
  clear(); p.hasKatana = true; g.setWeapon('katana'); step(10); const far = spawn(70, 0); step(1); g.startAttack('KL'); step(30);
  console.log('  iai draw vs 70px enemy:', far.hp < 999 ? 'HIT (FAIL)' : 'no hit (OK)'); if (far.hp < 999) failed = true;
  // iaijutsu: run through, the victim is doomed, dies after the sheathe
  clear(); p.hasKatana = true; g.setWeapon('katana'); step(10);
  { let placed = false; for (const t of g.level.floorTiles) { const x = t.x * 16 + 8, y = t.y * 16 + 8; let ok = true; for (let d = 0; d <= 150; d += 8) if (!g.isFree(x + d, y, 6)) { ok = false; break; } if (ok) { p.x = x; p.y = y; placed = true; break; } } if (!placed) throw new Error('no lane'); }
  const v = spawn(80, 0); g.input.mouse.x = p.x - g.cam.x + 80; g.input.mouse.y = p.y - g.cam.y - 6; step(1);
  p.tkdCd = 0; g.startAttack('KRUN');
  let doomed = false, fr = 0; while (fr < 120 && !v.dead) { step(1); fr++; if (v.doom > 0) doomed = true; }
  console.log('  iaijutsu: doomed during dash =', doomed, '| dead after', fr, 'frames =', v.dead);
  if (!doomed || !v.dead) failed = true;
}
// 5b) axe + dual blades
console.log('--- axe & dual blades');
for (const [weapon, keys] of [['axe', ['AL', 'ALL', 'ALLL', 'AH', 'ALH']], ['dual', ['DL', 'DLL', 'DLLL', 'DLLLL', 'DH', 'DLH']]]) {
  clear(); if (weapon === 'axe') p.hasAxe = true; else p.hasDual = true; g.setWeapon(weapon); step(20);
  const e = spawn(24, 0);
  for (const key of keys) {
    e.hp = 999; e.bleed = 0; e.x = p.x + 24; e.y = p.y; e.kx = e.ky = 0; e.down = 0; e.stun = 0; e.stagger = 0; e.z = 0; e.vz = 0; e.state = 'chase'; e.doom = 0;
    p.attackPhase = 'none'; p.comboStr = ''; step(5);
    g.input.mouse.x = e.x - g.cam.x + 30; g.input.mouse.y = e.y - g.cam.y - 6; step(1); e.hp = 999;
    g.startAttack(key);
    let f = 0, hits = 0, lastHp = e.hp;
    while (p.attackPhase !== 'none' && f < 120) { step(1); f++; if (e.hp < lastHp) { hits++; lastHp = e.hp; } e.x = p.x + 24; e.y = p.y; e.kx = e.ky = 0; e.z = 0; e.vz = 0; }
    console.log(`  ${key.padEnd(6)} ${MOVES[key].name.padEnd(17)} -> hits=${hits} bleed=${e.bleed} (${f} frames)`);
    if (hits === 0) { console.log('   FAIL: no hit'); failed = true; }
  }
}
// 6) weapon fatalities
console.log('--- weapon fatalities');
for (const [weapon, kinds] of [['nunchaku', ['n_garrote', 'n_drum', 'n_decap']], ['katana', ['k_bisect', 'k_behead', 'k_impale']], ['axe', ['k_bisect', 'k_behead']], ['dual', ['k_behead', 'k_impale']]]) {
  for (let i = 0; i < kinds.length; i++) {
    clear(); p.hasNunchaku = p.hasKatana = p.hasAxe = p.hasDual = true; g.setWeapon(weapon); step(10); g.fatalityCd = 0; g.fatalityIdx = i;
    const e = spawn(20, 0); g.input.mouse.x = p.x - g.cam.x + 20; g.input.mouse.y = p.y - g.cam.y; step(1);
    g.input.pressed.add('f'); step(1);
    if (!p.fatality) { console.log('  FAIL: fatality did not start for', weapon); failed = true; continue; }
    const kind = p.fatality.kind; let fr = 0; while (p.fatality && fr < 400) { step(1); fr++; }
    console.log(`  ${weapon} #${i}: ${kind} (expected ${kinds[i]}) frames=${fr} dead=${e.dead}`);
    if (kind !== kinds[i] || !e.dead) failed = true;
    step(60);
  }
}
console.log(failed ? 'HIT TEST FAILED' : 'HIT TEST PASSED');
process.exit(failed ? 1 : 0);

// Headless smoke test: bundles the game and drives it with mocked DOM/canvas.
import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '.smoke-bundle.cjs');
await build({ stdin: { contents: "export * from './game/game'; export * from './game/input'; export * from './game/level';", resolveDir: path.join(__dirname, '../src'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent', target: 'es2020' });

// ---- mocks
const noop = () => {};
function makeCtx() {
  return new Proxy({ globalAlpha: 1, fillStyle: '', font: '', textAlign: '', textBaseline: '', imageSmoothingEnabled: false }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeCanvas() {
  const c = { width: 0, height: 0, style: {}, getContext: () => makeCtx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }), addEventListener: noop, removeEventListener: noop };
  return c;
}
const store = {};
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval, clearInterval, AudioContext: undefined, innerWidth: 1920, innerHeight: 1080 };
globalThis.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : {}), addEventListener: noop, removeEventListener: noop, hidden: false };
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
globalThis.performance = globalThis.performance || { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = noop;

const require = createRequire(import.meta.url);
const { Game } = require(out);

const canvas = makeCanvas();
const g = new Game(canvas);
let uiStates = [];
g.onUI = (u) => uiStates.push(u.state);

function step(n, inputFn) {
  for (let i = 0; i < n; i++) {
    if (inputFn) inputFn(i);
    g.frame(1 / 60);
    g.render();
    g.endFrameInput();
  }
}
const press = (k) => { g.input.keys.add(k); g.input.pressed.add(k); };
const release = (k) => g.input.keys.delete(k);
const click = () => { g.input.mouse.pressed = true; g.input.mouse.down = true; };
const rclick = () => { g.input.mouse.rpressed = true; g.input.mouse.rdown = true; };

let errors = 0;
const tryRun = (label, fn) => { try { fn(); } catch (e) { errors++; console.error('ERROR in', label, '\n', e.stack || e); } };

// 1. generate all 200 levels
tryRun('levelgen', () => {
  const { generateLevel } = require(out);
});
console.log('menu frames...');
tryRun('menu', () => step(30));
console.log('new game...');
tryRun('newGame', () => { g.newGame(null); step(10); });

let maxEnemies = 0;
for (let n = 1; n <= 200; n++) {
  tryRun(`level ${n}`, () => {
    if (g.state === 'mutation') g.chooseMutation(0);
    if (g.state === 'dead') g.respawn();
    if (g.state === 'gameover' || g.state === 'victory') { g.newGame({ level: n, mutations: [], score: 0 }); }
    if (g.levelN !== n || g.state !== 'playing') { g.state = 'playing'; g.startLevel(n); g.wipe = null; }
    // simulate ~4 seconds of chaotic play
    const p = g.player;
    step(240, (i) => {
      g.input.mouse.x = 240 + Math.sin(i * 0.1) * 100;
      g.input.mouse.y = 135 + Math.cos(i * 0.13) * 60;
      if (i % 7 === 0) click();
      if (i % 23 === 0) rclick();
      if (i % 40 === 0) press(' ');
      if (i % 50 === 0) press('shift');
      if (i % 60 === 0) press('e');
      if (i % 35 === 0) press('f');
      if (i % 90 === 0) press('q');
      if (i % 2 === 0) { press('d'); } else { release('d'); press('w'); }
      if (i % 3 === 0) release('w');
      if (i === 100) p.hp = Math.max(p.hp, 3);
      maxEnemies = Math.max(maxEnemies, g.enemies.length);
      if (g.state !== 'playing') return;
    });
    // let a running fatality finish, then force-kill everything to clear the level and go through the exit
    for (let k = 0; k < 400 && g.player.fatality; k++) step(1);
    if (g.state === 'playing') {
      g.spawnQueue.length = 0;
      for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, Math.random() * 6.28, 300, false, true);
      step(5);
      // walk into the exit
      p.x = g.level.exit.x; p.y = g.level.exit.y;
      step(90);
    }
  });
}
console.log('final state:', g.state, 'level', g.levelN, 'score', g.score, 'kills', g.kills, 'maxEnemies', maxEnemies, 'age', g.age);
console.log('ui states seen:', [...new Set(uiStates)].join(','));

// keyboard: simulate real DOM events incl. IME ("Process") and non-US layouts via e.code
tryRun('keyboard', () => {
  const handlers = {};
  const win = { addEventListener: (t, f) => (handlers[t] = f), removeEventListener: noop, setInterval, clearInterval, innerWidth: 1920, innerHeight: 1080 };
  const oldWin = globalThis.window; globalThis.window = win;
  const oldDoc = globalThis.document; globalThis.document = { ...oldDoc, addEventListener: noop, removeEventListener: noop, hidden: false, createElement: oldDoc.createElement };
  const { Input } = require(out);
  const inp = new Input(makeCanvas());
  const ev = (key, code, extra = {}) => ({ key, code, preventDefault: noop, ctrlKey: false, metaKey: false, altKey: false, ...extra });
  handlers.keydown(ev('w', 'KeyW')); if (!inp.key('w')) throw new Error('plain w not detected');
  handlers.keyup(ev('w', 'KeyW')); if (inp.key('w')) throw new Error('w not released');
  handlers.keydown(ev('Process', 'KeyA')); if (!inp.key('a')) throw new Error('IME Process keydown (KeyA) not detected');
  handlers.keyup(ev('Process', 'KeyA')); if (inp.key('a')) throw new Error('IME a not released');
  handlers.keydown(ev('z', 'KeyW')); if (!inp.key('w')) throw new Error('AZERTY physical W not detected');
  handlers.keyup(ev('z', 'KeyW'));
  handlers.keydown(ev('W', 'KeyW', { shiftKey: true })); if (!inp.key('w')) throw new Error('shift+W not detected');
  handlers.keyup(ev('W', 'KeyW'));
  handlers.keydown(ev(' ', 'Space')); if (!inp.key(' ')) throw new Error('space not detected');
  handlers.keyup(ev(' ', 'Space'));
  handlers.keydown(ev('Shift', 'ShiftLeft')); if (!inp.key('shift')) throw new Error('shift not detected');
  handlers.keyup(ev('Shift', 'ShiftLeft')); if (inp.key('shift')) throw new Error('shift not released');
  globalThis.window = oldWin; globalThis.document = oldDoc;
  console.log('keyboard mapping OK (key + code + IME)');
});

// running: speed with WASD held from standstill
tryRun('running', () => {
  g.state = 'playing'; g.startLevel(2); g.wipe = null;
  g.input.keys.clear(); g.input.mouse.down = false; g.input.mouse.rdown = false;
  const p = g.player;
  g.spawnQueue.length = 0; for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
  step(90); g.slowT = 0; g.timeScale = 1; p.attackPhase = 'none'; p.stunT = 0; p.vx = p.vy = 0;
  const x0 = p.x;
  for (let i = 0; i < 12; i++) { press('d'); step(1); }
  const v12 = Math.hypot(p.vx, p.vy);
  for (let i = 0; i < 30; i++) { press('d'); step(1); }
  const v42 = Math.hypot(p.vx, p.vy);
  console.log(`run: speed@0.2s=${v12.toFixed(0)} speed@0.7s=${v42.toFixed(0)} moved=${(p.x - x0).toFixed(0)}px running=${p.running} runT=${p.runT.toFixed(2)}`);
  if (v12 < 100 || v42 < 140) throw new Error('run speed too low');
  release('d'); step(5);
});

// fatality / launch / running attack flow
tryRun('fatalities (no stagger needed)', () => {
  g.state = 'playing'; g.startLevel(30); g.wipe = null;
  g.input.keys.clear(); g.input.mouse.down = false; g.input.mouse.rdown = false;
  const p = g.player; step(30);
  g.spawnQueue.length = 0;
  // close, not staggered
  for (const [i, dx] of [20, 20, 20, 20, 110].entries()) {
    for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
    step(5);
    const e = g.spawnEnemyAt('thug', p.x + dx, p.y, false); e.spawnT = 0;
    g.input.mouse.x = p.x - g.cam.x + dx; g.input.mouse.y = p.y - g.cam.y;
    g.fatalityIdx = i; g.fatalityCd = 0;
    step(1);
    const hadMarker = g.fatTargetId === e.id;
    press('f'); step(1);
    if (!p.fatality) throw new Error('fatality did not start on unstaggered enemy at dx=' + dx);
    const kind = p.fatality.kind, perfect = p.fatality.perfect;
    let frames = 0; while (p.fatality && frames < 400) { step(1); frames++; }
    console.log(`fatality(any) dx=${dx} kind=${kind} perfect=${perfect} marker=${hadMarker} frames=${frames} dead=${e.dead} pools=${g.pools.length}`);
    if (!e.dead) throw new Error('enemy survived fatality');
    step(70);
  }
  // boss: repeated non-perfect fatalities decay
  for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
  const b = g.spawnEnemyAt('boss', p.x + 24, p.y, false, 'bull'); b.spawnT = 0; b.attackCd = 99;
  const hp0 = b.hp; const drops = [];
  for (let i = 0; i < 3; i++) {
    const before = b.hp;
    g.input.mouse.x = b.x - g.cam.x; g.input.mouse.y = b.y - g.cam.y;
    if (Math.hypot(b.x - p.x, b.y - p.y) > 140) { p.x = b.x - 24; p.y = b.y; }
    g.fatalityCd = 0; press('f'); step(1); if (!p.fatality) { console.log('DEBUG state', g.state, 'stun', p.stunT.toFixed(2), 'hitstop', g.hitstop.toFixed(3), 'wipe', !!g.wipe, 'target', JSON.stringify(g.fatalityTarget() && {id: g.fatalityTarget().e.id, far: g.fatalityTarget().far}), 'boss', b.dead, b.spawnT.toFixed(2), 'd', Math.hypot(b.x-p.x,b.y-p.y).toFixed(0), 'exitOpen', g.exitOpen, 'dExit', Math.hypot(g.level.exit.x-p.x, g.level.exit.y-p.y).toFixed(0), 'levelN', g.levelN); throw new Error('boss fatality did not start'); }
    let f = 0; while (p.fatality && f < 400) { step(1); f++; }
    drops.push(((before - b.hp) / b.maxHp * 100).toFixed(1) + '%');
    step(80); b.attackCd = 99;
  }
  console.log('boss fatality damage sequence', drops.join(' > '), 'total', ((hp0 - b.hp) / b.maxHp * 100).toFixed(0) + '%');
});

tryRun('fatalities (staggered = perfect)', () => {
  g.state = 'playing'; g.startLevel(30); g.wipe = null;
  g.input.keys.clear(); g.input.mouse.down = false; g.input.mouse.rdown = false;
  const p = g.player; step(30);
  const kinds = ['uppercut', 'runpunch', 'flykick', 'rush', 'uppercut'];
  for (let k = 0; k < kinds.length; k++) {
    g.spawnQueue.length = 0;
    for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
    step(5);
    const e = g.spawnEnemyAt('thug', p.x + 20, p.y, false);
    e.spawnT = 0;
    g.staggerEnemy(e);
    g.input.mouse.x = p.x - g.cam.x + 20; g.input.mouse.y = p.y - g.cam.y;
    g.fatalityIdx = k; g.fatalityCd = 0;
    press('f');
    step(1);
    if (!p.fatality) throw new Error('fatality did not start (' + kinds[k] + ')');
    const kind = p.fatality.kind;
    let frames = 0;
    while (p.fatality && frames < 400) { step(1); frames++; }
    console.log(`fatality ${kind}: frames=${frames} enemyDead=${e.dead} zoom=${g.zoom.toFixed(2)} corpses=${g.corpses.length} particles=${g.particles.list.length}`);
    if (p.fatality) throw new Error('fatality never ended');
    step(60);
  }
  // boss fatality
  const b = g.spawnEnemyAt('boss', p.x + 24, p.y, false, 'bull'); b.spawnT = 0; g.staggerEnemy(b); g.fatalityCd = 0;
  press('f'); step(1); let f2 = 0; while (p.fatality && f2 < 400) { step(1); f2++; }
  console.log('boss fatality frames', f2, 'boss hp', b.hp.toFixed(0), '/', b.maxHp, 'z', b.z.toFixed(1));
  step(200);
  // uppercut launch + juggle
  for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
  const e2 = g.spawnEnemyAt('knife', p.x + 16, p.y, false); e2.spawnT = 0; e2.hp = e2.maxHp = 500;
  g.input.mouse.x = p.x - g.cam.x + 16; g.input.mouse.y = p.y - g.cam.y;
  g.startAttack('LLLH');
  let maxZ = 0; for (let i = 0; i < 120; i++) { step(1); maxZ = Math.max(maxZ, e2.z); }
  console.log('uppercut launch maxZ', maxZ.toFixed(1), 'enemy down', e2.down > 0 || e2.dead);
  // running straight + flying kick
  for (let i = 0; i < 40; i++) { press('d'); step(1); }
  console.log('running', p.running, 'runT', p.runT.toFixed(2));
  console.log('pre-click phase', p.attackPhase, 'combo', JSON.stringify(p.comboStr), 'buffered', p.buffered, 'stun', p.stunT.toFixed(2), 'hold', p.holdT.toFixed(2), 'hitstop', g.hitstop.toFixed(2), 'sinceDash', p.sinceDash.toFixed(2), 'fatality', !!p.fatality, 'enemies', g.enemies.length, 'hp', p.hp);
  press('d'); click(); step(1); console.log('run+LMB move:', p.moveKey, 'phase', p.attackPhase, 'running', p.running);
  step(60); release('d');
  for (let i = 0; i < 40; i++) { press('d'); step(1); }
  press('d'); rclick(); step(1); console.log('run+RMB move:', p.moveKey, 'z', p.z.toFixed(1));
  step(60); release('d');
  // guns
  press('2'); step(1); for (let i = 0; i < 30; i++) { click(); step(2); }
  console.log('pistol ammo', p.ammoP, 'bloom', p.bloom.toFixed(3), 'casings', g.particles.list.filter((q) => q.k === 8).length);
});

// new controls: jump (space), shadow step (shift), taekwondo kick, dive kick, 5 new fatalities, tactical AI
tryRun('jump + shadow step + tkd + new fatalities', () => {
  g.state = 'playing'; g.startLevel(45); g.wipe = null;
  g.input.keys.clear(); g.input.mouse.down = false; g.input.mouse.rdown = false;
  const p = g.player; step(30);
  g.spawnQueue.length = 0; for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
  step(10);
  // jump
  press(' '); step(1);
  let maxZ = 0, frames = 0; while (p.airborne && frames < 120) { step(1); maxZ = Math.max(maxZ, p.z); frames++; }
  console.log(`jump: maxZ=${maxZ.toFixed(1)} airtime=${(frames / 60).toFixed(2)}s landed=${!p.airborne}`);
  if (maxZ < 20 || p.airborne) throw new Error('jump broken');
  // bullet passes under a jumping player
  g.bullets.push({ x: p.x + 40, y: p.y - 5, px: p.x + 40, py: p.y - 5, vx: -300, vy: 0, r: 2, dmg: 1, owner: 'enemy', life: 2, color: '#f00', pierce: 0, bounce: 0, kind: 'enemy', hitIds: [], structure: 0, kb: 0 });
  const hp0 = p.hp; press(' '); step(4); step(12);
  console.log('bullet under jump: hp', hp0, '->', p.hp, p.hp === hp0 ? 'OK' : 'HIT');
  while (p.airborne) step(1);
  // shadow step
  for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true); step(40); g.slowT = 0; g.timeScale = 1; g.hitstop = 0; p.vx = p.vy = 0; p.dashCd = 0; p.stunT = 0; p.holdT = 0; p.attackPhase = 'none'; p.landT = 0; g.input.keys.clear(); g.input.mouse.x = p.x - g.cam.x + 100; g.input.mouse.y = p.y - g.cam.y;
  if (!g.isFree(p.x + 60, p.y, p.r)) { const pos = g.randomFloorNear(p.x, p.y, 0, 9999); if (pos) { p.x = pos.x; p.y = pos.y; } }
  const x0 = p.x; press('shift'); step(1); const cd0 = p.dashCd, dt0 = p.dashT; let sf = 0; while (p.dashT > 0 && sf < 60) { step(1); sf++; }
  const moved = Math.hypot(p.x - x0, p.y - (p.y)) || Math.abs(p.x - x0);
  console.log(`shadow step: moved=${moved.toFixed(0)}px over ${sf} frames, cd=${cd0.toFixed(2)}s dashT=${dt0.toFixed(2)} timeScale=${g.timeScale.toFixed(2)}`);
  if (dt0 <= 0) throw new Error('shadow step did not start (dashT=' + dt0 + ')');
  if (moved < 40 && sf >= 8) console.log('   (short distance: wall in the way; dash itself ran ' + sf + ' frames)');
  step(40);
  // taekwondo: sprint right then tap A
  // find a spot with 130px of open floor to the right (the kick travels ~120px)
  { let placed = false; for (const t of g.level.floorTiles) { const x = t.x * 16 + 8, y = t.y * 16 + 8; let ok = true; for (let d = 0; d <= 140; d += 8) if (!g.isFree(x + d, y, 6)) { ok = false; break; } if (ok) { p.x = x; p.y = y; placed = true; break; } } if (!placed) throw new Error('no open lane'); }
  p.vx = p.vy = 0; p.runT = 0; g.input.keys.clear(); step(5);
  const e1 = g.spawnEnemyAt('thug', p.x + 110, p.y, false); e1.spawnT = 0; e1.hp = e1.maxHp = 500; e1.attackCd = 99; e1.speed = 0;
  g.input.mouse.x = p.x - g.cam.x + 110; g.input.mouse.y = p.y - g.cam.y - 6;
  g.input.keys.clear(); p.tkdCd = 0; p.attackPhase = 'none'; p.moveKey = null; g.setWeapon('fist'); step(20);
  for (let i = 0; i < 30; i++) { g.input.keys.clear(); press('d'); step(1); }
  console.log('pre-tap runT', p.runT.toFixed(2), 'running', p.running, 'lastDir', JSON.stringify(p.lastDir), 'weapon', p.weapon, 'airborne', p.airborne, 'dashT', p.dashT.toFixed(2), 'tkdCd', p.tkdCd.toFixed(2), 'stun', p.stunT.toFixed(2), 'hold', p.holdT.toFixed(2), 'phase', p.attackPhase, 'hitstop', g.hitstop.toFixed(3), 'fatality', !!p.fatality);
  // tapping the opposite key must NOT trigger anything anymore
  g.input.keys.clear(); press('a'); step(1);
  if (p.moveKey === 'TKD' && p.attackPhase !== 'none') throw new Error('old opposite-key trigger still active');
  g.input.keys.clear(); for (let i = 0; i < 30; i++) { press('d'); step(1); }
  // RUN + LEFT CLICK = taekwondo kick
  press('d'); click(); step(1);
  console.log('run+LMB trigger: move=', p.moveKey, 'phase', p.attackPhase, 'aim', p.aim.toFixed(2), 'tkdCd', p.tkdCd.toFixed(2));
  if (p.moveKey !== 'TKD') throw new Error('taekwondo kick did not trigger on run+LMB');
  g.input.keys.clear();
  let zmax = 0, hitKb = 0, minD = 1e9; for (let i = 0; i < 50; i++) { step(1); zmax = Math.max(zmax, p.z); hitKb = Math.max(hitKb, Math.hypot(e1.kx, e1.ky)); minD = Math.min(minD, Math.hypot(e1.x - p.x, e1.y - p.y)); }
  console.log('   minDist during kick', minD.toFixed(1));
  console.log(`tkd: playerMaxZ=${zmax.toFixed(1)} enemyKnockback=${hitKb.toFixed(0)} enemyZ/down=${e1.z.toFixed(1)}/${e1.down.toFixed(2)} hp=${e1.hp}/500`);
  if (hitKb < 100) throw new Error('tkd did not connect');
  // while on cooldown, run+LMB falls back to the running straight
  g.input.keys.clear(); p.attackPhase = 'none'; step(5);
  for (let i = 0; i < 30; i++) { press('d'); step(1); }
  p.tkdCd = 0.6; // still cooling down
  press('d'); click(); step(1);
  console.log('run+LMB during cooldown: move=', p.moveKey, 'tkdCd', p.tkdCd.toFixed(2));
  if (p.moveKey !== 'RUNPUNCH') throw new Error('cooldown fallback wrong: ' + p.moveKey);
  g.input.keys.clear(); step(60);
  // dive kick: jump then LMB
  press(' '); step(8); click(); step(1);
  console.log('dive kick move:', p.moveKey, 'air', p.airborne);
  while (p.airborne) step(1);
  step(30);
  // 5 new fatalities
  for (const [i, kind] of [[1, 'neckbreak'], [3, 'spinkick'], [5, 'hammer'], [7, 'kneedrop'], [8, 'stomp']]) {
    for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
    step(5);
    const e = g.spawnEnemyAt('thug', p.x + 20, p.y, false); e.spawnT = 0; e.attackCd = 99;
    g.input.mouse.x = p.x - g.cam.x + 20; g.input.mouse.y = p.y - g.cam.y;
    g.fatalityIdx = i; g.fatalityCd = 0; press('f'); step(1);
    if (!p.fatality) throw new Error('fatality did not start: ' + kind);
    const got = p.fatality.kind;
    let fr = 0; while (p.fatality && fr < 400) { step(1); fr++; }
    console.log(`fatality ${got} (expected ${kind}): frames=${fr} dead=${e.dead}`);
    if (got !== kind || !e.dead) throw new Error('fatality mismatch/failed: ' + kind);
    step(70);
  }
  // tactical AI: 8 melee thugs, check tokens & no stacking
  for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
  step(5);
  const es = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const e = g.spawnEnemyAt('thug', p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60, false); e.spawnT = 0; e.hp = e.maxHp = 999; es.push(e); }
  const sm = [g.spawnEnemyAt('smg', p.x + 80, p.y + 10, false), g.spawnEnemyAt('shotgun', p.x - 80, p.y - 10, false)]; for (const e of sm) { e.spawnT = 0; e.hp = e.maxHp = 999; }
  let maxTokens = 0, minPair = 1e9, shots = 0, friendlyBlocked = 0;
  const bulletsBefore = () => g.bullets.filter((b) => b.owner === 'enemy').length;
  for (let f = 0; f < 420; f++) {
    g.input.keys.clear(); if (f % 120 < 60) press('d'); else press('a');
    const nb = bulletsBefore(); step(1); if (bulletsBefore() > nb) shots++;
    maxTokens = Math.max(maxTokens, es.filter((e) => e.token).length);
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) { if (es[i].dead || es[j].dead) continue; const dd = Math.hypot(es[i].x - es[j].x, es[i].y - es[j].y); if (dd < minPair) { minPair = dd; globalThis.__pair = [es[i].state, es[j].state, es[i].stagger.toFixed(1), es[j].stagger.toFixed(1), es[i].token, es[j].token, f]; } }
    for (const e of sm) if (e.repos) friendlyBlocked++;
  }
  const alive = es.filter((e) => !e.dead);
  const avgD = alive.reduce((a, e) => a + Math.hypot(e.x - p.x, e.y - p.y), 0) / alive.length;
  console.log('closest pair context', JSON.stringify(globalThis.__pair));
  const states = {}; for (const e of alive) states[e.state + (e.token ? '*' : '')] = (states[e.state + (e.token ? '*' : '')] || 0) + 1; console.log('states', JSON.stringify(states), 'dists', alive.map((e) => Math.hypot(e.x - p.x, e.y - p.y).toFixed(0)).join(','));
  console.log(`tactics: maxSimultaneousAttackers=${maxTokens} (cap ${g.maxTokens()}) minAllyGap=${minPair.toFixed(1)}px avgDist=${avgD.toFixed(0)} enemyShots=${shots} reposFrames=${friendlyBlocked} playerHp=${p.hp}`);
  if (maxTokens > g.maxTokens()) throw new Error('too many simultaneous attackers');
});

tryRun('fatality cooldown', () => {
  const p = g.player; while (p.fatality) step(1); g.input.keys.clear(); g.input.mouse.down = false; g.input.mouse.rdown = false;
  if (g.state !== 'playing') { g.state = 'playing'; g.startLevel(46); g.wipe = null; }
  g.spawnQueue.length = 0; for (const o of [...g.enemies]) if (!o.dead) g.killEnemy(o, 0, 100, true); step(60);
  g.slowT = 0; g.timeScale = 1; g.hitstop = 0; p.stunT = 0; p.holdT = 0; p.attackPhase = 'none'; p.airborne = false; p.z = 0; p.dashT = 0; g.setWeapon('fist'); g.fatalityCd = 0;
  { let placed = false; for (const t of g.level.floorTiles) { const x = t.x * 16 + 8, y = t.y * 16 + 8; if (g.isFree(x, y, 6) && g.isFree(x + 20, y, 6) && g.isFree(x + 40, y, 6)) { p.x = x; p.y = y; placed = true; break; } } if (!placed) throw new Error('no spot'); }
  p.vx = p.vy = p.kx = p.ky = 0; p.dashT = 0; p.sinceDash = 9; p.runT = 0; step(5);
  for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true); step(5);
  const e = g.spawnEnemyAt('thug', p.x + 20, p.y, false); e.spawnT = 0; e.attackCd = 99;
  g.input.mouse.x = p.x - g.cam.x + 20; g.input.mouse.y = p.y - g.cam.y;
  p.iframes = 0; p.stunT = 0; p.focusDash = null; g.hitstop = 0;
  press('f'); step(1); const started = !!p.fatality;
  if (!started) console.log('   DEBUG not started: state', g.state, 'cd', g.fatalityCd.toFixed(1), 'target', JSON.stringify(g.fatalityTarget() && { d: Math.hypot(g.fatalityTarget().e.x - p.x, g.fatalityTarget().e.y - p.y).toFixed(0), far: g.fatalityTarget().far }), 'stun', p.stunT.toFixed(2), 'hitstop', g.hitstop.toFixed(3), 'held', g.heldInput, 'phase', p.attackPhase, 'enemies', g.enemies.filter((x) => !x.dead).length, 'e.spawnT', e.spawnT.toFixed(2), 'e.dead', e.dead, 'levelTime', g.levelTime.toFixed(1), 'wipe', !!g.wipe);
  while (p.fatality) step(1);
  for (const o of [...g.enemies]) if (!o.dead) g.killEnemy(o, 0, 100, true); step(5);
  const e2 = g.spawnEnemyAt('thug', p.x + 20, p.y, false); e2.spawnT = 0; e2.attackCd = 99; step(2);
  const t2 = g.fatalityTarget();
  console.log('cooldown target staggered?', t2 && t2.e.stagger > 0, 'cd', g.fatalityCd.toFixed(1));
  press('f'); step(1); const blocked = !p.fatality;
  g.staggerEnemy(e2); press('f'); step(1); const perfectOk = !!p.fatality && p.fatality.perfect;
  console.log('fatality cooldown: first', started, '| second blocked by cd', blocked, '| perfect bypasses cd', perfectOk, '| cd', g.fatalityCd.toFixed(1));
  if (!started || !blocked || !perfectOk) throw new Error('cooldown logic wrong');
  while (p.fatality) step(1);
});

// survival mode: waves advance, enemies pour in, brutality rises, death ends the run, mutation choice continues it
tryRun('survival', () => {
  g.newSurvival();
  const p = g.player;
  if (g.mode !== 'survival' || g.wave !== 1) throw new Error('survival did not start');
  let frames = 0, spawned = 0, maxAlive = 0, choices = 0;
  const origSpawn = g.spawnEnemyAt.bind(g); g.spawnEnemyAt = (...a) => { spawned++; return origSpawn(...a); };
  while (frames < 60 * 150 && g.wave < 6) {
    frames++;
    if (g.state === 'mutation') { choices++; g.chooseMutation(0); }
    if (g.state === 'dead') { p.hp = g.maxHp(); g.state = 'playing'; }
    p.hp = g.maxHp();
    const alive = g.enemies.filter((e) => !e.dead);
    maxAlive = Math.max(maxAlive, alive.length);
    if (frames % 4 === 0) { g.input.mouse.pressed = true; }
    if (frames % 30 === 0) press('f');
    g.input.mouse.x = 300; g.input.mouse.y = 120;
    if (frames % 40 < 20) press('d'); else press('a');
    step(1);
  }
  console.log('survival: wave', g.wave, 'after', (frames / 60).toFixed(0) + 's', '| spawned', spawned, '| maxAlive', maxAlive, '| mutation picks', choices, '| tokens', g.maxTokens(), '| brutality', g.brutality().toFixed(2), '| time', g.survivalTime.toFixed(0));
  if (g.wave < 4 || spawned < 40 || choices < 1) throw new Error('survival progression broken');
  // death ends the run -> gameover with results, restart works
  if (g.state === 'mutation') g.chooseMutation(0);
  step(5); p.iframes = 0; p.dashT = 0; p.fatality = null; p.focusDash = null; p.z = 0; p.hp = 1; g.damagePlayer(5, 0); step(70); g.respawn(); step(5);
  console.log('survival death ->', g.state, '| best wave', g.bestSurvival.wave);
  if (g.state !== 'gameover') throw new Error('survival death should end the run');
  g.restartZone(); step(10); console.log('survive again ->', g.state, 'wave', g.wave, 'mode', g.mode);
  if (g.state !== 'playing' || g.wave !== 1) throw new Error('restart failed');
  g.toMenu(); step(5);
  // back to story for the remaining tests
  g.newGame(null); g.state = 'playing'; g.startLevel(42); g.wipe = null;
});

// death flow
tryRun('death flow', () => {
  if (g.state !== 'playing') { g.state = 'playing'; g.startLevel(42); g.wipe = null; }
  step(60);
  g.player.iframes = 0; g.player.fatality = null; g.player.z = 0;
  g.player.hp = 1;
  g.damagePlayer(5, 0);
  step(80);
  console.log('after death state:', g.state);
  g.respawn();
  step(20);
  console.log('after respawn state:', g.state, 'age', g.age);
  // age out
  g.age = 69; g.deathCounter = 3;
  g.player.iframes = 0; g.player.hp = 1; g.damagePlayer(5, 0); step(80); g.respawn(); step(5);
  console.log('after old age:', g.state);
  g.restartZone(); step(20);
  console.log('after restartZone:', g.state, 'level', g.levelN);
  g.toMenu(); step(5);
  console.log('menu:', g.state);
});

console.log(errors ? `\n${errors} ERROR(S)` : '\nSMOKE TEST PASSED');
process.exit(errors ? 1 : 0);

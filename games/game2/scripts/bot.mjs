// Difficulty probe: a naive bot plays levels and we measure survival / clear times.
import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '.bot-bundle.cjs');
await build({
  stdin: { contents: "export * from './game/game'; export * from './game/level';", resolveDir: path.join(__dirname, '../src'), loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent', target: 'es2020',
});
const noop = () => {};
function makeCtx() {
  return new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set(t, k, v) { t[k] = v; return true; } });
}
function makeCanvas() { return { width: 0, height: 0, style: {}, getContext: () => makeCtx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }), addEventListener: noop, removeEventListener: noop }; }
const store = {};
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval, clearInterval, innerWidth: 1920, innerHeight: 1080 };
globalThis.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : {}), addEventListener: noop, removeEventListener: noop, hidden: false };
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = noop;
const require = createRequire(import.meta.url);
const { Game, flowField, flowDir } = require(out);

const levels = (process.argv[2] || '1,3,7,13,27,41,63,85,107,143,177,199').split(',').map(Number);
const skill = parseFloat(process.argv[3] || '1'); // 1 = decent, 0 = sloppy (no parry)
for (const L of levels) {
  const g = new Game(makeCanvas());
  g.newGame(null);
  g.state = 'playing'; g.startLevel(L); g.wipe = null;
  // plausible build: ~1 mutation per 2 levels spread over 8 types with caps
  const n = Math.floor(L / 3) + Math.floor(L / 10);
  for (let i = 0; i < n; i++) {
    const k = i % 8;
    if (k === 0 || k === 5) g.stats.meleeDmg += 0.25;
    else if (k === 1) g.stats.hpBonus = Math.min(5, g.stats.hpBonus + 1);
    else if (k === 2) g.stats.moveSpeed = Math.min(1.48, g.stats.moveSpeed + 0.12);
    else if (k === 3) g.stats.structureDmg = Math.min(2.5, g.stats.structureDmg + 0.5);
    else if (k === 4) g.stats.bulletDmg = Math.min(4, g.stats.bulletDmg + 1);
    else if (k === 6) g.stats.focusGain = Math.min(2.5, g.stats.focusGain + 0.5);
    else g.stats.knockback = Math.min(2.2, g.stats.knockback + 0.4);
  }
  if (L >= 5) { g.player.hasRifle = true; g.player.ammoR = 60; }
  g.player.hp = g.maxHp();
  const p = g.player;
  const queued = g.spawnQueue.length + g.enemies.length;
  let frames = 0, deaths = 0, dmgTaken = 0, lastHp = p.hp, cleared = false, parries = 0, shots = 0;
  const press = (k) => { g.input.keys.add(k); g.input.pressed.add(k); };
  let flowCache = { x: -1, y: -1, f: null, t: -999 };
  const moveTo = (tx, ty) => {
    if (frames - flowCache.t > 15 || Math.hypot(flowCache.x - tx, flowCache.y - ty) > 24) flowCache = { x: tx, y: ty, f: flowField(g.level, tx, ty), t: frames };
    let dir = g.hasLOS({ x: tx, y: ty }) ? null : flowDir(g.level, flowCache.f, p.x, p.y);
    if (!dir) { const d = Math.hypot(tx - p.x, ty - p.y) || 1; dir = { x: (tx - p.x) / d, y: (ty - p.y) / d }; }
    if (dir.x > 0.3) press('d'); else if (dir.x < -0.3) press('a');
    if (dir.y > 0.3) press('s'); else if (dir.y < -0.3) press('w');
  };
  while (frames < 60 * 150) {
    frames++;
    const alive = g.enemies.filter((e) => !e.dead && e.spawnT <= 0);
    let target = null, bd = 1e9;
    for (const e of alive) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; target = e; } }
    g.input.keys.clear();
    if (target) {
      g.input.mouse.x = target.x - g.cam.x; g.input.mouse.y = target.y - 6 - g.cam.y;
      if (bd > 18) moveTo(target.x, target.y);
      if (bd < 30 && frames % 6 === 0) { if (p.weapon !== 'fist') press('1'); g.input.mouse.pressed = true; g.input.mouse.down = true; }
      if (bd < 30 && frames % 31 === 0) g.input.mouse.rpressed = true;
      if (bd > 60 && bd < 200 && g.hasLOS(target) && frames % 4 === 0) {
        if (p.weapon === 'fist') { if (p.hasRifle && p.ammoR > 0) press('3'); else if (p.ammoP > 0) press('2'); }
        if (p.weapon !== 'fist') { g.input.mouse.pressed = true; g.input.mouse.down = true; shots++; }
      }
      if (skill > 0 && target.state === 'windup' && bd < 40 && target.stateT < 0.2 && frames % 3 === 0 && Math.random() < skill) { press('shift'); parries++; }
      if ((target.kind === 'bomber' && bd < 30) || frames % 90 === 0) press(' ');
      if (frames % 40 === 0) press('f');
      if (frames % 120 === 0) press('e');
    } else if (g.exitOpen) {
      const ex = g.level.exit;
      moveTo(ex.x, ex.y);
    }
    g.frame(1 / 60);
    g.endFrameInput();
    if (p.hp < lastHp) dmgTaken += lastHp - p.hp;
    lastHp = p.hp;
    if (g.state === 'dead') { deaths++; g.deathT = 2; g.respawn(); lastHp = p.hp; if (g.state !== 'playing') break; }
    if (g.state === 'mutation' || g.levelN !== L || g.state === 'victory') { cleared = true; break; }
  }
  console.log(`L${String(L).padStart(3)} cleared=${cleared ? 'Y' : 'N'} time=${String((frames / 60).toFixed(0)).padStart(3)}s deaths=${deaths} dmg=${dmgTaken} parries=${parries} shots=${shots} kills=${g.kills}/${queued} age=${g.age} maxHp=${g.maxHp()} hpLeft=${p.hp}`);
  if (!cleared) {
    for (const e of g.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      console.log(`   left: ${e.kind} state=${e.state} d=${d.toFixed(0)} los=${g.hasLOS(e)} moving=${e.moving} hp=${e.hp.toFixed(1)} embedded=${!g.isFree(e.x, e.y, e.r)}`);
    }
    console.log('   queue', g.spawnQueue.length, 'exitOpen', g.exitOpen, 'state', g.state, 'style', g.level.style, 'playerEmbedded', !g.isFree(p.x, p.y, p.r));
  }
}

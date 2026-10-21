// Render real frames of the game to PNG using node-canvas
import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createCanvas } = require('canvas');
const out = path.join(__dirname, '.shot-bundle.cjs');
await build({ entryPoints: [path.join(__dirname, '../src/game/game.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent', target: 'es2020' });

const noop = () => {};
const store = {};
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval, clearInterval, innerWidth: 1920, innerHeight: 1080 };
globalThis.document = { addEventListener: noop, removeEventListener: noop, hidden: false, createElement: (t) => { if (t !== 'canvas') return {}; const c = createCanvas(1, 1); c.style = {}; c.addEventListener = noop; c.removeEventListener = noop; c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 480, height: 270 }); return c; } };
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = noop;

const { Game } = require(out);
const canvas = document.createElement('canvas');
canvas.width = 480; canvas.height = 270;
const g = new Game(canvas);

const args = process.argv.slice(2);
const level = parseInt(args[0] || '1', 10);
const name = args[1] || 'shot';
const seconds = parseFloat(args[2] || '2.5');
const styleArg = args[4] || 'isaac';

function step(n, fn) {
  for (let i = 0; i < n; i++) { if (fn) fn(i); g.frame(1 / 60); g.render(); g.endFrameInput(); }
}
const press = (k) => { g.input.keys.add(k); g.input.pressed.add(k); };

if (process.argv[7] === 'survival') { g.newSurvival(); g.charStyle = styleArg; g.wipe = null; for (let i = 0; i < 60 * 75; i++) { if (g.state === 'mutation') g.chooseMutation(0); if (g.wave >= 7 && g.waveT > 8) break; if (g.state !== 'playing') break; if (i % 60 === 0) { g.player.hp = g.maxHp(); } g.input.mouse.x = 300; g.input.mouse.y = 120; if (i % 10 === 0) { g.input.mouse.pressed = true; } if (i % 20 < 10) press('d'); else { g.input.keys.delete('d'); press('a'); } if (i % 23 === 0) press('f'); g.frame(1 / 60); g.render(); g.endFrameInput(); if (g.wave === 2 && g.waveT > 3 && g.waveT < 3.05) { /* keep going */ } } g.player.hp = g.maxHp(); console.log('survival shot: wave', g.wave, 'alive', g.enemies.filter((e) => !e.dead).length, 'state', g.state); } else {
g.newGame(null);
g.charStyle = styleArg;
g.state = 'playing';
g.startLevel(level);
g.wipe = null;
g.bannerT = 0;
}
const frames = process.argv[7] === 'survival' ? 0 : Math.floor(seconds * 60);
const mode = args[3] || 'normal';
step(frames, (i) => {
  g.input.mouse.x = 300; g.input.mouse.y = 120;
  if (i % 9 === 0) { g.input.mouse.pressed = true; }
  if (i > 30 && i % 50 === 0) { g.input.mouse.rpressed = true; }
  if (i % 20 < 10) press('d'); else g.input.keys.delete('d');
});
if (['gun', 'fatality', 'flykick', 'uppercut', 'blood', 'run', 'runleft', 'runright', 'tkd', 'jump', 'shooters', 'crowd', 'nunchaku', 'helicopter', 'whip', 'spinback', 'axe', 'knee', 'katana', 'crescent', 'iai', 'clear', 'dual', 'tri', 'gore', 'chain', 'rage'].includes(mode)) {
  const p = g.player;
  g.spawnQueue.length = 0;
  for (const e of [...g.enemies]) if (!e.dead) g.killEnemy(e, 0, 100, true);
  g.input.keys.clear();
  for (let i = 0; i < 100; i++) { g.frame(1 / 60); g.render(); g.endFrameInput(); }
  g.slowT = 0; g.timeScale = 1;
  const spawnAt = (kind, dx, dy, hp) => { const e = g.spawnEnemyAt(kind, p.x + dx, p.y + dy, false); e.spawnT = 0; if (hp) { e.hp = e.maxHp = hp; } return e; };
  const run = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); g.frame(1 / 60); g.render(); g.endFrameInput(); } };
  g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 10;
  if (mode === 'gun') {
    spawnAt('thug', 70, -8, 60); spawnAt('gunner', 95, 10, 60); spawnAt('knife', 50, 20, 60);
    press('2'); run(1);
    run(40, (i) => { if (i % 12 === 0) { g.input.mouse.pressed = true; } g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6; });
    g.input.mouse.pressed = true; run(1);
    run(1);
  } else if (mode === 'fatality' || mode === 'uppercut') {
    const e = spawnAt('thug', 18, 0, 10);
    g.staggerEnemy(e);
    g.fatalityIdx = mode === 'uppercut' ? 0 : 1; // 0 uppercut, 1 flykick, 2 rush, 3 runpunch
    press('f'); run(1);
    const want = mode === 'uppercut' ? 0.5 : 0.55;
    while (p.fatality && !(p.fatality.hit && p.fatality.t - p.fatality.hitT > want)) run(1);
    console.log('fatality kind', p.fatality ? p.fatality.kind : 'ended');
  } else if (mode === 'blood') {
    // a brawl: several kills with melee + a gib, then wait for pools to settle
    const es = [spawnAt('thug', 22, 0, 6), spawnAt('knife', 30, 12, 4), spawnAt('thug', -24, 6, 6), spawnAt('gunner', 40, -14, 5)];
    for (const e of es) { e.attackCd = 99; }
    g.input.mouse.x = p.x - g.cam.x + 24; g.input.mouse.y = p.y - g.cam.y;
    run(120, (i) => { if (i % 6 === 0) g.input.mouse.pressed = true; if (i % 30 === 15) g.input.mouse.rpressed = true; const t = es.find((e) => !e.dead); if (t) { g.input.mouse.x = t.x - g.cam.x; g.input.mouse.y = t.y - g.cam.y - 6; } });
    const left = es.filter((e) => !e.dead);
    for (const e of left) g.killEnemy(e, Math.random() * 6.3, 400, false, true);
    run(70);
    console.log('blood: kills', g.kills, 'pools left', g.pools.length, 'particles', g.particles.list.length);
  } else if (mode === 'tkd') {
    const e = spawnAt('thug', 62, 0, 300); e.attackCd = 99;
    g.input.mouse.x = p.x - g.cam.x + 62; g.input.mouse.y = p.y - g.cam.y;
    for (let i = 0; i < 36; i++) { g.input.keys.clear(); press('d'); run(1); }
    press('d'); g.input.mouse.pressed = true; run(1); g.input.keys.clear();
    run(12);
    console.log('tkd frame: move', p.moveKey, 'phase', p.attackPhase, 'z', p.z.toFixed(1), 'enemy kb', Math.hypot(e.kx, e.ky).toFixed(0));
  } else if (mode === 'jump') {
    spawnAt('gunner', 70, 0, 50); spawnAt('smg', 90, 30, 50);
    for (let i = 0; i < 40; i++) { g.input.keys.clear(); press('d'); run(1); }
    press(' '); run(1); run(14);
    console.log('jump frame: z', p.z.toFixed(1), 'airborne', p.airborne);
  } else if (mode === 'shooters') {
    const a = spawnAt('gunner', 90, -20, 50), b = spawnAt('smg', 95, 25, 50), c = spawnAt('shotgun', 60, 40, 50), d = spawnAt('rifleman', 120, 0, 50);
    for (const e of [a, b, c, d]) e.attackCd = 0;
    g.input.mouse.x = p.x - g.cam.x + 90; g.input.mouse.y = p.y - g.cam.y;
    let f = 0; while (f < 120 && ![a, b, c, d].some((e) => e.state === 'windup' && e.stateT < e.poseDur * 0.4)) { run(1); f++; }
    console.log('shooters frame', f, [a, b, c, d].map((e) => e.state).join(','));
  } else if (mode === 'crowd') {
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const e = spawnAt('thug', Math.cos(a) * 60, Math.sin(a) * 60, 300); void e; }
    spawnAt('smg', 100, 20, 50); spawnAt('gunner', -95, -25, 50);
    run(150);
    console.log('crowd frame: tokens', g.enemies.filter((e) => e.token).length);
  } else if (mode === 'chain' || mode === 'rage') {
    g.setWeapon('fist');
    const e = spawnAt('brute', 16, 0, 400); e.attackCd = 99; e.speed = 0; e.kbRes = 1;
    g.input.mouse.x = p.x - g.cam.x + 40; g.input.mouse.y = p.y - g.cam.y - 6; run(1);
    if (mode === 'chain') { for (let i = 0; i < 90; i++) { if (i % 12 === 0) { g.input.mouse.pressed = true; g.input.mouse.down = true; } run(1); e.x = p.x + 16; e.y = p.y; e.kx = e.ky = 0; e.structure = 0; if (i >= 60 && p.moveKey === 'CHAIN' && g.attackPoseT() >= 0.3 && g.attackPoseT() < 0.4) break; } console.log('chain frame: chain', p.chain, 'side', p.chainSide, 't', g.attackPoseT().toFixed(2)); }
    else { p.rage = 100; press('r'); run(3); const v = spawnAt('thug', 70, -20, 10); v.attackCd = 99; v.speed = 0; run(2); g.input.mouse.pressed = true; run(1); let f = 0; while (f < 30 && p.rageDash) { run(1); f++; } run(2); console.log('rage frame: dash', !!p.rageDash, 'move', p.moveKey, 't', g.attackPoseT().toFixed(2), 'victim dead', v.dead); }
  } else if (mode === 'axe' || mode === 'dual' || mode === 'tri' || mode === 'gore') {
    const e = spawnAt('thug', 24, 0, mode === 'gore' ? 4 : 300); e.attackCd = 99; e.speed = 0;
    const e2 = spawnAt('knife', 34, 14, mode === 'gore' ? 3 : 300); e2.attackCd = 99; e2.speed = 0;
    const e3 = mode === 'gore' ? spawnAt('gunner', -30, 10, 3) : null; if (e3) { e3.attackCd = 99; e3.speed = 0; }
    g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6;
    if (mode === 'axe') { p.hasAxe = true; g.setWeapon('axe'); run(30); const want = parseFloat(process.argv[8] || '0.4'); g.startAttack(process.argv[9] || 'ALLL'); let f = 0; while (f < 80 && g.attackPoseT() < want) { run(1); f++; } console.log('axe frame', f, 't', g.attackPoseT().toFixed(2), 'hp', e.hp); }
    else if (mode === 'dual') { p.hasDual = true; g.setWeapon('dual'); run(30); g.startAttack('DLLLL'); let f = 0; while (f < 80 && g.attackPoseT() < 0.42) { run(1); f++; } console.log('dual frame', f, 't', g.attackPoseT().toFixed(2), 'hp', e.hp); }
    else if (mode === 'tri') { p.hasNunchaku = true; g.setWeapon('nunchaku'); run(40); const step3 = process.argv[8] || 'NL'; g.startAttack(step3); let f = 0; while (f < 80 && g.attackPoseT() < 0.4) { run(1); f++; } console.log('tri', step3, 'frame', f, 't', g.attackPoseT().toFixed(2), 'hp', e.hp); }
    else { g.blood.mode = 'gore'; p.hasKatana = true; g.setWeapon('katana'); run(20); for (let k = 0; k < 6; k++) { g.startAttack(k % 2 ? 'KLL' : 'KL'); run(14); } for (const o of [e, e2, e3]) if (o && !o.dead) g.killEnemy(o, Math.random() * 6.3, 300, false, true); run(50); p.iframes = 0; g.damagePlayer(1, 0); run(25); console.log('gore: drops', g.blood.drops.length, 'splats', g.blood.splats.length, 'corpses', g.corpses.length); }
  } else if (mode === 'katana' || mode === 'crescent' || mode === 'iai' || mode === 'clear') {
    const e = spawnAt('thug', 26, 0, mode === 'clear' ? 3 : 300); e.attackCd = 99; e.speed = 0;
    const e2 = spawnAt('knife', 34, 14, 300); e2.attackCd = 99; e2.speed = 0;
    g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6;
    p.hasKatana = true; g.setWeapon('katana'); run(30);
    if (mode === 'clear') { for (const o of [...g.enemies]) if (!o.dead) g.killEnemy(o, 0, 100, true); g.spawnQueue.length = 0; run(20); console.log('clear banner frame, announce', g.announce.length); }
    else {
      const key = mode === 'crescent' ? 'KLLL' : mode === 'iai' ? 'KRUN' : 'KL';
      p.tkdCd = 0; g.startAttack(key);
      let f = 0; const want = mode === 'iai' ? 0.45 : 0.42; while (f < 60 && g.attackPoseT() < want) { run(1); f++; }
      console.log(mode, 'frame', f, 't', g.attackPoseT().toFixed(2), 'arcs', g.katana.arcs.length, 'enemy hp', e.hp, e2.hp, 'doom', e.doom.toFixed(2));
    }
  } else if (mode === 'nunchaku' || mode === 'helicopter' || mode === 'whip' || mode === 'spinback' || mode === 'axe' || mode === 'knee') {
    const e = spawnAt('thug', 24, 0, 300); e.attackCd = 99; e.speed = 0;
    const e2 = spawnAt('knife', 30, 14, 300); e2.attackCd = 99; e2.speed = 0;
    g.input.mouse.x = p.x - g.cam.x + 60; g.input.mouse.y = p.y - g.cam.y - 6;
    if (mode === 'spinback' || mode === 'axekick' || mode === 'knee') {
      run(1); g.startAttack(mode === 'spinback' ? 'HH' : mode === 'axekick' ? 'HLL' : 'HL');
      let f = 0; while (f < 60 && !(g.attackPoseT() > 0.36 && g.attackPoseT() < 0.46)) { run(1); f++; }
      console.log(mode, 'frame', f, 't', g.attackPoseT().toFixed(2), 'enemy hp', e.hp);
    } else {
      p.hasNunchaku = true; g.setWeapon('nunchaku'); run(40);
      const key = mode === 'helicopter' ? 'NH' : mode === 'whip' ? 'NLH' : 'NL';
      g.startAttack(key);
      let f = 0; const want = mode === 'helicopter' ? 0.5 : 0.4; while (f < 60 && g.attackPoseT() < want) { run(1); f++; }
      console.log(mode, 'frame', f, 't', g.attackPoseT().toFixed(2), 'tipSpeed', g.nunchaku.tipSpeed.toFixed(0), 'enemy hp', e.hp, e2.hp);
    }
  } else if (mode === 'runleft') {
    g.input.mouse.x = p.x - g.cam.x + 80; g.input.mouse.y = p.y - g.cam.y;
    for (let i = 0; i < 40; i++) { g.input.keys.clear(); press('a'); run(1); }
    press('a'); run(1);
    console.log('runleft: vx', p.vx.toFixed(0), 'walk', p.walk.toFixed(2), 'stride', p.strideHalf.toFixed(1), 'facing', p.facing);
  } else if (mode === 'runright') {
    g.input.mouse.x = p.x - g.cam.x - 80; g.input.mouse.y = p.y - g.cam.y;
    for (let i = 0; i < 40; i++) { g.input.keys.clear(); press('d'); run(1); }
    press('d'); run(1);
    console.log('runright: vx', p.vx.toFixed(0), 'walk', p.walk.toFixed(2), 'stride', p.strideHalf.toFixed(1), 'facing', p.facing);
  } else if (mode === 'run') {
    for (let i = 0; i < 28; i++) { press('d'); press('s'); run(1); }
    press('d'); press('s'); run(1);
    console.log('run pose: speed', Math.hypot(p.vx, p.vy).toFixed(0), 'runT', p.runT.toFixed(2), 'running', p.running);
  } else if (mode === 'flykick') {
    spawnAt('thug', 48, 0, 60); spawnAt('thug', 60, 14, 60);
    for (let i = 0; i < 30; i++) { press('d'); run(1); }
    press('d'); g.input.mouse.rpressed = true; run(1);
    run(9);
    console.log('move', p.moveKey, 'phase', p.attackPhase, 'z', p.z.toFixed(1));
  }
}
if (mode === 'action') {
  // teleport enemies around the player and brawl until a big hit lands
  const p = g.player;
  g.spawnQueue.length = 0;
  const kinds = ['thug', 'knife', 'gunner', 'brute', 'monk'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const e = g.spawnEnemyAt(kinds[i], p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 18, i === 1);
    e.spawnT = 0;
  }
  g.input.mouse.x = p.x - g.cam.x + 40; g.input.mouse.y = p.y - g.cam.y;
  let f = 0;
  while (f < 400) {
    f++;
    if (f % 6 === 0) g.input.mouse.pressed = true;
    if (f % 25 === 0) g.input.mouse.rpressed = true;
    if (f % 70 === 0) press('f');
    g.input.mouse.x = p.x - g.cam.x + 40; g.input.mouse.y = p.y - g.cam.y - 5;
    g.frame(1 / 60); g.render(); g.endFrameInput();
    if (f > 60 && g.hitstop > 0.03 && g.texts.list.length > 0) break;
  }
  console.log('action frame', f, 'combo', g.combo, 'particles', g.particles.list.length);
}
// save upscaled
const scale = 3;
const big = createCanvas(480 * scale, 270 * scale);
const bctx = big.getContext('2d');
bctx.imageSmoothingEnabled = false;
bctx.drawImage(canvas, 0, 0, 480 * scale, 270 * scale);
if (['nunchaku', 'helicopter', 'whip', 'spinback', 'axe', 'knee', 'katana', 'crescent', 'iai', 'dual', 'tri', 'chain', 'rage'].includes(mode)) {
  const crop = createCanvas(100 * 6, 70 * 6); const cctx = crop.getContext('2d'); cctx.imageSmoothingEnabled = false;
  const pp = g.player; cctx.drawImage(canvas, Math.round(pp.x - g.cam.x - 40), Math.round(pp.y - g.cam.y - 45), 100, 70, 0, 0, 600, 420);
  fs.writeFileSync(path.join(__dirname, 'shots', name + '_zoom.png'), crop.toBuffer('image/png'));
}
if (mode === 'runleft' || mode === 'runright') {
  // 8x crop around the player, 4 frames in a strip to show the cycle
  const strip = createCanvas(4 * 60 * 8, 60 * 8); const sctx = strip.getContext('2d'); sctx.imageSmoothingEnabled = false;
  const key = mode === 'runleft' ? 'a' : 'd';
  for (let k = 0; k < 4; k++) {
    const pp = g.player; const px0 = Math.round(pp.x - g.cam.x - 30), py0 = Math.round(pp.y - g.cam.y - 40);
    sctx.drawImage(canvas, px0, py0, 60, 60, k * 480, 0, 480, 480);
    for (let f = 0; f < 3; f++) { g.input.keys.clear(); press(key); g.frame(1 / 60); g.render(); g.endFrameInput(); }
  }
  fs.writeFileSync(path.join(__dirname, 'shots', name + '_strip.png'), strip.toBuffer('image/png'));
}
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'shots', `${name}.png`), big.toBuffer('image/png'));
console.log('saved', name, 'state', g.state, 'enemies', g.enemies.length, 'hp', g.player.hp, 'combo', g.combo);

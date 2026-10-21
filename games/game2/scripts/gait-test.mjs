// Gait regression test: for runs in 4 directions (with the cursor BEHIND the player in two of them) verify that
//  - the planted (stance) foot moves BACKWARD relative to the body and the swinging foot moves FORWARD
//  - the swinging foot is lifted, the stance foot is on the ground
//  - the body faces / leans toward the travel direction (not the cursor)
import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const out = path.join(__dirname, '.gait.cjs');
await build({ stdin: { contents: "export * from './game/game'; export * from './game/stick';", resolveDir: path.join(__dirname, '../src'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' });
const noop = () => {};
function makeCtx() { return new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createRadialGradient') return () => ({ addColorStop: noop }); return noop; }, set(t, k, v) { t[k] = v; return true; } }); }
function makeCanvas() { return { width: 0, height: 0, style: {}, getContext: () => makeCtx(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 270 }), addEventListener: noop, removeEventListener: noop, focus: noop, tabIndex: 0 }; }
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval, clearInterval };
globalThis.document = { createElement: () => makeCanvas(), addEventListener: noop, removeEventListener: noop, hidden: false, hasFocus: () => true };
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = noop;
const { Game, solvePose } = require(out);
const g = new Game(makeCanvas());
g.newGame(null); g.state = 'playing'; g.startLevel(2); g.wipe = null;
g.spawnQueue.length = 0; for (const e of [...g.enemies]) g.killEnemy(e, 0, 100, true);
const p = g.player;
for (let i = 0; i < 100; i++) { g.frame(1 / 60); g.endFrameInput(); }
g.slowT = 0; g.timeScale = 1;
let failed = false;
for (const [name, key, dir, mouseDx] of [['run RIGHT, cursor LEFT', 'd', { x: 1, y: 0 }, -120], ['run LEFT, cursor RIGHT', 'a', { x: -1, y: 0 }, 120], ['run UP', 'w', { x: 0, y: -1 }, 120], ['run DOWN', 's', { x: 0, y: 1 }, -120]]) {
  p.x = 220; p.y = 160; p.vx = p.vy = 0; p.walk = 0; p.runT = 0; p.attackPhase = 'none';
  let prevF = null, prevB = null, badDir = 0, badLift = 0, badFace = 0, n = 0;
  for (let i = 0; i < 70; i++) {
    g.input.keys.clear(); g.input.keys.add(key);
    g.input.mouse.x = p.x - g.cam.x + mouseDx; g.input.mouse.y = p.y - g.cam.y;
    g.frame(1 / 60); g.endFrameInput();
    if (i < 25) continue;
    const sk = solvePose({ x: 0, y: 0, c: '#fff', c2: '#f00', scale: 1, facing: p.facing, aim: p.bodyAim, look: p.aim, walk: p.walk, moving: p.moving, pose: 'run', t: 0, acc: 'none', weapon: 'none', flash: false, alpha: 1, outline: null, eyes: '#000', time: g.time, lean: p.lean, run: 1, vel: g.moveDirOf(p.vx, p.vy), stride: p.strideHalf });
    const along = (v) => v.x * dir.x + v.y * dir.y; // body-relative coordinate along travel
    // for vertical runs the screen-y of a foot = travel offset + lift (lift is always drawn upward); remove the lift
    // using the solver's own bell curve so we measure the pure along-travel motion
    const liftOf = (ph) => { const qq = (((ph + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return Math.cos(qq) > 0 ? Math.sin(((qq + Math.PI / 2) / Math.PI) * Math.PI) * 4.0 : 0; };
    const F = dir.y === 0 ? along(sk.ffoot) : along({ x: sk.ffoot.x, y: sk.ffoot.y + liftOf(p.walk) }), B = dir.y === 0 ? along(sk.bfoot) : along({ x: sk.bfoot.x, y: sk.bfoot.y + liftOf(p.walk + Math.PI) });
    const w = p.walk;
    const q = (x) => (((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const swingF = Math.cos(q(w)) > 0, swingB = Math.cos(q(w + Math.PI)) > 0;
    if (prevF !== null) {
      n++;
      const dF = F - prevF, dB = B - prevB;
      if (!swingF && dF > 0.08) badDir++; if (swingF && dF < -0.08) badDir++;
      if (!swingB && dB > 0.08) badDir++; if (swingB && dB < -0.08) badDir++;
      // lift check only meaningful for horizontal runs (y = pure height)
      if (dir.y === 0) { const liftF = -sk.ffoot.y, liftB = -sk.bfoot.y; const mid = (x) => Math.abs(Math.cos(q(x))) > 0.3; if (swingF && !swingB && mid(w) && liftF < liftB - 0.2) badLift++; if (swingB && !swingF && mid(w + Math.PI) && liftB < liftF - 0.2) badLift++; }
      // facing must follow travel, not the cursor (horizontal only)
      if (dir.x !== 0 && p.facing !== dir.x) badFace++;
      // body lean (neck ahead of hip) must point along travel
      // horizontal lean must follow travel; vertical runs: torso must not lean against the travel direction in x
      if (dir.x !== 0) { const leanAlong = (sk.neck.x - sk.hip.x) * dir.x; if (leanAlong < 0) badFace++; }
    }
    prevF = F; prevB = B;
  }
  const ok = badDir <= n * 2 * 0.07 && badLift === 0 && badFace === 0;
  if (!ok) failed = true;
  console.log(`${name.padEnd(24)} footDir bad=${badDir}/${n * 2}  lift bad=${badLift}  facing/lean bad=${badFace}  speed=${Math.hypot(p.vx, p.vy).toFixed(0)}  -> ${ok ? 'OK' : 'FAIL'}`);
}
console.log(failed ? 'GAIT TEST FAILED' : 'GAIT TEST PASSED');
process.exit(failed ? 1 : 0);

// Render a contact sheet: for each melee move, 6 frames of the pose (t = 0, .15, .3, .36, .5, .8) at 6x zoom, both styles
import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createCanvas } = require('canvas');
const out = path.join(__dirname, '.pose.cjs');
await build({ stdin: { contents: "export * from './game/stick'; export * from './game/moves';", resolveDir: path.join(__dirname, '../src'), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent' });
const { drawStick, MOVES } = require(out);
const keys = (process.argv[2] || 'L,LL,LLL,LLLL,LLLLL,H,LH,LLH,LLLH,LLLLH,HL,HLL,HLH,HH,HHL,LHL,LHH').split(',');
const style = process.argv[3] || 'stick';
const ts = [0, 0.15, 0.3, 0.36, 0.5, 0.8];
const cell = 48, zoom = 5;
const cv = createCanvas(ts.length * cell * zoom + 120 * zoom / 5, keys.length * cell * zoom);
const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
const small = createCanvas(ts.length * cell + 60, keys.length * cell);
const sctx = small.getContext('2d');
sctx.fillStyle = '#1b1b20'; sctx.fillRect(0, 0, small.width, small.height);
keys.forEach((key, row) => {
  const m = MOVES[key];
  ts.forEach((t, col) => {
    const x = col * cell + 24, y = row * cell + 38;
    sctx.fillStyle = 'rgba(255,255,255,0.05)'; sctx.fillRect(col * cell, row * cell, cell - 1, cell - 1);
    sctx.fillStyle = '#333'; sctx.fillRect(col * cell, y + 1, cell, 1);
    drawStick(sctx, { x, y, c: '#ffffff', c2: '#ff3b3b', scale: 1, facing: 1, aim: 0, walk: 0, moving: false, pose: m.pose, t, acc: 'headband', weapon: 'none', flash: false, alpha: 1, outline: '#000', eyes: '#111', time: 0, lean: { x: 1, y: 0 }, style, skin: '#ffe9d6', trail: t >= 0.3 && t <= 0.6 ? '#ffd166' : null, strike: ['fhand','bhand','ffoot','bfoot','both'].includes(m.limb) ? m.limb : m.limb === 'sweep' ? 'ffoot' : null, impact: t >= 0.3 && t <= 0.62 ? 1 : 0 });
  });
  sctx.fillStyle = '#ffd166'; sctx.font = '7px monospace'; sctx.fillText(m.name, ts.length * cell + 2, row * cell + 20);
});
ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, small.width * zoom, small.height * zoom);
fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
const name = process.argv[4] || 'posesheet';
fs.writeFileSync(path.join(__dirname, 'shots', name + '.png'), cv.toBuffer('image/png'));
console.log('saved', name, keys.length, 'moves');

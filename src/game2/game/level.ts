import { TILE, zoneOf } from './constants';
import { Rng } from './rng';
import type { Vec } from './types';

export interface Level {
  n: number;
  zone: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  spawn: Vec;
  exit: Vec;
  floorTiles: Vec[];
  isBoss: boolean;
  style: string;
  seed: number;
}

export function tileAt(l: Level, tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= l.w || ty >= l.h) return 1;
  return l.tiles[ty * l.w + tx];
}

export function solidAt(l: Level, x: number, y: number) {
  return tileAt(l, Math.floor(x / TILE), Math.floor(y / TILE)) === 1;
}

function rectSolid(l: Level, x: number, y: number, r: number) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileAt(l, tx, ty) === 1) return true;
  return false;
}

export function freeAt(l: Level, x: number, y: number, r: number) {
  return !rectSolid(l, x, y, r);
}

/** If an entity got embedded in a wall (e.g. pushed by another body), move it to the nearest free spot. */
export function unstick(l: Level, e: { x: number; y: number; r: number }) {
  const r = e.r * 0.8;
  if (!rectSolid(l, e.x, e.y, r)) return false;
  for (let rad = 2; rad <= 48; rad += 2) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const nx = e.x + Math.cos(a) * rad, ny = e.y + Math.sin(a) * rad;
      if (!rectSolid(l, nx, ny, r)) { e.x = nx; e.y = ny; return true; }
    }
  }
  return true;
}

/** Move an entity by dx,dy with wall sliding. Returns which axes were blocked. */
export function moveWithCollision(l: Level, e: { x: number; y: number; r: number }, dx: number, dy: number) {
  let bx = false, by = false;
  const r = e.r * 0.8;
  if (dx !== 0) {
    const nx = e.x + dx;
    if (!rectSolid(l, nx, e.y, r)) e.x = nx;
    else {
      // snap to wall edge
      const step = Math.sign(dx);
      let tries = 0;
      while (tries < 16 && !rectSolid(l, e.x + step, e.y, r)) { e.x += step; tries++; }
      bx = true;
    }
  }
  if (dy !== 0) {
    const ny = e.y + dy;
    if (!rectSolid(l, e.x, ny, r)) e.y = ny;
    else {
      const step = Math.sign(dy);
      let tries = 0;
      while (tries < 16 && !rectSolid(l, e.x, e.y + step, r)) { e.y += step; tries++; }
      by = true;
    }
  }
  return { bx, by };
}

export function lineOfSight(l: Level, x0: number, y0: number, x1: number, y1: number) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(d / 4);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (solidAt(l, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

/** BFS distance field from a world point (for enemy pathfinding) */
export function flowField(l: Level, fromX: number, fromY: number): Int16Array {
  const dist = new Int16Array(l.w * l.h).fill(-1);
  const sx = Math.floor(fromX / TILE), sy = Math.floor(fromY / TILE);
  if (tileAt(l, sx, sy) === 1) return dist;
  const q: number[] = [sy * l.w + sx];
  dist[sy * l.w + sx] = 0;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const cx = cur % l.w, cy = (cur / l.w) | 0;
    const d = dist[cur];
    for (let i = 0; i < 4; i++) {
      const nx = cx + (i === 0 ? 1 : i === 1 ? -1 : 0);
      const ny = cy + (i === 2 ? 1 : i === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= l.w || ny >= l.h) continue;
      const ni = ny * l.w + nx;
      if (l.tiles[ni] === 1 || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      q.push(ni);
    }
  }
  return dist;
}

export function flowDir(l: Level, flow: Int16Array, x: number, y: number): Vec | null {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const here = flow[ty * l.w + tx];
  if (here === undefined || here < 0) return null;
  let best = here, bx = tx, by = ty;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx, ny = ty + dy;
      if (tileAt(l, nx, ny) === 1) continue;
      if (dx && dy && (tileAt(l, tx + dx, ty) === 1 || tileAt(l, tx, ty + dy) === 1)) continue;
      const v = flow[ny * l.w + nx];
      if (v >= 0 && v < best) { best = v; bx = nx; by = ny; }
    }
  }
  if (bx === tx && by === ty) return null;
  const cx = bx * TILE + TILE / 2, cy = by * TILE + TILE / 2;
  const d = Math.hypot(cx - x, cy - y) || 1;
  return { x: (cx - x) / d, y: (cy - y) / d };
}

/** Big open survival arena: scattered pillars / low walls, lots of room for crowds, spawn in the centre. */
export function generateArena(seed: number): Level {
  const rng = new Rng(seed * 7919 + 101);
  const w = 60, h = 42;
  const tiles = new Uint8Array(w * h).fill(1);
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = v; };
  const fillRect = (x: number, y: number, rw: number, rh: number, v: number) => { for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) set(xx, yy, v); };
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) set(x, y, 0);
  // rounded corners
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) { set(2 + j, 2 + i, 1); set(w - 3 - j, 2 + i, 1); set(2 + j, h - 3 - i, 1); set(w - 3 - j, h - 3 - i, 1); }
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  // 8 pillar clusters in a ring + a few low walls; keep the centre clear
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const r = rng.range(11, 15);
    const px = Math.round(cx + Math.cos(a) * r), py = Math.round(cy + Math.sin(a) * r * 0.7);
    const kind = rng.int(0, 2);
    if (kind === 0) fillRect(px, py, 2, 2, 1);
    else if (kind === 1) fillRect(px, py, rng.chance(0.5) ? 4 : 1, rng.chance(0.5) ? 1 : 4, 1);
    else { set(px, py, 1); set(px + 2, py, 1); set(px + 1, py + 2, 1); }
  }
  for (let k = 0; k < 10; k++) {
    const x = rng.int(5, w - 7), y = rng.int(5, h - 7);
    if (Math.abs(x - cx) < 7 && Math.abs(y - cy) < 5) continue;
    set(x, y, 1);
  }
  const floorTiles: Vec[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (tiles[y * w + x] === 0) floorTiles.push({ x, y });
  return { n: 0, zone: 0, w, h, tiles, spawn: { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2 }, exit: { x: cx * TILE, y: cy * TILE }, floorTiles, isBoss: false, style: 'arena', seed };
}

export function generateLevel(n: number): Level {
  const isBoss = n % 10 === 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const seed = n * 7919 + 13 + attempt * 104729;
    const rng = new Rng(seed);
    const w = isBoss ? 36 : Math.min(54, 28 + Math.floor(n / 7) + rng.int(0, 3));
    const h = isBoss ? 24 : Math.min(34, 18 + Math.floor(n / 11) + rng.int(0, 2));
    const tiles = new Uint8Array(w * h).fill(1);
    const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = v; };
    const get = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 1 : tiles[y * w + x]);
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) set(x, y, 0);

    const styles = ['pillars', 'rooms', 'cave', 'mixed', 'pillars', 'cross'];
    const style = isBoss ? 'arena' : rng.pick(styles);
    const fillRect = (x: number, y: number, rw: number, rh: number, v: number) => {
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) set(xx, yy, v);
    };
    if (style === 'pillars' || style === 'mixed') {
      const count = Math.floor((w * h) / 55);
      for (let i = 0; i < count; i++) {
        const s = rng.chance(0.6) ? 1 : rng.int(2, 3);
        fillRect(rng.int(4, w - 5 - s), rng.int(4, h - 5 - s), s, rng.chance(0.5) ? s : 1, 1);
      }
    }
    if (style === 'rooms') {
      const blocks = rng.int(3, 6);
      for (let i = 0; i < blocks; i++) {
        const bw = rng.int(3, 8), bh = rng.int(2, 6);
        fillRect(rng.int(4, w - 5 - bw), rng.int(4, h - 5 - bh), bw, bh, 1);
      }
      for (let i = 0; i < 6; i++) fillRect(rng.int(4, w - 6), rng.int(4, h - 6), 1, 1, 1);
    }
    if (style === 'cave' || style === 'mixed') {
      const noise = new Uint8Array(w * h);
      for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) noise[y * w + x] = rng.chance(0.4) ? 1 : 0;
      for (let it = 0; it < 4; it++) {
        const next = new Uint8Array(noise);
        for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
          let c = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) c += noise[(y + dy) * w + x + dx];
          next[y * w + x] = c >= 5 ? 1 : c <= 2 ? 0 : noise[y * w + x];
        }
        noise.set(next);
      }
      for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) if (noise[y * w + x]) set(x, y, 1);
    }
    if (style === 'cross') {
      const cw = Math.floor(w / 2), ch = Math.floor(h / 2);
      fillRect(4, 4, cw - 7, ch - 7, 1);
      fillRect(cw + 3, 4, w - cw - 7, ch - 7, 1);
      fillRect(4, ch + 3, cw - 7, h - ch - 7, 1);
      fillRect(cw + 3, ch + 3, w - cw - 7, h - ch - 7, 1);
      // carve inner rooms inside blocks
      fillRect(6, 6, cw - 11, ch - 11, 0);
      fillRect(cw + 5, 6, w - cw - 11, ch - 11, 0);
      fillRect(6, ch + 5, cw - 11, h - ch - 11, 0);
      fillRect(cw + 5, ch + 5, w - cw - 11, h - ch - 11, 0);
      // doors
      fillRect(cw - 4, 5, 1, 2, 0); fillRect(cw + 4, 5, 1, 2, 0);
      fillRect(5, ch - 4, 2, 1, 0); fillRect(w - 7, ch - 4, 2, 1, 0);
      fillRect(5, ch + 4, 2, 1, 0); fillRect(w - 7, ch + 4, 2, 1, 0);
      fillRect(cw - 4, h - 7, 1, 2, 0); fillRect(cw + 4, h - 7, 1, 2, 0);
    }
    if (style === 'arena') {
      const cx = w / 2, cy = h / 2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        set(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 6), 1);
      }
      fillRect(4, 4, 2, 2, 1); fillRect(w - 6, 4, 2, 2, 1); fillRect(4, h - 6, 2, 2, 1); fillRect(w - 6, h - 6, 2, 2, 1);
    }

    // connectivity: pick spawn on the left side
    let spawnT: Vec | null = null;
    for (let tries = 0; tries < 200 && !spawnT; tries++) {
      const tx = rng.int(3, Math.max(4, Math.floor(w / 4))), ty = rng.int(3, h - 4);
      if (get(tx, ty) === 0 && get(tx + 1, ty) === 0 && get(tx, ty + 1) === 0) spawnT = { x: tx, y: ty };
    }
    if (!spawnT) continue;
    const dist = new Int32Array(w * h).fill(-1);
    const q = [spawnT.y * w + spawnT.x];
    dist[q[0]] = 0;
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      const cx = cur % w, cy = (cur / w) | 0;
      for (let i = 0; i < 4; i++) {
        const nx = cx + (i === 0 ? 1 : i === 1 ? -1 : 0), ny = cy + (i === 2 ? 1 : i === 3 ? -1 : 0);
        if (get(nx, ny) === 1) continue;
        const ni = ny * w + nx;
        if (dist[ni] !== -1) continue;
        dist[ni] = dist[cur] + 1;
        q.push(ni);
      }
    }
    const floorTiles: Vec[] = [];
    let far = 0, exitT = spawnT;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (tiles[i] === 0) {
        if (dist[i] < 0) tiles[i] = 1;
        else {
          floorTiles.push({ x, y });
          if (dist[i] > far) { far = dist[i]; exitT = { x, y }; }
        }
      }
    }
    const interior = (w - 4) * (h - 4);
    if (floorTiles.length < interior * 0.45 || far < 12) continue;
    return {
      n, zone: zoneOf(n), w, h, tiles,
      spawn: { x: spawnT.x * TILE + TILE / 2, y: spawnT.y * TILE + TILE / 2 },
      exit: { x: exitT.x * TILE + TILE / 2, y: exitT.y * TILE + TILE / 2 },
      floorTiles, isBoss, style, seed,
    };
  }
  // fallback: open box
  const w = 30, h = 20;
  const tiles = new Uint8Array(w * h).fill(1);
  const floorTiles: Vec[] = [];
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) { tiles[y * w + x] = 0; floorTiles.push({ x, y }); }
  return { n, zone: zoneOf(n), w, h, tiles, spawn: { x: 4 * TILE, y: 10 * TILE }, exit: { x: 26 * TILE, y: 10 * TILE }, floorTiles, isBoss, style: 'box', seed: n };
}

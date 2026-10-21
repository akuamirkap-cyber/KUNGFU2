import { TILE, ENEMY_DEFS, EnemyKind, BIOMES, Biome } from './data';

// Seeded RNG (mulberry32)
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LevelData {
  w: number; h: number;
  tiles: Uint8Array; // 1 = wall
  spawn: { x: number; y: number };
  enemySpawns: { x: number; y: number; kind: EnemyKind }[];
  midBossStyle?: string;
  midBossCount?: number;
  pickups: { x: number; y: number; kind: 'ammoP' | 'ammoR' | 'hp' }[];
  biome: Biome;
  isBoss: boolean;
  hpMult: number;
  dmgMult: number;
  spdMult: number;
  decor: { x: number; y: number; t: number }[];
}

export function biomeFor(level: number) {
  return BIOMES[Math.min(BIOMES.length - 1, Math.floor((level - 1) / 20))];
}

// Big open arena for ENDLESS mode (Survivor.io style): wide floor, pillar clusters, a few wall segments
export function generateArena(stage: number): LevelData {
  const rng = makeRng(stage * 48271 + 99991);
  const w = 64, h = 44;
  const tiles = new Uint8Array(w * h).fill(0);
  const idx = (x: number, y: number) => y * w + x;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) tiles[idx(x, y)] = 1;
  const cx = w / 2, cy = h / 2;
  const blocks = 10 + Math.floor(rng() * 6);
  for (let i = 0; i < blocks; i++) {
    const bw = 1 + Math.floor(rng() * 3), bh = 1 + Math.floor(rng() * 3);
    const bx = 4 + Math.floor(rng() * (w - 8 - bw)), by = 4 + Math.floor(rng() * (h - 8 - bh));
    if (Math.abs(bx - cx) < 6 && Math.abs(by - cy) < 5) continue; // keep center open
    for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) tiles[idx(xx, yy)] = 1;
  }
  // a few long wall segments
  const segs = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < segs; i++) {
    const horiz = rng() < 0.5, len = 4 + Math.floor(rng() * 6);
    const sx = 5 + Math.floor(rng() * (w - 10 - len)), sy = 5 + Math.floor(rng() * (h - 10 - len));
    if (Math.abs(sx - cx) < 8 && Math.abs(sy - cy) < 6) continue;
    for (let k = 0; k < len; k++) tiles[idx(horiz ? sx + k : sx, horiz ? sy : sy + k)] = 1;
  }
  const decor: LevelData['decor'] = [];
  for (let i = 0; i < w * h; i++) if (tiles[i] === 0 && rng() < 0.05) decor.push({ x: (i % w) * TILE + rng() * TILE, y: Math.floor(i / w) * TILE + rng() * TILE, t: Math.floor(rng() * 3) });
  return {
    w, h, tiles, spawn: { x: cx * TILE, y: cy * TILE }, enemySpawns: [], pickups: [],
    biome: BIOMES[(stage - 1) % BIOMES.length], isBoss: false, hpMult: 1, dmgMult: 1, spdMult: 1, decor,
  };
}

// weapon-master styles used for mid-bosses (mirrors BOSSES in data.ts)
const MID_BOSS_STYLES = ['fists', 'pistol', 'staff', 'machete', 'dual', 'spear', 'katana', 'axe', 'nunchaku', 'rifle'];

export function generateLevel(level: number): LevelData {
  const rng = makeRng(level * 7919 + 1337);
  const isBoss = level <= 50 ? level % 5 === 0 : level % 10 === 0;
  // MID-BOSS: every level hosts a weapon-master elite so no floor feels empty
  const midBossStyle = MID_BOSS_STYLES[(level - 1) % MID_BOSS_STYLES.length];
  const midBossCount = isBoss ? 0 : level < 4 ? 0 : level < 12 ? 1 : level < 25 ? 1 : 2;
  const prog = (level - 1) / 199; // 0..1

  const w = isBoss ? 34 : Math.floor(28 + prog * 22 + rng() * 6);
  const h = isBoss ? 24 : Math.floor(20 + prog * 14 + rng() * 4);
  const tiles = new Uint8Array(w * h).fill(1);
  const idx = (x: number, y: number) => y * w + x;
  const carve = (x: number, y: number) => { if (x > 1 && y > 1 && x < w - 2 && y < h - 2) tiles[idx(x, y)] = 0; };

  if (isBoss) {
    // big arena with pillars
    for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) carve(x, y);
    const pillars = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < pillars; i++) {
      const px = 7 + Math.floor(rng() * (w - 14)), py = 6 + Math.floor(rng() * (h - 12));
      tiles[idx(px, py)] = 1; tiles[idx(px + 1, py)] = 1; tiles[idx(px, py + 1)] = 1; tiles[idx(px + 1, py + 1)] = 1;
    }
  } else {
    // drunkard walk carve (Nuclear Throne style)
    let x = Math.floor(w / 2), y = Math.floor(h / 2);
    const target = Math.floor(w * h * (0.42 + rng() * 0.1));
    let carved = 0;
    const walkers: { x: number; y: number; dir: number }[] = [{ x, y, dir: 0 }];
    let guard = 0;
    while (carved < target && guard++ < 200000) {
      for (const wk of walkers) {
        if (rng() < 0.3) wk.dir = Math.floor(rng() * 4);
        const dx = [1, -1, 0, 0][wk.dir], dy = [0, 0, 1, -1][wk.dir];
        wk.x = Math.max(2, Math.min(w - 3, wk.x + dx));
        wk.y = Math.max(2, Math.min(h - 3, wk.y + dy));
        const r = rng() < 0.25 ? 1 : 0;
        for (let ox = -r; ox <= r; ox++) for (let oy = -r; oy <= r; oy++) {
          const tx = wk.x + ox, ty = wk.y + oy;
          if (tx > 1 && ty > 1 && tx < w - 2 && ty < h - 2 && tiles[idx(tx, ty)] === 1) { tiles[idx(tx, ty)] = 0; carved++; }
        }
      }
      if (walkers.length < 4 && rng() < 0.01) walkers.push({ ...walkers[0] });
    }
    // open rooms
    const rooms = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < rooms; i++) {
      const rw = 5 + Math.floor(rng() * 5), rh = 4 + Math.floor(rng() * 4);
      const rx = 3 + Math.floor(rng() * (w - rw - 6)), ry = 3 + Math.floor(rng() * (h - rh - 6));
      for (let yy = ry; yy < ry + rh; yy++) for (let xx = rx; xx < rx + rw; xx++) carve(xx, yy);
    }
    // remove single wall islands (noise), then flood fill connectivity
    for (let yy = 2; yy < h - 2; yy++) for (let xx = 2; xx < w - 2; xx++) {
      if (tiles[idx(xx, yy)] === 1) {
        const n = (tiles[idx(xx + 1, yy)] + tiles[idx(xx - 1, yy)] + tiles[idx(xx, yy + 1)] + tiles[idx(xx, yy - 1)]);
        if (n === 0) tiles[idx(xx, yy)] = 0;
      }
    }
  }

  // Flood fill from center to find the main connected floor; seal the rest
  const floor: number[] = [];
  {
    let start = -1;
    // find nearest floor tile to center
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    let best = 1e9;
    for (let i = 0; i < w * h; i++) if (tiles[i] === 0) {
      const tx = i % w, ty = Math.floor(i / w);
      const d = (tx - cx) ** 2 + (ty - cy) ** 2;
      if (d < best) { best = d; start = i; }
    }
    const seen = new Uint8Array(w * h);
    const stack = [start]; seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      floor.push(i);
      const tx = i % w, ty = Math.floor(i / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = idx(nx, ny);
        if (!seen[j] && tiles[j] === 0) { seen[j] = 1; stack.push(j); }
      }
    }
    for (let i = 0; i < w * h; i++) if (tiles[i] === 0 && !seen[i]) tiles[i] = 1;
  }

  const toWorld = (i: number) => ({ x: (i % w) * TILE + TILE / 2, y: Math.floor(i / w) * TILE + TILE / 2 });
  // Spawn point: pick floor tile with good open space, favor left side
  const openness = (i: number) => {
    const tx = i % w, ty = Math.floor(i / w);
    let n = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const xx = tx + ox, yy = ty + oy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && tiles[idx(xx, yy)] === 0) n++;
    }
    return n;
  };
  const openFloor = floor.filter((i) => openness(i) === 9);
  const pool = openFloor.length > 10 ? openFloor : floor;
  const sortedByX = [...pool].sort((a, b) => (a % w) - (b % w));
  const spawnIdx = sortedByX[Math.floor(rng() * Math.min(12, sortedByX.length))];
  const spawn = toWorld(spawnIdx);

  // Enemies
  const enemySpawns: LevelData['enemySpawns'] = [];
  const kinds = (Object.values(ENEMY_DEFS) as typeof ENEMY_DEFS[EnemyKind][]).filter((d) => d.kind !== 'boss' && d.unlock <= level);
  const pickKind = (): EnemyKind => {
    const total = kinds.reduce((s, k) => s + k.weight, 0);
    let r = rng() * total;
    for (const k of kinds) { r -= k.weight; if (r <= 0) return k.kind; }
    return 'thug';
  };
  const count = isBoss ? 2 + Math.floor(level / 40) : Math.min(28, Math.floor(4 + level * 0.11 + rng() * 2));
  const far = pool.filter((i) => { const p = toWorld(i); return Math.hypot(p.x - spawn.x, p.y - spawn.y) > 110; });
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    let tries = 0, ti = far[Math.floor(rng() * far.length)];
    while (used.has(ti) && tries++ < 20) ti = far[Math.floor(rng() * far.length)];
    used.add(ti);
    const p = toWorld(ti);
    enemySpawns.push({ x: p.x, y: p.y, kind: isBoss ? 'thug' : pickKind() });
  }
  // MID-BOSSES: armed elites placed at distance, guarding the level
  if (midBossCount > 0 && !isBoss) {
    const far2 = far.filter((i) => { const p = toWorld(i); return Math.hypot(p.x - spawn.x, p.y - spawn.y) > 170; });
    for (let i = 0; i < midBossCount; i++) {
      let ti = far2.length ? far2[Math.floor(rng() * far2.length)] : far[Math.floor(rng() * far.length)];
      let tries = 0;
      while (used.has(ti) && tries++ < 20) ti = far[Math.floor(rng() * far.length)];
      used.add(ti);
      const p = toWorld(ti);
      // pick a melee-weapon enemy that matches the theme when possible
      const themed: EnemyKind = midBossStyle === 'katana' ? 'samurai'
        : midBossStyle === 'machete' ? 'cleaver'
        : midBossStyle === 'axe' || midBossStyle === 'staff' || midBossStyle === 'spear' ? 'pipeswing'
        : midBossStyle === 'pistol' ? 'gunner'
        : midBossStyle === 'rifle' ? 'rifleman'
        : midBossStyle === 'dual' ? 'ninja'
        : 'brute';
      enemySpawns.push({ x: p.x, y: p.y, kind: themed });
    }
  }
  if (isBoss) {
    // boss at far right
    const right = [...pool].sort((a, b) => (b % w) - (a % w))[Math.floor(rng() * 5)];
    const p = toWorld(right);
    enemySpawns.push({ x: p.x, y: p.y, kind: 'boss' });
  }

  // Pickups
  const pickups: LevelData['pickups'] = [];
  const pk = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < pk; i++) {
    const ti = pool[Math.floor(rng() * pool.length)];
    const p = toWorld(ti);
    const r = rng();
    pickups.push({ x: p.x, y: p.y, kind: r < 0.4 ? 'ammoP' : r < 0.75 ? 'ammoR' : 'hp' });
  }

  // Decor dots
  const decor: LevelData['decor'] = [];
  for (let i = 0; i < floor.length; i++) if (rng() < 0.06) { const p = toWorld(floor[i]); decor.push({ x: p.x + (rng() - 0.5) * 10, y: p.y + (rng() - 0.5) * 10, t: Math.floor(rng() * 3) }); }

  return {
    w, h, tiles, spawn, enemySpawns, pickups, biome: biomeFor(level), isBoss,
    hpMult: 1 + prog * 4.5 + Math.floor(level / 10) * 0.08,
    dmgMult: 1 + prog * 1.6,
    spdMult: 1 + prog * 0.45,
    decor, midBossStyle, midBossCount,
  };
}

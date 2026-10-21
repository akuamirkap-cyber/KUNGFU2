import { flowDir, lineOfSight } from './level';
import { angleDiff, rnd, type Rng } from './rng';
import type { BossKind, Enemy, EnemyKind, Pose, Vec } from './types';
import type { Game } from './game';

export interface EnemyDef {
  hp: number; speed: number; r: number; dmg: number; structure: number; color: string; color2: string; scale: number;
  acc: string; weapon: string; minLevel: number; weight: number; value: number; kbRes: number; armor: boolean;
  canParry: boolean; range: number; cd: number; windup: number; recover: number; role: 'melee' | 'ranged';
  minD: number; maxD: number; mag: number; reload: number;
}

// All regular enemies share the player's proportions (scale 1). Only the brute is bulkier; bosses are big.
export const DEFS: Record<Exclude<EnemyKind, 'boss'>, EnemyDef> = {
  thug: { hp: 10, speed: 62, r: 5, dmg: 1, structure: 41, color: '#ff9f43', color2: '#ffe66d', scale: 1, acc: 'mohawk', weapon: 'none', minLevel: 1, weight: 10, value: 10, kbRes: 0.25, armor: false, canParry: false, range: 15, cd: 1.1, windup: 0.42, recover: 0.45, role: 'melee', minD: 0, maxD: 0, mag: 0, reload: 0 },
  knife: { hp: 7, speed: 92, r: 5, dmg: 1, structure: 30, color: '#ffe66d', color2: '#ffffff', scale: 1, acc: 'none', weapon: 'knife', minLevel: 3, weight: 7, value: 15, kbRes: 0.15, armor: false, canParry: false, range: 12, cd: 1.4, windup: 0.34, recover: 0.5, role: 'melee', minD: 0, maxD: 0, mag: 0, reload: 0 },
  gunner: { hp: 8, speed: 52, r: 5, dmg: 1, structure: 35, color: '#c56cf0', color2: '#ffffff', scale: 1, acc: 'glasses', weapon: 'pistol', minLevel: 6, weight: 6, value: 15, kbRes: 0.2, armor: false, canParry: false, range: 150, cd: 1.3, windup: 0.55, recover: 0.35, role: 'ranged', minD: 75, maxD: 135, mag: 4, reload: 1.5 },
  bomber: { hp: 5, speed: 104, r: 5, dmg: 2, structure: 20, color: '#ff4757', color2: '#5a0a12', scale: 1, acc: 'hood', weapon: 'bomb', minLevel: 12, weight: 4, value: 20, kbRes: 0, armor: false, canParry: false, range: 18, cd: 1, windup: 0.5, recover: 0.5, role: 'melee', minD: 0, maxD: 0, mag: 0, reload: 0 },
  smg: { hp: 8, speed: 60, r: 5, dmg: 1, structure: 32, color: '#4dd2ff', color2: '#0b3a4a', scale: 1, acc: 'mask', weapon: 'smg', minLevel: 15, weight: 5, value: 20, kbRes: 0.2, armor: false, canParry: false, range: 140, cd: 1.0, windup: 0.5, recover: 0.4, role: 'ranged', minD: 60, maxD: 120, mag: 3, reload: 1.8 },
  rifleman: { hp: 11, speed: 46, r: 5, dmg: 1, structure: 41, color: '#7bed9f', color2: '#2d6b3f', scale: 1, acc: 'hat', weapon: 'rifle', minLevel: 18, weight: 5, value: 20, kbRes: 0.25, armor: false, canParry: false, range: 180, cd: 1.5, windup: 0.6, recover: 0.4, role: 'ranged', minD: 95, maxD: 165, mag: 3, reload: 1.9 },
  brute: { hp: 36, speed: 38, r: 5.5, dmg: 2, structure: 122, color: '#ff6b81', color2: '#6b1f2b', scale: 1.1, acc: 'horns', weapon: 'none', minLevel: 24, weight: 3, value: 40, kbRes: 0.85, armor: true, canParry: false, range: 22, cd: 1.8, windup: 0.68, recover: 0.7, role: 'melee', minD: 0, maxD: 0, mag: 0, reload: 0 },
  monk: { hp: 16, speed: 76, r: 5, dmg: 1, structure: 68, color: '#70a1ff', color2: '#ff6b35', scale: 1, acc: 'band', weapon: 'none', minLevel: 30, weight: 4, value: 30, kbRes: 0.3, armor: false, canParry: true, range: 16, cd: 1.2, windup: 0.3, recover: 0.4, role: 'melee', minD: 0, maxD: 0, mag: 0, reload: 0 },
  shotgun: { hp: 13, speed: 50, r: 5, dmg: 1, structure: 43, color: '#ffb8b8', color2: '#5a1e1e', scale: 1, acc: 'hat', weapon: 'shotgun', minLevel: 34, weight: 4, value: 28, kbRes: 0.3, armor: false, canParry: false, range: 90, cd: 1.8, windup: 0.6, recover: 0.6, role: 'ranged', minD: 40, maxD: 75, mag: 2, reload: 2.2 },
  shield: { hp: 15, speed: 44, r: 5.5, dmg: 1, structure: 61, color: '#eccc68', color2: '#8a6a22', scale: 1, acc: 'helmet', weapon: 'shield', minLevel: 40, weight: 3, value: 30, kbRes: 0.55, armor: false, canParry: false, range: 16, cd: 1.5, windup: 0.45, recover: 0.5, role: 'melee', minD: 0, maxD: 0, mag: 0, reload: 0 },
  sniper: { hp: 8, speed: 50, r: 5, dmg: 2, structure: 32, color: '#ff7f50', color2: '#ffffff', scale: 1, acc: 'glasses', weapon: 'rifle', minLevel: 55, weight: 2, value: 35, kbRes: 0.2, armor: false, canParry: false, range: 260, cd: 2.6, windup: 1.2, recover: 0.8, role: 'ranged', minD: 150, maxD: 240, mag: 1, reload: 2.4 },
};

export interface BossDef {
  name: string; hp: number; speed: number; r: number; dmg: number; structure: number; color: string; color2: string;
  scale: number; acc: string; weapon: string; kbRes: number; armor: boolean; canParry: boolean; value: number;
}

export const BOSS_DEFS: Record<BossKind, BossDef> = {
  bull: { name: 'IRON BULL', hp: 110, speed: 42, r: 9, dmg: 2, structure: 297, color: '#ff4757', color2: '#ffd700', scale: 2, acc: 'horns', weapon: 'none', kbRes: 0.9, armor: true, canParry: false, value: 400 },
  queen: { name: 'GUN QUEEN', hp: 90, speed: 60, r: 7, dmg: 1, structure: 216, color: '#c56cf0', color2: '#ffd700', scale: 1.5, acc: 'crown', weapon: 'pistol', kbRes: 0.5, armor: false, canParry: false, value: 400 },
  shadow: { name: 'SHADOW MASTER', hp: 100, speed: 85, r: 6, dmg: 2, structure: 243, color: '#5a5a80', color2: '#ff2a2a', scale: 1.3, acc: 'mask', weapon: 'none', kbRes: 0.6, armor: false, canParry: true, value: 500 },
  priest: { name: 'BOMB PRIEST', hp: 95, speed: 45, r: 7, dmg: 2, structure: 230, color: '#ffa502', color2: '#2f1b0a', scale: 1.5, acc: 'hood', weapon: 'bomb', kbRes: 0.6, armor: false, canParry: false, value: 400 },
  dancer: { name: 'BLADE DANCER', hp: 85, speed: 100, r: 6, dmg: 1, structure: 203, color: '#ffe66d', color2: '#ff3df2', scale: 1.3, acc: 'band', weapon: 'knife', kbRes: 0.4, armor: false, canParry: false, value: 450 },
};

const BOSS_ORDER: BossKind[] = ['bull', 'queen', 'dancer', 'priest', 'shadow'];
export function bossForLevel(n: number): BossKind {
  const i = Math.floor(n / 10) - 1;
  if (n === 200) return 'shadow';
  return BOSS_ORDER[i % BOSS_ORDER.length];
}

const TIER_PREFIX = ['', 'ELDER ', 'GRAND ', 'ETERNAL '];

export function pickKind(n: number, rng: Rng): Exclude<EnemyKind, 'boss'> {
  const keys = Object.keys(DEFS) as Exclude<EnemyKind, 'boss'>[];
  const avail = keys.filter((k) => DEFS[k].minLevel <= n);
  let total = 0;
  const ws = avail.map((k) => {
    let w = DEFS[k].weight;
    if (k === 'thug') w = Math.max(3, 10 - n / 30);
    else w *= 1 + (n - DEFS[k].minLevel) / 150;
    total += w;
    return w;
  });
  let r = rng.next() * total;
  for (let i = 0; i < avail.length; i++) {
    r -= ws[i];
    if (r <= 0) return avail[i];
  }
  return avail[avail.length - 1];
}

let nextId = 1;
export function makeEnemy(kind: EnemyKind, boss: BossKind | undefined, x: number, y: number, n: number, elite: boolean): Enemy {
  let def: BossDef | EnemyDef;
  let name = '';
  let hpMul: number;
  let speed: number;
  if (kind === 'boss' && boss) {
    const bd = BOSS_DEFS[boss];
    def = bd;
    const tier = Math.min(3, Math.floor((n - 1) / 50));
    hpMul = 1.25 + (n / 10) * 0.5;
    name = TIER_PREFIX[tier] + bd.name;
    if (n === 200) { name = 'THE MASTER'; hpMul *= 1.35; }
    speed = bd.speed * (1 + Math.min(0.3, n * 0.0015));
  } else {
    const ed = DEFS[kind as Exclude<EnemyKind, 'boss'>];
    def = ed;
    hpMul = (1 + n * 0.035) * (elite ? 2.2 : 1);
    speed = ed.speed * (1 + Math.min(0.45, n * 0.0025) + Math.max(0, n - 200) * 0.0012) * (elite ? 1.15 : 1);
    name = kind.toUpperCase();
  }
  const isBoss = kind === 'boss';
  let dmg = def.dmg;
  if (n >= 110 && (isBoss || kind === 'thug' || kind === 'knife' || kind === 'monk' || kind === 'shield' || kind === 'brute')) dmg += 1;
  if (n >= 160 && (kind === 'gunner' || kind === 'rifleman' || kind === 'bomber' || kind === 'smg' || kind === 'shotgun')) dmg += 1;
  const ed = isBoss ? null : (def as EnemyDef);
  const role: 'melee' | 'ranged' = isBoss ? (boss === 'queen' || boss === 'priest' ? 'ranged' : 'melee') : ed!.role;
  return {
    id: nextId++, kind, boss: isBoss ? boss : undefined, name, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: def.r,
    hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul), dead: false, flash: 0, facing: 1, aim: 0, walk: 0, moving: false,
    speed, dmg, color: def.color, color2: elite ? '#ffffff' : def.color2, scale: def.scale,
    structure: 0, maxStructure: def.structure * (elite ? 1.5 : 1) * (isBoss ? 1 + n / 100 : 1), stagger: 0, down: 0, stun: 0,
    state: 'chase', stateT: 0, attackCd: rnd(0.6, 1.6), pose: 'idle', poseT: 0, poseDur: 1, elite, spawnT: isBoss ? 1.2 : 0.7,
    accessory: def.acc, weapon: def.weapon, kbRes: def.kbRes, armor: def.armor, canParry: def.canParry, burst: 0, phase: 0,
    value: def.value * (elite ? 2 : 1), hitDone: false, strafeDir: Math.random() < 0.5 ? 1 : -1, strafeT: rnd(0.5, 1.5), summonCd: 6,
    fuse: -1, chargeDir: 0, tele: null, attackRange: 'range' in def ? def.range : 16, lastDist: 9999, stuckT: 0, shockR: [],
    parryCd: 0, cdMul: Math.max(0.5, 1 - n * 0.0025), wMul: Math.max(0.65, 1 - n * 0.0018),
    z: 0, vz: 0, flinch: 0, rot: 0, fatalCount: 0,
    role, slot: -1, slotAng: 0, token: false, tokenT: 0, wantDist: ed ? (ed.minD + ed.maxD) / 2 : 0, reload: 0, ammo: ed ? ed.mag : 0, aimLine: 0,
    sepx: 0, sepy: 0, repos: null, reposT: 0, pose2: 'idle', strideHalf: 3, bodyAim: 0, bleed: 0, bleedT: 0, doom: 0,
  };
}

function setPose(e: Enemy, pose: Pose, dur: number) {
  e.pose = pose;
  e.poseT = 0;
  e.poseDur = Math.max(0.01, dur);
}

function lerpAngle(a: number, b: number, t: number) {
  return a + angleDiff(b, a) * Math.min(1, t);
}

// ------------------------------------------------------------------ steering helpers
function applyMove(g: Game, e: Enemy, dx: number, dy: number, speed: number) {
  // blend desired direction with separation from allies; slide along walls
  let x = dx + e.sepx * 0.9, y = dy + e.sepy * 0.9;
  const l = Math.hypot(x, y) || 1;
  x /= l; y /= l;
  if (!g.isFree(e.x + x * 8, e.y + y * 8, e.r)) {
    // try sliding directions
    const cands = [[x, 0], [0, y], [-y, x], [y, -x]];
    let found = false;
    for (const [cx, cy] of cands) {
      const cl = Math.hypot(cx, cy) || 1;
      if (g.isFree(e.x + (cx / cl) * 8, e.y + (cy / cl) * 8, e.r)) { x = cx / cl; y = cy / cl; found = true; break; }
    }
    if (!found) { x = 0; y = 0; }
  }
  e.vx = x * speed; e.vy = y * speed; e.moving = Math.abs(x) + Math.abs(y) > 0.01;
}

function steer(g: Game, e: Enemy, tx: number, ty: number, speed: number, useFlow: boolean) {
  let dir: Vec | null = null;
  if (useFlow) dir = flowDir(g.level, g.flow, e.x, e.y);
  if (!dir) {
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    dir = { x: dx / d, y: dy / d };
  }
  applyMove(g, e, dir.x, dir.y, speed);
}

function moveTo(g: Game, e: Enemy, tx: number, ty: number, speed: number, stopD = 0) {
  const los = lineOfSight(g.level, e.x, e.y, tx, ty);
  if (los) { steer(g, e, tx, ty, speed, false); return; }
  // no straight path to the spot: approach the player through the flow field, but never closer than stopD;
  // once near, slide sideways around the obstacle instead of walking into the player's face
  const p = g.player;
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  if (d > stopD + 12) steer(g, e, p.x, p.y, speed, true);
  else strafe(g, e, Math.atan2(p.y - e.y, p.x - e.x), 1 / 60, speed);
}

/** Find a spot at the enemy's ideal distance that has line of sight to the player AND a clear line of fire (no ally in between). */
function findFiringSpot(g: Game, e: Enemy, radius: number): Vec | null {
  const p = g.player;
  const myAng = Math.atan2(e.y - p.y, e.x - p.x);
  let best: Vec | null = null, bd = 1e9;
  for (let i = 0; i < 12; i++) {
    const a = myAng + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 6);
    for (const rr of [radius, radius * 0.72]) {
      const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
      if (!g.isFree(x, y, e.r) || !lineOfSight(g.level, x, y, p.x, p.y)) continue;
      if (allyBetween(g, e, x, y, p.x, p.y)) continue;
      const d = Math.hypot(x - e.x, y - e.y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (best && i >= 3) break; // prefer small angular moves
  }
  return best;
}

function allyBetween(g: Game, e: Enemy, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const cx = dx / len, cy = dy / len;
  for (const o of g.enemies) {
    if (o === e || o.dead || o.spawnT > 0 || o.z > 8 || o.down > 0) continue;
    const ox = o.x - x0, oy = o.y - y0;
    const along = ox * cx + oy * cy;
    if (along < 4 || along > len - 4) continue;
    if (Math.abs(-ox * cy + oy * cx) < o.r + 2) return true;
  }
  return false;
}

function strafe(g: Game, e: Enemy, ang: number, dt: number, speed: number) {
  e.strafeT -= dt;
  if (e.strafeT <= 0) { e.strafeT = rnd(0.7, 1.6); e.strafeDir *= Math.random() < 0.7 ? -1 : 1; }
  const a = ang + (Math.PI / 2) * e.strafeDir;
  if (!g.isFree(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, e.r)) e.strafeDir *= -1;
  applyMove(g, e, Math.cos(a), Math.sin(a), speed);
}

/** Position on the ring around the player assigned to this enemy's slot */
function slotPos(g: Game, e: Enemy, radius: number): Vec {
  const p = g.player;
  const a = e.slotAng;
  let x = p.x + Math.cos(a) * radius, y = p.y + Math.sin(a) * radius;
  if (!g.isFree(x, y, e.r) || !lineOfSight(g.level, p.x, p.y, x, y)) {
    // find a nearby free radius/angle
    for (let i = 1; i <= 6; i++) {
      const aa = a + i * 0.35 * (i % 2 ? 1 : -1);
      const rr = radius * (1 - i * 0.08);
      const xx = p.x + Math.cos(aa) * rr, yy = p.y + Math.sin(aa) * rr;
      if (g.isFree(xx, yy, e.r) && lineOfSight(g.level, p.x, p.y, xx, yy)) { x = xx; y = yy; break; }
    }
  }
  return { x, y };
}

/** melee enemy without an attack token: circle at a respectful distance, waiting for its turn */
function holdRing(g: Game, e: Enemy, d: number, ang: number, dt: number) {
  const br = g.brutality();
  const want = Math.max(30, 46 - g.levelN * 0.07 - br * 8) + (e.slot % 2) * 12;
  // brutal AI prefers to circle toward the player's BACK (opposite the aim) so attacks come from the blind side
  if (br > 0.3 && e.slot % 2 === 1) {
    const p = g.player;
    const back = p.aim + Math.PI;
    const my = Math.atan2(e.y - p.y, e.x - p.x);
    e.slotAng = my + angleDiff(back, my) * 0.35 * br;
  }
  // too close: back away first (never crowd the player while another attacker has the token)
  if (d < want - 12) {
    if (g.isFree(e.x - Math.cos(ang) * 12, e.y - Math.sin(ang) * 12, e.r)) applyMove(g, e, -Math.cos(ang) + e.strafeDir * 0.4 * -Math.sin(ang), -Math.sin(ang) + e.strafeDir * 0.4 * Math.cos(ang), e.speed * 0.85);
    else strafe(g, e, ang, dt, e.speed * 0.8);
    return;
  }
  const s = slotPos(g, e, want);
  const ds = Math.hypot(s.x - e.x, s.y - e.y);
  if (ds > 10) moveTo(g, e, s.x, s.y, e.speed * 0.8, want - 12);
  else strafe(g, e, ang, dt, e.speed * 0.4);
}

/** ranged enemy: keep ideal distance, avoid friendly fire line, reposition when blocked */
function rangedPosition(g: Game, e: Enemy, d: number, ang: number, dt: number, los: boolean) {
  const def = DEFS[e.kind as Exclude<EnemyKind, 'boss'>] ?? { minD: 70, maxD: 140 };
  const minD = def.minD, maxD = def.maxD;
  if (e.repos) {
    e.reposT -= dt;
    const dr = Math.hypot(e.repos.x - e.x, e.repos.y - e.y);
    if (dr < 8 || e.reposT <= 0) e.repos = null;
    else { moveTo(g, e, e.repos.x, e.repos.y, e.speed, minD); return; }
  }
  if (!los) {
    // no sight line: head for a real firing position instead of blindly walking at the player
    const spot = findFiringSpot(g, e, e.wantDist);
    if (spot) { e.repos = spot; e.reposT = 1.2; moveTo(g, e, spot.x, spot.y, e.speed, minD); }
    else if (d > minD + 12) steer(g, e, g.player.x, g.player.y, e.speed, true);
    else strafe(g, e, ang, dt, e.speed);
    return;
  }
  if (d < minD) {
    // too close: back off (or sidestep if a wall is behind)
    if (g.isFree(e.x - Math.cos(ang) * 12, e.y - Math.sin(ang) * 12, e.r)) applyMove(g, e, -Math.cos(ang) + e.strafeDir * 0.35 * -Math.sin(ang), -Math.sin(ang) + e.strafeDir * 0.35 * Math.cos(ang), e.speed);
    else strafe(g, e, ang, dt, e.speed);
    return;
  }
  if (d > maxD) { steer(g, e, g.player.x, g.player.y, e.speed, false); return; }
  // in band: drift toward the assigned slot so shooters spread out around the player
  const s = slotPos(g, e, e.wantDist);
  const ds = Math.hypot(s.x - e.x, s.y - e.y);
  if (ds > 14) moveTo(g, e, s.x, s.y, e.speed * 0.75, minD);
  else strafe(g, e, ang, dt, e.speed * 0.35);
}

/** aim ahead of a moving player so bullets actually arrive where he is going (brutal shooters) */
function leadAngle(g: Game, e: Enemy, bulletSpeed: number) {
  const p = g.player;
  const br = g.brutality();
  const dx = p.x - e.x, dy = p.y - e.y;
  const t = Math.hypot(dx, dy) / bulletSpeed;
  const lead = 0.85 * br;
  return Math.atan2(dy + p.vy * t * lead, dx + p.vx * t * lead);
}

/** would this shot pass through an ally? */
export function friendlyInLine(g: Game, e: Enemy, ang: number, maxD: number) {
  const cx = Math.cos(ang), sy = Math.sin(ang);
  for (const o of g.enemies) {
    if (o === e || o.dead || o.spawnT > 0 || o.z > 8 || o.down > 0) continue; // bullets fly over knocked-down allies
    const dx = o.x - e.x, dy = o.y - e.y;
    const along = dx * cx + dy * sy;
    if (along < 4 || along > maxD) continue;
    const perp = Math.abs(-dx * sy + dy * cx);
    if (perp < o.r + 2) return true;
  }
  return false;
}

export function updateEnemy(g: Game, e: Enemy, dt: number) {
  const p = g.player;
  e.poseT += dt / e.poseDur;
  if (e.flash > 0) e.flash -= dt;
  if (e.flinch > 0) e.flinch -= dt;
  if (e.parryCd > 0) e.parryCd -= dt;
  if (e.summonCd > 0) e.summonCd -= dt;
  if (e.aimLine > 0) e.aimLine -= dt;
  e.moving = false;
  e.vx = 0; e.vy = 0;
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  // bleeding (katana / tiger claw): damage over time + dripping blood
  if (e.bleed > 0) {
    e.bleedT -= dt;
    if (e.bleedT <= 0) { e.bleedT = 0.35; e.bleed--; e.hp -= 1; g.particles.blood(e.x, e.y - 6 - e.z, 2, rnd(0, 6.3), 50); if (Math.random() < 0.5) g.stamp(e.x + rnd(-3, 3), e.y + rnd(0, 3), '#8a0000', 1); if (e.hp <= 0) { g.killEnemy(e, rnd(0, 6.3), 80, false, true); return; } }
  }
  // doomed (iaijutsu): frozen for a beat, then falls apart
  if (e.doom > 0) {
    e.doom -= dt; e.pose = 'stagger'; e.vx = e.vy = 0;
    if (e.doom <= 0) { g.iaiKill(e); }
    return;
  }
  if (e.z > 0 || e.vz !== 0) {
    e.vz -= 520 * dt;
    e.z += e.vz * dt;
    e.pose = 'launched';
    e.rot = Math.max(-0.9, Math.min(0.9, -e.vz / 350)) * e.facing;
    if (e.z <= 0) { e.z = 0; e.vz = 0; e.rot = 0; g.enemyLand(e); }
    return;
  }
  const ddx = p.x - e.x, ddy = p.y - e.y;
  const d = Math.hypot(ddx, ddy) || 1;
  const ang = Math.atan2(ddy, ddx);

  if (e.fuse >= 0) {
    e.fuse -= dt;
    if (e.fuse <= 0) { e.fuse = -1; g.explode(e.x, e.y, 32, e.dmg, false); g.killEnemy(e, ang, 0, true); return; }
  }
  if (e.stagger > 0) {
    e.stagger -= dt; e.pose = 'stagger';
    if (e.stagger <= 0) { e.structure = 0; e.state = 'chase'; e.attackCd = 0.5; }
    return;
  }
  if (e.down > 0) {
    e.down -= dt; e.pose = 'down';
    if (e.down <= 0) { e.state = 'chase'; e.attackCd = 0.5; e.structure *= 0.6; }
    return;
  }
  if (e.stun > 0) {
    e.stun -= dt; e.pose = 'hurt';
    if (e.stun <= 0) e.state = 'chase';
    return;
  }
  if (e.structure > 0) e.structure = Math.max(0, e.structure - e.maxStructure * 0.05 * dt);
  // brutality: faster wind-ups, shorter cooldowns, less structure decay time
  const br = g.brutality();
  e.wMul = Math.max(0.5, (1 - g.levelN * 0.0018) * (1 - br * 0.3));
  e.cdMul = Math.max(0.35, (1 - g.levelN * 0.0025) * (1 - br * 0.35));
  if (e.attackCd > 0) e.attackCd -= dt;
  if (e.reload > 0) {
    e.reload -= dt;
    if (e.reload <= 0) { const def = DEFS[e.kind as Exclude<EnemyKind, 'boss'>]; e.ammo = def ? def.mag : 1; }
  }
  if (e.kind === 'boss') aiBoss(g, e, dt, d, ang);
  else aiBasic(g, e, dt, d, ang);
  // feet never slide: the stride advances with the actual ground speed (62 px/s ~= the old 14 rad/s)
  const gs = Math.hypot(e.vx + e.kx * 0.3, e.vy + e.ky * 0.3);
  if ((e.pose === 'idle' || e.pose === 'reload' || e.pose === 'charge') && gs > 3) {
    const stepsPerSec = 3 + 2.5 * Math.min(1, gs / 160);
    e.strideHalf = Math.min(5.6 * e.scale, Math.max(2.4 * e.scale, gs / (4 * stepsPerSec)));
    e.walk += dt * stepsPerSec * Math.PI;
  } else if (!e.moving) e.walk = 0;
  // walking enemies face where they go; shooters/attackers/stunned face their aim (the player)
  const walking = (e.pose === 'idle' || e.pose === 'reload') && e.moving && gs > 25 && e.state === 'chase';
  if (walking && Math.abs(e.vx) > 6) { e.facing = e.vx >= 0 ? 1 : -1; e.bodyAim = Math.atan2(e.vy, e.vx); }
  else { e.facing = Math.cos(e.aim) >= 0 ? 1 : -1; e.bodyAim = e.aim; }
}

function aiBasic(g: Game, e: Enemy, dt: number, d: number, ang: number) {
  const p = g.player;
  const def = DEFS[e.kind as Exclude<EnemyKind, 'boss'>];
  const los = g.hasLOS(e);
  switch (e.kind) {
    case 'thug': case 'brute': case 'monk': case 'shield': {
      switch (e.state) {
        case 'chase': {
          e.aim = ang;
          const stop = e.attackRange + p.r - 3;
          if (e.pose !== 'idle') setPose(e, 'idle', 1);
          if (!e.token && !e.elite) { holdRing(g, e, d, ang, dt); break; }
          { const sprint = d > 40 ? 1 + 0.35 * g.brutality() : 1; if (d > stop) steer(g, e, p.x, p.y, e.speed * sprint, !los); }
          if (d < e.attackRange + p.r + 3 && e.attackCd <= 0 && los) {
            // brutal AI waits for the player's recovery frames (after a whiffed heavy) or the end of a dash to strike
            const brt = g.brutality();
            const pl = g.player;
            const opening = pl.attackPhase === 'recover' || pl.dashT > 0 || pl.stunT > 0 || pl.airborne;
            if (brt > 0.45 && !opening && Math.random() < 0.5 * brt && e.stateT <= 0) { e.stateT = 0.12; break; } // short hesitation, waiting for an opening
            const wu = def.windup * e.wMul * 0.88; e.state = 'windup'; e.stateT = wu; setPose(e, 'windup', wu); e.hitDone = false; e.burst = 0;
          }
          break;
        }
        case 'windup': {
          e.stateT -= dt;
          e.aim = lerpAngle(e.aim, ang, dt * (e.kind === 'brute' ? 2.5 : 6));
          if (e.stateT <= 0) {
            e.state = 'attack'; e.stateT = 0.16;
            setPose(e, e.kind === 'brute' ? 'palm' : e.kind === 'shield' ? 'palm' : e.burst % 2 ? 'kick' : 'punch', 0.18);
            const lunge = e.kind === 'brute' ? 40 : e.kind === 'monk' ? 110 : 80;
            e.kx += Math.cos(e.aim) * lunge; e.ky += Math.sin(e.aim) * lunge;
            if (e.kind === 'brute') { g.sfx.slam(); g.shake(0.35); g.particles.shockwave(e.x, e.y + 2, e.attackRange + 6, '#ffffff', 0.25); g.particles.smoke(e.x + Math.cos(e.aim) * 10, e.y + Math.sin(e.aim) * 10, 6, '#555'); }
            else g.sfx.whoosh();
          }
          break;
        }
        case 'attack': {
          e.stateT -= dt;
          if (!e.hitDone && e.poseT > 0.3) {
            e.hitDone = true;
            g.enemyMeleeHit(e, e.dmg, e.attackRange + 5, e.kind === 'brute' ? 1.4 : 1.0, e.kind === 'brute' || e.kind === 'shield');
          }
          if (e.stateT <= 0) {
            if (e.kind === 'monk' && e.burst < 2 && d < 40) {
              e.burst++; e.state = 'windup'; e.stateT = 0.2; setPose(e, 'windup', 0.2); e.hitDone = false;
            } else {
              e.burst = 0; e.state = 'recover'; e.stateT = def.recover; setPose(e, 'idle', 1); e.attackCd = def.cd * e.cdMul;
              g.releaseToken(e);
            }
          }
          break;
        }
        default: {
          e.stateT -= dt; e.aim = ang;
          if (e.stateT <= 0) e.state = 'chase';
        }
      }
      break;
    }
    case 'knife': {
      switch (e.state) {
        case 'chase': {
          e.aim = ang;
          if (e.pose !== 'idle') setPose(e, 'idle', 1);
          if (!e.token && !e.elite) { holdRing(g, e, d, ang, dt); break; }
          if (d > 40) steer(g, e, p.x, p.y, e.speed, !los); else strafe(g, e, ang, dt, e.speed * 0.6);
          if (d < 60 && e.attackCd <= 0 && los) { const wu = def.windup * e.wMul; e.state = 'windup'; e.stateT = wu; setPose(e, 'windup', wu); }
          break;
        }
        case 'windup': {
          e.stateT -= dt; e.aim = lerpAngle(e.aim, ang, dt * 8);
          if (e.stateT <= 0) {
            e.state = 'lunge'; e.stateT = 0.22; setPose(e, 'charge', 0.22); e.hitDone = false;
            e.chargeDir = e.aim;
            g.sfx.whoosh();
          }
          break;
        }
        case 'lunge': {
          e.stateT -= dt;
          e.vx = Math.cos(e.chargeDir) * 260; e.vy = Math.sin(e.chargeDir) * 260; e.moving = true; e.aim = e.chargeDir;
          g.addAfterimage(e);
          if (!e.hitDone && d < e.r + p.r + 5) { e.hitDone = true; g.enemyMeleeHit(e, e.dmg, 14, 3.2, false); }
          if (e.stateT <= 0) { e.state = 'recover'; e.stateT = def.recover; setPose(e, 'idle', 1); e.attackCd = def.cd * e.cdMul; g.releaseToken(e); }
          break;
        }
        default: {
          e.stateT -= dt; e.aim = ang;
          if (e.stateT <= 0) e.state = 'chase';
        }
      }
      break;
    }
    case 'gunner': case 'rifleman': case 'sniper': case 'smg': case 'shotgun': {
      const maxD = def.maxD;
      switch (e.state) {
        case 'chase': {
          e.aim = ang;
          rangedPosition(g, e, d, ang, dt, los);
          if (e.pose !== (e.reload > 0 ? 'reload' : 'idle')) setPose(e, e.reload > 0 ? 'reload' : 'idle', 1);
          if (e.ammo <= 0 && e.reload <= 0) { e.reload = def.reload; g.texts.add(e.x, e.y - 18, 'RELOAD', '#aaaaaa', 1, 0.5); }
          if (los && d < maxD + 40 && e.attackCd <= 0 && e.ammo > 0 && e.reload <= 0) {
            e.stuckT += dt;
            if (friendlyInLine(g, e, ang, d) && e.stuckT < 1.5) {
              // an ally is in the line of fire: move to a spot with a clear shot instead of shooting through him
              if (!e.repos) {
                const spot = findFiringSpot(g, e, e.wantDist);
                if (spot) { e.repos = spot; e.reposT = 1.0; }
                else { const sa = ang + (Math.PI / 2) * e.strafeDir; e.repos = { x: e.x + Math.cos(sa) * 30, y: e.y + Math.sin(sa) * 30 }; e.reposT = 0.6; }
              }
            } else {
              const wu = def.windup * (e.kind === 'sniper' ? 1 : e.wMul);
              e.state = 'windup'; e.stateT = wu; setPose(e, 'shoot', wu); e.aimLine = wu; e.stuckT = 0;
            }
          }
          break;
        }
        case 'windup': {
          e.stateT -= dt;
          if (!(e.kind === 'sniper' && e.stateT < 0.3)) e.aim = lerpAngle(e.aim, ang, dt * 10);
          if (e.stateT <= 0) {
            e.ammo--;
            switch (e.kind) {
              case 'gunner': {
                const sp = 170 + Math.min(110, g.levelN * 0.55);
                g.fireEnemyBullet(e, leadAngle(g, e, sp) + rnd(-0.05, 0.05) * (1 - g.brutality() * 0.6), sp, e.dmg, 'enemy', '#ff5e5e');
                e.state = 'recover'; e.stateT = def.recover; e.attackCd = def.cd * e.cdMul;
                break;
              }
              case 'rifleman':
                e.state = 'burst'; e.burst = 3 + (g.levelN > 100 ? 1 : 0); e.stateT = 0; e.lastDist = 0.1;
                break;
              case 'smg':
                e.state = 'burst'; e.burst = 6 + (g.levelN > 80 ? 2 : 0); e.stateT = 0; e.lastDist = 0.06;
                break;
              case 'shotgun': {
                const n = 5;
                for (let i = 0; i < n; i++) g.fireEnemyBullet(e, e.aim + (i - 2) * 0.16 + rnd(-0.04, 0.04), 200 + rnd(-30, 30), e.dmg, 'enemy', '#ffb8b8');
                g.sfx.sniper(); g.shake(0.25);
                e.kx -= Math.cos(e.aim) * 90; e.ky -= Math.sin(e.aim) * 90;
                e.state = 'recover'; e.stateT = def.recover; e.attackCd = def.cd * e.cdMul;
                break;
              }
              case 'sniper':
                g.fireEnemyBullet(e, e.aim, 480, e.dmg, 'sniper', '#ffffff');
                g.sfx.sniper(); g.shake(0.2);
                e.state = 'recover'; e.stateT = def.recover; e.attackCd = def.cd * e.cdMul;
                break;
            }
          }
          break;
        }
        case 'burst': {
          e.stateT -= dt;
          if (e.kind === 'smg') e.aim = lerpAngle(e.aim, ang, dt * 3);
          if (e.stateT <= 0 && e.burst > 0) {
            if (e.kind === 'smg') g.fireEnemyBullet(e, e.aim + rnd(-0.28, 0.28) * (1 - g.brutality() * 0.4), 230 + Math.min(80, g.levelN * 0.4), e.dmg, 'enemy', '#7fe3ff');
            else { const sp = 210 + Math.min(90, g.levelN * 0.45); g.fireEnemyBullet(e, (g.brutality() > 0.3 ? leadAngle(g, e, sp) : e.aim) + rnd(-0.12, 0.12) * (1 - g.brutality() * 0.5), sp, e.dmg, 'enemy', '#9dffb5'); }
            e.burst--; e.stateT = e.lastDist;
          }
          if (e.burst <= 0) { e.state = 'recover'; e.stateT = def.recover; e.attackCd = def.cd * e.cdMul; }
          break;
        }
        default: {
          e.stateT -= dt; e.aim = ang;
          // after shooting: relocate so the player can't just hold an angle
          if (!e.repos && Math.random() < 0.5) {
            const sa = ang + (Math.PI / 2) * e.strafeDir;
            const rx = e.x + Math.cos(sa) * 28, ry = e.y + Math.sin(sa) * 28;
            if (g.isFree(rx, ry, e.r)) { e.repos = { x: rx, y: ry }; e.reposT = 0.7; }
          }
          if (e.repos) moveTo(g, e, e.repos.x, e.repos.y, e.speed * 0.8); else strafe(g, e, ang, dt, e.speed * 0.6);
          setPose(e, 'idle', 1);
          if (e.stateT <= 0) e.state = 'chase';
        }
      }
      break;
    }
    case 'bomber': {
      e.aim = ang;
      if (e.state !== 'fuse') {
        const brt = g.brutality();
        const lurk = brt > 0.4 && d > 60 && d < 110 && p.attackPhase === 'none' && !p.airborne && Math.sin(g.time * 2 + e.id) > 0.2;
        if (lurk) strafe(g, e, ang, dt, e.speed * 0.6); else steer(g, e, p.x, p.y, e.speed * (1 + 0.3 * brt), !los);
        if (e.pose !== 'idle') setPose(e, 'idle', 1);
        if (d < 22) { e.state = 'fuse'; e.fuse = 0.55; g.sfx.beep(); setPose(e, 'throw', 0.55); }
      } else {
        if (Math.floor(e.fuse * 20) % 2 === 0) e.flash = 0.03;
      }
      break;
    }
    default:
      break;
  }
}

function aiBoss(g: Game, e: Enemy, dt: number, d: number, ang: number) {
  const p = g.player;
  const los = g.hasLOS(e);
  const enraged = e.hp < e.maxHp * 0.5;
  const kind = e.boss!;
  const finishRecover = (t: number, cd: number) => { e.state = 'recover'; e.stateT = t; e.attackCd = cd * e.cdMul * (enraged ? 0.7 : 1); setPose(e, 'idle', 1); };
  switch (kind) {
    case 'bull': {
      switch (e.state) {
        case 'chase': {
          e.aim = ang;
          if (d > e.attackRange + 4) steer(g, e, p.x, p.y, e.speed, !los);
          if (e.pose !== 'idle') setPose(e, 'idle', 1);
          if (e.attackCd <= 0 && los) {
            e.burst++;
            if (e.burst % 3 === 0 || d < 40) { e.state = 'slamwind'; e.stateT = 0.7; setPose(e, 'windup', 0.7); }
            else { e.state = 'chargewind'; e.stateT = 0.6; setPose(e, 'windup', 0.6); }
          }
          break;
        }
        case 'chargewind': {
          e.stateT -= dt; e.aim = lerpAngle(e.aim, ang, dt * 4);
          if (e.stateT <= 0) { e.state = 'charge'; e.stateT = 1.3; e.chargeDir = e.aim; e.hitDone = false; setPose(e, 'charge', 1); g.sfx.whoosh(); g.shake(0.2); }
          break;
        }
        case 'charge': {
          e.stateT -= dt;
          const sp = enraged ? 330 : 280;
          e.vx = Math.cos(e.chargeDir) * sp; e.vy = Math.sin(e.chargeDir) * sp; e.moving = true;
          e.aim = e.chargeDir;
          g.particles.smoke(e.x - Math.cos(e.chargeDir) * 8, e.y + 2, 1, '#666', 15, 0.4);
          g.addAfterimage(e);
          if (!e.hitDone && d < e.r + p.r + 4) { e.hitDone = true; g.enemyMeleeHit(e, e.dmg, e.r + 10, 3.2, true); }
          if (e.stateT <= 0) finishRecover(0.6, 1.6);
          break;
        }
        case 'slamwind': {
          e.stateT -= dt; e.aim = lerpAngle(e.aim, ang, dt * 3);
          if (e.stateT <= 0) {
            e.state = 'slam'; e.stateT = 0.3; setPose(e, 'palm', 0.3);
            g.sfx.slam(); g.shake(0.9); g.hitstop = Math.max(g.hitstop, 0.05);
            g.particles.smoke(e.x, e.y, 14, '#777', 40, 0.7);
            g.particles.burst(e.x, e.y, 16, '#aaaaaa', 120, 0.5, 2, 3);
            for (let i = 0; i < 3; i++) g.addHazard({ x: e.x, y: e.y, r: -i * 18, maxR: 70 + (enraged ? 30 : 0), life: 0.9 + i * 0.2, max: 0.9 + i * 0.2, kind: 'ring', dmg: 1 });
            g.enemyMeleeHit(e, e.dmg, 34, 3.2, true);
          }
          break;
        }
        case 'slam': { e.stateT -= dt; if (e.stateT <= 0) finishRecover(0.8, 1.8); break; }
        default: { e.stateT -= dt; e.aim = ang; if (e.stateT <= 0) e.state = 'chase'; }
      }
      break;
    }
    case 'queen': {
      if (e.hp < e.maxHp * 0.7 && e.summonCd <= 0 && e.state === 'chase') {
        e.summonCd = 15;
        for (let i = 0; i < 2; i++) { const pos = g.randomFloorNear(e.x, e.y, 30, 70); if (pos) g.spawnEnemyAt('gunner', pos.x, pos.y, false); }
        g.texts.add(e.x, e.y - 24, 'SUMMON!', '#ff3df2', 1);
      }
      switch (e.state) {
        case 'chase': {
          e.aim = ang;
          rangedPosition(g, e, d, ang, dt, los);
          if (e.pose !== 'idle') setPose(e, 'idle', 1);
          if (e.attackCd <= 0 && los) {
            e.burst++;
            const pat = e.burst % 3;
            if (pat === 0) { e.state = 'teleport'; e.stateT = 0.35; g.particles.smoke(e.x, e.y - 6, 10, '#c56cf0', 40, 0.5); g.sfx.dash(); }
            else if (pat === 1) { e.state = 'spiral'; e.stateT = 0; e.phase = ang; setPose(e, 'shoot', 1); e.hitDone = false; e.lastDist = enraged ? 20 : 14; }
            else { e.state = 'fan'; e.stateT = 0.3; e.lastDist = 3; setPose(e, 'shoot', 1); e.aimLine = 0.3; }
          }
          break;
        }
        case 'spiral': {
          e.stateT -= dt;
          e.aim = e.phase;
          if (e.stateT <= 0 && e.lastDist > 0) {
            g.fireEnemyBullet(e, e.phase, 150, 1, 'orb', '#ff3df2');
            if (enraged) g.fireEnemyBullet(e, e.phase + Math.PI, 150, 1, 'orb', '#ff3df2');
            e.phase += 0.55; e.lastDist--; e.stateT = 0.06;
          }
          if (e.lastDist <= 0) finishRecover(0.7, 1.5);
          break;
        }
        case 'fan': {
          e.stateT -= dt; e.aim = lerpAngle(e.aim, ang, dt * 6);
          if (e.stateT <= 0 && e.lastDist > 0) {
            for (let i = -2; i <= 2; i++) g.fireEnemyBullet(e, e.aim + i * 0.18, 190, 1, 'enemy', '#ff5e5e');
            e.lastDist--; e.stateT = 0.28;
          }
          if (e.lastDist <= 0) finishRecover(0.6, 1.4);
          break;
        }
        case 'teleport': {
          e.stateT -= dt;
          if (e.stateT <= 0) {
            const pos = g.randomFloorNear(p.x, p.y, 70, 130);
            if (pos) { e.x = pos.x; e.y = pos.y; }
            g.particles.burst(e.x, e.y - 6, 14, '#c56cf0', 90, 0.4);
            g.sfx.spawn();
            const n = enraged ? 16 : 12;
            for (let i = 0; i < n; i++) g.fireEnemyBullet(e, (i / n) * Math.PI * 2, 130, 1, 'orb', '#ff9ff3');
            finishRecover(0.8, 1.2);
          }
          break;
        }
        default: { e.stateT -= dt; e.aim = ang; strafe(g, e, ang, dt, e.speed * 0.5); if (e.stateT <= 0) e.state = 'chase'; }
      }
      break;
    }
    case 'shadow': {
      switch (e.state) {
        case 'chase': {
          e.aim = ang;
          if (d > 15) steer(g, e, p.x, p.y, e.speed, !los);
          if (e.pose !== 'idle') setPose(e, 'idle', 1);
          if (e.attackCd <= 0) {
            if (d > 80 && e.summonCd <= 0) {
              e.summonCd = enraged ? 3 : 5;
              const bx = p.x - Math.cos(p.aim) * 22, by = p.y - Math.sin(p.aim) * 22;
              g.particles.smoke(e.x, e.y - 6, 8, '#5a5a80', 40, 0.4);
              if (g.isFree(bx, by, e.r)) { e.x = bx; e.y = by; } else { const pos = g.randomFloorNear(p.x, p.y, 20, 40); if (pos) { e.x = pos.x; e.y = pos.y; } }
              g.particles.burst(e.x, e.y - 6, 10, '#ff2a2a', 80, 0.3);
              g.sfx.dash();
              g.texts.add(e.x, e.y - 22, '!', '#ff2a2a', 2, 0.4);
              e.state = 'windup'; e.stateT = 0.3; setPose(e, 'windup', 0.3); e.burst = 0;
            } else if (d < 26 && los) { e.state = 'windup'; e.stateT = 0.28; setPose(e, 'windup', 0.28); e.burst = 0; }
          }
          break;
        }
        case 'windup': {
          e.stateT -= dt; e.aim = lerpAngle(e.aim, ang, dt * 8);
          if (e.stateT <= 0) {
            e.state = 'attack'; e.stateT = 0.15; e.hitDone = false;
            setPose(e, e.burst % 2 ? 'kick' : 'punch', 0.16);
            e.kx += Math.cos(e.aim) * 140; e.ky += Math.sin(e.aim) * 140;
            g.sfx.whoosh();
          }
          break;
        }
        case 'attack': {
          e.stateT -= dt;
          if (!e.hitDone && e.poseT > 0.3) { e.hitDone = true; g.enemyMeleeHit(e, e.dmg, 20, 1.1, e.burst >= 3); }
          if (e.stateT <= 0) {
            const max = enraged ? 6 : 4;
            if (e.burst < max - 1 && d < 45) { e.burst++; e.state = 'windup'; e.stateT = 0.14; setPose(e, 'windup', 0.14); }
            else finishRecover(0.55, 1.1);
          }
          break;
        }
        default: { e.stateT -= dt; e.aim = ang; if (e.stateT <= 0) e.state = 'chase'; }
      }
      break;
    }
    case 'priest': {
      if (e.summonCd <= 0 && e.state === 'chase') {
        e.summonCd = enraged ? 8 : 11;
        for (let i = 0; i < 2; i++) { const pos = g.randomFloorNear(e.x, e.y, 24, 60); if (pos) g.spawnEnemyAt('bomber', pos.x, pos.y, false); }
        g.texts.add(e.x, e.y - 24, 'RISE!', '#ffa502', 1);
      }
      switch (e.state) {
        case 'chase': {
          e.aim = ang;
          rangedPosition(g, e, d, ang, dt, los);
          if (e.pose !== 'idle') setPose(e, 'idle', 1);
          if (e.attackCd <= 0 && los) { e.state = 'windup'; e.stateT = 0.5; setPose(e, 'throw', 0.5); e.burst++; }
          break;
        }
        case 'windup': {
          e.stateT -= dt; e.aim = lerpAngle(e.aim, ang, dt * 5);
          if (e.stateT <= 0) {
            const count = e.burst % 3 === 0 ? 3 : 1;
            for (let i = 0; i < count; i++) {
              const tx = p.x + (count > 1 ? rnd(-40, 40) : rnd(-8, 8)), ty = p.y + (count > 1 ? rnd(-40, 40) : rnd(-8, 8));
              g.throwBomb(e, tx, ty, e.dmg);
            }
            g.sfx.whoosh();
            finishRecover(0.5, 2.2);
          }
          break;
        }
        default: { e.stateT -= dt; e.aim = ang; strafe(g, e, ang, dt, e.speed * 0.5); if (e.stateT <= 0) e.state = 'chase'; }
      }
      break;
    }
    case 'dancer': {
      switch (e.state) {
        case 'chase': {
          e.aim = ang;
          if (d > 60) steer(g, e, p.x, p.y, e.speed, !los); else strafe(g, e, ang, dt, e.speed * 0.7);
          if (e.pose !== 'idle') setPose(e, 'idle', 1);
          if (e.attackCd <= 0 && d < 100 && los) { e.state = 'windup'; e.stateT = 0.3; setPose(e, 'windup', 0.3); e.burst = 0; }
          break;
        }
        case 'windup': {
          e.stateT -= dt; e.aim = lerpAngle(e.aim, ang, dt * 9);
          if (e.stateT <= 0) {
            e.state = 'lunge'; e.stateT = 0.2; setPose(e, 'charge', 0.2); e.hitDone = false;
            e.chargeDir = e.aim;
            g.sfx.whoosh();
          }
          break;
        }
        case 'lunge': {
          e.stateT -= dt;
          e.vx = Math.cos(e.chargeDir) * 400; e.vy = Math.sin(e.chargeDir) * 400; e.moving = true; e.aim = e.chargeDir;
          g.addAfterimage(e);
          if (!e.hitDone && d < e.r + p.r + 6) { e.hitDone = true; g.enemyMeleeHit(e, e.dmg, 16, 3.2, false); }
          if (e.stateT <= 0) {
            const max = enraged ? 5 : 3;
            if (e.burst < max - 1) { e.burst++; e.state = 'windup'; e.stateT = 0.16; setPose(e, 'windup', 0.16); }
            else finishRecover(0.7, 1.5);
          }
          break;
        }
        default: { e.stateT -= dt; e.aim = ang; if (e.stateT <= 0) e.state = 'chase'; }
      }
      break;
    }
  }
}

import { pcircle, pline, prect, px, type Ctx } from './pixel';
import { clamp, lerp } from './rng';
import type { Pose, Vec } from './types';

export interface StickOpts {
  x: number; y: number; c: string; c2: string; scale: number; facing: number; aim: number;
  walk: number; moving: boolean; pose: Pose; t: number; acc: string; weapon: string;
  flash: boolean; alpha: number; outline: string | null; eyes: string; time: number; lean: Vec;
  rot?: number; recoil?: number; trail?: string | null; z?: number; run?: number; squash?: number;
  blink?: boolean; mood?: 'normal' | 'angry' | 'hurt' | 'happy' | 'dead';
  /** chain punch: which fist is out this link (+1 front, -1 back) */
  chainSide?: number;
  /** limb that is striking this frame: drawn thicker/brighter so the impact reads */
  strike?: 'fhand' | 'bhand' | 'ffoot' | 'bfoot' | 'both' | null;
  /** 0..1 impact emphasis */
  impact?: number;
  /** actual movement direction in screen space (unit vector). Drives the gait; defaults to `lean`. */
  vel?: Vec;
  /** half step length in px (how far a foot lands ahead of the hip). From the game's cadence model. */
  stride?: number;
  /** where the eyes look (defaults to aim) */
  look?: number;
}

export interface Skeleton {
  hip: Vec; neck: Vec; head: Vec; ffoot: Vec; bfoot: Vec; fhand: Vec; bhand: Vec;
  fknee: Vec | null; bknee: Vec | null; felbow: Vec | null; belbow: Vec | null;
  trail: { cx: number; cy: number; rx: number; ry: number; from: number; to: number } | null;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const cl01 = (t: number) => clamp(t, 0, 1);

/** Anticipation (pull back) -> snap out with overshoot -> settle -> recover. t in 0..1 */
export function strikeK(t: number) {
  // anticipation: smooth pull-back  | snap: 3 frames to full extension with a small overshoot | hold: the contact
  // frame stays extended (readable impact) | recover: ease back to guard
  if (t < 0.3) return -0.4 * easeInOut(t / 0.3);
  if (t < 0.36) return lerp(-0.4, 1.12, easeOut((t - 0.3) / 0.06));
  if (t < 0.6) return lerp(1.12, 1.0, cl01((t - 0.36) / 0.08));
  return lerp(1, 0, easeInOut(cl01((t - 0.6) / 0.4)));
}

function parc(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, from: number, to: number, c: string, w = 1) {
  const n = Math.max(4, Math.ceil(Math.abs(to - from) * Math.max(rx, ry) * 1.2));
  ctx.fillStyle = c;
  let lx = 1e9, ly = 1e9;
  const o = w > 1 ? 1 : 0;
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    if (x === lx && y === ly) continue;
    lx = x; ly = y;
    ctx.fillRect(x - o, y - o, w, w);
  }
}

function halfCircle(ctx: Ctx, cx: number, cy: number, r: number, c: string, top: boolean) {
  cx = Math.round(cx); cy = Math.round(cy);
  ctx.fillStyle = c;
  const rr = r * r + r * 0.6;
  const ri = Math.ceil(r);
  for (let dy = -ri; dy <= ri; dy++) {
    if (top ? dy > -1 : dy < 1) continue;
    const v = rr - dy * dy;
    if (v < 0) continue;
    const dx = Math.floor(Math.sqrt(v));
    ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}

const mix = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const mixN = (a: Vec | null, b: Vec | null, t: number): Vec | null => (a && b ? mix(a, b, t) : t < 0.5 ? a : b);

export function blendSkeleton(a: Skeleton, b: Skeleton, t: number): Skeleton {
  return {
    hip: mix(a.hip, b.hip, t), neck: mix(a.neck, b.neck, t), head: mix(a.head, b.head, t), ffoot: mix(a.ffoot, b.ffoot, t), bfoot: mix(a.bfoot, b.bfoot, t),
    fhand: mix(a.fhand, b.fhand, t), bhand: mix(a.bhand, b.bhand, t), fknee: mixN(a.fknee, b.fknee, t), bknee: mixN(a.bknee, b.bknee, t),
    felbow: mixN(a.felbow, b.felbow, t), belbow: mixN(a.belbow, b.belbow, t), trail: t < 0.5 ? a.trail : b.trail,
  };
}

/** Two-bone IK: joint position for a limb from a to b, bending toward side `bend` (+1/-1), total length len */
function bendJoint(a: Vec, b: Vec, len: number, bend: number, upBias = 0): Vec | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.5) return null;
  const half = len / 2;
  const h = Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2)));
  if (h < 0.7) return null;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const nx = -dy / d, ny = dx / d;
  return { x: mx + nx * h * bend, y: my + ny * h * bend - upBias };
}

/** Solve a full-body pose into joint positions (relative to the feet origin). Pure function of the options. */
export function solvePose(o: StickOpts): Skeleton {
  const s = o.scale, f = o.facing, t = o.t;
  const dx = Math.cos(o.aim), dy = Math.sin(o.aim);
  const pxp = -dy, pyp = dx;
  const quick = Math.min(1, t * 3);
  const run = o.run ?? 0;
  const V = (x: number, y: number): Vec => ({ x, y });
  const add = (a: Vec, ...rest: Vec[]): Vec => { let x = a.x, y = a.y; for (const r of rest) { x += r.x; y += r.y; } return { x, y }; };
  const D = (len: number, up = 0): Vec => V(dx * len * s, dy * len * s * 0.6 - up * s);
  const P = (len: number): Vec => V(pxp * len * s, pyp * len * s * 0.6);
  const L = (len: number): Vec => V(o.lean.x * len * s, o.lean.y * len * s * 0.6);
  let hip = V(0, -4 * s), neck = V(0, -8 * s), head = V(0, -11 * s);
  let ffoot = V(2 * s * f, 0), bfoot = V(-2 * s * f, 0);
  let fhand = add(neck, D(3.5), V(0, 1.2 * s)), bhand = add(neck, D(-1.5), V(0, 2 * s));
  let trail: Skeleton['trail'] = null;
  let fkneeBend = f, bkneeBend = f;
  let kneeUp = 0;
  let kneeDir: Vec | null = null; // when set, knees bend toward this screen direction instead of the facing side
  const lean = (fw: number, up: number) => {
    const v = D(fw, up);
    neck = add(neck, v); head = add(head, V(v.x * 1.4, v.y * 1.2)); hip = add(hip, V(v.x * 0.3, v.y * 0.3));
  };
  const k = strikeK(t), kp = Math.max(0, k), kk = cl01((k + 0.4) / 1.4);
  const ch = Math.max(0, -k) / 0.4; // 0..1 wind-up (chamber) amount during the anticipation
  // --- fighting stance helpers ---------------------------------------------------------------
  // stance(w): feet in a staggered fighting stance along the aim (front foot ahead), weight shifted by w (-1 back .. +1 front)
  const stance = (w: number, width = 1) => {
    ffoot = add(D(2.2 * width + 1.2 * w), P(1.3 * f)); bfoot = add(D(-2.2 * width + 1.2 * w), P(-1.3 * f));
    const hs = D(0.9 * w); hip = add(hip, hs); neck = add(neck, V(hs.x * 1.3, hs.y * 1.3)); head = add(head, V(hs.x * 1.5, hs.y * 1.5));
  };
  // twist(r): rotate the shoulders around the hip axis (r>0 = front shoulder forward), what drives real punches
  const twist = (r: number) => { neck = add(neck, D(0.7 * r), P(-0.9 * f * r)); head = add(head, D(0.9 * r), P(-0.6 * f * r)); };
  // guard: the non-striking hand protects the chin
  const guardHand = (): Vec => add(neck, D(1.2), V(0, 0.8 * s), P(-1.2 * f));
  // chamber (0..1): pull a hand back to the hip/ribs before a strike
  const strikePhase = { anticip: cl01(t / 0.3), snap: cl01((t - 0.3) / 0.1), settle: cl01((t - 0.4) / 0.2), recover: cl01((t - 0.6) / 0.4) };
  void strikePhase;

  // ---------------- locomotion: a real 4-phase run cycle (contact, down, passing, up) -----------------
  const walkingPose = o.pose === 'idle' || o.pose === 'run' || o.pose === 'shoot' || o.pose === 'charge' || o.pose === 'reload' || o.pose === 'n_idle' || o.pose === 'k_idle';
  if (o.moving && walkingPose) {
    // ---- WORLD-SPACE GAIT ----
    // `o.vel` is the body's movement direction (unit vector, screen space). Feet are placed directly along it:
    //   stance phase: the foot is PLANTED, i.e. it stays still in the world -> moves backwards relative to the body
    //   swing phase : the foot flies forward along the movement direction on a parabola and lands ahead of the body
    // The phase advances with ground speed (game.ts) so a planted foot never slides. Works for any direction and
    // independently of which way the character faces (facing only decides which leg is drawn in front).
    const mv = o.vel && (Math.abs(o.vel.x) > 1e-3 || Math.abs(o.vel.y) > 1e-3) ? o.vel : o.lean;
    const ml = Math.hypot(mv.x, mv.y) || 1;
    const ux = mv.x / ml, uy = mv.y / ml; // forward (screen space)
    const sx = -uy, sy = ux; // sideways (screen space)
    const fwd = (a: number): Vec => V(ux * a * s, uy * a * s);
    const side = (a: number): Vec => V(sx * a * s, sy * a * s);
    const stride = (o.stride ?? (2.6 + 2.6 * run) * s) / s; // half step length in body units
    const lift = (1.6 + 2.4 * run) * s;
    const legPhase = (p: number) => {
      // q in [-PI, PI): q = -PI/2 toe-off (foot furthest BACK), q = +PI/2 heel strike (foot furthest FORWARD).
      // cos(q) > 0  -> swing (foot moving forward, airborne). cos(q) < 0 -> stance (planted, moving back).
      const q = (((p + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const along = Math.sin(q) * stride; // forward offset (body units)
      let air = 0;
      if (Math.cos(q) > 0) {
        const frac = (q + Math.PI / 2) / Math.PI; // 0 at toe-off .. 1 at contact
        air = Math.sin(frac * Math.PI); // bell curve, zero at both ends
      }
      return { along, air };
    };
    const fl = legPhase(o.walk), bl = legPhase(o.walk + Math.PI);
    // "front" leg = the one drawn nearer the camera; give each leg a small lateral offset so they don't overlap
    ffoot = add(fwd(fl.along), side(0.7 * f), V(0, -fl.air * lift));
    bfoot = add(fwd(bl.along), side(-0.7 * f), V(0, -bl.air * lift));
    // the knee bends toward the movement direction (not toward the facing)
    kneeDir = { x: ux, y: uy };
    kneeUp = (0.6 + 1.6 * run) * s * Math.max(fl.air, bl.air);
    // body: lowest at foot contact, highest while the legs pass each other
    const pass = 1 - Math.abs(Math.sin(o.walk));
    const bounce = pass * (0.7 + 1.1 * run) * s;
    hip = add(hip, V(0, -bounce));
    // forward lean: full along the screen x, damped vertically (running toward/away from the camera reads as a
    // slight crouch rather than a tilt). Never lets the torso lean *against* the travel direction.
    const lv = fwd(1.2 + 2.8 * run);
    hip = add(hip, V(lv.x * 0.45, lv.y * 0.45 * 0.35));
    neck = add(neck, V(lv.x, lv.y * 0.35), V(0, -bounce * 1.1));
    // shoulders counter-rotate against the hips
    const twist = Math.sin(o.walk) * (0.35 + 0.65 * run);
    neck = add(neck, side(-twist * 0.6));
    head = add(head, V(lv.x * 1.35, lv.y * 1.35 * 0.35), V(0, -bounce * 1.15), side(-twist * 0.35));
    if (o.pose !== 'shoot' && o.pose !== 'reload' && o.pose !== 'k_idle' && o.pose !== 'n_idle') {
      // arms swing OPPOSITE to the leg on the same side, elbows bent, hands at chest height when sprinting
      const amp = 1.6 + 2.6 * run;
      const hy = (2.2 - 2.0 * run) * s;
      const fa = -fl.along / stride, ba = -bl.along / stride;
      fhand = add(neck, fwd(fa * amp), V(0, hy - Math.max(0, fa) * 1.2 * run * s), side(0.8 * f));
      bhand = add(neck, fwd(ba * amp), V(0, hy - Math.max(0, ba) * 1.2 * run * s), side(-0.8 * f));
    }
  } else if (o.pose === 'idle') {
    const br = Math.sin(o.time * 4) * 0.4 * s;
    neck.y += br; head.y += br;
    fhand = add(neck, D(3.2), V(0, (1.2 + br * 0.3) * s)); bhand = add(neck, D(0.6), V(0, 1.4 * s), P(-1.2 * f));
    ffoot = V(2.4 * s * f, 0); bfoot = V(-2 * s * f, 0);
  }

  switch (o.pose) {
    // ================= HAND STRIKES ============================================================
    // every strike: CHAMBER (ch 0->1: coil back, weight on the rear leg) -> SNAP (kp: full extension with step-in,
    // hips/shoulders rotate, head slips) -> HOLD at contact -> RECOVER to guard
    case 'jab': {
      stance(-0.5 * ch + 0.9 * kp);
      twist(-0.4 * ch + 0.7 * kp);
      fhand = add(neck, D(1.2 - 2.2 * ch + 9.0 * kp, 1.1), P(-0.3 * f * kp));
      bhand = guardHand();
      lean(-0.4 * ch + 1.6 * kp, 0.3 * kp);
      break;
    }
    case 'cross': case 'punch': {
      stance(-0.6 * ch + 1.0 * kp, 1.1);
      twist(-0.6 * ch + 1.6 * kk);
      bhand = add(neck, D(-1.8 - 1.6 * ch + 11.5 * kk, 1.0), P(0.9 * f * (1 - kk)));
      fhand = add(neck, D(0.6 + 0.6 * kk), V(0, 1.0 * s), P(-1.3 * f));
      bfoot = add(bfoot, P(1.0 * f * kk), D(0.8 * kk));
      head = add(head, P(0.6 * f * kk), D(0.4 * kk));
      lean(-0.5 * ch + 2.2 * kk, 0.4 * kk);
      break;
    }
    case 'hook': {
      stance(-0.3 * ch + 0.5 * kp, 1.1);
      const a0 = o.aim + f * 2.3, a = o.aim + f * (2.3 + 0.5 * ch - 2.8 * kk);
      const r = (4.5 + 2.5 * kk) * s;
      twist(-0.5 * ch + 1.6 * kk);
      bhand = add(neck, V(Math.cos(a) * r, Math.sin(a) * r * 0.6), V(0, 0.3 * s));
      fhand = guardHand();
      bfoot = add(bfoot, P(1.2 * f * kk));
      head = add(head, P(-0.5 * f * kk), D(0.4 * kk));
      lean(0.8 * kk, 0.2 * kk);
      if (t >= 0.28 && t <= 0.6) trail = { cx: neck.x, cy: neck.y + 0.3 * s, rx: r * 1.15, ry: r * 0.7, from: a0, to: a };
      break;
    }
    case 'elbow': {
      stance(-0.4 * ch + 1.1 * kp, 1.0);
      const a0 = o.aim + f * 1.6, a = o.aim + f * (1.6 + 0.5 * ch - 2.2 * kk);
      const r = 4.6 * s;
      twist(-0.5 * ch + 1.8 * kk);
      bhand = add(neck, V(Math.cos(a) * r, Math.sin(a) * r * 0.6), V(0, -0.4 * s));
      fhand = add(neck, D(2.2), V(0, 2.2 * s));
      lean(-0.4 * ch + 1.6 * kk, 0.4 * kk);
      if (t >= 0.28 && t <= 0.6) trail = { cx: neck.x, cy: neck.y - 0.2 * s, rx: r * 1.3, ry: r * 0.8, from: a0, to: a };
      break;
    }
    case 'palm': {
      // double palm from a rooted horse stance: sink + pull both hands to the ribs, then drive from the legs
      const sink = ch * 0.8 + (t >= 0.3 && t < 0.5 ? (1 - (t - 0.3) / 0.2) * 0.3 : 0);
      stance(-0.3 * ch + 1.1 * kp, 1.5);
      hip.y += 2.0 * s * sink; neck.y += 1.8 * s * sink; head.y += 1.6 * s * sink;
      const c = add(neck, D(-1.0 - 1.4 * ch + 9.0 * kp, 0.6));
      fhand = add(c, P(1.5 * f)); bhand = add(c, P(-1.5 * f));
      lean(-0.6 * ch + 2.0 * kp, 0.6 * kp);
      break;
    }
    case 'uppercut': {
      // dragon uppercut: drop the rear shoulder low, drive up from the legs, whole body extends upward
      const dip = ch, rise = kk;
      stance(0.3 + 0.4 * rise, 1.1);
      hip.y += 3.0 * s * dip - 1.8 * s * rise; neck.y += 3.2 * s * dip - 2.6 * s * rise; head.y += 3.2 * s * dip - 3.0 * s * rise;
      twist(-0.6 * dip + 1.4 * rise);
      bhand = add(neck, D(0.5 - 1.5 * dip + 4.0 * rise), V(0, (5.5 - 14.5 * rise) * s));
      fhand = add(neck, D(0.5), V(0, 1.2 * s), P(-1.2 * f));
      bfoot = add(bfoot, V(0, -3.5 * s * rise)); kneeUp = 1.8 * s * rise;
      lean(-0.6 * dip + 1.0 * rise, 0);
      break;
    }
    // ================= BLACK LEG (Sanji-style) kick flow: hands in pockets, all legs ====================
    case 's_collier': case 's_epaule': case 's_cotelette': {
      // targeted kicks at neck (collier) / shoulder (epaule) / ribs (cotelette): chamber, snap out, body leans away
      const h = o.pose === 's_collier' ? 10 : o.pose === 's_epaule' ? 8 : 5.5;
      const useBack = o.pose === 's_cotelette';
      const chm = cl01(t / 0.3), ext = kk;
      const foot = add(hip, D(1.5 + 6.5 * ext), V(0, (3.5 - 3.5 * chm - (h - 3.5) * ext) * s));
      if (useBack) { bfoot = foot; ffoot = V(1.5 * s * f, 0); bkneeBend = f; } else { ffoot = foot; bfoot = V(-1.5 * s * f, 0); fkneeBend = f; }
      kneeUp = 2.4 * s * chm * (1 - ext * 0.6);
      lean(-1.2 * ext, 0.2); hip.y -= 0.4 * s * ext;
      fhand = add(hip, D(-0.6), V(0, -0.8 * s), P(1.4 * f)); bhand = add(hip, D(-0.8), V(0, -0.8 * s), P(-1.4 * f)); // hands in pockets
      head = add(head, D(-0.5 * ext));
      if (t >= 0.3 && t <= 0.6) trail = { cx: hip.x, cy: hip.y, rx: 8 * s, ry: 6 * s, from: Math.PI / 2 - f * 0.2, to: f > 0 ? -0.3 : Math.PI + 0.3 };
      break;
    }
    case 's_antimanner': {
      // anti-manner kick course: a spinning overhead heel that drops onto the shoulder
      const sp = cl01((t - 0.15) / 0.35);
      const a = -Math.PI / 2 + f * (sp * Math.PI * 1.1 - 0.6);
      const r = (6 + 3 * Math.sin(sp * Math.PI)) * s;
      ffoot = add(hip, V(Math.cos(a) * r, Math.sin(a) * r)); fkneeBend = -f;
      bfoot = V(-1.2 * s * f, 0);
      hip.y -= 1.2 * s * Math.sin(sp * Math.PI); neck.y -= 1.2 * s * Math.sin(sp * Math.PI); head.y -= 1.2 * s * Math.sin(sp * Math.PI);
      lean(-0.8 + 1.6 * sp, 0.4);
      fhand = add(hip, D(-0.6), V(0, -0.8 * s), P(1.4 * f)); bhand = add(hip, D(-0.8), V(0, -0.8 * s), P(-1.4 * f));
      if (sp > 0.1 && sp < 0.95) trail = { cx: hip.x, cy: hip.y, rx: r * 1.05, ry: r * 1.05, from: -Math.PI / 2 - f * 0.6, to: a };
      break;
    }
    case 's_mouton': {
      // mouton shot: a huge roundhouse at the end of a run-up; whole body rotates into it, kick finishes high
      const chm = cl01(t / 0.3), ext = kk, thru = cl01((t - 0.6) / 0.4);
      const a0 = o.aim + f * 2.4, a = o.aim + f * (2.4 - 3.1 * ext - 0.4 * thru);
      const len = (3.5 + 7.5 * ext) * s, h = (4 + 1.5 * ext) * s;
      ffoot = add(hip, V(Math.cos(a) * len, Math.sin(a) * len * 0.6 - h * chm)); fkneeBend = f; kneeUp = 2.5 * s * chm * (1 - ext * 0.7);
      bfoot = add(V(0, 0), D(-1.6), P(1.2 * f * ext));
      lean(-1.4 * ext, 0.2); neck = add(neck, P(f * 1.6 * ext)); head = add(head, P(f * 1.8 * ext));
      fhand = add(hip, D(-0.6), V(0, -0.8 * s), P(1.4 * f)); bhand = add(neck, P(-f * 3 * ext), D(-0.6), V(0, 1 * s));
      if (t >= 0.28 && t <= 0.65) trail = { cx: hip.x, cy: hip.y - h * 0.5, rx: len * 1.1, ry: len * 0.66, from: a0, to: a };
      break;
    }
    case 's_concasse': {
      // concasse: jump, then a crushing heel drop straight down
      const up = t < 0.3 ? easeOut(t / 0.3) : Math.max(0, 1 - (t - 0.3) / 0.12);
      const dn = t >= 0.3 ? cl01((t - 0.3) / 0.12) : 0;
      ffoot = add(hip, D(1.5 + 3.5 * dn + 1.0 * up), V(0, (-9 * up + 4 * dn) * s)); fkneeBend = -f; kneeUp = 0.6 * s * up;
      bfoot = add(hip, D(-1.5), V(0, (4 - 2 * up) * s));
      lean(-0.8 * up + 2 * dn, 0.6 * up - 0.8 * dn); hip.y += 1.4 * s * dn;
      fhand = add(hip, D(-0.6), V(0, -0.8 * s), P(1.4 * f)); bhand = add(hip, D(-0.8), V(0, -0.8 * s), P(-1.4 * f));
      if (t >= 0.28 && t <= 0.46) trail = { cx: hip.x, cy: hip.y, rx: 9.5 * s, ry: 9.5 * s, from: -Math.PI / 2 + (f > 0 ? 0.3 : -0.3), to: f > 0 ? 0.3 : Math.PI - 0.3 };
      break;
    }
    case 's_partyTable': {
      // party table kick course: handstand-free version: spinning on one leg with the other extended, 2 turns
      const a = o.aim + f * t * Math.PI * 4;
      const r = 9 * s;
      hip.y -= 1.0 * s; neck.y -= 1.0 * s; head.y -= 1.0 * s;
      ffoot = add(hip, V(Math.cos(a) * r, Math.sin(a) * r * 0.6 - 3 * s)); fkneeBend = -f;
      bfoot = V(0.4 * s * f, 0);
      fhand = add(neck, V(Math.cos(a + Math.PI) * 2.5 * s, Math.sin(a + Math.PI) * 1.5 * s), V(0, 0.5 * s)); bhand = add(neck, V(Math.cos(a) * 2 * s, Math.sin(a) * 1.2 * s), V(0, -1 * s));
      if (t > 0.15 && t < 0.85) trail = { cx: hip.x, cy: hip.y - 3 * s, rx: r * 1.1, ry: r * 0.66, from: a - 1.6 * f, to: a };
      break;
    }
    case 's_diable': {
      // diable jambe: spin to heat the leg (0-0.3), then the flaming flying kick with full extension
      const spinup = cl01(t / 0.3), ext = kk;
      const c = V(0, -2 * s * ext);
      hip = add(hip, c); neck = add(neck, c); head = add(head, c);
      const spin = o.aim + f * spinup * Math.PI * 2;
      if (t < 0.3) { ffoot = add(hip, V(Math.cos(spin) * 7 * s, Math.sin(spin) * 4 * s - 2 * s)); }
      else ffoot = add(hip, D(2 + 9 * ext), V(0, -1.5 * s));
      fkneeBend = -f;
      bfoot = add(hip, D(-1.5), V(0, (4 - 1.5 * ext) * s));
      lean(-0.5 * spinup + 2.5 * ext, 0.8 * ext);
      fhand = add(neck, D(-2.5 * ext), V(0, 1.5 * s), P(1.4 * f)); bhand = add(neck, D(-3 * ext), V(0, -1 * s), P(-1.4 * f));
      if (t >= 0.3 && t <= 0.62) trail = { cx: hip.x, cy: hip.y - 1.5 * s, rx: 10 * s, ry: 6 * s, from: o.aim + f * 1.2, to: o.aim };
      break;
    }
    // ================= KUNG FU heavy additions ======================================================
    case 'k_ironpalm': {
      // iron palm: deep sink, palm drives up-and-forward from the hip with the whole body
      const sink = ch;
      stance(-0.5 * sink + 1.2 * kp, 1.4);
      hip.y += 2.0 * s * sink; neck.y += 1.8 * s * sink; head.y += 1.6 * s * sink;
      fhand = add(neck, D(-1.0 * sink + 1.0 + 8.0 * kp, 0.6), V(0, (3.5 * sink) * s), P(0.6 * f));
      bhand = add(neck, D(-1.0), V(0, 0.6 * s), P(-1.4 * f));
      twist(-0.6 * sink + 1.6 * kp); lean(-0.4 * sink + 2.2 * kp, 0.5 * kp);
      break;
    }
    case 'k_hammerfist': {
      // hammer fist: raise the rear fist high behind the head, bring it down like a mallet
      const up = t < 0.3 ? easeOut(t / 0.3) : Math.max(0, 1 - (t - 0.3) / 0.1);
      const dn = t >= 0.3 ? cl01((t - 0.3) / 0.1) : 0;
      stance(-0.3 * up + 1.1 * dn, 1.3);
      bhand = add(neck, D(-2.0 * up + 6.0 * dn), V(0, (-7 * up + 2.5 * dn) * s));
      fhand = add(neck, D(2.0), V(0, 1.2 * s), P(-1.2 * f));
      twist(-0.8 * up + 1.6 * dn); lean(-1.0 * up + 2.4 * dn, 0.6 * up - 0.8 * dn);
      hip.y += 1.4 * s * dn;
      break;
    }
    case 'chainpunch': {
      // WING CHUN lin wan kuen: fists cycle on the centreline, elbows tucked, short square stance, little body motion.
      // o.t here encodes: fraction 0..1 of the current punch; the striking fist is 'fhand' (alternation is handled by
      // swapping which hand is 'front' in the game via chainSide -> we animate front hand out, back hand chambered at the chest)
      const out = t < 0.3 ? easeOut(t / 0.3) : 1 - cl01((t - 0.3) / 0.7) * 0.85;
      stance(0.4, 0.9); hip.y += 0.5 * s;
      const front = add(neck, D(1.5 + 6.5 * out, 0.9)); // vertical fist on the centreline
      const wait = add(neck, D(1.5 + 2.5 * (1 - out), 0.6), V(0, 0.8 * s)); // the other fist waits right behind it on the same line
      if ((o.chainSide ?? 1) < 0) { bhand = front; fhand = wait; } else { fhand = front; bhand = wait; }
      twist(0.35 * out - 0.1);
      lean(0.8 + 0.4 * out, 0.3);
      head = add(head, D(0.3 * out));
      break;
    }
    case 'chainfinish': {
      // the finishing blow: sink, then a full-body straight blast with both palms (jik chung) + step through
      const sink = ch;
      stance(-0.4 * sink + 1.2 * kp, 1.3);
      hip.y += 1.5 * s * sink; neck.y += 1.2 * s * sink; head.y += 1.0 * s * sink;
      const c = add(neck, D(0.5 - 1.6 * sink + 9.5 * kp, 0.6));
      fhand = add(c, P(1.0 * f)); bhand = add(c, P(-1.0 * f));
      twist(1.2 * kp); lean(-0.5 * sink + 2.6 * kp, 0.6 * kp);
      break;
    }
    case 'ragedash': {
      // blur dash: body horizontal, arms back
      const lv = D(4);
      neck = add(neck, lv); head = add(head, V(lv.x * 1.3, lv.y * 1.3)); hip = add(hip, D(1.4));
      ffoot = add(D(-3.5), V(-s, -1.5 * s)); bfoot = add(D(-5), V(s, -2.5 * s));
      fhand = add(neck, D(-3), V(0, 1.5 * s), P(1.5 * f)); bhand = add(neck, D(-3), V(0, 1.5 * s), P(-1.5 * f));
      break;
    }
    case 'ragekill': {
      // execution: a monstrous rear straight that drives through the target, body fully committed
      stance(-0.3 * ch + 1.4 * kp, 1.3);
      twist(-0.6 * ch + 2.0 * kk);
      bhand = add(neck, D(-2.2 * ch + 11 * kk, 0.9), P(1.0 * f * (1 - kk)));
      fhand = add(neck, D(-1.5), V(0, 1.6 * s), P(-1.6 * f));
      lean(-0.6 * ch + 3.0 * kk, 0.8 * kk); hip.y += 0.8 * s * kk;
      head = add(head, P(0.8 * f * kk), D(0.6 * kk));
      bfoot = add(bfoot, P(1.2 * f * kk), D(1.0 * kk));
      break;
    }
    case 'tigerclaw': {
      // tiger claw: deep hunch, hooked hands rake down alternately with big arm swings
      const ph = t * Math.PI * 6;
      stance(0.7, 1.2);
      lean(2.4, 1.2); hip.y += 1.0 * s;
      fhand = add(neck, D(2.5 + Math.sin(ph) * 4.0, 0.2 + Math.sin(ph) * 2.6), P(0.8 * f));
      bhand = add(neck, D(2.5 - Math.sin(ph) * 4.0, 0.2 - Math.sin(ph) * 2.6), P(-0.8 * f));
      twist(0.9 * Math.sin(ph));
      break;
    }
    case 'mantis': {
      // mantis: hooked hands coiled to the chest, sink very low, then one explosive short strike with the whole body
      const coil = ch;
      stance(-0.6 * coil + 1.3 * kp, 1.4);
      hip.y += 3.0 * s * coil; neck.y += 2.8 * s * coil; head.y += 2.8 * s * coil;
      fhand = add(neck, D(1.0 - 2.2 * coil + 7.5 * kp, 0.9), V(0, -1.4 * s * coil));
      bhand = add(neck, D(-0.5 - 1.2 * coil), V(0, 0.4 * s), P(-1 * f));
      twist(-0.5 * coil + 1.5 * kp);
      lean(-0.5 * coil + 1.8 * kp, 0.4 * kp);
      break;
    }
    case 'spinback': {
      // spinning backfist: look over the shoulder, pivot on the front foot, 360, the rear arm whips out straight
      const sp = cl01((t - 0.15) / 0.5);
      const a = o.aim + f * (Math.PI * 1.15 - 2.3 * Math.PI * sp);
      const r = (2.5 + 7 * Math.sin(Math.min(1, sp * 1.3) * Math.PI * 0.5)) * s;
      hip.y -= 0.6 * s; neck.y -= 0.6 * s; head.y -= 0.6 * s;
      bhand = add(neck, V(Math.cos(a) * r, Math.sin(a) * r * 0.6), V(0, 0.9 * s));
      fhand = add(neck, V(Math.cos(a + Math.PI) * 2.6 * s, Math.sin(a + Math.PI) * 1.6 * s), V(0, 1.2 * s));
      head = add(head, V(Math.cos(a) * 1.1 * s, Math.sin(a) * 0.6 * s));
      ffoot = V(1.6 * s * f, 0); bfoot = add(V(-1.6 * s * f, 0), V(Math.cos(a + Math.PI) * 1.8 * s, Math.sin(a + Math.PI) * 1.1 * s));
      if (t > 0.2 && t < 0.65) trail = { cx: neck.x, cy: neck.y + 0.9 * s, rx: r * 1.1, ry: r * 0.66, from: o.aim + f * Math.PI * 1.15, to: a };
      break;
    }
    // ================= KICKS ===================================================================
    case 'roundhouse': case 'kick': {
      // roundhouse: chamber the knee high, pivot the support foot, hips turn over, the shin whips through at rib height
      const chm = cl01(t / 0.3), ext = kk, sp = cl01((t - 0.6) / 0.4);
      const a0 = o.aim + f * 2.2, a = o.aim + f * (2.2 - 2.7 * ext);
      const len = (3.5 + 6.5 * ext) * s * (1 - sp * 0.5), h = (4.5 + 0.5 * ext) * s * (1 - sp);
      ffoot = add(hip, V(Math.cos(a) * len, Math.sin(a) * len * 0.6 - h * chm));
      kneeUp = 2.6 * s * chm * (1 - ext * 0.6); fkneeBend = f;
      bfoot = add(V(0, 0), D(-1.4), P(1.0 * f * ext));
      lean(-1.0 * ext, 0.1); neck = add(neck, P(f * 1.4 * ext)); head = add(head, P(f * 1.4 * ext));
      fhand = add(neck, P(f * 2.8 * ext), D(0.6), V(0, 0.6 * s)); bhand = add(neck, P(-f * 2.8 * ext), D(-0.6), V(0, 0.8 * s));
      if (t >= 0.3 && t <= 0.62) trail = { cx: hip.x, cy: hip.y - h * 0.5, rx: len * 1.1, ry: len * 0.66, from: a0, to: a };
      break;
    }
    case 'sweep': {
      // low sweep: drop onto the rear leg, the extended front leg scythes a full circle along the floor
      const cr = 3.2 * s; hip.y += cr; neck.y += cr; head.y += cr;
      const sk = cl01((t - 0.22) / 0.46);
      const a0 = o.aim + Math.PI * 0.95 * f, a = a0 - sk * Math.PI * 1.9 * f;
      ffoot = V(Math.cos(a) * 9 * s, Math.sin(a) * 9 * s * 0.6 + 0.3 * s);
      bfoot = V(-f * 0.6 * s, 0); kneeUp = 1.6 * s; bkneeBend = -f;
      bhand = V(-f * 3.8 * s, -0.5 * s); fhand = add(neck, D(2.4), V(0, 2.2 * s));
      lean(0.6, 0);
      if (sk > 0 && sk < 1) trail = { cx: 0, cy: 0.3 * s, rx: 9.5 * s, ry: 5.7 * s, from: a0, to: a };
      break;
    }
    case 'knee': {
      // muay thai knee: both hands grab the head and pull it down while the knee drives up and through
      const drive = kk;
      stance(-0.3 * ch + 0.8 * drive, 1.0);
      ffoot = add(hip, D(1.5 + 3.5 * drive), V(0, (4 - 9.5 * drive) * s));
      kneeUp = 4.0 * s * drive; fkneeBend = f;
      bfoot = add(V(0, 0), D(-2.4));
      fhand = add(neck, D(2 + 2.5 * ch - 1.5 * drive, 1.4 + 0.8 * ch - 2.6 * drive), P(1.2 * f));
      bhand = add(neck, D(1.8 + 2.5 * ch - 1.5 * drive, 1.0 + 0.8 * ch - 2.4 * drive), P(-1.2 * f));
      lean(0.4 + 1.0 * drive, -0.8 * drive); hip.y -= 1.2 * s * drive;
      break;
    }
    case 'axekick': {
      // axe kick: swing the straight leg up past the head, then chop straight down
      const up = t < 0.3 ? easeOut(t / 0.3) : t < 0.42 ? 1 - (t - 0.3) / 0.12 : 0;
      const dn = t >= 0.3 ? cl01((t - 0.3) / 0.12) : 0;
      stance(0.3, 1.0);
      ffoot = add(hip, D(1.5 + 4 * dn + 1.2 * up), V(0, (-10.5 * up + 3.8 * dn) * s));
      fkneeBend = -f; kneeUp = 0.4 * s * up;
      bfoot = V(-1.6 * s * f, 0);
      lean(-1.2 * up + 2.2 * dn, 0.8 * up - 1.0 * dn);
      hip.y += 1.2 * s * dn;
      fhand = add(neck, D(-2.4), V(0, (-1.8 * up + 2.5 * dn) * s)); bhand = add(neck, D(2 + 1.5 * dn), V(0, (0.8 + 1.5 * dn) * s));
      if (t >= 0.28 && t <= 0.46) trail = { cx: hip.x, cy: hip.y, rx: 10 * s, ry: 10 * s, from: -Math.PI / 2 + (f > 0 ? 0.3 : -0.3), to: f > 0 ? 0.35 : Math.PI - 0.35 };
      break;
    }
    case 'dragontail': {
      // spinning back heel: look over the shoulder, pivot, rear heel sweeps a circle at chest height
      const sp = cl01((t - 0.18) / 0.5);
      const a = o.aim + f * (Math.PI * 0.95 - 2.4 * Math.PI * sp);
      const r = (3.5 + 7 * Math.sin(Math.min(1, sp * 1.25) * Math.PI * 0.5)) * s;
      hip.y -= 1.2 * s; neck.y -= 1.2 * s; head.y -= 1.2 * s;
      bfoot = add(hip, V(Math.cos(a) * r, Math.sin(a) * r * 0.6 - 2.6 * s));
      ffoot = V(1.2 * s * f, 0); kneeUp = 0.8 * s; fkneeBend = f; bkneeBend = -f;
      fhand = add(neck, V(Math.cos(a + Math.PI) * 3.2 * s, Math.sin(a + Math.PI) * 1.9 * s), V(0, 0.6 * s));
      bhand = add(neck, V(Math.cos(a) * 2.2 * s, Math.sin(a) * 1.3 * s), V(0, -1.0 * s));
      head = add(head, V(Math.cos(a) * 1.0 * s, Math.sin(a) * 0.6 * s));
      lean(-0.6, 0.3);
      if (t > 0.2 && t < 0.7) trail = { cx: hip.x, cy: hip.y - 2.6 * s, rx: r * 1.1, ry: r * 0.66, from: o.aim + f * Math.PI * 0.95, to: a };
      break;
    }
    case 'cranekick': {
      // crane: tall on one leg, knee high, arms spread like wings; then the front kick snaps straight out
      const chm = Math.min(1, t / 0.3), snap = kk, back = cl01((t - 0.6) / 0.4);
      stance(0, 0.6);
      ffoot = add(hip, D(1 + 8.5 * snap * (1 - back * 0.7)), V(0, (-3.5 * chm - 1.0 * snap + 4 * (1 - chm) + 4 * back) * s));
      kneeUp = 3.2 * s * chm * (1 - snap); fkneeBend = f;
      bfoot = V(-0.4 * s * f, 0);
      fhand = add(neck, D(5 * chm - 1.5 * snap), V(0, (-5 * chm + 1 * snap) * s)); bhand = add(neck, D(-5 * chm), V(0, (-5 * chm + 1 * snap) * s));
      neck.y -= 1.2 * s * chm; head.y -= 1.4 * s * chm;
      lean(-0.5 * chm + 1.2 * snap, 0.4 * chm);
      break;
    }
    case 'monkeyflip': {
      // backflip kick: crouch, flip (body rotates backwards), the front foot arcs up and forward
      const ph = cl01((t - 0.15) / 0.5);
      const rot = -f * ph * Math.PI * 1.6;
      const c = V(0, (-5 - 7 * Math.sin(ph * Math.PI)) * s);
      const R = (v: Vec): Vec => V(c.x + v.x * Math.cos(rot) - v.y * Math.sin(rot), c.y + v.x * Math.sin(rot) + v.y * Math.cos(rot));
      hip = R(V(0, 1.5 * s)); neck = R(V(0, -3 * s)); head = R(V(0, -6 * s));
      ffoot = R(V(f * 7 * s, -2.5 * s)); bfoot = R(V(-f * 1 * s, 4.5 * s));
      fhand = R(V(-f * 3 * s, -1 * s)); bhand = R(V(f * 2 * s, -4 * s));
      if (ph > 0.15 && ph < 0.75) trail = { cx: c.x, cy: c.y, rx: 9 * s, ry: 8 * s, from: -Math.PI / 2 - f * 0.4, to: -Math.PI / 2 - f * 0.4 + rot };
      break;
    }
    case 'flying': {
      const c = V(0, -7 * s);
      const wob = Math.sin(o.time * 30) * 0.3 * s;
      hip = add(c, D(-2), V(0, wob)); neck = add(c, D(1.5), V(0, -wob)); head = add(neck, D(2.5), V(0, -2 * s));
      ffoot = add(hip, D(8), V(0, 0.5 * s)); bfoot = add(hip, D(-1), V(0, 3 * s));
      fhand = add(neck, D(-2), V(0, 2.5 * s)); bhand = add(neck, D(-3), V(0, -1.5 * s));
      fkneeBend = -f;
      break;
    }
    case 'sidekick': {
      if (t < 0.3) {
        const q = easeOut(t / 0.3);
        hip.y += 2.5 * s * q; neck.y += 3 * s * q; head.y += 3.2 * s * q;
        ffoot = add(V(2.5 * s * f, 0), D(1.5 * q)); bfoot = V(-2.5 * s * f, 0);
        fhand = add(neck, D(2), V(0, 1.5 * s)); bhand = add(neck, D(-2.5 * q), V(0, -1 * s * q));
        lean(-1.2 * q, 0);
      } else {
        const ext = cl01((t - 0.3) / 0.12);
        const c = V(0, -6.5 * s);
        hip = add(c, D(-1.5), P(0.6 * f)); neck = add(c, D(-0.5), V(0, -3.5 * s), P(-0.6 * f)); head = add(neck, D(0.6), V(0, -2.6 * s));
        ffoot = add(hip, D(2 + 7.5 * ext), V(0, -0.5 * s));
        bfoot = add(hip, D(-1.5), V(0, 2.5 * s));
        fhand = add(neck, D(2.5), V(0, 1.5 * s)); bhand = add(neck, D(-3.5), V(0, -0.5 * s));
        fkneeBend = -f; bkneeBend = -f;
        if (t >= 0.3 && t < 0.5) trail = { cx: hip.x, cy: hip.y, rx: 9 * s, ry: 5 * s, from: o.aim + f * 0.9, to: o.aim };
      }
      break;
    }
    case 'jump': {
      if (t < 0.15) {
        const q = t / 0.15; hip.y += 2 * s * q; neck.y += 2.5 * s * q; head.y += 3 * s * q;
        fhand = add(neck, D(-1), V(0, 2 * s)); bhand = add(neck, D(-2), V(0, 2 * s));
        ffoot = V(2.5 * s * f, 0); bfoot = V(-2.5 * s * f, 0);
      } else if (t < 0.85) {
        const air = cl01((t - 0.15) / 0.25);
        const tuck = Math.sin(cl01((t - 0.15) / 0.7) * Math.PI);
        hip.y -= 0.5 * s * air; neck.y -= 1.0 * s * air; head.y -= 1.2 * s * air;
        ffoot = add(hip, D(1.5), V(0, (4 - 1.5 * tuck) * s)); bfoot = add(hip, D(-1.5), V(0, (4 - 2.5 * tuck) * s));
        fhand = add(neck, D(2), V(0, (-2 + 1.5 * tuck) * s)); bhand = add(neck, D(-2.5), V(0, (-1.5 + 1 * tuck) * s));
        kneeUp = 1.5 * s * tuck;
      } else {
        const q = (t - 0.85) / 0.15; hip.y += 2 * s * q; neck.y += 2.5 * s * q; head.y += 3 * s * q;
        ffoot = V(3 * s * f, 0); bfoot = V(-3 * s * f, 0);
        fhand = add(neck, D(2), V(0, 2.5 * s * q)); bhand = add(neck, D(-2), V(0, 2.5 * s * q));
      }
      break;
    }
    case 'runpunch': {
      if (t < 0.3) {
        const q = easeOut(t / 0.3);
        bhand = add(neck, D(-3 * q), V(0, -2 * s * q)); fhand = add(neck, D(2.5), V(0, s));
        lean(-q, 0);
      } else {
        lean(3 * kk, 1.2 * kk); hip = add(hip, D(-kk));
        bhand = add(neck, D(1 + 9 * kk, 1)); fhand = add(neck, D(-2.5), V(0, 1.5 * s));
        ffoot = add(ffoot, D(1.5)); bfoot = add(bfoot, D(-3 * kk), V(0, -2 * s * kk));
      }
      break;
    }
    // ---------------- nunchaku stances: only the body is posed here; the chain itself is physics ----------------
    case 'n_lowsweep': {
      const cr = 2.2 * s; hip.y += cr; neck.y += cr; head.y += cr;
      const a = o.aim + f * (Math.PI * 0.9 - 2.2 * Math.PI * cl01((t - 0.2) / 0.5));
      fhand = add(hip, V(Math.cos(a) * 5 * s, Math.sin(a) * 3 * s + 1 * s));
      bhand = add(neck, D(-1.5), V(0, 1.5 * s));
      ffoot = V(3.5 * s * f, 0); bfoot = V(-2.5 * s * f, 0);
      break;
    }
    case 'n_tornado': {
      // whole body spins with the chain horizontal at chest height
      const a = o.aim + f * t * Math.PI * 6;
      fhand = add(neck, V(Math.cos(a) * 4.5 * s, Math.sin(a) * 2.7 * s), V(0, 0.5 * s));
      bhand = add(neck, V(Math.cos(a + Math.PI) * 2.5 * s, Math.sin(a + Math.PI) * 1.5 * s), V(0, 1.5 * s));
      hip.y -= 0.8 * s; neck.y -= 0.8 * s; head.y -= 0.8 * s;
      ffoot = V(3 * s * f, 0); bfoot = V(-3 * s * f, 0);
      break;
    }
    case 'n_dragonlash': {
      // leap forward with the chain wound back, then a huge overhead-to-forward smash on landing
      const wind = t < 0.3 ? easeOut(t / 0.3) : 0;
      const smash = t >= 0.3 ? cl01((t - 0.3) / 0.14) : 0;
      const c = V(0, -1.5 * s * smash);
      hip = add(hip, c); neck = add(neck, c); head = add(head, c);
      fhand = add(neck, D(-3 * wind + 6.5 * smash, 2 * wind - 1 * smash), V(0, (-4 * wind + 1 * smash) * s));
      bhand = add(neck, D(-2 + 1 * smash), V(0, 1 * s));
      lean(-1 * wind + 3 * smash, 0.6 * wind + 0.4 * smash);
      ffoot = add(ffoot, D(2.5 * smash)); bfoot = add(bfoot, D(-2 * smash), V(0, -2 * s * wind));
      break;
    }
    case 'n_garrote': {
      // both hands pull the chain tight behind the victim's neck (fatality)
      const q = Math.min(1, t * 2);
      fhand = add(neck, D(3.5, 1.8), P(2.2 * f * q)); bhand = add(neck, D(3.5, 1.6), P(-2.2 * f * q));
      lean(1 + 0.5 * Math.sin(t * 20) * q, -0.3);
      ffoot = add(ffoot, D(1.5)); bfoot = add(bfoot, D(-2.5));
      break;
    }
    case 'n_drum': {
      // rapid alternating overhead strikes
      const ph = Math.sin(t * Math.PI * 8);
      fhand = add(neck, D(2.5 + ph * 1.5, 1.5 + ph * 2.5));
      bhand = add(neck, D(-1.5), V(0, 1.5 * s));
      lean(1.2 + ph * 0.5, 0.3);
      break;
    }
    case 'n_idle': {
      // UNDERARM TUCK: the held stick is clamped under the right (rear) armpit, hand at the ribs; off hand guards
      const br = Math.sin(o.time * 4) * 0.4 * s;
      neck.y += br; head.y += br;
      stance(0.1, 1.0);
      fhand = add(neck, D(0.6), V(0, 2.6 * s), P(0.8 * f)); // rear-side rib tuck (front hand = sword hand holds the stick)
      bhand = add(neck, D(2.2), V(0, 1.0 * s), P(-1.2 * f));
      break;
    }
    // ---- BRUCE LEE TRIANGLE (the hand traces a triangle in front of the chest; the chain physics whips the far stick) ----
    case 'n_tri1': {
      // 1) from the armpit, the hand drives DIAGONALLY DOWN-LEFT across the body
      stance(-0.3 * ch + 0.9 * kp, 1.1);
      fhand = add(neck, D(0.6 - 1.0 * ch + 4.5 * kk), V(0, (2.6 - 1.0 * ch + 3.2 * kk) * s), P((0.8 - 3.6 * kk) * f));
      bhand = add(neck, D(2.0), V(0, 1.0 * s), P(-1.2 * f));
      twist(-0.4 * ch + 1.2 * kk);
      lean(1.2 * kk, 0.3 * kk);
      break;
    }
    case 'n_tri2': {
      // 2) BOUNCE: from low-left the hand whips FORWARD and UP in a rising arc through the target, then settles on the LEFT SHOULDER
      const rise = kk, settle = cl01((t - 0.5) / 0.3);
      stance(0.3 + 0.6 * kp, 1.1);
      fhand = add(neck, D(1.0 + 5.5 * Math.sin(rise * Math.PI * 0.85) - 4.5 * settle), V(0, (5.5 - 9.5 * rise) * s), P((-2.6 + 1.2 * rise - 1.0 * settle) * f));
      bhand = add(neck, D(2.4), V(0, 1.0 * s), P(-1.2 * f));
      twist(0.6 - 1.2 * rise); lean(1.0 * kp, 0.3 * kp);
      head = add(head, P(0.4 * f * rise));
      break;
    }
    case 'n_tri3': {
      // 3) HORIZONTAL SWEEP across the chest from the left shoulder back to the RIGHT
      stance(0.3 + 0.5 * kp, 1.2);
      fhand = add(neck, D(1.0 + 3.0 * Math.sin(kk * Math.PI)), V(0, (-1.4 + 1.0 * kk) * s), P((-1.8 + 4.2 * kk) * f));
      bhand = add(neck, D(2.0 - 1.0 * kk), V(0, 1.2 * s), P(-1.4 * f * (1 - kk)));
      twist(-1.2 + 2.4 * kk);
      head = add(head, P(-0.5 * f * kk));
      lean(0.8 * kp, 0.2 * kp);
      break;
    }
    case 'n_tri4': {
      // 4) CATCH & LOCK: the far stick is caught and clamped back under the right armpit with a short downward smash
      const lock = cl01((t - 0.6) / 0.4);
      stance(0.6 * kp, 1.1);
      fhand = add(neck, D(2.4 - 1.8 * lock + 2.0 * kp), V(0, (-0.4 + 3.0 * lock + 1.5 * kp) * s), P((2.4 - 1.6 * lock) * f));
      bhand = add(neck, D(1.6 + 1.0 * kp), V(0, 1.0 * s), P(-1.2 * f));
      twist(0.8 * kp);
      lean(1.0 * kp, 0.3 * kp); hip.y += 0.6 * s * kp;
      break;
    }
    case 'n_lash': case 'n_cross': {
      const back = o.pose === 'n_cross' ? -1 : 1;
      // hand swings from high-back to front-low; the far stick follows with physics lag
      const sw = -0.45 + 1.45 * kk;
      fhand = add(neck, D(1 + 4.5 * sw, 2.5 - 3.5 * sw), P(back * 1.5 * f * (1 - kk)));
      bhand = add(neck, D(-1), V(0, 1.5 * s));
      lean(1.6 * kp, 0.4 * kp);
      ffoot = add(ffoot, D(1.5 * kp)); bfoot = add(bfoot, D(-1 * kp));
      break;
    }
    case 'n_figure8': {
      // wrist draws a figure-8 well in front of the body (arm extended)
      const ph = t * Math.PI * 4;
      fhand = add(neck, D(6 + Math.sin(ph) * 2), P(Math.sin(ph * 2) * 2.2 * f), V(0, 1.0 * s));
      bhand = add(neck, D(-1.5), V(0, 2 * s));
      lean(0.8, 0.2);
      ffoot = V(3 * s * f, 0); bfoot = V(-2.5 * s * f, 0);
      break;
    }
    case 'n_overhead': {
      // both hands raise the grip overhead, then slam down
      const up = t < 0.3 ? easeOut(t / 0.3) : Math.max(0, 1 - (t - 0.3) / 0.1);
      const dn = t >= 0.3 ? cl01((t - 0.3) / 0.1) : 0;
      fhand = add(neck, D(-1 + 5 * dn, 0), V(0, (-7 * up + 3 * dn) * s));
      bhand = add(fhand, P(-1.2 * f), V(0, 0.5 * s));
      lean(-1 * up + 2.5 * dn, 0.5 * up - 0.6 * dn);
      hip.y += 1.2 * s * dn;
      ffoot = add(ffoot, D(2 * dn)); bfoot = add(bfoot, D(-1.5 * dn));
      break;
    }
    case 'n_helicopter': {
      // arm raised overhead, wrist spinning; body turns with it
      fhand = add(neck, V(0, -5.5 * s), D(1));
      bhand = add(neck, D(-2), V(0, 2 * s));
      const wob = Math.sin(t * Math.PI * 6) * 0.6 * s;
      neck.x += wob; head.x += wob * 1.3;
      ffoot = V(2.8 * s * f, 0); bfoot = V(-2.8 * s * f, 0);
      break;
    }
    case 'n_whipcrack': {
      // big pull back then a full-arm snap forward; the stick extends and cracks at max reach
      const q = t < 0.3 ? easeOut(t / 0.3) : 0;
      fhand = t < 0.3 ? add(neck, D(-2.5 * q, 2.5 * q)) : add(neck, D(2 + 5 * kk, 0.5 + 1.0 * kk));
      bhand = add(neck, D(-1.5), V(0, 1.5 * s));
      lean(-1.2 * q + 2.8 * kk, 0.5 * kk);
      ffoot = add(ffoot, D(2.5 * kk)); bfoot = add(bfoot, D(-2 * kk));
      hip.y += 0.8 * s * kk;
      break;
    }
    case 'n_choke': {
      // wrap the chain around the neck (0-0.3), then slam them down over the shoulder (0.3-0.6)
      const grab = cl01(t / 0.3), slam = cl01((t - 0.3) / 0.2);
      fhand = add(neck, D(4 - 2 * slam, 2 - 4 * slam), P(1.5 * f * grab));
      bhand = add(neck, D(4 - 2 * slam, 1.5 - 3.5 * slam), P(-1.5 * f * grab));
      lean(1.5 * grab - 2.5 * slam, 0.3 - 1.0 * slam);
      hip.y += 1.5 * s * slam;
      ffoot = add(ffoot, D(1.5)); bfoot = add(bfoot, D(-1.5));
      break;
    }
    // ---------------- katana stances (the blade itself is drawn from the sword hand along bladeDir) ----------------
    case 'k_idle': {
      // chudan (middle guard): both hands on the hilt, blade forward
      const br = Math.sin(o.time * 4) * 0.4 * s;
      neck.y += br; head.y += br;
      fhand = add(neck, D(3.2, -0.2), V(0, 1.5 * s)); bhand = add(fhand, D(-1.2), V(0, 0.8 * s));
      ffoot = V(2.8 * s * f, 0); bfoot = V(-2.2 * s * f, 0);
      lean(0.4, 0);
      break;
    }
    case 'k_sheathe': {
      // chiburi + noto: flick the blade, then slide it home at the hip
      const q = cl01(t);
      fhand = add(hip, D(-1 + 2 * q), V(0, (-2 + 1 * q) * s), P(-1.5 * f)); bhand = add(hip, D(-2.5), V(0, -1 * s), P(-1.8 * f));
      lean(0.2, 0); head = add(head, D(0.5));
      ffoot = V(2.6 * s * f, 0); bfoot = V(-2.4 * s * f, 0);
      break;
    }
    case 'k_draw': {
      // iai: hand at the hip on the far side, explosive horizontal draw across the body
      const sw = -0.5 + 1.5 * kk;
      fhand = add(hip, D(-1 + 5.5 * sw, 3 + 1.5 * sw), P((2.5 - 3.5 * kk) * f));
      bhand = add(hip, D(-2), V(0, -0.5 * s), P(-1.5 * f)); // off hand holds the scabbard
      lean(1.8 * kp, 0.3 * kp); hip.y += 0.6 * s * kp;
      ffoot = add(ffoot, D(2.5 * kp)); bfoot = add(bfoot, D(-1 * kp));
      break;
    }
    case 'k_return': {
      const sw = -0.4 + 1.4 * kk;
      fhand = add(neck, D(1 + 4 * sw, 0.5), P((-2.5 + 3.5 * kk) * f));
      bhand = add(fhand, D(-1.2), V(0, 0.8 * s));
      lean(1.2 * kp, 0.2 * kp);
      ffoot = add(ffoot, D(1.5 * kp));
      break;
    }
    case 'k_crescent': {
      // big two-handed horizontal arc, body pivots with it
      const a = o.aim + f * (1.9 - 3.4 * kk);
      fhand = add(neck, V(Math.cos(a) * 4.5 * s, Math.sin(a) * 2.7 * s), V(0, 1 * s));
      bhand = add(fhand, V(-Math.cos(a) * 1.3 * s, -Math.sin(a) * 0.8 * s), V(0, 0.7 * s));
      lean(1.5 * kp, 0.3 * kp);
      neck = add(neck, P(-f * 0.8 * kk)); head = add(head, P(-f * 1.0 * kk));
      ffoot = add(ffoot, P(f * 1.2 * kk), D(1 * kp)); bfoot = add(bfoot, D(-1));
      break;
    }
    case 'k_heaven': {
      // jodan: blade raised high overhead (0-0.3), then a straight vertical cut that ends at the knee
      const up = t < 0.3 ? easeOut(t / 0.3) : Math.max(0, 1 - (t - 0.3) / 0.1);
      const dn = t >= 0.3 ? cl01((t - 0.3) / 0.1) : 0;
      fhand = add(neck, D(-1.5 * up + 5.5 * dn, 0), V(0, (-6.5 * up + 2.5 * dn) * s));
      bhand = add(fhand, D(-1.2), V(0, 0.8 * s));
      lean(-1.2 * up + 2.6 * dn, 0.6 * up - 0.8 * dn);
      hip.y += 1.5 * s * dn;
      ffoot = add(ffoot, D(2.5 * dn)); bfoot = add(bfoot, D(-1.5 * dn));
      break;
    }
    case 'k_thrust': {
      // tsuki: blade drawn back along the hip then driven straight forward with a long lunge
      const sw = -0.6 + 1.6 * kk;
      fhand = add(neck, D(1 + 4.5 * sw, 0.2), V(0, 1.5 * s));
      bhand = add(fhand, D(-1.5), V(0, 0.5 * s));
      lean(3 * kp, 1.0 * kp); hip.y += 1 * s * kp;
      ffoot = add(ffoot, D(3 * kp)); bfoot = add(bfoot, D(-2.5 * kp));
      break;
    }
    case 'k_rising': {
      // kiri-age: from low-back to high-front, upward diagonal cut
      fhand = add(neck, D(-1 + 4 * kk, 0), V(0, (4 - 9 * kk) * s));
      bhand = add(fhand, D(-1.2), V(0, 1 * s));
      lean(1.2 * kk, 0.2); hip.y += 1.5 * s * (1 - kk);
      ffoot = add(ffoot, D(2 * kk)); bfoot = add(bfoot, D(-1.5));
      break;
    }
    case 'k_whirlwind': {
      // two full spins with the blade out horizontally
      const a = o.aim + f * t * Math.PI * 4;
      fhand = add(neck, V(Math.cos(a) * 4.5 * s, Math.sin(a) * 2.7 * s), V(0, 0.8 * s));
      bhand = add(fhand, V(-Math.cos(a) * 1.3 * s, -Math.sin(a) * 0.8 * s), V(0, 0.6 * s));
      hip.y -= 0.6 * s; neck.y -= 0.6 * s; head.y -= 0.6 * s;
      ffoot = V(3 * s * f, 0); bfoot = V(-3 * s * f, 0);
      break;
    }
    case 'k_thousand': {
      // flurry: short fast alternating diagonal cuts
      const ph = t * Math.PI * 10;
      fhand = add(neck, D(3 + Math.sin(ph) * 1.5, 0.4), V(0, (1 + Math.cos(ph) * 2.2) * s));
      bhand = add(fhand, D(-1.2), V(0, 0.8 * s));
      lean(1.5, 0.4);
      ffoot = add(ffoot, D(2)); bfoot = add(bfoot, D(-1.5));
      break;
    }
    case 'k_dragonfang': {
      // enormous wind-up behind the back, then a diagonal descending cut with a step-through
      const wind = t < 0.3 ? easeOut(t / 0.3) : 0;
      const cut = t >= 0.3 ? cl01((t - 0.3) / 0.12) : 0;
      fhand = add(neck, D(-3.5 * wind + 5.5 * cut, 0), V(0, (-5 * wind + 2.5 * cut) * s), P(2 * f * wind));
      bhand = add(fhand, D(-1.3), V(0, 0.8 * s));
      lean(-1.5 * wind + 3 * cut, 0.8 * wind - 0.6 * cut);
      hip.y += 1.5 * s * cut;
      ffoot = add(ffoot, D(3 * cut)); bfoot = add(bfoot, D(-2 * cut));
      break;
    }
    case 'k_iaijutsu': {
      // dash-through with the blade held low and flat; the cut happens during travel
      const c = V(0, -0.5 * s);
      hip = add(hip, c); neck = add(neck, c); head = add(head, c);
      lean(3.5, 1.2); hip = add(hip, D(-1.2));
      fhand = add(neck, D(4.5, -0.5), V(0, 2 * s)); bhand = add(hip, D(-2.5), V(0, -0.5 * s));
      ffoot = add(ffoot, D(2.5)); bfoot = add(bfoot, D(-3.5), V(0, -1.5 * s));
      break;
    }
    // ---------------- AXE: two-handed, heavy, big wind-ups ----------------
    case 'a_idle': {
      // batter's stance: knees bent, hands up by the rear shoulder, bat cocked, little waggle
      const br = Math.sin(o.time * 4) * 0.4 * s, wag = Math.sin(o.time * 2.6) * 0.5 * s;
      neck.y += br; head.y += br;
      stance(-0.2, 1.5); hip.y += 0.8 * s;
      fhand = add(neck, D(-0.6), V(0, (-0.8 + wag * 0.3) * s), P(1.8 * f)); bhand = add(fhand, D(-0.8), V(0, 1.0 * s), P(-0.6 * f));
      twist(-0.5); head = add(head, D(0.6));
      break;
    }
    // ---- BASEBALL SWINGS: batter's stance, load over the rear shoulder, stride, hips lead, contact out front, wrap-around follow-through
    case 'a_swing1': case 'a_swing2': case 'a_homerun': {
      const back = o.pose === 'a_swing2' ? -1 : 1; // swing1/homerun: forehand (from the rear shoulder), swing2: backhand (from the front shoulder)
      const big = o.pose === 'a_homerun' ? 1.25 : 1;
      const load = ch, sw = kk, thru = cl01((t - 0.6) / 0.4);
      // hands travel on an arc around the chest: loaded behind the shoulder (-), through contact in front (0), wrapped around the far side (+)
      const a = o.aim + f * back * (2.3 * (0.6 + 0.4 * load) - (2.3 + 2.6) * sw * big * 0.75 - 1.0 * thru);
      const r = (3.2 + 1.8 * Math.sin(Math.min(1, sw * 1.2) * Math.PI)) * s;
      stance(-0.6 * load + 1.1 * sw - 0.3 * thru, 1.4);
      fhand = add(neck, V(Math.cos(a) * r, Math.sin(a) * r * 0.6), V(0, (-1.4 * load + 0.6 * sw + 0.4 * thru) * s));
      bhand = add(fhand, V(-Math.cos(a) * 1.4 * s, -Math.sin(a) * 0.9 * s), V(0, 0.6 * s)); // both hands on the handle
      twist(-1.0 * back * load + 1.8 * back * sw - 0.6 * back * thru);
      head = add(head, P(0.5 * f * back * sw)); // eyes follow the ball
      lean(-0.5 * load + 1.4 * sw, 0.3 * sw);
      hip.y += 0.8 * s * load; // sit into the load
      bfoot = add(bfoot, P(0.9 * f * back * sw)); // rear heel pivots ('squish the bug')
      if (t >= 0.3 && t <= 0.62) trail = { cx: neck.x, cy: neck.y + 0.3 * s, rx: r * 2.2 * big, ry: r * 1.3 * big, from: o.aim + f * back * 2.3, to: a };
      break;
    }
    case 'a_golf': {
      // golf swing: hands low & behind, sweep upward through the target, finish high over the front shoulder
      const load = ch, sw = kk, thru = cl01((t - 0.6) / 0.4);
      stance(-0.5 * load + 1.0 * sw, 1.4);
      fhand = add(neck, D(-2.2 * load + 1.5 + 2.5 * sw - 1.5 * thru), V(0, (4.5 * load + 3.5 - 9 * sw - 2 * thru) * s), P((1.2 * load - 2.2 * sw) * f));
      bhand = add(fhand, D(-1.3), V(0, 0.8 * s));
      twist(-0.8 * load + 1.6 * sw);
      lean(-0.4 * load + 0.8 * sw, 0.5 * sw); hip.y += 1.4 * s * load;
      head = add(head, D(0.6 * sw), V(0, -0.5 * s * sw));
      break;
    }
    case 'a_bunt': {
      // bunt: square up, slide the top hand up the haft and poke the head straight out
      stance(0.3 + 0.5 * kp, 1.3);
      fhand = add(neck, D(2 + 4.5 * kk, 0.4)); bhand = add(neck, D(-0.5 + 2.5 * kk), V(0, 1.2 * s));
      lean(0.8 * kk, 0.2); hip.y += 1.0 * s;
      break;
    }
    case 'a_chop': {
      // diagonal chop: wind up over the rear shoulder, step in, bring it down across the body
      const wind = ch, cut = kk;
      stance(-0.5 * wind + 1.1 * cut, 1.3);
      fhand = add(neck, D(-2.0 * wind + 5.5 * cut), V(0, (-4.5 * wind + 2.5 * cut) * s), P((1.5 * wind - 1.0 * cut) * f));
      bhand = add(fhand, D(-1.6), V(0, 0.8 * s));
      twist(-0.8 * wind + 1.6 * cut);
      lean(-0.8 * wind + 2.2 * cut, 0.6 * wind - 0.6 * cut);
      hip.y += 1.2 * s * cut;
      break;
    }
    case 'a_backswing': {
      const wind = ch, cut = kk;
      stance(0.3 + 0.5 * cut, 1.3);
      fhand = add(neck, D(0.5 + 4.5 * cut), V(0, (1.5 - 0.5 * cut) * s), P((-2.6 + 4.0 * cut) * f));
      bhand = add(fhand, D(-1.6), V(0, 0.8 * s));
      twist(1.0 * wind - 1.4 * cut);
      lean(1.2 * cut, 0.2 * cut);
      break;
    }
    case 'a_overhead': {
      // raise the axe straight overhead (long), then a vertical slam that drops the body into a deep stance
      const up = t < 0.3 ? easeOut(t / 0.3) : Math.max(0, 1 - (t - 0.3) / 0.08);
      const dn = t >= 0.3 ? cl01((t - 0.3) / 0.08) : 0;
      stance(-0.3 * up + 1.0 * dn, 1.4);
      fhand = add(neck, D(-1.0 * up + 5.5 * dn), V(0, (-8 * up + 3.5 * dn) * s));
      bhand = add(fhand, D(-1.6), V(0, 0.8 * s));
      lean(-1.5 * up + 2.8 * dn, 0.8 * up - 1.0 * dn);
      hip.y += 2.2 * s * dn; neck.y += 0.8 * s * dn;
      break;
    }
    case 'a_spin': {
      // lumberjack spin: body turns twice, axe out at arm's length
      const a = o.aim + f * t * Math.PI * 4;
      fhand = add(neck, V(Math.cos(a) * 5 * s, Math.sin(a) * 3 * s), V(0, 1.0 * s));
      bhand = add(fhand, V(-Math.cos(a) * 1.6 * s, -Math.sin(a) * 1.0 * s), V(0, 0.6 * s));
      hip.y -= 0.6 * s; neck.y -= 0.6 * s; head.y -= 0.6 * s;
      lean(0.3, 0.3);
      ffoot = V(3.2 * s * f, 0); bfoot = V(-3.2 * s * f, 0);
      break;
    }
    case 'a_hook': {
      // reach out with the axe head, hook the target, yank it back toward you
      const reach = t < 0.3 ? easeOut(t / 0.3) : 1, pull = cl01((t - 0.3) / 0.15);
      stance(0.8 * reach - 1.2 * pull, 1.3);
      fhand = add(neck, D(1 + 6 * reach - 4 * pull), V(0, (1.5 - 0.5 * reach) * s));
      bhand = add(fhand, D(-1.6), V(0, 0.8 * s));
      lean(2.0 * reach - 2.4 * pull, 0.4 * reach);
      twist(0.8 * reach - 1.2 * pull);
      break;
    }
    case 'a_leap': {
      // leaping slam: axe raised behind the head in the air, slammed on landing
      const air = t < 0.6 ? 1 : 0;
      const raise = t < 0.5 ? Math.min(1, t / 0.2) : Math.max(0, 1 - (t - 0.5) / 0.1);
      const dn = t >= 0.5 ? cl01((t - 0.5) / 0.1) : 0;
      fhand = add(neck, D(-1.5 * raise + 5.5 * dn), V(0, (-7.5 * raise + 3.5 * dn) * s));
      bhand = add(fhand, D(-1.6), V(0, 0.8 * s));
      ffoot = add(hip, D(2), V(0, (4.5 - 1.5 * air) * s)); bfoot = add(hip, D(-2), V(0, (4.5 - 2.5 * air) * s));
      kneeUp = 1.5 * s * air;
      lean(-1.0 * raise + 2.5 * dn, 0.6 * raise - 1.0 * dn);
      hip.y += 2.0 * s * dn;
      break;
    }
    // ---------------- DUAL BLADES: both hands are weapons; mirrored, fast ----------------
    case 'd_idle': {
      const br = Math.sin(o.time * 4) * 0.4 * s;
      neck.y += br; head.y += br;
      stance(0.2, 1.0);
      fhand = add(neck, D(2.2), V(0, 1.6 * s), P(1.2 * f)); bhand = add(neck, D(-1.4), V(0, 1.8 * s), P(-1.2 * f)); // reverse-grip rear blade
      break;
    }
    case 'd_cross': {
      stance(-0.3 * ch + 0.9 * kp, 1.0);
      fhand = add(neck, D(0.5 - 1.5 * ch + 6 * kk, 0.5), P((1.8 - 3.2 * kk) * f));
      bhand = add(neck, D(-1.2), V(0, 1.8 * s), P(-1.2 * f));
      twist(-0.4 * ch + 1.0 * kk); lean(1.2 * kk, 0.2 * kk);
      break;
    }
    case 'd_scissor': {
      stance(0.4 + 0.6 * kp, 1.0);
      fhand = add(neck, D(2 + 3 * kk, 0.4), P((-1.6 + 2.8 * kk) * f));
      bhand = add(neck, D(-1 - 1.5 * ch + 6.5 * kk, 0.5), P((-1.8 + 3.4 * kk) * f));
      twist(0.6 * ch - 1.4 * kk); lean(1.4 * kk, 0.3 * kk);
      break;
    }
    case 'd_flurry': {
      const ph = t * Math.PI * 12;
      stance(0.6, 1.0);
      fhand = add(neck, D(3.5 + Math.sin(ph) * 2.2, 0.4), P((0.4 + Math.cos(ph) * 1.6) * f));
      bhand = add(neck, D(3.5 - Math.sin(ph) * 2.2, 0.4), P((-0.4 - Math.cos(ph) * 1.6) * f));
      twist(0.8 * Math.sin(ph)); lean(1.6, 0.5);
      break;
    }
    case 'd_xslash': {
      // both arms crossed over the chest, then flung outward simultaneously
      stance(-0.4 * ch + 1.2 * kp, 1.2);
      fhand = add(neck, D(0.5 + 5.5 * kk), V(0, (0.5 - 2.5 * kk) * s), P((-2.2 + 5.0 * kk) * f));
      bhand = add(neck, D(0.5 + 5.5 * kk), V(0, (0.5 + 2.5 * kk) * s), P((2.2 - 5.0 * kk) * f));
      lean(-0.6 * ch + 2.2 * kk, 0.5 * kk); hip.y += 0.8 * s * kk;
      break;
    }
    case 'd_dance': {
      const a = o.aim + f * t * Math.PI * 6;
      fhand = add(neck, V(Math.cos(a) * 4.5 * s, Math.sin(a) * 2.7 * s), V(0, 0.8 * s));
      bhand = add(neck, V(Math.cos(a + Math.PI) * 4.5 * s, Math.sin(a + Math.PI) * 2.7 * s), V(0, 1.2 * s));
      hip.y -= 0.6 * s; neck.y -= 0.6 * s; head.y -= 0.6 * s;
      ffoot = V(2.8 * s * f, 0); bfoot = V(-2.8 * s * f, 0);
      break;
    }
    case 'd_launch': {
      stance(0.4 + 0.4 * kk, 1.1);
      hip.y += 2.2 * s * ch - 1.2 * s * kk; neck.y += 2.2 * s * ch - 2.0 * s * kk; head.y += 2.2 * s * ch - 2.4 * s * kk;
      fhand = add(neck, D(1.5 + 2 * kk), V(0, (4 - 11 * kk) * s), P(1.0 * f)); bhand = add(neck, D(1.5 + 2 * kk), V(0, (4 - 11 * kk) * s), P(-1.0 * f));
      lean(0.8 * kk, 0);
      break;
    }
    case 'd_dash': {
      lean(3.5, 1.2); hip = add(hip, D(-1.2));
      fhand = add(neck, D(2), V(0, 1 * s), P(3.2 * f)); bhand = add(neck, D(2), V(0, 1 * s), P(-3.2 * f)); // arms out like wings
      ffoot = add(ffoot, D(2.5)); bfoot = add(bfoot, D(-3.5), V(0, -1.5 * s));
      break;
    }
    case 'k_impale': {
      // fatality: blade through the chest, lift them, flick them off
      const q = Math.min(1, t);
      fhand = add(neck, D(4 + 1 * q, 0), V(0, (1 - 4 * q) * s)); bhand = add(fhand, D(-1.5), V(0, 0.8 * s));
      lean(1.5 - 1 * q, 0.4);
      ffoot = add(ffoot, D(2)); bfoot = add(bfoot, D(-2));
      break;
    }
    case 'crouch':
      hip.y += 2 * s; neck.y += 2.5 * s; head.y += 3 * s;
      ffoot = V(3 * s * f, 0); bfoot = V(-3 * s * f, 0);
      fhand = add(hip, D(2), V(0, -0.5 * s)); bhand = add(hip, D(-2), V(0, -0.5 * s));
      break;
    case 'launched':
      head = add(head, D(-1.5), V(0, 0.5 * s));
      fhand = add(neck, D(3), V(0, -3 * s)); bhand = add(neck, D(-3), V(0, -3 * s));
      ffoot = add(hip, D(3), V(0, 3 * s)); bfoot = add(hip, D(-3), V(0, 3 * s));
      break;
    case 'flex':
      bhand = add(neck, D(-1), V(0, -5 * s)); fhand = add(neck, D(2), V(0, 1.5 * s));
      ffoot = V(3 * s * f, 0); bfoot = V(-3 * s * f, 0);
      break;
    case 'rush': case 'takedown': {
      const alt = Math.floor(t * 20) % 2 === 0;
      fhand = alt ? add(neck, D(8, 0.5)) : add(neck, D(-1), V(0, 2 * s));
      bhand = alt ? add(neck, D(-1), V(0, 2 * s)) : add(neck, D(8, -0.5));
      lean(1.5, 0);
      break;
    }
    case 'grab': {
      const q = Math.min(1, t * 2);
      fhand = add(neck, D(4 + 2 * q, 2), P(1.2)); bhand = add(neck, D(4 + 2 * q, 2.4), P(-1.2));
      lean(1.5 * q, 0.3);
      ffoot = add(ffoot, D(1.5)); bfoot = add(bfoot, D(-1.5));
      break;
    }
    case 'kneedrop': {
      if (t < 0.45) {
        const q = t / 0.45;
        const c = V(0, (-6 - 4 * Math.sin(q * Math.PI)) * s);
        hip = add(c, D(-1)); neck = add(c, D(0.5), V(0, -3.5 * s)); head = add(neck, D(0.8), V(0, -2.6 * s));
        ffoot = add(hip, D(3.5), V(0, 2 * s)); bfoot = add(hip, D(-2.5), V(0, 3.5 * s));
        fhand = add(neck, D(-2), V(0, -3 * s)); bhand = add(neck, D(-3), V(0, -1 * s));
        kneeUp = 3 * s;
      } else {
        hip.y += 2.5 * s; neck.y += 2 * s; head.y += 2 * s;
        ffoot = add(hip, D(3), V(0, 2.5 * s)); bfoot = add(hip, D(-3), V(0, 2.5 * s));
        fhand = add(neck, D(2.5), V(0, -1 * s)); bhand = add(neck, D(-2), V(0, -2 * s));
      }
      break;
    }
    case 'spin': {
      const ang = o.aim + Math.PI * (1 - 2 * cl01((t - 0.15) / 0.5)) * f;
      const ex = Math.cos(ang), ey = Math.sin(ang) * 0.6;
      hip.y -= 1.5 * s; neck.y -= 1.5 * s; head.y -= 1.5 * s;
      ffoot = add(hip, V(ex * 9 * s, ey * 9 * s - 2.5 * s));
      bfoot = add(hip, V(-ex * 1.5 * s, -ey * 1.5 * s + 3.5 * s));
      fhand = add(neck, V(-ex * 3 * s, -ey * 3 * s + 0.5 * s)); bhand = add(neck, V(ex * 2 * s, ey * 2 * s - 2 * s));
      if (t > 0.15 && t < 0.65) trail = { cx: hip.x, cy: hip.y - 2.5 * s, rx: 9.5 * s, ry: 5.5 * s, from: o.aim + Math.PI * f, to: ang };
      break;
    }
    case 'stomp': {
      const up = t < 0.5 ? easeOut(t / 0.5) : Math.max(0, 1 - (t - 0.5) / 0.1);
      ffoot = add(hip, D(2.5), V(0, (-2.5 * up + 4 * (1 - up)) * s));
      kneeUp = 3 * s * up;
      bfoot = V(-1.5 * s * f, 0);
      neck.y -= 0.5 * s * up; head.y -= 0.5 * s * up;
      fhand = add(neck, D(-1.5), V(0, -2.5 * s * up + 1.5 * s)); bhand = add(neck, D(-3), V(0, 1.5 * s));
      lean(-0.6 * up + 1.5 * (1 - up) * (t > 0.5 ? 1 : 0), 0);
      break;
    }
    case 'hammer': {
      const up = t < 0.45 ? easeOut(t / 0.45) : Math.max(0, 1 - (t - 0.45) / 0.12);
      const c = add(neck, D(-1 + 7 * (1 - up), 0), V(0, (-7 * up + 3 * (1 - up)) * s));
      fhand = add(c, P(1)); bhand = add(c, P(-1));
      lean(-1 * up + 3 * (1 - up), -0.5 * up);
      hip.y += (1 - up) * 1.5 * s;
      ffoot = add(ffoot, D(2 * (1 - up))); bfoot = add(bfoot, D(-1.5 * (1 - up)));
      break;
    }
    case 'shoot': {
      const rc = o.recoil ?? 0;
      fhand = add(neck, D(5 - 2.5 * rc, 0.3 + 1.2 * rc));
      bhand = o.weapon === 'rifle' || o.weapon === 'smg' || o.weapon === 'shotgun' ? add(neck, D(2.5 - 1.5 * rc, -0.3)) : add(neck, D(0.5), V(0, 2 * s));
      lean(-0.8 * rc, 0);
      if (!o.moving) { ffoot = add(ffoot, D(1)); bfoot = add(bfoot, D(-1.5)); }
      break;
    }
    case 'reload': {
      const w = Math.sin(o.time * 14) * 0.8 * s;
      fhand = add(neck, D(2.5, -1.5)); bhand = add(neck, D(1.2, -1.2), V(0, w));
      head = add(head, D(0.8, -0.6));
      break;
    }
    case 'windup':
      bhand = add(neck, D(-3), V(0, -2.5 * s * quick)); fhand = add(neck, D(2.5), V(0, s));
      lean(-1.5 * quick, 0); hip.y += 0.5 * s * quick;
      break;
    case 'charge':
      lean(3, 1);
      fhand = add(neck, D(-3), V(0, 2 * s)); bhand = add(neck, D(-2), V(0, 3 * s));
      break;
    case 'throw':
      bhand = add(neck, D(-3 + 10 * quick), V(0, -4 * s + 5 * s * quick)); fhand = add(neck, D(2));
      break;
    case 'parry':
      fhand = add(neck, D(3, 1.5), P(1.5)); bhand = add(neck, D(3, 1), P(-1.5));
      ffoot = V(3 * s * f, 0); bfoot = V(-3 * s * f, 0);
      break;
    case 'stagger': {
      const w = Math.sin(o.time * 25) * 1.5 * s;
      head.x += w; neck.x += w * 0.5;
      fhand = add(neck, V(2 * s, 4 * s)); bhand = add(neck, V(-2 * s, 4 * s));
      ffoot = V(3 * s * f, 0); bfoot = V(-3 * s * f, 0);
      break;
    }
    case 'hurt':
      lean(-2, 0);
      fhand = add(neck, V(3 * s, -2 * s)); bhand = add(neck, V(-3 * s, -2 * s));
      break;
    case 'dash': {
      const lv = L(3.5);
      neck = add(neck, lv); head = add(head, V(lv.x * 1.3, lv.y * 1.3)); hip = add(hip, L(1.2));
      ffoot = add(L(-3.5), V(-s, -1.5 * s)); bfoot = add(L(-5), V(s, -2.5 * s));
      fhand = add(neck, L(-2.5), V(s, 2 * s)); bhand = add(neck, L(-2.5), V(-s, 2 * s));
      break;
    }
    case 'down': {
      const b = -f;
      hip = V(0, -2 * s); neck = V(b * 4 * s, -2 * s); head = V(b * 7 * s, -2.5 * s);
      ffoot = V(-b * 4 * s, -s); bfoot = V(-b * 4 * s, -3 * s);
      fhand = V(b * 3 * s, -5 * s); bhand = V(b * 2 * s, s);
      break;
    }
    default:
      break;
  }

  // squash & stretch (landing / takeoff): scale vertically around the feet
  if (o.squash && o.squash !== 1) {
    const sq = o.squash, wx = 1 + (1 - sq) * 0.6;
    const S = (v: Vec): Vec => V(v.x * wx, v.y * sq);
    hip = S(hip); neck = S(neck); head = S(head); fhand = S(fhand); bhand = S(bhand); ffoot = S(ffoot); bfoot = S(bfoot);
  }
  if (o.rot) {
    const cx = 0, cy = -5 * s, cs = Math.cos(o.rot), sn = Math.sin(o.rot);
    const R = (v: Vec): Vec => V(cx + (v.x - cx) * cs - (v.y - cy) * sn, cy + (v.x - cx) * sn + (v.y - cy) * cs);
    hip = R(hip); neck = R(neck); head = R(head); ffoot = R(ffoot); bfoot = R(bfoot); fhand = R(fhand); bhand = R(bhand);
  }
  const legLen = 5.2 * s, armLen = 5.2 * s;
  if (kneeDir) {
    // choose the bend side so the knee points along the movement direction
    const pick = (a: Vec, b: Vec, fallback: number) => {
      const dxl = b.x - a.x, dyl = b.y - a.y;
      const dl = Math.hypot(dxl, dyl);
      if (dl < 0.5) return fallback;
      const nx = -dyl / dl, ny = dxl / dl; // bend=+1 normal
      const dot = nx * kneeDir!.x + ny * kneeDir!.y;
      return Math.abs(dot) < 0.05 ? fallback : dot > 0 ? 1 : -1;
    };
    fkneeBend = pick(hip, ffoot, fkneeBend); bkneeBend = pick(hip, bfoot, bkneeBend);
  }
  const fknee = bendJoint(hip, ffoot, legLen, fkneeBend, kneeUp);
  const bknee = bendJoint(hip, bfoot, legLen, bkneeBend, kneeUp * 0.6);
  const felbow = s >= 1.4 ? bendJoint(neck, fhand, armLen, -f) : null;
  const belbow = s >= 1.4 ? bendJoint(neck, bhand, armLen, f) : null;
  return { hip, neck, head, ffoot, bfoot, fhand, bhand, fknee, bknee, felbow, belbow, trail };
}

export function drawSkeleton(ctx: Ctx, o: StickOpts, sk: Skeleton) {
  const s = o.scale, f = o.facing;
  const dx = Math.cos(o.aim), dy = Math.sin(o.aim);
  const pxp = -dy, pyp = dx;
  const run = o.run ?? 0;
  const hr = Math.max(2, Math.round(3 * s));
  const X = o.x, Y = o.y - (o.z ?? 0);
  const { hip, neck, head, ffoot, bfoot, fhand, bhand, fknee, bknee, felbow, belbow, trail } = sk;
  ctx.globalAlpha = o.alpha;
  if (trail && o.trail) {
    ctx.globalAlpha = o.alpha * 0.5;
    parc(ctx, X + trail.cx, Y + trail.cy, trail.rx, trail.ry, trail.from, trail.to, o.trail, 1);
    ctx.globalAlpha = o.alpha * 0.9;
    parc(ctx, X + trail.cx, Y + trail.cy, trail.rx * 0.82, trail.ry * 0.82, trail.from + (trail.to - trail.from) * 0.55, trail.to, '#ffffff', 1);
    ctx.globalAlpha = o.alpha;
  }
  type Seg = [Vec, Vec, string];
  const segs: Seg[] = [[hip, neck, 'torso']];
  if (fknee) segs.push([hip, fknee, 'ffoot'], [fknee, ffoot, 'ffoot']); else segs.push([hip, ffoot, 'ffoot']);
  if (bknee) segs.push([hip, bknee, 'bfoot'], [bknee, bfoot, 'bfoot']); else segs.push([hip, bfoot, 'bfoot']);
  if (felbow) segs.push([neck, felbow, 'fhand'], [felbow, fhand, 'fhand']); else segs.push([neck, fhand, 'fhand']);
  if (belbow) segs.push([neck, belbow, 'bhand'], [belbow, bhand, 'bhand']); else segs.push([neck, bhand, 'bhand']);
  // bold Downwell-style limbs: 2px at normal size (3px for big figures)
  const lw = s >= 1.4 ? 3 : 2;
  const strikeLimb = o.strike ?? null;
  const isStrike = (tag: string) => !!strikeLimb && (strikeLimb === tag || (strikeLimb === 'both' && (tag === 'fhand' || tag === 'bhand')));
  const paint = (col: string, ox: number, oy: number, outlinePass: boolean) => {
    for (const [a, b, tag] of segs) {
      const w = isStrike(tag) && (o.impact ?? 0) > 0 ? lw + 1 : lw;
      pline(ctx, X + a.x + ox, Y + a.y + oy, X + b.x + ox, Y + b.y + oy, col, w);
    }
    pcircle(ctx, X + head.x + ox, Y + head.y + oy, hr, col);
    void outlinePass;
  };
  if (o.outline && !o.flash) {
    paint(o.outline, 1, 0, true); paint(o.outline, -1, 0, true); paint(o.outline, 0, 1, true); paint(o.outline, 0, -1, true);
  }
  const col = o.flash ? '#ffffff' : o.c;
  paint(col, 0, 0, false);
  // impact: the striking limb flashes hot and gets a bright knuckle/heel dot
  if (strikeLimb && (o.impact ?? 0) > 0 && !o.flash) {
    const tips: Vec[] = strikeLimb === 'both' ? [fhand, bhand] : [strikeLimb === 'fhand' ? fhand : strikeLimb === 'bhand' ? bhand : strikeLimb === 'ffoot' ? ffoot : bfoot];
    for (const tp of tips) pcircle(ctx, X + tp.x, Y + tp.y, s >= 1.4 ? 2 : 1.4, '#ffffff');
  }
  if (!o.flash) {
    const H = { x: X + head.x, y: Y + head.y };
    const R = { x: X + fhand.x, y: Y + fhand.y };
    const es = s >= 1.6 ? 2 : 1;
    switch (o.acc) {
      case 'hood':
        pcircle(ctx, H.x, H.y, hr, o.c2);
        px(ctx, H.x, H.y - hr - 1, o.c2);
        break;
      case 'helmet':
        halfCircle(ctx, H.x, H.y, hr, o.c2, true);
        break;
      case 'mask':
        halfCircle(ctx, H.x, H.y, hr, o.c2, false);
        break;
    }
    const la = o.look ?? o.aim, ldx = Math.cos(la), ldy = Math.sin(la);
    const ex = H.x + ldx * 1.3 * s, ey = H.y + ldy * 0.9 * s;
    prect(ctx, ex - s - (es - 1), ey, es, es, o.eyes);
    prect(ctx, ex + s - (es - 1) + (es - 1), ey, es, es, o.eyes);
    switch (o.acc) {
      case 'headband': {
        pline(ctx, H.x - hr, H.y - s, H.x + hr, H.y - s, o.c2);
        const bx = H.x - f * hr, by = H.y - s;
        const wob = Math.sin(o.time * 11) * 1.5;
        const wob2 = Math.sin(o.time * 11 + 1.7) * 1.5;
        const ext = o.moving ? 2 + 2 * run : 0;
        pline(ctx, bx, by, bx - f * (4 + ext) * s, by - 1 + wob, o.c2);
        pline(ctx, bx, by + 1, bx - f * (3 + ext) * s, by + 2 + wob2, o.c2);
        break;
      }
      case 'mohawk':
        for (let i = -1; i <= 1; i++) prect(ctx, H.x + i * es, H.y - hr - 1 - (i === 0 ? 1 : 0), es, es + (i === 0 ? 1 : 0), o.c2);
        break;
      case 'glasses':
        pline(ctx, H.x - hr + 1, H.y, H.x + hr - 1, H.y, '#0a0a0a');
        px(ctx, H.x + f, H.y, '#9be7ff');
        break;
      case 'hat':
        prect(ctx, H.x - hr - 1, H.y - hr, hr * 2 + 3, 1, o.c2);
        prect(ctx, H.x - hr + 1, H.y - hr - 2, hr * 2 - 1, 2, o.c2);
        break;
      case 'band':
        pline(ctx, H.x - hr, H.y - s, H.x + hr, H.y - s, o.c2);
        prect(ctx, H.x, H.y - hr - 1, 1, 1, o.c2);
        break;
      case 'crown':
        for (let i = -1; i <= 1; i++) {
          prect(ctx, H.x + i * 2 * es, H.y - hr - 1, es, es, '#ffd700');
          prect(ctx, H.x + i * 2 * es, H.y - hr - 2, es, es, '#ffd700');
        }
        prect(ctx, H.x - 2 * es, H.y - hr, 5 * es, 1, '#ffd700');
        break;
      case 'horns':
        pline(ctx, H.x - hr, H.y - hr + 1, H.x - hr - 2, H.y - hr - 2, o.c2);
        pline(ctx, H.x + hr, H.y - hr + 1, H.x + hr + 2, H.y - hr - 2, o.c2);
        break;
    }
    switch (o.weapon) {
      case 'pistol':
        pline(ctx, R.x, R.y, R.x + dx * 3, R.y + dy * 3, '#e6e6e6');
        px(ctx, R.x, R.y + 1, '#777');
        break;
      case 'rifle':
        pline(ctx, R.x - dx * 2, R.y - dy * 2, R.x + dx * 6, R.y + dy * 6, '#d4d4d4');
        px(ctx, R.x - dx * 3, R.y - dy * 3 + 1, '#8a5a2b');
        px(ctx, R.x + dx, R.y + dy + 1, '#8a5a2b');
        break;
      case 'smg':
        pline(ctx, R.x - dx, R.y - dy, R.x + dx * 4, R.y + dy * 4, '#9ad6e8');
        prect(ctx, R.x, R.y + 1, 1, 2, '#333');
        break;
      case 'shotgun':
        pline(ctx, R.x - dx * 2, R.y - dy * 2, R.x + dx * 6, R.y + dy * 6, '#c9a063');
        pline(ctx, R.x, R.y - 1, R.x + dx * 6, R.y + dy * 6 - 1, '#e6e6e6');
        break;
      case 'knife':
        pline(ctx, R.x + dx, R.y + dy, R.x + dx * 4, R.y + dy * 4, '#ffffff');
        break;
      case 'shield': {
        const cx = R.x + dx * 2, cy = R.y + dy * 2;
        pline(ctx, cx + pxp * 3, cy + pyp * 3, cx - pxp * 3, cy - pyp * 3, o.c2, 2);
        break;
      }
      case 'bomb':
        pcircle(ctx, R.x, R.y, 1.5, '#1a1a1a');
        px(ctx, R.x, R.y - 2, Math.floor(o.time * 16) % 2 ? '#ffffff' : '#ff9f43');
        break;
      case 'staff':
        pline(ctx, R.x - dx * 6 - pxp * 2, R.y - dy * 6 - pyp * 2, R.x + dx * 6 + pxp * 2, R.y + dy * 6 + pyp * 2, '#c9a063');
        break;
    }
  }
  ctx.globalAlpha = 1;
}

/** Draw a stick figure; optionally cross-fade from a previous pose for smooth transitions */
export function drawStick(ctx: Ctx, o: StickOpts, prev?: { pose: Pose; t: number; blend: number }) {
  let sk = solvePose(o);
  if (prev && prev.blend > 0.01 && prev.pose !== o.pose) {
    const skPrev = solvePose({ ...o, pose: prev.pose, t: prev.t });
    sk = blendSkeleton(skPrev, sk, 1 - prev.blend);
  }
  drawSkeleton(ctx, o, sk);
}

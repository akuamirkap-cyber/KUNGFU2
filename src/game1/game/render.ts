import { VW, VH, TILE, AI_TIERS, SKINS } from './data';
import type { Game, Enemy, Player, Particle } from './game';

const TAU = Math.PI * 2;
const FONT = "'Press Start 2P', monospace";

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, c: string, w = 1) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, c: string, align: CanvasTextAlign = 'left', shadow = true) {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(t, x + 1, y + 1); }
  ctx.fillStyle = c; ctx.fillText(t, x, y);
}

interface StickOpts {
  color: string; accent?: string; facing: number; walk: number; pose: string; t: number; scale: number; headR: number; body: number; legs: number;
  thick: number; sqx: number; sqy: number; weapon?: number; kind?: string; flash?: boolean; time: number; atk?: string; rot?: number; outline?: boolean; nunAng?: number; moveAng?: number; react?: number; reactAng?: number; skinBand?: string; skinHat?: string; bossWeap?: string;
  // ---- legs only (ported from game2): is the body travelling, how hard it is sprinting, half-step px ----
  moving?: boolean; run?: number; stride?: number;
  /** per-entity phase seed so idle bounces/shuffles don't sync across a crowd */
  seed?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// body-proportion multipliers shared by player + enemies (set by the BODY mode)
let G_BS = 1, G_LS = 1;
const b_accent = (o: { accent?: string }) => o.accent || '#ffd166';
const easeOutBack = (t: number) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
// -0.5 (cocked back) -> 1.15 (overshoot) -> 1 (hold) -> 0 (recover)
function strikeCurve(t: number) {
  if (t < 0.22) return -0.5 * (t / 0.22);
  if (t < 0.45) return -0.5 + 1.5 * easeOutBack((t - 0.22) / 0.23);
  if (t < 0.68) return 1;
  return 1 - (t - 0.68) / 0.32;
}
// 2-bone IK limb (shoulder/hip -> elbow/knee -> hand/foot)
function limb(ctx: CanvasRenderingContext2D, sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, bend: number, c: string, w: number) {
  let dx = tx - sx, dy = ty - sy; let d = Math.hypot(dx, dy) || 0.001;
  const maxD = l1 + l2 - 0.05; if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; tx = sx + dx; ty = sy + dy; }
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const base = Math.atan2(dy, dx);
  const ex = sx + Math.cos(base + a * bend) * l1, ey = sy + Math.sin(base + a * bend) * l1;
  line(ctx, sx, sy, ex, ey, c, w); line(ctx, ex, ey, tx, ty, c, w);
}
function bez(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, u: number) {
  const iu = 1 - u; return { x: iu * iu * ax + 2 * iu * u * bx + u * u * cx, y: iu * iu * ay + 2 * iu * u * by + u * u * cy };
}

// ----- the chibi stickman -----
export function drawStick(ctx: CanvasRenderingContext2D, x: number, y: number, o: StickOpts) {
  if (o.kind !== 'ghost') drawStickInner(ctx, x, y, { ...o, thick: o.thick + 2, headR: o.headR + 1, color: '#000', accent: '#000', flash: false, outline: true });
  drawStickInner(ctx, x, y, o);
}
function drawStickInner(ctx: CanvasRenderingContext2D, x: number, y: number, o: StickOpts) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(o.sqx * o.scale, o.sqy * o.scale);
  const c = o.flash ? '#fff' : o.color;
  const acc = o.accent || '#ffd166';
  const dirX = Math.cos(o.facing), dirY = Math.sin(o.facing);
  const fy = dirY * 0.45; // depth component for strikes
  const flip = dirX < 0 ? -1 : 1;
  const legs = o.legs, body = o.body, hr = o.headR;
  let hipY = -legs, shoulderY = -legs - body, headY = shoulderY - hr + 1;
  // 2-bone leg with a real knee joint: foot at (fx, fy), knee bends forward along the facing
  // ---- LEG IK (real human anatomy) ----
  // Two equal bones meet at the knee. The knee is solved with the circle-intersection
  // method and is ALWAYS pushed BACKWARD (heel toward butt) — never forward, never sideways.
  // fx/fy = foot position relative to the hip. bend = 0 straight, up to 0.9 = deep knee bend.
  let lean = 0;
  const w = o.thick;
  const t = clamp01(o.t);
  const sc = strikeCurve(t);
  const u = clamp01((sc + 0.5) / 1.5); // 0..1 progress of the strike path
  const atk = o.pose === 'attack' ? (o.atk || 'JAB') : '';
  const isKickAtk = atk === 'ROUNDHOUSE' || atk === 'SPIN KICK';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // whole-body transforms
  const center = -legs - body / 2;
  if (o.rot) { ctx.translate(0, center); ctx.rotate(o.rot); ctx.translate(0, -center); }
  if (o.pose === 'run') ctx.translate(Math.sin(o.walk) * 0.5, -Math.abs(Math.cos(o.walk)) * 1.3);
  else if ((o.pose === 'idle' || o.pose === 'shuffle') && o.kind !== 'ghost') ctx.translate(0, Math.sin(o.time * 2.2 + (o.seed ?? 0)) * 0.35);
  else if (o.pose === 'brake') { const bk = clamp01(o.t); ctx.translate(-Math.cos(o.moveAng ?? o.facing) * 1.8 * bk, 1.2 * bk); }
  // ALI SHUFFLE: boxer bounce — the whole body hops lightly on the balls of the feet

  if (o.pose === 'getup') { ctx.translate(0, center); ctx.rotate(flip * 0.42); ctx.translate(0, -center); ctx.translate(0, 2.2); }
  if (o.pose === 'whiff') { ctx.translate(0, center); ctx.rotate(flip * 0.24); ctx.translate(0, -center); }
  if (o.pose === 'knock') { ctx.translate(0, center); ctx.rotate(flip * 1.4); ctx.translate(0, -center); }
  if (o.pose === 'flykick') { ctx.translate(0, center); ctx.rotate(-flip * 1.15); ctx.translate(0, -center); }
  if (atk === 'SPIN KICK') { const turn = 0.3 + 0.7 * Math.abs(Math.cos(u * Math.PI)); ctx.scale(turn, 1); }
  if (atk === 'DRAGON PALM' || o.pose === 'crouch') { ctx.translate(0, o.pose === 'crouch' ? 2.5 : 1.5 * Math.max(0, sc)); }
  if (['JAB', 'CROSS', 'HOOK', 'ELBOW', 'DRAGON PALM', 'RIPOSTE'].includes(atk)) { ctx.translate(0, center); ctx.rotate(flip * Math.sin(u * Math.PI) * (atk === 'HOOK' ? 0.17 : 0.1)); ctx.translate(0, -center); }
  // TORSO TWIST: full-body rotation into swings (machete/axe/katana/staff/spear/dual)
  if (o.pose === 'attack' && (o.weapon === 4 || o.weapon === 5 || o.weapon === 6 || o.weapon === 7 || o.weapon === 8 || o.weapon === 9)) {
    const tw = Math.sin(u * Math.PI) * (0.26 + 0.1 * flip);
    ctx.translate(0, center); ctx.rotate(flip * tw); ctx.translate(0, -center);
    ctx.translate(dirX * u * 2.2, 0);
  }
  if (atk === 'CHAIN') ctx.translate(Math.sin(o.time * 85) * 0.5, Math.cos(o.time * 73) * 0.4);
  if (o.react) lean -= flip * o.react * 0.4;

  // leans
  if (o.pose === 'broken') { hipY += 2; shoulderY += 2; headY += 2; lean = Math.sin(o.time * 6) * 0.25; }
  if (o.pose === 'windup') lean = -flip * 0.25;
  if (o.pose === 'stun' || o.pose === 'fly') lean = Math.sin(o.time * 30) * 0.2;
  if (atk === 'JAB') lean = flip * (0.1 + 0.15 * sc);
  if (atk === 'CROSS') lean = flip * (0.05 + 0.4 * sc);
  if (atk === 'HOOK') lean = flip * (0.15 + 0.15 * sc);
  if (atk === 'ELBOW') lean = flip * (0.1 + 0.3 * sc);
  if (atk === 'DRAGON PALM') lean = flip * (0.1 + 0.35 * sc);
  if (isKickAtk) lean = -flip * 0.35 * u;
  if (atk === 'DRAW CUT' || atk === 'IAI CROSS') lean = flip * (0.08 + 0.3 * sc);
  if (atk === 'OVERHEAD') lean = flip * (0.05 + 0.28 * sc);
  if (atk === 'THRUST' || atk === 'RIPOSTE') lean = flip * (0.1 + 0.45 * sc);
  if (atk === 'SPIN IAI') lean = -flip * 0.3 * u;
  if (o.pose === 'run') lean = flip * 0.42 + Math.sin(o.walk) * 0.07;
  if (o.pose === 'brake') lean = -flip * 0.5 * clamp01(o.t);
  if (o.pose === 'sidekick') lean = -flip * 0.2;
  if (o.pose === 'rushpunch') lean = flip * 0.7;
  if (o.pose === 'uppercut') lean = -flip * 0.2;
  if (o.pose === 'crouch') lean = flip * 0.2;

  // ---------- LEGS ----------
  // Two-bone leg with a real knee. The knee is solved with the circle-intersection
  // method and ALWAYS bends BACKWARD (heel toward the butt) — like a human leg.
  const L1 = legs * 0.52, L2 = legs * 0.52;
  const legJoint = (fx: number, footY: number) => {
    let dx = fx, dy = footY - hipY;
    let d = Math.hypot(dx, dy);
    const maxD = (L1 + L2) * 0.97;
    if (d > maxD) { dx = dx / d * maxD; dy = dy / d * maxD; d = maxD; }
    if (d < 0.001) { dx = 0.0001; dy = legs * 0.5; d = Math.hypot(dx, dy); }
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    // perpendicular offset flips with facing => knee always points BACKWARD
    const kneeX = (dx * a) / d - (dy / d) * h * -flip;
    const kneeY = (dy * a) / d + (dx / d) * h * -flip;
    limb(ctx, 0, hipY, kneeX, hipY + kneeY, legs * 0.4, legs * 0.4, flip > 0 ? -flip : flip, c, w);
    limb(ctx, kneeX, hipY + kneeY, dx, hipY + dy, legs * 0.4, legs * 0.4, flip > 0 ? flip : -flip, c, w);
    circle(ctx, dx, hipY + dy, w * 0.8, c);
  };
  // ==================== LEGS: GAME2 GAIT (ported from game2/game/stick.ts) ====================
  // ONLY the legs come from game2. Torso, arms, weapon grips and every attack/fatality pose below
  // are untouched, so weapons 1-9 keep game1's exact handling.
  // game2 steps in WORLD space: during the stance phase the foot is PLANTED (it drifts backwards
  // relative to the body), during the swing phase it flies forward on a bell curve and lands ahead
  // of the hip. game.ts advances `walk` with the real ground speed, so a planted foot never slides.
  // Knees bend toward the travel direction and lift while the leg swings through.
  const GS = (legs * 0.76) / 4;          // game2's hip sits 4*scale above its feet; game1's foot line is legs*0.76 below the hip
  const GAIT_DEPTH = 0.6;                // game2's own foreshortening for the depth (screen y) axis
  const gux = Math.cos(o.moveAng ?? o.facing), guy = Math.sin(o.moveAng ?? o.facing);
  const gsx = -guy, gsy = gux;           // sideways axis
  const groundY = hipY + legs * 0.76;    // game1's foot baseline (unchanged)
  const grun = clamp01(o.run ?? 0);      // 0 = walk .. 1 = full sprint
  const gstride = (o.stride ?? 2.6 + 2.6 * grun) * GS;
  // a 2-bone leg solved game2-style: knee = midpoint(hip,foot) + perpendicular * h * bend, the bend
  // side is picked so the knee points along (kx,ky); `up` lifts the knee during the swing phase.
  const gaitLeg = (fx: number, fy: number, up: number, kx: number, ky: number) => {
    const dy = fy - hipY, d = Math.hypot(fx, dy);
    const legLen = 5.2 * GS;             // game2: hip 4 -> leg reach 5.2, so the knee can actually bend
    const half = legLen / 2;
    const h = d < legLen ? Math.sqrt(Math.max(0, half * half - (d / 2) * (d / 2))) : 0;
    if (d < 1.0 * GS) {
      // peak of the swing at a full sprint: the foot is tucked right up at the hip, so fold the leg
      // (knee leads forward) instead of drawing a degenerate zero-length line.
      const kd = Math.hypot(kx, ky) || 1;
      const jx0 = (kx / kd) * 1.15 * GS, jy0 = hipY + (ky / kd) * 1.15 * GS * GAIT_DEPTH + 0.5 * GS;
      line(ctx, 0, hipY, jx0, jy0, c, w); line(ctx, jx0, jy0, fx, fy, c, w);
      circle(ctx, fx, fy, w * 0.8, c); return;
    }
    if (h < 0.7 * GS) {                  // over-extended -> straight leg (game2 drops the knee there too)
      line(ctx, 0, hipY, fx, fy, c, w); circle(ctx, fx, fy, w * 0.8, c); return;
    }
    const nx = -dy / d, ny = fx / d;
    const dot = nx * kx + ny * ky;
    const bend = Math.abs(dot) < 0.05 ? -flip : dot > 0 ? 1 : -1;
    const jx = fx / 2 + nx * h * bend, jy = hipY + dy / 2 + ny * h * bend - up;
    line(ctx, 0, hipY, jx, jy, c, w);
    line(ctx, jx, jy, fx, fy, c, w);
    circle(ctx, fx, fy, w * 0.8, c);
  };
  const legPhase = (ph: number) => {
    // q = -PI/2 toe-off (foot furthest BACK) .. +PI/2 heel strike (foot furthest FORWARD).
    // cos(q) > 0 -> swing (airborne, flying forward);  cos(q) < 0 -> stance (planted, moving back).
    const q = ((((ph + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    let air = 0;
    if (Math.cos(q) > 0) air = Math.sin(((q + Math.PI / 2) / Math.PI) * Math.PI);
    return { along: Math.sin(q) * gstride, air };
  };
  const gaitLegs = () => {
    const lift = (1.6 + 2.4 * grun) * GS;
    const side = 0.7 * GS * flip;        // small lateral offset so the two feet never overlap
    const fl = legPhase(o.walk), bl = legPhase(o.walk + Math.PI);
    const kneeUp = (0.6 + 1.6 * grun) * GS * Math.max(fl.air, bl.air);
    const put = (l: { along: number; air: number }, s: number, up: number) => gaitLeg(
      gux * l.along + gsx * s,
      groundY + (guy * l.along + gsy * s) * GAIT_DEPTH - l.air * lift,
      up, gux, guy);
    put(fl, side, kneeUp); put(bl, -side, kneeUp * 0.6);
  };
  const idleLegs = () => {
    // game2 IDLE: planted staggered stance — now with an anime READY BOUNCE:
    // knee spring, slow weight shift, tumit belakang ngangkat, dan mini-hop shuffle tiap ~3.2s
    const dz = dirY * 0.9 * GS * GAIT_DEPTH, dxx = dirX * 0.6 * GS;
    const sd = o.seed ?? 0;
    const bt = o.time * 3.6 + sd;
    const bounce = Math.sin(bt);                       // pegas lutut
    const shift = Math.sin(bt * 0.5) * 0.85;           // pindah berat kaki ke kaki
    const cyc = (o.time + sd * 0.37) % 3.2;
    const shuf = cyc > 2.85 ? Math.sin((cyc - 2.85) / 0.35 * Math.PI) : 0;  // hop ganti kaki
    const heel = Math.max(0, bounce) * 1.7 * GS;       // tumit belakang naik saat siap
    gaitLeg((2.4 + shift + shuf * 1.5) * GS * flip + dxx, groundY + dz - shuf * 2.4 * GS, shuf * 1.8 * GS, dirX, dirY);
    gaitLeg((-2 - shift - shuf * 1.5) * GS * flip + dxx, groundY - dz - heel, heel > 0.3 * GS ? 1.1 * GS : 0, dirX, dirY);
  };
  const stepping = o.moving !== false;   // undefined (corpses, title demo, ghosts) keeps stepping
  if (o.pose === 'broken') { line(ctx, 0, hipY, -3, 0, c, w); line(ctx, 0, hipY, 3, 0, c, w); }
  else if (o.pose === 'sweep') { const a = t * 22; limb(ctx, 0, hipY, Math.cos(a) * 10, hipY + Math.sin(a) * 4 + 2, 6, 6, flip, c, w); line(ctx, 0, hipY, -1, 0, c, w); }
  else if (o.pose === 'flykick') { line(ctx, 0, hipY, 1, hipY + 11, c, w); line(ctx, 0, hipY, -2, hipY + 8, c, w); }
  else if (o.pose === 'sidekick') { line(ctx, 0, hipY, dirX * 13, hipY + dirY * 13 - 2, c, w); circle(ctx, dirX * 13, hipY + dirY * 13 - 2, w * 0.9, c); limb(ctx, 0, hipY, -dirX * 4, hipY + 5, 5, 5, flip, c, w); }
  else if (o.pose === 'run') { gaitLegs(); }
  else if (o.pose === 'rushpunch') { line(ctx, 0, hipY, -dirX * 6, hipY + 1, c, w); line(ctx, 0, hipY, -dirX * 4, hipY + 3, c, w); }
  else if (o.pose === 'jump') { line(ctx, 0, hipY, dirX * 2, hipY + 2, c, w); line(ctx, 0, hipY, dirX * 1, hipY + 3, c, w); }
  else if (o.pose === 'crouch') { legJoint(-flip * 3, hipY + legs * 0.5); legJoint(flip * 3, hipY + legs * 0.5); }
  else if (o.pose === 'uppercut') { legJoint(dirX * 4, hipY + legs * 0.7); legJoint(-dirX * 2.5, hipY + legs * 0.8); }
  else if (o.pose === 'axekick') {
    const ph = -Math.PI / 2 + t * (Math.PI / 2 + 1.1);
    const footX = flip * Math.cos(ph) * 11, footY = hipY + Math.sin(ph) * 11;
    limb(ctx, 0, hipY, footX, footY, 6, 6, -flip, c, w); line(ctx, 0, hipY, -dirX * 1, 0, c, w);
    circle(ctx, footX, footY, w * 0.8, c);
  }
  else if (o.pose === 'fly') { const k1 = Math.sin(o.time * 15) * 3.4; line(ctx, 0, hipY, k1, hipY + 4.5, c, w); line(ctx, 0, hipY, -k1, hipY + 4.5, c, w); }
  else if (o.pose === 'attack' && isKickAtk) {
    const kickPt = (uu: number) => {
      if (atk === 'ROUNDHOUSE') { const target = flip > 0 ? -0.2 : Math.PI + 0.2; const ph = Math.PI / 2 + (target - Math.PI / 2) * Math.min(1.08, uu * 1.08); const rr = legs + (11 - legs) * Math.min(1, uu * 2.5); return { x: Math.cos(ph) * rr, y: hipY + Math.sin(ph) * rr }; }
      const ph = Math.PI * 0.5 + flip * uu * Math.PI * 1.6; return { x: Math.cos(ph) * 11, y: hipY + Math.sin(ph) * 4 - 2 };
    };
    const kp = kickPt(u);
    limb(ctx, 0, hipY, kp.x, kp.y, 6, 6, -flip, c, w); legJoint(-dirX * 2, hipY + legs * 0.72);
    circle(ctx, kp.x, kp.y, w * 0.8, c);
  }
  else if (o.pose === 'attack') {
    // staggered boxing stance: one foot forward along the facing, one back
    const fwd = (atk === 'CROSS' || atk === 'DRAGON PALM' ? 3.0 : 2.4) * flip;
    const bob = Math.sin(o.time * 8) * 0.45;
    legJoint(fwd, hipY + legs * 0.66 + bob);
    legJoint(-fwd * 0.5, hipY + legs * 0.74 - bob);
  }
  else if (o.pose === 'windup') {
    legJoint(dirX * 1.2, hipY + legs * 0.68);
    legJoint(-dirX * 1.8, hipY + legs * 0.76);
  }
  else if (o.pose === 'getup') { legJoint(dirX * 2.5, hipY + legs * 0.5); legJoint(-dirX * 4.5, hipY + legs * 0.85); }
  else if (o.pose === 'whiff') { legJoint(flip * 3, hipY + legs * 0.55); legJoint(-flip * 4, hipY + legs * 0.8); }
  else if (o.pose === 'brake') {
    // ANIME SKID: kaki depan ngerem nancep jauh ke depan, kaki belakang nyeret ngangkat tumit,
    // lutut ditekuk dalam, badan condong mundur (lihat lean + translate di atas)
    const k = clamp01(o.t);
    gaitLeg(gux * (2.2 + 3.8 * k) * GS, groundY + guy * (2.2 + 3.8 * k) * GS * GAIT_DEPTH - 0.2 * GS * k, k * 1.4 * GS, gux, guy);
    gaitLeg(-gux * (2.4 + 2.8 * k) * GS + gsx * 0.9 * flip, groundY - guy * (2.4 + 2.8 * k) * GS * GAIT_DEPTH - 1.3 * GS * k, 0.6 * GS * k, gux, guy);
  }
  else if (o.pose === 'shuffle') { idleLegs(); }
  else if (stepping) { gaitLegs(); }
  else { idleLegs(); }

  // ---------- BODY ----------
  const topX = lean * body + (atk === 'CROSS' ? dirX * sc * 1.5 : 0);
  line(ctx, 0, hipY, topX, shoulderY, c, w);
  const sx = topX, sy = shoulderY + 1;

  // ---------- ARMS ----------
  const guardArm = () => limb(ctx, sx, sy, sx + dirX * 1.5, sy + 1.5, 4, 4, -flip, c, w);
  if (o.pose === 'attack' && o.weapon === 7) {
    // ===== BO STAFF: long spinning pole =====
    const swp2 = (uu: number, from: number, to: number, snap = 0.5) => {
      if (uu < 0.18) return from - Math.sign(to - from) * 0.5 * (uu / 0.18);
      const v = Math.min(1, (uu - 0.18) / snap); const e3 = 1 - Math.pow(1 - v, 3);
      return from + (to - from) * e3;
    };
    const baAt2 = (uu: number) => {
      switch (atk) {
        case 'STAFF JAB': return o.facing;
        case 'STAFF SWING': return o.facing + swp2(uu, -2.25, 1.25);
        case 'STAFF TWIRL': return o.facing + uu * TAU * 1.3;
        case 'VAULT STRIKE': return o.facing + swp2(uu, -2.85, 0.05, 0.4);
        default: return o.facing + swp2(uu, -2.2, 1.2);
      }
    };
    const ba = baAt2(u), ca = Math.cos(ba), sa2 = Math.sin(ba);
    const gx = sx + dirX * 3.5, gy = sy + dirY * 3.5 + 1;
    if (!o.outline) { const n = u > 0.16 && u < 0.5 ? 5 : 2; for (let i = n; i >= 1; i--) { const a2 = baAt2(Math.max(0, u - i * (n > 2 ? 0.045 : 0.08))); ctx.globalAlpha = Math.max(0.05, 0.3 - i * (n > 2 ? 0.05 : 0.09)); line(ctx, gx - Math.cos(a2) * 17, gy - Math.sin(a2) * 17, gx + Math.cos(a2) * 17, gy + Math.sin(a2) * 17, '#ffd166', 1.6); } }
    ctx.globalAlpha = 1;
    const ext = atk === 'STAFF JAB' ? 5 * Math.min(1, Math.max(0, (u - 0.1) / 0.4)) : 0;
    const cxp = gx + ca * ext, cyp = gy + sa2 * ext;
    line(ctx, cxp - ca * 17, cyp - sa2 * 17, cxp + ca * 17, cyp + sa2 * 17, '#000', 3.4);
    line(ctx, cxp - ca * 17, cyp - sa2 * 17, cxp + ca * 17, cyp + sa2 * 17, '#c99a52', 1.8);
    if (!o.outline) { px(ctx, cxp + ca * 17 - 1.5, cyp + sa2 * 17 - 1.5, 3, 3, '#7a4a16'); px(ctx, cxp - ca * 17 - 1.5, cyp - sa2 * 17 - 1.5, 3, 3, '#7a4a16'); }
    limb(ctx, sx, sy, cxp + ca * 2 - sa2 * 1.5, cyp + sa2 * 2 + ca * 1.5, 5, 5, -flip, c, w);
    limb(ctx, sx, sy, cxp - ca * 2 + sa2 * 1.5, cyp - sa2 * 2 - ca * 1.5, 5, 5, flip, c, w);
  } else if (o.pose === 'attack' && o.weapon === 8) {
    // ===== SANADA CROSS SPEAR: longest reach in the game =====
    const swp3 = (uu: number, from: number, to: number, snap = 0.5) => {
      if (uu < 0.15) return from - Math.sign(to - from) * 0.5 * (uu / 0.15);
      const v = Math.min(1, (uu - 0.15) / snap); const e3 = 1 - Math.pow(1 - v, 3);
      return from + (to - from) * e3;
    };
    const baAt3 = (uu: number) => {
      switch (atk) {
        case 'SPEAR THRUST': case 'SANADA CHARGE': return o.facing;
        case 'SPEAR SWEEP': return o.facing + swp3(uu, -2.35, 1.15);
        case 'WHIRLWIND': return o.facing + uu * TAU * 1.35;
        default: return o.facing;
      }
    };
    const ba = baAt3(u), ca = Math.cos(ba), sa2 = Math.sin(ba);
    const ext = (atk === 'SPEAR THRUST' || atk === 'SANADA CHARGE') ? Math.min(1, Math.max(0, (u - 0.08) / 0.42)) : 0.4;
    const gx = sx + ca * (3 + 6 * ext), gy = sy + sa2 * (3 + 6 * ext) + 0.5;
    if (!o.outline) { const n = u > 0.16 && u < 0.5 ? 5 : 2; for (let i = n; i >= 1; i--) { const a2 = baAt3(Math.max(0, u - i * (n > 2 ? 0.04 : 0.07))); ctx.globalAlpha = Math.max(0.05, 0.3 - i * (n > 2 ? 0.05 : 0.09)); line(ctx, gx, gy, gx + Math.cos(a2) * 22, gy + Math.sin(a2) * 22, '#ffb3b3', 1.4); } }
    ctx.globalAlpha = 1;
    limb(ctx, sx, sy, gx, gy, 5, 5, -flip, c, w);
    limb(ctx, sx, sy, gx - ca * 3.5, gy - sa2 * 3.5 + 1, 5, 5, flip, c, w);
    // shaft
    line(ctx, gx - ca * 6, gy - sa2 * 6, gx + ca * 16, gy + sa2 * 16, '#000', 3);
    line(ctx, gx - ca * 6, gy - sa2 * 6, gx + ca * 16, gy + sa2 * 16, '#8a5a2a', 1.7);
    // jumonji cross blade + tip
    const bx = gx + ca * 15, by = gy + sa2 * 15, pxn = -sa2, pyn = ca;
    line(ctx, bx - pxn * 4, by - pyn * 4, bx + pxn * 4, by + pyn * 4, '#000', 3.2);
    line(ctx, bx - pxn * 4, by - pyn * 4, bx + pxn * 4, by + pyn * 4, '#e8eef4', 1.7);
    line(ctx, bx, by, bx + ca * 6, by + sa2 * 6, '#000', 3);
    line(ctx, bx, by, bx + ca * 6, by + sa2 * 6, '#ffffff', 1.5);
    if (!o.outline) {
      px(ctx, bx + ca * 6 - 1, by + sa2 * 6 - 1, 2, 2, '#fff');
      // crimson tassel under the blade
      const wv = Math.sin(o.time * 12) * 1.6;
      line(ctx, bx, by, bx - ca * 2 + pxn * 3, by - sa2 * 2 + pyn * 3 + wv, '#c02830', 1.4);
    }
  } else if (o.pose === 'attack' && o.weapon === 5) {
    // ===== AXE: baseball-bat swings =====
    const swp = (uu: number, from: number, to: number, snap = 0.5) => {
      if (uu < 0.2) return from - Math.sign(to - from) * 0.6 * (uu / 0.2);
      const v = Math.min(1, (uu - 0.2) / snap); const e3 = 1 - Math.pow(1 - v, 3);
      return from + (to - from) * e3 + Math.sin(v * Math.PI) * 0.18 * Math.sign(to - from);
    };
    const saAt = (uu: number) => {
      switch (atk) {
        case 'BAT SWING': return o.facing + swp(uu, -2.45, 1.25);
        case 'BACK SWING': return o.facing + swp(uu, 2.45, -1.25);
        case 'OVERHEAD CHOP': return o.facing + swp(uu, -2.95, -0.02, 0.38);
        case 'HOME RUN': return o.facing + swp(uu, -2.65, 1.55, 0.55);
        default: return o.facing + swp(uu, -2.45, 1.25);
      }
    };
    const sa = saAt(u);
    const ext = u < 0.18 ? 0 : Math.min(1, Math.pow((u - 0.18) / 0.3, 0.6));
    const gx = sx + dirX * (3 + 3 * ext), gy = sy + dirY * (3 + 3 * ext);
    limb(ctx, sx, sy, gx, gy, 5, 5, -flip, c, w);
    limb(ctx, sx, sy, gx - dirX * 1.6, gy - dirY * 1.6 + 1, 5, 5, flip, c, w);
    const ca = Math.cos(sa), sna = Math.sin(sa);
    const hx0 = gx - ca * 5, hy0 = gy - sna * 5, hx1 = gx + ca * 13, hy1 = gy + sna * 13;
    if (!o.outline) { const n = u > 0.16 && u < 0.5 ? 6 : 2; for (let i = n; i >= 1; i--) { const a2 = saAt(Math.max(0, u - i * (n > 2 ? 0.04 : 0.08))); ctx.globalAlpha = Math.max(0.05, 0.32 - i * (n > 2 ? 0.045 : 0.1)); line(ctx, gx, gy, gx + Math.cos(a2) * 14, gy + Math.sin(a2) * 14, '#ffb060', 2); } }
    ctx.globalAlpha = 1;
    line(ctx, hx0, hy0, hx1, hy1, '#000', 3.6);
    line(ctx, hx0, hy0, hx1, hy1, '#8a5a2a', 1.9);
    // axe head: wedge blade at the tip
    const perpX = -sna, perpY = ca;
    line(ctx, hx1 - perpX * 4.5, hy1 - perpY * 4.5, hx1 + perpX * 2 + ca * 3, hy1 + perpY * 2 + sna * 3, '#000', 4.4);
    line(ctx, hx1 - perpX * 4.5, hy1 - perpY * 4.5, hx1 + perpX * 2 + ca * 3, hy1 + perpY * 2 + sna * 3, '#d7dee8', 2.6);
    line(ctx, hx1 - perpX * 4.5, hy1 - perpY * 4.5, hx1 + perpX * 2 + ca * 3, hy1 + perpY * 2 + sna * 3, '#ffffff', 0.8);
  } else if (o.pose === 'attack' && o.weapon === 6) {
    // ===== DUAL BLADES: twin daggers =====
    const swp = (uu: number, from: number, to: number, snap = 0.45) => {
      if (uu < 0.15) return from - Math.sign(to - from) * 0.5 * (uu / 0.15);
      const v = Math.min(1, (uu - 0.15) / snap); const e3 = 1 - Math.pow(1 - v, 3);
      return from + (to - from) * e3;
    };
    const baAt = (uu: number, off: boolean) => {
      switch (atk) {
        case 'L SLASH': return off ? o.facing + 0.6 : o.facing + swp(uu, 2.1, -1.05);
        case 'R SLASH': return off ? o.facing - 0.6 : o.facing + swp(uu, -2.1, 1.05);
        case 'CROSS SCISSOR': return off ? o.facing + swp(uu, -1.9, 0.3) : o.facing + swp(uu, 1.9, -0.3);
        case 'DUAL SPIN': return o.facing + uu * TAU + (off ? Math.PI : 0);
        case 'TWIN FANG': return o.facing;
        default: return o.facing + swp(uu, 2.0, -1.0);
      }
    };
    const blade = (gx: number, gy: number, ba: number, len: number) => {
      line(ctx, gx, gy, gx + Math.cos(ba) * len, gy + Math.sin(ba) * len, '#000', 2.4);
      line(ctx, gx, gy, gx + Math.cos(ba) * len, gy + Math.sin(ba) * len, '#eaf6ff', 1.2);
      if (!o.outline) px(ctx, gx + Math.cos(ba) * len - 1, gy + Math.sin(ba) * len - 1, 2, 2, '#fff');
    };
    const ext = Math.min(1, Math.max(0, (u - 0.1) / 0.4));
    const baM = baAt(u, false), baO = baAt(u, true);
    const reach = atk === 'TWIN FANG' ? 4 + 7 * ext : 4 + 3.5 * ext;
    const gm = { x: sx + Math.cos(baM) * reach, y: sy + Math.sin(baM) * reach };
    const go = { x: sx + Math.cos(baO) * 4, y: sy + Math.sin(baO) * 4 + 1.5 };
    limb(ctx, sx, sy, gm.x, gm.y, 5, 5, -flip, c, w);
    limb(ctx, sx, sy, go.x, go.y, 5, 5, flip, c, w);
    if (!o.outline && atk !== 'DUAL SPIN') for (let i = 2; i >= 1; i--) { const a2 = baAt(Math.max(0, u - i * 0.07), false); ctx.globalAlpha = 0.3 - i * 0.11; line(ctx, gm.x, gm.y, gm.x + Math.cos(a2) * 12, gm.y + Math.sin(a2) * 12, '#cfe8ff', 1.2); }
    ctx.globalAlpha = 1;
    blade(gm.x, gm.y, baM, atk === 'TWIN FANG' ? 11 + 7 * ext : 12);
    blade(go.x, go.y, baO, 11);
  } else if (o.pose === 'attack' && o.weapon === 4) {
    // ==================== KATANA (oversized for readability) ====================
    // Big, curved, high-contrast. Blade ≈ 1.5x body height so it reads on screen.
    const swp = (uu: number, from: number, to: number, snap = 0.42) => {
      if (uu < 0.22) return from - Math.sign(to - from) * 0.75 * (uu / 0.22);   // DEEP anticipation
      const v = Math.min(1, (uu - 0.22) / snap);
      const e3 = 1 - Math.pow(1 - v, 2.2);                                       // SNAP forward
      const ov = Math.sin(v * Math.PI) * 0.22 * Math.sign(to - from);            // OVERSHOOT
      return from + (to - from) * e3 + ov;
    };
    const baAt = (uu: number) => {
      switch (atk) {
        case 'DRAW CUT': return o.facing + swp(uu, 2.6, -1.35);
        case 'IAI CROSS': return o.facing + swp(uu, -2.8, 1.35);
        case 'OVERHEAD': return o.facing + swp(uu, -3.1, 0.35, 0.34);
        case 'SPIN IAI': return o.facing + uu * TAU * 1.1;
        case 'THRUST': case 'RIPOSTE': return o.facing;
        case 'SHEATHE FLASH': return o.facing + swp(uu, 1.2, -2.6, 0.26);
        default: return o.facing + swp(uu, 2.5, -1.3);
      }
    };
    const ba = baAt(u);
    const isThrust = atk === 'THRUST' || atk === 'RIPOSTE';
    const u2 = Math.min(1, u);
    const ext = u2 < 0.2 ? 0 : Math.min(1, Math.pow((u2 - 0.2) / 0.26, 0.5));
    const TSUKA = 4.5, BLADE = isThrust ? 15 + 7 * ext : 19;
    const ca = Math.cos(ba), sa = Math.sin(ba), pa = -sa, pb = ca;
    // hands pull the grip INTO the body, then extend on the strike
    const gripX = sx + ca * (2 + 5 * ext), gripY = sy + sa * (2 + 5 * ext) + 0.5;
    const tbX = gripX + ca * TSUKA, tbY = gripY + sa * TSUKA;
    const tipX = tbX + ca * BLADE, tipY = tbY + sa * BLADE;
    // ---- saya (sheath) at the hip ----
    if (!o.outline) {
      const shA = o.facing - 2.0, shx = sx - dirX * 3, shy = sy + 7;
      line(ctx, shx, shy, shx + Math.cos(shA) * 13, shy + Math.sin(shA) * 13, '#0d1218', 3.4);
      line(ctx, shx, shy, shx + Math.cos(shA) * 13, shy + Math.sin(shA) * 13, '#2a3948', 2);
      px(ctx, shx + Math.cos(shA) * 13 - 1.5, shy + Math.sin(shA) * 13 - 1.5, 3, 3, '#8a7a52');
    }
    // ---- SMEAR FRAMES: big fat arc that sweeps the whole blade ----
    const snap = u2 > 0.22 && u2 < 0.5;
    if (!o.outline) {
      const n = snap ? 4 : 2;
      for (let i = n; i >= 1; i--) {
        const au = Math.max(0, u2 - i * (snap ? 0.05 : 0.09)), b2 = baAt(au);
        ctx.globalAlpha = Math.max(0.08, (snap ? 0.34 : 0.2) - i * (snap ? 0.06 : 0.08));
        const c2 = Math.cos(b2), s2 = Math.sin(b2);
        line(ctx, gripX + c2 * TSUKA, gripY + s2 * TSUKA, gripX + c2 * (TSUKA + BLADE), gripY + s2 * (TSUKA + BLADE), '#cfe6f7', snap ? 2.2 : 1.4);
      }
      ctx.globalAlpha = 1;
    }
    // ---- both hands on the tsuka ----
    limb(ctx, sx, sy, gripX + ca * 5, gripY + sa * 5, 5.5, 5.5, -flip, c, w);
    limb(ctx, sx, sy, gripX - ca * 2.2, gripY - sa * 2.2 + 0.5, 5.5, 5.5, flip, c, w);
    // ---- TSUKA: white ray-skin + dark wrap diamonds ----
    line(ctx, gripX - ca * 1.5, gripY - sa * 1.5, tbX, tbY, '#000', 5.2);
    line(ctx, gripX - ca * 1.5, gripY - sa * 1.5, tbX, tbY, '#efe6d4', 3.4);
    for (let i = 0; i < 4; i++) {
      const f = 0.8 + i * 1.5;
      const wx = gripX + ca * f, wy = gripY + sa * f;
      line(ctx, wx + pa * 1.7, wy + pb * 1.7, wx - pa * 1.7, wy - pb * 1.7, '#1e2836', 1.7);
    }
    px(ctx, gripX - ca * 2 - 1.6, gripY - sa * 2 - 1.6, 3.2, 3.2, '#2c3644'); // kashira
    // ---- TSUBA: big oval guard ----
    ctx.save(); ctx.translate(tbX, tbY); ctx.rotate(ba);
    ctx.fillStyle = '#080b0f'; ctx.beginPath(); ctx.ellipse(0, 0, 1.6, 5.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a8894e'; ctx.beginPath(); ctx.ellipse(0, 0, 1.0, 3.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e0c684'; ctx.beginPath(); ctx.ellipse(0, 0, 0.45, 1.8, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // ---- CURVED BLADE: thick outline, spine, mirror edge, hamon ----
    const B = (f: number) => {
      const bend = f * f * 0.016;
      return [tbX + ca * f + pa * bend, tbY + sa * f + pb * bend];
    };
    const N = 12;
    const mid: number[][] = [], sp: number[][] = [], ed: number[][] = [];
    for (let i = 0; i <= N; i++) {
      const f = (i / N) * BLADE;
      const q = B(f);
      mid.push(q);
      sp.push([q[0] + pa * 2.4, q[1] + pb * 2.4]);
      ed.push([q[0] - pa * 2.4, q[1] - pb * 2.4]);
    }
    const trace = (pts: number[][], col: string, w2: number, alpha = 1) => {
      ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach((q, i) => i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])); ctx.stroke(); ctx.globalAlpha = 1;
    };
    // black silhouette (spine outline + edge outline + closed tip/base)
    trace(sp, '#05070a', 5.4); trace(ed, '#05070a', 5.4);
    line(ctx, sp[N][0], sp[N][1], ed[N][0], ed[N][1], '#05070a', 5.4);
    line(ctx, sp[0][0], sp[0][1], ed[0][0], ed[0][1], '#05070a', 4.6);
    // steel body
    trace(mid, '#9fb6c8', 3.2);
    trace(sp, '#4e5f70', 1.6);                       // mune (spine)
    trace(ed, '#ffffff', 2.2);                       // ha (cutting edge) — brightest
    // ---- HAMON: wavy temper line ----
    if (!o.outline) {
      ctx.globalAlpha = 0.65; ctx.strokeStyle = '#f6fdff'; ctx.lineWidth = 0.9; ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const f = (i / N) * BLADE, w2 = Math.sin(f * 1.15) * 1.1;
        const q = mid[i];
        i === 0 ? ctx.moveTo(q[0] - pa * (0.2 + w2), q[1] - pb * (0.2 + w2)) : ctx.lineTo(q[0] - pa * (0.2 + w2), q[1] - pb * (0.2 + w2));
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    // ---- KISSAKI + travelling glint ----
    if (!o.outline) {
      line(ctx, tipX - pa * 5, tipY - pb * 5, tipX, tipY, '#ffffff', 2.6);
      px(ctx, tipX - 2, tipY - 2, 4, 4, '#ffffff');
      px(ctx, tipX - 2, tipY - 2, 4, 4, b_accent(o));
      const gp = (Math.sin(o.time * 7) + 1) / 2, gq = B(4 + gp * (BLADE - 8));
      px(ctx, gq[0] - 1.8, gq[1] - 0.8, 3.6, 1.6, '#ffffff');
    }
  } else if (o.pose === 'attack' && atk === 'CHAIN') {
    // Wing Chun: alternating centerline punches at blinding speed
    const alt = Math.floor(o.time * 16) % 2 === 0 ? 1 : -1;
    const perpX = -dirY * alt, perpY = dirX * alt;
    const ext = 3 + 8.5 * Math.min(1, Math.max(0, (u - 0.08) / 0.5));
    const fx2 = sx + dirX * ext + perpX * 2.1, fy2 = sy + dirY * ext + perpY * 2.1;
    if (!o.outline) { ctx.globalAlpha = 0.35; circle(ctx, sx + dirX * ext * 0.55 + perpX * 2.1, sy + dirY * ext * 0.55 + perpY * 2.1, w * 0.8, c); ctx.globalAlpha = 1; }
    limb(ctx, sx, sy, fx2, fy2, 5, 5, -flip, c, w); circle(ctx, fx2, fy2, w * 0.95, c);
    const cx2 = sx - dirX * 2.5 - perpX * 2.4, cy2 = sy + 2 - perpY * 2.4;
    limb(ctx, sx, sy, cx2, cy2, 4.5, 4.5, flip, c, w); circle(ctx, cx2, cy2, w * 0.9, c);
  } else if (o.pose === 'attack' && atk.startsWith('NUN')) {
    const na = o.nunAng ?? o.facing, lx = Math.cos(na), ly = Math.sin(na);
    limb(ctx, sx, sy, sx + lx * 8, sy + ly * 8, 5, 5, -flip, c, w); circle(ctx, sx + lx * 8, sy + ly * 8, w * 0.9, c);
    guardArm();
  } else if (o.pose === 'attack' && o.weapon === 9) {
    // ==================== MACHETE (oversized bolo) ====================
    // Broad chopping blade, wild diagonal swings, brutal follow-through.
    const swp = (uu: number, from: number, to: number, snap = 0.4) => {
      if (uu < 0.24) return from - Math.sign(to - from) * 0.95 * (uu / 0.24);   // HUGE wind-up
      const v = Math.min(1, (uu - 0.24) / snap);
      const e3 = 1 - Math.pow(1 - v, 1.9);
      const ov = Math.sin(v * Math.PI) * 0.3 * Math.sign(to - from);            // big overshoot
      return from + (to - from) * e3 + ov;
    };
    const saAt = (uu: number) => {
      switch (atk) {
        case 'DIAGONAL CHOP': return o.facing + swp(uu, -3.0, 1.5);
        case 'REVERSE HOOK': return o.facing + swp(uu, 3.0, -1.5);
        case 'OVERHEAD CLEAVE': return o.facing + swp(uu, -3.3, 0.5, 0.34);
        case 'JUNGLE SPIN': return o.facing + uu * TAU * 1.3;
        default: return o.facing + swp(uu, -3.0, 1.5);
      }
    };
    const sa2 = saAt(u);
    const u2 = Math.min(1, u);
    const ext = u2 < 0.22 ? 0 : Math.min(1, Math.pow((u2 - 0.22) / 0.24, 0.5));
    const ca = Math.cos(sa2), s2 = Math.sin(sa2), pa = -s2, pb = ca;
    const GRIP = 4, BLADE = 17;
    const gx = sx + dirX * (3 + 4 * ext), gy = sy + dirY * (3 + 4 * ext) + 1;
    const bx = gx + ca * GRIP, by = gy + s2 * GRIP;
    const tipX = bx + ca * BLADE, tipY = by + s2 * BLADE;
    // ---- smear: fat, hot-coloured arc (it's a hacking blade) ----
    const snap = u2 > 0.24 && u2 < 0.52;
    if (!o.outline) {
      const n = snap ? 4 : 2;
      for (let i = n; i >= 1; i--) {
        const au = Math.max(0, u2 - i * (snap ? 0.05 : 0.09)), a2 = saAt(au);
        ctx.globalAlpha = Math.max(0.08, (snap ? 0.32 : 0.18) - i * (snap ? 0.06 : 0.075));
        const c2 = Math.cos(a2), s3 = Math.sin(a2);
        line(ctx, gx + c2 * GRIP, gy + s3 * GRIP, gx + c2 * (GRIP + BLADE), gy + s3 * (GRIP + BLADE), snap ? '#f0c39a' : '#c99a72', snap ? 2.6 : 1.5);
      }
      ctx.globalAlpha = 1;
    }
    // ---- one hand on the grip, off arm flung for balance ----
    limb(ctx, sx, sy, gx, gy, 5.5, 5.5, -flip, c, w);
    limb(ctx, sx, sy, sx - dirX * 4 - pa * 2, sy + 3 - pb * 2, 5.5, 5.5, flip, c, w);
    // ---- GRIP: dark wood, pommel ----
    line(ctx, gx - ca * 2, gy - s2 * 2, bx, by, '#000', 5.4);
    line(ctx, gx - ca * 2, gy - s2 * 2, bx, by, '#6b4423', 3.4);
    px(ctx, gx - ca * 2.4 - 1.8, gy - s2 * 2.4 - 1.8, 3.6, 3.6, '#2a1a0c');
    // ---- BRASS BOLSTER ----
    px(ctx, bx - 2.4, by - 2.4, 4.8, 4.8, '#000');
    px(ctx, bx - 1.8, by - 1.8, 3.6, 3.6, '#c9a24a');
    px(ctx, bx - 0.9, by - 0.9, 1.8, 1.8, '#f0dc9a');
    // ---- BROAD BOLO BLADE: widens toward the tip ----
    const P = (f: number, perp: number) => {
      const widen = 1.0 + Math.pow(Math.min(1, f / BLADE), 1.5) * 5.2;
      const back = Math.sin((f / BLADE) * Math.PI) * 1.2;
      return [bx + ca * f + pa * (perp + widen) + pb * back, by + s2 * f + pb * (perp + widen) - pa * back];
    };
    const N = 12;
    const sp: number[][] = [], ed: number[][] = [], mid: number[][] = [];
    for (let i = 0; i <= N; i++) { const f = (i / N) * BLADE; sp.push(P(f, 1.2)); ed.push(P(f, -1.2)); mid.push(P(f, 0)); }
    const trace = (pts: number[][], col: string, w2: number, alpha = 1) => {
      ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach((q, i) => i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])); ctx.stroke(); ctx.globalAlpha = 1;
    };
    trace(sp, '#05070a', 5.6); trace(ed, '#05070a', 5.6);
    line(ctx, sp[N][0], sp[N][1], ed[N][0], ed[N][1], '#05070a', 5.6);
    line(ctx, sp[0][0], sp[0][1], ed[0][0], ed[0][1], '#05070a', 4.4);
    trace(mid, '#b8c6d4', 4.2);
    trace(sp, '#5b6874', 1.9);
    trace(ed, '#ffffff', 2.4);
    // ---- FALSE EDGE near the clipped tip ----
    if (!o.outline) {
      const f0 = BLADE * 0.68;
      const a0 = P(f0, -1.2), a1 = P(BLADE, 1.2);
      line(ctx, a0[0], a0[1], a1[0], a1[1], '#ffffff', 2.2);
      const gp = (Math.sin(o.time * 8) + 1) / 2, gq = P(f0 + (BLADE - f0) * gp, 0);
      px(ctx, gq[0] - 1.8, gq[1] - 1.8, 3.6, 3.6, '#ffffff');
    }
    // ---- heavy tip ----
    if (!o.outline) {
      px(ctx, tipX - 2, tipY - 2, 4, 4, b_accent(o));
      if (u2 > 0.22 && u2 < 0.85) { px(ctx, tipX - 4, tipY - 0.8, 8, 1.6, '#fff'); px(ctx, tipX - 0.8, tipY - 4, 1.6, 8, '#fff'); }
    }
  } else if (o.pose === 'attack' && !isKickAtk && o.weapon !== 4 && o.weapon !== 5 && o.weapon !== 6 && o.weapon !== 7 && o.weapon !== 8) {
    let pt: (uu: number) => { x: number; y: number };
    switch (atk) {
      case 'CROSS': pt = (uu) => { const e = -4 + uu * 17; return { x: sx + dirX * e, y: sy + fy * e - 1 - uu * 1.5 }; }; break;
      case 'HOOK': pt = (uu) => bez(sx - dirX * 3, sy - 4, sx + dirX * 8, sy - 6, sx + dirX * 9, sy - 0.5, uu); break;
      case 'ELBOW': pt = (uu) => ({ x: sx + dirX * (-1 + uu * 3), y: sy - 4 + uu }); break;
      case 'DRAGON PALM': pt = (uu) => { const e = -3 + uu * 15; return { x: sx + dirX * e, y: sy + fy * e }; }; break;
      default: pt = (uu) => { const e = -2 + uu * 14; return { x: sx + dirX * e, y: sy + fy * e - 1 }; };
    }
    const f = pt(u);
    if (atk === 'ELBOW') {
      const ex = sx + dirX * (2 + u * 7), ey = sy - 1 + u;
      line(ctx, sx, sy, ex, ey, c, w); line(ctx, ex, ey, f.x, f.y, c, w); circle(ctx, ex, ey, w * 0.9, c);
      limb(ctx, sx, sy, sx - dirX * 4, sy + 3, 4, 4, flip, c, w);
    } else if (atk === 'DRAGON PALM') {
      limb(ctx, sx, sy, f.x, f.y - 1.5, 5, 5, -flip, c, w); limb(ctx, sx, sy, f.x - dirX, f.y + 1.5, 5, 5, flip, c, w);
      if (!o.outline) { px(ctx, f.x - 1, f.y - 3, 2, 6, c); if (u > 0.6) { ctx.globalAlpha = 0.6; circle(ctx, f.x + dirX * 2, f.y, 3 + u * 2, acc); ctx.globalAlpha = 1; } }
    } else {
      limb(ctx, sx, sy, f.x, f.y, 5, 5, atk === 'HOOK' ? flip : -flip, c, w);
      circle(ctx, f.x, f.y, w * 0.95, c);
      if (atk === 'CROSS') limb(ctx, sx, sy, sx + dirX * 1, sy + 1, 4, 4, flip, c, w); else guardArm();
    }
  } else if (o.pose === 'attack' && isKickAtk) {
    line(ctx, sx, sy, sx - dirX * 5, sy - 2, c, w); line(ctx, sx, sy, sx + dirX * 3, sy + 3, c, w);
  } else if (o.pose === 'flykick') {
    line(ctx, sx, sy, sx - 4, sy - 4, c, w); line(ctx, sx, sy, sx + 3, sy - 4, c, w);
  } else if (o.pose === 'sidekick') {
    line(ctx, sx, sy, sx + dirX * 6, sy + 3, c, w); line(ctx, sx, sy, sx - dirX * 6, sy - 4, c, w);
  } else if (o.pose === 'reload') {
    line(ctx, sx, sy, sx + dirX * 3, sy + 5, c, w); line(ctx, sx, sy, sx + dirX * 1, sy + 5, c, w);
  } else if (o.pose === 'run') {
    limb(ctx, sx, sy, sx + dirX * (-Math.sin(o.walk)) * 3.6, sy + 2.2, 4, 4, -flip, c, w); limb(ctx, sx, sy, sx + dirX * Math.sin(o.walk) * 3.6, sy + 2.2, 4, 4, -flip, c, w);
  } else if (o.pose === 'rushpunch') {
    line(ctx, sx, sy, sx + dirX * 12, sy - 1, c, w); circle(ctx, sx + dirX * 12, sy - 1, w, c);
    line(ctx, sx, sy, sx - dirX * 5, sy + 1, c, w);
    if (!o.outline) for (let i = 1; i <= 4; i++) { ctx.globalAlpha = 0.5 - i * 0.1; circle(ctx, sx + dirX * (12 - i * 3), sy - 1, 1.5, '#fff'); } ctx.globalAlpha = 1;
  } else if (o.pose === 'crouch') {
    limb(ctx, sx, sy, sx - dirX * 4, sy + 4, 4, 4, flip, c, w); guardArm();
  } else if (o.pose === 'uppercut') {
    limb(ctx, sx, sy, sx + dirX * 4, sy - 13, 6, 6, flip, c, w); circle(ctx, sx + dirX * 4, sy - 13, w, c);
    line(ctx, sx, sy, sx - dirX * 4, sy + 2, c, w);
    if (!o.outline) for (let i = 1; i <= 4; i++) { ctx.globalAlpha = 0.5 - i * 0.1; circle(ctx, sx + dirX * (4 - i), sy - 13 + i * 3.5, 1.5, '#fff'); } ctx.globalAlpha = 1;
  } else if (o.pose === 'jump') {
    line(ctx, sx, sy, sx + 3, sy - 5, c, w); line(ctx, sx, sy, sx - 3, sy - 5, c, w);
  } else if (o.pose === 'axekick') {
    line(ctx, sx, sy, sx - dirX * 5, sy - 2, c, w); line(ctx, sx, sy, sx + dirX * 4, sy + 2, c, w);
  } else if (o.pose === 'windup') {
    line(ctx, sx, sy, sx - dirX * 5, sy - 4, c, w);
    line(ctx, sx, sy, sx + dirX * 2, sy + 3, c, w);
    circle(ctx, sx - dirX * 5, sy - 4, w, c);
    if (o.weapon === 4 && !o.outline) { const ba = o.facing + 2.5; line(ctx, sx - dirX * 5, sy - 4, sx - dirX * 5 + Math.cos(ba) * 12, sy - 4 + Math.sin(ba) * 12, '#000', 2.6); line(ctx, sx - dirX * 5, sy - 4, sx - dirX * 5 + Math.cos(ba) * 12, sy - 4 + Math.sin(ba) * 12, '#eaf6ff', 1.3); }
  } else if (o.pose === 'parry' || o.pose === 'block') {
    const g = o.pose === 'parry' ? '#fff' : c;
    line(ctx, sx, sy, sx + dirX * 5, sy - 3, g, w);
    line(ctx, sx, sy, sx + dirX * 5, sy + 2, g, w);
    if (!o.outline) line(ctx, sx + dirX * 6, sy - 5, sx + dirX * 6, sy + 4, acc, 1);
  } else if (o.pose === 'fly') {
    const w1 = o.time * 17, w2 = w1 + 2.4;
    line(ctx, sx, sy, sx + Math.cos(w1) * 5.5, sy + Math.sin(w1) * 5.5, c, w);
    line(ctx, sx, sy, sx + Math.cos(w2) * 5.5, sy + Math.sin(w2) * 5.5, c, w);
  } else if (o.pose === 'shuffle') {
    // guard up, fists bobbing alternately, elbows tucked
    const gb = Math.sin(o.time * 9), gb2 = Math.sin(o.time * 9 + 2.1);
    const f1x = sx + dirX * 4.2, f1y = sy - 0.5 + gb * 0.8;
    const f2x = sx + dirX * 1.6, f2y = sy + 2.4 + gb2 * 0.7;
    limb(ctx, sx, sy, f1x, f1y, 4.2, 4.2, -flip, c, w); circle(ctx, f1x, f1y, w * 0.85, c);
    limb(ctx, sx, sy, f2x, f2y, 4.2, 4.2, flip, c, w); circle(ctx, f2x, f2y, w * 0.85, c);
  }
  else if (o.pose === 'getup') { line(ctx, sx, sy, sx + dirX * 4.5, sy + 5.5, c, w); line(ctx, sx, sy, sx - dirX * 3, sy + 5, c, w); }
  else if (o.pose === 'whiff') {
    line(ctx, sx, sy, sx + dirX * 6.5, sy - 2, c, w);
    line(ctx, sx, sy, sx - dirX * 4.5, sy - 5, c, w);
  } else if (o.pose === 'knock' || o.pose === 'stun') {
    const tw = o.pose === 'knock' ? Math.sin(o.time * 22) * 0.8 : 0;
    line(ctx, sx, sy, sx + 4, sy - 3 + tw, c, w); line(ctx, sx, sy, sx - 4, sy - 3 - tw, c, w);
  } else if (o.pose === 'broken') {
    line(ctx, sx, sy, sx + 3, sy + 4, c, w); line(ctx, sx, sy, sx - 3, sy + 4, c, w);
  } else if (o.weapon === 3) {
    const na = o.nunAng ?? o.facing, lx = Math.cos(na), ly = Math.sin(na);
    limb(ctx, sx, sy, sx + lx * 7, sy + ly * 7, 5, 5, -flip, c, w); circle(ctx, sx + lx * 7, sy + ly * 7, w * 0.9, c);
    guardArm();
  } else if (o.weapon === 1 || o.weapon === 2) {
    const gl = o.weapon === 1 ? 5 : 9;
    line(ctx, sx, sy, sx + dirX * 6, sy + dirY * 6 + 1, c, w);
    line(ctx, sx, sy, sx + dirX * 4, sy + dirY * 4 + 2, c, w);
    ctx.save(); ctx.translate(sx + dirX * 5, sy + dirY * 5 + 1); ctx.rotate(o.facing);
    if (o.outline) px(ctx, -1, -2, gl + 2, 4, '#000'); else px(ctx, 0, -1, gl, 2, '#333'); if (!o.outline) px(ctx, 0, -1, gl, 1, '#777'); if (o.weapon === 2 && !o.outline) px(ctx, 2, 1, 2, 2, '#333');
    ctx.restore();
  } else if (o.pose === 'dash') {
    line(ctx, sx, sy, sx - dirX * 5, sy + 1, c, w); line(ctx, sx, sy, sx + dirX * 4, sy - 1, c, w);
  } else {
    const sw = Math.sin(o.walk) * 2.5;
    if (o.weapon === 7) {
      // staff held across the body, both hands
      const ba = o.facing + 2.5, ca = Math.cos(ba), sa2 = Math.sin(ba);
      const gx = sx + dirX * 2, gy = sy + 3;
      limb(ctx, sx, sy, gx + ca * 2, gy + sa2 * 2, 4, 4, -flip, c, w);
      limb(ctx, sx, sy, gx - ca * 3, gy - sa2 * 3, 4, 4, flip, c, w);
      if (!o.outline) { line(ctx, gx - ca * 16, gy - sa2 * 16, gx + ca * 16, gy + sa2 * 16, '#000', 3); line(ctx, gx - ca * 16, gy - sa2 * 16, gx + ca * 16, gy + sa2 * 16, '#c99a52', 1.6); }
    } else if (o.weapon === 8) {
      // spear couched forward, cross blade gleaming
      const gx = sx + dirX * 3.5, gy = sy + 2.8;
      limb(ctx, sx, sy, gx, gy, 4, 4, -flip, c, w);
      limb(ctx, sx, sy, gx - dirX * 2.5, gy + 1.5, 4, 4, flip, c, w);
      if (!o.outline) {
        const ba = o.facing + 0.55, ca = Math.cos(ba), sa2 = Math.sin(ba);
        line(ctx, gx - ca * 5, gy - sa2 * 5, gx + ca * 15, gy + sa2 * 15, '#000', 2.8);
        line(ctx, gx - ca * 5, gy - sa2 * 5, gx + ca * 15, gy + sa2 * 15, '#8a5a2a', 1.5);
        const bx = gx + ca * 14, by = gy + sa2 * 14;
        line(ctx, bx - (-sa2) * 3.4, by - ca * 3.4, bx + (-sa2) * 3.4, by + ca * 3.4, '#e8eef4', 1.6);
        line(ctx, bx, by, bx + ca * 5, by + sa2 * 5, '#ffffff', 1.4);
        const gp = (Math.sin(o.time * 2.4) + 1) / 2;
        px(ctx, gx + ca * (2 + gp * 11) - 1, gy + sa2 * (2 + gp * 11) - 1, 2, 2, '#fff');
      }
    } else if (o.weapon === 5) {
      // axe resting on the shoulder
      const gx = sx + dirX * 3.5, gy = sy + 2.5;
      limb(ctx, sx, sy, gx, gy, 4.5, 4.5, -flip, c, w);
      guardArm();
      if (!o.outline) {
        const sa = o.facing - 2.2, ca = Math.cos(sa), s3 = Math.sin(sa), pa = -s3, pb = ca;
        const GR = 4, BL = 15;
        const bx = gx + ca * GR, by = gy + s3 * GR;
        line(ctx, gx - ca * 2, gy - s3 * 2, bx, by, '#6b4423', 3.4);
        px(ctx, gx - ca * 2.6 - 1.6, gy - s3 * 2.6 - 1.6, 3.2, 3.2, '#2a1a0c');
        px(ctx, bx - 2, by - 2, 4, 4, '#000'); px(ctx, bx - 1.4, by - 1.4, 2.8, 2.8, '#c9a24a');
        const P = (f: number, perp: number) => {
          const widen = 0.9 + Math.pow(Math.min(1, f / BL), 1.5) * 4.6;
          return [bx + ca * f + pa * (perp + widen), by + s3 * f + pb * (perp + widen)];
        };
        const sp: number[][] = [], ed: number[][] = [], mid: number[][] = [];
        for (let i = 0; i <= 9; i++) { const f = (i / 9) * BL; sp.push(P(f, 1.1)); ed.push(P(f, -1.1)); mid.push(P(f, 0)); }
        const tr = (pts: number[][], col: string, w2: number) => { ctx.strokeStyle = col; ctx.lineWidth = w2; ctx.beginPath(); pts.forEach((q, i) => i === 0 ? ctx.moveTo(q[0], q[1]) : ctx.lineTo(q[0], q[1])); ctx.stroke(); };
        tr(sp, '#05070a', 5); tr(ed, '#05070a', 5);
        line(ctx, sp[9][0], sp[9][1], ed[9][0], ed[9][1], '#05070a', 5);
        line(ctx, sp[0][0], sp[0][1], ed[0][0], ed[0][1], '#05070a', 4);
        tr(mid, '#b8c6d4', 3.8); tr(sp, '#5b6874', 1.7); tr(ed, '#ffffff', 2.2);
        const gp = (Math.sin(o.time * 6) + 1) / 2, gq = P(BL * (0.7 + gp * 0.28), 0);
        px(ctx, gq[0] - 1.6, gq[1] - 1.6, 3.2, 3.2, '#ffffff');
      }
    } else if (o.weapon === 6) {
      // twin daggers held low, ready
      const g1 = { x: sx + dirX * 3, y: sy + 2.5 }, g2 = { x: sx - dirX * 1, y: sy + 3.5 };
      limb(ctx, sx, sy, g1.x, g1.y, 4, 4, -flip, c, w);
      limb(ctx, sx, sy, g2.x, g2.y, 4, 4, flip, c, w);
      if (!o.outline) {
        for (const [gg, off] of [[g1, 0.75], [g2, 1.05]] as const) {
          const a3 = o.facing + off; // blades angled down-forward
          line(ctx, gg.x, gg.y, gg.x + Math.cos(a3) * 10, gg.y + Math.sin(a3) * 10, '#000', 2.4);
          line(ctx, gg.x, gg.y, gg.x + Math.cos(a3) * 10, gg.y + Math.sin(a3) * 10, '#eaf6ff', 1.2);
        }
      }
    } else if (o.weapon === 4) {
      // chudan: two hands on the grip, blade angled down-forward
      const gx = sx + dirX * 3.5, gy = sy + 2.6;
      limb(ctx, sx, sy, gx, gy, 4, 4, -flip, c, w);
      limb(ctx, sx, sy, gx - dirX * 1.2, gy + 1.2, 4, 4, flip, c, w);
      if (!o.outline) {
        const ba = o.facing + 0.85;
        line(ctx, gx - dirX * 1.5, gy, gx, gy, '#5a3a1a', 2);
        line(ctx, gx, gy, gx + Math.cos(ba) * 15, gy + Math.sin(ba) * 15, '#000', 2.5);
        line(ctx, gx, gy, gx + Math.cos(ba) * 15, gy + Math.sin(ba) * 15, '#dfeaf5', 1.3);
        line(ctx, gx, gy, gx + Math.cos(ba) * 15, gy + Math.sin(ba) * 15, '#ffffff', 0.7);
        px(ctx, gx - 1, gy - 1, 2.4, 2.4, '#c02830');
        // gleam travelling along the edge
        const gp = (Math.sin(o.time * 2.4) + 1) / 2;
        const glx = gx + Math.cos(ba) * (2 + gp * 12), gly = gy + Math.sin(ba) * (2 + gp * 12);
        px(ctx, glx - 1.5, gly - 0.5, 3, 1, '#fff'); px(ctx, glx - 0.5, gly - 1.5, 1, 3, '#fff');
      }
    }
    else if (o.kind === 'player' || o.kind === 'samurai') { limb(ctx, sx, sy, sx + dirX * 4 + sw * 0.3, sy + 1, 4, 4, -flip, c, w); limb(ctx, sx, sy, sx + dirX * 1 - sw * 0.3, sy + 2.5, 4, 4, -flip, c, w); }
    else { line(ctx, sx, sy, sx + sw * 0.6 + dirX * 1.5, sy + 4, c, w); line(ctx, sx, sy, sx - sw * 0.6 - dirX * 1.5, sy + 4, c, w); }
    if (o.bossWeap && !o.outline) {
      // boss weapon held / cocked back on windup
      const wA = o.facing + (o.pose === 'windup' ? -2.1 : 0.65);
      const gx2 = sx + dirX * 3.5, gy2 = sy + 2.5;
      limb(ctx, sx, sy, gx2, gy2, 4.5, 4.5, -flip, c, w);
      drawWeaponProp(ctx, gx2, gy2, wA, o.bossWeap);
    }
    if ((o.kind === 'pipeswing' || o.kind === 'cleaver') && !o.outline) {
      const wa = o.facing + (o.pose === 'windup' ? -2.2 : 0.7);
      const gx2 = sx + dirX * 3, gy2 = sy + 2;
      const ex2 = gx2 + Math.cos(wa) * (o.kind === 'pipeswing' ? 11 : 9), ey2 = gy2 + Math.sin(wa) * (o.kind === 'pipeswing' ? 11 : 9);
      if (o.kind === 'pipeswing') { line(ctx, gx2, gy2, ex2, ey2, '#000', 2.8); line(ctx, gx2, gy2, ex2, ey2, '#8a8f99', 1.5); px(ctx, ex2 - 1.5, ey2 - 1.5, 3, 3, '#5a5f68'); }
      else { line(ctx, gx2, gy2, ex2, ey2, '#000', 2.6); line(ctx, gx2, gy2, ex2, ey2, '#cfd6de', 1.4); px(ctx, gx2 + dirX * 1 - 1.5, gy2 - 1.5, 3, 3, '#6b4423'); }
      limb(ctx, sx, sy, gx2, gy2, 4, 4, -flip, c, w);
    }
    if ((o.kind === 'gunner' || o.kind === 'rifleman' || o.kind === 'smg' || o.kind === 'sniper') && !o.outline) { const gl2 = o.kind === 'sniper' ? 10 : o.kind === 'rifleman' ? 8 : o.kind === 'smg' ? 6 : 4; ctx.save(); ctx.translate(sx + dirX * 4, sy + 2); ctx.rotate(o.facing); px(ctx, -1, -2, gl2 + 2, 4, '#000'); px(ctx, 0, -1, gl2, 2, '#444'); if (o.kind === 'sniper') px(ctx, 3, -3, 3, 1, '#333'); ctx.restore(); }
    if (o.kind === 'shield' && !o.outline) { ctx.save(); ctx.translate(sx + dirX * 5, sy + 1); ctx.rotate(o.facing); px(ctx, -2, -6, 4, 12, '#000'); px(ctx, -1, -5, 2, 10, '#ffd166'); px(ctx, -1, -5, 1, 10, '#fff'); ctx.restore(); }
  }
  // ---------- HEAD ----------
  let hx = topX + lean * 2, hy = headY + (atk === 'CROSS' || atk === 'HOOK' ? sc * 0.8 : 0);
  if (o.react) { hx -= Math.cos(o.reactAng ?? o.facing) * o.react * 3.2; hy -= o.react * 1.4; }
  circle(ctx, hx, hy, hr, c);
  if (o.outline) { ctx.restore(); return; }
  if (o.kind === 'player') {
    const band = o.skinBand ?? '#ff3b3b';
    // ---- EYES: two simple dark dots on the facing side (no alien lens, no glow) ----
    if (o.pose === 'broken' || o.pose === 'knock' || o.pose === 'fly') {
      const es = Math.max(1.4, hr * 0.42), lw2 = Math.max(0.7, w * 0.38);
      for (const side of [-1, 1]) {
        const ex = hx + dirX * (hr * 0.42) + dirX * side * 1.1, ey = hy + 0.4;
        line(ctx, ex - es, ey - es, ex + es, ey + es, '#16161f', lw2);
        line(ctx, ex + es, ey - es, ex - es, ey + es, '#16161f', lw2);
      }
    } else {
      // horizontal eye band like the classic stickman, both eyes visible
      px(ctx, hx + dirX * 2.2 - 2, hy - 0.6, 4, 1.4, '#14141c');
      // small white glints to keep it lively
      px(ctx, hx + dirX * 3.1 - 0.4, hy - 0.4, 0.8, 0.8, '#ffffff');
    }
    // ---- HEADBAND: a strip across the FOREHEAD, never over the eyes ----
    const bandY = hy - hr * 0.52, bandH = Math.max(1.4, hr * 0.42);
    px(ctx, hx - hr, bandY, hr * 2, bandH, '#000');
    px(ctx, hx - hr + 0.4, bandY + 0.3, hr * 2 - 0.8, bandH - 0.6, band);
    // knot + two tails trailing behind the head
    const knotX = hx - dirX * (hr + 0.6), knotY = bandY + bandH * 0.5;
    px(ctx, knotX - 1, knotY - 1, 2.2, 2.2, '#000');
    px(ctx, knotX - 0.7, knotY - 0.7, 1.6, 1.6, band);
    const wave = Math.sin(o.time * 13) * 1.6;
    const spd = o.pose === 'run' || o.pose === 'rushpunch' || o.pose === 'dash' || o.pose === 'knock' || o.pose === 'fly' ? 1.55 : 1;
    line(ctx, knotX, knotY, knotX - dirX * 6.5 * spd, knotY + 1.2 + wave * 0.6, band, 1.4);
    line(ctx, knotX, knotY, knotX - dirX * 5 * spd, knotY + 3 + wave, band, 1.1);
    // TOP-HAT / MASK / HOCKEY-MASK accessory skins
    if (o.skinHat === 'tophat') {
      const tilt = lean * 0.3;
      ctx.save(); ctx.translate(hx, hy - hr * 0.92); ctx.rotate(tilt);
      px(ctx, -4.6, -6.4, 9.2, 1.8, '#0a0a10');
      px(ctx, -2.9, -11.5, 5.8, 5.6, '#0a0a10');
      px(ctx, -2.9, -7.6, 5.8, 1.4, band);
      px(ctx, -2.2, -10.6, 4.4, 1.2, 'rgba(255,255,255,0.10)');
      ctx.restore();
    } else if (o.skinHat === 'hockey') {
      // JASON VORHEES mask
      const mw = hr * 1.62, mh = hr * 1.95;
      px(ctx, hx - mw / 2, hy - mh / 2 + 0.6, mw, mh, '#e9e6dc');
      px(ctx, hx - mw / 2 + 0.4, hy - mh / 2 + 1, mw - 0.8, mh - 0.8, '#f4f1e7');
      // breathing holes
      ctx.fillStyle = '#3a3a44';
      for (let r2 = 0; r2 < 2; r2++) for (let cc = 0; cc < 3 - r2; cc++) px(ctx, hx - 1.4 + cc * 1.4, hy - 0.2 + r2 * 1.5, 0.85, 0.85, '#3a3a44');
      // strap + red chevrons above the eyes
      px(ctx, hx - mw / 2 - 0.8, hy - hr * 0.3, 1.2, hr * 0.8, '#2a2a32');
      px(ctx, hx + mw / 2 - 0.4, hy - hr * 0.3, 1.2, hr * 0.8, '#2a2a32');
      for (const side of [-1, 1]) {
        const cx2 = hx + side * mw * 0.3;
        line(ctx, cx2 - side * 1.1, hy - hr * 0.52, cx2, hy - hr * 0.28, '#c02830', 1.1);
        line(ctx, cx2, hy - hr * 0.28, cx2 + side * 1.1, hy - hr * 0.52, '#c02830', 1.1);
      }
      // eyes cut through the mask
      px(ctx, hx + dirX * 2.6 - 1.1, hy - 1, 2.2, 1.6, '#14141c');
    } else if (o.skinHat === 'oni') {
      // oni half-mask (melee vibe)
      px(ctx, hx + dirX * 1.2 - 2.6, hy + 0.6, 5.2, 3.4, '#c02830');
      px(ctx, hx + dirX * 1.6 - 1.8, hy + 1.4, 0.9, 0.9, '#fff');
      px(ctx, hx + dirX * 2.9 - 0.9, hy + 1.4, 0.9, 0.9, '#fff');
      px(ctx, hx - hr, hy - hr * 0.5, hr * 2, 1.4, band);
    }
    // ---- MOUTH: a tiny line so the face reads as a face ----
    px(ctx, hx + dirX * 2.6 - 1, hy + hr * 0.52, 2, 0.7, '#2a2a34');
  } else if (o.kind !== 'ghost') {
    const eye = o.kind === 'boss' ? '#ff3b3b' : '#111';
    if (o.pose === 'fly' || o.pose === 'knock') { line(ctx, hx + dirX * 1 - 1, hy - 2, hx + dirX * 1 + 1, hy, '#111', 1); line(ctx, hx + dirX * 1 + 1, hy - 2, hx + dirX * 1 - 1, hy, '#111', 1); }
    else px(ctx, hx + dirX * (hr * 0.5) - 1, hy - 1, 2, 1, eye);
    if (o.kind === 'ninja') { px(ctx, hx - hr, hy - 1, hr * 2, 1, '#ff3b3b'); line(ctx, hx - dirX * hr, hy, hx - dirX * hr - dirX * 6, hy + 2 + Math.sin(o.time * 12) * 2, '#ff3b3b', 1); }
    if (o.kind === 'brute' || o.kind === 'boss') { px(ctx, hx - hr, hy - hr - 1, hr * 2, 2, o.accent || '#333'); }
    if (o.kind === 'sniper') { px(ctx, hx - hr, hy - hr, hr * 2, 1.5, '#222'); px(ctx, hx + dirX * hr - 1, hy - hr - 0.5, 2, 2, '#ff3b3b'); }
    if (o.kind === 'samurai') { px(ctx, hx - hr, hy - hr + 1, hr * 2, 1.5, '#7a1c26'); line(ctx, hx - dirX * hr, hy, hx - dirX * hr - dirX * 5, hy + 2 + Math.sin(o.time * 11) * 1.5, '#7a1c26', 1); }
    if (o.kind === 'smg') { px(ctx, hx - hr, hy - hr, hr * 2, 2, '#2b2b3d'); }
    if (o.kind === 'bomber') { circle(ctx, hx, hy, hr * 0.5, Math.sin(o.time * 20) > 0 ? '#ff7a1a' : '#ff3b3b'); }
    if (o.kind === 'boss') { px(ctx, hx - 2, hy - hr - 4, 4, 3, '#ffd166'); px(ctx, hx - 4, hy - hr - 2, 8, 1, '#ffd166'); }
  }
  if (o.pose === 'getup') { for (let i = 0; i < 2; i++) { const a = o.time * 3 + i * Math.PI; px(ctx, hx + Math.cos(a) * 5 - 1, hy - hr - 2 + Math.sin(a) * 1.5, 1.6, 1.6, '#c8c8d4'); } }
  else if (o.pose === 'broken') { for (let i = 0; i < 3; i++) { const a = o.time * 5 + i * TAU / 3; px(ctx, hx + Math.cos(a) * 6 - 1, hy - hr - 3 + Math.sin(a) * 2, 2, 2, '#ffd166'); } }
  if (o.pose === 'fly') { for (let i = 0; i < 2; i++) { const a = o.time * 9 + i * Math.PI; px(ctx, hx + Math.cos(a) * 6.5 - 1, hy - hr - 3 + Math.sin(a) * 2, 2, 2, '#ffd166'); } }
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, g: Game, rt: number) {
  G_BS = g.bodyScale ? 1.62 : 1; G_LS = g.bodyScale ? 2.15 : 1;
  const b = g.lvl?.biome;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!g.lvl || g.phase === 'title') { ctx.fillStyle = '#0b0b12'; ctx.fillRect(0, 0, VW, VH); drawTitleBg(ctx, rt); return; }
  ctx.fillStyle = b.bg; ctx.fillRect(0, 0, VW, VH);

  // camera
  ctx.save();
  ctx.translate(VW / 2, VH / 2);
  ctx.scale(g.zoom, g.zoom);
  ctx.translate(-Math.round(g.cam.x + g.shakeX), -Math.round(g.cam.y + g.shakeY));
  const camL = g.cam.x - VW / 2 / g.zoom - 16, camT = g.cam.y - VH / 2 / g.zoom - 16, camR = g.cam.x + VW / 2 / g.zoom + 16, camB = g.cam.y + VH / 2 / g.zoom + 16;

  // tiles
  const L = g.lvl;
  const x0 = Math.max(0, Math.floor(camL / TILE)), x1 = Math.min(L.w - 1, Math.ceil(camR / TILE));
  const y0 = Math.max(0, Math.floor(camT / TILE)), y1 = Math.min(L.h - 1, Math.ceil(camB / TILE));
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const solid = L.tiles[ty * L.w + tx] === 1;
    const X = tx * TILE, Y = ty * TILE;
    if (!solid) {
      px(ctx, X, Y, TILE, TILE, b.floor);
      px(ctx, X + 7, Y + 7, 2, 2, b.floorDot);
      if ((tx * 7 + ty * 13) % 5 === 0) px(ctx, X + 2, Y + 12, 1, 1, b.floorDot);
      // shadow under walls above
      if (ty > 0 && L.tiles[(ty - 1) * L.w + tx] === 1) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X, Y, TILE, 5); }
    }
  }
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const solid = L.tiles[ty * L.w + tx] === 1; if (!solid) continue;
    const X = tx * TILE, Y = ty * TILE;
    const below = ty + 1 < L.h && L.tiles[(ty + 1) * L.w + tx] === 0;
    let near = 9;
    for (let oy = -2; oy <= 2 && near > 1; oy++) for (let ox = -2; ox <= 2; ox++) { const nx = tx + ox, ny = ty + oy; if (nx >= 0 && ny >= 0 && nx < L.w && ny < L.h && L.tiles[ny * L.w + nx] === 0) near = Math.min(near, Math.max(Math.abs(ox), Math.abs(oy))); }
    if (near > 2) { px(ctx, X, Y, TILE, TILE, b.bg); if ((tx * 3 + ty * 5) % 4 === 0) px(ctx, X + 5, Y + 9, 1, 1, b.floor); continue; }
    if (near === 2) { px(ctx, X, Y, TILE, TILE, b.wall); px(ctx, X + 2, Y + 4, 5, 1, b.bg + '88'); px(ctx, X + 9, Y + 11, 4, 1, b.bg + '88'); continue; }
    px(ctx, X, Y, TILE, TILE, b.wallTop);
    if (below) { px(ctx, X, Y + TILE - 6, TILE, 6, b.wall); px(ctx, X, Y + TILE - 6, TILE, 1, b.bg); }
    // brick detail
    px(ctx, X + 3, Y + 3, 4, 1, b.wall); px(ctx, X + 9, Y + 6, 3, 1, b.wall);
    // edge highlight
    if (ty > 0 && L.tiles[(ty - 1) * L.w + tx] === 0) px(ctx, X, Y, TILE, 1, b.accent + '55');
  }
  // decor
  for (const d of L.decor) if (d.x > camL && d.x < camR && d.y > camT && d.y < camB) { if (d.t === 0) px(ctx, d.x, d.y, 2, 1, b.wall); else if (d.t === 1) px(ctx, d.x, d.y, 1, 2, b.wallTop); else px(ctx, d.x, d.y, 1, 1, b.accent + '66'); }
  // permanent blood stain layer (COMBINED mode) — above floor, below characters
  if (g.bloodMode === 2 && g.bloodCanvas) ctx.drawImage(g.bloodCanvas as unknown as CanvasImageSource, 0, 0);

  // portal
  if (g.portal) {
    const P = g.portal; const t = P.t;
    for (let i = 0; i < 4; i++) { const r = 4 + ((t * 20 + i * 5) % 18); ctx.strokeStyle = b.accent; ctx.globalAlpha = 1 - r / 20; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1; circle(ctx, P.x, P.y, 4 + Math.sin(t * 10), '#fff');
    for (let i = 0; i < 6; i++) { const a = t * 4 + i; px(ctx, P.x + Math.cos(a) * 12 - 1, P.y + Math.sin(a) * 6 - 1, 2, 2, i % 2 ? '#fff' : b.accent); }
  }

  // shadows
  const ents: (Enemy | Player)[] = [...g.enemies, g.player];
  for (const c of g.corpses) { const k = Math.max(0.3, 1 - c.z / 40); ctx.fillStyle = `rgba(0,0,0,${0.4 * k})`; ctx.beginPath(); ctx.ellipse(c.x, c.y + 1, (c.r + 2) * k, 2.5 * k, 0, 0, TAU); ctx.fill(); }
  for (const e of ents) { if ('state' in e && (e as Enemy).state === 'teleport') continue; const z = (e as any).z || 0; const k = Math.max(0.3, 1 - z / 40); ctx.fillStyle = `rgba(0,0,0,${0.4 * k})`; ctx.beginPath(); ctx.ellipse(e.x, e.y + 1, (e.r + 2) * k, 2.5 * k, 0, 0, TAU); ctx.fill(); }

  // pickups
  for (const pk of g.pickups) {
    const yo = Math.sin(pk.t * 5) * 2;
    if (pk.kind === 'chest') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 4, 8, 2.5, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5 + Math.sin(pk.t * 5) * 0.2; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(pk.x, pk.y + yo, 11, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      px(ctx, pk.x - 6, pk.y - 2 + yo, 12, 8, '#000');
      px(ctx, pk.x - 5, pk.y - 3 + yo, 10, 8, '#6b4423');
      px(ctx, pk.x - 5, pk.y - 3 + yo, 10, 2, '#8a5a2a');
      px(ctx, pk.x - 1, pk.y - 3 + yo, 2, 8, '#ffd166');
      px(ctx, pk.x - 5, pk.y + 1 + yo, 10, 1, '#ffd166');
      px(ctx, pk.x - 1.5, pk.y, 3, 3, '#fff2b0');
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(pk.x, pk.y + 2, 4, 1.5, 0, 0, TAU); ctx.fill();
    if (pk.kind === 'xp') {
      const v = pk.v ?? 1; const col = v >= 5 ? '#ffd166' : v >= 2 ? '#fff' : b.accent;
      ctx.save(); ctx.translate(Math.round(pk.x), Math.round(pk.y + yo)); ctx.rotate(Math.PI / 4);
      px(ctx, -2.5, -2.5, 5, 5, '#000'); px(ctx, -1.5, -1.5, 3, 3, col); px(ctx, -1.5, -1.5, 1, 1, '#fff');
      ctx.restore(); continue;
    }
    if (pk.kind === 'hp') { px(ctx, pk.x - 3, pk.y - 1 + yo, 6, 2, '#ff3b3b'); px(ctx, pk.x - 1, pk.y - 3 + yo, 2, 6, '#ff3b3b'); px(ctx, pk.x - 1, pk.y - 1 + yo, 1, 1, '#fff'); }
    else if (pk.kind === 'ammoP') { px(ctx, pk.x - 3, pk.y - 2 + yo, 6, 4, '#ffd166'); px(ctx, pk.x - 3, pk.y - 2 + yo, 6, 1, '#fff'); }
    else { px(ctx, pk.x - 4, pk.y - 2 + yo, 8, 4, '#ffd166'); px(ctx, pk.x - 4, pk.y - 2 + yo, 8, 1, '#fff'); px(ctx, pk.x - 2, pk.y - 1 + yo, 1, 2, '#a60'); px(ctx, pk.x + 1, pk.y - 1 + yo, 1, 2, '#a60'); }
    ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(pk.x, pk.y + yo, 7 + Math.sin(pk.t * 4) * 1.5, 0, TAU); ctx.stroke();
  }

  // telegraphs (under entities)
  for (const e of g.enemies) {
    if (e.state === 'windup') {
      const wu = e.kind === 'boss' ? (e.pattern === 'ring' ? 0.8 : 0.55) : e.def.windup;
      const t = Math.min(1, e.stateT / wu);
      ctx.globalAlpha = 0.25 + t * 0.4;
      if (e.kind === 'gunner' || e.kind === 'rifleman' || e.kind === 'smg' || e.kind === 'sniper' || e.kind === 'dasher' || (e.kind === 'samurai' && e.pattern === 'FLY') || (e.kind === 'boss' && (e.pattern === 'slam' || e.pattern === 'fly'))) {
        const len = e.kind === 'dasher' ? 80 : e.kind === 'boss' ? 90 : e.kind === 'sniper' ? 280 : 160;
        if (e.kind === 'sniper') {
          line(ctx, e.x, e.y, e.x + Math.cos(e.facing) * len * t, e.y + Math.sin(e.facing) * len * t, '#ff3b3b', 1 + t * 1.5);
          if (t > 0.75) { line(ctx, e.x, e.y, e.x + Math.cos(e.facing) * len, e.y + Math.sin(e.facing) * len, '#fff', 0.5); circle(ctx, g.player.x, g.player.y - g.player.z, 2, '#ff3b3b'); }
        } else line(ctx, e.x, e.y, e.x + Math.cos(e.facing) * len * t, e.y + Math.sin(e.facing) * len * t, b.enemy2, 1);
      } else if (e.kind === 'bomber' || (e.kind === 'boss' && (e.pattern === 'ring' || e.pattern === 'spiral'))) {
        ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, (e.kind === 'bomber' ? 42 : 30) * t, 0, TAU); ctx.stroke();
      } else {
        const range = (e.kind === 'boss' ? 36 : e.def.range + 8), arc = e.kind === 'brute' ? 3.2 : e.kind === 'boss' ? 2.6 : 2.2;
        ctx.fillStyle = b.enemy2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, range * (0.4 + 0.6 * t), e.facing - arc / 2, e.facing + arc / 2); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // particles (below layer: smoke, ghost, shock)
  for (const q of g.particles) if (q.kind === 'smoke' || q.kind === 'shock' || q.kind === 'ghost') drawParticle(ctx, q, g);

  // entities sorted by y
  const drawList: { y: number; f: () => void }[] = [];
  for (const e of g.enemies) drawList.push({ y: e.y, f: () => drawEnemy(ctx, e, g) });
  for (const c of g.corpses) drawList.push({ y: c.y, f: () => drawCorpse(ctx, c, g) });
  for (const d of g.drops) drawList.push({ y: d.y, f: () => drawDrop(ctx, d) });
  drawList.push({ y: g.player.y, f: () => drawPlayer(ctx, g.player, g) });
  drawList.sort((a, c) => a.y - c.y).forEach((d) => d.f());

  // OFA lock-on reticle
  if (g.player.ofaActive && g.player.lockTarget && g.player.lockTarget.state !== 'dead') {
    const t = g.player.lockTarget;
    const r = t.r + 7 + Math.sin(rt * 10) * 1.2;
    const cy = t.y - t.z - 4;
    ctx.strokeStyle = '#57e6ff'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
    for (const [sx2, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const cx = t.x + sx2 * r, cyy = cy + sy2 * r * 0.8;
      ctx.beginPath(); ctx.moveTo(cx, cyy); ctx.lineTo(cx - sx2 * 4, cyy); ctx.moveTo(cx, cyy); ctx.lineTo(cx, cyy - sy2 * 4); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    text(ctx, 'LOCK', t.x, cy - r * 0.8 - 10, 5, '#57e6ff', 'center');
  }
  if (g.player.weapon === 3 && g.nunchaku.pts.length === 6) drawNunchaku(ctx, g);

  // bullets
  for (const bl of g.bullets) {
    const sp = Math.hypot(bl.vx, bl.vy); const nx = bl.vx / sp, ny = bl.vy / sp;
    const col = bl.owner === 'p' ? (bl.deflected ? '#fff' : '#ffe9a8') : bl.kind === 'boss' ? b.accent : b.enemy2;
    const len = bl.owner === 'p' ? 8 : 4;
    ctx.globalAlpha = 0.4; line(ctx, bl.x - nx * len * 2, bl.y - ny * len * 2, bl.x, bl.y, col, bl.r); ctx.globalAlpha = 1;
    line(ctx, bl.x - nx * len, bl.y - ny * len, bl.x, bl.y, col, bl.r * 1.4);
    if (bl.owner === 'e') { circle(ctx, bl.x, bl.y, bl.r, '#fff'); circle(ctx, bl.x, bl.y, bl.r * 0.5, col); }
  }

  // particles top
  for (const q of g.particles) if (q.kind !== 'smoke' && q.kind !== 'shock' && q.kind !== 'ghost') drawParticle(ctx, q, g);

  // enemy bars
  for (const e of g.enemies) {
    if (e.kind === 'boss') continue;
    const show = e.hp < e.maxHp || e.posture > 0;
    if (!show) continue;
    const w = 12, x = e.x - w / 2, y = e.y - e.r - 14;
    px(ctx, x - 1, y - 1, w + 2, 5, '#000a');
    px(ctx, x, y, Math.ceil(w * e.hp / e.maxHp), 2, e.state === 'broken' ? '#fff' : b.accent);
    px(ctx, x, y + 2, Math.ceil(w * Math.min(1, e.posture / e.maxPosture)), 1, e.state === 'broken' ? '#fff' : '#ffd166');
    if (e.state === 'broken') text(ctx, 'F', e.x, y - 9, 7, Math.sin(rt * 15) > 0 ? '#ffd166' : '#fff', 'center');
  }
  // crosshair (world)
  const mw = g.mouseWorld;
  const isGun = g.player.weapon === 1 || g.player.weapon === 2;
  const ch = isGun ? 5 : 3;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  if (isGun) { ctx.beginPath(); ctx.arc(mw.x, mw.y, ch + g.player.recoil * 3, 0, TAU); ctx.stroke(); px(ctx, mw.x - 0.5, mw.y - 0.5, 1, 1, b.accent); }
  else { line(ctx, mw.x - ch, mw.y, mw.x + ch, mw.y, b.accent); line(ctx, mw.x, mw.y - ch, mw.x, mw.y + ch, b.accent); }
  ctx.restore();

  drawHUD(ctx, g, rt);
}

function drawParticle(ctx: CanvasRenderingContext2D, q: Particle, g: Game) {
  const t = q.life / q.max;
  switch (q.kind) {
    case 'dot': {
      const s = Math.max(1, q.size * t);
      // fast blood droplets stretch along their velocity — reads as liquid, not confetti
      if (q.data?.blood) { const v = Math.hypot(q.vx, q.vy); if (v > 90) { const ax = q.vx / v, ay = q.vy / v, L = Math.min(5, v * 0.016); line(ctx, q.x - ax * L, q.y - ay * L, q.x + ax * L * 0.4, q.y + ay * L * 0.4, q.color, Math.max(1.2, s * 1.7)); break; } }
      px(ctx, q.x - s / 2, q.y - s / 2, s, s, q.color); break;
    }
    case 'spark': { const l = Math.hypot(q.vx, q.vy) * 0.03; line(ctx, q.x, q.y, q.x - q.vx * 0.03 * l * 0.5 - q.vx * 0.01, q.y - q.vy * 0.03 * l * 0.5 - q.vy * 0.01, q.color, Math.max(1, q.size * t)); break; }
    case 'ring': { ctx.globalAlpha = t; ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(1, 3 * t); ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - t * 0.7), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; break; }
    case 'shock': { ctx.globalAlpha = t * 0.5; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - t * 0.5), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break; }
    case 'slash': {
      const p = 1 - t;
      const a = q.ang!, arc = q.arc!;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(1, 3 * t);
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.6 + p * 0.4), a - arc / 2, a - arc / 2 + arc * Math.min(1, p * 2.5)); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + p * 0.4), a - arc / 2 + arc * Math.max(0, p * 2.5 - 1), a - arc / 2 + arc * Math.min(1, p * 2.5)); ctx.stroke();
      ctx.globalAlpha = 1; break;
    }
    case 'line': { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.ang! + q.life * 10); line(ctx, -q.size / 2, 0, q.size / 2, 0, q.color, 1.5); ctx.restore(); break; }
    case 'smoke': { ctx.globalAlpha = t * 0.6; circle(ctx, q.x, q.y, q.size * (1.3 - t * 0.3), q.color); ctx.globalAlpha = 1; break; }
    case 'ghost': { ctx.globalAlpha = t * 0.5; const pose = q.data?.pose ?? 'dash'; drawStick(ctx, q.x, q.y, { color: q.color, facing: q.data?.facing ?? 0, walk: q.data?.walk ?? 0, pose, t: q.data?.t ?? 0, atk: q.data?.atk, scale: 1, headR: 4, body: 4, legs: 3, thick: 1.5, sqx: pose === 'dash' ? 1.2 : 1, sqy: pose === 'dash' ? 0.8 : 1, kind: 'ghost', time: 0 }); ctx.globalAlpha = 1; break; }
    case 'text': {
      const sc = (q.scale ?? 1) * (1 + (1 - t < 0.15 ? (0.15 - (1 - t)) * 4 : 0));
      ctx.globalAlpha = Math.min(1, t * 3);
      text(ctx, q.text!, q.x, q.y, Math.round(7 * sc), q.color, 'center'); ctx.globalAlpha = 1; break;
    }
  }
  void g;
}

function drawNunchaku(ctx: CanvasRenderingContext2D, g: Game) {
  const N = g.nunchaku, b = g.lvl.biome;
  const pts = N.pts;
  // tapering motion trail of the free end
  for (let i = N.trail.length - 1; i >= 1; i--) {
    const t = 1 - i / N.trail.length;
    ctx.globalAlpha = t * 0.55;
    line(ctx, N.trail[i].x, N.trail[i].y, N.trail[i - 1].x, N.trail[i - 1].y, b.accent, 0.5 + t * 2.2);
  }
  ctx.globalAlpha = 1;
  const end = pts[5];
  // held handle: pts0 -> pts1 amplified to a real grip
  {
    const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y, d = Math.hypot(dx, dy) || 1;
    const hx = pts[0].x + dx / d * 4.5, hy = pts[0].y + dy / d * 4.5;
    line(ctx, pts[0].x, pts[0].y, hx, hy, '#000', 4);
    line(ctx, pts[0].x, pts[0].y, hx, hy, '#9c6a33', 2.2);
  }
  // chain links (steel)
  for (let i = 1; i < 4; i++) {
    line(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, '#000', 2.6);
    line(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, '#aeb8c6', 1.2);
  }
  // free stick
  line(ctx, pts[4].x, pts[4].y, end.x, end.y, '#000', 4.5);
  line(ctx, pts[4].x, pts[4].y, end.x, end.y, '#b3763a', 2.4);
  px(ctx, end.x - 1.5, end.y - 1.5, 3, 3, '#000');
  px(ctx, end.x - 1, end.y - 1, 2, 2, b.accent);
}
export const ENEMY_SIZES: Record<string, { hr: number; body: number; legs: number; thick: number; scale: number }> = {
  thug: { hr: 4, body: 4, legs: 3, thick: 1.5, scale: 1 }, gunner: { hr: 4, body: 4, legs: 3, thick: 1.4, scale: 1 },
  dasher: { hr: 4, body: 4, legs: 3, thick: 1.3, scale: 1 }, brute: { hr: 4, body: 4.5, legs: 3, thick: 2.3, scale: 1 },
  shield: { hr: 4, body: 4, legs: 3, thick: 1.9, scale: 1 }, rifleman: { hr: 4, body: 4, legs: 3, thick: 1.5, scale: 1 },
  ninja: { hr: 4, body: 4, legs: 3, thick: 1.3, scale: 1 }, bomber: { hr: 4, body: 4, legs: 3, thick: 1.5, scale: 1 },
  smg: { hr: 4, body: 4, legs: 3, thick: 1.5, scale: 1 }, sniper: { hr: 4, body: 4, legs: 3, thick: 1.4, scale: 1 },
  samurai: { hr: 4, body: 4, legs: 3, thick: 1.6, scale: 1 }, pipeswing: { hr: 4, body: 4.4, legs: 3, thick: 1.7, scale: 1 },
  cleaver: { hr: 4, body: 4, legs: 3, thick: 1.5, scale: 1 }, boss: { hr: 5, body: 8, legs: 5, thick: 3, scale: 1.4 },
};
export function enemyColor(kind: string, elite: boolean, b: { enemy: string; enemy2: string }) {
  return elite ? '#ffd166' : kind === 'brute' || kind === 'boss' ? b.enemy : kind === 'ninja' ? '#3a3a4a' : kind === 'bomber' ? '#ffb060' : kind === 'samurai' ? '#cfd8ff' : kind === 'cleaver' ? '#e8d5c4' : b.enemy2;
}
const BOSS_WEAPON: Record<string, string> = { fists: '', pistol: 'pistol', katana: 'katana', machete: 'machete', staff: 'staff', spear: 'spear', axe: 'axe', dual: 'dual', nunchaku: 'nunchaku', rifle: 'rifle' };
// JASON-STYLE MACHETE: broad rectangular blade, blunt chopped tip, visible rivets
function drawMacheteJason(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(scale, scale);
  const L = 34, G = 9;
  // silhouette
  ctx.fillStyle = '#05070a';
  ctx.beginPath();
  ctx.moveTo(0, -G / 2 - 1.4);
  ctx.lineTo(L * 0.62, -G / 2 - 1.2);
  ctx.lineTo(L * 0.86, -G * 0.1);
  ctx.lineTo(L, -G * 0.34);          // blunt chopped tip (Jason's is cut off square-ish)
  ctx.lineTo(L, G * 0.42);
  ctx.lineTo(L * 0.55, G / 2 + 1.2);
  ctx.lineTo(0, G / 2 + 1.4);
  ctx.closePath(); ctx.fill();
  // steel body
  ctx.fillStyle = '#9aa8b6';
  ctx.beginPath();
  ctx.moveTo(0, -G / 2);
  ctx.lineTo(L * 0.62, -G / 2);
  ctx.lineTo(L * 0.84, -G * 0.08);
  ctx.lineTo(L, -G * 0.3);
  ctx.lineTo(L, G * 0.36);
  ctx.lineTo(L * 0.55, G / 2);
  ctx.lineTo(0, G / 2);
  ctx.closePath(); ctx.fill();
  // top grind highlight + cutting edge
  ctx.strokeStyle = '#c3d0dc'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(2, -G / 2 + 1.2); ctx.lineTo(L * 0.6, -G / 2 + 1); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(1, G / 2 - 0.6); ctx.lineTo(L * 0.55, G / 2 - 0.6); ctx.lineTo(L, G * 0.3); ctx.stroke();
  // grind lines
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) { const xx = 4 + i * (L * 0.14); ctx.beginPath(); ctx.moveTo(xx, -G / 2 + 2); ctx.lineTo(xx + 2, G / 2 - 2); ctx.stroke(); }
  // handle: black checkered grip + pommel
  ctx.fillStyle = '#0a0a0f'; ctx.fillRect(-11, -G / 2 + 0.4, 11, G - 0.8);
  ctx.fillStyle = '#1b1b24';
  for (let i = 0; i < 5; i++) ctx.fillRect(-10 + i * 2.1, -G / 2 + 1.2, 1.1, G - 2.4);
  ctx.fillStyle = '#3a3a46'; ctx.fillRect(-12.4, -G / 2 - 0.4, 2, G + 0.8);
  // blade-to-handle rivets
  ctx.fillStyle = '#d8d8e0';
  ctx.beginPath(); ctx.arc(-0.6, -1.1, 1.15, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-0.6, 1.6, 1.15, 0, TAU); ctx.fill();
  // red marks on the blade (worn paint)
  ctx.fillStyle = 'rgba(180,30,40,0.55)';
  ctx.fillRect(L * 0.3, -G / 2 + 1.2, 3.2, 2);
  ctx.fillRect(L * 0.52, G * 0.05, 2.4, 2);
  ctx.restore();
}
function drawWeaponProp(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, kind: string) {
  if (kind === 'machete') { drawMacheteJason(ctx, x, y, ang, 1); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  switch (kind) {
    case 'katana':
      line(ctx, 0, 0, 34, 0, '#05070a', 4.4); line(ctx, 0, 0, 34, 0, '#cfe0ee', 2.6); line(ctx, 0, 0, 34, 0, '#ffffff', 1.1);
      px(ctx, -7, -2, 7, 4, '#efe6d4'); px(ctx, -0.5, -2.6, 1.4, 5.2, '#080b0f');
      break;
    case 'staff': line(ctx, -16, 0, 16, 0, '#000', 3.6); line(ctx, -16, 0, 16, 0, '#c99a52', 2); px(ctx, -16, -1.5, 3, 3, '#7a4a16'); px(ctx, 13.5, -1.5, 3, 3, '#7a4a16'); break;
    case 'spear':
      line(ctx, -12, 0, 22, 0, '#000', 3.2); line(ctx, -12, 0, 22, 0, '#8a5a2a', 1.9);
      line(ctx, 20, -4.4, 20, 4.4, '#000', 3.4); line(ctx, 20, -4.4, 20, 4.4, '#e8eef4', 1.9);
      line(ctx, 22, 0, 29, 0, '#000', 3); line(ctx, 22, 0, 29, 0, '#ffffff', 1.6);
      break;
    case 'axe':
      line(ctx, -6, 0, 15, 0, '#000', 3.6); line(ctx, -6, 0, 15, 0, '#6b4423', 2.2);
      line(ctx, 12, -8, 12, 8, '#000', 4.6); line(ctx, 12, -8, 12, 8, '#d7dee8', 2.8);
      break;
    case 'dual':
      line(ctx, 0, -3, 20, -6, '#05070a', 4); line(ctx, 0, -3, 20, -6, '#eaf6ff', 2);
      line(ctx, 0, 3, 20, 6, '#05070a', 4); line(ctx, 0, 3, 20, 6, '#eaf6ff', 2);
      break;
    case 'nunchaku': line(ctx, 0, 0, 9, 0, '#8a5a2a', 3.2); line(ctx, 12, 2, 21, 6, '#8a5a2a', 3.2); line(ctx, 9, 0, 12, 2, '#9aa3b2', 1.4); break;
    case 'pistol': px(ctx, -1, -2.4, 13, 4.8, '#000'); px(ctx, 0, -1.4, 11, 2.8, '#3a3a44'); px(ctx, -3.4, -1, 3.4, 7, '#22222c'); break;
    case 'rifle': px(ctx, -8, -2.2, 30, 4.4, '#000'); px(ctx, -7, -1.2, 28, 2.4, '#3a3a44'); px(ctx, -10, -1, 4, 6, '#22222c'); px(ctx, 4, -4, 7, 1.6, '#222'); break;
    default: line(ctx, 0, 0, 10, 0, '#000', 3);
  }
  ctx.restore();
}
function drawDrop(ctx: CanvasRenderingContext2D, d: { x: number; y: number; z: number; rot: number; kind: string; t: number }) {
  ctx.save(); ctx.translate(d.x, d.y + 1 - d.z); ctx.rotate(d.rot);
  const sh = Math.max(0.25, 1 - d.z / 45);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * sh})`; ctx.beginPath(); ctx.ellipse(0, 3, 5 * sh, 2 * sh, 0, 0, TAU); ctx.fill();
  switch (d.kind) {
    case 'katana': line(ctx, -7, 0, 7, 0, '#000', 2.4); line(ctx, -7, 0, 7, 0, '#dfeaf5', 1.3); px(ctx, -8, -1, 2.4, 2, '#c02830'); break;
    case 'pipe': line(ctx, -6, 0, 6, 0, '#000', 2.8); line(ctx, -6, 0, 6, 0, '#8a8f99', 1.6); px(ctx, -6.6, -1.4, 2.6, 2.8, '#5a5f68'); break;
    case 'cleaver': line(ctx, -1, 0, 7, 0, '#000', 2.6); line(ctx, -1, 0, 7, 0, '#cfd6de', 1.4); px(ctx, -3.4, -1.4, 3, 2.8, '#6b4423'); break;
    case 'rifle': line(ctx, -6, 0, 6, 0, '#000', 3); line(ctx, -6, 0, 6, 0, '#444', 1.8); break;
    case 'smg': line(ctx, -4, 0, 4, 0, '#000', 2.8); line(ctx, -4, 0, 4, 0, '#444', 1.6); break;
    case 'sniper': line(ctx, -8, 0, 8, 0, '#000', 2.4); line(ctx, -8, 0, 8, 0, '#333', 1.4); px(ctx, 0, -2, 3, 1, '#222'); break;
    default: line(ctx, -5, 0, 5, 0, '#000', 2.4); line(ctx, -5, 0, 5, 0, '#666', 1.4);
  }
  ctx.restore();
}
function drawCorpse(ctx: CanvasRenderingContext2D, c: import('./game').Corpse, g: Game) {
  const b = g.lvl.biome;
  const s = ENEMY_SIZES[c.kind] ?? ENEMY_SIZES.thug;
  const fade = c.t > 1.8 ? 1 - (c.t - 1.8) / 0.5 : 1;
  ctx.globalAlpha = Math.max(0, fade);
  drawStick(ctx, c.x, c.y + 2 - c.z, {
    color: enemyColor(c.kind, c.elite, b), accent: b.accent, facing: c.facing, walk: 0,
    pose: c.z > 2 ? 'fly' : 'knock', t: 0, rot: c.rot, moveAng: c.facing, scale: s.scale * (c.elite ? 1.12 : 1),
    headR: s.hr, body: s.body, legs: s.legs, thick: s.thick, sqx: c.sqx, sqy: c.sqy, kind: c.kind, time: g.time,
  });
  // SPLIT CLEAVE: a full bisection down the middle
  if (c.slashT > 0 && (c as any).split) {
    const a = c.slashAng;
    ctx.globalAlpha = Math.min(1, c.slashT / 0.3) * fade;
    line(ctx, c.x - Math.cos(a) * 14, c.y - 6 - c.z - Math.sin(a) * 14, c.x + Math.cos(a) * 14, c.y - 6 - c.z + Math.sin(a) * 14, '#fff', 2.4);
    line(ctx, c.x - Math.cos(a) * 14, c.y - 6 - c.z - Math.sin(a) * 14, c.x + Math.cos(a) * 14, c.y - 6 - c.z + Math.sin(a) * 14, '#c02830', 1.1);
    ctx.globalAlpha = 1;
  }
  // katana cut mark across the sliced body
  if (c.slashT > 0 && !(c as any).split) {
    const a = c.slashAng + Math.PI / 2, len = 11;
    ctx.globalAlpha = Math.min(1, c.slashT / 0.2) * fade;
    line(ctx, c.x - Math.cos(a) * len, c.y - 5 - c.z - Math.sin(a) * len, c.x + Math.cos(a) * len, c.y - 5 - c.z + Math.sin(a) * len, '#fff', 2);
    line(ctx, c.x - Math.cos(a) * len, c.y - 5 - c.z - Math.sin(a) * len, c.x + Math.cos(a) * len, c.y - 5 - c.z + Math.sin(a) * len, '#ff3b3b', 0.8);
  }
  ctx.globalAlpha = 1;
}
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, g: Game) {
  if (g.phase === 'dead') return;
  const blink = p.iframes > 0 && p.hurtT <= 0 && p.state !== 'dash' && p.state !== 'kick' && p.state !== 'takedown' && p.state !== 'sweep' && !p.focusDash && !p.rageDash && Math.floor(g.time * 30) % 2 === 0;
  if (blink) return;
  let pose: string = p.state; let t = p.stateT; let atk: string | undefined;
  // mid blur-dash (FOCUS / RAGE) the body is already in the strike pose
  const blur = p.focusDash ?? p.rageDash;
  if (blur) { pose = 'attack'; atk = blur.atk.name; t = 0.42 + Math.min(1, blur.t) * 0.16; }
  else if (p.state === 'ragecharge') { pose = 'crouch'; t = 0.4 + Math.sin(g.time * 30) * 0.1; }
  else if (p.state === 'ofapose') { pose = 'attack'; atk = 'DRAGON PALM'; t = 0.15; }
  else if (p.state === 'iaidash') { pose = 'attack'; atk = 'THRUST'; t = 0.55; }
  else if (p.state === 'axerush') { pose = 'attack'; atk = 'OVERHEAD CHOP'; t = (p.stateT * 2.4) % 1; }
  else if (p.state === 'bladerush') { pose = 'attack'; atk = Math.floor(p.stateT * 8) % 2 ? 'L SLASH' : 'R SLASH'; t = 0.5; }
  else if (p.state === 'nunrush') { pose = 'attack'; atk = 'NUN SPIN'; t = (p.stateT * 2.5) % 1; }
  else if (p.state === 'tkdkick') { const tt = p.stateT / 0.52; pose = tt < 0.16 || tt >= 0.8 ? 'crouch' : 'sidekick'; t = tt; }
  else if (p.state === 'idle' && p.brakeT > 0 && p.z === 0 && Math.hypot(p.vx, p.vy) < 80) { pose = 'brake'; t = Math.min(1, p.brakeT / 0.35); }
  else if (p.state === 'idle' && Math.hypot(p.vx, p.vy) < 25 && p.z === 0 && p.chargeT <= 0.15) pose = 'shuffle';
  else if (p.state === 'airkick') pose = 'sidekick';
  else if (p.state === 'idle' && p.whiff > 0.05) pose = 'whiff';
  else if (p.state === 'idle' && p.z > 2) pose = 'jump';
  else if (p.state === 'idle' && p.chargeT > 0.15) pose = 'crouch';
  if (p.state === 'attack' && p.curAttack) { pose = 'attack'; atk = p.curAttack.name; t = p.stateT / p.curAttack.dur; }
  else if (p.state === 'kick') pose = 'flykick';
  else if (p.state === 'takedown') {
    const f = p.fatality;
    if (f === 'UPPERCUT') pose = p.didHit ? 'uppercut' : 'crouch';
    else if (f === 'RUSH PUNCH') pose = p.didHit ? 'rushpunch' : p.stateT < 0.22 ? 'crouch' : 'run';
    else if (f === 'PALM BLAST') { pose = p.didHit ? 'attack' : 'crouch'; if (p.didHit) { atk = 'DRAGON PALM'; t = 0.5; } }
    else if (f === 'KNEE LAUNCH') pose = p.didHit ? 'sidekick' : 'run';
    else if (f === 'SUPLEX THROW') pose = p.didHit ? 'uppercut' : 'crouch';
    else if (f === 'SPIN STRIKE') { pose = 'attack'; atk = 'SPIN KICK'; t = (p.stateT % 0.46) / 0.46; }
    else if (f === 'DRAGON TAIL') { pose = 'sweep'; t = Math.min(1, p.stateT * 1.6); }
    else if (f === 'CHAIN STRANGLE') { pose = 'attack'; atk = 'WHIP CRACK'; t = p.didHit ? 0.85 : 0.25; }
    else if (f === 'HELICOPTER STRIKE') { pose = 'attack'; atk = 'NUN SPIN'; t = (p.stateT * 2.4) % 1; }
    else if (f === 'SKULL CRUSHER') { pose = 'attack'; atk = 'WHIP CRACK'; t = p.didHit ? 0.9 : 0.35; }
    else if (f === 'IAI EXECUTION') { if (!p.didHit) pose = 'crouch'; else { pose = 'attack'; atk = 'THRUST'; t = 0.55; } }
    else if (f === 'SKY BURIAL') { if (!p.didHit) pose = 'crouch'; else if (p.target && p.target.z > 4) { pose = 'attack'; atk = 'SPIN IAI'; t = (p.stateT * 2) % 1; } else pose = 'idle'; }
    else if (f === 'THOUSAND CUTS') { pose = 'attack'; atk = 'IAI CROSS'; t = (p.stateT * 3) % 1; }
    else if (f === 'POINT BLANK' || f === 'GUN KATA') pose = 'idle';
    else if (f === 'CROWN CRUSHER') { pose = 'attack'; atk = 'DRAGON PALM'; t = p.didHit ? 0.85 : 0.35; }
    else if (f === 'SPINNING ELBOW') { pose = 'attack'; atk = 'HOOK'; t = (p.stateT * 3) % 1; }
    else if (f === 'SOUL PALM') { pose = 'attack'; atk = 'DRAGON PALM'; t = 0.6; }
    else if (f === 'TORNADO KICK') { pose = 'attack'; atk = 'SPIN KICK'; t = (p.stateT * 3.2) % 1; }
    else if (f === 'TIMBER FALL') { pose = 'attack'; atk = 'OVERHEAD CHOP'; t = p.didHit ? 0.85 : Math.min(0.4, p.stateT * 1.2); }
    else if (f === 'HOME RUN') { pose = 'attack'; atk = 'HOME RUN'; t = p.didHit ? 0.65 : Math.min(0.3, p.stateT); }
    else if (f === 'THOUSAND SLASHES') { pose = 'attack'; atk = Math.floor(p.stateT / 0.12) % 2 ? 'L SLASH' : 'R SLASH'; t = (p.stateT * 3.2) % 1; }
    else if (f === 'TWIN REAPER') { pose = 'attack'; atk = 'CROSS SCISSOR'; t = p.didHit ? 0.9 : 0.4; }
    else if (f === 'STAFF JUDGMENT') { pose = 'attack'; atk = 'VAULT STRIKE'; t = p.didHit ? 0.85 : Math.min(0.4, p.stateT * 1.2); }
    else if (f === 'BO CYCLONE') { pose = 'attack'; atk = 'STAFF TWIRL'; t = (p.stateT * 3) % 1; }
    else if (f === 'SANADA SKYFALL') { if (!p.didHit) pose = 'crouch'; else if (p.target && p.target.z > 4) { pose = 'attack'; atk = 'WHIRLWIND'; t = (p.stateT * 2) % 1; } else pose = 'idle'; }
    else if (f === 'CROSS EXECUTION') { if (!p.didHit) pose = 'crouch'; else { pose = 'attack'; atk = 'SANADA CHARGE'; t = 0.55; } }
    else { if (!p.didHit) { if (p.stateT < 0.16) pose = 'jump'; else { pose = 'axekick'; t = (p.stateT - 0.16) / 0.22; } } else { pose = 'axekick'; t = 1; } }
  }
  if (pose === 'idle' && p.moving && p.sprint > 0.6) pose = 'run';
  const yy = p.y + 2 - p.z;
  if (p.state === 'parry') { ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 11, p.facing - 1.2, p.facing + 1.2); ctx.stroke(); ctx.globalAlpha = 1; }
  if (p.state === 'block') { ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 10, p.facing - 1.3, p.facing + 1.3); ctx.stroke(); ctx.globalAlpha = 1; }
  if (p.focus >= 1 && p.state !== 'takedown') { ctx.globalAlpha = 0.3 + Math.sin(g.time * 6) * 0.1; ctx.strokeStyle = g.lvl.biome.accent; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y + 1, 7, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  // flying kick aura
  if (p.state === 'kick') { ctx.globalAlpha = 0.35; ctx.strokeStyle = g.lvl.biome.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, yy - 6, 10, p.facing - 0.9, p.facing + 0.9); ctx.stroke(); ctx.globalAlpha = 1; }
  const rotP = (p.state === 'idle' && Math.hypot(p.vx, p.vy) > 30 ? p.bank : 0) + (p.whiff > 0 ? Math.sin(p.whiff * Math.PI) * 0.22 * -(Math.cos(p.facing) >= 0 ? 1 : -1) : 0);
  if (p.ofaActive) {
    ctx.globalAlpha = 0.55 + Math.sin(g.time * 16) * 0.2; ctx.strokeStyle = '#57e6ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y - 4 - p.z, 11 + Math.sin(g.time * 12) * 1.5, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (p.rageCharge > 0 || p.ofaPose > 0) {
    const k = p.rageCharge > 0 ? 1 - p.rageCharge / 0.85 : 1 - Math.max(0, p.ofaPose) / 0.7;
    const col = p.rageCharge > 0 ? '#ffd23d' : '#ffffff';
    ctx.globalAlpha = 0.35 + Math.sin(g.time * 26) * 0.2;
    ctx.strokeStyle = col; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 9 + k * 7, 3.2 + k * 2, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, (9 + k * 7) * 0.6, (3.2 + k * 2) * 0.6, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (p.raging) {
    ctx.globalAlpha = 0.45 + Math.sin(g.time * 14) * 0.2; ctx.strokeStyle = '#ff2a2a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y - 4 - p.z, 10 + Math.sin(g.time * 10) * 1.5, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (p.state === 'vault') { pose = 'attack'; atk = 'VAULT STRIKE'; }
  else if (p.state === 'lancerush') { pose = 'attack'; atk = 'SANADA CHARGE'; t = 0.55; }
  const nunAng = g.nunchaku.pts.length ? Math.atan2(g.nunchaku.pts[0].y - (p.y - 4 - p.z), g.nunchaku.pts[0].x - p.x) : p.facing;
  if (p.chargeT > 0.15) {
    const r = 9 + Math.min(1, p.chargeT) * 8;
    ctx.globalAlpha = 0.35 + Math.sin(g.time * 20) * 0.15; ctx.strokeStyle = g.lvl.biome.accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y - 5 - p.z, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    if (p.chargeT >= 0.35) text(ctx, 'MAX', p.x, p.y - 22 - p.z, 5, '#ffd166', 'center');
  }
  drawStick(ctx, p.x, yy, {
    color: p.hurtT > 0 ? '#ff3b3b' : SKINS[g.skinIndex].body, skinBand: SKINS[g.skinIndex].band, accent: g.lvl.biome.accent, facing: p.facing, walk: p.walk, pose, t, atk, nunAng, moveAng: p.legAng, rot: rotP,
    // legs only (game2 gait): real travel state, sprint blend for the animation, half step in px
    moving: Math.hypot(p.vx, p.vy) > 5, run: Math.min(1, p.sprint / 0.25), stride: p.strideHalf,
    scale: 1, headR: 4 * (g.bodyScale ? 0.9 : 1), body: 4 * G_BS, legs: 3 * G_LS, thick: g.bodyScale ? 2.1 : 1.5, sqx: p.sqx, sqy: p.sqy, weapon: ['idle', 'block', 'attack', 'takedown', 'vault', 'lancerush'].includes(p.state) ? p.weapon : p.weapon === 3 || p.weapon === 4 || p.weapon === 7 || p.weapon === 8 ? p.weapon : 0, kind: 'player', time: g.time,
  });
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, g: Game) {
  const b = g.lvl.biome;
  if (e.state === 'teleport') return;
  if (e.spawnT > 0) { ctx.globalAlpha = 1 - e.spawnT / 0.4; }
  const s = ENEMY_SIZES[e.kind] ?? ENEMY_SIZES.thug;
  if (e.elite) { s.scale *= 1; ctx.globalAlpha = 0.35 + Math.sin(g.time * 8) * 0.15; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y + 1, e.r + 4, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  if (e.rage > 0 && Math.floor(g.time * 12) % 2 === 0) { px(ctx, e.x - 1, e.y - e.r - 16, 2, 2, '#ff3b3b'); }
  const isRanged = e.kind === 'gunner' || e.kind === 'rifleman' || e.kind === 'smg' || e.kind === 'sniper';
  const victimFly = e.state === 'victim' && g.player.didHit && !['AXE KICK', 'IAI EXECUTION', 'THOUSAND CUTS', 'POINT BLANK', 'GUN KATA', 'SKULL CRUSHER', 'TIMBER FALL', 'TWIN REAPER', 'STAFF JUDGMENT', 'CROSS EXECUTION', 'CROWN CRUSHER', 'SOUL PALM'].includes(g.player.fatality);
  const flyAtk = e.kind === 'dasher' || (e.kind === 'samurai' && e.pattern === 'FLY') || (e.kind === 'boss' && e.pattern === 'fly');
  const pose = e.reloading > 0 && e.state === 'chase' ? 'reload' : e.state === 'windup' ? (isRanged ? 'idle' : 'windup') : e.state === 'attack' ? (flyAtk ? 'sidekick' : (e.kind === 'boss' && e.pattern === 'slam') ? 'dash' : 'attack') : e.state === 'stun' ? 'stun' : victimFly ? 'fly' : e.state === 'broken' || e.state === 'victim' ? 'broken' : e.state === 'knock' ? (e.z > 2 ? 'fly' : 'knock') : e.state === 'getup' ? 'getup' : 'idle';
  const col = enemyColor(e.kind, e.elite, b);
  const wuT = e.state === 'windup' ? Math.min(1, e.stateT / e.def.windup) : 0;
  const flashW = e.state === 'windup' && wuT > 0.7 && Math.floor(g.time * 25) % 2 === 0;
  if (e.kind !== 'boss' && e.state === 'attack' && pose === 'attack') { /* enemy punches use JAB anim */ }
  drawStick(ctx, e.x, e.y + 2 - e.z, { color: col, accent: b.accent, facing: e.facing, walk: e.walk, pose, react: e.react, reactAng: e.reactAng, moveAng: e.moveAng, moving: e.walking, stride: e.strideHalf, t: pose === 'attack' ? Math.min(1, 0.3 + e.stateT * 2.5) : e.stateT, atk: e.kind === 'samurai' ? 'DRAW CUT' : e.kind === 'brute' || e.kind === 'boss' ? 'HOOK' : 'JAB', weapon: e.kind === 'samurai' ? 4 : undefined, rot: e.rot, scale: s.scale * (e.elite ? 1.12 : 1), headR: s.hr * (g.bodyScale ? 0.9 : 1), body: s.body * G_BS, legs: s.legs * G_LS, thick: s.thick * (g.bodyScale ? 1.4 : 1), sqx: e.sqx, sqy: e.sqy, kind: e.kind, seed: e.id * 1.7, flash: e.flash > 0 || flashW, time: g.time, bossWeap: BOSS_WEAPON[e.bossStyle] });
  if (e.reloading > 0) text(ctx, 'RELOAD', e.x, e.y - s.legs - s.body - s.hr * 2 - 9, 5, Math.floor(g.time * 6) % 2 ? '#ddd' : '#888', 'center');
  if (e.state === 'windup' && isRanged) {
    const pr = Math.min(1, e.stateT / e.def.windup);
    if (pr > 0.7 && Math.floor(g.time * 20) % 2 === 0) {
      const gx = e.x + Math.cos(e.facing) * (e.r + 9), gy = e.y - 4 - e.z + Math.sin(e.facing) * 6;
      px(ctx, gx - 2, gy, 5, 1, '#fff'); px(ctx, gx, gy - 2, 1, 5, '#fff'); px(ctx, gx - 0.5, gy - 0.5, 2, 2, '#ffd166');
    }
  }
  // '!' telegraph marker
  if (e.state === 'windup' && !isRanged) { const yy = e.y - s.legs - s.body - s.hr * 2 - 6 - (e.kind === 'boss' ? 8 : 0); text(ctx, '!', e.x, yy - (wuT > 0.7 ? 1 : 0), 8, wuT > 0.7 ? '#ff3b3b' : '#ffd166', 'center'); }
  ctx.globalAlpha = 1;
}

function drawHUD(ctx: CanvasRenderingContext2D, g: Game, rt: number) {
  const p = g.player, b = g.lvl.biome, m = g.mods;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // vignette when low hp
  if (p.hp / m.maxHp < 0.3 && g.phase === 'playing') { const a = 0.25 + Math.sin(rt * 6) * 0.1; const gr = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VH * 0.8); gr.addColorStop(0, 'rgba(255,40,40,0)'); gr.addColorStop(1, `rgba(255,40,40,${a})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH); }
  // flash
  if (g.flash > 0) { ctx.globalAlpha = Math.min(0.85, g.flash); ctx.fillStyle = g.flashColor; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  // slow-mo letterbox — game2's curve: bars grow as time slows, plus fixed cinematic bars mid blur-dash
  {
    const pl = g.player, cine = !!(pl.focusDash || pl.rageDash);
    if (g.timeScale < 0.75 || cine) {
      const h = cine ? 18 : Math.round((0.75 - g.timeScale) * 40);
      px(ctx, 0, 0, VW, h, '#000'); px(ctx, 0, VH - h, VW, h, '#000');
    }
  }

  // HP bar
  const hx = 8, hy = 8, hw = 90;
  px(ctx, hx - 2, hy - 2, hw + 4, 12, '#000c');
  px(ctx, hx, hy, hw, 8, '#2a0a0a');
  const hpF = Math.max(0, p.hp / m.maxHp);
  px(ctx, hx, hy, Math.round(hw * hpF), 8, p.hurtT > 0 ? '#fff' : '#ff3b3b');
  px(ctx, hx, hy, Math.round(hw * hpF), 2, '#ff8a8a');
  for (let i = 1; i < m.maxHp / 25; i++) px(ctx, hx + Math.round(hw * (i * 25 / m.maxHp)), hy, 1, 8, '#000a');
  text(ctx, `${Math.ceil(p.hp)}`, hx + hw + 6, hy, 8, '#fff');
  // guard
  px(ctx, hx, hy + 11, hw, 3, '#1a1a1a'); px(ctx, hx, hy + 11, Math.round(hw * Math.min(1, p.guard / 100)), 3, p.guard > 70 ? '#ff3b3b' : '#ffd166');
  // focus pips
  for (let i = 0; i < 3; i++) {
    const fx = hx + i * 14, fy = hy + 18; const f = Math.max(0, Math.min(1, p.focus - i));
    ctx.save(); ctx.translate(fx + 5, fy + 5); ctx.rotate(Math.PI / 4);
    px(ctx, -4, -4, 8, 8, '#000c'); px(ctx, -3, -3, 6, 6, '#222');
    if (f > 0) { px(ctx, -3, 3 - Math.round(6 * f), 6, Math.round(6 * f), f >= 1 ? b.accent : '#777'); }
    if (f >= 1) px(ctx, -3, -3, 6, 1, '#fff');
    ctx.restore();
  }
  text(ctx, 'Q/E', hx + 46, hy + 20, 6, '#888');
  // RAGE meter
  {
    const ry = hy + 31, rw = 70;
    px(ctx, hx - 1, ry - 1, rw + 2, 6, '#000c'); px(ctx, hx, ry, rw, 4, '#1a0505');
    const rf = Math.max(0, Math.min(1, p.rage / 100));
    px(ctx, hx, ry, Math.round(rw * rf), 4, p.raging ? (Math.floor(rt * 10) % 2 ? '#ff2a2a' : '#ff7a1a') : rf >= 0.6 ? '#ff5a3c' : '#8a2a1a');
    if (rf >= 1) px(ctx, hx, ry, rw, 1, '#ffb060');
    text(ctx, 'RAGE', hx + rw + 4, ry - 1, 6, p.raging ? '#ff5a3c' : '#888');
    if (!p.raging && p.rage >= 60) text(ctx, 'R!', hx + rw + 26, ry - 1, 6, Math.floor(rt * 6) % 2 ? '#ff2a2a' : '#ffd166');
  }
  // ONE FOR ALL meter
  {
    const oy = hy + 42, ow = 70;
    px(ctx, hx - 1, oy - 1, ow + 2, 6, '#000c'); px(ctx, hx, oy, ow, 4, '#04141a');
    const of = Math.max(0, Math.min(1, p.ofa / 100));
    px(ctx, hx, oy, Math.round(ow * of), 4, p.ofaActive ? (Math.floor(rt * 12) % 2 ? '#57e6ff' : '#c8fbff') : of >= 0.25 ? '#2a9db8' : '#14424e');
    if (of >= 1) px(ctx, hx, oy, ow, 1, '#c8fbff');
    text(ctx, 'OFA', hx + ow + 4, oy - 1, 6, p.ofaActive ? '#57e6ff' : '#888');
    if (!p.ofaActive && p.ofa >= 25) text(ctx, 'X!', hx + ow + 22, oy - 1, 6, Math.floor(rt * 6) % 2 ? '#57e6ff' : '#fff');
  }
  // FOCUS meter (game2's FOCUS system): 300 max, 100 per Focus Strike, spent with C
  {
    const fy = hy + 53, fw = 70;
    const ff = Math.max(0, Math.min(1, p.focusMeter / 300));
    const ready = p.focusMeter >= 100;
    px(ctx, hx - 1, fy - 1, fw + 2, 6, '#000c'); px(ctx, hx, fy, fw, 4, '#0a1410');
    px(ctx, hx, fy, Math.round(fw * ff), 4, p.focusDash ? (Math.floor(rt * 12) % 2 ? b.accent : '#ffffff') : ready ? b.accent : '#2f6b52');
    px(ctx, hx + Math.round(fw / 3), fy, 1, 4, '#0009');            // notch = one strike's cost
    if (ready) px(ctx, hx, fy, fw, 1, '#ffffff');
    text(ctx, 'FOCUS', hx + fw + 4, fy - 1, 6, ready ? b.accent : '#888');
    if (ready && !p.focusDash) text(ctx, 'C!', hx + fw + 30, fy - 1, 6, Math.floor(rt * 6) % 2 ? '#fff' : b.accent);
  }
  // weapon
  const wnames = ['FISTS', 'PISTOL', 'RIFLE', 'NUNCHAKU', 'KATANA', 'AXE', 'DUAL', 'STAFF', 'SANADA'];
  const ammo = p.weapon === 1 ? `${p.ammoP}` : p.weapon === 2 ? `${p.ammoR}` : '∞';
  px(ctx, 6, VH - 24, 84, 18, '#000c');
  text(ctx, wnames[p.weapon], 10, VH - 20, 8, p.weapon === 0 ? b.accent : '#ffd166');
  text(ctx, ammo, 10, VH - 11, 7, p.weapon > 0 && ((p.weapon === 1 && p.ammoP === 0) || (p.weapon === 2 && p.ammoR === 0)) ? '#ff3b3b' : '#fff');
  // weapon slots
  for (let i = 0; i < 9; i++) { const sx = 96 + i * 12; px(ctx, sx, VH - 16, 10, 10, i === p.weapon ? b.accent : '#222'); text(ctx, `${i + 1}`, sx + 5, VH - 14, 6, i === p.weapon ? '#000' : '#888', 'center', false); }
  const left = g.enemies.filter((e) => e.state !== 'dead').length;
  if (g.isEndless) {
    const E = g.endless;
    // XP bar across top
    const xw = 220, xx = VW / 2 - xw / 2, xy = 3;
    px(ctx, xx - 1, xy - 1, xw + 2, 6, '#000c'); px(ctx, xx, xy, xw, 4, '#1a1a1a');
    px(ctx, xx, xy, Math.round(xw * Math.min(1, E.xp / E.xpNext)), 4, b.accent); px(ctx, xx, xy, Math.round(xw * Math.min(1, E.xp / E.xpNext)), 1, '#fff');
    text(ctx, `LV ${g.level}`, xx - 4, xy - 1, 7, '#fff', 'right');
    const tm = Math.floor(E.time / 60), ts = Math.floor(E.time % 60);
    text(ctx, `${tm}:${ts < 10 ? '0' : ''}${ts}`, VW / 2, xy + 9, 9, '#fff', 'center');
    text(ctx, `WAVE ${E.wave}  ·  ${left} ALIVE`, VW / 2, xy + 20, 6, '#aaa', 'center');
    text(ctx, `STAGE ${E.stage}`, VW - 8, 8, 8, '#fff', 'right');
    text(ctx, b.name, VW - 8, 19, 6, b.accent, 'right');
    text(ctx, `${g.score}`, VW - 8, 29, 7, '#aaa', 'right');
    const tier = g.aiTierFor();
    text(ctx, `ENEMY IQ`, VW - 8, VH - 26, 6, '#888', 'right');
    text(ctx, AI_TIERS[tier].name, VW - 8, VH - 17, 7, tier >= 6 ? '#ff3b3b' : tier >= 3 ? '#ffd166' : '#fff', 'right');
    for (let i = 0; i < AI_TIERS.length; i++) px(ctx, VW - 8 - (AI_TIERS.length - i) * 5, VH - 8, 4, 3, i <= tier ? (i >= 6 ? '#ff3b3b' : '#ffd166') : '#333');
    text(ctx, `${g.kills} KILLS`, VW - 8, 39, 6, '#888', 'right');
    const nextWave = Math.max(0, 40 - E.waveT);
    if (nextWave < 5) text(ctx, `WAVE IN ${Math.ceil(nextWave)}`, VW / 2, xy + 30, 7, Math.sin(rt * 10) > 0 ? '#ff3b3b' : '#fff', 'center');
  } else {
    text(ctx, `LV ${g.level}/200`, VW - 8, 8, 8, '#fff', 'right');
    text(ctx, b.name, VW - 8, 19, 6, b.accent, 'right');
    text(ctx, `${g.score}`, VW - 8, 29, 7, '#aaa', 'right');
    text(ctx, `${g.kills} KILLS`, VW - 8, 39, 6, '#888', 'right');
    if (left > 0) text(ctx, `${left} LEFT`, VW - 8, VH - 16, 7, '#888', 'right');
    else if (g.portal) text(ctx, 'ENTER THE PORTAL', VW - 8, VH - 16, 7, Math.sin(rt * 8) > 0 ? b.accent : '#fff', 'right');
  }
  // offscreen indicators
  const alive = g.enemies.filter((e) => e.state !== 'dead');
  const targets = (left <= 4 ? alive.map((e) => ({ x: e.x, y: e.y, c: b.enemy2 })) : alive.filter((e) => e.kind === 'boss').map((e) => ({ x: e.x, y: e.y, c: '#ff3b3b' }))).concat(g.portal ? [{ x: g.portal.x, y: g.portal.y, c: b.accent }] : []);
  for (const t of targets) {
    const sx = (t.x - g.cam.x) * g.zoom + VW / 2, sy = (t.y - g.cam.y) * g.zoom + VH / 2;
    if (sx > 10 && sx < VW - 10 && sy > 10 && sy < VH - 10) continue;
    const a = Math.atan2(sy - VH / 2, sx - VW / 2);
    const ex = Math.max(12, Math.min(VW - 12, sx)), ey = Math.max(12, Math.min(VH - 12, sy));
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = t.c; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-3, -4); ctx.lineTo(-3, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // combo — bottom-right corner, away from the action
  if (g.combo >= 2) {
    const sc = 1 + g.comboPop * 0.35;
    const cx = VW - 10, cy = VH - (g.isEndless ? 62 : 46);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    text(ctx, `${g.combo} HITS`, 0, 0, 10, g.combo >= 20 ? '#ffd166' : g.combo >= 10 ? b.accent : '#fff', 'right');
    ctx.restore();
    px(ctx, cx - 44, cy + 12, 44, 2, '#222'); px(ctx, cx - 44 + Math.round(44 * (1 - Math.max(0, g.comboT) / 3.0)), cy + 12, Math.round(44 * Math.max(0, g.comboT) / 3.0), 2, b.accent);
  }
  // FATALITY announcement — top of screen, Dota-style
  if (g.perfectT > 0 && g.perfectText === 'FATALITY') {
    const y = g.isEndless ? 34 : 12;
    const age = 1.4 - g.perfectT;
    const sc = age < 0.15 ? 0.75 + age / 0.15 * 0.3 : 1.05;
    ctx.globalAlpha = Math.min(1, g.perfectT / 0.3);
    px(ctx, 0, y - 3, VW, 20, '#000a'); px(ctx, 0, y - 3, VW, 1, '#ff3b3b'); px(ctx, 0, y + 16, VW, 1, '#ff3b3b');
    ctx.save(); ctx.translate(VW / 2 + (Math.random() - 0.5) * 1.5, y); ctx.scale(sc, sc);
    text(ctx, 'FATALITY', 1.5, 1.5, 13, '#000', 'center', false);
    text(ctx, 'FATALITY', 0, 0, 13, Math.floor(rt * 16) % 2 ? '#ff3b3b' : '#ffd166', 'center', false);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // combat feed — top right, under the kills UI
  g.feed.forEach((f, i) => {
    const y = 50 + i * 11;
    const age = 1.5 - f.t;
    const a = Math.min(1, f.t / 0.3);
    const sc = age < 0.12 ? 1.5 - age : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(VW - 8, y); ctx.scale(sc, sc);
    text(ctx, f.count > 1 ? `${f.text} x${f.count}` : f.text, 0, 0, 7, f.color, 'right', true);
    ctx.restore();
  });
  // boss bar
  const boss = g.enemies.find((e) => e.kind === 'boss' && e.state !== 'dead');
  if (boss) {
    const bw = 200, bx = VW / 2 - bw / 2, by = g.isEndless ? 56 : 40;
    text(ctx, boss.name || g.bossName, VW / 2, by - 10, 7, '#fff', 'center');
    px(ctx, bx - 2, by - 2, bw + 4, 10, '#000c'); px(ctx, bx, by, bw, 4, '#300'); px(ctx, bx, by, Math.round(bw * boss.hp / boss.maxHp), 4, boss.flash > 0 ? '#fff' : '#ff3b3b');
    px(ctx, bx, by + 5, bw, 2, '#222'); px(ctx, bx, by + 5, Math.round(bw * Math.min(1, boss.posture / boss.maxPosture)), 2, boss.state === 'broken' ? '#fff' : '#ffd166');
    if (boss.state === 'broken') text(ctx, 'TAKEDOWN! (F)', VW / 2, by + 10, 7, Math.sin(rt * 15) > 0 ? '#ffd166' : '#fff', 'center');
  }
  // MID-BOSS bars: small named bars stacked under the boss bar
  const mids = g.enemies.filter((e) => e.name && e.kind !== 'boss' && e.state !== 'dead');
  mids.slice(0, 3).forEach((mb, i) => {
    const bw = 118, bx = VW / 2 - bw / 2, by = (g.isEndless ? 56 : 40) + 22 + i * 15;
    text(ctx, `${mb.name}`, VW / 2, by - 8, 5.4, '#ffd166', 'center');
    px(ctx, bx - 1.5, by - 1.5, bw + 3, 6, '#000c');
    px(ctx, bx, by, bw, 2.6, '#301a00');
    px(ctx, bx, by, Math.round(bw * Math.max(0, mb.hp / mb.maxHp)), 2.6, '#ff9a2a');
    px(ctx, bx, by + 3.4, bw, 1.4, '#221a00');
    px(ctx, bx, by + 3.4, Math.round(bw * Math.min(1, mb.posture / mb.maxPosture)), 1.4, mb.state === 'broken' ? '#fff' : '#c99a52');
  });
  // banner
  if (g.banner.t > 0) {
    const a = Math.min(1, g.banner.t, Math.max(0.01, (3.0 - g.banner.t)) * 3);
    ctx.globalAlpha = Math.max(0, a);
    px(ctx, 0, VH / 2 - 26, VW, 40, '#000a'); px(ctx, 0, VH / 2 - 26, VW, 1, b.accent); px(ctx, 0, VH / 2 + 13, VW, 1, b.accent);
    text(ctx, g.banner.text, VW / 2, VH / 2 - 18, 14, '#fff', 'center');
    text(ctx, g.banner.sub, VW / 2, VH / 2 + 1, 7, b.accent, 'center');
    ctx.globalAlpha = 1;
  }
  // transition iris
  if (g.phase === 'transition') {
    const t = g.transT; const r = t < 0.5 ? (1 - t / 0.5) : (t - 0.5) / 0.5;
    const rad = r * r * 320;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.arc(VW / 2, VH / 2, Math.max(0, rad), 0, TAU, true); ctx.fill();
    if (t > 0.4 && t < 0.6) text(ctx, `LEVEL ${g.level}`, VW / 2, VH / 2 - 6, 12, '#fff', 'center');
  }
}

function drawTitleBg(ctx: CanvasRenderingContext2D, rt: number) {
  for (let i = 0; i < 40; i++) { const x = (i * 97 + rt * (10 + i % 5 * 8)) % (VW + 20) - 10; const y = (i * 53) % VH; px(ctx, x, y, 2, 1, i % 3 === 0 ? '#ff3b3b' : '#2a2a3d'); }
  // ground line
  px(ctx, 0, VH - 40, VW, 1, '#2a2a3d');
  // marching stickmen
  for (let i = 0; i < 7; i++) {
    const x = ((i * 80 + rt * 30) % (VW + 60)) - 30;
    drawStick(ctx, x, VH - 40, { color: i === 3 ? '#fff' : '#9a9ab8', facing: 0, walk: rt * 12 + i, pose: i === 3 ? 'attack' : 'idle', t: (rt * 2) % 1, scale: 1.6, headR: 4, body: 4, legs: 3, thick: 1.5, sqx: 1, sqy: 1, kind: i === 3 ? 'player' : 'thug', time: rt });
  }
}

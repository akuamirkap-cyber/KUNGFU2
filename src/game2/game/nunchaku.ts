import { pcircle, pline, prect, type Ctx } from './pixel';
import type { Vec } from './types';

/**
 * Nunchaku = two sticks joined by a short chain. The near stick is held (its grip end follows the hand, its
 * tip is driven by the pose), the chain + far stick are a verlet rope with gravity, drag and distance constraints.
 * The far stick's tip is the weapon hitbox: it hits exactly where you see it.
 */
export class Nunchaku {
  // particles: 0 = grip (hand), 1 = near-stick tip, 2..N-2 chain links, N-1 = far stick end
  px: number[] = [];
  py: number[] = [];
  ox: number[] = [];
  oy: number[] = [];
  readonly stickLen = 6.3;
  readonly chainLen = 4.9;
  readonly links = 4;
  /** V2: nunchaku 30% lebih kecil + fisika tali & trail meniru game1 (slide 1) */
  v2 = false;
  /** faktor ukuran efektif: V2 = 0.7 (proposri on-screen sama kayak game1 di bawah zoom 1.4) */
  private s(): number { return this.v2 ? 0.7 : 1; }
  readonly n: number;
  spinAng = 0;
  spinSpeed = 0;
  trail: { x: number; y: number; t: number }[] = [];
  prevTip: Vec = { x: 0, y: 0 };
  tipSpeed = 0;
  /** V2 wrist physics: stick yang dipegang punya inertia rotasi (lag, droop gravitasi, fidget mikro) */
  gripAng = 0;
  gripVel = 0;
  gripInit = false;
  private t = 0;
  private hx = 0; private hy = 0; private hvx = 0; private hvy = 0;

  constructor() {
    this.n = 2 + this.links + 1;
    for (let i = 0; i < this.n; i++) { this.px.push(0); this.py.push(0); this.ox.push(0); this.oy.push(0); }
  }

  reset(x: number, y: number) {
    for (let i = 0; i < this.n; i++) { this.px[i] = x; this.py[i] = y + i * 2; this.ox[i] = this.px[i]; this.oy[i] = this.py[i]; }
    this.trail.length = 0;
    this.prevTip = { x, y };
    this.gripInit = false; this.hx = x; this.hy = y; this.hvx = 0; this.hvy = 0;
  }

  tip(): Vec { return { x: this.px[this.n - 1], y: this.py[this.n - 1] }; }
  /** how taut the chain is: 1 = fully extended from the grip to the far tip */
  tautness() {
    const full = (this.stickLen + this.chainLen + this.stickLen * 0.9) * this.s();
    return Math.hypot(this.px[this.n - 1] - this.px[0], this.py[this.n - 1] - this.py[0]) / full;
  }
  farMid(): Vec { return { x: (this.px[this.n - 2] + this.px[this.n - 1]) / 2, y: (this.py[this.n - 2] + this.py[this.n - 1]) / 2 }; }

  /**
   * @param hand grip position (world, already includes z lift)
   * @param nearDir direction the held stick points (unit)
   * @param dt seconds
   * @param spin >0: angular velocity to drive the chain in a circle around the hand (helicopter / figure-8)
   */
  update(hand: Vec, nearDir: Vec, dt: number, spin: number, swingBoost: Vec | null, attacking = false) {
    const n = this.n;
    const S = this.s();
    const segLen = (i: number) => (i === 1 ? this.stickLen * S : i === n - 1 ? this.stickLen * 0.9 * S : this.chainLen / this.links * S);
    // integrate (verlet) for free particles 2..n-1
    const sub = 3;
    const h = dt / sub;
    const maxV = 2600 * h; // speed cap per substep (px)
    // V2 = feel tali game1: hampir tanpa gravitasi pas menyerang (cambuk ngikutin tangan,
    // damp 0.994, grav 360) dan drape berat/snappy pas idle (damp 0.985, grav 3300)
    const damp = this.v2 && attacking ? 0.994 : 0.985;
    const grav = this.v2 ? (attacking ? 360 : 3300) : 520;
    if (this.v2) {
      // WRIST FISIKA (V2): stick yang dipegang bukan kaku-las ke arah lengan — dia berputar
      // di tangan kayak pendulum beneran: lag & overshoot pas tangan disentak, droop karena
      // gravitasi, plus fidget mikro dua frekuensi (sin 2.1t + sin 5.7t) biar nggak monoton
      const dtS = Math.max(dt, 1e-4);
      const hvx = (hand.x - this.hx) / dtS, hvy = (hand.y - this.hy) / dtS;
      const AC = 9000;
      const hax = Math.max(-AC, Math.min(AC, (hvx - this.hvx) / dtS));
      const hay = Math.max(-AC, Math.min(AC, (hvy - this.hvy) / dtS));
      this.hx = hand.x; this.hy = hand.y; this.hvx = hvx; this.hvy = hvy;
      this.t += dt;
      if (spin === 0) {
        if (!this.gripInit) { this.gripAng = Math.atan2(nearDir.y, nearDir.x); this.gripVel = 0; this.gripInit = true; }
        const fidget = attacking ? Math.sin(this.t * 7.3) * 0.03 : Math.sin(this.t * 2.1) * 0.1 + Math.sin(this.t * 5.7 + 1.3) * 0.05;
        const target = Math.atan2(nearDir.y, nearDir.x) + fidget;
        const L = Math.max(2, this.stickLen * this.s());
        // pendulum di tangan: gravitasi efektif + gaya pseudo dari akselerasi tangan
        const aex = -hax, aey = grav - hay;
        const torque = (3 / (2 * L)) * (Math.cos(this.gripAng) * aey - Math.sin(this.gripAng) * aex);
        let dA = target - this.gripAng;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        this.gripVel += (torque + 420 * dA - 12 * this.gripVel) * dt;
        this.gripVel = Math.max(-45, Math.min(45, this.gripVel));
        this.gripAng += this.gripVel * dt;
      }
    }
    for (let s = 0; s < sub; s++) {
      for (let i = 2; i < n; i++) {
        let vx = (this.px[i] - this.ox[i]) * damp, vy = (this.py[i] - this.oy[i]) * damp;
        if (swingBoost) {
          // blend toward a target velocity that grows along the chain (the far stick whips hardest)
          const k = (i - 1) / (n - 2);
          const tx = swingBoost.x * h * k, ty = swingBoost.y * h * k;
          vx += (tx - vx) * 0.35; vy += (ty - vy) * 0.35;
        }
        const sp = Math.hypot(vx, vy);
        if (sp > maxV) { vx *= maxV / sp; vy *= maxV / sp; }
        this.ox[i] = this.px[i]; this.oy[i] = this.py[i];
        this.px[i] += vx; this.py[i] += vy + grav * h * h; // gravity (screen px/s^2)
      }
      // pinned particles: grip at the hand, near tip at hand + nearDir*stickLen (optionally spun)
      this.px[0] = hand.x; this.py[0] = hand.y;
      let ndx = nearDir.x, ndy = nearDir.y;
      if (spin !== 0) {
        this.spinAng += spin * h;
        ndx = Math.cos(this.spinAng); ndy = Math.sin(this.spinAng) * 0.6;
        const l = Math.hypot(ndx, ndy) || 1; ndx /= l; ndy /= l;
        if (this.v2) { this.gripAng = Math.atan2(ndy, ndx); this.gripVel = spin; this.gripInit = true; }
      } else if (this.v2) {
        // V2: arah stick = hasil wrist physics, bukan arah forearm mentah
        ndx = Math.cos(this.gripAng); ndy = Math.sin(this.gripAng);
      }
      this.px[1] = hand.x + ndx * this.stickLen * S; this.py[1] = hand.y + ndy * this.stickLen * S;
      // distance constraints
      for (let it = 0; it < (this.v2 ? 4 : 10); it++) {
        for (let i = 1; i < n; i++) {
          const L = segLen(i);
          const dx = this.px[i] - this.px[i - 1], dy = this.py[i] - this.py[i - 1];
          const d = Math.hypot(dx, dy) || 1e-6;
          const diff = (d - L) / d;
          const wA = i - 1 <= 1 ? 0 : 0.5, wB = i <= 1 ? 0 : 0.5;
          const tot = wA + wB || 1;
          this.px[i - 1] += dx * diff * (wA / tot); this.py[i - 1] += dy * diff * (wA / tot);
          this.px[i] -= dx * diff * (wB / tot); this.py[i] -= dy * diff * (wB / tot);
        }
        // far stick stays straight-ish: keep end-to-end distance of the last two segments near their sum
        const a = n - 3, b = n - 1;
        const dx = this.px[b] - this.px[a], dy = this.py[b] - this.py[a];
        const d = Math.hypot(dx, dy) || 1e-6;
        const want = segLen(n - 2) + segLen(n - 1) * 0.95;
        if (d < want) { const diff = (d - want) / d * 0.5; this.px[a] += dx * diff * 0.5; this.py[a] += dy * diff * 0.5; this.px[b] -= dx * diff * 0.5; this.py[b] -= dy * diff * 0.5; }
      }
      // hard cap: nothing may be further from the near-stick tip than the remaining chain+stick length
      for (let i = 2; i < n; i++) {
        let maxL = 0; for (let k = 2; k <= i; k++) maxL += segLen(k);
        const dx = this.px[i] - this.px[1], dy = this.py[i] - this.py[1];
        const d = Math.hypot(dx, dy);
        if (d > maxL) { this.px[i] = this.px[1] + (dx / d) * maxL; this.py[i] = this.py[1] + (dy / d) * maxL; }
      }
    }
    const t = this.tip();
    this.tipSpeed = Math.hypot(t.x - this.prevTip.x, t.y - this.prevTip.y) / Math.max(1e-4, dt);
    this.prevTip = t;
    // trail
    this.trail.push({ x: t.x, y: t.y, t: 0 });
    if (this.trail.length > (this.v2 ? 8 : 14)) this.trail.shift();
    for (const q of this.trail) q.t += dt;
  }

  draw(ctx: Ctx, color: string, chainColor: string, trailColor: string | null) {
    const n = this.n;
    if (this.v2 && trailColor && this.trail.length > 2) {
      // trail taper ala game1: selalu digambar, makin muda makin tebal & terang
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        const t = i / this.trail.length;
        ctx.globalAlpha = t * 0.55;
        pline(ctx, a.x, a.y, b.x, b.y, trailColor, Math.max(1, Math.round(0.5 + t * 2.2)));
      }
      ctx.globalAlpha = 1;
    } else if (trailColor && this.tipSpeed > 180 && this.trail.length > 2) {
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        ctx.globalAlpha = (i / this.trail.length) * 0.55;
        pline(ctx, a.x, a.y, b.x, b.y, trailColor, 1);
      }
      ctx.globalAlpha = 1;
    }
    // chain
    for (let i = 1; i < n - 1; i++) {
      if (this.v2) {
        // rantai ala game1: outline hitam tipis + inti baja, tanpa dot
        pline(ctx, this.px[i], this.py[i], this.px[i + 1], this.py[i + 1], '#000', 2);
        pline(ctx, this.px[i], this.py[i], this.px[i + 1], this.py[i + 1], chainColor, 1);
      } else {
        pline(ctx, this.px[i], this.py[i], this.px[i + 1], this.py[i + 1], chainColor, 1);
        if (i > 1) pcircle(ctx, this.px[i], this.py[i], 0.6, '#dcdcdc');
      }
    }
    // sticks (near = 0->1, far = n-2 -> n-1) with outline
    const stick = (ax: number, ay: number, bx: number, by: number) => {
      if (this.v2) {
        // 30% lebih kecil, gaya game1: outline 3px, kayu 2px, tanpa highlight putih
        pline(ctx, ax, ay, bx, by, '#000', 3);
        pline(ctx, ax, ay, bx, by, color, 2);
        pcircle(ctx, bx, by, 0.85, '#cfcfcf');
        return;
      }
      pline(ctx, ax, ay, bx, by, '#000', 4);
      pline(ctx, ax, ay, bx, by, color, 2);
      // light wood highlight
      ctx.globalAlpha = 0.5; pline(ctx, ax, ay - 1, bx, by - 1, '#ffffff', 1); ctx.globalAlpha = 1;
      // metal caps
      pcircle(ctx, bx, by, 1.2, '#cfcfcf');
    };
    stick(this.px[0], this.py[0], this.px[1], this.py[1]);
    stick(this.px[n - 2], this.py[n - 2], this.px[n - 1], this.py[n - 1]);
    if (this.v2) {
      // knob ujung bebas ala game1: kotak hitam 3x3 + inti aksen 2x2
      const ex = Math.round(this.px[n - 1]), ey = Math.round(this.py[n - 1]);
      prect(ctx, ex - 1.5, ey - 1.5, 3, 3, '#000');
      prect(ctx, ex - 1, ey - 1, 2, 2, trailColor ?? color);
    }
  }
}

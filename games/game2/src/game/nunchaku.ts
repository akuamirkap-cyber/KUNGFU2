import { pcircle, pline, type Ctx } from './pixel';
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
  readonly n: number;
  spinAng = 0;
  spinSpeed = 0;
  trail: { x: number; y: number; t: number }[] = [];
  prevTip: Vec = { x: 0, y: 0 };
  tipSpeed = 0;

  constructor() {
    this.n = 2 + this.links + 1;
    for (let i = 0; i < this.n; i++) { this.px.push(0); this.py.push(0); this.ox.push(0); this.oy.push(0); }
  }

  reset(x: number, y: number) {
    for (let i = 0; i < this.n; i++) { this.px[i] = x; this.py[i] = y + i * 2; this.ox[i] = this.px[i]; this.oy[i] = this.py[i]; }
    this.trail.length = 0;
    this.prevTip = { x, y };
  }

  tip(): Vec { return { x: this.px[this.n - 1], y: this.py[this.n - 1] }; }
  /** how taut the chain is: 1 = fully extended from the grip to the far tip */
  tautness() {
    const full = this.stickLen + this.chainLen + this.stickLen * 0.9;
    return Math.hypot(this.px[this.n - 1] - this.px[0], this.py[this.n - 1] - this.py[0]) / full;
  }
  farMid(): Vec { return { x: (this.px[this.n - 2] + this.px[this.n - 1]) / 2, y: (this.py[this.n - 2] + this.py[this.n - 1]) / 2 }; }

  /**
   * @param hand grip position (world, already includes z lift)
   * @param nearDir direction the held stick points (unit)
   * @param dt seconds
   * @param spin >0: angular velocity to drive the chain in a circle around the hand (helicopter / figure-8)
   */
  update(hand: Vec, nearDir: Vec, dt: number, spin: number, swingBoost: Vec | null) {
    const n = this.n;
    const segLen = (i: number) => (i === 1 ? this.stickLen : i === n - 1 ? this.stickLen * 0.9 : this.chainLen / this.links);
    // integrate (verlet) for free particles 2..n-1
    const sub = 3;
    const h = dt / sub;
    const maxV = 2600 * h; // speed cap per substep (px)
    for (let s = 0; s < sub; s++) {
      for (let i = 2; i < n; i++) {
        let vx = (this.px[i] - this.ox[i]) * 0.985, vy = (this.py[i] - this.oy[i]) * 0.985;
        if (swingBoost) {
          // blend toward a target velocity that grows along the chain (the far stick whips hardest)
          const k = (i - 1) / (n - 2);
          const tx = swingBoost.x * h * k, ty = swingBoost.y * h * k;
          vx += (tx - vx) * 0.35; vy += (ty - vy) * 0.35;
        }
        const sp = Math.hypot(vx, vy);
        if (sp > maxV) { vx *= maxV / sp; vy *= maxV / sp; }
        this.ox[i] = this.px[i]; this.oy[i] = this.py[i];
        this.px[i] += vx; this.py[i] += vy + 520 * h * h; // gravity (screen px/s^2)
      }
      // pinned particles: grip at the hand, near tip at hand + nearDir*stickLen (optionally spun)
      this.px[0] = hand.x; this.py[0] = hand.y;
      let ndx = nearDir.x, ndy = nearDir.y;
      if (spin !== 0) {
        this.spinAng += spin * h;
        ndx = Math.cos(this.spinAng); ndy = Math.sin(this.spinAng) * 0.6;
        const l = Math.hypot(ndx, ndy) || 1; ndx /= l; ndy /= l;
      }
      this.px[1] = hand.x + ndx * this.stickLen; this.py[1] = hand.y + ndy * this.stickLen;
      // distance constraints
      for (let it = 0; it < 10; it++) {
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
    if (this.trail.length > 14) this.trail.shift();
    for (const q of this.trail) q.t += dt;
  }

  draw(ctx: Ctx, color: string, chainColor: string, trailColor: string | null) {
    const n = this.n;
    // trail (only when fast)
    if (trailColor && this.tipSpeed > 180 && this.trail.length > 2) {
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        ctx.globalAlpha = (i / this.trail.length) * 0.55;
        pline(ctx, a.x, a.y, b.x, b.y, trailColor, 1);
      }
      ctx.globalAlpha = 1;
    }
    // chain
    for (let i = 1; i < n - 1; i++) {
      pline(ctx, this.px[i], this.py[i], this.px[i + 1], this.py[i + 1], chainColor, 1);
      if (i > 1) pcircle(ctx, this.px[i], this.py[i], 0.6, '#dcdcdc');
    }
    // sticks (near = 0->1, far = n-2 -> n-1) with outline
    const stick = (ax: number, ay: number, bx: number, by: number) => {
      pline(ctx, ax, ay, bx, by, '#000', 4);
      pline(ctx, ax, ay, bx, by, color, 2);
      // light wood highlight
      ctx.globalAlpha = 0.5; pline(ctx, ax, ay - 1, bx, by - 1, '#ffffff', 1); ctx.globalAlpha = 1;
      // metal caps
      pcircle(ctx, bx, by, 1.2, '#cfcfcf');
    };
    stick(this.px[0], this.py[0], this.px[1], this.py[1]);
    stick(this.px[n - 2], this.py[n - 2], this.px[n - 1], this.py[n - 1]);
  }
}

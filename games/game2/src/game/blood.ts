import { VIEW_H, VIEW_W } from './constants';
import { pcircle, pline, type Ctx } from './pixel';
import { rnd } from './rng';

export type BloodMode = 'normal' | 'gore' | 'combined';

/**
 * Blood system.
 *  - A PERMANENT stain canvas the size of the arena: drawn between the floor and the characters, never cleared
 *    during a floor (only when a new floor/wave-arena is built). Everything that lands stamps into it.
 *  - TEMPORARY particles: droplets, arterial jets, fountains, mist and gibs. Fast droplets are drawn stretched
 *    along their velocity (liquid, not confetti) and smear small stains along their flight path.
 *  - SCREEN splatter: blobs in screen space with drips running down, fading over ~2s.
 * Modes: 'normal' = classic light particles (no permanent canvas); 'gore' = the new system; 'combined' = both.
 */
export interface Drop {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  life: number; max: number; s: number; c: string;
  kind: 0 | 1 | 2 | 3 | 4; // 0 droplet, 1 arterial, 2 fountain, 3 mist, 4 gib
  rot: number; vr: number; len: number; body: string; smear: number; bounce: number;
}
export interface ScreenSplat { x: number; y: number; r: number; t: number; max: number; drips: { dx: number; len: number; speed: number }[]; c: string }

const DARK = ['#6e0000', '#7a0000', '#8a0000', '#5e0000', '#9a0a0a'];
const BRIGHT = ['#c40000', '#d40000', '#e01010', '#b00000'];

export class Blood {
  mode: BloodMode = 'combined';
  drops: Drop[] = [];
  splats: ScreenSplat[] = [];
  stain: HTMLCanvasElement | null = null;
  sctx: CanvasRenderingContext2D | null = null;
  solid: ((x: number, y: number) => boolean) | null = null;
  pulse = 0;

  /** (re)create the permanent stain canvas for a new floor */
  resetFloor(w: number, h: number) {
    if (!this.stain || this.stain.width !== w || this.stain.height !== h) {
      this.stain = document.createElement('canvas');
      this.stain.width = w; this.stain.height = h;
      this.sctx = this.stain.getContext('2d');
    } else this.sctx?.clearRect(0, 0, w, h);
    this.drops.length = 0;
  }

  get gore() { return this.mode !== 'normal'; }
  get classic() { return this.mode !== 'gore'; }

  // ------------------------------------------------------------------ stamping
  stamp(x: number, y: number, c: string, s: number, alpha = 0.85) {
    if (!this.sctx || (this.solid && this.solid(x, y))) return;
    this.sctx.globalAlpha = alpha;
    this.sctx.fillStyle = c;
    this.sctx.fillRect(Math.round(x), Math.round(y), s, s);
    this.sctx.globalAlpha = 1;
  }
  /** random dark ellipse stain (what a landing drop leaves) */
  blot(x: number, y: number, rx: number, ry: number, c = DARK[(Math.random() * DARK.length) | 0], alpha = 0.8) {
    if (!this.sctx) return;
    const ctx = this.sctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = c;
    const cx = Math.round(x), cy = Math.round(y);
    const ryi = Math.ceil(ry);
    for (let dy = -ryi; dy <= ryi; dy++) {
      const f = 1 - (dy * dy) / (ry * ry + 0.5);
      if (f < 0) continue;
      const dx = Math.floor(Math.sqrt(f) * rx * rnd(0.8, 1.1));
      const yy = cy + dy;
      if (this.solid) {
        let start = -1;
        for (let xx = cx - dx; xx <= cx + dx + 1; xx++) {
          const sld = xx > cx + dx || this.solid(xx, yy);
          if (!sld && start < 0) start = xx;
          if (sld && start >= 0) { ctx.fillRect(start, yy, xx - start, 1); start = -1; }
        }
      } else ctx.fillRect(cx - dx, yy, dx * 2 + 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  pool(x: number, y: number, r: number) { this.blot(x, y, r * 0.8, r * 0.4, '#7a0000', 0.16); }

  // ------------------------------------------------------------------ emitters
  /** droplet spray from a contact point along the hit direction; count/power scale with damage */
  spray(x: number, y: number, dir: number, dmg: number, heavy: boolean) {
    const n = Math.round((2 + dmg * 1.2) * (heavy ? 1.5 : 1));
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-0.7, 0.7), sp = rnd(40, 170 + dmg * 12) * (heavy ? 1.3 : 1);
      this.add({ x, y, z: rnd(1, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, vz: rnd(10, 120), kind: 0, s: Math.random() < 0.3 ? 2 : 1, c: Math.random() < 0.75 ? BRIGHT[(Math.random() * BRIGHT.length) | 0] : DARK[2], smear: sp > 120 ? 1 : 0 });
    }
    if (heavy && dmg >= 4) { this.arterial(x, y, dir, 0.6); this.mist(x, y, dir, 3); }
  }
  /** narrow high-pressure jet */
  arterial(x: number, y: number, dir: number, strength = 1) {
    const n = Math.round(8 * strength);
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-0.12, 0.12), sp = rnd(220, 380) * strength;
      this.add({ x, y, z: rnd(3, 7), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, vz: rnd(40, 110), kind: 1, s: 1, c: BRIGHT[(Math.random() * BRIGHT.length) | 0], smear: 1, life: rnd(0.5, 0.9) });
    }
  }
  /** fountain: up, then gravity brings it down around the source */
  fountain(x: number, y: number, n = 12) {
    n = Math.round(n * 0.5);
    for (let i = 0; i < n; i++) {
      this.add({ x, y, z: 2, vx: rnd(-40, 40), vy: rnd(-30, 30), vz: rnd(150, 360), kind: 2, s: Math.random() < 0.4 ? 2 : 1, c: BRIGHT[(Math.random() * BRIGHT.length) | 0], smear: 0 });
    }
  }
  /** fine red cloud that floats and dissolves */
  mist(x: number, y: number, dir: number, n = 6) {
    n = Math.round(n * 0.6);
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-0.9, 0.9), sp = rnd(10, 45);
      this.add({ x, y, z: rnd(4, 12), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: rnd(-5, 15), kind: 3, s: rnd(2, 4), c: '#b00000', life: rnd(0.35, 0.7), smear: 0 });
    }
  }
  /** body chunks in the victim's own clothing colour; they stamp their shape + a pool where they land */
  gibs(x: number, y: number, dir: number, power: number, color: string, n = 3) {
    n = Math.min(n, 4);
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-1.0, 1.0), sp = rnd(power * 0.4, power);
      this.add({ x, y, z: rnd(4, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, vz: rnd(80, 200), kind: 4, s: rnd(2, 4), c: Math.random() < 0.5 ? color : '#8a0000', body: color, rot: rnd(0, 6.3), vr: rnd(-18, 18), bounce: 2, life: 4 });
    }
  }
  /** screen-space splatter (player got hit) */
  screenSplat(heavy: boolean) {
    const n = heavy ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const r = rnd(heavy ? 10 : 6, heavy ? 18 : 11);
      const drips = [];
      const dn = 2 + ((Math.random() * 3) | 0);
      for (let k = 0; k < dn; k++) drips.push({ dx: rnd(-r * 0.6, r * 0.6), len: rnd(r * 0.6, r * 2.2), speed: rnd(0.5, 1.4) });
      this.splats.push({ x: rnd(r, VIEW_W - r), y: rnd(r, VIEW_H * 0.7), r, t: 0, max: rnd(1.3, 1.9), drips, c: Math.random() < 0.5 ? '#9a0000' : '#c40000' });
    }
    if (this.splats.length > 4) this.splats.shift();
  }

  private add(p: Partial<Drop>) {
    if (!this.gore) return;
    if (this.drops.length > 1400) this.drops.shift();
    const d: Drop = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1.6, max: 1.6, s: 1, c: '#c40000', kind: 0, rot: 0, vr: 0, len: 0, body: '#c40000', smear: 0, bounce: 0 };
    Object.assign(d, p);
    d.max = d.life;
    this.drops.push(d);
  }

  // ------------------------------------------------------------------ simulation
  update(dt: number) {
    const list = this.drops;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.kind === 3) {
        // mist: floats, slows, grows, fades
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vx *= 1 - 2.5 * dt; p.vy *= 1 - 2.5 * dt; p.s += dt * 3;
        if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); }
        continue;
      }
      const drag = p.kind === 4 ? 0.6 : 1.4;
      p.vx *= 1 - drag * dt; p.vy *= 1 - drag * dt;
      p.vz -= (p.kind === 2 ? 520 : 420) * dt;
      const ox = p.x, oy = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.vr * dt;
      // fast droplets smear a trail of tiny stains along the ground track
      if (p.smear && p.z < 10 && Math.hypot(p.vx, p.vy) > 110 && Math.random() < 0.25) this.stamp(ox + rnd(-1, 1), oy + rnd(0, 1), DARK[(Math.random() * DARK.length) | 0], 1, 0.45);
      if (p.z <= 0) {
        p.z = 0;
        if (p.kind === 4) {
          if (p.bounce > 0 && Math.abs(p.vz) > 40) { p.vz = -p.vz * 0.4; p.bounce--; p.vx *= 0.5; p.vy *= 0.5; this.blot(p.x, p.y, 2, 1, '#8a0000', 0.7); continue; }
          // landed: stamp the chunk + a pool under it
          this.blot(p.x, p.y, Math.max(1.5, p.s * 0.9), Math.max(1, p.s * 0.5), p.body, 0.95);
          this.blot(p.x, p.y + 1, p.s * 1.6 + 2, p.s * 0.8 + 1, '#7a0000', 0.35);
          list[i] = list[list.length - 1]; list.pop();
          continue;
        }
        // droplet / jet / fountain landing: random dark elliptical stain scaled by size & speed
        const sp = Math.hypot(p.vx, p.vy);
        const rx = p.s * rnd(0.7, 1.3) + Math.min(2, sp / 120), ry = p.s * rnd(0.45, 0.8);
        this.blot(p.x, p.y, rx, ry, undefined, p.kind === 1 ? 0.8 : 0.65);
        if (sp > 90 && Math.random() < 0.3) this.blot(p.x + (p.vx / (sp || 1)) * rnd(2, 5), p.y + (p.vy / (sp || 1)) * rnd(1, 3), 1, 0.6, undefined, 0.55);
        list[i] = list[list.length - 1]; list.pop();
        continue;
      }
      if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); }
    }
    for (let i = this.splats.length - 1; i >= 0; i--) { const s = this.splats[i]; s.t += dt; if (s.t >= s.max) this.splats.splice(i, 1); }
    if (this.pulse > 0) this.pulse -= dt;
  }

  // ------------------------------------------------------------------ drawing
  drawStains(ctx: Ctx) { if (this.stain && this.gore) ctx.drawImage(this.stain, 0, 0); }

  drawDrops(ctx: Ctx) {
    for (const p of this.drops) {
      const y = p.y - p.z;
      if (p.kind === 3) {
        ctx.globalAlpha = (p.life / p.max) * 0.35;
        pcircle(ctx, p.x, y, p.s, p.c);
        continue;
      }
      ctx.globalAlpha = 1;
      if (p.kind === 4) {
        const dx = Math.cos(p.rot) * p.s * 0.6, dy = Math.sin(p.rot) * p.s * 0.6;
        pline(ctx, p.x - dx, y - dy, p.x + dx, y + dy, '#000', p.s >= 3 ? 4 : 3);
        pline(ctx, p.x - dx, y - dy, p.x + dx, y + dy, p.body, p.s >= 3 ? 2 : 1);
        pcircle(ctx, p.x + dx, y + dy, 1, '#c40000');
        continue;
      }
      const sp = Math.hypot(p.vx, p.vy - p.vz);
      if (sp > 110) {
        // stretched along the velocity => reads as liquid
        const k = Math.min(6, sp / 70);
        const vx = p.vx, vy = p.vy - p.vz;
        const l = Math.hypot(vx, vy) || 1;
        pline(ctx, p.x, y, p.x - (vx / l) * k, y - (vy / l) * k, p.c, p.s);
      } else {
        ctx.fillStyle = p.c;
        ctx.fillRect(Math.round(p.x), Math.round(y), p.s, p.s);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** screen-space overlay: camera splatter + critical-health pulse */
  drawScreen(ctx: Ctx, hpFrac: number, time: number) {
    for (const s of this.splats) {
      const k = s.t / s.max;
      const a = k < 0.1 ? k / 0.1 : k > 0.6 ? (1 - k) / 0.4 : 1;
      ctx.globalAlpha = a * 0.4;
      pcircle(ctx, s.x, s.y, s.r, s.c);
      // irregular edge blobs
      for (let i = 0; i < 5; i++) { const aa = i * 1.26 + s.x * 0.01; pcircle(ctx, s.x + Math.cos(aa) * s.r * 0.8, s.y + Math.sin(aa) * s.r * 0.6, s.r * 0.35, s.c); }
      // drips run down over time
      for (const d of s.drips) {
        const len = Math.min(d.len, s.t * 40 * d.speed);
        pline(ctx, s.x + d.dx, s.y + s.r * 0.5, s.x + d.dx, s.y + s.r * 0.5 + len, s.c, 2);
        pcircle(ctx, s.x + d.dx, s.y + s.r * 0.5 + len, 1.5, s.c);
      }
    }
    ctx.globalAlpha = 1;
    if (hpFrac <= 0.25 && hpFrac > 0) {
      const beat = (Math.sin(time * 5) + 1) / 2;
      ctx.globalAlpha = 0.18 + beat * 0.2;
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
      g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, 'rgba(160,0,0,1)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }
}

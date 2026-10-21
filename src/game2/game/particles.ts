import { pcircle, pline, pring, type Ctx } from './pixel';
import { pfontO } from './pixel';
import { rnd } from './rng';

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; c: string; s: number;
  g: number; fr: number; k: number; // 0 pixel, 1 spark, 2 ring, 3 smoke, 4 blood, 5 shockwave, 6 limb, 7 ember, 8 casing, 9 impact, 10 head
  rot: number; vr: number; z: number; vz: number; bounce: number;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export class Particles {
  list: Particle[] = [];
  onLand: ((x: number, y: number, c: string, s: number) => void) | null = null;
  onCasing: ((x: number, y: number) => void) | null = null;
  /** when false, classic blood emitters are muted (the new gore system takes over) */
  bloodEnabled: (() => boolean) | null = null;

  add(p: Partial<Particle>) {
    if (this.list.length > 1500) this.list.shift();
    const base: Particle = { x: 0, y: 0, vx: 0, vy: 0, life: 0.5, max: 0.5, c: '#fff', s: 1, g: 0, fr: 0, k: 0, rot: 0, vr: 0, z: 0, vz: 0, bounce: 0 };
    const out = Object.assign(base, p);
    out.max = p.max ?? p.life ?? 0.5;
    this.list.push(out);
  }

  burst(x: number, y: number, n: number, c: string, speed: number, life: number, size = 1, fr = 4) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(speed * 0.3, speed);
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(life * 0.5, life), c, s: size, fr, k: 0 });
    }
  }

  dirBurst(x: number, y: number, n: number, c: string, dir: number, spread: number, speed: number, life: number, size = 1) {
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-spread, spread), sp = rnd(speed * 0.4, speed);
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(life * 0.5, life), c, s: size, fr: 5, k: 0 });
    }
  }

  spark(x: number, y: number, n: number, c: string, dir: number, spread = 1.2, speed = 200) {
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-spread, spread), sp = rnd(speed * 0.5, speed);
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.08, 0.22), c, s: 1, fr: 6, k: 1 });
    }
  }

  /** straight speed lines along a direction (for punches) */
  lines(x: number, y: number, n: number, c: string, dir: number, speed = 260) {
    for (let i = 0; i < n; i++) {
      const off = rnd(-5, 5);
      this.add({ x: x - Math.sin(dir) * off, y: y + Math.cos(dir) * off * 0.6, vx: Math.cos(dir) * speed * rnd(0.7, 1.2), vy: Math.sin(dir) * speed * rnd(0.7, 1.2), life: rnd(0.06, 0.14), c, s: 1, fr: 0, k: 1 });
    }
  }

  blood(x: number, y: number, n: number, dir: number, power: number, c = '#d40000') {
    if (this.bloodEnabled && !this.bloodEnabled()) return;
    for (let i = 0; i < n; i++) {
      const a = dir + rnd(-0.95, 0.95), sp = rnd(power * 0.15, power);
      const r = Math.random();
      const s = r < 0.15 ? 3 : r < 0.55 ? 2 : 1;
      const col = r > 0.7 ? '#9e0000' : r > 0.62 ? '#ff2a2a' : c;
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2, c: col, s, fr: 2.5, k: 4, z: rnd(2, 9), vz: rnd(20, 110), g: 300 });
    }
  }

  fountain(x: number, y: number, n: number, c = '#d40000') {
    if (this.bloodEnabled && !this.bloodEnabled()) return;
    for (let i = 0; i < n; i++) {
      this.add({ x, y, vx: rnd(-35, 35), vy: rnd(-25, 25), life: 2.5, c, s: rnd(0, 1) < 0.4 ? 2 : 1, k: 4, z: 2, vz: rnd(120, 320), g: 420 });
    }
  }

  limb(x: number, y: number, dir: number, power: number, c: string, len = 4) {
    const a = dir + rnd(-0.7, 0.7), sp = rnd(power * 0.4, power);
    this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 3, c, s: len, fr: 2, k: 6, z: rnd(4, 10), vz: rnd(60, 160), g: 320, rot: rnd(0, 6.3), vr: rnd(-20, 20), bounce: 1 });
  }

  head(x: number, y: number, vx: number, vy: number, vz: number, c: string) {
    this.add({ x, y, vx, vy, life: 4, c, s: 2.5, k: 10, z: 4, vz, g: 380, rot: rnd(0, 6.3), vr: rnd(-12, 12), bounce: 3 });
  }

  casing(x: number, y: number, dir: number, side: number) {
    const a = dir + side * 1.6 + rnd(-0.4, 0.4);
    const sp = rnd(35, 75);
    this.add({ x, y, vx: Math.cos(a) * sp - Math.cos(dir) * rnd(5, 20), vy: Math.sin(a) * sp * 0.6, life: 3, c: '#e0b050', s: 2, k: 8, z: 6, vz: rnd(70, 130), g: 420, rot: rnd(0, 6.3), vr: rnd(-30, 30), bounce: 2 });
  }

  impact(x: number, y: number, size: number, c: string) {
    this.add({ x, y, life: 0.13, s: size, c, k: 9 });
  }

  ring(x: number, y: number, r0: number, r1: number, c: string, life: number, w = 1) {
    this.add({ x, y, s: r0, vr: (r1 - r0) / life, life, c, k: 2, rot: w });
  }

  shockwave(x: number, y: number, r1: number, c: string, life = 0.3) {
    this.add({ x, y, s: 2, vr: (r1 - 2) / life, life, c, k: 5 });
  }

  smoke(x: number, y: number, n: number, c: string, speed = 20, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), sp = rnd(speed * 0.2, speed);
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, life: rnd(life * 0.6, life), c, s: rnd(1.5, 3.5), fr: 2, k: 3 });
    }
  }

  ember(x: number, y: number, n: number, c: string) {
    for (let i = 0; i < n; i++) {
      this.add({ x: x + rnd(-6, 6), y: y + rnd(-4, 4), vx: rnd(-8, 8), vy: rnd(-40, -15), life: rnd(0.4, 0.9), c, s: 1, k: 7 });
    }
  }

  update(dt: number) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
      if (p.k === 4 || p.k === 6 || p.k === 8 || p.k === 10) {
        if (p.g > 0) {
          p.vz -= p.g * dt;
          p.z += p.vz * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.z <= 0) {
            p.z = 0;
            if (p.k === 4) {
              if (this.onLand) this.onLand(p.x, p.y, p.c, p.s);
              list[i] = list[list.length - 1]; list.pop();
              continue;
            }
            if (p.bounce > 0 && Math.abs(p.vz) > 20) {
              p.vz = -p.vz * 0.45; p.bounce--; p.vx *= 0.55; p.vy *= 0.55; p.vr *= 0.5;
              if (p.k === 8 && this.onCasing) this.onCasing(p.x, p.y);
              if (p.k === 10 && this.onLand) this.onLand(p.x, p.y, '#8a0000', 2);
              continue;
            }
            if (p.k === 6) {
              if (this.onLand) this.onLand(p.x, p.y, '#3a0000', 1);
              list[i] = list[list.length - 1]; list.pop();
              continue;
            }
            p.g = 0; p.vz = 0; p.vx = 0; p.vy = 0; p.vr = 0;
          }
        }
        continue;
      }
      if (p.k === 2 || p.k === 5) { p.s += p.vr * dt; continue; }
      if (p.k === 9) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      if (p.fr) { const f = Math.max(0, 1 - p.fr * dt); p.vx *= f; p.vy *= f; }
      if (p.k === 3) p.s += dt * 4;
    }
  }

  draw(ctx: Ctx) {
    for (const p of this.list) {
      const t = p.life / p.max;
      switch (p.k) {
        case 0:
          ctx.globalAlpha = t < 0.4 ? t / 0.4 : 1;
          ctx.fillStyle = p.c;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
          break;
        case 1: {
          ctx.globalAlpha = t;
          const l = 0.03;
          pline(ctx, p.x, p.y, p.x - p.vx * l, p.y - p.vy * l, p.c, 1);
          break;
        }
        case 2:
          ctx.globalAlpha = t;
          pring(ctx, p.x, p.y, p.s, p.c, p.rot || 1);
          break;
        case 5:
          ctx.globalAlpha = t * 0.9;
          pring(ctx, p.x, p.y, p.s, p.c, 2);
          ctx.globalAlpha = t * 0.4;
          pring(ctx, p.x, p.y, p.s * 0.8, p.c, 1);
          break;
        case 3:
          ctx.globalAlpha = t * 0.5;
          ctx.fillStyle = p.c;
          ctx.fillRect(Math.round(p.x - p.s / 2), Math.round(p.y - p.s / 2), Math.round(p.s), Math.round(p.s));
          break;
        case 4:
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.c;
          ctx.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.s, p.s);
          break;
        case 6: {
          ctx.globalAlpha = 1;
          const cx = p.x, cy = p.y - p.z;
          const dx = Math.cos(p.rot) * p.s * 0.5, dy = Math.sin(p.rot) * p.s * 0.5;
          pline(ctx, cx - dx, cy - dy, cx + dx, cy + dy, p.c, 1);
          break;
        }
        case 7:
          ctx.globalAlpha = t;
          ctx.fillStyle = p.c;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
          break;
        case 8: {
          ctx.globalAlpha = t < 0.25 ? t / 0.25 : 1;
          const x = Math.round(p.x), y = Math.round(p.y - p.z);
          ctx.fillStyle = p.c;
          if (Math.cos(p.rot) > 0) ctx.fillRect(x, y, 2, 1); else ctx.fillRect(x, y, 1, 2);
          ctx.fillStyle = '#fff2b0';
          ctx.fillRect(x, y, 1, 1);
          break;
        }
        case 9: {
          const k = 1 - t;
          const r = p.s * (0.3 + 0.7 * easeOut(k));
          ctx.globalAlpha = Math.min(1, t * 1.5);
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2;
            pline(ctx, p.x, p.y, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, p.c, 1);
            const b = a + Math.PI / 4;
            pline(ctx, p.x, p.y, p.x + Math.cos(b) * r * 0.55, p.y + Math.sin(b) * r * 0.55, p.c, 1);
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
          break;
        }
        case 10: {
          ctx.globalAlpha = 1;
          const y = p.y - p.z;
          pcircle(ctx, p.x, y, p.s, p.c);
          ctx.fillStyle = '#111';
          ctx.fillRect(Math.round(p.x + Math.cos(p.rot) * 1.2), Math.round(y + Math.sin(p.rot) * 1.2), 1, 1);
          ctx.fillRect(Math.round(p.x + Math.cos(p.rot + 1) * 1.2), Math.round(y + Math.sin(p.rot + 1) * 1.2), 1, 1);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

export interface FText { x: number; y: number; text: string; c: string; life: number; max: number; scale: number; vy: number; }

export class Texts {
  list: FText[] = [];
  add(x: number, y: number, text: string, c: string, scale = 1, life = 0.8) {
    this.list.push({ x, y, text, c, life, max: life, scale, vy: -18 });
    if (this.list.length > 40) this.list.shift();
  }
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.9;
      if (t.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(ctx: Ctx) {
    for (const t of this.list) {
      const a = t.life / t.max;
      ctx.globalAlpha = a < 0.3 ? a / 0.3 : 1;
      const pop = t.max - t.life < 0.08 ? t.scale + 1 : t.scale;
      pfontO(ctx, t.text, t.x, t.y, t.c, '#000', pop, 'center');
    }
    ctx.globalAlpha = 1;
  }
}

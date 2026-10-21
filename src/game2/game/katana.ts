import { pcircle, pline, type Ctx } from './pixel';
import type { Vec } from './types';

export interface SlashArc { x: number; y: number; r: number; from: number; to: number; t: number; max: number; c: string; lift: number }

/** Blade geometry + slash trails. The blade is a straight segment from the sword hand along `angle`. */
export class Katana {
  readonly len = 17;
  arcs: SlashArc[] = [];
  prevBase: Vec | null = null;
  prevTip: Vec | null = null;
  sheen = 0;

  blade(hand: Vec, angle: number, lift = 0): { base: Vec; tip: Vec } {
    const tip = { x: hand.x + Math.cos(angle) * this.len, y: hand.y + Math.sin(angle) * this.len * 0.6 - lift * 10 };
    return { base: hand, tip };
  }

  addArc(x: number, y: number, r: number, from: number, to: number, c: string, lift = 0, life = 0.22) {
    this.arcs.push({ x, y, r, from, to, t: 0, max: life, c, lift });
    if (this.arcs.length > 10) this.arcs.shift();
  }

  update(dt: number) {
    for (let i = this.arcs.length - 1; i >= 0; i--) { this.arcs[i].t += dt; if (this.arcs[i].t >= this.arcs[i].max) this.arcs.splice(i, 1); }
    if (this.sheen > 0) this.sheen -= dt;
  }

  drawArcs(ctx: Ctx) {
    for (const a of this.arcs) {
      const k = 1 - a.t / a.max;
      const n = Math.max(6, Math.ceil(Math.abs(a.to - a.from) * a.r * 0.6));
      // fading crescent: bright thin edge + translucent body
      for (let i = 0; i < n; i++) {
        const f0 = a.from + ((a.to - a.from) * i) / n, f1 = a.from + ((a.to - a.from) * (i + 1)) / n;
        const fade = (i / n) * 0.6 + 0.4;
        ctx.globalAlpha = k * 0.5 * fade;
        const x0 = a.x + Math.cos(f0) * a.r, y0 = a.y + Math.sin(f0) * a.r * 0.6 - a.lift * 10;
        const x1 = a.x + Math.cos(f1) * a.r, y1 = a.y + Math.sin(f1) * a.r * 0.6 - a.lift * 10;
        pline(ctx, x0, y0, x1, y1, a.c, 2);
        ctx.globalAlpha = k * 0.9 * fade;
        pline(ctx, x0, y0, x1, y1, '#ffffff', 1);
        // inner fill rays
        if (i % 2 === 0) { ctx.globalAlpha = k * 0.18 * fade; pline(ctx, a.x + Math.cos(f0) * a.r * 0.55, a.y + Math.sin(f0) * a.r * 0.33 - a.lift * 10, x0, y0, a.c, 1); }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBlade(ctx: Ctx, base: Vec, tip: Vec, sheathed: boolean) {
    if (sheathed) return;
    // razor look: dark spine, bright steel, a hard white edge line, needle tip
    const dx = tip.x - base.x, dy = tip.y - base.y, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    pline(ctx, base.x, base.y, tip.x, tip.y, '#000000', 3);
    pline(ctx, base.x - nx * 0.5, base.y - ny * 0.5, tip.x - nx * 0.3, tip.y - ny * 0.3, '#7d8590', 1); // spine (mune)
    pline(ctx, base.x, base.y, tip.x, tip.y, '#e6eaf0', 1);
    pline(ctx, base.x + nx * 0.7 + dx * 0.1, base.y + ny * 0.7 + dy * 0.1, tip.x + nx * 0.2, tip.y + ny * 0.2, '#ffffff', 1); // edge (ha)
    pcircle(ctx, tip.x, tip.y, 0.6, '#ffffff');
    // guard
    pline(ctx, base.x + nx * 2, base.y + ny * 2, base.x - nx * 2, base.y - ny * 2, '#c9a033', 2);
    // hilt behind the hand
    pline(ctx, base.x, base.y, base.x - (dx / l) * 3.5, base.y - (dy / l) * 3.5, '#3b2a6b', 2);
    pcircle(ctx, base.x - (dx / l) * 3.5, base.y - (dy / l) * 3.5, 1, '#c9a033');
    if (this.sheen > 0) { ctx.globalAlpha = this.sheen / 0.25; pline(ctx, base.x + dx * 0.3, base.y + dy * 0.3, base.x + dx * 0.6, base.y + dy * 0.6, '#ffffff', 2); ctx.globalAlpha = 1; }
  }

  drawScabbard(ctx: Ctx, hip: Vec, facing: number) {
    // sheath on the back hip
    pline(ctx, hip.x - facing * 2, hip.y - 1, hip.x - facing * 7, hip.y + 3.5, '#000', 3);
    pline(ctx, hip.x - facing * 2, hip.y - 1, hip.x - facing * 7, hip.y + 3.5, '#2a1f4f', 1);
  }
}

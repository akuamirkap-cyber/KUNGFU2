import { pcircle, pline, prect, type Ctx } from './pixel';
import type { Vec } from './types';

/** Axe: a haft with a crescent head; the hitbox is the head end. */
export const AXE_LEN = 15;
export function drawAxe(ctx: Ctx, base: Vec, angle: number, lift = 0) {
  const dx = Math.cos(angle), dy = Math.sin(angle) * 0.6;
  const tip = { x: base.x + dx * AXE_LEN, y: base.y + dy * AXE_LEN - lift * 10 };
  const nx = -dy, ny = dx;
  // haft
  pline(ctx, base.x, base.y, tip.x, tip.y, '#000', 4);
  pline(ctx, base.x, base.y, tip.x, tip.y, '#6b4a2b', 2);
  pline(ctx, base.x + dx * 2, base.y + dy * 2, base.x + dx * 6, base.y + dy * 6, '#2a1a0a', 1); // grip wrap
  // head: a blade crescent on one side of the tip
  const hx = tip.x - dx * 3, hy = tip.y - dy * 3;
  for (let i = -3; i <= 3; i++) {
    const w = 3.5 - Math.abs(i) * 0.5;
    const cx = hx + nx * i * 1.1, cy = hy + ny * i * 1.1;
    pline(ctx, cx - dx * w * 0.4, cy - dy * w * 0.4, cx + dx * (w + 1), cy + dy * (w + 1), '#000', 3);
  }
  for (let i = -3; i <= 3; i++) {
    const w = 3.5 - Math.abs(i) * 0.5;
    const cx = hx + nx * i * 1.1, cy = hy + ny * i * 1.1;
    pline(ctx, cx - dx * w * 0.4, cy - dy * w * 0.4, cx + dx * (w + 1), cy + dy * (w + 1), '#9aa1a8', 1);
  }
  // edge highlight along the cutting curve
  pline(ctx, hx + nx * -3.2 + dx * 3.5, hy + ny * -3.2 + dy * 3.5, hx + nx * 3.2 + dx * 3.5, hy + ny * 3.2 + dy * 3.5, '#ffffff', 1);
  pcircle(ctx, tip.x, tip.y, 1, '#c9a033');
}

/** Dual blades: two short straight swords; `rev` draws it reverse-grip (pointing back along the forearm). */
export const DUAL_LEN = 11;
export function drawShortBlade(ctx: Ctx, base: Vec, angle: number, lift = 0) {
  const dx = Math.cos(angle), dy = Math.sin(angle) * 0.6;
  const tip = { x: base.x + dx * DUAL_LEN, y: base.y + dy * DUAL_LEN - lift * 10 };
  const nx = -dy, ny = dx;
  pline(ctx, base.x, base.y, tip.x, tip.y, '#000', 3);
  pline(ctx, base.x, base.y, tip.x, tip.y, '#d9dde3', 1);
  ctx.globalAlpha = 0.8;
  pline(ctx, base.x + nx * 0.6 + dx * 2, base.y + ny * 0.6 + dy * 2, tip.x + nx * 0.6, tip.y + ny * 0.6, '#ffffff', 1);
  ctx.globalAlpha = 1;
  pline(ctx, base.x + nx * 1.6, base.y + ny * 1.6, base.x - nx * 1.6, base.y - ny * 1.6, '#c9a033', 1);
  pline(ctx, base.x, base.y, base.x - dx * 2.5, base.y - dy * 2.5, '#3b2a6b', 2);
}

/** little pickup icons */
export function drawAxeIcon(ctx: Ctx, x: number, y: number) {
  pline(ctx, x - 6, y + 4, x + 5, y - 5, '#000', 3); pline(ctx, x - 6, y + 4, x + 5, y - 5, '#6b4a2b', 1);
  prect(ctx, x + 2, y - 7, 5, 5, '#000'); prect(ctx, x + 3, y - 6, 3, 3, '#9aa1a8'); pline(ctx, x + 6, y - 6, x + 6, y - 3, '#ffffff', 1);
}
export function drawDualIcon(ctx: Ctx, x: number, y: number) {
  pline(ctx, x - 7, y + 4, x + 1, y - 5, '#000', 3); pline(ctx, x - 7, y + 4, x + 1, y - 5, '#d9dde3', 1);
  pline(ctx, x + 7, y + 4, x - 1, y - 5, '#000', 3); pline(ctx, x + 7, y + 4, x - 1, y - 5, '#d9dde3', 1);
  pcircle(ctx, x, y - 1, 1, '#c9a033');
}

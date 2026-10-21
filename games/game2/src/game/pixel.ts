export type Ctx = CanvasRenderingContext2D;

export function px(ctx: Ctx, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function prect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function pline(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string, w = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  ctx.fillStyle = c;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const o = w > 1 ? w >> 1 : 0;
  for (let i = 0; i < 4000; i++) {
    ctx.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function pcircle(ctx: Ctx, cx: number, cy: number, r: number, c: string) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  ctx.fillStyle = c;
  const rr = r * r + r * 0.6;
  const ri = Math.ceil(r);
  for (let dy = -ri; dy <= ri; dy++) {
    const v = rr - dy * dy;
    if (v < 0) continue;
    const dx = Math.floor(Math.sqrt(v));
    ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}

export function pellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  ctx.fillStyle = c;
  const ryi = Math.ceil(ry);
  for (let dy = -ryi; dy <= ryi; dy++) {
    const f = 1 - (dy * dy) / (ry * ry + 0.5);
    if (f < 0) continue;
    const dx = Math.floor(Math.sqrt(f) * rx);
    ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}

export function pring(ctx: Ctx, cx: number, cy: number, r: number, c: string, w = 1, from = 0, to = Math.PI * 2) {
  ctx.fillStyle = c;
  const steps = Math.max(8, Math.ceil(r * 7 * ((to - from) / (Math.PI * 2))));
  const o = w > 1 ? w >> 1 : 0;
  let lx = -9999, ly = -9999;
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    ctx.fillRect(x - o, y - o, w, w);
  }
}

// ---- 3x5 bitmap font ----
const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111',
  '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000', '!': '010010010000010', '.': '000000000000010',
  ':': '000010000010000', '/': '001001010100100', '+': '000010111010000', '%': '101001010100101', "'": '010010000000000',
  ',': '000000000010100', '?': '111001011000010', '>': '100010001010100', '<': '001010100010001', '(': '010100100100010',
  ')': '010001001001010', '[': '110100100100110', ']': '011001001001011', '=': '000111000111000', '*': '101010111010101',
  '#': '101111101111101', '_': '000000000000111',
};

export function textWidth(text: string, scale = 1) {
  return text.length * 4 * scale - scale;
}

export function pfont(ctx: Ctx, text: string, x: number, y: number, c: string, scale = 1, align: 'left' | 'center' | 'right' = 'left') {
  text = text.toUpperCase();
  const w = textWidth(text, scale);
  let cx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const cy = Math.round(y);
  ctx.fillStyle = c;
  for (let i = 0; i < text.length; i++) {
    const g = GLYPHS[text[i]] || GLYPHS['?'];
    for (let r = 0; r < 5; r++) {
      for (let col = 0; col < 3; col++) {
        if (g[r * 3 + col] === '1') ctx.fillRect(cx + col * scale, cy + r * scale, scale, scale);
      }
    }
    cx += 4 * scale;
  }
}

export function pfontO(ctx: Ctx, text: string, x: number, y: number, c: string, oc: string, scale = 1, align: 'left' | 'center' | 'right' = 'left') {
  pfont(ctx, text, x - scale, y, oc, scale, align);
  pfont(ctx, text, x + scale, y, oc, scale, align);
  pfont(ctx, text, x, y - scale, oc, scale, align);
  pfont(ctx, text, x, y + scale, oc, scale, align);
  pfont(ctx, text, x, y, c, scale, align);
}

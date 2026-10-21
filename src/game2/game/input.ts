import { VIEW_W, VIEW_H } from './constants';

const CODE_MAP: Record<string, string> = {
  Space: ' ', ShiftLeft: 'shift', ShiftRight: 'shift', Escape: 'escape', Enter: 'enter', NumpadEnter: 'enter', Tab: 'tab',
  ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
};
const KEYCODE_MAP: Record<number, string> = {
  87: 'w', 65: 'a', 83: 's', 68: 'd', 32: ' ', 16: 'shift', 69: 'e', 70: 'f', 81: 'q', 77: 'm', 80: 'p',
  49: '1', 50: '2', 51: '3', 27: 'escape', 13: 'enter', 37: 'arrowleft', 38: 'arrowup', 39: 'arrowright', 40: 'arrowdown',
};

/** Physical key -> logical name. Works regardless of keyboard layout / IME ("Process" keys etc). */
function codeKey(code: string | undefined): string | null {
  if (!code) return null;
  if (code.startsWith('Key') && code.length === 4) return code[3].toLowerCase();
  if (code.startsWith('Digit') && code.length === 6) return code[5];
  if (code.startsWith('Numpad') && code.length === 7) return code[6];
  return CODE_MAP[code] ?? null;
}

function namesOf(e: KeyboardEvent): string[] {
  const out: string[] = [];
  const k = (e.key || '').toLowerCase();
  if (k && k !== 'process' && k !== 'unidentified' && k !== 'dead') out.push(k);
  const c = codeKey(e.code);
  if (c && !out.includes(c)) out.push(c);
  if (!out.length) { const kc = KEYCODE_MAP[e.keyCode]; if (kc) out.push(kc); }
  return out;
}

const GAME_KEYS = new Set(['w', 'a', 's', 'd', ' ', 'shift', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'f', 'q', 'c', '1', '2', '3']);

function isTyping(e: Event) {
  const t = e.target as HTMLElement | null;
  if (!t || !t.tagName) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t.isContentEditable;
}

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false, rdown: false, mdown: false, pressed: false, rpressed: false, wheel: 0 };
  /** true once any real keyboard event reached us */
  keyboardSeen = false;
  /** number of same-origin ancestor documents we also listen on (iframe previews) */
  parentAttached = 0;
  autoFocusOnHover = false;
  private canvas: HTMLCanvasElement;
  private unbind: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    try { canvas.tabIndex = 0; canvas.style.outline = 'none'; } catch { /* non-DOM canvas (tests) */ }

    const makeKd = (own: boolean) => (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!own && isTyping(e)) return;
      const names = namesOf(e);
      let prevent = false;
      for (const n of names) {
        if (!this.keys.has(n)) this.pressed.add(n);
        this.keys.add(n);
        if (GAME_KEYS.has(n)) prevent = true;
      }
      if (names.length) this.keyboardSeen = true;
      if (prevent && own) e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => {
      for (const n of namesOf(e)) this.keys.delete(n);
      if (e.key === 'Shift') this.keys.delete('shift');
    };
    const mm = (e: MouseEvent) => this.updateMouse(e);
    const md = (e: MouseEvent) => {
      this.updateMouse(e);
      if (e.button === 0) { this.mouse.down = true; this.mouse.pressed = true; }
      else if (e.button === 2) { this.mouse.rdown = true; this.mouse.rpressed = true; }
      else if (e.button === 1) { this.mouse.mdown = true; e.preventDefault(); }
      // IMPORTANT: no preventDefault() on left/right mousedown. A prevented mousedown stops the page / iframe
      // from taking keyboard focus, which silently kills WASD. We grab focus explicitly instead.
      this.focus();
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) this.mouse.down = false;
      else if (e.button === 2) this.mouse.rdown = false;
      else if (e.button === 1) this.mouse.mdown = false;
    };
    const cm = (e: Event) => e.preventDefault();
    const wh = (e: WheelEvent) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); };
    const blur = () => { this.keys.clear(); this.mouse.down = false; this.mouse.rdown = false; this.mouse.mdown = false; };
    const vis = () => { if (document.hidden) blur(); };
    const enter = () => { if (this.autoFocusOnHover && !this.hasFocus()) this.focus(); };
    const pd = () => this.focus();
    const drag = (e: Event) => e.preventDefault();

    const kdOwn = makeKd(true), kdParent = makeKd(false);
    window.addEventListener('keydown', kdOwn);
    window.addEventListener('keyup', ku);
    this.unbind.push(() => { window.removeEventListener('keydown', kdOwn); window.removeEventListener('keyup', ku); });
    // Preview hosts render the game inside an iframe while keyboard focus often stays on the parent page.
    // If the parent is same-origin we listen there too, so WASD works even before the iframe is focused.
    try {
      let w: Window = window;
      for (let i = 0; i < 4 && w.parent && w.parent !== w; i++) {
        w = w.parent;
        const d = w.document;
        if (!d) break;
        d.addEventListener('keydown', kdParent);
        d.addEventListener('keyup', ku);
        this.unbind.push(() => { d.removeEventListener('keydown', kdParent); d.removeEventListener('keyup', ku); });
        this.parentAttached++;
      }
    } catch { /* cross-origin parent: cannot listen there */ }
    window.addEventListener('mousemove', mm);
    window.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    canvas.addEventListener('contextmenu', cm);
    canvas.addEventListener('wheel', wh, { passive: false });
    canvas.addEventListener('mouseenter', enter);
    canvas.addEventListener('pointerdown', pd);
    canvas.addEventListener('touchstart', pd, { passive: true });
    canvas.addEventListener('dragstart', drag);
    this.unbind.push(() => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mousedown', md);
      window.removeEventListener('mouseup', mu);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', vis);
      canvas.removeEventListener('contextmenu', cm);
      canvas.removeEventListener('wheel', wh);
      canvas.removeEventListener('mouseenter', enter);
      canvas.removeEventListener('pointerdown', pd);
      canvas.removeEventListener('touchstart', pd);
      canvas.removeEventListener('dragstart', drag);
    });
  }

  /** Pull keyboard focus into the game (canvas is focusable). Safe to call often. */
  focus() {
    try { this.canvas.focus({ preventScroll: true }); } catch { /* ignore */ }
  }
  hasFocus() {
    try { return document.hasFocus(); } catch { return true; }
  }

  private updateMouse(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.mouse.x = ((e.clientX - r.left) / r.width) * VIEW_W;
    this.mouse.y = ((e.clientY - r.top) / r.height) * VIEW_H;
  }

  key(k: string) {
    return this.keys.has(k);
  }
  hit(k: string) {
    return this.pressed.has(k);
  }
  endFrame() {
    this.pressed.clear();
    this.mouse.pressed = false;
    this.mouse.rpressed = false;
    this.mouse.wheel = 0;
  }
  destroy() {
    this.unbind.forEach((f) => f());
  }
}

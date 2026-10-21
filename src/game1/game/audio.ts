// Tiny procedural WebAudio SFX synth — no assets needed.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch { /* no audio */ }
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setMuted(m: boolean) { muted = m; if (master) master.gain.value = m ? 0 : 0.35; }
export function isMuted() { return muted; }

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.5, slide = 0, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.4, hp = 800, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t);
}

export const SFX = {
  punch(n = 0) { noise(0.06, 0.5, 400); tone(160 - n * 15, 0.08, 'square', 0.35, -80); },
  heavy() { noise(0.12, 0.7, 200); tone(90, 0.18, 'sawtooth', 0.5, -60); },
  whoosh() { noise(0.12, 0.25, 1500); },
  parry() { tone(1200, 0.12, 'square', 0.4, 600); tone(1800, 0.25, 'sine', 0.3, 900, 0.03); noise(0.08, 0.3, 3000); },
  block() { noise(0.08, 0.4, 600); tone(220, 0.1, 'square', 0.3, -100); },
  ofa() { [330, 440, 554, 659, 880].forEach((f, i) => tone(f, 0.16, 'square', 0.22, 0, i * 0.05)); noise(0.4, 0.3, 2000); tone(1200, 0.5, 'sine', 0.2, 600, 0.1); },
  rage() { tone(140, 0.5, 'sawtooth', 0.5, -90); noise(0.35, 0.5, 250); tone(70, 0.6, 'square', 0.4, -30, 0.05); },
  axeSwing() { noise(0.2, 0.5, 350); tone(120, 0.22, 'sawtooth', 0.3, -70); },
  axeHit() { noise(0.13, 0.7, 180); tone(65, 0.2, 'square', 0.5, -40); },
  swish() { noise(0.07, 0.35, 2600); tone(950, 0.08, 'sine', 0.15, -600); },
  shing() { tone(2400, 0.1, 'square', 0.22, -1500); noise(0.07, 0.4, 3200); tone(3400, 0.14, 'sine', 0.16, -1800, 0.02); },
  crack() { noise(0.05, 0.7, 2600); tone(1100, 0.06, 'square', 0.35, -800); },
  jump() { tone(280, 0.14, 'square', 0.22, 260); noise(0.06, 0.18, 1400); },
  dash() { noise(0.1, 0.3, 1200); tone(400, 0.1, 'sine', 0.2, 300); },
  hurt() { tone(200, 0.2, 'sawtooth', 0.5, -150); noise(0.1, 0.4, 300); },
  kill() { noise(0.2, 0.6, 300); tone(300, 0.25, 'square', 0.4, -250); tone(80, 0.3, 'sine', 0.5, -40); },
  takedown() { noise(0.3, 0.8, 150); tone(60, 0.5, 'sawtooth', 0.6, -30); tone(700, 0.4, 'square', 0.3, -600, 0.08); },
  pistol() { noise(0.08, 0.6, 1000); tone(500, 0.08, 'square', 0.35, -400); },
  rifle() { noise(0.05, 0.5, 1500); tone(700, 0.05, 'square', 0.3, -500); },
  enemyShot() { noise(0.07, 0.35, 900); tone(380, 0.09, 'sawtooth', 0.25, -250); },
  pickup() { tone(660, 0.08, 'square', 0.3); tone(990, 0.12, 'square', 0.3, 0, 0.07); },
  heal() { tone(440, 0.1, 'sine', 0.3); tone(660, 0.1, 'sine', 0.3, 0, 0.08); tone(880, 0.2, 'sine', 0.3, 0, 0.16); },
  portal() { for (let i = 0; i < 5; i++) tone(200 + i * 120, 0.3, 'triangle', 0.25, 200, i * 0.06); },
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.3, 0, i * 0.08)); },
  focus() { tone(900, 0.2, 'sine', 0.4, 500); tone(1400, 0.3, 'sine', 0.3, 300, 0.05); },
  sweep() { noise(0.25, 0.6, 500); tone(150, 0.3, 'sawtooth', 0.4, -100); },
  kick() { noise(0.1, 0.6, 300); tone(120, 0.15, 'square', 0.5, -60); tone(600, 0.1, 'sine', 0.3, -300); },
  explode() { noise(0.5, 0.9, 80); tone(60, 0.6, 'sawtooth', 0.6, -40); },
  warn() { tone(880, 0.06, 'square', 0.25); },
  death() { [400, 300, 200, 120].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.4, -50, i * 0.15)); noise(0.6, 0.5, 200); },
  select() { tone(800, 0.05, 'square', 0.2); },
  wallSlam() { noise(0.2, 0.8, 120); tone(70, 0.3, 'square', 0.6, -40); },
  slowmo() { tone(300, 0.6, 'sine', 0.3, -200); },
};

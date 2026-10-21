type OscType = OscillatorType;

export class Sfx {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  muted = false;
  musicOn = true;
  // music
  private musicTimer: number | null = null;
  private nextNote = 0;
  private step = 0;
  private bpm = 128;
  intensity = 0;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  private get ok() {
    return !!this.ctx && !this.muted;
  }

  private tone(f0: number, f1: number, dur: number, type: OscType, vol: number, delay = 0, dest?: AudioNode) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, ftype: BiquadFilterType, f0: number, f1: number, vol: number, delay = 0, q = 1, dest?: AudioNode) {
    if (!this.ok) return;
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = ftype;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxGain);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  punch() {
    this.tone(160, 50, 0.08, 'sine', 0.5);
    this.noise(0.05, 'lowpass', 1200, 200, 0.35);
  }
  kick() {
    this.tone(120, 40, 0.12, 'sine', 0.6);
    this.noise(0.08, 'lowpass', 800, 150, 0.4);
  }
  heavy() {
    this.tone(90, 28, 0.22, 'sine', 0.9);
    this.noise(0.16, 'lowpass', 1500, 100, 0.55);
    this.tone(55, 30, 0.25, 'square', 0.12);
  }
  whoosh() {
    this.noise(0.1, 'bandpass', 500, 2200, 0.2, 0, 2);
  }
  hit() {
    this.noise(0.04, 'highpass', 1800, 2500, 0.3);
    this.tone(420, 180, 0.05, 'square', 0.08);
  }
  dash() {
    this.noise(0.16, 'bandpass', 300, 2800, 0.22, 0, 1.5);
  }
  shot(kind: 'pistol' | 'rifle') {
    if (kind === 'pistol') {
      this.noise(0.012, 'highpass', 5000, 7000, 0.5);
      this.noise(0.14, 'lowpass', 3400, 220, 0.6);
      this.tone(170, 38, 0.11, 'sine', 0.55);
      this.tone(260, 60, 0.06, 'square', 0.18);
      this.noise(0.3, 'bandpass', 700, 400, 0.1, 0.03, 1.5);
    } else {
      this.noise(0.008, 'highpass', 6000, 8000, 0.4);
      this.noise(0.065, 'lowpass', 5200, 600, 0.42);
      this.tone(380, 90, 0.04, 'sawtooth', 0.2);
      this.tone(140, 50, 0.05, 'sine', 0.3);
    }
  }
  casing() {
    this.tone(2600 + Math.random() * 800, 1900, 0.045, 'square', 0.035);
  }
  ricochet() {
    this.tone(1900, 500, 0.2, 'sawtooth', 0.07);
    this.noise(0.05, 'highpass', 4000, 6500, 0.12);
  }
  footstep() {
    this.noise(0.04, 'lowpass', 500, 180, 0.08);
  }
  slash(pitch = 1) {
    // steel whoosh: airy high band sweep + a thin metallic ring
    this.noise(0.14, 'bandpass', 1800 * pitch, 5200 * pitch, 0.3, 0, 1.5);
    this.tone(3200 * pitch, 2400 * pitch, 0.08, 'sine', 0.06);
  }
  slashHit(heavy: boolean) {
    // flesh cut: wet thud + metallic shing
    this.noise(0.08, 'lowpass', 1400, 200, heavy ? 0.6 : 0.4);
    this.tone(heavy ? 140 : 220, 60, heavy ? 0.14 : 0.08, 'sine', heavy ? 0.6 : 0.35);
    this.tone(4200, 2600, 0.12, 'sine', 0.1);
    this.noise(0.05, 'highpass', 4000, 6000, 0.2);
  }
  sheathe() {
    this.noise(0.18, 'highpass', 3000, 5000, 0.12);
    this.tone(2400, 1600, 0.12, 'sine', 0.06, 0.1);
    this.tone(600, 400, 0.05, 'square', 0.08, 0.2);
  }
  batCrack() {
    // the crack of the bat: sharp wooden snap
    this.noise(0.02, 'highpass', 1800, 3000, 0.6);
    this.tone(620, 180, 0.06, 'square', 0.25);
    this.tone(1900, 900, 0.05, 'triangle', 0.15);
  }
  axeSwing() {
    // heavy, low whoosh
    this.noise(0.22, 'bandpass', 220, 900, 0.32, 0, 1.2);
    this.tone(90, 60, 0.18, 'sine', 0.12);
  }
  axeHit(heavy: boolean) {
    // meaty chop: deep thud + wet crunch + metallic clank
    this.noise(0.06, 'lowpass', 900, 150, 0.7);
    this.tone(70, 25, heavy ? 0.3 : 0.18, 'sine', heavy ? 0.9 : 0.6);
    this.noise(0.12, 'bandpass', 400, 200, 0.45, 0.01, 1.5);
    this.tone(1800, 900, 0.08, 'triangle', 0.1, 0.01);
    if (heavy) this.tone(45, 20, 0.4, 'square', 0.15);
  }
  dualSwing() {
    // quick double 'shing'
    this.noise(0.07, 'bandpass', 2500 * 1.1, 6000, 0.2, 0, 2);
    this.tone(3600, 2800, 0.05, 'sine', 0.05);
    this.noise(0.06, 'bandpass', 2800, 6500, 0.16, 0.05, 2);
    this.tone(4200, 3200, 0.05, 'sine', 0.04, 0.05);
  }
  dualHit() {
    this.noise(0.05, 'lowpass', 1600, 300, 0.35);
    this.tone(300, 120, 0.06, 'sine', 0.3);
    this.tone(5200, 3400, 0.08, 'sine', 0.09);
  }
  nunchakuHit(heavy: boolean) {
    // wood crack: short bright click + knock
    this.noise(0.03, 'highpass', 2500, 4000, heavy ? 0.5 : 0.35);
    this.tone(heavy ? 240 : 420, heavy ? 90 : 200, heavy ? 0.12 : 0.07, 'square', heavy ? 0.3 : 0.18);
    this.tone(1200, 700, 0.05, 'triangle', 0.12);
    if (heavy) this.tone(80, 30, 0.2, 'sine', 0.6);
  }
  chainRattle() {
    this.noise(0.05, 'bandpass', 3500, 5000, 0.08, 0, 3);
    this.tone(2800 + Math.random() * 1200, 2200, 0.03, 'square', 0.04);
  }
  swing(pitch = 1) {
    this.noise(0.12, 'bandpass', 400 * pitch, 2600 * pitch, 0.26, 0, 2);
  }
  launch() {
    this.tone(180, 950, 0.25, 'sine', 0.2);
    this.noise(0.22, 'bandpass', 500, 3200, 0.16, 0, 2);
  }
  land() {
    this.tone(110, 40, 0.12, 'sine', 0.5);
    this.noise(0.1, 'lowpass', 700, 100, 0.3);
  }
  fatality() {
    this.tone(90, 28, 0.9, 'sawtooth', 0.45);
    this.noise(0.8, 'lowpass', 1000, 60, 0.5);
    this.tone(55, 50, 1.3, 'square', 0.18, 0.1);
    this.tone(2200, 1200, 0.4, 'sine', 0.08, 0.05);
  }
  announce() {
    this.tone(320, 160, 0.25, 'sawtooth', 0.16);
    this.tone(320, 160, 0.25, 'sawtooth', 0.16, 0.18);
    this.noise(0.2, 'lowpass', 1200, 200, 0.25, 0.18);
  }
  enemyShot() {
    this.noise(0.09, 'bandpass', 1300, 400, 0.28, 0, 1.2);
    this.tone(520, 180, 0.07, 'triangle', 0.15);
  }
  sniper() {
    this.noise(0.25, 'lowpass', 5000, 200, 0.6);
    this.tone(180, 40, 0.2, 'square', 0.3);
  }
  parry() {
    this.tone(1400, 1900, 0.14, 'sine', 0.3);
    this.tone(2100, 2700, 0.12, 'sine', 0.2, 0.02);
    this.noise(0.06, 'highpass', 3000, 5000, 0.25);
  }
  kill() {
    this.noise(0.28, 'lowpass', 2800, 150, 0.6);
    this.tone(320, 35, 0.28, 'sawtooth', 0.22);
  }
  hurt() {
    this.tone(220, 90, 0.22, 'square', 0.3);
    this.noise(0.18, 'lowpass', 900, 200, 0.35);
  }
  pickup() {
    this.tone(880, 880, 0.06, 'square', 0.12);
    this.tone(1320, 1320, 0.09, 'square', 0.12, 0.07);
  }
  explosion() {
    this.noise(0.55, 'lowpass', 3200, 50, 0.9);
    this.tone(90, 18, 0.5, 'sine', 0.9);
  }
  spawn() {
    this.tone(180, 1000, 0.3, 'sine', 0.12);
    this.noise(0.3, 'bandpass', 300, 3500, 0.08, 0, 2);
  }
  stagger() {
    this.tone(600, 280, 0.16, 'square', 0.18);
    this.tone(900, 420, 0.16, 'square', 0.14, 0.09);
  }
  levelClear() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.16, 'square', 0.14, i * 0.08));
  }
  empty() {
    this.tone(1200, 700, 0.05, 'square', 0.1);
  }
  select() {
    this.tone(600, 950, 0.08, 'square', 0.14);
  }
  death() {
    this.tone(400, 45, 1.1, 'sawtooth', 0.4);
    this.noise(0.9, 'lowpass', 1600, 80, 0.5);
  }
  portal() {
    this.tone(300, 1400, 0.7, 'sine', 0.18);
    this.noise(0.7, 'bandpass', 400, 4000, 0.1, 0, 3);
  }
  focus() {
    this.tone(200, 1800, 0.35, 'sawtooth', 0.2);
    this.noise(0.4, 'highpass', 800, 4000, 0.2);
  }
  slam() {
    this.tone(70, 20, 0.35, 'sine', 1);
    this.noise(0.3, 'lowpass', 1000, 60, 0.7);
  }
  beep() {
    this.tone(1800, 1800, 0.04, 'square', 0.12);
  }
  talk() {
    this.tone(300, 500, 0.05, 'square', 0.06);
  }

  // ---------- MUSIC ----------
  startMusic(intensity: number) {
    if (!this.ctx) return;
    this.intensity = intensity;
    this.bpm = 126 + intensity * 3;
    if (this.musicTimer !== null) return;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 30);
  }
  setIntensity(i: number) {
    this.intensity = i;
    this.bpm = 126 + i * 3;
  }
  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
  private schedule() {
    if (!this.ctx) return;
    const c = this.ctx;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextNote < c.currentTime + 0.12) {
      if (this.musicOn && !this.muted) this.playStep(this.step, this.nextNote - c.currentTime, stepDur);
      this.nextNote += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }
  private playStep(s: number, delay: number, stepDur: number) {
    const g = this.musicGain;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const inten = this.intensity;
    // kick
    if (i % 4 === 0 || (i === 14 && bar % 2 === 1) || (inten > 8 && i === 10)) this.tone(150, 40, 0.18, 'sine', 0.9, delay, g);
    // snare
    if (i === 4 || i === 12) {
      this.noise(0.14, 'bandpass', 1800, 900, 0.4, delay, 0.8, g);
      this.tone(220, 120, 0.08, 'triangle', 0.2, delay, g);
    }
    // hat
    if (i % 2 === 1 || inten > 4) this.noise(0.03, 'highpass', 7000, 9000, i % 4 === 2 ? 0.16 : 0.09, delay, 1, g);
    // bass
    const roots = [55, 55, 65.4, 49];
    const root = roots[bar % 4];
    const pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (pat[i]) {
      const f = i === 13 ? root * 1.5 : i === 8 ? root * 1.19 : root;
      this.tone(f, f * 0.995, stepDur * 1.8, 'sawtooth', 0.25, delay, g);
      this.tone(f * 2, f * 2, stepDur * 0.9, 'square', 0.05, delay, g);
    }
    // lead (higher intensity)
    if (inten >= 2) {
      const scale = [1, 1.2, 1.333, 1.5, 1.8, 2, 2.4];
      const seq = [0, 2, 4, 3, 5, 4, 2, 1, 0, 3, 5, 6, 5, 3, 2, 1];
      if ((i % 2 === 0 && bar % 2 === 1) || (inten >= 6 && i % 2 === 0)) {
        const f = root * 4 * scale[seq[(i + bar * 3) % 16] % scale.length];
        this.tone(f, f, stepDur * 0.8, 'square', 0.06, delay, g);
      }
    }
    // pad
    if (i === 0) {
      this.tone(root * 2, root * 2, stepDur * 16, 'triangle', 0.08, delay, g);
      this.tone(root * 2.4, root * 2.4, stepDur * 16, 'triangle', 0.05, delay, g);
    }
  }
}

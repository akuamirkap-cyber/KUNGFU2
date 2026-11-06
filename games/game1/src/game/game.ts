import { VW, VH, TILE, MAX_LEVEL, Mods, DEFAULT_MODS, UPGRADES, Upgrade, ENEMY_DEFS, EnemyKind, EnemyDef, AI_TIERS, SKINS, BOSSES } from './data';
const MID_BOSS_TITLES: Record<string, string> = { fists: 'FIST MASTER', pistol: 'GUNSLINGER', staff: 'STAFF ACOLYTE', machete: 'SLASHER', dual: 'TWIN EDGE', spear: 'LANCER', katana: 'RONIN', axe: 'REAPER', nunchaku: 'CHAIN DANCER', rifle: 'MARKSMAN' };
import { generateLevel, generateArena, LevelData } from './level';
import { SFX } from './audio';

export type Phase = 'title' | 'playing' | 'upgrade' | 'dead' | 'win' | 'paused' | 'transition';

export interface Attack { name: string; dmg: number; range: number; arc: number; dur: number; lunge: number; kb: number; posture: number; heavy?: boolean; kick?: boolean }
export const COMBO: Attack[] = [
  // combo dasar 5 hit: jab-cross-hook-sikut, ROUNDHOUSE jadi finisher (kick lebih jarang),
  // knockback diperkecil biar musuh mentalnya dekat dan combo gampang disambung lagi
  { name: 'JAB', dmg: 8, range: 20, arc: 1.7, dur: 0.17, lunge: 55, kb: 28, posture: 9 },
  { name: 'CROSS', dmg: 10, range: 22, arc: 1.7, dur: 0.19, lunge: 65, kb: 40, posture: 11 },
  { name: 'HOOK', dmg: 13, range: 22, arc: 2.5, dur: 0.21, lunge: 60, kb: 58, posture: 15 },
  { name: 'ELBOW', dmg: 15, range: 20, arc: 1.9, dur: 0.19, lunge: 70, kb: 80, posture: 17 },
  { name: 'ROUNDHOUSE', dmg: 20, range: 27, arc: 3.2, dur: 0.3, lunge: 80, kb: 115, posture: 18, heavy: true, kick: true },
  { name: 'SPIN KICK', dmg: 22, range: 29, arc: 3.8, dur: 0.3, lunge: 50, kb: 130, posture: 24, heavy: true, kick: true },
  { name: 'DRAGON PALM', dmg: 34, range: 26, arc: 1.5, dur: 0.34, lunge: 110, kb: 200, posture: 45, heavy: true },
];

export const NUNCHAKU: Attack[] = [
  { name: 'NUN SWING', dmg: 6, range: 28, arc: 3.6, dur: 0.145, lunge: 30, kb: 90, posture: 15 },
  { name: 'NUN CROSS', dmg: 6, range: 28, arc: 3.6, dur: 0.145, lunge: 30, kb: 90, posture: 15 },
  { name: 'NUN SPIN', dmg: 5, range: 30, arc: 6.3, dur: 0.3, lunge: 10, kb: 70, posture: 13 },
  { name: 'WHIP CRACK', dmg: 15, range: 29, arc: 2.4, dur: 0.26, lunge: 60, kb: 260, posture: 32, heavy: true },
];
export const KATANA: Attack[] = [
  { name: 'DRAW CUT', dmg: 12, range: 28, arc: 2.6, dur: 0.14, lunge: 60, kb: 90, posture: 12 },
  { name: 'IAI CROSS', dmg: 13, range: 28, arc: 2.6, dur: 0.15, lunge: 65, kb: 100, posture: 13 },
  { name: 'OVERHEAD', dmg: 19, range: 29, arc: 2.2, dur: 0.24, lunge: 70, kb: 170, posture: 20, heavy: true },
  { name: 'SPIN IAI', dmg: 16, range: 30, arc: 6.3, dur: 0.28, lunge: 30, kb: 140, posture: 18, heavy: true },
  { name: 'THRUST', dmg: 24, range: 36, arc: 1.4, dur: 0.26, lunge: 120, kb: 240, posture: 26, heavy: true },
];
export const AXE: Attack[] = [
  { name: 'BAT SWING', dmg: 18, range: 30, arc: 3.4, dur: 0.3, lunge: 70, kb: 430, posture: 30, heavy: true },
  { name: 'BACK SWING', dmg: 18, range: 30, arc: 3.4, dur: 0.3, lunge: 70, kb: 430, posture: 30, heavy: true },
  { name: 'OVERHEAD CHOP', dmg: 26, range: 30, arc: 2.4, dur: 0.36, lunge: 95, kb: 560, posture: 45, heavy: true },
  { name: 'HOME RUN', dmg: 34, range: 33, arc: 3.8, dur: 0.42, lunge: 115, kb: 820, posture: 60, heavy: true },
];
export const DUAL: Attack[] = [
  { name: 'L SLASH', dmg: 9, range: 26, arc: 2.8, dur: 0.12, lunge: 58, kb: 80, posture: 10 },
  { name: 'R SLASH', dmg: 9, range: 26, arc: 2.8, dur: 0.12, lunge: 58, kb: 80, posture: 10 },
  { name: 'CROSS SCISSOR', dmg: 13, range: 27, arc: 3.4, dur: 0.155, lunge: 62, kb: 130, posture: 14 },
  { name: 'DUAL SPIN', dmg: 8, range: 28, arc: 6.3, dur: 0.27, lunge: 32, kb: 110, posture: 12 },
  { name: 'TWIN FANG', dmg: 15, range: 29, arc: 2.2, dur: 0.2, lunge: 95, kb: 210, posture: 18, heavy: true },
];
export const CHAIN_ATK: Attack = { name: 'CHAIN', dmg: 5, range: 26, arc: 2.0, dur: 0.09, lunge: 110, kb: 30, posture: 7 };
export const STAFF: Attack[] = [
  { name: 'STAFF JAB', dmg: 10, range: 32, arc: 1.9, dur: 0.15, lunge: 85, kb: 120, posture: 16 },
  { name: 'STAFF SWING', dmg: 12, range: 32, arc: 3.4, dur: 0.165, lunge: 60, kb: 175, posture: 18 },
  { name: 'STAFF TWIRL', dmg: 9, range: 33, arc: 6.3, dur: 0.26, lunge: 30, kb: 130, posture: 16 },
  { name: 'VAULT STRIKE', dmg: 22, range: 33, arc: 3.0, dur: 0.3, lunge: 110, kb: 380, posture: 34, heavy: true },
];
export const SPEAR: Attack[] = [
  { name: 'SPEAR THRUST', dmg: 14, range: 38, arc: 1.5, dur: 0.155, lunge: 105, kb: 140, posture: 15 },
  { name: 'SPEAR SWEEP', dmg: 13, range: 36, arc: 3.6, dur: 0.175, lunge: 70, kb: 190, posture: 17 },
  { name: 'WHIRLWIND', dmg: 11, range: 36, arc: 6.3, dur: 0.3, lunge: 40, kb: 170, posture: 20, heavy: true },
  { name: 'SANADA CHARGE', dmg: 26, range: 40, arc: 1.6, dur: 0.3, lunge: 165, kb: 330, posture: 30, heavy: true },
];
export const MACHETE: Attack[] = [
  { name: 'DIAGONAL CHOP', dmg: 15, range: 32, arc: 3.3, dur: 0.17, lunge: 88, kb: 175, posture: 20 },
  { name: 'REVERSE HOOK', dmg: 15, range: 32, arc: 3.4, dur: 0.17, lunge: 88, kb: 175, posture: 20 },
  { name: 'SPLIT CLEAVE', dmg: 34, range: 34, arc: 2.6, dur: 0.3, lunge: 130, kb: 420, posture: 40, heavy: true },
  { name: 'JUNGLE SPIN', dmg: 12, range: 33, arc: 6.3, dur: 0.31, lunge: 55, kb: 210, posture: 23, heavy: true },
];
export type PState = 'idle' | 'attack' | 'dash' | 'parry' | 'block' | 'stun' | 'kick' | 'sweep' | 'takedown' | 'tkdkick' | 'airkick' | 'nunrush' | 'iaidash' | 'axerush' | 'bladerush' | 'flurry' | 'ragecharge' | 'ofapose' | 'vault' | 'lancerush' | 'slasherdash';
export interface Player {
  x: number; y: number; vx: number; vy: number; r: number;
  hp: number; guard: number; focus: number; weapon: number; ammoP: number; ammoR: number;
  state: PState; stateT: number; attackIdx: number; comboTimer: number; facing: number; moveAng: number; moving: boolean;
  /** anime brake: skid pose timer + cooldown + last-frame speed (stop-from-sprint detection) */
  brakeT: number; brakeCd: number; prevSpd: number;
  /** katana chain variatif: rencana jumlah tebas (1/2/3) + tebasan yang sudah jalan */
  katPlan: number; katStep: number;
  dashCd: number; dashAng: number; iframes: number; gunCd: number; hurtT: number; walk: number;
  didHit: boolean; buffered: boolean; curAttack: Attack | null; sqx: number; sqy: number; target: Enemy | null;
  parryHit: boolean; recoil: number; stunT: number; z: number; vz: number; tdkCd: number; kickHits: number[]; fatality: string; fatT: number; sprint: number; sprintHold: number; sprintMem: number; chargeT: number; riposteT: number; riposteTarget: Enemy | null; airChain: number; airHitId: number; fatBuffer: number; legAng: number; bank: number; fkRange: number; px0: number; py0: number; stepT: number; fkTarget: number; rageCharge: number; ofaPose: number; ofaReal: boolean; twist: number; whiff: number; arcT: number;
  chainMode: boolean; chainHits: number; chainTimer: number; chainFinal: boolean; clicks: number[]; swingAim?: number; rage: number; raging: boolean; flurryN: number; flurryTarget: Enemy | null; ofa: number; ofaActive: boolean; lockTarget: Enemy | null;
  /** game2-style FOCUS resource (0..300, 100 per Focus Strike). Separate from the 3 focus PIPS above,
   *  which still gate Q (kick) and E (sweep) exactly as before. */
  focusMeter: number; focusDash: BlurDash | null; rageDash: BlurDash | null;
  /** game2 gait: half step length in px, derived from the real ground speed so a planted foot never slides */
  strideHalf: number;
}
export type EState = 'chase' | 'windup' | 'attack' | 'recover' | 'stun' | 'broken' | 'knock' | 'getup' | 'dead' | 'teleport' | 'victim';
export interface Enemy {
  id: number; kind: EnemyKind; def: EnemyDef;
  x: number; y: number; vx: number; vy: number; r: number;
  hp: number; maxHp: number; posture: number; maxPosture: number; dmg: number; speed: number;
  state: EState; stateT: number; cd: number; facing: number; flash: number; lastHit: number; walk: number;
  hitPlayer: boolean; burst: number; burstT: number; pattern: string; sqx: number; sqy: number; strafe: number; stuckT: number;
  perfectDodged: boolean; name?: string; summonCd: number; spawnT: number; z: number; vz: number; rot: number; vrot: number;
  elite: boolean; slotAng: number; cunning: number; dodgeCd: number; rage: number; retreatT: number;
  mag: number; reloading: number; hasToken: boolean; nunCd: number; juggle: number; bleed: number; parryCd: number; deathSlash: number; react: number; reactAng: number; moveAng: number; disarmed: boolean; getup: number; bossStyle: string; tint: string; accentColor: string; deathSlashSplit: boolean;
  /** game2 gait: did this enemy actually travel this frame, and how long is its half step */
  walking: boolean; strideHalf: number;
}
/** game2's blur-dash (focusDash / rageDash) ported to game1: a REAL-TIME lerp from (sx,sy) to
 *  (tx,ty) that leaves afterimages and ends in one forced heavy strike. It runs on raw seconds so
 *  the slow motion it triggers cannot stall it. */
export interface BlurDash {
  sx: number; sy: number; tx: number; ty: number; t: number; dur: number;
  tgt: Enemy | null; id: number; atk: Attack; kind: 'focus' | 'rage'; color: string;
}
export interface Bullet { x: number; y: number; vx: number; vy: number; r: number; dmg: number; owner: 'p' | 'e'; life: number; deflected: boolean; kind: 'pistol' | 'rifle' | 'enemy' | 'boss' }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'ring' | 'spark' | 'text' | 'slash' | 'line' | 'smoke' | 'ghost' | 'shock'; text?: string; ang?: number; arc?: number; fric: number; grav: number; scale?: number; data?: any }
export interface Pickup { x: number; y: number; kind: 'ammoP' | 'ammoR' | 'hp' | 'xp' | 'chest'; t: number; v?: number }
const WEAPON_OF: Partial<Record<EnemyKind, string>> = { samurai: 'katana', pipeswing: 'pipe', cleaver: 'cleaver', gunner: 'pistol', rifleman: 'rifle', smg: 'smg', sniper: 'sniper' };
export interface Corpse { x: number; y: number; z: number; vx: number; vy: number; vz: number; rot: number; vrot: number; kind: EnemyKind; elite: boolean; r: number; t: number; facing: number; slashT: number; slashAng: number; sqx: number; sqy: number; nudge: number; weapon: string | null; split: boolean }

const TAU = Math.PI * 2;
/** game2's FOCUS economy: the meter caps at 300 and one Focus Strike costs 100. */
const FOCUS_MAX = 300, FOCUS_COST = 100;
const angDiff = (a: number, b: number) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Game {
  phase: Phase = 'title';
  level = 1;
  lvl!: LevelData;
  player!: Player;
  enemies: Enemy[] = [];
  corpses: Corpse[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  pickups: Pickup[] = [];
  portal: { x: number; y: number; t: number } | null = null;
  mods: Mods = { ...DEFAULT_MODS };
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: VW / 2, y: VH / 2, down: false, rdown: false };
  mouseWorld = { x: 0, y: 0 };
  cam = { x: 0, y: 0 };
  shake = 0; shakeX = 0; shakeY = 0; flash = 0; flashColor = '#fff'; zoom = 1; zoomT = 1;
  hitstop = 0; timeScale = 1; slowT = 0; time = 0;
  /** game2's slow() carries a per-call factor; 0.22 is game1's classic perfect-dodge depth. */
  slowFactor = 0.22;
  /** last real (unscaled) frame time, so blur-dashes tick in real time even under slow motion */
  rawDt = 1 / 60;
  focusReadySaid = false;
  combo = 0; comboT = 0; comboPop = 0; maxCombo = 0; score = 0; kills = 0; streak = 0; streakT = 0; streakText = '';
  banner = { text: '', sub: '', t: 0 };
  upgradeChoices: Upgrade[] = [];
  transT = 0; transNext = 0; transDone = false;
  lastKill = { x: 0, y: 0 };
  bossName = '';
  bossStyle: string = '';
  midBosses: Enemy[] = [];
  perfectText = ''; perfectT = 0;
  feed: { text: string; color: string; t: number; count: number }[] = [];
  nunchaku = { pts: [] as { x: number; y: number; px: number; py: number }[], anchor: { x: 0, y: 0 }, prevEnd: { x: 0, y: 0 }, trail: [] as { x: number; y: number }[], flourish: 0, flourishCd: 1, endSpeed: 0 };
  resetNunchaku() { const p = this.player; this.nunchaku.pts = Array.from({ length: 6 }, () => ({ x: p.x, y: p.y, px: p.x, py: p.y })); this.nunchaku.anchor = { x: p.x, y: p.y }; this.nunchaku.trail = []; }
  feedText(t: string, color = '#fff') {
    const last = this.feed[this.feed.length - 1];
    if (last && last.text === t && last.t > 0.9) { last.count++; last.t = 1.5; return; }
    this.feed.push({ text: t, color, t: 1.5, count: 1 });
    if (this.feed.length > 5) this.feed.shift();
  }
  checkpoint = 1; best = 1;
  onChange: (() => void) | null = null;
  runStart = 0;
  nextId = 1;
  deathCause = '';
  pickedUpgrades: string[] = [];
  mode: 'campaign' | 'endless' = 'campaign';
  endless = { time: 0, wave: 0, waveT: 0, spawnT: 1.5, xp: 0, xpNext: 10, stage: 1, aiTier: 0, bosses: 0, kills: 0 };
  eBest = { level: 0, time: 0, kills: 0 };
  bloodMode = 2; // 0 NORMAL · 1 PARTICLE (new FX only) · 2 COMBINED (particles + permanent stains)
  bodyScale = 0; // 0 = CHIBI (short) · 1 = TALL (long limbs)
  skinIndex = 0;
  scores: { campaign: { score: number; meta: string; when: number }[]; endless: { score: number; meta: string; when: number }[] } = { campaign: [], endless: [] };
  chestReward = false;
  lastRunNewBest = false;
  runRecorded = false;
  bloodCanvas: HTMLCanvasElement | null = null;
  bloodCtx: CanvasRenderingContext2D | null = null;
  get isEndless() { return this.mode === 'endless'; }

  constructor() {
    try {
      this.best = parseInt(localStorage.getItem('kf_best') || '1') || 1;
      this.checkpoint = parseInt(localStorage.getItem('kf_checkpoint') || '1') || 1;
      const m = localStorage.getItem('kf_mods');
      if (m) this.mods = { ...DEFAULT_MODS, ...JSON.parse(m) };
      const u = localStorage.getItem('kf_upg');
      if (u) this.pickedUpgrades = JSON.parse(u);
      const eb = localStorage.getItem('kf_endless');
      if (eb) this.eBest = { ...this.eBest, ...JSON.parse(eb) };
      const bm = localStorage.getItem('kf_blood');
      if (bm !== null) this.bloodMode = Math.min(2, Math.max(0, parseInt(bm) || 0));
      const bs = localStorage.getItem('kf_body');
      if (bs !== null) this.bodyScale = Math.min(1, Math.max(0, parseInt(bs) || 0));
      const sk = localStorage.getItem('kf_skin');
      if (sk !== null) this.skinIndex = Math.min(SKINS.length - 1, Math.max(0, parseInt(sk) || 0));
      const sc = localStorage.getItem('kf_scores');
      if (sc) this.scores = { campaign: [], endless: [], ...JSON.parse(sc) };
    } catch { /* ignore */ }
  }

  notify() { this.onChange?.(); }
  setPhase(p: Phase) { this.phase = p; this.notify(); }

  // ============ RUN CONTROL ============
  newRun(fromCheckpoint: boolean) {
    this.mode = 'campaign'; this.runRecorded = false; this.lastRunNewBest = false;
    if (!fromCheckpoint) { this.mods = { ...DEFAULT_MODS }; this.pickedUpgrades = []; this.checkpoint = 1; }
    this.level = fromCheckpoint ? this.checkpoint : 1;
    this.score = 0; this.kills = 0; this.maxCombo = 0; this.combo = 0;
    this.player = this.makePlayer();
    this.loadLevel(this.level);
    this.setPhase('playing');
  }

  makePlayer(): Player {
    return {
      x: 0, y: 0, vx: 0, vy: 0, r: 4.5, hp: this.mods.maxHp, guard: 0, focus: 1, weapon: 0, ammoP: 24, ammoR: 40,
      state: 'idle', stateT: 0, attackIdx: 0, comboTimer: 0, facing: 0, moveAng: 0, moving: false, dashCd: 0, dashAng: 0, iframes: 0,
      gunCd: 0, hurtT: 0, walk: 0, didHit: false, buffered: false, curAttack: null, sqx: 1, sqy: 1, target: null, parryHit: false, recoil: 0, stunT: 0, z: 0, vz: 0, tdkCd: 0, kickHits: [], fatality: '', fatT: 0, sprint: 0, sprintHold: 0, sprintMem: 0, chargeT: 0, riposteT: 0, riposteTarget: null, airChain: 0, airHitId: -1, fatBuffer: 0, legAng: 0, bank: 0, fkRange: 90, px0: 0, py0: 0, stepT: 0, fkTarget: -1, rageCharge: 0, ofaPose: 0, ofaReal: false, twist: 0, whiff: 0, arcT: 0,
      brakeT: 0, brakeCd: 0, prevSpd: 0, katPlan: 0, katStep: 0,
      chainMode: false, chainHits: 0, chainTimer: 0, chainFinal: false, clicks: [], rage: 0, raging: false, flurryN: 0, flurryTarget: null, ofa: 0, ofaActive: false, lockTarget: null,
      focusMeter: 0, focusDash: null, rageDash: null,
      strideHalf: 3,
    };
  }

  loadLevel(n: number) {
    this.level = n;
    this.lvl = generateLevel(n);
    const p = this.player;
    p.x = this.lvl.spawn.x; p.y = this.lvl.spawn.y; p.vx = p.vy = 0; p.state = 'idle'; p.stateT = 0; p.iframes = 1; p.guard = 0;
    this.enemies = []; this.corpses = []; this.drops = []; this.bullets = []; this.particles = []; this.pickups = []; this.portal = null; this.resetNunchaku(); this.initBloodCanvas();
    for (const s of this.lvl.enemySpawns) this.spawnEnemy(s.kind, s.x, s.y, true);
    // MID-BOSS: mark the themed elites so they get a health bar and a title
    this.midBosses = [];
    if (this.lvl.midBossCount && this.lvl.midBossStyle && !this.lvl.isBoss) {
      const armed = this.enemies.filter((x) => ['samurai', 'cleaver', 'pipeswing', 'brute', 'gunner', 'rifleman', 'ninja', 'dasher', 'shield', 'smg', 'sniper'].includes(x.kind));
      // strongest few become the mid-bosses of this floor
      armed.sort((a, b) => b.maxHp - a.maxHp);
      const cnt: number = this.lvl.isBoss || this.level < 4 ? 0 : Math.min(Math.max(1, this.lvl.midBossCount ?? 0), armed.length);
      const n = cnt;
      for (let i = 0; i < n; i++) {
        const mb = armed[i];
        mb.bossStyle = this.lvl.midBossStyle;
        mb.elite = true;
        mb.name = MID_BOSS_TITLES[this.lvl.midBossStyle] ?? 'ELITE';
        mb.maxHp *= 2.4; mb.hp = mb.maxHp;
        mb.dmg *= 1.25; mb.r *= 1.08;
        this.midBosses.push(mb);
      }
      if (n > 0) this.banner = { text: `${n}× ${this.banner.text}`, sub: 'ELITE MASTERS GUARD THIS FLOOR', t: 2.4 };
    }
    // themed boss assignment: floors 1-50 each introduce one of the 10 weapon masters
    if (this.lvl.isBoss) {
      const bd = BOSSES[Math.min(9, Math.floor((n - 1) / 5) % 10)];
      this.bossStyle = bd.style;
      const boss = this.enemies.find((x) => x.kind === 'boss');
      if (boss) { boss.bossStyle = bd.style; boss.name = bd.name; boss.tint = bd.color; boss.accentColor = bd.band; }
    } else this.bossStyle = '';
    for (const pk of this.lvl.pickups) this.pickups.push({ x: pk.x, y: pk.y, kind: pk.kind, t: Math.random() * 6 });
    this.cam.x = p.x; this.cam.y = p.y;
    this.bossName = this.lvl.isBoss ? BOSSES[Math.min(9, Math.floor((n - 1) / 5) % 10)].name : '';
    this.banner = { text: this.lvl.isBoss ? this.bossName : `LEVEL ${n}`, sub: this.lvl.isBoss ? 'BOSS — BREAK THEIR POSTURE' : this.lvl.biome.name, t: 2.4 };
    if (n > this.best) { this.best = n; localStorage.setItem('kf_best', String(n)); }
    const cp = Math.floor((n - 1) / 10) * 10 + 1;
    if (cp > this.checkpoint || n === 1) { this.checkpoint = cp; localStorage.setItem('kf_checkpoint', String(cp)); localStorage.setItem('kf_mods', JSON.stringify(this.mods)); localStorage.setItem('kf_upg', JSON.stringify(this.pickedUpgrades)); }
    this.flash = 0.5; this.flashColor = this.lvl.biome.bg;
    this.notify();
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number, initial = false) {
    const def = ENEMY_DEFS[kind];
    const L = this.lvl;
    const dl = this.diffLevel();
    const prog = Math.min(1.5, (dl - 1) / 199);
    const elite = this.isEndless && kind !== 'boss' && kind !== 'bomber' && Math.random() < Math.min(0.35, 0.02 + this.endless.time / 600 * 0.2 + this.level * 0.004);
    const bossMult = (kind === 'boss' ? (0.75 + Math.floor(dl / 10) * 0.1) : 1) * (elite ? 3 : 1);
    const e: Enemy = {
      id: this.nextId++, kind, def, x, y, vx: 0, vy: 0, r: def.radius,
      hp: def.hp * L.hpMult * bossMult, maxHp: def.hp * L.hpMult * bossMult,
      posture: 0, maxPosture: def.posture * (1 + prog * 2) * (elite ? 1.6 : 1), dmg: def.dmg * L.dmgMult * (elite ? 1.5 : 1), speed: def.speed * Math.min(1.5, L.spdMult) * (elite ? 1.1 : 1),
      state: 'chase', stateT: 0, cd: initial ? 0.6 + Math.random() * 0.8 : 1, facing: Math.random() * TAU, flash: 0, lastHit: -9, walk: Math.random() * 9,
      hitPlayer: false, burst: 0, burstT: 0, pattern: '', sqx: 1, sqy: 1, strafe: Math.random() < 0.5 ? 1 : -1, stuckT: 0, perfectDodged: false, summonCd: 8, spawnT: initial ? 0 : 0.4, z: 0, vz: 0, rot: 0, vrot: 0,
      elite, slotAng: (this.nextId * 2.399963) % TAU, cunning: Math.random(), dodgeCd: 0, rage: 0, retreatT: -99,
      mag: kind === 'gunner' ? 4 : kind === 'rifleman' ? 6 : kind === 'smg' ? 12 : kind === 'sniper' ? 1 : 0, reloading: 0, hasToken: false, nunCd: 0, juggle: 0, bleed: 0, parryCd: 0, deathSlash: -1, react: 0, reactAng: 0, moveAng: 0, disarmed: false, getup: 0, bossStyle: '', tint: '', accentColor: '', deathSlashSplit: false,
      walking: false, strideHalf: 3,
    };
    if (elite) e.r *= 1.2;
    e.moveAng = e.facing;
    this.enemies.push(e);
    return e;
  }

  // ===== BLOOD SYSTEM: 0 NORMAL · 1 PARTICLE · 2 COMBINED (+ permanent floor stains) =====
  setBodyScale(v: number) { this.bodyScale = v ? 1 : 0; try { localStorage.setItem('kf_body', String(this.bodyScale)); } catch { /* ignore */ } this.notify(); }
  cycleBody() { this.bodyScale = this.bodyScale ? 0 : 1; try { localStorage.setItem('kf_body', String(this.bodyScale)); } catch { /* ignore */ } this.notify(); }
  setSkin(i: number) { this.skinIndex = i; try { localStorage.setItem('kf_skin', String(i)); } catch { /* ignore */ } this.notify(); }
  bestScore() { return Math.max(this.scores.campaign[0]?.score ?? 0, this.scores.endless[0]?.score ?? 0); }
  recordScore(won: boolean) {
    if (this.runRecorded) return;
    this.runRecorded = true;
    const meta = this.isEndless ? `LV ${this.level} · ${Math.floor(this.endless.time / 60)}:${String(Math.floor(this.endless.time % 60)).padStart(2, '0')}` : won ? 'THRONE TAKEN' : `FLOOR ${this.level}`;
    const list = this.isEndless ? this.scores.endless : this.scores.campaign;
    const prevBest = list[0]?.score ?? 0;
    list.push({ score: this.score, meta, when: Date.now() });
    list.sort((a, b) => b.score - a.score);
    this.scores[this.isEndless ? 'endless' : 'campaign'] = list.slice(0, 5);
    this.lastRunNewBest = this.score > prevBest && this.score > 0;
    try { localStorage.setItem('kf_scores', JSON.stringify(this.scores)); } catch { /* ignore */ }
    this.notify();
  }
  setBloodMode(m: number) { this.bloodMode = m; try { localStorage.setItem('kf_blood', String(m)); } catch { /* ignore */ } this.notify(); }
  cycleBlood() { this.setBloodMode((this.bloodMode + 1) % 3); }
  initBloodCanvas() {
    this.bloodCanvas = null; this.bloodCtx = null;
    if (typeof document === 'undefined' || !this.lvl) return;
    try {
      const cv = document.createElement('canvas');
      cv.width = this.lvl.w * TILE; cv.height = this.lvl.h * TILE;
      this.bloodCanvas = cv; this.bloodCtx = cv.getContext('2d');
    } catch { /* no canvas */ }
  }
  stampBlood(x: number, y: number, r: number) {
    const c = this.bloodCtx; if (!c || r <= 0) return;
    const shades = ['rgba(106,4,15,', 'rgba(141,8,1,', 'rgba(89,13,34,', 'rgba(70,3,10,'];
    c.save(); c.translate(x, y); c.rotate(Math.random() * TAU); c.scale(1, 0.5 + Math.random() * 0.35);
    c.globalAlpha = 0.35 + Math.random() * 0.4;
    c.fillStyle = shades[Math.floor(Math.random() * shades.length)] + '1)';
    c.beginPath(); c.arc(0, 0, r * (0.7 + Math.random() * 0.6), 0, TAU); c.fill();
    c.restore();
  }
  spawnBlood(x: number, y: number, ang: number, dmg: number, heavy: boolean, fountain = false) {
    if (this.bloodMode === 0) { this.burstParticles(x, y, heavy ? 6 : 3, '#c1121f', 110, 1.6, 0.35); return; }
    const cols = ['#a4161a', '#ba1826', '#e5383b', '#6a040f'];
    // ---- directional cone: blood leaves along the cut direction ----
    const cone = heavy ? 0.85 : 1.15;            // heavy hits = tighter, more pressured jet
    const base = heavy ? 200 : 120;              // exit speed
    const n = Math.min(10, 2 + Math.round(dmg * 0.22));
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * 2 * cone;
      const sp = base * (0.45 + Math.random() * 0.85) * (heavy ? 1.2 : 1);
      this.particle({
        x: x + Math.cos(a) * 1.5, y: y + Math.sin(a) * 1.5,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (10 + Math.random() * 40),
        life: 0.3 + Math.random() * 0.35, size: 0.9 + Math.random() * 1.4,
        color: cols[Math.floor(Math.random() * cols.length)],
        kind: 'dot', fric: 0.9, grav: 340, data: { blood: true },
      });
    }
    // ---- arterial jet on heavy hits: one tight high-pressure line ----
    if (heavy) {
      for (let i = 0; i < 6; i++) {
        const a = ang + (Math.random() - 0.5) * 0.24;
        const sp = 260 + Math.random() * 150;
        this.particle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.22 + Math.random() * 0.18, size: 1.5, color: '#c1121f', kind: 'spark', fric: 0.95, grav: 260, data: { blood: true } });
      }
      // thin crimson mist hanging at the wound
      for (let i = 0; i < 3; i++) this.particle({ x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 20, vy: -8 - Math.random() * 12, life: 0.55 + Math.random() * 0.35, size: 2.4 + Math.random() * 2, color: 'rgba(140,18,22,0.42)', kind: 'smoke', fric: 0.94, data: { blood: true } });
    }
    // ---- fountain (death / fatality): upward arc pulled down by gravity ----
    if (fountain) {
      for (let i = 0; i < 13; i++) {
        const a = ang + (Math.random() - 0.5) * 1.6;
        this.particle({ x, y, vx: Math.cos(a) * (60 + Math.random() * 110), vy: -(150 + Math.random() * 130), life: 0.55 + Math.random() * 0.45, size: 1.1 + Math.random() * 1.1, color: cols[Math.floor(Math.random() * cols.length)], kind: 'dot', fric: 0.93, grav: 360, data: { blood: true } });
      }
    }
  }
  spawnGibs(x: number, y: number, kind: EnemyKind) {
    if (this.bloodMode === 0) return;
    const GIB: Partial<Record<EnemyKind, string>> = { samurai: '#c02830', ninja: '#3fae5a', brute: '#8b5cf6', boss: '#ffd166', bomber: '#ff7a1a', shield: '#ffd166' };
    const col = GIB[kind] ?? this.lvl.biome.enemy;
    for (let i = 0; i < 3; i++) { const a = Math.random() * TAU, sp = 70 + Math.random() * 110; this.particle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90, life: 0.7 + Math.random() * 0.4, size: 2 + Math.random() * 1.4, color: col, kind: 'dot', fric: 0.9, grav: 330, data: { blood: true, gib: col } }); }
  }
  drops: { x: number; y: number; z: number; vx: number; vy: number; vz: number; rot: number; vrot: number; kind: string; t: number; r: number }[] = [];
  dropWeapon(x: number, y: number, vx: number, vy: number, kind: string) {
    this.drops.push({ x, y, z: 4, vx, vy, vz: 120 + Math.random() * 60, rot: Math.random() * TAU, vrot: (Math.random() - 0.5) * 22, kind, t: 0, r: 2 });
    if (this.drops.length > 24) this.drops.shift();
    SFX.block();
  }
  addDecalRing(x: number, y: number) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + Math.random() * 0.2, r = 18 + Math.random() * 26;
      this.stampBlood(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 2 + Math.random() * 2);
    }
  }
  updateDrops(dt: number) {
    const p = this.player;
    for (const d of this.drops) {
      d.t += dt;
      d.vz -= 520 * dt; d.z += d.vz * dt;
      if (d.z <= 0) { d.z = 0; if (Math.abs(d.vz) > 60) { d.vz = -d.vz * 0.42; d.vrot *= 0.6; } else d.vz = 0; }
      if (d.z > 0.5) d.rot += d.vrot * dt; else { d.rot *= Math.pow(0.001, dt); d.vrot = 0; }
      const hitW = this.move(d, d.vx * dt, 0) || this.move(d, 0, d.vy * dt);
      if (hitW) { d.vx *= -0.5; d.vy *= -0.5; d.vrot *= 0.7; }
      const ps = Math.hypot(p.vx, p.vy), dd = Math.hypot(d.x - p.x, d.y - p.y);
      if (d.z < 5 && ps > 50 && dd < p.r + 6 && dd > 0.01) {
        const a = Math.atan2(d.y - p.y, d.x - p.x);
        d.vx = p.vx * 1.2 + Math.cos(a) * 70; d.vy = p.vy * 1.2 + Math.sin(a) * 70;
        d.vz = Math.max(d.vz, 60 + ps * 0.18); d.vrot += (Math.random() - 0.5) * 20;
        this.sparks(d.x, d.y, a, 3, '#fff', 110);
      }
      const fr = d.z > 0.5 ? 0.99 : 0.88;
      d.vx *= Math.pow(fr, dt * 60); d.vy *= Math.pow(fr, dt * 60);
    }
    this.drops = this.drops.filter((d) => d.t < 4);
  }
  // ragdoll corpses: fly, spin, BOUNCE, collide with each other, get kicked around
  updateCorpses(dt: number) {
    const p = this.player;
    for (const c of this.corpses) {
      c.t += dt; c.nudge -= dt; c.slashT = Math.max(0, c.slashT - dt);
      c.sqx = lerp(c.sqx, 1, dt * 9); c.sqy = lerp(c.sqy, 1, dt * 9);
      c.vz -= 520 * dt; c.z += c.vz * dt;
      if (c.z <= 0) {
        c.z = 0;
        if (Math.abs(c.vz) > 55) {
          c.vz = -c.vz * 0.52; c.vrot *= 0.8; c.sqx = 1.4; c.sqy = 0.58;
          this.smoke(c.x, c.y + 2, 2, '#555');
          if (this.bloodMode === 2) this.stampBlood(c.x, c.y, c.r * 1.3);
        } else { if (c.vz !== 0 && this.bloodMode === 2) this.stampBlood(c.x, c.y, c.r * 1.6 + 2); c.vz = 0; }
      }
      if (c.z > 0.5) c.rot += c.vrot * dt;
      else { c.rot *= Math.pow(0.001, dt); c.vrot = 0; }
      const spd = Math.hypot(c.vx, c.vy);
      const hitW = this.move(c, c.vx * dt, 0) || this.move(c, 0, c.vy * dt);
      if (hitW && spd > 100) {
        c.vx *= -0.55; c.vy *= -0.55; c.vrot *= 0.85; c.sqx = 1.3; c.sqy = 0.7;
        this.sparks(c.x, c.y - c.z, Math.atan2(-c.vy, -c.vx), 5, '#fff', 120);
        if (spd > 230) { SFX.wallSlam(); this.addShake(2); if (Math.random() < 0.45) this.text(c.x, c.y - 18, 'BONK!', '#fff', 0.8, 0.5); }
      }
      // the player kicks bodies out of the way while moving
      if (c.z < 6 && c.nudge <= 0 && p.state !== 'takedown') {
        const ps = Math.hypot(p.vx, p.vy);
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (ps > 55 && d < p.r + c.r + 3 && d > 0.01) {
          const a = Math.atan2(c.y - p.y, c.x - p.x);
          c.vx = p.vx * 1.3 + Math.cos(a) * 55; c.vy = p.vy * 1.3 + Math.sin(a) * 55;
          c.vz = Math.max(c.vz, 45 + ps * 0.22); c.vrot += (Math.random() - 0.5) * 16; c.nudge = 0.25; c.sqx = 1.25; c.sqy = 0.75;
          this.smoke(c.x, c.y + 2, 2, '#666');
        }
      }
      // a fast-flying body bowls over live enemies, knocking THEM flying too
      if (c.z < 8 && c.nudge <= 0) {
        const cspd = Math.hypot(c.vx, c.vy);
        for (const e of this.enemies) {
          if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
          const d = Math.hypot(c.x - e.x, c.y - e.y);
          if (d < e.r + c.r + 2 && d > 0.01) {
            const a = Math.atan2(e.y - c.y, e.x - c.x);
            if (cspd > 130) {
              // knock the standing enemy over: momentum transfers from the flying body.
              // Direct knock (no damage pipeline) so the chain stays physical, not lethal.
              if ((e.state as EState) !== 'dead' && e.state !== 'broken' && e.kind !== 'boss') {
                e.hp = Math.max(1, e.hp - 8);
                e.flash = 0.12;
                e.sqx = 1.35; e.sqy = 0.65;
                // velocity is a blend: mostly the body's own direction plus the push away from it
                e.state = 'knock'; e.stateT = 0;
                e.vx = c.vx * 0.62 + Math.cos(a) * 95;
                e.vy = c.vy * 0.62 + Math.sin(a) * 95;
                // cap the launch so they tumble, not rocket
                const ksp = Math.hypot(e.vx, e.vy), kmax = 320;
                if (ksp > kmax) { e.vx = e.vx / ksp * kmax; e.vy = e.vy / ksp * kmax; }
                e.z = Math.max(e.z, 0.1);
                e.vz = Math.min(120, 55 + cspd * 0.1);
                e.vrot = (Math.cos(a) >= 0 ? 1 : -1) * Math.min(11, 6 + cspd * 0.008);
                this.feedText('BODY CHECK!', this.lvl.biome.accent);
                SFX.block(); this.addShake(1.5); this.hitStop(0.02);
                if (this.bloodMode > 0) this.spawnBlood(e.x - Math.cos(a) * e.r, e.y - 5, a, 8, false);
              }
              // the flying body loses most of its momentum (it spent it on the victim)
              c.vx *= 0.4; c.vy *= 0.4; c.vrot *= 0.55; c.nudge = 0.32;
            } else {
              // slow body: just get shoved aside
              c.vx = Math.cos(a) * e.speed * 0.9 + e.vx; c.vy = Math.sin(a) * e.speed * 0.9 + e.vy;
              c.vz = Math.max(c.vz, 26); c.vrot += (Math.random() - 0.5) * 8; c.nudge = 0.3;
            }
            break;
          }
        }
      }
      const fr = c.z > 0.5 ? 0.996 : 0.88;
      c.vx *= Math.pow(fr, dt * 60); c.vy *= Math.pow(fr, dt * 60);
    }
    // corpse vs corpse: bouncy pile-ups
    for (let i = 0; i < this.corpses.length; i++) for (let j = i + 1; j < this.corpses.length; j++) {
      const a = this.corpses[i], b = this.corpses[j];
      if (Math.abs(a.z - b.z) > 16) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r + 1;
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d, push = (min - d) / 2;
      this.move(a, -nx * push, 0); this.move(a, 0, -ny * push);
      this.move(b, nx * push, 0); this.move(b, 0, ny * push);
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = -rel * 0.72;
        a.vx -= nx * imp; a.vy -= ny * imp; b.vx += nx * imp; b.vy += ny * imp;
        a.vrot += (Math.random() - 0.5) * 7; b.vrot += (Math.random() - 0.5) * 7;
        if (a.z < 1 && b.z < 1) { a.vz = Math.max(a.vz, 18); b.vz = Math.max(b.vz, 18); }
        if (rel < -120) this.smoke((a.x + b.x) / 2, a.y + 2, 2, '#666');
      }
    }
    if (this.corpses.length > 26) this.corpses.splice(0, this.corpses.length - 26);
    this.corpses = this.corpses.filter((c) => c.t < 2.3);
  }
  // ============ ENDLESS MODE ============
  diffLevel() { return this.isEndless ? Math.floor(1 + this.level * 2.2 + this.endless.time / 60 * 4) : this.level; }
  aiTierFor() {
    if (this.isEndless) return Math.min(AI_TIERS.length - 1, Math.max(Math.floor((this.level - 1) / 3), Math.floor(this.endless.time / 150)));
    return Math.min(AI_TIERS.length - 1, Math.floor(this.level / 25));
  }
  get ai() {
    const t = this.aiTierFor();
    return { surround: t >= 1, lead: t >= 2, bait: t >= 3, dodge: t >= 4, volley: t >= 5, punish: t >= 6, retreat: t >= 7, rage: t >= 8 };
  }
  startEndless() {
    this.mode = 'endless'; this.runRecorded = false; this.lastRunNewBest = false;
    this.mods = { ...DEFAULT_MODS }; this.pickedUpgrades = [];
    this.level = 1; this.score = 0; this.kills = 0; this.maxCombo = 0; this.combo = 0;
    this.endless = { time: 0, wave: 0, waveT: 0, spawnT: 1.2, xp: 0, xpNext: 10, stage: 1, aiTier: 0, bosses: 0, kills: 0 };
    this.player = this.makePlayer();
    this.loadArena(1);
    this.banner = { text: 'ENDLESS', sub: 'SURVIVE. EVOLVE. THEY LEARN.', t: 2.6 };
    this.setPhase('playing');
  }
  loadArena(stage: number) {
    this.lvl = generateArena(stage);
    this.applyEndlessScaling();
    const p = this.player;
    p.x = this.lvl.spawn.x; p.y = this.lvl.spawn.y; p.vx = p.vy = 0; p.state = 'idle'; p.stateT = 0; p.iframes = 1.2; p.guard = 0; p.z = 0;
    this.enemies = []; this.corpses = []; this.drops = []; this.bullets = []; this.particles = []; this.pickups = []; this.portal = null;
    this.initBloodCanvas();
    this.cam.x = p.x; this.cam.y = p.y;
    this.flash = 0.6; this.flashColor = this.lvl.biome.bg;
    this.notify();
  }
  applyEndlessScaling() {
    const dl = this.diffLevel(), min = this.endless.time / 60;
    this.lvl.hpMult = 1 + dl * 0.045 + min * 0.14 + Math.pow(min, 1.5) * 0.04;
    this.lvl.dmgMult = 1 + dl * 0.02 + min * 0.06;
    this.lvl.spdMult = 1 + Math.min(0.5, dl * 0.01 + min * 0.03);
  }
  updateEndless(dt: number) {
    const E = this.endless, p = this.player;
    E.time += dt; E.waveT += dt; E.spawnT -= dt;
    this.applyEndlessScaling();
    if (this.mods.regen > 0) p.hp = Math.min(this.mods.maxHp, p.hp + this.mods.regen * dt);
    const min = E.time / 60;
    const alive = this.enemies.filter((e) => e.state !== 'dead').length;
    const cap = Math.min(48, 8 + Math.floor(min * 3.5 + this.level * 0.8));
    const rate = Math.max(0.12, 1.0 - min * 0.06 - this.level * 0.012);
    if (E.spawnT <= 0 && alive < cap) {
      E.spawnT = rate * (0.7 + Math.random() * 0.6);
      const n = 1 + Math.floor(Math.random() * (1 + min / 2));
      for (let i = 0; i < n && alive + i < cap; i++) this.spawnAtEdge(this.pickEndlessKind());
    }
    // waves every 40s
    if (E.waveT >= 40) {
      E.waveT = 0; E.wave++;
      const horde = E.wave % 3 === 0, bossWave = E.wave % 5 === 0;
      const n = 5 + E.wave * 2;
      const kinds: EnemyKind[] = horde ? (this.level > 8 ? ['dasher', 'thug', 'ninja'] : ['thug', 'dasher']) : [];
      for (let i = 0; i < n; i++) this.spawnAtEdge(horde ? kinds[Math.floor(Math.random() * kinds.length)] : this.pickEndlessKind());
      if (bossWave) { E.bosses++; const b = this.spawnAtEdge('boss'); if (b) { const d = BOSSES[(E.bosses - 1) % BOSSES.length]; b.bossStyle = d.style; b.name = d.name; b.tint = d.color; b.accentColor = d.band; this.bossName = d.name; this.bossStyle = d.style; } }
      this.banner = { text: bossWave ? `BOSS WAVE ${E.wave}` : horde ? `HORDE WAVE ${E.wave}` : `WAVE ${E.wave}`, sub: bossWave ? this.bossName : horde ? 'THEY COME IN NUMBERS' : `${n} HOSTILES INBOUND`, t: 2.2 };
      SFX.warn(); SFX.portal(); this.addShake(4);
    }
    // merge excess xp gems
    if (this.pickups.length > 260) { const old = this.pickups.find((k) => k.kind === 'xp'); if (old) { old.t = -1; this.gainXp(old.v ?? 1, false); } }
    // AI tier change notification
    const tier = this.aiTierFor();
    if (tier !== E.aiTier) { E.aiTier = tier; this.banner = { text: `ENEMY IQ ↑ ${AI_TIERS[tier].name}`, sub: AI_TIERS[tier].desc, t: 3 }; SFX.focus(); SFX.warn(); this.flash = 0.3; this.flashColor = '#ff3b3b'; }
  }
  pickEndlessKind(): EnemyKind {
    const dl = this.diffLevel();
    const kinds = (Object.values(ENEMY_DEFS) as EnemyDef[]).filter((d) => d.kind !== 'boss' && d.unlock <= dl);
    const total = kinds.reduce((s, k) => s + k.weight, 0);
    let r = Math.random() * total;
    for (const k of kinds) { r -= k.weight; if (r <= 0) return k.kind; }
    return 'thug';
  }
  spawnAtEdge(kind: EnemyKind): Enemy | null {
    const p = this.player;
    for (let tries = 0; tries < 30; tries++) {
      const a = Math.random() * TAU, d = 190 + Math.random() * 90;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (x < TILE * 3 || y < TILE * 3 || x > (this.lvl.w - 3) * TILE || y > (this.lvl.h - 3) * TILE) continue;
      if (this.boxSolid(x, y, 8)) continue;
      const e = this.spawnEnemy(kind, x, y);
      this.smoke(x, y, 5, this.lvl.biome.wallTop);
      return e;
    }
    return null;
  }
  gainXp(v: number, fx = true) {
    const E = this.endless;
    E.xp += v;
    if (fx) SFX.pickup();
    if (E.xp >= E.xpNext) { E.xp -= E.xpNext; this.endlessLevelUp(); }
  }
  endlessLevelUp() {
    const E = this.endless;
    this.level++;
    E.xpNext = Math.floor(8 + this.level * 4 + Math.pow(this.level, 1.3) * 1.5);
    this.score += 200 * this.level;
    if (this.level > this.eBest.level) this.saveEndlessBest();
    SFX.levelUp(); this.flash = 0.4; this.flashColor = '#fff'; this.ring(this.player.x, this.player.y, 30, '#fff', 0.5);
    this.text(this.player.x, this.player.y - 22, 'LEVEL UP!', '#ffd166', 1.3, 1);
    if (this.level % 10 === 1) {
      // new stage: wipe the board
      E.stage++;
      for (const e of this.enemies) if (e.state !== 'dead') { this.burstParticles(e.x, e.y, 10, this.lvl.biome.accent, 150); }
      const keepHp = this.player.hp;
      this.loadArena(E.stage); this.player.hp = keepHp;
      this.banner = { text: `STAGE ${E.stage}`, sub: this.lvl.biome.name, t: 2.5 };
      E.spawnT = 2.5;
    }
    this.offerUpgrades();
    this.setPhase('upgrade');
  }
  saveEndlessBest() {
    const E = this.endless;
    this.eBest = { level: Math.max(this.eBest.level, this.level), time: Math.max(this.eBest.time, E.time), kills: Math.max(this.eBest.kills, this.kills) };
    localStorage.setItem('kf_endless', JSON.stringify(this.eBest));
  }
  // true if a teammate stands in the line of fire (AI won't friendly-fire)
  allyBlocking(e: Enemy) {
    const p = this.player;
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    for (const o of this.enemies) {
      if (o === e || o.state === 'dead' || o.state === 'victim' || o.state === 'teleport') continue;
      const ox = o.x - e.x, oy = o.y - e.y;
      const t = ox * ux + oy * uy;
      if (t < 10 || t > dist - 6) continue;
      if (Math.abs(-ox * uy + oy * ux) < o.r + 4) return true;
    }
    return false;
  }
  // predicted aim angle (AI: leading shots)
  aimAt(e: Enemy, projSpeed: number) {
    const p = this.player;
    if (!this.ai.lead || e.cunning < 0.25) return Math.atan2(p.y - e.y, p.x - e.x);
    const d = Math.hypot(p.x - e.x, p.y - e.y); const t = Math.min(1.2, d / projSpeed) * 0.85;
    return Math.atan2(p.y + p.vy * t - e.y, p.x + p.vx * t - e.x);
  }

  // ============ INPUT ============
  keyDown(code: string) { if (!this.keys.has(code)) this.pressed.add(code); this.keys.add(code); }
  keyUp(code: string) { this.keys.delete(code); }
  mouseDown(b: number) { if (b === 0) { this.mouse.down = true; this.pressed.add('LMB'); } if (b === 2) { this.mouse.rdown = true; this.pressed.add('RMB'); } }
  mouseUp(b: number) { if (b === 0) this.mouse.down = false; if (b === 2) this.mouse.rdown = false; }
  wheel(dy: number) { if (this.phase !== 'playing') return; const p = this.player; p.weapon = ((p.weapon + (dy > 0 ? 1 : -1)) % 10 + 10) % 10; if (p.weapon === 3) this.resetNunchaku(); SFX.select(); }

  // ============ HELPERS ============
  solid(px: number, py: number) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= this.lvl.w || ty >= this.lvl.h) return true;
    return this.lvl.tiles[ty * this.lvl.w + tx] === 1;
  }
  boxSolid(x: number, y: number, r: number) {
    return this.solid(x - r, y - r) || this.solid(x + r, y - r) || this.solid(x - r, y + r) || this.solid(x + r, y + r);
  }
  // Move with tile collision; returns true if hit a wall
  move(e: { x: number; y: number; r: number }, dx: number, dy: number) {
    let hit = false;
    const r = e.r * 0.9;
    if (dx !== 0) { const nx = e.x + dx; if (!this.boxSolid(nx, e.y, r)) e.x = nx; else { hit = true; } }
    if (dy !== 0) { const ny = e.y + dy; if (!this.boxSolid(e.x, ny, r)) e.y = ny; else { hit = true; } }
    return hit;
  }
  los(x1: number, y1: number, x2: number, y2: number) {
    const d = Math.hypot(x2 - x1, y2 - y1); const steps = Math.ceil(d / 4);
    for (let i = 1; i < steps; i++) { const t = i / steps; if (this.solid(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false; }
    return true;
  }
  inArc(ox: number, oy: number, facing: number, range: number, arc: number, tx: number, ty: number, tr: number) {
    const d = Math.hypot(tx - ox, ty - oy);
    if (d - tr > range) return false;
    if (d < tr + 5) return true;
    return Math.abs(angDiff(Math.atan2(ty - oy, tx - ox), facing)) <= arc / 2;
  }
  aliveEnemies() { return this.enemies.filter((e) => e.state !== 'dead'); }

  // ============ FX ============
  addShake(n: number) { this.shake = Math.min(5, this.shake + n * 0.55); }
  hitStop(t: number) { this.hitstop = Math.max(this.hitstop, t); }
  slowMo(t: number, factor = 0.22) { this.slowT = Math.max(this.slowT, t); this.slowFactor = factor; }
  particle(p: Partial<Particle> & { x: number; y: number }) {
    const q: Particle = { vx: 0, vy: 0, life: 0.4, max: 0.4, size: 2, color: '#fff', kind: 'dot', fric: 0.9, grav: 0, ...p };
    q.max = q.life;
    this.particles.push(q);
  }
  burstParticles(x: number, y: number, n: number, color: string, speed: number, size = 2, life = 0.45) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = speed * (0.3 + Math.random()); this.particle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random()), size: size * (0.5 + Math.random()), color, fric: 0.88, grav: 60 }); }
  }
  sparks(x: number, y: number, ang: number, n: number, color: string, speed = 180) {
    for (let i = 0; i < n; i++) { const a = ang + (Math.random() - 0.5) * 1.6, s = speed * (0.4 + Math.random()); this.particle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.2, size: 1.5, color, kind: 'spark', fric: 0.85 }); }
  }
  text(x: number, y: number, t: string, color = '#fff', scale = 1, life = 0.7) {
    this.particle({ x, y, vx: (Math.random() - 0.5) * 20, vy: -40, life, text: t, color, kind: 'text', fric: 0.9, scale });
  }
  slash(x: number, y: number, ang: number, range: number, arc: number, color: string, life = 0.16) {
    this.particle({ x, y, ang, arc, size: range, life, color, kind: 'slash' });
  }
  ring(x: number, y: number, size: number, color: string, life = 0.3) { this.particle({ x, y, size, color, kind: 'ring', life }); }
  smoke(x: number, y: number, n: number, color = '#888') { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 20 + Math.random() * 30; this.particle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10, life: 0.5 + Math.random() * 0.3, size: 3 + Math.random() * 3, color, kind: 'smoke', fric: 0.92 }); } }

  // ============ MAIN UPDATE ============
  realT = 0;
  fastT = -99;
  fastLevel = false;
  update(rdt: number) {
    this.realT += rdt;
    for (const f of this.feed) f.t -= rdt;
    if (this.feed.some((f) => f.t <= 0)) this.feed = this.feed.filter((f) => f.t > 0);
    if (this.phase === 'transition') { this.updateTransition(rdt); return; }
    if (this.phase === 'dead' || this.phase === 'win') { this.updateParticles(rdt * 0.35); this.updateCorpses(rdt * 0.35); this.updateCamera(rdt); this.flash = Math.max(0, this.flash - rdt); this.zoom = lerp(this.zoom, 1.15, rdt * 2); return; }
    if (this.phase !== 'playing') return;
    rdt = Math.min(rdt, 1 / 30);
    this.rawDt = rdt;
    this.comboPop = Math.max(0, this.comboPop - rdt * 4);
    // OFA auto-lock: nearest living enemy — recomputed even during hitstop, so it
    // jumps to the next target the very frame the current one dies
    {
      const p = this.player;
      if (p.ofaActive) {
        let best: Enemy | null = null, bd = 340;
        for (const e of this.enemies) {
          if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < bd) { bd = d; best = e; }
        }
        p.lockTarget = best;
      } else p.lockTarget = null;
    }
    if (this.hitstop > 0) { this.hitstop -= rdt; this.updateCamera(rdt); this.pressed.clear(); return; }
    const ofaOn = this.player.ofaActive;
    if (this.slowT > 0) { this.slowT -= rdt; this.timeScale = lerp(this.timeScale, this.slowFactor, 0.5); } else if (ofaOn) this.timeScale = lerp(this.timeScale, 0.3, rdt * 9); else this.timeScale = lerp(this.timeScale, 1, rdt * 10);
    const dt = rdt * this.timeScale;
    this.time += dt;
    this.banner.t -= rdt; this.perfectT -= rdt; this.streakT -= rdt;
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    this.zoomT = lerp(this.zoomT, this.player.ofaActive ? 0.94 : 1, rdt * 4); this.zoom = lerp(this.zoom, this.zoomT, rdt * 10);
    this.flash = Math.max(0, this.flash - rdt * 2.5);

    // mouse world
    this.mouseWorld.x = (this.mouse.x - VW / 2) / this.zoom + this.cam.x;
    this.mouseWorld.y = (this.mouse.y - VH / 2) / this.zoom + this.cam.y;

    if (this.isEndless) this.updateEndless(dt);
    if (this.player.ofaActive) { const pdt = (rdt * 4) / 3; for (let i = 0; i < 3; i++) this.updatePlayer(pdt); }
    else this.updatePlayer(dt);
    {
      const p = this.player;
      if (p.ofaActive) {
        p.ofa -= rdt * 8;
        if (p.ofa <= 0) { p.ofa = 0; p.ofaActive = false; this.feedText('ONE FOR ALL END', '#888'); this.ring(p.x, p.y, 14, '#57e6ff', 0.3); }
        else {
          // Full Cowling lightning
          if (Math.random() < 0.85) { const a = Math.random() * TAU; this.particle({ x: p.x + Math.cos(a) * 6, y: p.y - 4 - p.z + Math.sin(a) * 6, vx: Math.cos(a) * 45, vy: Math.sin(a) * 45, life: 0.16, size: 1.4, color: Math.random() < 0.6 ? '#7df9ff' : '#fff', kind: 'spark', fric: 0.9 }); }
          if (Math.random() < 0.4) this.particle({ x: p.x, y: p.y + 2 - p.z, life: 0.18, kind: 'ghost', color: '#7df9ff', data: { facing: p.facing, pose: p.moving ? 'run' : 'idle', walk: p.walk } });
        }
      }
    }
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateCorpses(dt);
    this.updateDrops(dt);
    this.updateCamera(rdt);

    // portal
    if (!this.isEndless && !this.portal && this.aliveEnemies().length === 0 && this.enemies.length > 0) {
      let px = this.lastKill.x, py = this.lastKill.y;
      if (this.boxSolid(px, py, 6)) { px = this.player.x; py = this.player.y; }
      this.portal = { x: px, y: py, t: 0 };
      SFX.portal(); this.ring(px, py, 40, this.lvl.biome.accent, 0.6);
    }
    if (this.portal) {
      this.portal.t += dt;
      const p = this.player;
      const d = Math.hypot(p.x - this.portal.x, p.y - this.portal.y);
      if (d < 60) { p.vx += (this.portal.x - p.x) / d * 40 * dt * (1 - d / 60) * 10; p.vy += (this.portal.y - p.y) / d * 40 * dt * (1 - d / 60) * 10; }
      if (d < 10 && this.portal.t > 0.4) this.completeLevel();
    }
    if (this.pressed.has('Escape') || this.pressed.has('KeyP')) { this.setPhase('paused'); }
    this.pressed.clear();
  }

  updateCamera(rdt: number) {
    const p = this.player;
    const tx = p.x + (this.mouseWorld.x - p.x) * 0.22, ty = p.y + (this.mouseWorld.y - p.y) * 0.22;
    this.cam.x = lerp(this.cam.x, tx, 1 - Math.pow(0.0005, rdt));
    this.cam.y = lerp(this.cam.y, ty, 1 - Math.pow(0.0005, rdt));
    const ww = this.lvl.w * TILE, wh = this.lvl.h * TILE;
    const hw = VW / 2 / this.zoom, hh = VH / 2 / this.zoom;
    this.cam.x = ww > hw * 2 ? clamp(this.cam.x, hw, ww - hw) : ww / 2;
    this.cam.y = wh > hh * 2 ? clamp(this.cam.y, hh, wh - hh) : wh / 2;
    this.shake = Math.max(0, this.shake - rdt * 42);
    this.shakeX = (Math.random() - 0.5) * this.shake * 2; this.shakeY = (Math.random() - 0.5) * this.shake * 2;
  }

  // ============ PLAYER ============
  updatePlayer(dt: number, rdt = dt) {
    const p = this.player, m = this.mods, k = this.keys;
    // FOCUS / RAGE blur-dash owns the player until it lands. It ticks on this.rawDt (REAL time) so the
    // slow motion it triggers cannot stall it — the same convention as ofaPose.
    if ((p.focusDash || p.rageDash) && this.updateBlurDash(this.rawDt)) return;
    p.stateT += dt; p.dashCd -= dt; p.iframes -= dt; p.comboTimer -= dt; p.gunCd -= dt; p.hurtT -= dt; p.tdkCd -= dt; p.riposteT -= dt; p.recoil = Math.max(0, p.recoil - dt * 8);
    p.brakeT = Math.max(0, p.brakeT - dt); p.brakeCd -= dt;
    if (this.pressed.has('KeyF')) p.fatBuffer = 0.3;
    p.fatBuffer -= dt;
    // WING CHUN: detect LMB spam (clicks every 0.1-0.4s) with fists
    if (this.pressed.has('LMB') && p.weapon === 0 && p.state !== 'takedown') {
      p.clicks.push(this.realT); if (p.clicks.length > 4) p.clicks.shift();
      const c = p.clicks;
      if (!p.chainMode && c.length >= 3) {
        const i1 = c[c.length - 1] - c[c.length - 2], i2 = c[c.length - 2] - c[c.length - 3];
        if (i1 > 0.03 && i1 < 0.6 && i2 > 0.03 && i2 < 0.6) { p.chainMode = true; p.chainHits = 0; p.chainTimer = 0.65; this.feedText('WING CHUN CHAIN!', this.lvl.biome.accent); SFX.focus(); }
      }
    }
    if (p.weapon !== 0 && p.chainMode) p.chainMode = false;
    if (p.chainMode) {
      p.chainTimer -= dt;
      if (p.chainTimer <= 0 && p.state === 'idle') this.exitChain(true);
    }
    // RAGE: drain while active, aura particles
    if (p.raging) {
      p.rage -= dt * 11;
      if (p.rage <= 0) { p.rage = 0; p.raging = false; this.feedText('RAGE OVER', '#888'); }
      if (Math.random() < 0.55) this.particle({ x: p.x + (Math.random() - 0.5) * 8, y: p.y - 2, vy: -34 - Math.random() * 20, life: 0.32, size: 1.6, color: Math.random() < 0.5 ? '#ff2a2a' : '#ff7a1a', kind: 'dot', fric: 0.95 });
    }
    if (this.pressed.has('KeyX') && !p.ofaActive && p.ofaPose <= 0 && p.ofa >= 25 && p.state !== 'takedown' && !p.focusDash && !p.rageDash) {
      p.ofaPose = 1.0; p.ofaReal = true; p.state = 'ofapose'; p.stateT = 0; p.vx = p.vy = 0;
      this.flash = 0.35; this.flashColor = '#ffffff';
      this.slowMo(1.4); this.zoomT = 1.22; SFX.ofa(); this.addShake(4);
      this.feedText('ONE FOR ALL', '#57e6ff');
    }
    if (p.ofaPose > 0) {
      const prev = p.ofaPose;
      p.ofaPose -= rdt;                       // ticks in REAL time, so slow-mo can't stall it
      const kk = 1 - Math.max(0, p.ofaPose) / 1.0;
      p.vx *= 0.75; p.vy *= 0.75;
      if (Math.random() < 0.5) this.ring(p.x, p.y, 10 + kk * 46, '#ffffff', Math.max(0.12, 0.4 - kk * 0.2));
      if (Math.random() < 0.8) this.particle({ x: p.x + (Math.random() - 0.5) * 14, y: p.y - 4, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 60, life: 0.3, size: 1.5, color: '#ffffff', kind: 'spark', fric: 0.9 });
      // PHASE 1: energy pulled in from the surroundings
      if (kk < 0.55) {
        const a = Math.random() * TAU, rr = 30 + Math.random() * 34;
        this.particle({ x: p.x + Math.cos(a) * rr, y: p.y - 4 + Math.sin(a) * rr, vx: -Math.cos(a) * 130, vy: -Math.sin(a) * 130, life: 0.34, size: 1.6, color: '#cdefff', kind: 'spark', fric: 0.94 });
        if (Math.random() < 0.3) this.ring(p.x, p.y, 8 + kk * 20, '#ffffff', 0.28 - kk * 0.24);
      }
      // RELEASE: accent whiteout + staged radial shockwave
      if (prev > 0.26 && p.ofaPose <= 0.26) {
        p.ofaActive = true;
        this.flash = 0.6; this.flashColor = '#ffffff'; this.hitStop(0.08); this.addShake(7);
        this.ring(p.x, p.y, 70, '#ffffff', 0.6); this.particle({ x: p.x, y: p.y, kind: 'shock', size: 70, life: 0.45, color: '#ffffff' });
        SFX.wallSlam(); SFX.ofa();
        this.feedText('SHOCKWAVE!', '#ffffff');
        for (const e of this.enemies) {
          if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < 120) {
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            this.hitEnemy(e, 8, a, 300, 24, 'explode');
            if ((e.state as EState) !== 'dead') { e.state = 'knock'; e.stateT = 0; e.vx = Math.cos(a) * 480; e.vy = Math.sin(a) * 480; e.z = 0.1; e.vz = 145; e.vrot = (Math.cos(a) >= 0 ? 1 : -1) * 15; }
            if (WEAPON_OF[e.kind] && Math.random() < 0.7) { const wa = a + (Math.random() - 0.5); this.dropWeapon(e.x, e.y - 4, Math.cos(wa) * 260, Math.sin(wa) * 260 - 100, WEAPON_OF[e.kind]!); }
          }
        }
        for (const d of this.drops) { const dd = Math.hypot(d.x - p.x, d.y - p.y); if (dd < 120 && dd > 0.01) { const a = Math.atan2(d.y - p.y, d.x - p.x); d.vx += Math.cos(a) * 320; d.vy += Math.sin(a) * 320; d.vz = Math.max(d.vz, 130); d.vrot += (Math.random() - 0.5) * 24; } }
        this.addDecalRing(p.x, p.y);
      }
    }
    // FAST LEVEL MODE: hold L to grind levels quickly (endless XP + campaign progress)
    this.fastLevel = this.keys.has('KeyL') || this.keys.has('BracketRight');
    if (this.pressed.has('KeyL') || this.pressed.has('BracketRight')) {
      if (this.isEndless) {
        // dump a burst of XP straight into the endless level curve
        this.gainXp(4 + Math.floor(this.level * 0.5));
        if (Math.random() < 0.4) this.pickups.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30, kind: 'xp', t: 0, v: 3 });
      } else if (this.time - this.fastT > 0.28) {
        this.fastT = this.time;
        if (this.level < MAX_LEVEL) { this.text(p.x, p.y - 26, `SKIP TO ${this.level + 1}`, '#ffd166', 1, 0.8); this.completeLevel(); }
      }
    }
    if (this.pressed.has('KeyR') && !p.raging && p.rageCharge <= 0 && p.rage >= 60 && p.state !== 'takedown' && !p.focusDash && !p.rageDash) {
      p.rageCharge = 1.25; p.state = 'ragecharge'; p.stateT = 0; p.vx = p.vy = 0;
      this.slowMo(0.3); this.zoomT = 1.16; SFX.rage(); this.addShake(3);
    }
    if (p.rageCharge > 0) {
      p.rageCharge -= dt;
      const k = 1 - Math.max(0, p.rageCharge) / 1.25;
      p.vx *= 0.8; p.vy *= 0.8;
      // PHASE 1 (k<0.45): crouched, sputtering sparks, dust pulled inward
      if (k < 0.45) {
        for (let i = 0; i < 2; i++) { const a = Math.random() * TAU; this.particle({ x: p.x + Math.cos(a) * (10 + (0.45 - k) * 40), y: p.y + 2, vx: -Math.cos(a) * 90, vy: -20, life: 0.3, size: 1.5, color: '#a89880', kind: 'smoke', fric: 0.92 }); }
        if (Math.random() < 0.5) this.particle({ x: p.x + (Math.random() - 0.5) * 8, y: p.y - 3, vy: -60 - Math.random() * 40, life: 0.25, size: 1.3, color: '#ffe9a8', kind: 'spark', fric: 0.9 });
      } else {
        // PHASE 2: aura column erupts upward, body trembles, debris lifts
        for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; this.particle({ x: p.x + Math.cos(a) * (5 + k * 6), y: p.y - 2 + Math.sin(a) * 4, vx: Math.cos(a) * 26 * k, vy: -110 - Math.random() * 120 * k, life: 0.45, size: 2 + Math.random() * 2 * k, color: Math.random() < 0.6 ? '#ffd23d' : '#ff9a2a', kind: 'smoke', fric: 0.93 }); }
        if (Math.random() < 0.85) this.particle({ x: p.x + (Math.random() - 0.5) * 11, y: p.y - 3, vy: -220 - Math.random() * 140, life: 0.24, size: 1.7, color: '#fff', kind: 'spark', fric: 0.9 });
        p.sqx = 0.88 + Math.sin(this.time * 40) * 0.04; p.sqy = 1.14 - Math.sin(this.time * 40) * 0.04;
      }
      if (p.rageCharge <= 0) {
        p.raging = true; p.chainMode = false;
        this.flash = 0.55; this.flashColor = '#ffd23d'; this.addShake(6); this.hitStop(0.06);
        SFX.rage(); SFX.wallSlam();
        this.feedText('SUPER RAGE!', '#ffd23d');
        this.ring(p.x, p.y, 40, '#ffd23d', 0.5); this.particle({ x: p.x, y: p.y, kind: 'shock', size: 46, life: 0.4, color: '#ffd23d' });
        for (const e of this.enemies) {
          if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < 90) {
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            this.hitEnemy(e, 6, a, 260, 18, 'explode');
            if ((e.state as EState) !== 'dead') { e.state = 'knock'; e.stateT = 0; e.vx = Math.cos(a) * 420; e.vy = Math.sin(a) * 420; e.z = 0.1; e.vz = 130; e.vrot = (Math.cos(a) >= 0 ? 1 : -1) * 14; }
          }
        }
        this.addDecalRing(p.x, p.y);
      }
    }
    // jump physics (states kick/takedown/tkdkick manage their own height)
    if (p.state !== 'kick' && p.state !== 'takedown' && p.state !== 'tkdkick' && p.state !== 'airkick' && (p.z > 0 || p.vz !== 0)) {
      p.vz -= 430 * dt; p.z += p.vz * dt;
      if (p.z <= 0) { const hard = p.vz < -190; p.z = 0; p.vz = 0; p.sqx = 1.25; p.sqy = 0.75; this.smoke(p.x, p.y + 2, hard ? 6 : 3, '#666'); if (hard) this.addShake(1.5); }
    }
    p.sqx = lerp(p.sqx, 1, dt * 12); p.sqy = lerp(p.sqy, 1, dt * 12);
    p.twist = lerp(p.twist, 0, Math.min(1, dt * 10));
    p.whiff = Math.max(0, p.whiff - dt * 1.35);
    p.arcT = Math.max(0, p.arcT - dt);
    p.recoil = Math.max(0, p.recoil - dt * 6);
    p.arcT = Math.max(0, p.arcT - dt);
    if (p.state !== 'idle') p.bank = lerp(p.bank, 0, Math.min(1, dt * 8));
    p.guard = Math.max(0, p.guard - dt * (p.state === 'block' ? 6 : 18));
    if (p.state !== 'attack' && p.state !== 'kick' && p.state !== 'takedown' && p.state !== 'tkdkick' && p.state !== 'airkick' && p.state !== 'nunrush' && p.state !== 'iaidash' && p.state !== 'axerush' && p.state !== 'bladerush' && p.state !== 'vault' && p.state !== 'lancerush' && p.state !== 'slasherdash' && p.state !== 'flurry') p.facing = Math.atan2(this.mouseWorld.y - p.y, this.mouseWorld.x - p.x);
    let mx = 0, my = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1; if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    const ml = Math.hypot(mx, my); p.moving = ml > 0;
    if (ml > 0) { mx /= ml; my /= ml; p.moveAng = Math.atan2(my, mx); }
    const speed = 92 * m.moveSpeed;
    // hold WASD to build up to 3x sprint; releasing the keys resets it
    p.sprintHold -= dt;
    if ((p.state === 'idle' || p.state === 'block') && ml > 0) {
      if (p.sprintHold > 0 && p.sprintMem > p.sprint) p.sprint = p.sprintMem; // grace: keep momentum after a tap
      const prev = p.sprint;
      p.sprint = Math.min(1, p.sprint + dt / 1.2);
      if (prev < 1 && p.sprint >= 1) { this.feedText('FULL SPRINT x3', '#ffd166'); this.smoke(p.x, p.y + 2, 4, '#666'); }
    } else if (ml === 0 && (p.state === 'idle' || p.state === 'block')) {
      if (p.sprint >= 0.85) { p.sprintHold = 0.3; p.sprintMem = p.sprint; }
      p.sprint = 0;
    }

    if (this.pressed.has('Digit1')) { p.weapon = 0; SFX.select(); }
    if (this.pressed.has('Digit2')) { p.weapon = 1; SFX.select(); }
    if (this.pressed.has('Digit3')) { p.weapon = 2; SFX.select(); }
    if (this.pressed.has('Digit4')) { p.weapon = 3; SFX.select(); this.resetNunchaku(); }
    if (this.pressed.has('Digit5')) { p.weapon = 4; SFX.select(); }
    if (this.pressed.has('Digit6')) { p.weapon = 5; SFX.select(); }
    if (this.pressed.has('Digit7')) { p.weapon = 6; SFX.select(); }
    if (this.pressed.has('Digit8')) { p.weapon = 7; SFX.select(); }
    if (this.pressed.has('Digit9')) { p.weapon = 8; SFX.select(); }
    if (this.pressed.has('Digit0')) { p.weapon = 9; SFX.select(); }

    if (p.ofaActive && p.lockTarget && p.lockTarget.state !== 'dead' && p.state !== 'takedown') p.facing = Math.atan2(p.lockTarget.y - p.y, p.lockTarget.x - p.x);
    const canAct = p.state === 'idle' || p.state === 'block';
    const dashKey = this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight');
    // universal cancels
    if ((canAct || (p.state === 'attack' && p.didHit) || p.state === 'parry') && dashKey && p.dashCd <= 0) this.startDash();
    else if ((canAct || (p.state === 'attack' && p.didHit)) && (this.pressed.has('RMB') || this.mouse.rdown)) this.startParry();
    else if (canAct && this.pressed.has('KeyQ')) this.startKick();
    else if (canAct && this.pressed.has('KeyE')) this.startSweep();
    else if (canAct && (this.pressed.has('KeyF') || p.fatBuffer > 0)) { if (this.tryTakedown()) p.fatBuffer = 0; }
    else if (canAct && this.pressed.has('KeyC')) this.tryFocusStrike();

    if (canAct && this.pressed.has('Space')) this.startJump();

    switch (p.state) {
      case 'idle': {
        const spd = speed * (1 + 2 * p.sprint) * (p.chargeT > 0.15 ? 0.45 : 1) * (p.raging ? 1.15 : 1);
        const dvx = mx * spd - p.vx, dvy = my * spd - p.vy;
        const curSpd = Math.hypot(p.vx, p.vy);
        const reversing = (dvx * p.vx + dvy * p.vy) < 0 && curSpd > 60;
        const rate = reversing ? 7.5 : 14; // gentler turn-around = smooth arcs, no snapping
        p.vx = lerp(p.vx, mx * spd, Math.min(1, dt * rate)); p.vy = lerp(p.vy, my * spd, Math.min(1, dt * rate));
        if (reversing && p.sprint > 0.5 && curSpd > 170 && Math.random() < 0.4) this.smoke(p.x, p.y + 2, 1, '#777');
        // ANIME BRAKE: berhenti mendadak dari lari -> pose ngerem + debu di kaki
        const spdNow = Math.hypot(p.vx, p.vy);
        if (p.prevSpd > 110 && spdNow < 60 && p.z === 0 && p.brakeCd <= 0 && p.state === 'idle') {
          p.brakeT = 0.35; p.brakeCd = 0.8;
          this.smoke(p.x, p.y + 2, 3, '#8a7f6d');
        }
        p.prevSpd = Math.max(spdNow, p.prevSpd - 140 * dt); // recent top speed, meluruh ~0.55s
        // footstep smoke puffs while running
        if (curSpd > 60 && p.z === 0) {
          p.stepT -= dt * (curSpd / 60);
          if (p.stepT <= 0) {
            p.stepT = 0.26;
            this.particle({ x: p.x - mx * 4, y: p.y + 2.5, vx: -mx * 16, vy: -5, life: 0.34, size: 1.5 + Math.random(), color: 'rgba(150,150,160,0.5)', kind: 'smoke', fric: 0.9 });
            if (p.sprint > 0.5) this.particle({ x: p.x - mx * 5, y: p.y + 2.5, vx: -mx * 26, vy: -9, life: 0.4, size: 2.2, color: 'rgba(170,170,180,0.55)', kind: 'smoke', fric: 0.9 });
          }
        }
        // legs swing toward the real movement direction; body banks into the turn
        const targetLeg = curSpd > 25 ? Math.atan2(p.vy, p.vx) : p.facing;
        const ld = angDiff(targetLeg, p.legAng), lmax = 13 * dt;
        p.legAng += Math.abs(ld) < lmax ? ld : Math.sign(ld) * lmax;
        const sideAcc = -Math.sin(p.facing) * dvx + Math.cos(p.facing) * dvy;
        p.bank = lerp(p.bank, clamp(sideAcc * 0.0011, -0.26, 0.26) * (curSpd > 40 ? 1 : 0), Math.min(1, dt * 9));
        // GAME2 GAIT CADENCE: the step phase AND the half step length both follow the real ground
        // speed (not the input), so a planted foot never slides. It is deliberately not gated on the
        // keys: the legs keep stepping while the body glides to a stop, and hold still while airborne
        // (game2 behaves the same). 3 steps/s at a jog up to ~5.5 steps/s at a full sprint.
        if (p.z <= 0.01 && curSpd > 5) {
          const stepsPerSec = 3 + 2.5 * clamp(curSpd / 160, 0, 1);
          p.strideHalf = clamp(curSpd / (4 * stepsPerSec), 2.4, 5.6);
          p.walk += dt * stepsPerSec * Math.PI; // 2 steps per 2PI
        } else if (curSpd <= 5) { p.walk = 0; p.strideHalf = 0; } // standing still -> planted idle stance
        if (ml > 0 && p.sprint > 0.5 && Math.random() < 0.4) this.particle({ x: p.x - mx * 4, y: p.y + 2, life: 0.3, size: 2, color: '#777', kind: 'smoke', vx: -mx * 20, vy: -5 });
        if (this.pressed.has('LMB') && p.raging && p.z < 3 && p.state === 'idle') { this.startRageStrike(); }
        else if (p.weapon >= 0 && p.weapon !== 1 && p.weapon !== 2) {
          if (this.pressed.has('LMB')) {
            const sprintFull = p.sprint >= 0.85 || (p.sprintHold > 0 && p.sprintMem >= 0.85);
            if (p.z > 1.2 && p.weapon === 0) this.startAirKick();
            else if (p.riposteT > 0 && p.riposteTarget && p.riposteTarget.state !== 'dead') this.doRiposte();
            else if (sprintFull && p.z === 0 && p.tdkCd <= 0) this.startWeaponRush();
            else this.startAttack();
          }
          // hold LMB to charge a palm blast (release to fire)
          if (this.mouse.down && p.z === 0 && p.state === 'idle') {
            p.chargeT += dt;
            if (p.chargeT > 0.3 && Math.random() < 0.6) this.particle({ x: p.x + (Math.random() - 0.5) * 10, y: p.y - 2, vy: -26, life: 0.3, size: 1.5, color: this.lvl.biome.accent });
          } else {
            if (p.chargeT >= 0.35) { if (p.weapon === 4) this.startIaiDash(); else this.startChargePalm(); }
            p.chargeT = 0;
          }
        } else if (this.mouse.down && (p.weapon === 2 || this.pressed.has('LMB'))) this.shoot();
        if (p.comboTimer <= 0) p.attackIdx = 0;
        break;
      }
      case 'attack': {
        if (p.weapon === 3) {
          const a = p.curAttack!;
          const t = p.stateT / a.dur;
          p.vx = Math.cos(p.facing) * a.lunge * Math.max(0, 1 - t * 1.5); p.vy = Math.sin(p.facing) * a.lunge * Math.max(0, 1 - t * 1.5);
          if (!p.didHit && t >= 0.45) { p.didHit = true; this.doNunHit(a); }
          if (this.pressed.has('LMB') && t > 0.3) p.buffered = true;
          if (t >= 1) {
            p.attackIdx = (p.attackIdx + 1) % NUNCHAKU.length; p.comboTimer = 1.05; p.state = 'idle'; p.stateT = 0;
            if (p.buffered) this.startAttack();
          }
          break;
        }
        const a = p.curAttack!;
        const t = p.stateT / a.dur;
        // momentum: acceleration curve (anticipation -> SNAP -> follow-through)
        const mom = t < 0.14 ? 0.25 : t < 0.45 ? Math.pow((t - 0.14) / 0.31, 0.55) : Math.max(0, 1 - (t - 0.45) / 0.55) * 0.55;
        const lunge = a.lunge * 2.6 * mom;
        if (!p.didHit) {
          // homing aim ke kursor, DIJANGKAR ke arah awal swing: koreksi boleh sampai ±115°,
          // tapi kalau badan sudah melewati target (overshoot) facing tidak flip 180° — anti whiff anomali
          const wantA = p.ofaActive && p.lockTarget && p.lockTarget.state !== 'dead' ? Math.atan2(p.lockTarget.y - p.y, p.lockTarget.x - p.x) : Math.atan2(this.mouseWorld.y - p.y, this.mouseWorld.x - p.x);
          if (p.stateT <= dt) { p.facing = wantA; p.swingAim = wantA; }
          else if (Math.abs(angDiff(p.swingAim ?? p.facing, wantA)) < 2.0) p.facing = wantA;
        }
        p.vx = Math.cos(p.facing) * lunge + mx * speed * 0.3; p.vy = Math.sin(p.facing) * lunge + my * speed * 0.3;
        // TORSO TWIST: the whole body rotates into the swing
        p.twist = Math.sin(Math.min(1, t * 1.2) * Math.PI) * (a.heavy ? 1 : 0.72);
        // MACHETE & AXE: overhead chop slams the body down at impact
        if ((p.weapon === 5 || p.weapon === 9) && !p.didHit && t >= 0.42) { p.sqx = 1.4; p.sqy = 0.62; p.z = Math.max(0, p.z - 1.5); }
        // KATANA quick-draw: dip the body low during the draw
        if (p.weapon === 4 && t < 0.16) { p.sqy = 0.82; p.sqx = 1.15; }
        // miss -> lose balance, stagger recovery
        if (!p.didHit && t >= 0.62 && p.whiff === 0) { p.whiff = 1; this.smoke(p.x - Math.cos(p.facing) * 6, p.y + 2, 3, '#666'); this.feedText('MISSED', '#888'); }
        if (!p.didHit && t >= 0.3) { p.didHit = true; this.doMeleeHit(a); }
        if (this.pressed.has('LMB') && t > 0.25) p.buffered = true;
        if (t >= 1) {
          if (p.weapon === 4) { p.katStep++; if (p.katStep > p.katPlan) { p.katStep = 0; p.katPlan = 0; } }
          p.attackIdx = (p.attackIdx + 1) % m.comboLen; p.comboTimer = 1.05; p.state = 'idle'; p.stateT = 0;
          if (p.buffered) this.startAttack();
        }
        break;
      }
      case 'dash': {
        const sp = 300 * (1 - p.stateT / 0.22 * 0.4);
        p.vx = Math.cos(p.dashAng) * sp; p.vy = Math.sin(p.dashAng) * sp;
        if (Math.random() < 0.6) this.particle({ x: p.x, y: p.y, life: 0.25, kind: 'ghost', color: '#fff', data: { facing: p.facing } });
        if (this.pressed.has('LMB') && p.stateT > 0.06 && p.weapon === 0) {
          p.state = 'idle'; p.stateT = 0;
          { this.startAttack(); p.curAttack!.lunge *= 1.9; p.curAttack!.dmg *= 1.3; p.curAttack!.kb *= 1.4; this.feedText('DASH STRIKE', this.lvl.biome.accent); }
        }
        // katana: dash + LMB = DASH SLASH — iai dash menerobos (ala Raiden/Ninja Gaiden)
        else if (this.pressed.has('LMB') && p.stateT > 0.06 && p.weapon === 4) { p.state = 'idle'; p.stateT = 0; this.startIaiDash(); }
        else if (p.stateT >= 0.22) { p.state = 'idle'; p.stateT = 0; }
        break;
      }
      case 'parry': {
        p.vx *= 0.8; p.vy *= 0.8;
        const win = 0.22 * m.parryWindow;
        if (p.stateT >= win) { if (this.mouse.rdown) { p.state = 'block'; p.stateT = 0; } else { p.state = 'idle'; p.stateT = 0; } }
        break;
      }
      case 'block': {
        p.vx = lerp(p.vx, mx * speed * 0.35, dt * 15); p.vy = lerp(p.vy, my * speed * 0.35, dt * 15);
        if (!this.mouse.rdown) { p.state = 'idle'; p.stateT = 0; }
        if (p.weapon !== 1 && p.weapon !== 2 && this.pressed.has('LMB')) this.startAttack();
        break;
      }
      case 'stun': {
        p.vx *= 0.9; p.vy *= 0.9;
        if (p.stateT >= p.stunT) { p.state = 'idle'; p.stateT = 0; p.guard = 0; }
        break;
      }
      case 'kick': {
        const dur = 0.42, tt = Math.min(1, p.stateT / dur);
        p.z = Math.sin(tt * Math.PI) * 16;
        const sp = 330 * (1 - tt * 0.35);
        const hitWall = this.move(p, Math.cos(p.facing) * sp * dt, 0) || this.move(p, 0, Math.sin(p.facing) * sp * dt);
        p.vx = p.vy = 0;
        if (Math.random() < 0.9) this.particle({ x: p.x, y: p.y + 2 - p.z, life: 0.22, kind: 'ghost', color: this.lvl.biome.accent, data: { facing: p.facing, pose: 'flykick' } });
        // ANTI-ANOMALI: fly kick cuma boleh mengenai 1 orang, 1 kali, lalu langsung mendarat
        const kickT = p.kickHits.length ? null : this.nearestInRadius(p.r + 9, p.kickHits);
        if (kickT) {
          const e = kickT;
          p.kickHits.push(e.id);
          this.hitEnemy(e, 34, p.facing, 260, 45, 'kick');
          if ((e.state as EState) !== 'dead') { e.state = 'knock'; e.stateT = 0; e.vx = Math.cos(p.facing) * 260; e.vy = Math.sin(p.facing) * 260; e.z = 0.1; e.vz = 64; e.vrot = (Math.cos(p.facing) >= 0 ? 1 : -1) * 8; }
          this.hitStop(0.07); this.addShake(5); SFX.kick(); this.zoomT = 1.06;
          this.feedText('FLYING KICK!', '#fff');
          this.sparks(e.x, e.y - 5, p.facing, 2, '#fff', 160);
          p.stateT = 0.42; // kontak -> langsung masuk fase mendarat, nggak nembus kerumunan
        }
        if (hitWall || tt >= 1) {
          p.state = 'idle'; p.stateT = 0; p.z = 0; p.sqx = 1.3; p.sqy = 0.7; p.kickHits = [];
          this.smoke(p.x, p.y + 2, 5, '#666'); this.addShake(2); SFX.block();
          if (hitWall) { p.vx = -Math.cos(p.facing) * 80; p.vy = -Math.sin(p.facing) * 80; }
        }
        break;
      }
      case 'nunrush': {
        const dur = 0.55, tt = p.stateT / dur;
        p.vx = Math.cos(p.facing) * 335 * (1 - tt * 0.25); p.vy = Math.sin(p.facing) * 335 * (1 - tt * 0.25);
        if (Math.floor(p.stateT / 0.11) !== Math.floor((p.stateT - dt) / 0.11) && p.stateT > 0) {
          let hitAny = false;
          const nrT = p.kickHits.length ? null : this.nearestInRadius(36);
            if (nrT) { const e = nrT;
            if (Math.hypot(e.x - p.x, e.y - p.y) < 36 + e.r) {
              p.kickHits.push(e.id); hitAny = true;
              this.hitEnemy(e, 13, p.facing, 330, 30, 'nunchaku', true);
              if ((e.state as EState) !== 'dead') { e.state = 'knock'; e.stateT = 0; e.vx = Math.cos(p.facing) * 380; e.vy = Math.sin(p.facing) * 380; e.z = 0.1; e.vz = 110; e.vrot = (Math.cos(p.facing) >= 0 ? 1 : -1) * 13; }
              this.sparks(e.x, e.y - 4, p.facing, 2, '#fff', 170); this.hitStop(0.03); this.addShake(3);
            }
          }
          if (hitAny) SFX.punch(2);
        }
        if (Math.random() < 0.9) this.particle({ x: p.x, y: p.y + 2, life: 0.18, kind: 'ghost', color: this.lvl.biome.accent, data: { facing: p.facing, pose: 'attack', atk: 'NUN SPIN', t: (p.stateT * 2.5) % 1 } });
        if (tt >= 1) {
          const already = p.kickHits.length > 0;
          p.state = 'idle'; p.stateT = 0; p.kickHits = [];
          if (!already) this.doNunHit({ name: 'WHIP CRACK', dmg: 15, range: 29, arc: 2.4, dur: 0.2, lunge: 0, kb: 260, posture: 32, heavy: true });
          p.sqx = 1.25; p.sqy = 0.75;
        }
        break;
      }
      case 'iaidash': {
        p.vx = Math.cos(p.facing) * 400; p.vy = Math.sin(p.facing) * 400;
        p.twist = 0.9; p.sqx = 1.5; p.sqy = 0.58; // quick-draw: body low and stretched, bursting forward
        if (Math.random() < 0.9) this.particle({ x: p.x, y: p.y + 2, life: 0.2, kind: 'ghost', color: '#cfe8ff', data: { facing: p.facing, pose: 'attack', atk: 'THRUST', t: 0.55 } });
        const iaT = p.kickHits.length ? null : this.nearestInRadius(p.r + 12);
        if (iaT) { const e = iaT;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 12) {
            p.kickHits.push(e.id);
            this.hitEnemy(e, 26, p.facing, 340, 40, 'melee', true);
            // slash arc disabled — was covering the animation
            // slash arc disabled — was covering the animation
            this.hitStop(0.045); this.addShake(3); SFX.crack();
          }
        }
        if (p.stateT >= 0.34) { p.state = 'idle'; p.stateT = 0; p.kickHits = []; p.sqx = 1.25; p.sqy = 0.75; }
        break;
      }
      case 'axerush': {
        p.vx = Math.cos(p.facing) * 295; p.vy = Math.sin(p.facing) * 295;
        if (Math.random() < 0.7) this.particle({ x: p.x, y: p.y + 2, life: 0.16, kind: 'ghost', color: '#ffb060', data: { facing: p.facing, pose: 'attack', atk: 'OVERHEAD CHOP', t: (p.stateT * 2.4) % 1 } });
        const axT = p.didHit ? null : this.nearestInRadius(p.r + 13);
        if (axT) { const e = axT;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 13) {
            p.kickHits.push(e.id);
            this.hitEnemy(e, 30, p.facing, 660, 52, 'melee', true);
            if ((e.state as EState) !== 'dead') { e.state = 'knock'; e.stateT = 0; e.vx = Math.cos(p.facing) * 620; e.vy = Math.sin(p.facing) * 620; e.z = 0.1; e.vz = 130; e.vrot = (Math.cos(p.facing) >= 0 ? 1 : -1) * 15; }
            this.hitStop(0.09); this.addShake(7); this.zoomT = 1.08; SFX.axeHit();
            if (!p.didHit) { p.didHit = true; this.feedText('AXE RUSH HIT!', '#ffb060'); }
          }
        }
        if (p.stateT >= 0.5) {
          const already = p.kickHits.length > 0;
          p.state = 'idle'; p.stateT = 0; p.kickHits = []; p.sqx = 1.3; p.sqy = 0.7;
          if (!already) this.doMeleeHit({ name: 'BAT SWING', dmg: 14, range: 30, arc: 3.4, dur: 0.2, lunge: 0, kb: 300, posture: 26, heavy: true });
        }
        break;
      }
      case 'bladerush': {
        p.vx = Math.cos(p.facing) * 385; p.vy = Math.sin(p.facing) * 385;
        if (Math.random() < 0.8) this.particle({ x: p.x, y: p.y + 2, life: 0.16, kind: 'ghost', color: '#cfe8ff', data: { facing: p.facing, pose: 'attack', atk: Math.floor(p.stateT * 8) % 2 ? 'L SLASH' : 'R SLASH', t: 0.5 } });
        const blT = p.kickHits.length ? null : this.nearestInRadius(p.r + 11);
        if (blT) { const e = blT;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 11) {
            p.kickHits.push(e.id);
            this.hitEnemy(e, 11, p.facing, 170, 16, 'melee');
            // slash arc disabled — was covering the animation
            this.hitStop(0.025); SFX.swish();
          }
        }
        if (p.stateT >= 0.3) { p.state = 'idle'; p.stateT = 0; p.kickHits = []; p.sqx = 1.2; p.sqy = 0.8; }
        break;
      }
      case 'flurry': {
        const tgt = p.flurryTarget;
        p.vx = p.vy = 0;
        if (!tgt || tgt.state === 'dead') { p.state = 'idle'; p.stateT = 0; p.flurryTarget = null; break; }
        p.facing = Math.atan2(tgt.y - p.y, tgt.x - p.x);
        const dd = Math.hypot(tgt.x - p.x, tgt.y - p.y), want = tgt.r + p.r + 2;
        if (dd > want + 2) { const nx = tgt.x - Math.cos(p.facing) * want, ny = tgt.y - Math.sin(p.facing) * want; if (!this.boxSolid(nx, ny, p.r)) { p.x = nx; p.y = ny; } }
        while (p.flurryN < 4 && p.stateT >= p.flurryN * 0.055) {
          p.flurryN++;
          const save = p.curAttack;
          p.curAttack = { name: 'CHAIN', dmg: 7, range: 27, arc: 2.2, dur: 0.1, lunge: 0, kb: 40, posture: 9 };
          this.doMeleeHit(p.curAttack);
          p.curAttack = save;
          p.sqx = 0.85; p.sqy = 1.15;
        }
        if (p.flurryN >= 4 || p.stateT > 0.32) { p.state = 'idle'; p.stateT = 0; p.flurryTarget = null; }
        break;
      }
      case 'vault': {
        const dur = 0.72, u = Math.min(1, p.stateT / dur);
        p.z = Math.sin(u * Math.PI) * 30;
        const sp = 235 * (1 - u * 0.4);
        p.vx = Math.cos(p.facing) * sp; p.vy = Math.sin(p.facing) * sp;
        if (Math.random() < 0.7) this.particle({ x: p.x, y: p.y + 2 - p.z, life: 0.16, kind: 'ghost', color: '#ffd166', data: { facing: p.facing, pose: 'attack', atk: 'VAULT STRIKE', t: 0.4 } });
        if (u >= 0.62 && !p.didHit) {
          p.didHit = true; p.z = 0; p.sqx = 1.35; p.sqy = 0.65;
          this.addShake(6); this.hitStop(0.05); SFX.axeHit();
          this.ring(p.x, p.y, 30, '#ffd166', 0.3); this.particle({ x: p.x, y: p.y, kind: 'shock', size: 32, life: 0.25, color: '#fff' });
          this.smoke(p.x, p.y + 2, 6, '#777');
          const vtT = this.nearestInRadius(38);
          if (vtT) { const e = vtT;
            if (Math.hypot(e.x - p.x, e.y - p.y) < 38 + e.r) {
              const a = Math.atan2(e.y - p.y, e.x - p.x);
              this.hitEnemy(e, 26, a, 400, 42, 'melee', true);
              if ((e.state as EState) !== 'dead') { e.state = 'knock'; e.stateT = 0; e.vx = Math.cos(a) * 360; e.vy = Math.sin(a) * 360; e.z = 0.1; e.vz = 110; e.vrot = (Math.cos(a) >= 0 ? 1 : -1) * 12; }
            }
          }
        }
        if (u >= 1) { p.state = 'idle'; p.stateT = 0; p.z = 0; }
        break;
      }
      case 'lancerush': {
        p.vx = Math.cos(p.facing) * 470; p.vy = Math.sin(p.facing) * 470;
        if (Math.random() < 0.9) this.particle({ x: p.x, y: p.y + 2, life: 0.18, kind: 'ghost', color: '#ffb3b3', data: { facing: p.facing, pose: 'attack', atk: 'SANADA CHARGE', t: 0.55 } });
        const lcT = p.kickHits.length ? null : this.nearestInRadius(p.r + 13);
        if (lcT) { const e = lcT;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 13) {
            p.kickHits.push(e.id);
            this.hitEnemy(e, 30, p.facing, 340, 46, 'melee', true);
            // slash arc disabled — was covering the animation
            this.hitStop(0.04); this.addShake(3); SFX.shing();
          }
        }
        if (p.stateT >= 0.42) { p.state = 'idle'; p.stateT = 0; p.kickHits = []; p.sqx = 1.25; p.sqy = 0.75; }
        break;
      }
      case 'slasherdash': {
        p.vx = Math.cos(p.facing) * 420; p.vy = Math.sin(p.facing) * 420;
        p.twist = 1; p.sqx = 1.45; p.sqy = 0.6; // hard lean, legs trailing the acceleration
        if (Math.random() < 0.85) this.particle({ x: p.x, y: p.y + 2, life: 0.17, kind: 'ghost', color: '#c02830', data: { facing: p.facing, pose: 'attack', atk: Math.floor(p.stateT * 9) % 2 ? 'CHOP' : 'HOOK SLASH', t: 0.5 } });
        const sdT = p.kickHits.length ? null : this.nearestInRadius(p.r + 11);
        if (sdT) { const e = sdT;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 11) {
            p.kickHits.push(e.id);
            this.hitEnemy(e, 16, p.facing, 200, 22, 'melee');
            // slash arc disabled — was covering the animation
            this.hitStop(0.03); this.addShake(2); SFX.shing();
          }
        }
        if (p.stateT >= 0.36) { p.state = 'idle'; p.stateT = 0; p.kickHits = []; p.sqx = 1.25; p.sqy = 0.75; }
        break;
      }
      case 'ragecharge': {
        p.vx = 0; p.vy = 0; p.sqx = 0.85; p.sqy = 1.2;
        if (p.rageCharge <= 0) { p.state = 'idle'; p.stateT = 0; }
        break;
      }
      case 'ofapose': {
        p.vx = 0; p.vy = 0; p.sqx = 0.8; p.sqy = 1.25;
        if (p.ofaPose <= 0) { p.state = 'idle'; p.stateT = 0; }
        break;
      }
      case 'airkick': {
        // mash LMB on contact to chain: AIR KICK -> AIR HEEL -> SKY SMASH
        if (p.didHit && this.pressed.has('LMB') && p.airChain < 3) {
          p.airChain++; p.didHit = false;
          if (p.airChain < 3) p.vz = 165; else { p.vz = -330; this.feedText('SKY SMASH!', '#ffd166'); }
          SFX.whoosh();
        }
        p.vx = Math.cos(p.facing) * 250; p.vy = Math.sin(p.facing) * 250;
        p.vz -= 640 * dt; p.z = Math.max(0, p.z + p.vz * dt);
        if (Math.random() < 0.7) this.particle({ x: p.x, y: p.y + 2 - p.z, life: 0.18, kind: 'ghost', color: this.lvl.biome.accent, data: { facing: p.facing, pose: 'sidekick' } });
        if (p.z > 0) {
          const akT = p.airHitId >= 0 ? this.enemies.find((x) => x.id === p.airHitId && x.state !== 'dead') ?? this.nearestInRadius(p.r + 11) : this.nearestInRadius(p.r + 11);
          if (akT) { const e = akT;
            if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 11) {
              p.airHitId = e.id;   // lock this victim for the whole air combo
              if (p.airChain >= 3) {
                this.hitEnemy(e, 26, p.facing, 260, 45, 'kick', true);
                if ((e.state as EState) !== 'dead') { e.state = 'knock'; e.stateT = 0; e.vx = Math.cos(p.facing) * 200; e.vy = Math.sin(p.facing) * 200; e.z = 0.1; e.vz = -260; e.vrot = (Math.cos(p.facing) >= 0 ? 1 : -1) * 10; }
                p.didHit = true; this.hitStop(0.09); this.addShake(6); SFX.kick();
              } else {
                this.hitEnemy(e, 18 + p.airChain * 4, p.facing, 220, 30, 'kick', true);
                p.vz = Math.max(p.vz, 120); p.didHit = true; this.hitStop(0.06); this.addShake(4); SFX.kick();
                this.feedText(p.airChain >= 2 ? 'AIR HEEL!' : 'AIR KICK!', this.lvl.biome.accent);
                // rantai air combo hanya maju lewat press BARU di blok atas — satu press = satu hit, nggak dobel
              }
              break;
            }
          }
        }
        if (p.z <= 0 && p.stateT > 0.04) {
          const smash = p.airChain >= 3 && p.didHit;
          p.z = 0; p.vz = 0; p.state = 'idle'; p.stateT = 0; p.sqx = 1.3; p.sqy = 0.7; p.airChain = 0; p.airHitId = -1;
          this.smoke(p.x, p.y + 2, 5, '#777'); this.addShake(2); this.ring(p.x, p.y, 10, '#fff', 0.15);
          if (smash) {
            this.addShake(6); this.hitStop(0.05); SFX.wallSlam();
            this.particle({ x: p.x, y: p.y, kind: 'shock', size: 26, life: 0.25, color: '#fff' }); this.ring(p.x, p.y, 30, this.lvl.biome.accent, 0.3);
            const smT = this.nearestInRadius(34);
            if (smT) this.hitEnemy(smT, 12, Math.atan2(smT.y - p.y, smT.x - p.x), 260, 20, 'explode', true);
          }
        }
        if (p.stateT > 0.6) { p.state = 'idle'; p.stateT = 0; p.z = 0; p.airHitId = -1; }
        break;
      }
      case 'tkdkick': {
        const dur = 0.46, tt = p.stateT / dur;
        const MAXZ = 6;                                   // LOW: chest-high at most, reads as a side kick
        if (tt < 0.14) { p.sqx = 1.2; p.sqy = 0.8; p.vx = 0; p.vy = 0; if (tt < 0.02) { p.px0 = p.x; p.py0 = p.y; } } // planted + re-origin
        else if (tt < 0.82) {
          const air = (tt - 0.14) / 0.68;
          p.z = Math.sin(air * Math.PI) * MAXZ;
          const remaining = p.fkRange - Math.hypot(p.x - p.px0, p.y - p.py0);
          const step = Math.min(470 * (1 / 60), Math.max(0, remaining));
          p.vx = Math.cos(p.facing) * step / (1 / 60); p.vy = Math.sin(p.facing) * step / (1 / 60);
          if (Math.random() < 0.85) this.particle({ x: p.x, y: p.y + 2 - p.z, life: 0.18, kind: 'ghost', color: this.lvl.biome.accent, data: { facing: p.facing, pose: 'sidekick' } });
          if (air > 0.25 && Math.random() < 0.4) this.smoke(p.x - Math.cos(p.facing) * 4, p.y + 2, 1, '#777');
          const distTravelled = Math.hypot(p.x - p.px0, p.y - p.py0);
          // exactly ONE victim per fly kick
          if (!p.kickHits.length) {
            // the locked target takes priority; otherwise anything we clip
            const locked = p.fkTarget >= 0 ? this.enemies.find((x) => x.id === p.fkTarget) : null;
            const pool = locked && locked.state !== 'dead' && locked.state !== 'victim' ? [locked] : this.enemies;
            for (const e of pool) {
              if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
              if (Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r + 15) continue;
              p.kickHits.push(e.id);
              const launched = (e.state as EState) !== 'dead' && e.state !== 'broken' && e.kind !== 'boss';
              this.hitEnemy(e, 26, p.facing, 330, 42, 'kick', true);
              if (launched && (e.state as EState) !== 'dead') {
                // sensible ragdoll: pushed along the kick, modest height, no wild spin
                e.state = 'knock'; e.stateT = 0;
                e.vx = Math.cos(p.facing) * 300; e.vy = Math.sin(p.facing) * 300;
                e.z = 0.1; e.vz = 72;
                e.vrot = (Math.cos(p.facing) >= 0 ? 1 : -1) * 8;
              }
              this.hitStop(0.06); this.addShake(3); this.zoomT = 1.05; SFX.kick();
              this.feedText('TKD FLY KICK!', '#fff');
              this.sparks(e.x, e.y - 5, p.facing, 2, '#fff', 160);
              p.stateT = 0.8 * dur; p.vx *= 0.25; p.vy *= 0.25;
              break;
            }
          }
          // land exactly on the cursor/target, never overshoot
          if (distTravelled >= p.fkRange) {
            const ex = p.px0 + Math.cos(p.facing) * p.fkRange, ey = p.py0 + Math.sin(p.facing) * p.fkRange;
            if (!this.boxSolid(ex, ey, p.r)) { p.x = ex; p.y = ey; }
            p.z = 0; p.vx *= 0.1; p.vy *= 0.1;
            p.sqx = 1.3; p.sqy = 0.7; p.fkTarget = -1;
            this.smoke(p.x, p.y + 2, 4, '#777'); this.addShake(1.2);
            p.state = 'idle'; p.stateT = 0; p.tdkCd = 0.9; p.kickHits = [];
            break;
          }
        } else {
          p.z = 0; p.vx *= 0.6; p.vy *= 0.6;
          if (!p.didHit) { p.didHit = true; p.sqx = 1.3; p.sqy = 0.7; this.smoke(p.x, p.y + 2, 5, '#777'); this.addShake(1.2); }
        }
        if (tt >= 1) { p.state = 'idle'; p.stateT = 0; p.tdkCd = 0.9; p.kickHits = []; }
        break;
      }
      case 'sweep': {
        p.vx *= 0.85; p.vy *= 0.85;
        if (!p.didHit && p.stateT >= 0.1) {
          p.didHit = true; SFX.sweep(); this.addShake(5); this.ring(p.x, p.y, 36, this.lvl.biome.accent, 0.35); this.hitStop(0.05);
          this.particle({ x: p.x, y: p.y, kind: 'shock', size: 38, life: 0.3, color: '#fff' });
          for (const e of this.enemies) {
            if (e.state === 'dead' || e.state === 'victim') continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) < 38 + e.r) {
              const a = Math.atan2(e.y - p.y, e.x - p.x);
              this.hitEnemy(e, 14, a, 160, e.maxPosture * 0.6, 'sweep');
              if ((e.state as EState) !== 'dead' && (e.state as EState) !== 'broken') { e.state = 'stun'; e.stateT = -0.9; }
            }
          }
        }
        if (p.stateT >= 0.38) { p.state = 'idle'; p.stateT = 0; }
        break;
      }
      case 'takedown': {
        const e = p.target;
        if (!e || e.state === 'dead') { p.state = 'idle'; p.stateT = 0; p.target = null; p.z = 0; break; }
        const t = p.stateT, f = p.fatality;
        if (!p.didHit) p.facing = Math.atan2(e.y - p.y, e.x - p.x);
        const dirX = Math.cos(p.facing), dirY = Math.sin(p.facing), side = dirX >= 0 ? 1 : -1;
        e.facing = p.facing + Math.PI; p.vx = p.vy = 0;
        if (t > 2.5) { this.finishFatality(e); break; }
        if (f === 'UPPERCUT') {
          e.vx = e.vy = 0;
          if (!p.didHit && t >= 0.3) {
            p.didHit = true; p.fatT = t; p.z = 7; p.sqx = 0.8; p.sqy = 1.3;
            e.z = 0.1; e.vz = 240; e.vrot = side * 16; e.vx = dirX * 25; e.vy = dirY * 25;
            this.fatalityImpact(e, 'UPPERCUT', -Math.PI / 2);
          }
          if (p.didHit) {
            p.z = Math.max(0, p.z - 45 * dt);
            e.vz -= 540 * dt; e.z += e.vz * dt; e.rot += e.vrot * dt;
            e.x += e.vx * dt; e.y += e.vy * dt;
            if (Math.random() < 0.6) this.particle({ x: e.x, y: e.y - e.z, life: 0.3, size: 2, color: '#ff3b3b', grav: 200 });
            if (e.z <= 0 && e.vz < 0) { e.z = 0; this.finishFatality(e); }
          }
        } else if (f === 'RUSH PUNCH') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t < 0.22) { this.move(p, -dirX * 70 * dt, 0); this.move(p, 0, -dirY * 70 * dt); p.walk += dt * 20; }
            else {
              this.move(p, dirX * 420 * dt, 0); this.move(p, 0, dirY * 420 * dt); p.walk += dt * 50;
              if (Math.random() < 0.8) this.particle({ x: p.x, y: p.y + 2, life: 0.22, kind: 'ghost', color: '#fff', data: { facing: p.facing, pose: 'run', walk: p.walk } });
              if (Math.random() < 0.5) this.smoke(p.x - dirX * 4, p.y + 2, 1, '#555');
              const d = Math.hypot(e.x - p.x, e.y - p.y);
              if (d < e.r + p.r + 6 || t > 0.75) {
                p.didHit = true; p.fatT = t; p.z = 3;
                e.vx = dirX * 520; e.vy = dirY * 520; e.vrot = side * 24; e.z = 0.1; e.vz = 50;
                this.fatalityImpact(e, 'RUSH PUNCH', p.facing);
              }
            }
          } else {
            const tt = t - p.fatT;
            if (tt < 0.12) { this.move(p, dirX * 140 * dt, 0); this.move(p, 0, dirY * 140 * dt); }
            p.z = Math.max(0, p.z - 20 * dt);
            e.rot += e.vrot * dt; e.vz -= 220 * dt; e.z = Math.max(0, e.z + e.vz * dt);
            if (Math.random() < 0.8) this.particle({ x: e.x, y: e.y - e.z, life: 0.25, size: 2, color: this.lvl.biome.accent });
            const spd = Math.hypot(e.vx, e.vy);
            if (this.boxSolid(e.x + e.vx * dt * 2.5, e.y + e.vy * dt * 2.5, e.r) || spd < 80 || tt > 0.7) this.finishFatality(e, true);
          }
        } else if (f === 'AXE KICK') {
          e.vx = e.vy = 0;
          const jumpDur = 0.38;
          if (!p.didHit) {
            const u = Math.min(1, t / jumpDur);
            p.z = Math.sin(u * Math.PI) * 24;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d > e.r + 1) { this.move(p, dirX * 55 * dt, 0); this.move(p, 0, dirY * 55 * dt); }
            if (t >= jumpDur) {
              p.didHit = true; p.fatT = t; p.z = 0; p.sqx = 1.3; p.sqy = 0.7;
              e.sqx = 2.2; e.sqy = 0.2;
              this.fatalityImpact(e, 'AXE KICK', Math.PI / 2);
              // impact flare removed
              this.burstParticles(e.x, e.y, 14, this.lvl.biome.wallTop, 160, 3, 0.5);
            }
          } else {
            const tt = t - p.fatT;
            e.sqx = 2.2 + Math.sin(tt * 40) * 0.2; e.sqy = 0.2;
            if (tt >= 0.45) this.finishFatality(e);
          }
        } else if (f === 'PALM BLAST') {
          if (!p.didHit) e.vx = e.vy = 0;
          if (!p.didHit && t >= 0.26) {
            p.didHit = true; p.fatT = t;
            e.vx = dirX * 560; e.vy = dirY * 560; e.z = 0.1; e.vz = 55; e.vrot = side * 20;
            p.x -= dirX * 4; p.y -= dirY * 4;
            this.fatalityImpact(e, 'PALM BLAST', p.facing);
            this.particle({ x: e.x, y: e.y - 4, kind: 'shock', size: 30, life: 0.3, color: this.lvl.biome.accent });
          }
          if (p.didHit && p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 500 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (Math.random() < 0.7) this.particle({ x: e.x, y: e.y - e.z, life: 0.25, size: 2, color: this.lvl.biome.accent });
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.9) this.finishFatality(e);
          }
        } else if (f === 'KNEE LAUNCH') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d > e.r + p.r + 2) { this.move(p, dirX * 280 * dt, 0); this.move(p, 0, dirY * 280 * dt); p.walk += dt * 30; }
            else {
              p.didHit = true; p.fatT = t; p.z = 9;
              e.z = 0.1; e.vz = 315; e.vrot = side * 10; e.vx = dirX * 30; e.vy = dirY * 30;
              this.fatalityImpact(e, 'KNEE LAUNCH', -Math.PI / 2);
            }
          } else {
            p.z = Math.max(0, p.z - 55 * dt);
            e.vz -= 560 * dt; e.z += e.vz * dt; e.rot += e.vrot * dt; e.x += e.vx * dt; e.y += e.vy * dt;
            if (Math.random() < 0.5) this.particle({ x: e.x, y: e.y - e.z, life: 0.3, size: 2, color: '#ff3b3b', grav: 200 });
            if (e.z <= 0 && e.vz < 0) {
              e.z = 0; this.addShake(8); SFX.wallSlam();
              this.smoke(e.x, e.y, 8, '#555');
              for (const o of this.enemies) if (o !== e && o.state !== 'dead' && o.state !== 'victim' && Math.hypot(o.x - e.x, o.y - e.y) < 36) this.hitEnemy(o, 15, Math.atan2(o.y - e.y, o.x - e.x), 220, 20, 'explode', true);
              this.finishFatality(e);
            }
          }
        } else if (f === 'SUPLEX THROW') {
          if (!p.didHit && t >= 0.24) { p.didHit = true; p.fatT = t; this.fatalityImpact(e, 'SUPLEX THROW', p.facing + Math.PI); }
          if (p.didHit && p.state === 'takedown') {
            const u = Math.min(1, (t - p.fatT) / 0.42);
            if (u < 1) {
              e.x = p.x + dirX * (e.r + 2) * (1 - 2 * u); e.y = p.y + dirY * (e.r + 2) * (1 - 2 * u);
              e.z = Math.sin(u * Math.PI) * 26; e.rot += 11 * dt;
            } else if (e.vx === 0 && e.vy === 0 && e.vz === 0) { e.vx = -dirX * 480; e.vy = -dirY * 480; e.vz = 60; e.vrot = -side * 18; }
            else {
              e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
              if (Math.random() < 0.6) this.particle({ x: e.x, y: e.y - e.z, life: 0.25, size: 2, color: this.lvl.biome.accent });
              if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
              else if (t - p.fatT > 1.15) this.finishFatality(e);
            }
          }
        } else if (f === 'SPIN STRIKE') {
          if (!p.didHit) e.vx = e.vy = 0;
          if (!p.didHit) {
            if (t - p.fatT >= 0.13 && t < 0.46) { p.fatT = t; SFX.punch(1); this.sparks(e.x, e.y - 6, p.facing, 2, '#fff', 170); e.flash = 0.1; e.sqx = 1.35; e.sqy = 0.65; this.addShake(1.5); }
            if (t >= 0.46) {
              p.didHit = true; p.fatT = t;
              e.vx = dirX * 400; e.vy = dirY * 400; e.z = 0.1; e.vz = 150; e.vrot = side * 22;
              this.fatalityImpact(e, 'SPIN STRIKE', p.facing);
            }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (Math.random() < 0.6) this.particle({ x: e.x, y: e.y - e.z, life: 0.25, size: 2, color: '#fff' });
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.85) this.finishFatality(e);
          }
        } else if (f === 'DRAGON TAIL') {
          if (!p.didHit) e.vx = e.vy = 0;
          if (!p.didHit && t >= 0.3) {
            p.didHit = true; p.fatT = t;
            const px2 = -dirY * side, py2 = dirX * side;
            e.vx = px2 * 430 + dirX * 130; e.vy = py2 * 430 + dirY * 130; e.z = 0.1; e.vz = 95; e.vrot = side * 26;
            this.fatalityImpact(e, 'DRAGON TAIL', Math.atan2(e.vy, e.vx));
            SFX.sweep();
          }
          if (p.didHit && p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 480 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (Math.random() < 0.8) this.smoke(e.x, e.y + 2, 1, '#666');
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.9) this.finishFatality(e);
          }
        } else if (f === 'CHAIN STRANGLE') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d > e.r + p.r + 2) { e.x += (p.x - e.x) / d * 170 * dt; e.y += (p.y - e.y) / d * 170 * dt; }
            if (t >= 0.34) {
              p.didHit = true; p.fatT = t;
              e.vx = dirX * 620; e.vy = dirY * 620; e.z = 0.1; e.vz = 70; e.vrot = side * 26;
              this.fatalityImpact(e, 'CHAIN STRANGLE', p.facing);
            }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 480 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (Math.random() < 0.8) this.particle({ x: e.x, y: e.y - e.z, life: 0.25, size: 2, color: this.lvl.biome.accent });
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.9) this.finishFatality(e);
          }
        } else if (f === 'HELICOPTER STRIKE') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t - p.fatT >= 0.16 && t < 0.62) {
              p.fatT = t; SFX.crack(); e.flash = 0.12; e.sqx = 1.4; e.sqy = 0.6;
              this.sparks(e.x, e.y - 8, -Math.PI / 2, 2, '#fff', 160); this.addShake(1.5); this.hitStop(0.02);
            }
            if (t >= 0.62) {
              p.didHit = true; p.fatT = t;
              e.vx = dirX * 120; e.vy = dirY * 120; e.z = 0.1; e.vz = 305; e.vrot = side * 22;
              this.fatalityImpact(e, 'HELICOPTER STRIKE', -Math.PI / 2);
            }
          } else {
            e.vz -= 540 * dt; e.z += e.vz * dt; e.rot += e.vrot * dt; e.x += e.vx * dt; e.y += e.vy * dt;
            if (Math.random() < 0.6) this.particle({ x: e.x, y: e.y - e.z, life: 0.3, size: 2, color: this.lvl.biome.accent, grav: 200 });
            if (e.z <= 0 && e.vz < 0) { e.z = 0; this.finishFatality(e); }
          }
        } else if (f === 'SKULL CRUSHER') {
          e.vx = e.vy = 0;
          if (!p.didHit) {
            const u = Math.min(1, t / 0.34);
            p.z = Math.sin(u * Math.PI) * 20;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d > e.r + 1) { this.move(p, dirX * 55 * dt, 0); this.move(p, 0, dirY * 55 * dt); }
            if (t >= 0.34) {
              p.didHit = true; p.fatT = t; p.z = 0; p.sqx = 1.3; p.sqy = 0.7;
              e.sqx = 2.3; e.sqy = 0.18;
              SFX.crack();
              this.fatalityImpact(e, 'SKULL CRUSHER', Math.PI / 2);
              // impact flare removed
              this.burstParticles(e.x, e.y, 14, this.lvl.biome.wallTop, 160, 3, 0.5);
            }
          } else {
            const tt = t - p.fatT;
            e.sqx = 2.3 + Math.sin(tt * 40) * 0.2; e.sqy = 0.18;
            if (tt >= 0.4) this.finishFatality(e);
          }
        } else if (f === 'STAFF JUDGMENT') {
          e.vx = e.vy = 0;
          if (!p.didHit && t >= 0.4) {
            p.didHit = true; p.fatT = t; e.sqx = 2.3; e.sqy = 0.18;
            SFX.axeHit();
            this.fatalityImpact(e, 'STAFF JUDGMENT', Math.PI / 2);
            // impact flare removed
            this.burstParticles(e.x, e.y, 14, this.lvl.biome.wallTop, 160, 3, 0.5);
          }
          if (p.didHit) { const tt = t - p.fatT; e.sqx = 2.3 + Math.sin(tt * 40) * 0.2; e.sqy = 0.18; if (tt >= 0.4) this.finishFatality(e); }
        } else if (f === 'BO CYCLONE') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t - p.fatT >= 0.14 && t < 0.62) { p.fatT = t; SFX.whoosh(); this.sparks(e.x, e.y - 6, p.facing, 2, '#fff', 160); e.flash = 0.1; e.sqx = 1.4; e.sqy = 0.6; this.addShake(1.4); this.hitStop(0.02); }
            if (t >= 0.62) {
              p.didHit = true; p.fatT = t;
              e.vx = dirX * 420; e.vy = dirY * 420; e.z = 0.1; e.vz = 130; e.vrot = side * 22;
              this.fatalityImpact(e, 'BO CYCLONE', p.facing);
            }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.85) this.finishFatality(e);
          }
        } else if (f === 'SANADA SKYFALL') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t >= 0.22) {
              p.didHit = true; p.fatT = t; p.buffered = false;
              e.vx = dirX * 30; e.vy = dirY * 30; e.z = 0.1; e.vz = 300; e.vrot = side * 9;
              this.fatalityImpact(e, 'SANADA SKYFALL', -Math.PI / 2);
            }
          } else {
            e.vz -= 540 * dt; e.z += e.vz * dt; e.rot += e.vrot * dt; e.x += e.vx * dt; e.y += e.vy * dt;
            p.z = Math.max(0, Math.min(28, e.z - 3));
            if (Math.random() < 0.5) this.particle({ x: e.x, y: e.y - e.z, life: 0.3, size: 2, color: '#ffb3b3' });
            if (!p.buffered && e.vz < 30) {
              p.buffered = true; e.vz = -330; e.vrot = side * 20; SFX.shing();
              // slash arc disabled — was covering the animation
              this.sparks(e.x, e.y - e.z, 0, 3, '#fff', 170); this.hitStop(0.06); this.addShake(5);
            }
            if (e.z <= 0 && e.vz < 0) { e.z = 0; p.z = 0; this.addShake(8); this.burstParticles(e.x, e.y, 10, this.lvl.biome.wallTop, 130, 3, 0.5); this.finishFatality(e); }
          }
        } else if (f === 'CROSS EXECUTION') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t >= 0.3) {
              p.didHit = true; p.fatT = t; p.buffered = false;
              this.fatalityImpact(e, 'CROSS EXECUTION', p.facing);
              SFX.shing();
              // slash arc disabled — was covering the animation
              const nx = e.x + dirX * (e.r + p.r + 6), ny = e.y + dirY * (e.r + p.r + 6);
              if (!this.boxSolid(nx, ny, p.r)) { this.particle({ x: p.x, y: p.y + 2, life: 0.22, kind: 'ghost', color: '#ffb3b3', data: { facing: p.facing, pose: 'attack', atk: 'SANADA CHARGE', t: 0.55 } }); p.x = nx; p.y = ny; }
            }
          } else {
            e.vx = e.vy = 0; e.z = 0; e.rot = 0;
            if (t - p.fatT >= 0.42) this.finishFatality(e);
          }
        } else if (f === 'CAMPFIRE ENDING') {
          e.vx = e.vy = 0;
          if (!p.didHit && t >= 0.36) {
            p.didHit = true; p.fatT = t; e.sqx = 2.3; e.sqy = 0.18;
            SFX.heavy(); SFX.shing();
            this.fatalityImpact(e, 'CAMPFIRE ENDING', Math.PI / 2);
            // impact flare removed
            this.burstParticles(e.x, e.y, 12, this.lvl.biome.wallTop, 150, 3, 0.5);
          }
          if (p.didHit) { const tt = t - p.fatT; e.sqx = 2.3 + Math.sin(tt * 40) * 0.2; e.sqy = 0.18; if (tt >= 0.4) this.finishFatality(e); }
        } else if (f === 'SPLIT DECISION') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t >= 0.28) {
              p.didHit = true; p.fatT = t; p.buffered = false;
              this.fatalityImpact(e, 'SPLIT DECISION', p.facing);
              SFX.shing();
              // slash arc disabled — was covering the animation
              const nx = e.x + dirX * (e.r + p.r + 6), ny = e.y + dirY * (e.r + p.r + 6);
              if (!this.boxSolid(nx, ny, p.r)) { this.particle({ x: p.x, y: p.y + 2, life: 0.22, kind: 'ghost', color: '#c02830', data: { facing: p.facing, pose: 'attack', atk: 'DEEP CUT', t: 0.55 } }); p.x = nx; p.y = ny; }
            }
          } else {
            e.vx = e.vy = 0; e.z = 0; e.rot = 0;
            if (t - p.fatT >= 0.42) this.finishFatality(e);
          }
        } else if (f === 'IAI EXECUTION') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t >= 0.3) {
              p.didHit = true; p.fatT = t; p.buffered = false;
              this.fatalityImpact(e, 'IAI EXECUTION', p.facing);
              SFX.crack();
              // slash arc disabled — was covering the animation
              const nx = e.x + dirX * (e.r + p.r + 6), ny = e.y + dirY * (e.r + p.r + 6);
              if (!this.boxSolid(nx, ny, p.r)) {
                this.particle({ x: p.x, y: p.y + 2, life: 0.22, kind: 'ghost', color: '#cfe8ff', data: { facing: p.facing, pose: 'attack', atk: 'THRUST', t: 0.55 } });
                p.x = nx; p.y = ny;
              }
            }
          } else {
            e.vx = e.vy = 0; e.z = 0; e.rot = 0;
            if (t - p.fatT >= 0.42) this.finishFatality(e);
          }
        } else if (f === 'SKY BURIAL') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t >= 0.22) {
              p.didHit = true; p.fatT = t; p.buffered = false;
              e.vx = dirX * 35; e.vy = dirY * 35; e.z = 0.1; e.vz = 305; e.vrot = side * 8;
              this.fatalityImpact(e, 'SKY BURIAL', -Math.PI / 2);
            }
          } else {
            e.vz -= 540 * dt; e.z += e.vz * dt; e.rot += e.vrot * dt; e.x += e.vx * dt; e.y += e.vy * dt;
            p.z = Math.max(0, Math.min(28, e.z - 3));
            if (Math.random() < 0.5) this.particle({ x: e.x, y: e.y - e.z, life: 0.3, size: 2, color: '#cfe8ff' });
            if (!p.buffered && e.vz < 30) {
              p.buffered = true; e.vz = -320; e.vrot = side * 20; SFX.crack();
              // slash arc disabled — was covering the animation
              this.sparks(e.x, e.y - e.z, 0, 3, '#fff', 170); this.hitStop(0.06); this.addShake(5);
            }
            if (e.z <= 0 && e.vz < 0) {
              e.z = 0; p.z = 0;

              this.finishFatality(e);
            }
          }
        } else if (f === 'THOUSAND CUTS') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t - p.fatT >= 0.11 && t < 0.6) {
              p.fatT = t; SFX.crack();
              const alt = Math.floor(t / 0.11) % 2 === 0 ? 0.85 : -0.85;
              // slash arc disabled — was covering the animation
              this.sparks(e.x, e.y - 5, p.facing + alt, 2, '#fff', 160);
              e.flash = 0.1; e.sqx = 1.3; e.sqy = 0.7; this.addShake(1.2);
            }
            if (t >= 0.6) {
              p.didHit = true; p.fatT = t;
              e.vx = dirX * 400; e.vy = dirY * 400; e.z = 0.1; e.vz = 150; e.vrot = side * 20;
              this.fatalityImpact(e, 'THOUSAND CUTS', p.facing);
            }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.85) this.finishFatality(e);
          }
        } else if (f === 'POINT BLANK') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t - p.fatT >= 0.13 && t < 0.55) {
              p.fatT = t; p.weapon === 2 ? SFX.rifle() : SFX.pistol();

              e.flash = 0.12; e.sqx = 1.45; e.sqy = 0.55; e.x += dirX * 1.5; e.y += dirY * 1.5; this.addShake(1.5); this.hitStop(0.02);
            }
            if (t >= 0.55) {
              p.didHit = true; p.fatT = t; p.recoil = 1;
              e.vx = dirX * 600; e.vy = dirY * 600; e.z = 0.1; e.vz = 65; e.vrot = side * 24;
              SFX.rifle();
              this.fatalityImpact(e, 'POINT BLANK', p.facing);
            }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 480 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (Math.random() < 0.7) this.particle({ x: e.x, y: e.y - e.z, life: 0.25, size: 2, color: '#ff3b3b', grav: 200 });
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.9) this.finishFatality(e);
          }
        } else if (f === 'CROWN CRUSHER') {
          e.vx = e.vy = 0;
          if (!p.didHit && t >= 0.34) {
            p.didHit = true; p.fatT = t; e.sqx = 2.3; e.sqy = 0.18;
            SFX.heavy();
            this.fatalityImpact(e, 'CROWN CRUSHER', Math.PI / 2);
            // impact flare removed
            this.burstParticles(e.x, e.y, 12, this.lvl.biome.wallTop, 150, 3, 0.5);
          }
          if (p.didHit) { const tt = t - p.fatT; e.sqx = 2.3 + Math.sin(tt * 40) * 0.2; e.sqy = 0.18; if (tt >= 0.4) this.finishFatality(e); }
        } else if (f === 'SPINNING ELBOW') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t - p.fatT >= 0.14 && t < 0.6) { p.fatT = t; SFX.punch(2); this.sparks(e.x, e.y - 6, p.facing, 2, '#fff', 160); e.flash = 0.1; e.sqx = 1.35; e.sqy = 0.65; this.addShake(1.2); }
            if (t >= 0.6) { p.didHit = true; p.fatT = t; e.vx = dirX * 430; e.vy = dirY * 430; e.z = 0.1; e.vz = 145; e.vrot = side * 20; this.fatalityImpact(e, 'SPINNING ELBOW', p.facing); }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.85) this.finishFatality(e);
          }
        } else if (f === 'SOUL PALM') {
          e.vx = e.vy = 0;
          if (!p.didHit && t >= 0.3) {
            p.didHit = true; p.fatT = t;
            this.fatalityImpact(e, 'SOUL PALM', p.facing);

            for (let i = 0; i < 12; i++) this.particle({ x: e.x, y: e.y - 4, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 90, life: 0.7, size: 1.6, color: '#9df0ff', kind: 'dot', fric: 0.94 });
          }
          if (p.didHit) { e.z += 26 * dt; e.sqx = 0.85; e.sqy = 1.15; if (t - p.fatT > 0.5) this.finishFatality(e); }
        } else if (f === 'TORNADO KICK') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t - p.fatT >= 0.11 && t < 0.56) { p.fatT = t; SFX.kick(); e.flash = 0.09; e.sqx = 1.35; e.sqy = 0.65; this.addShake(1); }
            if (t >= 0.56) { p.didHit = true; p.fatT = t; e.vx = dirX * 450; e.vy = dirY * 450; e.z = 0.1; e.vz = 160; e.vrot = side * 21; this.fatalityImpact(e, 'TORNADO KICK', p.facing); }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.85) this.finishFatality(e);
          }
        } else if (f === 'TIMBER FALL') {
          e.vx = e.vy = 0;
          if (!p.didHit && t >= 0.42) {
            p.didHit = true; p.fatT = t; e.sqx = 2.3; e.sqy = 0.18;
            SFX.axeHit();
            this.fatalityImpact(e, 'TIMBER FALL', Math.PI / 2);
            // impact flare removed
            this.burstParticles(e.x, e.y, 14, this.lvl.biome.wallTop, 160, 3, 0.5);
          }
          if (p.didHit) { const tt = t - p.fatT; e.sqx = 2.3 + Math.sin(tt * 40) * 0.2; e.sqy = 0.18; if (tt >= 0.4) this.finishFatality(e); }
        } else if (f === 'HOME RUN') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t >= 0.38) {
              p.didHit = true; p.fatT = t;
              e.vx = dirX * 700; e.vy = dirY * 700; e.z = 0.1; e.vz = 85; e.vrot = side * 26;
              SFX.axeHit();
              this.fatalityImpact(e, 'HOME RUN', p.facing);
            }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 480 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (Math.random() < 0.7) this.particle({ x: e.x, y: e.y - e.z, life: 0.25, size: 2, color: '#ffb060' });
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.85) this.finishFatality(e);
          }
        } else if (f === 'THOUSAND SLASHES') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t - p.fatT >= 0.12 && t < 0.62) {
              p.fatT = t;
              const k = Math.max(1, Math.floor(t / 0.12));
              const aa = p.facing + k * 2.1;
              const nx = e.x + Math.cos(aa) * (e.r + p.r + 6), ny = e.y + Math.sin(aa) * (e.r + p.r + 6);
              if (!this.boxSolid(nx, ny, p.r)) { this.particle({ x: p.x, y: p.y + 2, life: 0.2, kind: 'ghost', color: '#cfe8ff', data: { facing: p.facing, pose: 'dash' } }); p.x = nx; p.y = ny; }
              SFX.swish();
              // slash arc disabled — was covering the animation
              this.sparks(e.x, e.y - 5, p.facing, 2, '#fff', 160);
              e.flash = 0.1; e.sqx = 1.3; e.sqy = 0.7; this.addShake(1.2);
            }
            if (t >= 0.62) {
              p.didHit = true; p.fatT = t;
              e.vx = dirX * 430; e.vy = dirY * 430; e.z = 0.1; e.vz = 140; e.vrot = side * 21;
              this.fatalityImpact(e, 'THOUSAND SLASHES', p.facing);
            }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 520 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.85) this.finishFatality(e);
          }
        } else if (f === 'TWIN REAPER') {
          e.vx = e.vy = 0;
          if (!p.didHit) {
            const u = Math.min(1, t / 0.34);
            p.z = Math.sin(u * Math.PI) * 20;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d > e.r + 1) { this.move(p, dirX * 55 * dt, 0); this.move(p, 0, dirY * 55 * dt); }
            if (t >= 0.34) {
              p.didHit = true; p.fatT = t; p.z = 0; p.sqx = 1.3; p.sqy = 0.7;
              e.sqx = 2.3; e.sqy = 0.18;
              SFX.axeHit(); SFX.shing();
              this.fatalityImpact(e, 'TWIN REAPER', Math.PI / 2);
              // impact flare removed
              this.burstParticles(e.x, e.y, 12, this.lvl.biome.wallTop, 150, 3, 0.5);
            }
          } else {
            const tt = t - p.fatT;
            e.sqx = 2.3 + Math.sin(tt * 40) * 0.2; e.sqy = 0.18;
            if (tt >= 0.4) this.finishFatality(e);
          }
        } else if (f === 'GUN KATA') {
          if (!p.didHit) {
            e.vx = e.vy = 0;
            if (t - p.fatT >= 0.18 && t < 0.9) {
              p.fatT = t;
              const k = Math.max(1, Math.floor(t / 0.18));
              const aa = p.facing + k * 1.9;
              const nx = e.x + Math.cos(aa) * (e.r + p.r + 7), ny = e.y + Math.sin(aa) * (e.r + p.r + 7);
              if (!this.boxSolid(nx, ny, p.r)) {
                this.particle({ x: p.x, y: p.y + 2, life: 0.2, kind: 'ghost', color: '#ffe9a8', data: { facing: p.facing, pose: 'dash' } });
                p.x = nx; p.y = ny;
              }
              SFX.pistol();
              this.sparks(e.x, e.y - 5, Math.atan2(p.y - e.y, p.x - e.x), 3, '#ffe9a8', 180);
              e.flash = 0.12; e.sqx = 1.4; e.sqy = 0.6; this.addShake(1.2);
            }
            if (t >= 0.95) {
              p.didHit = true; p.fatT = t; p.recoil = 1;
              e.vx = dirX * 520; e.vy = dirY * 520; e.z = 0.1; e.vz = 60; e.vrot = side * 22;
              SFX.rifle();
              this.fatalityImpact(e, 'GUN KATA', p.facing);
            }
          } else if (p.state === 'takedown') {
            e.x += e.vx * dt; e.y += e.vy * dt; e.vz -= 480 * dt; e.z = Math.max(0, e.z + e.vz * dt); e.rot += e.vrot * dt;
            if (this.boxSolid(e.x + Math.sign(e.vx) * e.r, e.y + Math.sign(e.vy) * e.r, e.r * 0.8)) this.finishFatality(e, true);
            else if (t - p.fatT > 0.9) this.finishFatality(e);
          }
        }
        break;
      }
    }
    this.updateNunchaku(dt);
    if (p.state !== 'takedown') { this.move(p, p.vx * dt, 0); this.move(p, 0, p.vy * dt); }
    if (p.state !== 'dash' && p.state !== 'kick' && p.state !== 'takedown' && p.state !== 'nunrush' && p.state !== 'iaidash' && p.state !== 'axerush' && p.state !== 'bladerush' && p.state !== 'vault' && p.state !== 'lancerush' && p.state !== 'slasherdash' && p.state !== 'flurry' && p.state !== 'tkdkick' && p.z < 8) {
      for (const e of this.enemies) {
        if (e.state === 'dead' || e.state === 'teleport' || e.state === 'victim') continue;
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 0.01, min = p.r + e.r;
        if (d < min) { const push = (min - d) * 0.6; const nx = p.x + dx / d * push, ny = p.y + dy / d * push; if (!this.boxSolid(nx, ny, p.r * 0.9)) { p.x = nx; p.y = ny; } }
      }
    }
    p.x = clamp(p.x, TILE, this.lvl.w * TILE - TILE); p.y = clamp(p.y, TILE, this.lvl.h * TILE - TILE);
  }

  // guaranteed arc hit for a nunchaku swing (the physics chain adds incidental hits on top)
  doNunHit(a: Attack) {
    const p = this.player;
    // slash arc disabled
    const nunT = this.bestMeleeTarget(a.range, a.arc);
    let hitAny = false;
    if (nunT) {
      hitAny = true; nunT.nunCd = 0.22;
      this.hitEnemy(nunT, a.dmg, p.facing, a.kb, a.posture, 'nunchaku', a.heavy);
      this.sparks(nunT.x, nunT.y - 4, p.facing, 2, '#fff', 150);
    }
    for (const b of this.bullets) if (b.owner === 'e' && this.inArc(p.x, p.y, p.facing, a.range + 4, a.arc, b.x, b.y, b.r)) this.deflectBullet(b);
    if (a.name === 'WHIP CRACK') {
      SFX.crack(); this.addShake(3);
      if (hitAny) this.hitStop(0.05);
    } else if (hitAny) { this.hitStop(0.02); SFX.punch(2); }
  }
  // verlet chain physics for the nunchaku (anchor = hand, 4 chain links + free stick)
  updateNunchaku(dt: number) {
    const p = this.player;
    if (p.weapon !== 3) return;
    const N = this.nunchaku;
    if (N.pts.length !== 6) this.resetNunchaku();
    N.flourishCd -= dt; N.flourish = Math.max(0, N.flourish - dt);
    const shX = p.x, shY = p.y - 4 - p.z; // shoulder pivot
    // ---- anchor target per mode ----
    let tx: number, ty: number, rate = 1;
    if (p.state === 'nunrush' || (p.state === 'takedown' && p.weapon === 3)) {
      const oa = this.time * 26, orad = p.state === 'nunrush' ? 13 : 11;
      tx = shX + Math.cos(oa) * orad; ty = shY + Math.sin(oa) * orad; rate = 0.6;
    }
    const attacking = p.state === 'attack' && !!p.curAttack;
    if (attacking) {
      const a = p.curAttack!, u = Math.min(1, p.stateT / a.dur);
      // wind back, snap through the front, follow through (angle relative to facing)
      const sweep = (from: number, to: number, snap = 0.5) => {
        if (u < 0.18) return from - Math.sign(to - from) * 0.5 * (u / 0.18);
        const v = Math.min(1, (u - 0.18) / snap);
        const e = 1 - Math.pow(1 - v, 3);
        return from + (to - from) * e + Math.sin(v * Math.PI) * 0.12 * Math.sign(to - from);
      };
      let ang = p.facing, rad = 11;
      switch (a.name) {
        case 'NUN SWING': ang = p.facing + sweep(-2.0, 1.0); rad = 8 + 5 * u; break;
        case 'NUN CROSS': ang = p.facing + sweep(2.0, -1.0); rad = 8 + 5 * u; break;
        case 'NUN SPIN': ang = p.facing + u * TAU * 1.5; rad = 12; break;
        case 'WHIP CRACK': ang = p.facing + sweep(-2.3, 0.8, 0.34); rad = 6 + 8 * Math.min(1, Math.max(0, (u - 0.18) / 0.34)); break;
        default: ang = p.facing + sweep(-2.0, 1.0); rad = 8 + 5 * u;
      }
      tx = shX + Math.cos(ang) * rad; ty = shY + Math.sin(ang) * rad; rate = 0.7;
    } else if (p.state === 'dash' || p.state === 'kick' || p.state === 'tkdkick' || p.state === 'airkick' || p.state === 'sweep' || p.state === 'takedown') {
      tx = shX - Math.cos(p.facing) * 6; ty = shY + 3; rate = 0.3;
    } else {
      // guard drape + occasional flourish spin around the hand
      if (N.flourishCd <= 0 && N.flourish === 0 && p.state === 'idle') { N.flourish = 0.55; N.flourishCd = 1.6 + Math.random() * 1.2; }
      if (N.flourish > 0) {
        const fu = 1 - N.flourish / 0.55, ga = p.facing + fu * TAU * 2;
        tx = shX + Math.cos(ga) * 7.5; ty = shY + Math.sin(ga) * 7.5; rate = 0.45;
      } else { tx = shX + Math.cos(p.facing) * 6.5; ty = shY + 2.5 + Math.sin(p.facing) * 3; }
    }
    if (Math.hypot(N.anchor.x - tx, N.anchor.y - ty) > 46) { N.anchor.x = tx; N.anchor.y = ty; }
    const kk = 1 - Math.pow(1 - rate, dt * 60);
    N.anchor.x += (tx - N.anchor.x) * kk; N.anchor.y += (ty - N.anchor.y) * kk;
    // ---- verlet integration ----
    const rest = [2.2, 2.2, 2.2, 2.2, 7];
    const last = N.pts[5];
    N.prevEnd = { x: last.x, y: last.y };
    const sub = 3, sdt = dt / sub;
    for (let s2 = 0; s2 < sub; s2++) {
      N.pts[0].x = N.anchor.x; N.pts[0].y = N.anchor.y; N.pts[0].px = N.anchor.x; N.pts[0].py = N.anchor.y;
      for (let i = 1; i < 6; i++) {
        const q = N.pts[i];
        const damp = attacking ? 0.994 : 0.985, grav = attacking ? 6 : 55;
        const vx = (q.x - q.px) * damp, vy = (q.y - q.py) * damp;
        q.px = q.x; q.py = q.y;
        q.x += vx; q.y += vy + grav * sdt * sdt * 60;
      }
      for (let it = 0; it < 4; it++) {
        N.pts[0].x = N.anchor.x; N.pts[0].y = N.anchor.y;
        for (let i = 0; i < 5; i++) {
          const a = N.pts[i], b = N.pts[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001, diff = (d - rest[i]) / d;
          if (i === 0) { b.x -= dx * diff; b.y -= dy * diff; }
          else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
        }
      }
    }
    const end = N.pts[5];
    N.endSpeed = Math.hypot(end.x - N.prevEnd.x, end.y - N.prevEnd.y) / Math.max(dt, 0.001);
    N.trail.unshift({ x: end.x, y: end.y });
    if (N.trail.length > 8) N.trail.pop();
    // ---- incidental physics hits (spins crack into adjacent foes) ----
    if (p.state === 'attack' && p.curAttack && N.endSpeed > 150) {
      const evx = (end.x - N.prevEnd.x) / dt, evy = (end.y - N.prevEnd.y) / dt;
      const hitAng = Math.atan2(evy, evx);
      const a4 = N.pts[4];
      const segPt = (ex: number, ey: number) => {
        const dx = end.x - a4.x, dy = end.y - a4.y, L2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((ex - a4.x) * dx + (ey - a4.y) * dy) / L2));
        return Math.hypot(ex - (a4.x + dx * t), ey - (a4.y + dy * t));
      };
      const phyT = this.nearestInRadius(24);
      if (phyT && phyT.nunCd <= 0 && segPt(phyT.x, phyT.y - phyT.z * 0.4) < phyT.r + 4.5) {
        const e = phyT;
        e.nunCd = 0.18;
        this.hitEnemy(e, p.curAttack.dmg, hitAng, p.curAttack.kb, p.curAttack.posture, 'nunchaku', p.curAttack.heavy);
        this.sparks(e.x, e.y - 4, hitAng, 2, '#fff', 160);
        SFX.punch(2);
      }
    }
  }
  exitChain(blast: boolean) {
    const p = this.player;
    if (!p.chainMode) return;
    p.chainMode = false; p.chainTimer = 0;
    const hits = p.chainHits; p.chainHits = 0;
    if (blast && hits >= 6 && p.state === 'idle' && p.weapon === 0 && p.z === 0) {
      for (const e of this.enemies) if (e.state !== 'dead' && e.state !== 'victim' && e.state !== 'teleport' && Math.hypot(e.x - p.x, e.y - p.y) < 52) { p.chainFinal = true; this.startAttack(); return; }
    }
  }
  // ============================ FOCUS / RAGE BLUR-DASH ============================
  // Ported from game2's FOCUS system: a meter that fills from landing hits, a blur-dash that crosses
  // the gap in REAL time (so its own slow motion cannot stall it), a stun on arrival and one forced
  // heavy strike. game1 keeps its own economy, weapons and juice.

  /** The attack table for a weapon slot — the exact mapping startAttack() uses. */
  attackTable(w = this.player.weapon): Attack[] {
    return w === 3 ? NUNCHAKU : w === 4 ? KATANA : w === 5 ? AXE : w === 6 ? DUAL : w === 7 ? STAFF : w === 8 ? SPEAR : w === 9 ? MACHETE : COMBO;
  }
  /** Heavy finisher of whatever is in hand. Fists give DRAGON PALM — game2's FOCUS move. */
  heavyOfHand(): Attack {
    const t = this.attackTable();
    for (let i = t.length - 1; i >= 0; i--) if (t[i].heavy) return t[i];
    return t[t.length - 1];
  }
  /** Nearest enemy worth dashing at: prefers the facing arc (game2's rule), then falls back to
   *  anything slightly wider so the button is never dead. */
  nearestStrikeTarget(range: number, arc: number): Enemy | null {
    const p = this.player;
    let best: Enemy | null = null, bd = Infinity, bestAny: Enemy | null = null, bdAny = Infinity;
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport' || e.state === 'broken') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bdAny) { bdAny = d; bestAny = e; }
      const da = Math.atan2(e.y - p.y, e.x - p.x) - p.facing;
      if (d <= range && Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) <= arc / 2 && d < bd) { bd = d; best = e; }
    }
    return best ?? (bdAny <= range * 1.3 ? bestAny : null);
  }
  /** Adds FOCUS and announces once when a Focus Strike becomes affordable (game2's "RAGE READY" cue). */
  addFocus(n: number) {
    const p = this.player;
    if (!(n > 0)) return;
    const before = p.focusMeter;
    p.focusMeter = Math.min(FOCUS_MAX, p.focusMeter + n * this.mods.focusGain);
    if (before < FOCUS_COST && p.focusMeter >= FOCUS_COST && !this.focusReadySaid) {
      this.focusReadySaid = true;
      this.feedText('FOCUS READY - PRESS C', this.lvl.biome.accent);
      SFX.select();
    }
  }
  /** Shared setup for both blur-dashes. Returns false when there is nobody to dash at. */
  startBlurDash(kind: 'focus' | 'rage', range: number, arc: number, dur: number, color: string, atk: Attack): boolean {
    const p = this.player;
    const e = this.nearestStrikeTarget(range, arc);
    if (!e) return false;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    const gap = e.r + p.r + 4;
    const dash: BlurDash = {
      sx: p.x, sy: p.y, tx: e.x - Math.cos(a) * gap, ty: e.y - Math.sin(a) * gap,
      t: 0, dur, tgt: e, id: e.id, atk, kind, color,
    };
    if (kind === 'focus') p.focusDash = dash; else p.rageDash = dash;
    p.state = 'idle'; p.stateT = 0; p.chargeT = 0; p.didHit = false; p.buffered = false;
    p.vx = 0; p.vy = 0; p.z = 0; p.vz = 0; p.facing = a;
    p.iframes = Math.max(p.iframes, kind === 'rage' ? 0.35 : 0.3);
    p.sqx = 1.35; p.sqy = 0.7;
    if (e.state !== 'dead' && e.state !== 'broken' && e.state !== 'victim') { e.state = 'stun'; e.stateT = -0.6; e.burst = 0; }
    this.ring(p.x, p.y, kind === 'rage' ? 34 : 30, color, 0.3);
    return true;
  }
  /** Advances the active blur-dash in REAL time. True while the dash owns the player. */
  updateBlurDash(raw: number): boolean {
    const p = this.player;
    const d = p.focusDash ?? p.rageDash;
    if (!d) return false;
    d.t += raw / d.dur;
    const k = Math.min(1, d.t), ek = 1 - Math.pow(1 - k, 3);   // game2's ease-out cube
    const nx = lerp(d.sx, d.tx, ek), ny = lerp(d.sy, d.ty, ek);
    if (!this.boxSolid(nx, ny, p.r)) { p.x = nx; p.y = ny; }
    // afterimages: game1's ghost particle redraws the whole stick figure in the strike pose
    this.particle({ x: p.x, y: p.y, life: 0.2, kind: 'ghost', color: d.color, data: { facing: p.facing, pose: 'attack', atk: d.atk.name, t: 0.42 + k * 0.16 } });
    if (Math.random() < 0.7) this.particle({ x: p.x + (Math.random() - 0.5) * 9, y: p.y - 3, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 50, life: 0.24, size: 1.4, color: d.color, kind: 'spark', fric: 0.9 });
    if (k >= 1) {
      const tgt = d.tgt && d.tgt.state !== 'dead' && d.tgt.state !== 'victim' ? d.tgt : null;
      const a = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : p.facing;
      if (d.kind === 'focus') p.focusDash = null; else p.rageDash = null;
      p.iframes = Math.max(p.iframes, d.kind === 'rage' ? 0.35 : 0.25);
      this.startAttack(d.atk, a);
      this.hitStop(d.kind === 'rage' ? 0.07 : 0.05);
      this.addShake(d.kind === 'rage' ? 5 : 3);
      this.ring(p.x, p.y, d.kind === 'rage' ? 26 : 20, d.color, 0.3);
      if (tgt && tgt.state !== 'broken') { tgt.state = 'stun'; tgt.stateT = -0.35; }
      if (d.kind === 'rage') this.slowMo(0.22, 0.35);
    }
    return true;
  }
  /** FOCUS STRIKE (C) — game2's FOCUS: spend 100, blur-dash in, stun, land the heavy in slow motion. */
  tryFocusStrike() {
    const p = this.player;
    if (p.focusDash || p.rageDash || p.ofaActive || p.stunT > 0) return;
    if (p.state === 'takedown' || p.state === 'ragecharge' || p.state === 'ofapose') return;
    if (p.focusMeter < FOCUS_COST) { this.text(p.x, p.y - 14, 'NO FOCUS', '#5a7a80', 0.8); SFX.warn(); return; }
    if (!this.startBlurDash('focus', 130, 1.2, 0.14, this.lvl.biome.accent, this.heavyOfHand())) {
      this.text(p.x, p.y - 14, 'NO TARGET', '#5a7a80', 0.8); SFX.warn(); return;
    }
    p.focusMeter -= FOCUS_COST;
    this.focusReadySaid = p.focusMeter >= FOCUS_COST;
    this.slowMo(0.6, 0.3);                                   // game2: slow(0.6, 0.3)
    SFX.focus(); SFX.slowmo(); SFX.dash();
    this.flash = 0.25; this.flashColor = this.lvl.biome.accent;
    this.zoomT = 1.12; this.addShake(2);
    this.feedText('FOCUS STRIKE', this.lvl.biome.accent);
  }
  /** RAGE + LMB — game2's rageStrike: blur-dash to the nearest enemy and execute them. */
  startRageStrike() {
    const p = this.player;
    if (p.focusDash || p.rageDash || p.ofaActive) return;
    const h = this.heavyOfHand();
    const exec: Attack = { ...h, dmg: Math.round(h.dmg * 1.7), kb: Math.round(h.kb * 1.35), posture: h.posture + 25 };
    if (!this.startBlurDash('rage', 170, 1.3, 0.1, '#ff2a2a', exec)) { this.startAttack(); return; } // nobody near: a swing for show
    p.rage = Math.max(0, p.rage - 5);
    SFX.dash(); SFX.whoosh();
    this.slowMo(0.25, 0.3);
    this.feedText('RAGE STRIKE', '#ff2a2a');
  }
  startAttack(force?: Attack, face?: number) {
    const p = this.player;
    p.chargeT = 0;
    // OFA LOCK-ON: blink to the locked enemy if it's out of strike range
    if (p.ofaActive && p.lockTarget && p.weapon !== 1 && p.weapon !== 2) {
      const t = p.lockTarget;
      if (t.state !== 'dead' && t.state !== 'victim' && t.state !== 'teleport') {
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        if (d > 34) {
          const fa = Math.atan2(t.y - p.y, t.x - p.x);
          for (let i = 1; i <= 5; i++) { const tt = i / 6; this.particle({ x: p.x + (t.x - p.x) * tt, y: p.y + (t.y - p.y) * tt, life: 0.2, kind: 'ghost', color: '#7df9ff', data: { facing: fa, pose: 'dash' } }); }
          const nx = t.x - Math.cos(fa) * (t.r + p.r + 2), ny = t.y - Math.sin(fa) * (t.r + p.r + 2);
          if (!this.boxSolid(nx, ny, p.r)) { p.x = nx; p.y = ny; p.iframes = Math.max(p.iframes, 0.1); p.facing = fa; }
          SFX.dash();
        }
      }
    }
    const table = p.weapon === 3 ? NUNCHAKU : p.weapon === 4 ? KATANA : p.weapon === 5 ? AXE : p.weapon === 6 ? DUAL : p.weapon === 7 ? STAFF : p.weapon === 8 ? SPEAR : p.weapon === 9 ? MACHETE : COMBO;
    let a = table[p.attackIdx % table.length];
    if (p.weapon === 0 && p.chainFinal) {
      p.chainFinal = false;
      a = { name: 'FINAL HIT', dmg: 26, range: 31, arc: 2.3, dur: 0.24, lunge: 150, kb: 240, posture: 40, heavy: true };
    } else if (p.weapon === 0 && p.chainMode) {
      // auto-FINISHER when the current target is nearly dead
      let tgt: Enemy | null = null, bd = 42;
      for (const e of this.enemies) { if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tgt = e; } }
      if (tgt && tgt.hp <= tgt.maxHp * 0.2) a = { name: 'FINAL HIT', dmg: 34 + p.chainHits * 1.2, range: 31, arc: 2.3, dur: 0.24, lunge: 150, kb: 240, posture: 40, heavy: true };
      else { a = CHAIN_ATK; p.chainTimer = 0.65; }
    }
    // KATANA CHAIN VARIATIF ala Takamura/Hyun's Dojo: tiap chain di-roll — kadang 1 tebas +
    // SHEATHE FLASH, kadang 2 tebas + IAI DASH menerobos, kadang 3 tebas + THRUST penutup
    if (p.weapon === 4 && !force) {
      if (p.katPlan === 0 || p.comboTimer <= 0) { const r = Math.random(); p.katPlan = r < 0.35 ? 1 : r < 0.65 ? 2 : 3; p.katStep = 0; }
      if (p.katStep >= p.katPlan) {
        if (p.katPlan === 2) { p.katPlan = 0; p.katStep = 0; p.attackIdx = 0; this.startIaiDash(); return; }
        a = p.katPlan === 1 ? { name: 'SHEATHE FLASH', dmg: 14, range: 26, arc: 2.4, dur: 0.2, lunge: 40, kb: 120, posture: 16 } : table[4];
      } else a = table[p.katStep % 3];
    }
    if (force) a = force;
    p.state = 'attack'; p.stateT = 0; p.curAttack = { ...a, dur: a.dur / this.mods.atkSpeed }; p.didHit = false; p.buffered = false;
    p.facing = face !== undefined ? face : Math.atan2(this.mouseWorld.y - p.y, this.mouseWorld.x - p.x);
    p.sqx = 0.8; p.sqy = 1.2;
    SFX.whoosh();
  }
  // SINGLE-TARGET melee: the player focuses ONE enemy per swing.
  // Picks the enemy closest to the aim line (and nearest overall) inside the arc.
  // nearest living enemy within a plain radius (no arc) — used by dash/vault attacks
  nearestInRadius(radius: number, excludeIds: number[] = []): Enemy | null {
    const p = this.player;
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
      if (excludeIds.includes(e.id)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < radius + e.r && d < bd) { bd = d; best = e; }
    }
    return best;
  }
  bestMeleeTarget(range: number, arc: number): Enemy | null {
    const p = this.player;
    let best: Enemy | null = null, bestScore = Infinity;
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
      if (!this.inArc(p.x, p.y, p.facing, range, arc, e.x, e.y, e.r)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const off = Math.abs(angDiff(p.facing, Math.atan2(e.y - p.y, e.x - p.x)));
      const score = d * 0.6 + off * 46;   // prefer close + centered in the swing
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }
  doMeleeHit(a: Attack) {
    const p = this.player;
    if (a.name === 'SHEATHE FLASH') {
      // Takamura style: bilah melesat masuk sarung — ring putih, slow-mo sekejap, korban terhempas
      this.ring(p.x, p.y - 4, 16, '#ffffff', 0.25);
      this.slowMo(0.12, 0.25); this.hitStop(0.05); this.addShake(4);
      SFX.shing(); SFX.crack();
      const ft = this.bestMeleeTarget(a.range, a.arc);
      if (ft) { this.hitEnemy(ft, a.dmg, p.facing, a.kb, a.posture, 'melee', false); this.sparks(ft.x, ft.y - 5, p.facing, 3, '#fff', 190); }
      for (const b of this.bullets) if (b.owner === 'e' && this.inArc(p.x, p.y, p.facing, a.range + 4, a.arc, b.x, b.y, b.r)) this.deflectBullet(b);
      return;
    }
    // ===== MACHETE SPLIT CLEAVE: vertical chop that SPLITS the target =====
    if (a.name === 'SPLIT CLEAVE' && p.weapon === 9) {
      this.addShake(6); this.zoomT = 1.12; this.hitStop(0.1);
      SFX.heavy(); SFX.shing();
      this.feedText('SPLIT!', '#ff6b6b');
      // split cleave arc disabled
      // ONE victim gets bisected
      const victim = this.bestMeleeTarget(a.range, a.arc);
      if (victim) {
        victim.deathSlash = p.facing + Math.PI / 2;
        victim.deathSlashSplit = true;
        this.hitEnemy(victim, a.dmg * 1.6, p.facing, 260, a.posture, 'melee', true);
        if ((victim.state as EState) !== 'dead' && victim.hp > 0) {
          // survived: hard stagger, but only for them
          victim.state = 'stun'; victim.stateT = 0;
          victim.vx += Math.cos(p.facing) * 200; victim.vy += Math.sin(p.facing) * 200;
          this.sparks(victim.x, victim.y - 6, p.facing, 3, '#fff', 200);
          if (this.bloodMode > 0) this.spawnBlood(victim.x, victim.y - 5, p.facing, 30, true, true);
        }
      }
      // nearby fresh corpses still get bisected for style (they're already dead)
      for (const c of this.corpses) {
        if (Math.hypot(c.x - p.x, c.y - p.y) < a.range + 6) { c.slashT = 0.6; c.slashAng = p.facing + Math.PI / 2; c.vz = Math.max(c.vz, 120); c.vrot += (Math.random() - 0.5) * 16; }
      }
      if (victim) this.hitStop(0.1);
      return;
    }
    // FISTS: clean punches — NO swing motion arcs. Bladed weapons keep their slash arcs.
    if (p.weapon !== 0) {
      // slash arc disabled
      // katana edge arc disabled
    }
    // ONE enemy per swing — focused strikes, never a crowd sweep
    const target = this.bestMeleeTarget(a.range, a.arc);
    let hitAny = false;
    if (target) {
      hitAny = true;
      this.hitEnemy(target, a.dmg, p.facing, a.kb, a.posture, 'melee', a.heavy);
    }
    // deflect bullets with heavy kicks
    for (const b of this.bullets) if (b.owner === 'e' && this.inArc(p.x, p.y, p.facing, a.range + 4, a.arc, b.x, b.y, b.r)) this.deflectBullet(b);
    if (!hitAny && this.ai.punish) {
      for (const e of this.enemies) if (e.state === 'chase' && e.cunning > 0.3 && Math.hypot(e.x - p.x, e.y - p.y) < 55) { e.cd = Math.min(e.cd, 0.05); e.rage = Math.max(e.rage, 0.8); }
    }
    if (a.name === 'CHAIN' && hitAny) { p.chainHits++; if ([10, 25, 50, 100].includes(p.chainHits)) this.feedText(`CHAIN x${p.chainHits}`, '#ffd166'); }
    if (a.name === 'FINAL HIT' && hitAny) { this.slowMo(0.28); this.zoomT = 1.18; this.feedText('CHAIN FINISHER!', '#ffd166'); p.chainMode = false; p.chainHits = 0; }
    if (hitAny) {
      if (p.weapon === 4) SFX.shing(); else if (p.weapon === 5) SFX.axeHit(); else if (p.weapon === 6) SFX.swish(); else if (p.weapon === 9) SFX.shing(); else a.heavy ? SFX.heavy() : SFX.punch(p.attackIdx);
      // IMPACT FRAMES: each weapon carries its own visual pause weight (machete/axe land hardest)
      const impactW = a.name === 'CHAIN' ? 0.012 : p.weapon === 5 ? 0.105 : p.weapon === 9 ? 0.09 : p.weapon === 8 ? 0.085 : p.weapon === 7 ? 0.08 : p.weapon === 4 ? 0.07 : p.weapon === 6 ? 0.05 : a.heavy ? 0.085 : 0.035;
      this.hitStop(impactW); this.addShake(a.heavy ? 4 : 1.5);
      if (a.heavy) { this.zoomT = 1.06; if (a.name !== 'CHARGE PALM') this.feedText(a.name + '!', '#fff'); }
      if (a.name === 'CHARGE PALM') { this.addShake(5); }
      if (a.name === 'RIPOSTE') this.addShake(4);
    }
  }
  startAirKick() {
    const p = this.player;
    p.state = 'airkick'; p.stateT = 0; p.didHit = false; p.airChain = 1; p.airHitId = -1; p.vz = 150; p.sqx = 1.2; p.sqy = 0.8; SFX.whoosh();
  }
  doRiposte() {
    const p = this.player; const e = p.riposteTarget!;
    p.riposteT = 0;
    if (Math.hypot(e.x - p.x, e.y - p.y) > 120) { this.startAttack(); return; }
    p.facing = Math.atan2(e.y - p.y, e.x - p.x);
    const nx = e.x - Math.cos(p.facing) * (e.r + p.r + 2), ny = e.y - Math.sin(p.facing) * (e.r + p.r + 2);
    if (!this.boxSolid(nx, ny, p.r)) { p.x = nx; p.y = ny; }
    p.state = 'attack'; p.stateT = 0; p.didHit = false; p.buffered = false;
    p.curAttack = { name: 'RIPOSTE', dmg: 26, range: 30, arc: 2.2, dur: 0.22 / this.mods.atkSpeed, lunge: 130, kb: 320, posture: 55, heavy: true };
    p.sqx = 0.75; p.sqy = 1.3; SFX.whoosh();
    this.feedText('RIPOSTE!', '#ffd166');
  }
  startChargePalm() {
    const p = this.player;
    p.chargeT = 0; p.state = 'attack'; p.stateT = 0; p.didHit = false; p.buffered = false;
    p.curAttack = { name: 'CHARGE PALM', dmg: 30, range: 32, arc: 2.8, dur: 0.3 / this.mods.atkSpeed, lunge: 40, kb: 430, posture: 60, heavy: true };
    p.sqx = 0.7; p.sqy = 1.3; SFX.focus();
    this.feedText('CHARGE PALM!', this.lvl.biome.accent);
  }
  startJump() {
    const p = this.player;
    if (p.z !== 0) return;
    p.vz = 165; p.z = 0.01; p.sqx = 0.85; p.sqy = 1.2; SFX.jump();
    this.smoke(p.x, p.y + 2, 3, '#666');
  }
  startTkd() {
    const p = this.player;
    p.sprintHold = 0; p.sprintMem = 0;
    p.state = 'tkdkick'; p.stateT = 0; p.didHit = false; p.kickHits = []; p.iframes = Math.max(p.iframes, 0.3); p.tdkCd = 0.9;
    // ---- TARGET LOCK: if an enemy stands near the cursor, fly exactly to THEM ----
    let tx = this.mouseWorld.x, ty = this.mouseWorld.y;
    let best: Enemy | null = null, bd = 55;              // generous capture radius around the cursor
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
      const d = Math.hypot(e.x - tx, e.y - ty);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) { tx = best.x; ty = best.y; p.fkTarget = best.id; }
    const dx = tx - p.x, dy = ty - p.y;
    const md = Math.hypot(dx, dy);
    p.facing = Math.atan2(dy, dx);
    // never fly past the mouse, never a tiny hop
    p.fkRange = Math.min(165, Math.max(38, md));
    p.px0 = p.x; p.py0 = p.y;
    p.sqx = 1.2; p.sqy = 0.8; SFX.whoosh();
    p.vx = Math.cos(p.facing) * 300; p.vy = Math.sin(p.facing) * 300;
  }
  startDash() {
    this.player.chainMode = false;
    const p = this.player;
    p.state = 'dash'; p.stateT = 0; p.dashAng = p.moving ? p.moveAng : p.facing; p.dashCd = 0.55 * this.mods.dashCd; p.iframes = 0.25;
    p.sqx = 1.4; p.sqy = 0.6; SFX.dash();
    this.smoke(p.x, p.y, 4, '#666');
  }
  startParry() {
    const p = this.player;
    p.state = 'parry'; p.stateT = 0; p.parryHit = false; p.sqx = 0.9; p.sqy = 1.1;
    this.feedText('GUARD UP', '#8ab4d8');
  }
  startKick() {
    const p = this.player; if (p.focus < 1) { this.text(p.x, p.y - 14, 'NO FOCUS', '#888', 0.8); return; }
    p.focus -= 1;
    if (p.weapon !== 0) { this.startWeaponRush(); SFX.focus(); return; }
    p.state = 'kick'; p.stateT = 0; p.iframes = 0.3; p.sqx = 1.5; p.sqy = 0.6; SFX.whoosh(); SFX.focus();
  }
  // sprint / Q special per weapon: fists fly kick, others use their own rush
  startWeaponRush() {
    const p = this.player;
    if (p.weapon === 3) this.startNunRush();
    else if (p.weapon === 4) this.startIaiDash();
    else if (p.weapon === 5) this.startAxeRush();
    else if (p.weapon === 6) this.startBladeRush();
    else if (p.weapon === 7) this.startPoleVault();
    else if (p.weapon === 8) this.startLanceRush();
    else if (p.weapon === 9) this.startSlasherDash();
    else this.startTkd();
    p.tdkCd = 0.9;
  }
  startSlasherDash() {
    const p = this.player;
    p.state = 'slasherdash'; p.stateT = 0; p.didHit = false; p.kickHits = []; p.iframes = Math.max(p.iframes, 0.3);
    p.sqx = 1.3; p.sqy = 0.7; SFX.shing();
    this.feedText('SLASHER DASH!', '#c02830');
    this.smoke(p.x, p.y + 2, 4, '#889');
  }
  startPoleVault() {
    const p = this.player;
    p.state = 'vault'; p.stateT = 0; p.didHit = false; p.kickHits = []; p.iframes = Math.max(p.iframes, 0.3);
    p.sqx = 0.85; p.sqy = 1.2; SFX.jump();
    this.feedText('POLE VAULT!', '#ffd166');
  }
  startLanceRush() {
    const p = this.player;
    p.state = 'lancerush'; p.stateT = 0; p.didHit = false; p.kickHits = []; p.iframes = Math.max(p.iframes, 0.3);
    p.sqx = 1.35; p.sqy = 0.65; SFX.whoosh(); SFX.shing();
    this.feedText('SANADA LANCE RUSH!', '#ffb3b3');
    this.smoke(p.x, p.y + 2, 5, '#889');
  }
  startAxeRush() {
    const p = this.player;
    p.state = 'axerush'; p.stateT = 0; p.didHit = false; p.kickHits = []; p.iframes = Math.max(p.iframes, 0.3);
    p.sqx = 1.2; p.sqy = 0.85; SFX.axeSwing();
    this.feedText('AXE RUSH!', '#ffb060');
  }
  startBladeRush() {
    const p = this.player;
    p.state = 'bladerush'; p.stateT = 0; p.didHit = false; p.kickHits = []; p.iframes = Math.max(p.iframes, 0.3);
    p.sqx = 1.3; p.sqy = 0.7; SFX.swish();
    this.feedText('BLADE RUSH!', '#cfe8ff');
  }
  startIaiDash() {
    const p = this.player;
    p.chargeT = 0; p.state = 'iaidash'; p.stateT = 0; p.didHit = false; p.kickHits = []; p.iframes = Math.max(p.iframes, 0.3);
    p.sqx = 1.35; p.sqy = 0.65; SFX.whoosh(); SFX.crack();
    this.feedText('IAI DASH!', '#cfe8ff');
    this.smoke(p.x, p.y + 2, 5, '#889');
  }
  startNunRush() {
    const p = this.player;
    p.state = 'nunrush'; p.stateT = 0; p.didHit = false; p.kickHits = []; p.iframes = Math.max(p.iframes, 0.35); p.tdkCd = 0.9;
    p.sqx = 1.2; p.sqy = 0.85; SFX.whoosh(); SFX.crack();
    this.feedText('NUNCHAKU CYCLONE!', this.lvl.biome.accent);
  }
  startSweep() {
    const p = this.player; if (p.focus < 1) { this.text(p.x, p.y - 14, 'NO FOCUS', '#888', 0.8); return; }
    p.focus -= 1; p.state = 'sweep'; p.stateT = 0; p.didHit = false; p.iframes = 0.35; SFX.focus();
    this.feedText('LEG SWEEP', this.lvl.biome.accent);
  }
  tryTakedown() {
    const p = this.player;
    let best: Enemy | null = null, bd = 34;
    for (const e of this.enemies) if (e.state === 'broken') { const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r; if (d < bd) { bd = d; best = e; } }
    if (!best) return false;
    p.state = 'takedown'; p.stateT = 0; p.didHit = false; p.target = best; best.state = 'victim'; best.stateT = 0; best.vx = best.vy = 0;
    p.iframes = 0.6; p.z = 0; p.fatT = 0;
    const a = Math.atan2(best.y - p.y, best.x - p.x);
    const opts = p.weapon === 0 ? ['CROWN CRUSHER', 'SPINNING ELBOW', 'SOUL PALM', 'TORNADO KICK'] : p.weapon === 3 ? ['CHAIN STRANGLE', 'HELICOPTER STRIKE', 'SKULL CRUSHER'] : p.weapon === 4 ? ['IAI EXECUTION', 'SKY BURIAL', 'THOUSAND CUTS'] : p.weapon === 5 ? ['TIMBER FALL', 'HOME RUN'] : p.weapon === 6 ? ['THOUSAND SLASHES', 'TWIN REAPER'] : p.weapon === 7 ? ['STAFF JUDGMENT', 'BO CYCLONE'] : p.weapon === 8 ? ['SANADA SKYFALL', 'CROSS EXECUTION'] : p.weapon === 9 ? ['CAMPFIRE ENDING', 'SPLIT DECISION'] : (p.weapon === 1 || p.weapon === 2) ? ['POINT BLANK', 'GUN KATA'] : ['UPPERCUT', 'RUSH PUNCH', 'AXE KICK', 'PALM BLAST', 'KNEE LAUNCH', 'SUPLEX THROW', 'SPIN STRIKE', 'DRAGON TAIL'];
    let f = opts[Math.floor(Math.random() * opts.length)];
    if (f === 'RUSH PUNCH' && this.boxSolid(p.x - Math.cos(a) * 22, p.y - Math.sin(a) * 22, p.r)) f = Math.random() < 0.5 ? 'UPPERCUT' : 'AXE KICK';
    p.fatality = f;
    if (f !== 'RUSH PUNCH') { const nx = best.x - Math.cos(a) * (best.r + p.r + 3), ny = best.y - Math.sin(a) * (best.r + p.r + 3); if (!this.boxSolid(nx, ny, p.r)) { p.x = nx; p.y = ny; } }
    best.facing = a + Math.PI;
    return true;
  }
  fatalityImpact(e: Enemy, name: string, sparkAng: number) {
    this.hitStop(0.09); this.slowMo(0.1); this.addShake(9); this.zoomT = 1.3; this.flash = 0.5; this.flashColor = '#fff';
    SFX.heavy(); SFX.takedown();
    this.sparks(e.x, e.y - 6, sparkAng, 4, '#fff', 210); this.sparks(e.x, e.y - 6, sparkAng, 2, '#ff3b3b', 170);

    this.feedText(name + '!', '#ffd166');
    this.perfectText = 'FATALITY'; this.perfectT = 1.4;
    e.flash = 0.3;
  }
  finishFatality(e: Enemy, wall = false) {
    const p = this.player, m = this.mods;
    if (e.state === 'dead') { p.state = 'idle'; p.stateT = 0; p.target = null; p.z = 0; return; }
    const dmg = e.kind === 'boss' ? e.maxHp * 0.3 : 99999;
    this.hitStop(0.1); this.addShake(wall ? 14 : 10); this.flash = 0.7; this.flashColor = '#fff'; this.zoomT = 1.2;
    SFX.takedown(); if (wall) SFX.wallSlam(); else SFX.explode();
    this.sparks(e.x, e.y - 4, p.facing, 4, '#fff', 210);
    this.particle({ x: e.x, y: e.y, kind: 'shock', size: 55, life: 0.4, color: '#fff' });
    if (this.bloodMode > 0) this.spawnBlood(e.x, e.y - 4, p.facing, 26, true);
    this.heal(m.takedownHeal); this.score += 50 * this.level;
    e.hp -= dmg; e.posture = 0; e.z = 0; e.rot = 0; e.vrot = 0; e.sqx = e.sqy = 1;
    if (e.hp <= 0) this.killEnemy(e, p.facing, 300);
    else { e.state = 'knock'; e.stateT = 0; e.vx = Math.cos(p.facing) * 350; e.vy = Math.sin(p.facing) * 350; this.feedText('BOSS SURVIVES!', '#ff3b3b'); }
    p.state = 'idle'; p.stateT = 0; p.target = null; p.iframes = 0.4; p.z = 0;
    return;
  }
  shoot() {
    const p = this.player, m = this.mods;
    if (p.gunCd > 0) return;
    if (p.weapon === 1) {
      if (p.ammoP <= 0) { if (this.pressed.has('LMB')) { this.text(p.x, p.y - 14, 'EMPTY', '#888', 0.8); SFX.select(); } return; }
      p.ammoP--; p.gunCd = 0.2 / m.atkSpeed; p.recoil = 1; SFX.pistol();
      this.fire(p.facing + (Math.random() - 0.5) * 0.05, 570, 18 * m.gunDmg, 'pistol');
      this.addShake(2); p.vx -= Math.cos(p.facing) * 50; p.vy -= Math.sin(p.facing) * 50;
    } else {
      if (p.ammoR <= 0) { if (this.pressed.has('LMB')) { this.text(p.x, p.y - 14, 'EMPTY', '#888', 0.8); SFX.select(); } return; }
      p.ammoR--; p.gunCd = 0.085 / m.atkSpeed; p.recoil = 0.7; SFX.rifle();
      this.fire(p.facing + (Math.random() - 0.5) * 0.16, 710, 8 * m.gunDmg, 'rifle');
      this.addShake(1.2); p.vx -= Math.cos(p.facing) * 20; p.vy -= Math.sin(p.facing) * 20;
    }
  }
  fire(ang: number, speed: number, dmg: number, kind: Bullet['kind']) {
    const p = this.player;
    const ox = p.x + Math.cos(ang) * 8, oy = p.y + Math.sin(ang) * 8;
    this.bullets.push({ x: ox, y: oy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 2, dmg, owner: 'p', life: 1.5, deflected: false, kind });
    this.sparks(ox, oy, ang, 3, '#ffd', 120);
    this.particle({ x: ox, y: oy, kind: 'ring', size: 5, life: 0.08, color: '#fff' });
  }
  heal(n: number) { const p = this.player; const before = p.hp; p.hp = Math.min(this.mods.maxHp, p.hp + n); if (p.hp > before) { this.text(p.x, p.y - 14, `+${Math.round(p.hp - before)}`, '#6f6', 0.9); } }

  damagePlayer(dmg: number, ang: number, cause: string) {
    const p = this.player;
    if (p.iframes > 0 || p.state === 'takedown') return false;
    p.hp -= dmg; p.hurtT = 0.3; p.iframes = 0.45; this.combo = 0;
    if (!p.raging) p.rage = Math.min(100, p.rage + dmg * 0.9);
    p.vx += Math.cos(ang) * 120; p.vy += Math.sin(ang) * 120; p.sqx = 1.3; p.sqy = 0.7;
    this.addShake(7); this.hitStop(0.06); this.flash = 0.35; this.flashColor = '#ff2a2a';
    this.burstParticles(p.x, p.y, 10, '#ff3b3b', 150, 2, 0.5); SFX.hurt();
    this.text(p.x, p.y - 16, `-${Math.round(dmg)}`, '#ff3b3b', 1);
    if (p.state === 'attack' || p.state === 'parry' || p.state === 'block') { p.state = 'idle'; p.stateT = 0; }
    if (p.hp <= 0) { p.hp = 0; this.deathCause = cause; this.die(); }
    return true;
  }
  die() {
    const p = this.player;
    if (this.isEndless) this.saveEndlessBest();
    this.recordScore(false);
    this.slowMo(0.01); SFX.death(); this.addShake(12); this.flash = 1; this.flashColor = '#ff3b3b';
    this.burstParticles(p.x, p.y, 50, '#fff', 300, 3, 1);
    this.burstParticles(p.x, p.y, 40, '#ff3b3b', 200, 3, 1);
    this.setPhase('dead');
  }

  // Called when enemy attack lands against player (melee), handles parry/dodge/block
  enemyAttackPlayer(e: Enemy, dmg: number, cause: string) {
    const p = this.player;
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    if (p.z > 9) { if (Math.random() < 0.6) this.text(e.x, e.y - 16, 'MISS', '#aaa', 0.7, 0.4); return; }
    if (p.state === 'parry') { this.perfectParry(e); return; }
    if (p.state === 'dash' || (p.iframes > 0 && p.state !== 'stun')) { if (!e.perfectDodged && p.state === 'dash') { e.perfectDodged = true; this.perfectDodge(); } return; }
    if (p.state === 'block') {
      p.guard += dmg * 1.6; SFX.block(); this.sparks(p.x + Math.cos(p.facing) * 6, p.y + Math.sin(p.facing) * 6, p.facing, 6, '#ffd166'); this.addShake(2);
      p.vx += Math.cos(ang) * 90; p.vy += Math.sin(ang) * 90;
      this.damagePlayer(dmg * 0.25, ang, cause); // reduced
      if (this.mods.thorns > 0) this.hitEnemy(e, this.mods.thorns, ang, 80, 10, 'thorns');
      if (p.guard >= 100) { p.state = 'stun'; p.stateT = 0; p.stunT = 1.1; this.feedText('GUARD BROKEN', '#ff3b3b'); SFX.heavy(); this.addShake(6); }
      return;
    }
    this.damagePlayer(dmg, ang, cause);
  }
  perfectParry(e: Enemy) {
    const p = this.player;
    p.parryHit = true; p.stateT = 0.2 * this.mods.parryWindow; // end parry window
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    SFX.parry(); this.hitStop(0.1); this.slowMo(0.22); this.addShake(5); this.zoomT = 1.12; this.flash = 0.25; this.flashColor = '#fff';
    const sx = p.x + Math.cos(ang) * 9, sy = p.y + Math.sin(ang) * 9;
    this.sparks(sx, sy, ang, 14, '#fff', 260); this.ring(sx, sy, 18, '#fff', 0.25); this.ring(sx, sy, 10, this.lvl.biome.accent, 0.3);
    this.particle({ x: sx, y: sy, kind: 'shock', size: 24, life: 0.25, color: '#fff' });
    this.feedText('PERFECT PARRY', '#fff');
    p.focus = Math.min(3, p.focus + 0.5 * this.mods.focusGain); p.riposteT = 0.7; p.riposteTarget = e;
    this.addFocus(60);
    if (!p.raging) { p.rage = Math.min(100, p.rage + 12); p.ofa = Math.min(100, p.ofa + 5); }
    this.score += 25;
    this.hitEnemy(e, 4, ang, 140, e.maxPosture * (e.kind === 'boss' ? 0.3 : 0.45), 'parry');
    if (e.state !== 'dead' && e.state !== 'broken') { e.state = 'stun'; e.stateT = -0.6; e.burst = 0; }
  }
  perfectDodge() {
    const p = this.player;
    this.slowMo(0.28); SFX.slowmo(); this.feedText('PERFECT DODGE', '#fff'); this.zoomT = 1.08;
    p.focus = Math.min(3, p.focus + 0.35 * this.mods.focusGain); this.score += 15;
    this.addFocus(30);
    this.ring(p.x, p.y, 16, '#fff', 0.3);
  }

  hitEnemy(e: Enemy, dmg: number, ang: number, kb: number, posture: number, source: 'melee' | 'gun' | 'kick' | 'sweep' | 'deflect' | 'parry' | 'thorns' | 'explode' | 'slam' | 'nunchaku', heavy = false) {
    if (e.state === 'dead' || e.state === 'victim') return;
    // BOSS PARRY: the boss reads your frontal melee and counters with a 3-hit combo
    if (e.kind === 'boss' && (source === 'melee' || source === 'nunchaku' || source === 'kick') && e.parryCd <= 0 && e.state !== 'broken' && e.state !== 'stun' && e.state !== 'knock' && e.state !== 'teleport') {
      const chance = Math.min(0.45, 0.14 + this.aiTierFor() * 0.02 + e.cunning * 0.12);
      if (Math.abs(angDiff(e.facing, ang + Math.PI)) < 1.35 && Math.random() < chance) {
        e.parryCd = 1.7;
        const p = this.player;
        SFX.parry(); this.hitStop(0.06); this.addShake(4);
        this.sparks(e.x - Math.cos(ang) * 8, e.y - 8, ang + Math.PI, 4, '#fff', 210);
        this.feedText('BOSS PARRY!', '#ff5a3c');
        p.vx += Math.cos(ang + Math.PI) * 190; p.vy += Math.sin(ang + Math.PI) * 190;
        if (p.state === 'attack') { p.state = 'idle'; p.stateT = 0; }
        e.pattern = 'combo'; e.state = 'windup'; e.stateT = 0.4; e.cd = 0;
        return;
      }
    }
    // SAMURAI PARRY: katana enemies can parry frontal melee attacks, then riposte
    if (e.kind === 'samurai' && (source === 'melee' || source === 'nunchaku' || source === 'kick') && e.parryCd <= 0 && e.state !== 'broken' && e.state !== 'stun' && e.state !== 'knock' && e.state !== 'teleport') {
      const chance = Math.min(0.65, 0.28 + this.aiTierFor() * 0.04 + e.cunning * 0.22);
      if (Math.abs(angDiff(e.facing, ang + Math.PI)) < 1.3 && Math.random() < chance) {
        e.parryCd = 2.0;
        const p = this.player;
        SFX.parry(); this.hitStop(0.05); this.addShake(3);
        this.sparks(e.x - Math.cos(ang) * 6, e.y - 6, ang + Math.PI, 3, '#fff', 190);
        this.feedText('SAMURAI PARRY!', '#ffd166');
        p.vx += Math.cos(ang + Math.PI) * 170; p.vy += Math.sin(ang + Math.PI) * 170;
        if (p.state === 'attack') { p.state = 'idle'; p.stateT = 0; }
        e.state = 'windup'; e.stateT = e.def.windup - 0.16; e.cd = 0; e.pattern = '';
        return;
      }
    }
    const m = this.mods;
    if (source === 'melee') dmg *= m.dmg;
    if (source === 'kick' || source === 'sweep' || source === 'nunchaku') dmg *= m.dmg;
    // shield front block
    if (e.kind === 'shield' && (source === 'melee' || source === 'gun' || source === 'deflect') && e.state !== 'broken' && e.state !== 'stun' && Math.abs(angDiff(ang + Math.PI, e.facing)) < 1.3) {
      dmg *= 0.12; posture *= 0.35; SFX.block(); this.sparks(e.x - Math.cos(ang) * 6, e.y - Math.sin(ang) * 6, ang + Math.PI, 5, '#ffd166'); this.text(e.x, e.y - 14, 'BLOCKED', '#ffd166', 0.8);
    }
    let crit = false;
    if ((source === 'melee' || source === 'gun' || source === 'kick') && Math.random() < m.critChance) { dmg *= 2; crit = true; }
    if (e.state === 'broken') dmg *= 1.5;
    e.hp -= dmg; e.posture += posture; e.flash = 0.12; e.lastHit = this.time;
    // ---- WEAPON DISARM: heavy hits on armed enemies can knock the weapon loose ----
    // not random: needs a heavy hit AND enough force (kb) AND the enemy not already disarmed
    if (WEAPON_OF[e.kind] && !e.disarmed && heavy && e.kind !== 'boss') {
      const chance = Math.min(0.5, 0.12 + kb * 0.0004 + (e.state === 'broken' ? 0.35 : 0));
      if (Math.random() < chance) {
        e.disarmed = true;
        const da = ang + (Math.random() - 0.5) * 0.7;
        this.dropWeapon(e.x + Math.cos(ang) * 6, e.y - 4 - e.z, Math.cos(da) * (300 + kb * 0.5), Math.sin(da) * (300 + kb * 0.5) - 140, WEAPON_OF[e.kind]!);
        this.sparks(e.x, e.y - 6, da, 8, '#fff', 240);
        this.text(e.x, e.y - 22, 'DISARMED!', '#ffd166', 1.1, 0.9);
        SFX.block(); this.addShake(2); this.hitStop(0.04);
        // the enemy recoils, startled, and fights on bare-handed
        if ((e.state as EState) !== 'dead' && e.state !== 'broken') { e.state = 'stun'; e.stateT = 0; e.vx += Math.cos(ang) * 150; e.vy += Math.sin(ang) * 150; }
        this.score += 50;
      }
    }
    if (source !== 'explode' && source !== 'thorns' && dmg >= 2) this.spawnBlood(e.x - Math.cos(ang) * e.r * 0.6, e.y - 3 - e.z * 0.5, ang, dmg, heavy);
    if (source === 'melee' && [4, 6, 8, 9].includes(this.player.weapon)) e.bleed = Math.max(e.bleed, 3.5); // blade bleed
    if (!this.player.ofaActive && (source === 'melee' || source === 'kick' || source === 'nunchaku' || source === 'sweep')) this.player.ofa = Math.min(100, this.player.ofa + dmg * 0.1);
    e.sqx = 1.35; e.sqy = 0.65;
    e.react = Math.min(1, 0.45 + dmg * 0.03); e.reactAng = ang;
    const armored = (e.kind === 'brute' || e.kind === 'boss') && !heavy && source !== 'kick' && source !== 'sweep';
    const kbm = armored ? 0.3 : 1;
    // exact impact point: the enemy's rim facing the attacker, at torso height
    const hx = e.x - Math.cos(ang) * (e.r + 1);
    const hy = e.y - 6 - e.z * 0.5 - Math.sin(ang) * (e.r + 1) * 0.35;
    e.vx += Math.cos(ang) * kb * kbm; e.vy += Math.sin(ang) * kb * kbm;
    // realistic blood spray, exactly at the impact point (no star flare, no confetti)
    if (this.bloodMode > 0 && dmg >= 1) this.spawnBlood(hx, hy, ang, dmg * (crit ? 1.6 : 1), heavy);
    if (heavy) this.sparks(hx, hy, ang, 2, '#fff', 150);
    // damage numbers above enemies are hidden; hits read through sparks, blood and knockback instead
    if (source === 'melee' || source === 'kick' || source === 'sweep' || source === 'parry') {
      this.player.focus = Math.min(3, this.player.focus + (source === 'melee' ? 0.1 : 0.05) * m.focusGain);
      this.addFocus(source === 'melee' ? 7 : 4);
      if (m.lifesteal > 0 && source === 'melee') { this.player.hp = Math.min(m.maxHp, this.player.hp + m.lifesteal); }
    }
    if (source !== 'thorns' && source !== 'parry') { this.combo++; this.comboT = 3.0; this.comboPop = 1; this.maxCombo = Math.max(this.maxCombo, this.combo); if (this.combo >= 10 && this.combo % 10 === 0) this.feedText(`${this.combo} HIT COMBO!`, '#ffd166'); if (this.combo > 0 && this.combo % 25 === 0 && !this.player.raging) this.player.rage = Math.min(100, this.player.rage + 8); }
    this.score += Math.round(dmg) + this.combo;
    if (e.hp <= 0) { if (source === 'melee' && this.player.weapon === 4) e.deathSlash = ang; this.killEnemy(e, ang, kb); return; }
    // juggle: launched enemies get popped back up by melee hits
    if (e.z > 2 && (source === 'melee' || source === 'kick' || source === 'nunchaku')) {
      e.vz = Math.max(e.vz, 115); e.juggle++;
      if (e.juggle >= 2 && e.juggle % 2 === 0) this.feedText(`JUGGLE x${e.juggle}`, this.lvl.biome.accent);
    }
    if (e.posture >= e.maxPosture && e.state !== 'broken') {
      e.state = 'broken'; e.stateT = 0; e.burst = 0; e.vx *= 0.3; e.vy *= 0.3;
      SFX.focus(); this.ring(e.x, e.y, 14, '#ffd166', 0.4); this.hitStop(0.05); this.addFocus(15);
      return;
    }
    if (e.state === 'broken' || e.state === 'knock') return;
    if (!armored || heavy) {
      if (heavy && (source === 'melee' || source === 'explode') && e.kind !== 'boss') { e.state = 'knock'; e.stateT = 0; e.burst = 0; e.z = 0.1; e.vz = 40; e.vrot = (Math.cos(ang) >= 0 ? 1 : -1) * 9; }
      else { e.state = 'stun'; e.stateT = 0; e.burst = 0; }
    }
  }

  killEnemy(e: Enemy, ang: number, kb: number) {
    if (e.state === 'dead') return;
    e.state = 'dead';
    this.kills++; this.lastKill = { x: e.x, y: e.y };
    if (!this.player.ofaActive) this.player.ofa = Math.min(100, this.player.ofa + 7);
    this.score += e.def.score * this.level;
    this.streak++; this.streakT = 1.5;
    this.streakText = this.streak >= 5 ? 'MASSACRE' : this.streak === 4 ? 'QUAD KILL' : this.streak === 3 ? 'TRIPLE KILL' : this.streak === 2 ? 'DOUBLE KILL' : '';
    if (this.streakText) this.feedText(this.streakText, '#ffd166');
    if (this.streakT <= 0) this.streak = 0;
    SFX.kill(); this.addShake(e.kind === 'boss' ? 14 : 4); this.hitStop(e.kind === 'boss' ? 0.25 : 0.06);
    this.addFocus(e.kind === 'boss' ? 60 : 20);
    this.slowMo(e.kind === 'boss' ? 0.35 : 0.12, e.kind === 'boss' ? 0.25 : 0.45);   // game2's kill-confirm dip
    // RAGDOLL: the body flies, spins, bounces off walls and slides — no bursting apart
    {
      const cur = Math.hypot(e.vx, e.vy);
      let cvx: number, cvy: number;
      if (cur > 70) { cvx = e.vx * 1.05; cvy = e.vy * 1.05; }
      else { const sp = Math.min(430, 110 + kb * 0.85); cvx = Math.cos(ang) * sp; cvy = Math.sin(ang) * sp; }
      const sliced = e.deathSlash >= 0;
      if (sliced) { cvx *= 1.35; cvy *= 1.35; }
      const dirSign = (cvx !== 0 ? Math.sign(cvx) : 1);
      this.corpses.push({
        x: e.x, y: e.y, z: Math.max(0.1, e.z), vx: cvx, vy: cvy,
        vz: Math.max(e.vz, e.z > 1 ? e.vz : 125 + Math.random() * 95),
        rot: e.rot, vrot: (sliced ? 17 : 11) * dirSign * (0.7 + Math.random() * 0.6),
        kind: e.kind, elite: e.elite, r: e.r, t: 0, facing: e.facing, sqx: 1, sqy: 1, nudge: 0, weapon: WEAPON_OF[e.kind] ?? null,
        slashT: sliced ? 0.4 : 0, slashAng: sliced ? e.deathSlash : 0, split: e.deathSlashSplit,
      });
    }
    this.sparks(e.x, e.y - 4, ang, 2, '#fff', 150);

    if (WEAPON_OF[e.kind]) { const wa = ang + (Math.random() - 0.5) * 1.4; this.dropWeapon(e.x, e.y - 4, Math.cos(wa) * (130 + kb * 0.3), Math.sin(wa) * (130 + kb * 0.3) - 90, WEAPON_OF[e.kind]!); }
    if (this.bloodMode > 0) { this.spawnBlood(e.x, e.y - 4, ang, 16, true, true); this.spawnGibs(e.x, e.y - 4, e.kind); }
    // drops
    const r = Math.random();
    const dropScale = this.isEndless ? 0.45 : 1;
    if (e.kind === 'boss') { this.pickups.push({ x: e.x, y: e.y, kind: 'chest', t: 0 }); this.feedText('BOSS CHEST DROPPED!', '#ffd166'); }
    else if (e.elite) this.pickups.push({ x: e.x + 10, y: e.y, kind: 'hp', t: 0 });
    else if (r < 0.14 * dropScale) this.pickups.push({ x: e.x, y: e.y, kind: 'ammoP', t: 0 });
    else if (r < 0.28 * dropScale) this.pickups.push({ x: e.x, y: e.y, kind: 'ammoR', t: 0 });
    else if (r < 0.35 * dropScale) this.pickups.push({ x: e.x, y: e.y, kind: 'hp', t: 0 });
    if (this.isEndless) {
      const v = e.kind === 'boss' ? 25 : e.elite ? 4 : e.kind === 'brute' || e.kind === 'shield' ? 2 : 1;
      const n = e.kind === 'boss' ? 5 : e.elite ? 2 : 1;
      for (let i = 0; i < n; i++) this.pickups.push({ x: e.x + (Math.random() - 0.5) * 14, y: e.y + (Math.random() - 0.5) * 14, kind: 'xp', t: Math.random(), v: Math.ceil(v / n) });
      if (this.ai.rage) for (const o of this.enemies) if (o !== e && o.state !== 'dead' && Math.hypot(o.x - e.x, o.y - e.y) < 90) { o.rage = 3; if (Math.random() < 0.3) this.text(o.x, o.y - 14, 'RAGE!', '#ff3b3b', 0.7); }
    }
    if (e.kind === 'boss') { this.slowMo(0.55); this.zoomT = 1.3; this.flash = 1; this.flashColor = '#fff'; this.banner = { text: 'BOSS DEFEATED', sub: this.isEndless ? 'BUT THEY KEEP COMING' : 'THE PATH OPENS', t: 2.5 }; this.perfectT = 0; }
    else if (!this.isEndless && this.aliveEnemies().length === 0) { this.slowMo(0.45); this.zoomT = 1.12; }
  }

  // ============ ENEMIES ============
  updateEnemies(dt: number) {
    const p = this.player;
    const alive = this.enemies.filter((e) => e.state !== 'dead');
    // ATTACK TOKENS: only a few melee enemies may engage at once; the rest hold a ring & reposition
    const isMeleeKind = (k: EnemyKind) => k === 'thug' || k === 'shield' || k === 'brute' || k === 'ninja' || k === 'dasher' || k === 'samurai' || k === 'pipeswing' || k === 'cleaver';
    const tokenCount = this.isEndless ? Math.min(4, 2 + (this.aiTierFor() >= 5 ? 1 : 0) + (alive.length >= 16 ? 1 : 0)) : (this.level >= 100 ? 3 : 2);
    alive.filter((e) => isMeleeKind(e.kind)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).forEach((e, i) => { e.hasToken = i < tokenCount; });
    // separation
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j]; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const min = a.r + b.r + 3;
      if (d < min) {
        const push = (min - d) / 2;
        const aFly = (a.state === 'knock' || a.state === 'victim') && Math.hypot(a.vx, a.vy) > 150;
        const bFly = (b.state === 'knock' || b.state === 'victim') && Math.hypot(b.vx, b.vy) > 150;
        if (aFly) { this.hitEnemy(b, 14, Math.atan2(dy, dx), 220, 25, 'slam', true); if (a.state === 'knock') { a.vx *= 0.6; a.vy *= 0.6; } }
        else if (bFly) { this.hitEnemy(a, 14, Math.atan2(-dy, -dx), 220, 25, 'slam', true); if (b.state === 'knock') { b.vx *= 0.6; b.vy *= 0.6; } }
        if (a.state !== 'victim') { a.x -= dx / d * push; a.y -= dy / d * push; }
        if (b.state !== 'victim') { b.x += dx / d * push; b.y += dy / d * push; }
      }
    }
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      e.stateT += dt; e.cd -= dt; e.flash -= dt; e.summonCd -= dt; e.spawnT -= dt; e.reloading -= dt; e.nunCd -= dt; e.parryCd -= dt; e.react = Math.max(0, e.react - dt * 5);
      if (e.bleed > 0 && e.state !== 'victim') {
        e.bleed -= dt; e.hp -= 8 * dt; e.flash = Math.max(e.flash, 0.03);
        if (Math.random() < 0.25) this.particle({ x: e.x + (Math.random() - 0.5) * 8, y: e.y - 4 - e.z, vy: 22, life: 0.35, size: 1.6, color: '#e33' });
        if (e.hp <= 0) { this.killEnemy(e, e.facing + Math.PI, 60); continue; }
      }
      e.sqx = lerp(e.sqx, 1, dt * 10); e.sqy = lerp(e.sqy, 1, dt * 10);
      if (e.state !== 'broken' && this.time - e.lastHit > 2.5) e.posture = Math.max(0, e.posture - dt * e.maxPosture * 0.25);
      if (e.spawnT > 0) continue;
      if (e.state !== 'victim') {
        if (e.z > 0 || e.vz > 0) { e.vz -= 500 * dt; e.z = Math.max(0, e.z + e.vz * dt); if (e.z === 0 && e.vz < 0) {
          if (e.state === 'knock' && e.vz < -200) { e.z = 0.1; e.vz = -e.vz * 0.4; e.sqx = 1.45; e.sqy = 0.55; this.smoke(e.x, e.y + 2, 4, '#666'); this.addShake(1.5); SFX.block(); }
          else { e.vz = 0; e.juggle = 0; e.sqx = 1.4; e.sqy = 0.6; this.smoke(e.x, e.y + 2, 3, '#555'); }
        } }
        if (e.z > 0) e.rot += e.vrot * dt; else { e.vrot = 0; e.rot = e.state === 'knock' ? e.rot * Math.pow(0.001, dt) : 0; }
      }
      // knockback velocity + movement
      const sp = Math.hypot(e.vx, e.vy);
      const hitWall = this.move(e, e.vx * dt, 0) || this.move(e, 0, e.vy * dt);
      if (hitWall && e.state === 'knock' && sp > 140) {
        e.vx *= -0.2; e.vy *= -0.2; SFX.wallSlam(); this.addShake(6); this.hitStop(0.06);
        this.sparks(e.x, e.y, Math.atan2(-e.vy, -e.vx), 10, '#fff'); this.burstParticles(e.x, e.y, 10, this.lvl.biome.accent, 120);
        this.hitEnemy(e, 22 + this.level * 0.35, Math.atan2(e.vy, e.vx), 0, e.maxPosture * 0.6, 'slam');
        if ((e.state as EState) !== 'dead') this.feedText('WALL SLAM!', '#fff');
        if ((e.state as EState) === 'knock') { e.state = 'stun'; e.stateT = -0.5; }
      }
      const dashing = e.state === 'attack' && (e.kind === 'dasher' || (e.kind === 'boss' && e.pattern === 'slam'));
      const fric = e.state === 'victim' ? 1 : e.state === 'knock' ? 0.985 : dashing ? 0.965 : 0.82;
      e.vx *= Math.pow(fric, dt * 60); e.vy *= Math.pow(fric, dt * 60);

      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy), toP = Math.atan2(dy, dx);
      const def = e.def;
      const AI = this.ai;
      e.rage = Math.max(0, e.rage - dt); e.dodgeCd -= dt; e.retreatT -= dt;
      const rageMult = e.rage > 0 ? 1.3 : 1;
      const isMelee = e.kind === 'thug' || e.kind === 'shield' || e.kind === 'brute' || e.kind === 'ninja' || e.kind === 'samurai' || e.kind === 'pipeswing' || e.kind === 'cleaver';
      const facePlayer = () => {
        const rate = e.kind === 'brute' || e.kind === 'boss' ? 6 : e.kind === 'ninja' || e.kind === 'samurai' ? 13 : 9.5;
        const d = angDiff(toP, e.facing), mx = rate * dt;
        e.facing += Math.abs(d) < mx ? d : Math.sign(d) * mx;
      };
      // AI: sidestep incoming player bullets
      if (AI.dodge && e.dodgeCd <= 0 && e.state === 'chase' && e.cunning > 0.2) {
        for (const b of this.bullets) {
          if (b.owner !== 'p') continue;
          const bx = e.x - b.x, by = e.y - b.y, bd = Math.hypot(bx, by); if (bd > 70) continue;
          const sp = Math.hypot(b.vx, b.vy); const dot = (bx * b.vx + by * b.vy) / (sp * bd || 1);
          if (dot > 0.93) { const side = (b.vx * by - b.vy * bx) > 0 ? 1 : -1; const pa = Math.atan2(b.vy, b.vx) + side * Math.PI / 2; e.vx += Math.cos(pa) * 170; e.vy += Math.sin(pa) * 170; e.dodgeCd = 0.7; this.smoke(e.x, e.y + 2, 2, '#555'); break; }
        }
      }
      e.walking = false; // set again by walkTo() when the enemy really travels this frame
      const walkTo = (ang: number, mult = 1) => {
        // smooth turning: the body curves toward the goal instead of snapping
        const td = angDiff(ang, e.moveAng), tmax = 11 * dt;
        e.moveAng += Math.abs(td) < tmax ? td : Math.sign(td) * tmax;
        const s = e.speed * mult * rageMult;
        const ox = e.x, oy = e.y;
        const blocked = this.move(e, Math.cos(e.moveAng) * s * dt, 0) || this.move(e, 0, Math.sin(e.moveAng) * s * dt);
        if (blocked) { e.stuckT += dt; const side = e.moveAng + e.strafe * Math.PI / 2; this.move(e, Math.cos(side) * s * dt, 0); this.move(e, 0, Math.sin(side) * s * dt); if (e.stuckT > 0.8) { e.strafe *= -1; e.stuckT = 0; } }
        const movedD = Math.hypot(e.x - ox, e.y - oy);
        if (movedD > 0.1) {
          // GAME2 GAIT CADENCE (same model as the player): phase + half step length both follow the
          // real ground speed, so the planted foot never slides.
          const gs = movedD / Math.max(dt, 1e-4);
          const stepsPerSec = 3 + 2.5 * clamp(gs / 160, 0, 1);
          e.strideHalf = clamp(gs / (4 * stepsPerSec), 2.4, 5.6);
          e.walk += dt * stepsPerSec * Math.PI;
          e.walking = true;
          if (s * dt > 1.1 && Math.random() < 0.35) this.particle({ x: e.x, y: e.y + 2.5, vx: -Math.cos(e.moveAng) * 12, vy: -4, life: 0.3, size: 1.4, color: 'rgba(140,140,150,0.4)', kind: 'smoke', fric: 0.9 });
        } else e.strideHalf = 0;
      };

      switch (e.state) {
        case 'chase': {
          facePlayer();
          const canSee = dist < 220 && this.los(e.x, e.y, p.x, p.y);
          if (e.kind === 'gunner' || e.kind === 'rifleman' || e.kind === 'smg' || e.kind === 'sniper') {
            const near = e.kind === 'sniper' ? 150 : e.kind === 'smg' ? 80 : 70;
            const far = e.kind === 'sniper' ? 230 : e.kind === 'smg' ? 120 : 130;
            if (dist < near) walkTo(toP + Math.PI, 0.9);
            else if (dist > far || !canSee) walkTo(toP);
            else { walkTo(toP + e.strafe * Math.PI / 2, 0.55); if (Math.random() < dt * 0.5) e.strafe *= -1; }
            if (canSee && e.cd <= 0 && e.reloading <= 0 && dist < def.range + 20) {
              if (this.allyBlocking(e)) { e.cd = 0.35; e.strafe *= -1; }
              else {
                e.state = 'windup'; e.stateT = 0;
                if (AI.volley) for (const o of this.enemies) if (o !== e && (o.kind === 'gunner' || o.kind === 'rifleman' || o.kind === 'smg') && o.state === 'chase' && o.cd < 0.6 && o.reloading <= 0 && !this.allyBlocking(o) && Math.hypot(o.x - p.x, o.y - p.y) < o.def.range + 20 && this.los(o.x, o.y, p.x, p.y)) { o.state = 'windup'; o.stateT = Math.random() * 0.1; o.cd = 0; }
              }
            }
          } else if (e.kind === 'dasher') {
            if (dist > def.range) walkTo(toP); else { walkTo(toP + e.strafe * Math.PI / 2, 0.7); if (Math.random() < dt) e.strafe *= -1; }
            if (canSee && e.cd <= 0 && e.hasToken && dist < def.range && dist > 24) { e.state = 'windup'; e.stateT = 0; }
          } else if (e.kind === 'ninja') {
            if (dist > 70 && e.cd <= 0 && e.hasToken) { e.state = 'teleport'; e.stateT = 0; this.smoke(e.x, e.y, 8, '#aaa'); }
            else if (dist > def.range - 2) walkTo(toP);
            else if (!e.hasToken) { walkTo(toP + e.strafe * Math.PI / 2, 0.6); if (Math.random() < dt * 0.5) e.strafe *= -1; }
            else if (e.cd <= 0) { e.state = 'windup'; e.stateT = 0; }
          } else if (e.kind === 'bomber') {
            walkTo(toP, 1); if (dist < def.range) { e.state = 'windup'; e.stateT = 0; }
          } else if (e.kind === 'boss') {
            if (dist > 28) walkTo(toP, (dist > 100 ? 1.2 : 1) * (e.hp < e.maxHp * 0.4 ? 1.3 : 1));
            if (e.cd <= 0) {
              const hpF = e.hp / e.maxHp;
              const enraged = hpF < 0.4;
              const minions = this.enemies.filter((x) => x.state !== 'dead' && x.kind !== 'boss').length;
              const shooter = e.bossStyle === 'pistol' || e.bossStyle === 'rifle';
              if (hpF < 0.65 && minions < 2 && e.summonCd <= 0) e.pattern = 'summon';
              else if (shooter) {
                // gun masters: rings, spirals and bursts from range
                const r = Math.random();
                e.pattern = enraged ? (r < 0.3 ? 'spiral' : r < 0.6 ? 'ring' : r < 0.85 ? 'combo' : 'slam') : (r < 0.34 ? 'ring' : r < 0.68 ? 'combo' : 'spiral');
              } else if (dist > 62) {
                const r = Math.random();
                e.pattern = enraged ? (r < 0.3 ? 'fly' : r < 0.62 ? 'spiral' : r < 0.82 ? 'ring' : 'slam') : (r < 0.22 ? 'fly' : r < 0.6 ? 'ring' : 'slam');
              } else e.pattern = Math.random() < (enraged ? 0.7 : 0.6) ? 'combo' : 'slam';
              e.state = 'windup'; e.stateT = 0; SFX.warn();
              if (enraged && Math.random() < 0.3) this.text(e.x, e.y - 20, 'ENRAGED!', '#ff5a3c', 0.9, 0.6);
            }
          } else {
            // AI: tactical retreat when posture nearly broken
            if (AI.retreat && e.posture > e.maxPosture * 0.6 && e.cunning > 0.35 && dist < 48 && e.retreatT < -4) { e.retreatT = 1.2; this.text(e.x, e.y - 14, '...', '#888', 0.7, 0.4); }
            if (e.retreatT > 0) { walkTo(toP + Math.PI + e.strafe * 0.5, 0.95); break; }
            // spacing: token holders close to striking range, others hold a 50px ring and circle
            let goal = toP;
            const slotR = e.hasToken ? def.range + 2 : 50;
            if (isMelee && dist < 130 && dist > slotR + 3) {
              const sa = e.slotAng + this.time * 0.22;
              const tx = p.x + Math.cos(sa) * slotR, ty = p.y + Math.sin(sa) * slotR;
              if (!this.boxSolid(tx, ty, e.r)) { const gd = Math.hypot(tx - e.x, ty - e.y); if (gd > 6) goal = Math.atan2(ty - e.y, tx - e.x); }
            }
            if (dist > slotR + 3) walkTo(goal, e.rage > 0 ? 1.15 : 1);
            else if (!e.hasToken) { walkTo(toP + e.strafe * Math.PI / 2, 0.45); if (Math.random() < dt * 0.4) e.strafe *= -1; }
            if (e.kind === 'samurai' && e.hasToken && e.cd <= 0 && dist > 38 && dist < 80) { e.pattern = 'FLY'; e.state = 'windup'; e.stateT = 0; }
            else if (e.hasToken && e.cd <= 0 && dist < def.range + 4) { e.state = 'windup'; e.stateT = 0; }
          }
          break;
        }
        case 'windup': {
          if (e.kind === 'gunner' || e.kind === 'rifleman' || e.kind === 'smg' || e.kind === 'sniper' || e.kind === 'dasher') {
            const want = this.aimAt(e, e.kind === 'sniper' ? 505 : e.kind === 'smg' ? 262 : e.kind === 'rifleman' ? 238 : e.kind === 'dasher' ? 320 : 185);
            const d = angDiff(want, e.facing), mx2 = 16 * dt;
            e.facing += Math.abs(d) < mx2 ? d : Math.sign(d) * mx2;
          }
          else if (e.kind !== 'ninja' && e.kind !== 'bomber' && e.kind !== 'boss') facePlayer(); else if (e.stateT < def.windup * 0.6) facePlayer();
          if (e.kind === 'bomber') { if (Math.floor(e.stateT * 12) !== Math.floor((e.stateT - dt) * 12)) SFX.warn(); }
          let wu = (e.kind === 'boss' ? (e.pattern === 'ring' ? 0.8 : e.pattern === 'spiral' ? 0.7 : e.pattern === 'fly' ? 0.5 : e.pattern === 'summon' ? 0.5 : 0.55) : def.windup) / (e.rage > 0 ? 1.25 : 1);
          if (e.kind === 'boss' && e.hp < e.maxHp * 0.4) wu *= 0.68; // enrage: faster tells, faster strikes
          if (e.kind === 'samurai' && e.pattern === 'FLY') wu = 0.5;
          if (e.kind === 'thug' || e.kind === 'shield' || e.kind === 'brute') walkTo(toP, 0.4);
          // AI: parry bait — hold the strike briefly while the player's parry window is
          // active, but never longer than 0.12s so the attack still comes out and the
          // player's parry/block can actually catch it.
          if (AI.bait && isMelee && e.cunning > 0.4 && p.state === 'parry' && e.stateT >= wu && e.stateT < wu + 0.12) wu = e.stateT + 0.015;
          if (e.stateT >= wu) { e.state = 'attack'; e.stateT = 0; e.hitPlayer = false; e.perfectDodged = false; this.enemyAttack(e, dist, toP); }
          break;
        }
        case 'attack': {
          this.enemyAttackTick(e, dt, dist, toP);
          break;
        }
        case 'recover': { if (e.stateT >= (e.kind === 'ninja' ? 0.5 : 0.4)) { e.state = 'chase'; e.stateT = 0; } break; }
        case 'stun': { if (e.stateT >= 0.25) { e.state = 'chase'; e.stateT = 0; e.cd = Math.max(e.cd, 0.3); } break; }
        case 'broken': {
          if (Math.random() < 0.1) this.particle({ x: e.x + (Math.random() - 0.5) * 9, y: e.y - 11, vy: 26, life: 0.3, size: 1.2, color: '#9fd8ff' });
          if (e.stateT >= 3.2) { e.state = 'chase'; e.stateT = 0; e.posture = 0; e.cd = 0.4; }
          break;
        }
        case 'knock': {
          if (Math.random() < 0.35) this.particle({ x: e.x, y: e.y, life: 0.2, size: 2, color: this.lvl.biome.accent });
          if ((sp < 40 && e.z <= 0) || e.stateT > 1.4) { e.state = 'getup'; e.stateT = 0; e.rot = 0; e.z = 0; e.vx *= 0.2; e.vy *= 0.2; }
          break;
        }
        case 'getup': {
          // push-up recovery: squash low, dust off, then rise to stance
          e.vx *= 1 - 6 * dt; e.vy *= 1 - 6 * dt;
          if (Math.random() < 0.25) this.smoke(e.x + (Math.random() - 0.5) * 8, e.y + 2, 1, '#666');
          if (e.stateT >= 0.62) { e.state = 'chase'; e.stateT = 0; e.cd = Math.max(e.cd, 0.35); e.sqx = 1.15; e.sqy = 0.85; }
          break;
        }
        case 'teleport': {
          if (e.stateT >= 0.35) {
            const behind = { x: p.x - Math.cos(p.facing) * 22, y: p.y - Math.sin(p.facing) * 22 };
            let tx = behind.x, ty = behind.y;
            if (this.boxSolid(tx, ty, e.r)) { tx = p.x + Math.cos(toP + Math.PI) * 20; ty = p.y + Math.sin(toP + Math.PI) * 20; }
            if (this.boxSolid(tx, ty, e.r)) { tx = p.x; ty = p.y - 20; }
            if (!this.boxSolid(tx, ty, e.r)) { e.x = tx; e.y = ty; }
            this.smoke(e.x, e.y, 8, '#aaa'); SFX.whoosh();
            e.state = 'windup'; e.stateT = 0; e.cd = 2.5;
          }
          break;
        }
        case 'victim': break;
      }
    }
    // bomber/bullets etc. may kill; cleanup
    this.enemies = this.enemies.filter((e) => e.state !== 'dead');
  }

  enemyAttack(e: Enemy, _dist: number, toP: number) {
    const p = this.player; const def = e.def;
    const col = this.lvl.biome.enemy2;
    e.cd = def.cooldown * (0.7 + Math.random() * 0.5);
    switch (e.kind) {
      case 'pipeswing': case 'cleaver': {
        const range2 = def.range + (e.disarmed ? -6 : 10), arc2 = 2.8;
        if (!e.disarmed) this.slash(e.x + Math.cos(e.facing) * 5, e.y + Math.sin(e.facing) * 5, e.facing, range2, arc2, e.kind === 'cleaver' ? '#ff8f8f' : '#cfd6de', 0.15);
        e.kind === 'cleaver' && !e.disarmed ? SFX.shing() : SFX.punch(2);
        e.vx += Math.cos(e.facing) * 90; e.vy += Math.sin(e.facing) * 90;
        if (this.inArc(e.x, e.y, e.facing, range2, arc2, p.x, p.y, p.r)) this.enemyAttackPlayer(e, e.dmg, e.kind);
        e.state = 'recover'; e.stateT = 0;
        break;
      }
      case 'samurai': {
        if (e.pattern === 'FLY') { e.vx = Math.cos(e.facing) * 335; e.vy = Math.sin(e.facing) * 335; SFX.dash(); break; }
        const range = def.range + (e.disarmed ? -8 : 9), arc = 2.6;
        if (!e.disarmed) { this.slash(e.x + Math.cos(e.facing) * 5, e.y + Math.sin(e.facing) * 5, e.facing, range, arc, '#cfe8ff', 0.16); SFX.whoosh(); SFX.crack(); }
        else { SFX.punch(2); }
        e.vx += Math.cos(e.facing) * 110; e.vy += Math.sin(e.facing) * 110;
        if (this.inArc(e.x, e.y, e.facing, range, arc, p.x, p.y, p.r)) this.enemyAttackPlayer(e, e.dmg, 'samurai');
        e.state = 'recover'; e.stateT = 0;
        break;
      }
      case 'thug': case 'shield': case 'ninja': case 'brute': {
        const range = def.range + 8, arc = e.kind === 'brute' ? 3.2 : 2.2;
        this.slash(e.x + Math.cos(e.facing) * 5, e.y + Math.sin(e.facing) * 5, e.facing, range, arc, col, 0.15);
        if (e.kind === 'brute') { this.addShake(4); SFX.heavy(); } else SFX.whoosh();
        e.vx += Math.cos(e.facing) * (e.kind === 'ninja' ? 160 : 90); e.vy += Math.sin(e.facing) * (e.kind === 'ninja' ? 160 : 90);
        if (this.inArc(e.x, e.y, e.facing, range, arc, p.x, p.y, p.r)) this.enemyAttackPlayer(e, e.dmg, e.kind);
        e.state = 'recover'; e.stateT = 0;
        break;
      }
      case 'gunner': {
        if (this.allyBlocking(e)) { e.cd = 0.4; e.state = 'recover'; e.stateT = 0; break; }
        this.enemyBullet(e, e.facing, 185 * Math.min(1.3, this.lvl.spdMult), e.dmg);
        e.mag--; if (e.mag <= 0) { e.reloading = 1.25; e.mag = 4; e.cd = Math.max(e.cd, 1.25); }
        e.state = 'recover'; e.stateT = 0; break;
      }
      case 'rifleman': { e.burst = 3; e.burstT = 0; break; }
      case 'smg': { e.burst = 6; e.burstT = 0; break; }
      case 'sniper': {
        if (this.allyBlocking(e)) { e.cd = 0.5; e.state = 'recover'; e.stateT = 0; break; }
        this.enemyBullet(e, e.facing, 505, e.dmg);
        e.mag = 1; e.reloading = 1.8; e.cd = Math.max(e.cd, 1.8);

        e.state = 'recover'; e.stateT = 0; break;
      }
      case 'dasher': {
        e.vx = Math.cos(e.facing) * 320; e.vy = Math.sin(e.facing) * 320; SFX.dash(); break;
      }
      case 'bomber': {
        this.explode(e.x, e.y, 42, e.dmg, e); this.killEnemy(e, toP, 0); break;
      }
      case 'boss': {
        const st = e.bossStyle;
        // ===== weapon-specialist boss patterns =====
        if (st === 'fists') {
          if (e.pattern === 'combo') { e.burst = 5; e.burstT = 0; }                       // 5-hit fist flurry
          else if (e.pattern === 'slam') { e.vx = Math.cos(e.facing) * 340; e.vy = Math.sin(e.facing) * 340; SFX.dash(); }
          else if (e.pattern === 'ring') { e.vx = Math.cos(e.facing) * 300; e.vy = Math.sin(e.facing) * 300; e.burst = 3; e.burstT = 0; } // flying-kick rush
          else if (e.pattern === 'fly') { e.vx = Math.cos(e.facing) * 420; e.vy = Math.sin(e.facing) * 420; SFX.dash(); }
          else if (e.pattern === 'spiral') { e.vx = Math.cos(e.facing) * 260; e.vy = Math.sin(e.facing) * 260; e.burst = 4; e.burstT = 0; }
          break;
        }
        if (st === 'pistol') {
          if (e.pattern === 'combo') { e.burst = 4; e.burstT = 0; }                       // 4 quick shots
          else if (e.pattern === 'ring') { const n = 12, off = Math.random() * TAU; for (let i = 0; i < n; i++) this.enemyBullet(e, off + (i / n) * TAU, 165, e.dmg * 0.6, 'boss'); SFX.pistol(); e.burst = 0; e.burstT = 0; }
          else if (e.pattern === 'slam') { e.vx = Math.cos(e.facing) * 260; e.vy = Math.sin(e.facing) * 260; e.burst = 6; e.burstT = 0; } // shoot while retreating
          else if (e.pattern === 'spiral') { e.burst = 6; e.burstT = 0; }
          break;
        }
        if (st === 'rifle') {
          if (e.pattern === 'combo') { e.burst = 8; e.burstT = 0; }                       // full-auto sweep
          else if (e.pattern === 'spiral') { e.burst = 8; e.burstT = 0; }
          else if (e.pattern === 'ring') { const n = 16, off = Math.random() * TAU; for (let i = 0; i < n; i++) this.enemyBullet(e, off + (i / n) * TAU, 175, e.dmg * 0.55, 'boss'); SFX.rifle(); }
          break;
        }
        if (st === 'katana') {
          if (e.pattern === 'combo') { e.burst = 3; e.burstT = 0; }                       // 3-slash iai combo
          else if (e.pattern === 'fly') { e.vx = Math.cos(e.facing) * 470; e.vy = Math.sin(e.facing) * 470; e.burst = 1; e.burstT = 0; SFX.dash(); } // dash-slash
          else if (e.pattern === 'slam') { e.vx = Math.cos(e.facing) * 330; e.vy = Math.sin(e.facing) * 330; SFX.shing(); }
          break;
        }
        if (st === 'machete') {
          if (e.pattern === 'combo') { e.burst = 4; e.burstT = 0; }                       // wild hacking combo
          else if (e.pattern === 'slam') { e.vx = Math.cos(e.facing) * 380; e.vy = Math.sin(e.facing) * 380; SFX.axeSwing(); }
          else if (e.pattern === 'fly') { e.vx = Math.cos(e.facing) * 430; e.vy = Math.sin(e.facing) * 430; e.burst = 2; e.burstT = 0; }
          break;
        }
        if (st === 'staff') {
          if (e.pattern === 'ring') { e.burst = 2; e.burstT = 0; }                        // twirl sweep
          else if (e.pattern === 'combo') { e.burst = 4; e.burstT = 0; }
          else if (e.pattern === 'slam') { e.burst = 1; e.burstT = 0; }
          break;
        }
        if (st === 'spear') {
          if (e.pattern === 'combo') { e.burst = 3; e.burstT = 0; }
          else if (e.pattern === 'slam') { e.vx = Math.cos(e.facing) * 520; e.vy = Math.sin(e.facing) * 520; e.burst = 1; e.burstT = 0; SFX.shing(); } // lance charge
          else if (e.pattern === 'ring') { e.burst = 3; e.burstT = 0; }
          break;
        }
        if (st === 'axe') {
          if (e.pattern === 'slam') { e.vx = Math.cos(e.facing) * 320; e.vy = Math.sin(e.facing) * 320; SFX.axeSwing(); }
          else if (e.pattern === 'combo') { e.burst = 2; e.burstT = 0; }
          break;
        }
        if (st === 'dual') {
          if (e.pattern === 'combo') { e.burst = 6; e.burstT = 0; }                       // blade flurry
          else if (e.pattern === 'fly') { e.vx = Math.cos(e.facing) * 450; e.vy = Math.sin(e.facing) * 450; e.burst = 2; e.burstT = 0; }
          else if (e.pattern === 'spiral') { e.burst = 4; e.burstT = 0; }
          break;
        }
        if (st === 'nunchaku') {
          if (e.pattern === 'combo') { e.burst = 5; e.burstT = 0; }
          else if (e.pattern === 'ring') { e.burst = 3; e.burstT = 0; }
          else if (e.pattern === 'fly') { e.vx = Math.cos(e.facing) * 400; e.vy = Math.sin(e.facing) * 400; }
          break;
        }
        // ===== default boss patterns =====
        if (e.pattern === 'combo') { e.burst = 3; e.burstT = 0; }
        else if (e.pattern === 'slam') { e.vx = Math.cos(e.facing) * 300; e.vy = Math.sin(e.facing) * 300; SFX.dash(); }
        else if (e.pattern === 'ring') {
          const n = 10 + Math.floor(this.level / 15); const off = Math.random() * TAU;
          for (let i = 0; i < n; i++) this.enemyBullet(e, off + (i / n) * TAU, 138, e.dmg * 0.6, 'boss');
          SFX.enemyShot(); this.addShake(3); e.burst = e.hp / e.maxHp < 0.5 ? 1 : 0; e.burstT = 0;
        } else if (e.pattern === 'fly') { e.vx = Math.cos(e.facing) * 385; e.vy = Math.sin(e.facing) * 385; SFX.dash(); }
        else if (e.pattern === 'spiral') { e.burst = 5; e.burstT = 0; }
        else if (e.pattern === 'summon') {
          e.summonCd = 10;
          for (let i = 0; i < 2; i++) { const a = Math.random() * TAU; const nx = e.x + Math.cos(a) * 30, ny = e.y + Math.sin(a) * 30; if (!this.boxSolid(nx, ny, 5)) { this.spawnEnemy(this.level > 50 ? 'ninja' : this.level > 20 ? 'dasher' : 'thug', nx, ny); this.smoke(nx, ny, 8, '#aaa'); } }
          e.state = 'recover'; e.stateT = 0;
        }
        break;
      }
    }
  }
  enemyAttackTick(e: Enemy, dt: number, dist: number, toP: number) {
    const p = this.player;
    switch (e.kind) {
      case 'rifleman': case 'smg': {
        e.burstT -= dt;
        if (e.burst > 0 && e.burstT <= 0) {
          e.burst--; e.mag--;
          e.burstT = e.kind === 'smg' ? 0.07 : 0.11;
          this.enemyBullet(e, e.facing + (Math.random() - 0.5) * (e.kind === 'smg' ? 0.3 : 0.15), e.kind === 'smg' ? 262 : 238, e.dmg);
          if (e.mag <= 0) { e.burst = 0; e.reloading = e.kind === 'smg' ? 1.3 : 1.4; e.mag = e.kind === 'smg' ? 12 : 6; e.cd = Math.max(e.cd, e.reloading); }
        }
        if (e.burst <= 0 && e.burstT <= 0) { e.state = 'recover'; e.stateT = 0; }
        break;
      }
      case 'dasher': {
        e.z = Math.sin(Math.min(1, e.stateT / 0.3) * Math.PI) * 9; // flying kick arc
        if (!e.hitPlayer && dist < e.r + p.r + 3) { e.hitPlayer = true; this.enemyAttackPlayer(e, e.dmg, 'dasher'); }
        if (e.stateT > 0.3) { e.state = 'recover'; e.stateT = 0; e.z = 0; }
        break;
      }
      case 'samurai': {
        if (e.pattern === 'FLY') {
          e.z = Math.sin(Math.min(1, e.stateT / 0.34) * Math.PI) * 11;
          if (Math.random() < 0.7) this.particle({ x: e.x, y: e.y + 2 - e.z, life: 0.18, kind: 'ghost', color: this.lvl.biome.enemy2, data: { facing: e.facing, pose: 'sidekick' } });
          if (!e.hitPlayer && dist < e.r + p.r + 4) { e.hitPlayer = true; this.enemyAttackPlayer(e, e.dmg, 'samurai'); this.addShake(3); }
          if (e.stateT > 0.34) { e.state = 'recover'; e.stateT = 0; e.z = 0; e.pattern = ''; this.smoke(e.x, e.y + 2, 3, '#666'); }
        } else { e.state = 'recover'; e.stateT = 0; }
        break;
      }
      case 'boss': {
        // weapon-specific melee cadence: fists rapid, machete wild & heavy, katana fast+precise
        const meleeTune: Record<string, [number, number, number, number]> = {
          //          interval  range  arc     sound
          fists:     [0.15, 30, 2.4, 0],
          pistol:    [0.24, 30, 2.4, 0],
          rifle:     [0.24, 30, 2.4, 0],
          katana:    [0.16, 42, 2.8, 1],
          machete:   [0.24, 38, 3.2, 2],
          staff:     [0.14, 40, 3.4, 0],
          spear:     [0.2, 50, 1.6, 0],
          axe:       [0.36, 38, 2.6, 3],
          dual:      [0.1, 32, 3.0, 0],
          nunchaku:  [0.13, 30, 3.2, 0],
        };
        const mt = meleeTune[e.bossStyle] ?? [0.22, 36, 2.6, 0];
        const MELEE_SOUND = [null, 'shing', 'axeSwing', 'heavy'] as const;
        if (e.pattern === 'combo') {
          e.burstT -= dt;
          if (e.burst > 0 && e.burstT <= 0) {
            e.burst--; e.burstT = mt[0]; e.facing = toP; e.perfectDodged = false;
            const range = mt[1], arc = mt[2];
            this.slash(e.x + Math.cos(e.facing) * 8, e.y + Math.sin(e.facing) * 8, e.facing, range, arc,
              e.bossStyle === 'machete' ? '#ffd0b0' : e.bossStyle === 'katana' ? '#cfe8ff' : this.lvl.biome.enemy2,
              e.bossStyle === 'machete' ? 0.22 : 0.18);
            // each master uses their own weapon sound + swing feel
            if (MELEE_SOUND[mt[3]] === 'shing') SFX.shing();
            else if (MELEE_SOUND[mt[3]] === 'axeSwing') { SFX.axeSwing(); this.addShake(2); }
            else if (MELEE_SOUND[mt[3]] === 'heavy') SFX.heavy();
            else SFX.punch(2);
            this.addShake(2);
            e.vx += Math.cos(e.facing) * 130; e.vy += Math.sin(e.facing) * 130;
            if (this.inArc(e.x, e.y, e.facing, range, arc, p.x, p.y, p.r)) this.enemyAttackPlayer(e, e.dmg, 'boss');
          }
          if (e.burst <= 0 && e.burstT <= 0) { e.state = 'recover'; e.stateT = 0; }
        } else if (e.pattern === 'slam') {
          if (!e.hitPlayer && dist < e.r + p.r + 4) { e.hitPlayer = true; this.enemyAttackPlayer(e, e.dmg * 0.7, 'boss'); }
          if (e.stateT > 0.32) {
            // ground slam AoE
            this.addShake(8); SFX.wallSlam(); this.ring(e.x, e.y, 44, this.lvl.biome.enemy2, 0.4); this.particle({ x: e.x, y: e.y, kind: 'shock', size: 46, life: 0.35, color: '#fff' });
            this.burstParticles(e.x, e.y, 16, this.lvl.biome.wallTop, 150, 3);
            if (dist < 46 + p.r) this.enemyAttackPlayer(e, e.dmg * 1.2, 'boss');
            e.state = 'recover'; e.stateT = 0; e.vx = e.vy = 0;
          }
        } else if (e.pattern === 'fly') {
          e.z = Math.sin(Math.min(1, e.stateT / 0.34) * Math.PI) * 13;
          if (Math.random() < 0.8) this.particle({ x: e.x, y: e.y + 2 - e.z, life: 0.2, kind: 'ghost', color: this.lvl.biome.enemy2, data: { facing: e.facing, pose: 'sidekick' } });
          if (!e.hitPlayer && dist < e.r + p.r + 5) { e.hitPlayer = true; this.enemyAttackPlayer(e, e.dmg * 1.1, 'boss'); }
          if (e.stateT > 0.34) { e.state = 'recover'; e.stateT = 0; e.z = 0; this.smoke(e.x, e.y + 2, 4, '#666'); this.addShake(2); }
        } else if (e.pattern === 'spiral') {
          e.burstT -= dt;
          if (e.burst > 0 && e.burstT <= 0) {
            e.burst--; e.burstT = 0.13;
            const base = e.facing + (5 - e.burst) * 0.85;
            for (let k = 0; k < 4; k++) this.enemyBullet(e, base + k * Math.PI / 2, 142, e.dmg * 0.55, 'boss');
            SFX.enemyShot();
          }
          if (e.burst <= 0 && e.burstT <= 0) { e.state = 'recover'; e.stateT = 0; }
        } else if (e.pattern === 'ring') {
          e.burstT += dt;
          if (e.burst > 0 && e.burstT > 0.45) { e.burst--; const n = 12; const off = Math.random() * TAU; for (let i = 0; i < n; i++) this.enemyBullet(e, off + (i / n) * TAU, 142, e.dmg * 0.6, 'boss'); SFX.enemyShot(); }
          if (e.stateT > 0.6) { e.state = 'recover'; e.stateT = 0; }
        } else { e.state = 'recover'; e.stateT = 0; }
        break;
      }
      default: { e.state = 'recover'; e.stateT = 0; }
    }
  }
  enemyBullet(e: Enemy, ang: number, speed: number, dmg: number, kind: Bullet['kind'] = 'enemy') {
    const ox = e.x + Math.cos(ang) * (e.r + 3), oy = e.y + Math.sin(ang) * (e.r + 3);
    this.bullets.push({ x: ox, y: oy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: 2.5, dmg, owner: 'e', life: 4, deflected: false, kind });
    if (kind !== 'boss') SFX.enemyShot();
    this.sparks(ox, oy, ang, 3, this.lvl.biome.enemy2, 100);
  }
  explode(x: number, y: number, radius: number, dmg: number, src: Enemy | null) {
    SFX.explode(); this.addShake(10); this.hitStop(0.08); this.flash = 0.4; this.flashColor = '#ff7a1a';
    this.ring(x, y, radius, '#ff7a1a', 0.4); this.ring(x, y, radius * 0.6, '#fff', 0.3); this.particle({ x, y, kind: 'shock', size: radius, life: 0.4, color: '#ffb060' });
    this.burstParticles(x, y, 30, '#ff7a1a', 220, 3, 0.6); this.smoke(x, y, 12, '#444');
    const p = this.player;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius + p.r) { if (p.state === 'dash' || p.iframes > 0 || p.z > 12) this.perfectDodge(); else { const ang = Math.atan2(p.y - y, p.x - x); this.damagePlayer(p.state === 'block' ? dmg * 0.4 : dmg, ang, 'bomber'); } }
    for (const e of this.enemies) { if (e === src || e.state === 'dead') continue; const dd = Math.hypot(e.x - x, e.y - y); if (dd < radius + e.r) this.hitEnemy(e, dmg * 0.8, Math.atan2(e.y - y, e.x - x), 250, 40, 'explode', true); }
  }

  // ============ BULLETS ============
  deflectBullet(b: Bullet) {
    if (b.owner !== 'e') return;
    b.owner = 'p'; b.deflected = true; b.dmg = b.dmg * 2 * this.mods.deflectDmg; b.life = 2;
    // aim at nearest enemy
    let best: Enemy | null = null, bd = 1e9;
    for (const e of this.enemies) if (e.state !== 'dead') { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; best = e; } }
    const ang = best ? Math.atan2(best.y - b.y, best.x - b.x) : this.player.facing;
    const sp = Math.hypot(b.vx, b.vy) * 2.2;
    b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
    SFX.parry(); this.sparks(b.x, b.y, ang, 8, '#fff', 200); this.ring(b.x, b.y, 8, '#fff', 0.2); this.hitStop(0.04);
    this.player.focus = Math.min(3, this.player.focus + 0.2 * this.mods.focusGain);
    this.addFocus(25);
    this.score += 10;
  }
  updateBullets(dt: number) {
    const p = this.player;
    for (const b of this.bullets) {
      b.life -= dt;
      const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 3);
      for (let s = 0; s < steps && b.life > 0; s++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (this.solid(b.x, b.y)) { b.life = 0; this.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx), 4, b.owner === 'p' ? '#ffd' : this.lvl.biome.enemy2, 100); break; }
        if (b.owner === 'e') {
          const d = Math.hypot(p.x - b.x, p.y - b.y);
          if (p.z > 7) { /* bullet passes under the jump */ }
          else if (d < p.r + b.r + 1) {
            if (p.state === 'parry') { this.deflectBullet(b); p.stateT = 0; this.feedText('DEFLECT', '#fff'); this.slowMo(0.08); break; }
            if (p.state === 'dash' || p.iframes > 0) continue;
            if (p.state === 'block' && Math.abs(angDiff(Math.atan2(b.y - p.y, b.x - p.x), p.facing)) < 1.5) { b.life = 0; p.guard += b.dmg * 1.4; SFX.block(); this.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx), 5, '#ffd166'); if (p.guard >= 100) { p.state = 'stun'; p.stateT = 0; p.stunT = 1.1; this.feedText('GUARD BROKEN', '#ff3b3b'); } break; }
            b.life = 0; this.damagePlayer(b.dmg, Math.atan2(b.vy, b.vx), 'bullet'); break;
          }
        } else {
          for (const e of this.enemies) {
            if (e.state === 'dead' || e.state === 'teleport' || e.state === 'victim' || e.spawnT > 0) continue;
            if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r + 1) {
              if (e.kind === 'samurai' && e.parryCd <= 0 && Math.random() < 0.55) {
                b.life = 0; e.parryCd = 0.9; SFX.parry();
                this.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx), 8, '#cfe8ff', 200); this.text(e.x, e.y - 16, 'DEFLECT', '#cfe8ff', 0.7, 0.4);
                break;
              }
              b.life = 0;
              const ang = Math.atan2(b.vy, b.vx);
              this.hitEnemy(e, b.dmg, ang, b.deflected ? 200 : 40, b.deflected ? 30 : 5, b.deflected ? 'deflect' : 'gun', b.deflected);
              if (b.deflected) { this.hitStop(0.05); this.addShake(3); }
              break;
            }
          }
        }
      }
      if (b.kind === 'boss' && Math.random() < 0.3) this.particle({ x: b.x, y: b.y, life: 0.2, size: 1.5, color: this.lvl.biome.enemy2 });
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  // ============ PICKUPS / PARTICLES ============
  openChest(x: number, y: number) {
    const p = this.player;
    SFX.levelUp(); SFX.portal(); this.addShake(3);
    this.ring(x, y, 26, '#ffd166', 0.45); this.ring(x, y, 14, '#fff', 0.3);
    this.particle({ x, y, kind: 'shock', size: 26, life: 0.3, color: '#ffd166' });
    this.burstParticles(x, y, 22, '#ffd166', 190, 2.2, 0.6);
    this.feedText('CHEST OPENED!', '#ffd166');
    // showers of supplies around the chest
    this.pickups.push({ x: x + 14, y, kind: 'hp', t: 0 });
    this.pickups.push({ x: x - 14, y, kind: 'ammoP', t: 0 });
    this.pickups.push({ x, y: y + 12, kind: 'ammoR', t: 0 });
    this.pickups.push({ x, y: y - 12, kind: 'hp', t: 0 });
    if (this.isEndless) for (let i = 0; i < 3; i++) this.pickups.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, kind: 'xp', t: 0, v: 5 });
    this.score += 250;
    void p;
    // ...and one free technique of your choice
    this.chestReward = true;
    this.offerUpgrades();
    this.setPhase('upgrade');
  }
  updatePickups(dt: number) {
    const p = this.player, m = this.mods;
    for (const pk of this.pickups) {
      pk.t += dt;
      const d = Math.hypot(p.x - pk.x, p.y - pk.y);
      if (pk.kind === 'chest') {
        if (d < 13 && pk.t > 0.3) { pk.t = -1; this.openChest(pk.x, pk.y); }
        continue;
      }
      const pr = (pk.kind === 'xp' ? 48 : 40) * m.pickupRange;
      if (d < pr && d > 1) { const sp = pk.kind === 'xp' ? 160 + (pr - d) * 3 : 90; pk.x += (p.x - pk.x) / d * sp * dt; pk.y += (p.y - pk.y) / d * sp * dt; }
      if (d < 9) {
        pk.t = -1;
        if (pk.kind === 'xp') { this.gainXp(pk.v ?? 1); this.particle({ x: p.x, y: p.y - 6, vy: -30, life: 0.3, size: 2, color: this.lvl.biome.accent }); continue; }
        if (pk.kind === 'ammoP') { p.ammoP = Math.min(99, p.ammoP + Math.round(10 * m.ammoMult)); this.text(p.x, p.y - 14, `+PISTOL AMMO`, '#ffd166', 0.8); SFX.pickup(); }
        else if (pk.kind === 'ammoR') { p.ammoR = Math.min(240, p.ammoR + Math.round(25 * m.ammoMult)); this.text(p.x, p.y - 14, `+RIFLE AMMO`, '#ffd166', 0.8); SFX.pickup(); }
        else { this.heal(25); SFX.heal(); }
        this.ring(p.x, p.y, 10, '#fff', 0.2);
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.t >= 0);
  }
  updateParticles(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.grav * dt;
      const f = Math.pow(q.fric, dt * 60); q.vx *= f; q.vy *= f;
      // fast droplets stamp tiny splatter along their flight path (COMBINED mode)
      if (this.bloodMode === 2 && q.data?.blood && !q.data?.gib && Math.hypot(q.vx, q.vy) > 110 && Math.random() < 0.17) this.stampBlood(q.x, q.y, 0.8 + Math.random() * 1.1);
    }
    if (this.bloodMode === 2) for (const q of this.particles) if (q.life <= 0 && q.data?.blood) this.stampBlood(q.x, q.y, q.data.gib ? 3.2 + Math.random() * 1.6 : 1 + q.size * 0.45);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  // ============ LEVEL FLOW ============
  completeLevel() {
    SFX.levelUp(); this.score += 100 * this.level;
    if (this.level >= MAX_LEVEL) { this.recordScore(true); this.setPhase('win'); return; }
    this.transT = 0; this.transNext = this.level + 1; this.transDone = false;
    this.setPhase('transition');
  }
  updateTransition(rdt: number) {
    // FAST LEVEL: holding L accelerates the transition
    if (this.pressed.has('KeyL')) this.transT += rdt * 3.5;
    this.transT += rdt;
    if (!this.transDone && this.transT >= 0.5) {
      this.transDone = true;
      // between levels: offer upgrades every 2 levels
      if (this.level % 2 === 0) {
        this.offerUpgrades(); this.loadLevel(this.transNext);
        // FAST LEVEL: holding L auto-picks a random upgrade and keeps moving
        if (this.fastLevel && this.upgradeChoices.length) {
          this.pickUpgrade(this.upgradeChoices[Math.floor(Math.random() * this.upgradeChoices.length)]);
          return;
        }
        this.setPhase('upgrade'); return;
      }
      this.loadLevel(this.transNext);
    }
    if (this.transT >= 1.0) this.setPhase('playing');
  }
  offerUpgrades() {
    const pool = [...UPGRADES];
    const picks: Upgrade[] = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.upgradeChoices = picks;
  }
  pickUpgrade(u: Upgrade) {
    if (this.chestReward) {
      this.chestReward = false;
      const before0 = this.mods.maxHp;
      u.apply(this.mods); this.pickedUpgrades.push(u.id);
      if (this.mods.maxHp > before0) this.player.hp += this.mods.maxHp - before0;
      SFX.levelUp(); this.pressed.clear(); this.keys.clear(); this.mouse.down = false; this.mouse.rdown = false; this.player.iframes = 0.8;
      this.setPhase('playing');
      this.notify();
      return;
    }
    const before = this.mods.maxHp;
    u.apply(this.mods); this.pickedUpgrades.push(u.id);
    if (this.mods.maxHp > before) this.player.hp += this.mods.maxHp - before;
    if (this.isEndless) { SFX.levelUp(); this.pressed.clear(); this.keys.clear(); this.mouse.down = false; this.mouse.rdown = false; this.player.iframes = 0.6; this.setPhase('playing'); return; }
    localStorage.setItem('kf_mods', JSON.stringify(this.mods)); localStorage.setItem('kf_upg', JSON.stringify(this.pickedUpgrades));
    SFX.levelUp(); this.transT = 0.5; this.transDone = true; this.fastLevel = this.keys.has('KeyL'); this.setPhase('transition');
  }
  resume() { this.pressed.clear(); this.keys.clear(); this.mouse.down = false; this.mouse.rdown = false; this.setPhase('playing'); }
}

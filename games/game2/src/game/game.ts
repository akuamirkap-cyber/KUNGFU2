import { Sfx } from './audio';
import { LEVELS_PER_ZONE, PLAYER_BAND, PLAYER_COLOR, TILE, TOTAL_LEVELS, VIEW_H, VIEW_W, ZONES, type Palette } from './constants';
import { buildLevelCanvas, drawHUD, drawShadow, drawStick, drawVignette } from './draw';
import { solvePose } from './stick';
import { Nunchaku } from './nunchaku';
import { Katana } from './katana';
import { Blood, type BloodMode } from './blood';
import { AXE_LEN, DUAL_LEN, drawAxe, drawAxeIcon, drawDualIcon, drawShortBlade } from './weapons';
import { bossForLevel, makeEnemy, pickKind, updateEnemy } from './enemies';
import { Input } from './input';
import { flowField, freeAt, generateArena, generateLevel, lineOfSight, moveWithCollision, solidAt, unstick, type Level } from './level';
import { MOVES, type Move } from './moves';
import { MUTATIONS, rollMutations, type Mutation } from './mutations';
import { Particles, Texts } from './particles';
import { pcircle, pfont, pfontO, pline, prect, pring, px } from './pixel';
import { Rng, angleDiff, clamp, dist, lerp, rnd } from './rng';
import {
  defaultStats, type Afterimage, type Bullet, type BossKind, type Corpse, type Enemy, type EnemyKind, type Fatality, type FatalityKind,
  type GameState, type Hazard, type Pickup, type Player, type PlayerStats, type Pose, type Prop, type Vec, type WeaponKind,
} from './types';

export interface SaveData { level: number; mutations: string[]; score: number; }
export interface UIState {
  state: GameState; level: number; zoneName: string; zoneSub: string; score: number; age: number; deathCounter: number;
  deaths: number; kills: number; bestCombo: number; choices: Mutation[]; save: SaveData | null; best: { level: number; score: number };
  muted: boolean; mutations: string[]; ageGain: number; hp: number; maxHp: number; accent: string;
  mode: GameMode; wave: number; survivalTime: number; bestWave: number; bestSurvivalScore: number; blood: BloodMode;
}
export type GameMode = 'story' | 'survival';

const SAVE_KEY = 'kungfu_drifter_save_v1';
const SURV_KEY = 'kungfu_drifter_survival_v1';
const BLOOD_KEY = 'kungfu_drifter_blood_v1';
const BEST_KEY = 'kungfu_drifter_best_v1';
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

function makePlayer(): Player {
  return {
    x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, r: 5, hp: 5, maxHp: 5, dead: false, flash: 0, facing: 1, aim: 0, walk: 0, moving: false,
    dashT: 0, dashCd: 0, dashDir: { x: 1, y: 0 }, iframes: 0, comboStr: '', comboTimer: 0, attackT: 0, attackPhase: 'none', moveKey: null,
    hitSet: [], buffered: null, parryT: 0, parryCd: 0, parryHit: false, focus: 100, weapon: 'fist', hasRifle: false, ammoP: 30, ammoR: 0,
    fireCd: 0, recoil: 0, lean: { x: 1, y: 0 }, stunT: 0, lastMoveName: '', focusDash: null, shootT: 0, attackElapsed: 0, sinceDash: 9, attackAim: 0,
    z: 0, runT: 0, running: false, bloom: 0, muzzle: 0, muzzleMax: 0.06, muzzleX: 0, muzzleY: 0, muzzleA: 0, fatality: null, holdPose: 'idle', holdPoseT: 0, holdT: 0,
    dustT: 0, stepT: 0, travelHit: false,
    hitTimes: {}, prevLimb: null, hasNunchaku: false, hasKatana: false, hasAxe: false, hasDual: false, bladeA: 0, bladeB: 0, bladePrevA: 0, chain: 0, chainLast: -9, chainSide: 1, rage: 0, rageOn: false, rageT: 0, rageDash: null, rageKills: 0, rhythm: [], style: 'none', styleStreak: 0, styleHeat: 0, flowStep: 0, sheatheT: 0, iaiVictims: [], strideHalf: 3, bodyAim: 0, vz: 0, jumpT: 0, jumpCd: 0, landT: 0, airborne: false, squash: 1, prevPose: 'idle', prevPoseT: 0, blend: 0, lastDir: { x: 1, y: 0 }, tkdCd: 0, tkdT: 0, tkdDir: { x: 1, y: 0 },
  };
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scene: HTMLCanvasElement;
  wctx: CanvasRenderingContext2D;
  input: Input;
  sfx = new Sfx();
  particles = new Particles();
  texts = new Texts();
  state: GameState = 'menu';
  level!: Level;
  levelCanvas!: HTMLCanvasElement;
  levelCtx!: CanvasRenderingContext2D;
  levelN = 1;
  pal: Palette = ZONES[0].pal;
  player: Player = makePlayer();
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  props: Prop[] = [];
  corpses: Corpse[] = [];
  hazards: Hazard[] = [];
  afterimages: Afterimage[] = [];
  pendingBooms: { x: number; y: number; t: number; r: number; dmg: number; fromPlayer: boolean }[] = [];
  pools: { x: number; y: number; r: number; max: number; c: string }[] = [];
  fatTargetId = -1;
  flow: Int16Array = new Int16Array(0);
  flowT = 0;
  cam = { x: 0, y: 0 };
  camKick = { x: 0, y: 0 };
  camFocus: Vec | null = null;
  zoom = 1;
  zoomTarget = 1;
  zoomKick = 0;
  cinematic = false;
  trauma = 0;
  shakeX = 0;
  shakeY = 0;
  hitstop = 0;
  timeScale = 1;
  slowT = 0;
  slowFactor = 1;
  flashA = 0;
  flashC = '#ffffff';
  time = 0;
  rawDt = 0;
  levelTime = 0;
  bannerT = 0;
  spawnQueue: EnemyKind[] = [];
  spawnTimer = 0;
  maxAlive = 4;
  eliteChance = 0;
  exitOpen = false;
  portalT = 0;
  cleared = false;
  wipe: { t: number; dir: 1 | -1; cb: (() => void) | null } | null = null;
  stats: PlayerStats = defaultStats();
  mutations: string[] = [];
  score = 0;
  kills = 0;
  combo = 0;
  comboTimer = 0;
  comboMax = 2.2;
  comboPop = 0;
  bestCombo = 0;
  meleeHits = 0;
  age = 20;
  deathCounter = 1;
  deaths = 0;
  ageGain = 0;
  choices: Mutation[] = [];
  nextLevelN = 1;
  onUI: ((u: UIState) => void) | null = null;
  rng = new Rng(1);
  running = false;
  raf = 0;
  lastT = 0;
  vignette = { cv: null as HTMLCanvasElement | null };
  save: SaveData | null = null;
  best = { level: 0, score: 0 };
  deathT = 0;
  bossBeatenT = 0;
  hitMarkerT = 0;
  hitMarkerKill = false;
  fatalityTextT = 0;
  fatalityIdx = 0;
  finishCd = 0;
  casingSfxCd = 0;
  heldInput = false;
  lastPoseT = 0;
  menuT = 0;
  menuSwing = 1;
  rageReadySaid = false;
  get pendingFlowKeyStore() { return this._pfk; }
  _pfk: string | null = null;
  timeScaleBonus = 1;
  menuMove: string | null = null;
  menuMoveT = 0;
  // ---- survival (endless waves)
  mode: GameMode = 'story';
  wave = 0;
  waveT = 0;            // seconds into the current wave
  waveLen = 30;         // seconds per wave
  survivalTime = 0;
  waveBudget = 0;       // enemies still to pour in this wave
  trickle = 0;          // timer between spawns
  bestSurvival = { wave: 0, score: 0 };
  waveBannerT = 0;
  waveKills = 0;
  pendingChoice = false;
  bossWaveActive = false;
  ambushT = 20;
  nunchaku = new Nunchaku();
  katana = new Katana();
  blood = new Blood();
  nSpin = 0;
  enemyMuzzles: { x: number; y: number; a: number; t: number; c: string }[] = [];
  tokenTimer = 0;
  runHeavyToggle = 0;
  prevBlade: { base: Vec; tip: Vec } | null = null;
  /** top-of-screen announcer (big texts never cover the action) */
  announce: { text: string; c: string; t: number; max: number; scale: number }[] = [];
  say(text: string, c: string, scale = 2, life = 1.1) {
    this.announce = this.announce.filter((a) => a.text !== text);
    this.announce.push({ text, c, t: 0, max: life, scale });
    if (this.announce.length > 3) this.announce.shift();
  }
  fatalityCd = 0;
  static FATALITY_CD = 7;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.scene = document.createElement('canvas');
    this.scene.width = VIEW_W;
    this.scene.height = VIEW_H;
    this.wctx = this.scene.getContext('2d')!;
    this.input = new Input(canvas);
    try {
      this.save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      this.best = JSON.parse(localStorage.getItem(BEST_KEY) || 'null') || { level: 0, score: 0 };
      this.bestSurvival = JSON.parse(localStorage.getItem(SURV_KEY) || 'null') || { wave: 0, score: 0 };
      const bm = localStorage.getItem(BLOOD_KEY);
      if (bm === 'normal' || bm === 'gore' || bm === 'combined') this.blood.mode = bm;
    } catch { /* ignore */ }
    this.particles.onLand = (x, y, c, s) => this.stamp(x, y, c, s);
    this.particles.bloodEnabled = () => this.blood.classic;
    this.particles.onCasing = () => { if (this.casingSfxCd <= 0) { this.sfx.casing(); this.casingSfxCd = 0.05; } };
    this.loadLevel(1);
    this.toMenu();
  }

  // ------------------------------------------------------------------ lifecycle
  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      const raw = Math.min(0.05, (ts - this.lastT) / 1000);
      this.lastT = ts;
      this.frame(raw);
      this.render();
      this.endFrameInput();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.pushUI();
  }
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.sfx.stopMusic();
  }
  /** Taps that land on a hit-stop frame are kept buffered until the next simulated frame (no dropped inputs). */
  endFrameInput() {
    if (this.heldInput) { this.heldInput = false; return; }
    this.input.endFrame();
  }

  pushUI() {
    const z = ZONES[this.level.zone];
    this.onUI?.({
      state: this.state, level: this.levelN, zoneName: z.name, zoneSub: z.sub, score: this.score, age: this.age, deathCounter: this.deathCounter,
      deaths: this.deaths, kills: this.kills, bestCombo: this.bestCombo, choices: this.choices, save: this.save, best: this.best,
      muted: this.sfx.muted, mutations: [...this.mutations], ageGain: this.ageGain, hp: this.player.hp, maxHp: this.maxHp(), accent: this.pal.accent,
      mode: this.mode, wave: this.wave, survivalTime: this.survivalTime, bestWave: this.bestSurvival.wave, bestSurvivalScore: this.bestSurvival.score, blood: this.blood.mode,
    });
  }

  moveDirOf(vx: number, vy: number): Vec | undefined {
    const l = Math.hypot(vx, vy);
    return l > 3 ? { x: vx / l, y: vy / l } : undefined;
  }
  maxHp() {
    return clamp(5 + this.stats.hpBonus - Math.floor((this.age - 20) / 12), 2, 12);
  }
  ageDmg() {
    return 1 + (this.age - 20) * 0.012;
  }
  comboMult() {
    return 1 + Math.floor(this.combo / 5) * 0.5;
  }

  // ------------------------------------------------------------------ game flow
  newGame(fromSave: SaveData | null) {
    this.mode = 'story';
    this.sfx.init();
    this.input.focus();
    this.stats = defaultStats();
    this.mutations = [];
    this.score = 0; this.kills = 0; this.combo = 0; this.bestCombo = 0; this.deaths = 0; this.meleeHits = 0;
    this.age = 20; this.deathCounter = 1;
    this.player = makePlayer();
    let start = 1;
    if (fromSave) {
      start = fromSave.level;
      this.score = fromSave.score;
      for (const id of fromSave.mutations) {
        const m = MUTATIONS.find((mm) => mm.id === id);
        if (m) { m.apply(this.stats); this.mutations.push(id); }
      }
      if (start >= 5) { this.player.hasRifle = true; this.player.ammoR = 60; }
      if (start >= 3) this.player.hasNunchaku = true;
      if (start >= 7) this.player.hasKatana = true;
      if (start >= 9) this.player.hasAxe = true;
      if (start >= 11) this.player.hasDual = true;
      this.player.hp = this.maxHp();
    }
    this.state = 'playing';
    this.startLevel(start);
    this.wipe = { t: 1, dir: 1, cb: null };
    this.sfx.startMusic(this.level.zone);
  }

  // ================================================================== SURVIVAL (endless waves)
  newSurvival() {
    this.mode = 'survival';
    this.sfx.init();
    this.input.focus();
    this.stats = defaultStats();
    this.mutations = [];
    this.score = 0; this.kills = 0; this.combo = 0; this.bestCombo = 0; this.deaths = 0; this.meleeHits = 0;
    this.age = 20; this.deathCounter = 1;
    this.player = makePlayer();
    this.player.hasNunchaku = true; this.player.hasKatana = true; this.player.hasAxe = true; this.player.hasDual = true; this.player.hasRifle = true; this.player.ammoR = 60; this.player.ammoP = 40;
    this.wave = 0; this.waveT = 0; this.survivalTime = 0; this.waveBudget = 0; this.trickle = 0; this.waveKills = 0; this.pendingChoice = false; this.bossWaveActive = false; this.ambushT = 20;
    this.state = 'playing';
    this.levelN = 1;
    this.level = generateArena(Date.now() % 100000);
    this.pal = ZONES[0].pal;
    this.levelCanvas = buildLevelCanvas(this.level, this.pal);
    this.levelCtx = this.levelCanvas.getContext('2d')!;
    this.blood.resetFloor(this.levelCanvas.width, this.levelCanvas.height);
    this.blood.solid = (x, y) => solidAt(this.level, x, y);
    this.flow = flowField(this.level, this.level.spawn.x, this.level.spawn.y);
    const p = this.player;
    this.enemies = []; this.bullets = []; this.pickups = []; this.props = []; this.corpses = []; this.hazards = []; this.afterimages = []; this.pendingBooms = []; this.pools = [];
    this.particles.list = []; this.texts.list = []; this.announce = [];
    p.x = this.level.spawn.x; p.y = this.level.spawn.y; p.hp = this.maxHp();
    this.resetCamera();
    this.rng = new Rng(this.level.seed);
    for (let i = 0; i < 6; i++) {
      const pos = this.randomFloorNear(p.x, p.y, 60, 9999, this.rng);
      if (pos) this.props.push({ x: pos.x, y: pos.y, kind: this.rng.chance(0.4) ? 'barrel' : 'crate', hp: 3, r: 6, dead: false, flash: 0 });
    }
    this.spawnQueue = []; this.maxAlive = 999; this.exitOpen = false; this.cleared = true; this.levelTime = 0; this.bannerT = 0; this.flowT = 0;
    this.cam.x = p.x - VIEW_W / 2; this.cam.y = p.y - VIEW_H / 2;
    this.wipe = { t: 1, dir: 1, cb: null };
    this.sfx.startMusic(0);
    this.startWave(1);
    this.pushUI();
  }

  /** difficulty derived from the wave number: never stops growing */
  waveDiff() { return this.wave / 18; }
  /** virtual "level" used by enemy stat scaling and kind unlocks (hp/speed/dmg keep scaling past the story cap) */
  waveLevel() { return Math.floor(this.wave * 9); }

  startWave(n: number) {
    this.wave = n; this.waveT = 0; this.waveKills = 0;
    const d = this.waveDiff();
    this.waveLen = n % 5 === 0 ? 40 : 24 + Math.min(10, n * 0.5);
    this.waveBudget = n <= 2 ? 6 + n * 2 : Math.floor(8 + n * 3.6 + d * 18);
    this.trickle = 0.3;
    this.bossWaveActive = n % 5 === 0;
    this.eliteChance = clamp(0.03 + n * 0.015, 0, 0.6);
    this.levelN = this.waveLevel(); // enemy scaling (hp/speed/dmg) rides on levelN
    this.maxAlive = n <= 2 ? 4 + n : 8 + Math.floor(n * 1.3) + Math.floor(d * 16);
    const zone = Math.min(ZONES.length - 1, Math.floor((n - 1) / 4));
    if (ZONES[zone].pal !== this.pal) { this.pal = ZONES[zone].pal; this.levelCanvas = buildLevelCanvas(this.level, this.pal); this.levelCtx = this.levelCanvas.getContext('2d')!; this.pools = []; }
    this.sfx.setIntensity(Math.min(19, zone + Math.floor(n / 3)));
    this.waveBannerT = 2.4;
    this.say(this.bossWaveActive ? `WAVE ${n} - BOSS` : `WAVE ${n}`, this.bossWaveActive ? '#ff2a2a' : this.pal.accent, 3, 2.0);
    if (n > 1) this.sfx.announce();
    if (this.bossWaveActive) {
      const pos = this.randomFloorNear(this.player.x, this.player.y, 150, 320) ?? { x: this.level.exit.x, y: this.level.exit.y };
      const bk = bossForLevel(n * 2);
      this.spawnEnemyAt('boss', pos.x, pos.y, false, bk);
      this.sfx.spawn();
    }
    // refill a bit between waves so the fight stays fast; a heart drops nearby when hurt
    const p = this.player;
    if (n > 1 && p.hp < this.maxHp()) { const pos = this.randomFloorNear(p.x, p.y, 20, 60); if (pos) this.spawnPickup(pos.x, pos.y, 'hp'); }
    p.ammoP = Math.min(Math.round(60 * this.stats.maxAmmo), p.ammoP + 10); p.ammoR = Math.min(Math.round(180 * this.stats.maxAmmo), p.ammoR + 20);
    this.pushUI();
  }

  /** survival composition: mixes melee rushers, flankers and shooters; later waves add squads and elites */
  pickSurvivalKind(): EnemyKind {
    const n = this.wave, L = this.waveLevel();
    const r = Math.random();
    if (n <= 2) return r < 0.75 ? 'thug' : 'knife';
    const pool: [EnemyKind, number][] = [
      ['thug', 10], ['knife', 7 + n * 0.2], ['gunner', L >= 6 ? 5 + n * 0.2 : 0], ['bomber', L >= 12 ? 3 + n * 0.15 : 0], ['smg', L >= 15 ? 4 + n * 0.2 : 0],
      ['rifleman', L >= 18 ? 4 + n * 0.15 : 0], ['brute', L >= 24 ? 2 + n * 0.25 : 0], ['monk', L >= 30 ? 3 + n * 0.25 : 0], ['shotgun', L >= 34 ? 3 + n * 0.2 : 0],
      ['shield', L >= 40 ? 3 + n * 0.2 : 0], ['sniper', L >= 55 ? 2 + n * 0.15 : 0],
    ];
    let total = 0; for (const [, w] of pool) total += w;
    let x = r * total;
    for (const [k, w] of pool) { x -= w; if (x <= 0) return k; }
    return 'thug';
  }

  /** spawn at the edge of the visible screen (never on top of the player), survivor.io style */
  survivalSpawnPos(): Vec | null {
    const p = this.player;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 190 + Math.random() * 80;
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.75;
      if (x < TILE * 3 || y < TILE * 3 || x > (this.level.w - 3) * TILE || y > (this.level.h - 3) * TILE) continue;
      if (this.isFree(x, y, 7)) return { x, y };
    }
    return this.randomFloorNear(p.x, p.y, 150, 320);
  }

  updateSurvival(dt: number) {
    this.survivalTime += dt;
    this.waveT += dt;
    const n = this.wave, d = this.waveDiff();
    const alive = this.enemies.filter((e) => !e.dead).length;
    // pour the wave budget in: trickle rate rises with the wave; squads of 2-4 arrive together later on
    if (this.waveBudget > 0 && alive < this.maxAlive) {
      this.trickle -= dt;
      if (this.trickle <= 0) {
        const squad = n >= 3 && Math.random() < 0.3 + d * 0.45 ? 2 + Math.floor(Math.random() * Math.min(5, 1 + n / 3)) : 1;
        const base = this.survivalSpawnPos();
        for (let i = 0; i < squad && this.waveBudget > 0; i++) {
          let pos = base ? { x: base.x + rnd(-14, 14), y: base.y + rnd(-10, 10) } : null;
          if (!pos || !this.isFree(pos.x, pos.y, 6)) pos = this.survivalSpawnPos();
          if (!pos) break;
          const kind = this.pickSurvivalKind();
          const e = this.spawnEnemyAt(kind, pos.x, pos.y, Math.random() < this.eliteChance);
          e.spawnT = 0.5;
          this.waveBudget--;
        }
        this.trickle = (n <= 2 ? 2.2 : Math.max(0.18, 1.2 - n * 0.06 - d * 0.4)) * (squad > 1 ? 1.5 : 1);
      }
    }
    // wave advances when the timer runs out, or earlier once the budget is spent and the field is nearly clear
    const bossAlive = this.enemies.some((e) => e.boss && !e.dead);
    const done = (this.waveT >= this.waveLen && !bossAlive && this.waveBudget <= 4) || (this.waveBudget <= 0 && alive <= 2 && !bossAlive) || (this.waveT >= this.waveLen * 1.6);
    if (done && !this.pendingChoice) {
      this.score += 100 + n * 25;
      this.say(`WAVE ${n} SURVIVED  +${100 + n * 25}`, '#ffd700', 2, 1.6);
      this.sfx.levelClear();
      this.updateSurvivalBest();
      // every 2 waves: pick a mutation (the run grows alongside the brutality)
      if (n % 2 === 0) { this.choices = rollMutations(this.mutations, 3); this.pendingChoice = true; this.state = 'mutation'; this.nextLevelN = -1; this.pushUI(); return; }
      this.startWave(n + 1);
    }
    // AMBUSH events (wave 6+): every ~20s a squad drops in on both flanks at once
    if (n >= 6) {
      this.ambushT -= dt;
      if (this.ambushT <= 0) {
        this.ambushT = Math.max(9, 22 - n * 0.5);
        const size = 2 + Math.floor(n / 5);
        for (const side of [-1, 1]) {
          const base = { x: this.player.x + side * 90, y: this.player.y + rnd(-30, 30) };
          for (let i = 0; i < size; i++) {
            let pos = { x: base.x + rnd(-14, 14), y: base.y + rnd(-10, 10) };
            if (!this.isFree(pos.x, pos.y, 6)) { const alt = this.randomFloorNear(base.x, base.y, 0, 40); if (!alt) continue; pos = alt; }
            const kind: EnemyKind = Math.random() < 0.6 ? 'knife' : Math.random() < 0.5 ? 'thug' : 'smg';
            const e = this.spawnEnemyAt(kind, pos.x, pos.y, Math.random() < this.eliteChance);
            e.spawnT = 0.7; e.token = kind !== 'smg';
          }
        }
        this.say('AMBUSH!', '#ff2a2a', 2, 1.0);
        this.sfx.announce(); this.shake(0.3);
      }
    }
    // ambient pressure: random supply drops, and late waves rain a few bullets of pressure from off-screen shooters
    if (Math.random() < dt * 0.12) { const pos = this.randomFloorNear(this.player.x, this.player.y, 40, 120); if (pos) this.spawnPickup(pos.x, pos.y, Math.random() < 0.35 ? 'hp' : Math.random() < 0.5 ? 'ammoP' : Math.random() < 0.5 ? 'ammoR' : 'focus'); }
  }

  updateSurvivalBest() {
    let changed = false;
    if (this.wave > this.bestSurvival.wave) { this.bestSurvival.wave = this.wave; changed = true; }
    if (this.score > this.bestSurvival.score) { this.bestSurvival.score = this.score; changed = true; }
    if (changed) try { localStorage.setItem(SURV_KEY, JSON.stringify(this.bestSurvival)); } catch { /* ignore */ }
  }

  toMenu() {
    this.state = 'menu';
    this.mode = 'story';
    this.sfx.stopMusic();
    this.level = generateArena(7);
    this.pal = ZONES[1].pal;
    this.levelCanvas = buildLevelCanvas(this.level, this.pal);
    this.levelCtx = this.levelCanvas.getContext('2d')!;
    this.blood.resetFloor(this.levelCanvas.width, this.levelCanvas.height);
    this.blood.solid = (x, y) => solidAt(this.level, x, y);
    this.enemies = []; this.bullets = []; this.pickups = []; this.props = []; this.hazards = []; this.corpses = []; this.afterimages = []; this.announce = []; this.texts.list = [];
    this.player = makePlayer();
    this.player.x = this.level.spawn.x; this.player.y = this.level.spawn.y;
    this.resetCamera();
    this.cam.x = this.player.x - VIEW_W / 2; this.cam.y = this.player.y - VIEW_H / 2;
    this.pushUI();
  }

  pause() { if (this.state === 'playing') { this.state = 'paused'; this.pushUI(); } }
  resume() { if (this.state === 'paused') { this.state = 'playing'; this.sfx.init(); this.input.focus(); this.pushUI(); } }
  toggleMute() { this.sfx.init(); this.sfx.toggleMute(); this.pushUI(); }
  setBlood(m: BloodMode) {
    this.blood.mode = m;
    try { localStorage.setItem(BLOOD_KEY, m); } catch { /* ignore */ }
    this.sfx.select();
    if (this.state === 'playing') this.say(m === 'normal' ? 'BLOOD: NORMAL' : m === 'gore' ? 'BLOOD: GORE' : 'BLOOD: COMBINED', '#ff4d4d', 1, 0.9);
    this.pushUI();
  }
  cycleBlood() { this.setBlood(this.blood.mode === 'normal' ? 'gore' : this.blood.mode === 'gore' ? 'combined' : 'normal'); }

  private loadLevel(n: number) {
    this.level = generateLevel(n);
    this.pal = ZONES[this.level.zone].pal;
    this.levelCanvas = buildLevelCanvas(this.level, this.pal);
    this.levelCtx = this.levelCanvas.getContext('2d')!;
    this.blood.resetFloor(this.levelCanvas.width, this.levelCanvas.height);
    this.blood.solid = (x, y) => solidAt(this.level, x, y);
    this.flow = flowField(this.level, this.level.spawn.x, this.level.spawn.y);
  }

  resetCamera() {
    this.cinematic = false; this.zoomTarget = 1; this.zoom = 1; this.zoomKick = 0; this.camFocus = null; this.camKick.x = this.camKick.y = 0;
  }

  startLevel(n: number) {
    this.levelN = n;
    this.loadLevel(n);
    const p = this.player;
    this.enemies = []; this.bullets = []; this.pickups = []; this.props = []; this.corpses = []; this.hazards = []; this.afterimages = []; this.pendingBooms = []; this.pools = [];
    this.particles.list = []; this.texts.list = [];
    p.x = this.level.spawn.x; p.y = this.level.spawn.y; p.vx = p.vy = p.kx = p.ky = 0;
    p.dashT = 0; p.attackPhase = 'none'; p.buffered = null; p.comboStr = ''; p.parryT = 0; p.fatality = null; p.focusDash = null; p.stunT = 0; p.iframes = 0.5;
    p.z = 0; p.holdT = 0; p.runT = 0; p.running = false; p.bloom = 0; p.muzzle = 0; p.chain = 0; p.rageDash = null;
    p.hp = Math.min(Math.max(p.hp, 1), this.maxHp());
    this.resetCamera();
    this.fatalityTextT = 0; this.slowT = 0; this.timeScale = 1;
    this.rng = new Rng(this.level.seed * 31 + 7);
    this.combo = 0; this.comboTimer = 0;
    const propCount = this.level.isBoss ? 2 : 2 + this.rng.int(1, 4);
    for (let i = 0; i < propCount; i++) {
      const pos = this.randomFloorNear(p.x, p.y, 70, 9999, this.rng);
      if (pos && dist(pos.x, pos.y, this.level.exit.x, this.level.exit.y) > 24) {
        this.props.push({ x: pos.x, y: pos.y, kind: this.rng.chance(0.42) ? 'barrel' : 'crate', hp: 3, r: 6, dead: false, flash: 0 });
      }
    }
    this.spawnQueue = [];
    this.eliteChance = clamp((n - 15) / 220, 0, 0.6);
    if (this.level.isBoss) {
      const far = this.farthestFloor();
      this.spawnEnemyAt('boss', far.x, far.y, false, bossForLevel(n));
      const minions = 2 + Math.floor(n / 20);
      for (let i = 0; i < minions; i++) this.spawnQueue.push(pickKind(Math.max(1, n - 5), this.rng));
      this.maxAlive = 3 + Math.floor(n / 35);
      this.spawnTimer = 2.5;
    } else {
      const count = Math.min(30, Math.floor(4 + n * 0.13 + this.rng.int(0, 2)));
      for (let i = 0; i < count; i++) this.spawnQueue.push(pickKind(n, this.rng));
      this.maxAlive = 4 + Math.floor(n / 20);
      this.spawnTimer = 0.4;
    }
    if (n === 5 && !p.hasRifle) this.pickups.push({ x: p.x + 26, y: p.y, kind: 'rifle', t: 0, vx: 0, vy: 0, magnet: false });
    if (n === 3 && !p.hasNunchaku) this.pickups.push({ x: p.x + 26, y: p.y, kind: 'nunchaku', t: 0, vx: 0, vy: 0, magnet: false });
    if (n > 3 && !p.hasNunchaku && n % 2 === 1) this.pickups.push({ x: p.x + 26, y: p.y + 10, kind: 'nunchaku', t: 0, vx: 0, vy: 0, magnet: false });
    if (n === 7 && !p.hasKatana) this.pickups.push({ x: p.x + 26, y: p.y - 10, kind: 'katana', t: 0, vx: 0, vy: 0, magnet: false });
    if (n > 7 && !p.hasKatana && n % 2 === 0) this.pickups.push({ x: p.x + 26, y: p.y - 10, kind: 'katana', t: 0, vx: 0, vy: 0, magnet: false });
    if (n === 9 && !p.hasAxe) this.pickups.push({ x: p.x + 30, y: p.y + 4, kind: 'axe', t: 0, vx: 0, vy: 0, magnet: false });
    if (n > 9 && !p.hasAxe && n % 3 === 0) this.pickups.push({ x: p.x + 30, y: p.y + 4, kind: 'axe', t: 0, vx: 0, vy: 0, magnet: false });
    if (n === 11 && !p.hasDual) this.pickups.push({ x: p.x + 30, y: p.y - 6, kind: 'dual', t: 0, vx: 0, vy: 0, magnet: false });
    if (n > 11 && !p.hasDual && n % 3 === 1) this.pickups.push({ x: p.x + 30, y: p.y - 6, kind: 'dual', t: 0, vx: 0, vy: 0, magnet: false });
    this.exitOpen = false; this.cleared = false; this.portalT = 0; this.levelTime = 0; this.bannerT = 2.4; this.flowT = 0;
    this.cam.x = p.x - VIEW_W / 2; this.cam.y = p.y - VIEW_H / 2;
    this.sfx.setIntensity(this.level.zone);
    if ((n - 1) % LEVELS_PER_ZONE === 0) this.saveCheckpoint();
    this.updateBest();
    this.pushUI();
  }

  saveCheckpoint() {
    this.save = { level: this.levelN, mutations: [...this.mutations], score: this.score };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* ignore */ }
  }
  updateBest() {
    let changed = false;
    if (this.levelN > this.best.level) { this.best.level = this.levelN; changed = true; }
    if (this.score > this.best.score) { this.best.score = this.score; changed = true; }
    if (changed) try { localStorage.setItem(BEST_KEY, JSON.stringify(this.best)); } catch { /* ignore */ }
  }

  onLevelCleared() {
    this.cleared = true;
    this.exitOpen = true;
    this.sfx.levelClear();
    this.slow(0.5, 0.25);
    this.flash(this.pal.accent, 0.25);
    this.say('LEVEL CLEAR!', this.pal.accent, 3, 1.6);
    this.score += this.levelN * 25;
    const p = this.player;
    const ex = this.level.exit;
    const kind: Pickup['kind'] = p.hp < this.maxHp() ? 'hp' : p.hasRifle && p.ammoR < 40 ? 'ammoR' : p.ammoP < 30 ? 'ammoP' : 'focus';
    this.pickups.push({ x: ex.x + 16, y: ex.y + 4, kind, t: 0, vx: 0, vy: 0, magnet: false });
    this.particles.shockwave(ex.x, ex.y, 40, this.pal.accent, 0.6);
    this.updateBest();
  }

  beginExit() {
    if (this.wipe) return;
    this.sfx.portal();
    this.wipe = { t: 0, dir: -1, cb: () => this.nextLevel() };
  }

  nextLevel() {
    const n = this.levelN;
    if (n >= TOTAL_LEVELS) { this.victory(); return; }
    this.nextLevelN = n + 1;
    if (n % 3 === 0 || this.level.isBoss) {
      this.choices = rollMutations(this.mutations, 3);
      this.state = 'mutation';
      this.pushUI();
    } else {
      this.startLevel(n + 1);
    }
  }

  chooseMutation(i: number) {
    const m = this.choices[i];
    if (!m) return;
    m.apply(this.stats);
    this.mutations.push(m.id);
    const p = this.player;
    if (m.instant === 'heal') p.hp = Math.min(this.maxHp(), p.hp + 1);
    if (m.instant === 'fullheal') { p.hp = this.maxHp(); p.focus = 300; }
    if (m.instant === 'ammo') { p.ammoP = Math.min(60 * this.stats.maxAmmo, p.ammoP + 40); if (p.hasRifle) p.ammoR = Math.min(180 * this.stats.maxAmmo, p.ammoR + 100); }
    if (m.instant === 'youth') { this.age = Math.max(20, this.age - 6); }
    this.sfx.select();
    this.state = 'playing';
    this.choices = [];
    this.input.focus();
    if (this.mode === 'survival') { this.pendingChoice = false; this.startWave(this.wave + 1); return; }
    this.startLevel(this.nextLevelN);
    this.wipe = { t: 1, dir: 1, cb: null };
  }

  die() {
    const p = this.player;
    p.hp = 0;
    this.state = 'dead';
    this.deathT = 0;
    this.deaths++;
    this.ageGain = this.deathCounter;
    this.sfx.death();
    this.flash('#ff0000', 0.6);
    this.shake(1);
    this.particles.blood(p.x, p.y - 6, 30, p.aim + Math.PI, 160);
    for (let i = 0; i < 4; i++) this.particles.limb(p.x, p.y - 6, rnd(0, 6.3), 140, '#ffffff', 4);
    this.splat(p.x, p.y, 10);
    this.corpses.push({ x: p.x, y: p.y, rot: p.aim, color: '#ffffff', color2: PLAYER_BAND, scale: 1, accessory: 'headband', vx: 0, vy: 0, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
    this.slow(1.5, 0.3);
    this.cinematic = false; this.camFocus = null; this.zoomTarget = 1.3;
    this.pushUI();
  }

  respawn() {
    if (this.state !== 'dead') return;
    if (this.mode === 'survival') { this.updateSurvivalBest(); this.gameOver(); return; }
    this.age += this.deathCounter;
    this.deathCounter++;
    if (this.age >= 70) { this.gameOver(); return; }
    this.player.hp = this.maxHp();
    this.state = 'playing';
    this.input.focus();
    this.startLevel(this.levelN);
    this.wipe = { t: 1, dir: 1, cb: null };
    this.say('OLDER. STRONGER.', '#ffd700', 2, 1.6);
  }

  gameOver() {
    this.state = 'gameover';
    this.sfx.stopMusic();
    this.updateBest();
    this.pushUI();
  }

  victory() {
    this.state = 'victory';
    this.sfx.stopMusic();
    this.sfx.levelClear();
    this.updateBest();
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this.save = null;
    this.pushUI();
  }

  restartZone() {
    if (this.mode === 'survival') { this.newSurvival(); return; }
    const zoneStart = Math.floor((this.levelN - 1) / LEVELS_PER_ZONE) * LEVELS_PER_ZONE + 1;
    const keep: SaveData = { level: zoneStart, mutations: [...this.mutations], score: this.score };
    this.newGame(keep);
  }

  // ------------------------------------------------------------------ helpers
  shake(t: number) { this.trauma = Math.min(1, this.trauma + t); }
  slow(dur: number, factor: number) { this.slowT = Math.max(this.slowT, dur); this.slowFactor = factor; }
  flash(c: string, a: number) { this.flashC = c; this.flashA = Math.max(this.flashA, a); }
  isFree(x: number, y: number, r: number) { return freeAt(this.level, x, y, r * 0.8); }
  hasLOS(e: { x: number; y: number }) { return lineOfSight(this.level, e.x, e.y, this.player.x, this.player.y); }
  mouseWorld(): Vec {
    const z = this.zoom;
    return { x: this.cam.x + VIEW_W / 2 + (this.input.mouse.x - VIEW_W / 2) / z, y: this.cam.y + VIEW_H / 2 + (this.input.mouse.y - VIEW_H / 2) / z };
  }
  randomFloorNear(x: number, y: number, minD: number, maxD: number, rng?: Rng): Vec | null {
    const ft = this.level.floorTiles;
    for (let i = 0; i < 40; i++) {
      const t = rng ? rng.pick(ft) : ft[Math.floor(Math.random() * ft.length)];
      const px0 = t.x * TILE + TILE / 2, py0 = t.y * TILE + TILE / 2;
      const d = dist(px0, py0, x, y);
      if (d >= minD && d <= maxD && this.isFree(px0, py0, 6)) return { x: px0, y: py0 };
    }
    return null;
  }
  farthestFloor(): Vec {
    return { x: this.level.exit.x, y: this.level.exit.y };
  }
  stamp(x: number, y: number, c: string, s: number, force = false) {
    if (!force && solidAt(this.level, x, y)) return;
    const ctx = this.blood.gore && this.blood.sctx ? this.blood.sctx : this.levelCtx;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), s, s);
    ctx.globalAlpha = 1;
  }
  splat(x: number, y: number, n: number, c = '#8a0000', force = false) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.3), r = rnd(0, 9);
      const k = Math.random();
      this.stamp(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, k < 0.25 ? '#5e0000' : c, k < 0.15 ? 3 : k < 0.55 ? 2 : 1, force);
    }
    this.stamp(x - 1, y - 1, c, 3, force);
    this.stamp(x - 2, y, '#5e0000', 2, force);
  }
  /** growing blood pool stamped into the floor over ~1s (clipped to floor tiles) */
  addPool(x: number, y: number, max: number, c = '#7a0000') {
    this.pools.push({ x, y, r: 1, max, c });
    if (this.pools.length > 40) this.pools.shift();
  }
  updatePools(dt: number) {
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const q = this.pools[i];
      q.r += (q.max / 0.9) * dt;
      const r = Math.min(q.r, q.max);
      this.stampEllipse(q.x, q.y, r, r * 0.5, q.c, 0.2);
      if (q.r >= q.max) this.pools.splice(i, 1);
    }
  }
  stampEllipse(x: number, y: number, rx: number, ry: number, c: string, alpha: number) {
    const ctx = this.levelCtx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = c;
    const cx = Math.round(x), cy = Math.round(y);
    const ryi = Math.ceil(ry);
    for (let dy = -ryi; dy <= ryi; dy++) {
      const f = 1 - (dy * dy) / (ry * ry + 0.5);
      if (f < 0) continue;
      const dx = Math.floor(Math.sqrt(f) * rx);
      let start = -1;
      for (let xx = cx - dx; xx <= cx + dx + 1; xx++) {
        const solid = xx > cx + dx || solidAt(this.level, xx, cy + dy);
        if (!solid && start < 0) start = xx;
        if (solid && start >= 0) { ctx.fillRect(start, cy + dy, xx - start, 1); start = -1; }
      }
    }
    ctx.globalAlpha = 1;
  }
  bulletHole(x: number, y: number) {
    this.stamp(x, y, '#050505', 1);
    if (Math.random() < 0.5) this.stamp(x + rnd(-1, 1), y + rnd(-1, 1), 'rgba(0,0,0,0.5)', 1);
  }
  addHazard(h: Partial<Hazard>) {
    const base: Hazard = { x: 0, y: 0, r: 0, maxR: 40, life: 1, max: 1, kind: 'ring', hit: false, dmg: 1, fromPlayer: false };
    const out = Object.assign(base, h);
    out.max = h.max ?? h.life ?? 1;
    this.hazards.push(out);
  }
  addAfterimage(src: { x: number; y: number; facing: number; aim: number; scale?: number; color?: string; pose?: Pose; poseT?: number }, color?: string, lean?: Vec) {
    if (this.afterimages.length > 60) this.afterimages.shift();
    this.afterimages.push({
      x: src.x, y: src.y, life: 0.22, max: 0.22, pose: src.pose ?? 'dash', t: src.poseT ?? 0, facing: src.facing, aim: src.aim,
      color: color ?? src.color ?? this.pal.accent, scale: src.scale ?? 1, lean: lean ?? { x: Math.cos(src.aim), y: Math.sin(src.aim) },
    });
  }
  spawnEnemyAt(kind: EnemyKind, x: number, y: number, elite: boolean, boss?: BossKind) {
    const e = makeEnemy(kind, boss, x, y, this.levelN, elite);
    this.enemies.push(e);
    this.sfx.spawn();
    this.particles.ring(x, y - 6, 16, 2, this.pal.accent, 0.6, 1);
    return e;
  }
  spawnNext() {
    const kind = this.spawnQueue.shift();
    if (!kind) return;
    const p = this.player;
    let pos = this.randomFloorNear(p.x, p.y, 110, 320);
    if (!pos) pos = this.randomFloorNear(p.x, p.y, 70, 9999);
    if (!pos) pos = { x: this.level.exit.x, y: this.level.exit.y };
    this.spawnEnemyAt(kind, pos.x, pos.y, Math.random() < this.eliteChance);
  }
  spawnPickup(x: number, y: number, kind: Pickup['kind']) {
    this.pickups.push({ x, y, kind, t: 0, vx: rnd(-50, 50), vy: rnd(-50, 50), magnet: false });
  }
  dropLoot(e: Enemy, melee: boolean) {
    const p = this.player;
    let chance = (0.2 + (melee ? 0.1 : 0)) * this.stats.dropRate * (e.elite ? 2 : 1);
    if (e.boss) chance = 3;
    let n = Math.floor(chance) + (Math.random() < chance % 1 ? 1 : 0);
    while (n-- > 0) {
      const w: [Pickup['kind'], number][] = [
        ['hp', p.hp < this.maxHp() ? 3 : 0.3],
        ['ammoP', 3],
        ['ammoR', p.hasRifle ? 3 : this.levelN >= 8 ? 1.2 : 0],
        ['focus', 1.5],
      ];
      const total = w.reduce((a, b) => a + b[1], 0);
      let r = Math.random() * total;
      let kind: Pickup['kind'] = 'ammoP';
      for (const [k, wt] of w) { r -= wt; if (r <= 0) { kind = k; break; } }
      if (kind === 'ammoR' && !p.hasRifle) kind = 'rifle';
      this.spawnPickup(e.x, e.y, kind);
    }
  }
  nearestEnemy(x: number, y: number, maxD: number, aim?: number, arc?: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxD;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = dist(x, y, e.x, e.y) - e.r;
      if (d > bd) continue;
      if (aim !== undefined && arc !== undefined && Math.abs(angleDiff(Math.atan2(e.y - y, e.x - x), aim)) > arc) continue;
      bd = d; best = e;
    }
    return best;
  }
  /** staggered enemy in reach -> "FINISH HIM!" banner (perfect fatality) */
  finishTarget(): Enemy | null {
    const p = this.player;
    let best: Enemy | null = null, bd = 60;
    for (const e of this.enemies) {
      if (e.dead || e.stagger <= 0 || e.spawnT > 0) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  /** ANY enemy can be fatality'd: close ones directly, far ones (in aim direction) via a running/flying finisher */
  fatalityTarget(): { e: Enemy; far: boolean } | null {
    const p = this.player;
    let best: Enemy | null = null, bs = -1e9, far = false;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = dist(p.x, p.y, e.x, e.y) - e.r;
      const ang = Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim));
      let score = -1e9, isFar = false;
      if (d < 60) score = 200 - d * 2 - ang * 8 + (e.stagger > 0 ? 80 : 0);
      else if (d < 150 && ang < 0.75 && lineOfSight(this.level, p.x, p.y, e.x, e.y)) { score = 100 - d * 0.5 - ang * 20 + (e.stagger > 0 ? 80 : 0); isFar = true; }
      if (score > bs) { bs = score; best = e; far = isFar; }
    }
    return best ? { e: best, far } : null;
  }
  addCombo(n = 1) {
    this.combo += n;
    this.comboTimer = this.comboMax;
    this.comboPop = 0.1;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    if ([6, 12, 25, 50, 100].includes(this.combo)) {
      const names: Record<number, string> = { 6: 'GOOD!', 12: 'GREAT!', 25: 'BRUTAL!', 50: 'MASTER!', 100: 'LEGENDARY!' };
      this.say(names[this.combo], this.pal.accent2, 2, 0.9);
      this.sfx.select();
    }
  }

  // ------------------------------------------------------------------ frame
  frame(raw: number) {
    this.time += raw;
    this.rawDt = raw;
    const inp = this.input;
    if (inp.hit('m')) this.toggleMute();
    if (inp.hit('b')) this.cycleBlood();
    if (this.casingSfxCd > 0) this.casingSfxCd -= raw;
    if (this.hitMarkerT > 0) this.hitMarkerT -= raw;
    if (this.fatalityTextT > 0) this.fatalityTextT -= raw;
    if (this.finishCd > 0) this.finishCd -= raw;
    for (let i = this.announce.length - 1; i >= 0; i--) { this.announce[i].t += raw; if (this.announce[i].t >= this.announce[i].max) this.announce.splice(i, 1); }
    if (this.fatalityCd > 0 && this.state === 'playing') this.fatalityCd -= raw;
    this.input.autoFocusOnHover = this.state === 'playing';
    switch (this.state) {
      case 'menu': {
        // ATTRACT MODE: a slow pan over the arena while thugs circle a training dummy of the hero; blood & ragdolls included
        this.menuT += raw;
        this.particles.update(raw);
        this.blood.update(raw);
        this.updateCorpses(raw);
        if (Math.random() < 0.3) this.particles.ember(this.cam.x + rnd(0, VIEW_W), this.cam.y + VIEW_H + 4, 1, this.pal.accent);
        const p = this.player;
        p.aim = Math.atan2(inp.mouse.y + this.cam.y - p.y + 6, inp.mouse.x + this.cam.x - p.x);
        p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;
        // keep a few sparring partners around; every ~1.6s the hero performs a move and knocks one flying
        const alive = this.enemies.filter((e) => !e.dead);
        if (alive.length < 4 && Math.random() < raw * 1.5) { const pos = this.randomFloorNear(p.x, p.y, 60, 140); if (pos) { const e = this.spawnEnemyAt(Math.random() < 0.6 ? 'thug' : 'knife', pos.x, pos.y, false); e.spawnT = 0.5; e.attackCd = 99; } }
        for (const e of alive) {
          e.poseT += raw / e.poseDur; if (e.flash > 0) e.flash -= raw; if (e.flinch > 0) e.flinch -= raw; if (e.spawnT > 0) { e.spawnT -= raw; continue; }
          if (e.z > 0 || e.vz !== 0) { e.vz -= 520 * raw; e.z += e.vz * raw; e.pose = 'launched'; if (e.z <= 0) { e.z = 0; e.vz = 0; e.down = 1; e.pose = 'down'; } continue; }
          if (e.down > 0) { e.down -= raw; e.pose = 'down'; if (e.down <= 0) e.pose = 'idle'; continue; }
          const d = dist(e.x, e.y, p.x, p.y); const ang = Math.atan2(p.y - e.y, p.x - e.x); e.aim = ang; e.facing = Math.cos(ang) >= 0 ? 1 : -1;
          const sp = d > 34 ? e.speed * 0.5 : 0; e.moving = sp > 0; if (sp > 0) { e.vx = Math.cos(ang) * sp; e.vy = Math.sin(ang) * sp; moveWithCollision(this.level, e, e.vx * raw, e.vy * raw); e.walk += raw * 8; } else { const a2 = ang + Math.PI / 2; moveWithCollision(this.level, e, Math.cos(a2) * 20 * raw, Math.sin(a2) * 20 * raw); e.walk += raw * 5; e.moving = true; }
          moveWithCollision(this.level, e, e.kx * raw, e.ky * raw); e.kx *= 1 - 5 * raw; e.ky *= 1 - 5 * raw;
        }
        this.menuSwing -= raw;
        if (this.menuSwing <= 0) {
          this.menuSwing = 1.4 + Math.random();
          const near = alive.filter((e) => e.spawnT <= 0 && e.down <= 0 && e.z <= 0 && dist(e.x, e.y, p.x, p.y) < 40);
          if (near.length) {
            const e = near[(Math.random() * near.length) | 0];
            const a = Math.atan2(e.y - p.y, e.x - p.x); p.aim = a; p.facing = Math.cos(a) >= 0 ? 1 : -1;
            const keys = ['LLLL', 'H', 'LLLH', 'HH', 'HHL', 'LHL'];
            this.menuMove = keys[(Math.random() * keys.length) | 0]; this.menuMoveT = 0;
            this.hitstop = 0.03; this.shake(0.3);
            const hx = e.x - Math.cos(a) * e.r, hy = e.y - 6;
            this.particles.spark(hx, hy, 8, '#ffffff', a, 0.9, 220); this.particles.impact(hx, hy, 7, '#ffffff');
            this.blood.spray(hx, hy, a, 4, true);
            this.sfx.heavy(); this.sfx.hit();
            if (Math.random() < 0.5) { e.vz = 180; e.z = 0.1; e.kx = Math.cos(a) * 140; e.ky = Math.sin(a) * 140; }
            else { e.dead = true; this.enemies.splice(this.enemies.indexOf(e), 1); this.corpses.push({ x: e.x, y: e.y, rot: a, color: e.color, color2: e.color2, scale: e.scale, accessory: e.accessory, vx: Math.cos(a) * 320, vy: Math.sin(a) * 240, spin: 10, t: 0, z: 1, vz: 160, gib: false, bounces: 0 }); }
          }
        }
        if (this.menuMove) { this.menuMoveT += raw; if (this.menuMoveT > 0.5) this.menuMove = null; }
        if (this.corpses.length > 10) this.corpses.shift();
        this.cam.x += (p.x + Math.sin(this.menuT * 0.25) * 40 - VIEW_W / 2 - this.cam.x) * 0.02;
        this.cam.y += (p.y + 30 + Math.cos(this.menuT * 0.2) * 16 - VIEW_H / 2 - this.cam.y) * 0.02;
        this.trauma = Math.max(0, this.trauma - raw * 2.4);
        const s = this.trauma * this.trauma; this.shakeX = rnd(-1, 1) * s * 8; this.shakeY = rnd(-1, 1) * s * 6;
        if (this.hitstop > 0) this.hitstop -= raw;
        if (inp.hit('enter')) this.newGame(null);
        return;
      }
      case 'paused':
        if (inp.hit('escape') || inp.hit('p')) this.resume();
        return;
      case 'mutation':
        if (inp.hit('1')) this.chooseMutation(0);
        else if (inp.hit('2')) this.chooseMutation(1);
        else if (inp.hit('3')) this.chooseMutation(2);
        return;
      case 'dead':
        this.deathT += raw;
        this.particles.update(raw * 0.5);
        this.texts.update(raw);
        this.updateCorpses(raw * 0.5);
        this.updateCamera(raw);
        if (this.deathT > 1.0 && (inp.hit('enter') || inp.hit(' ') || inp.mouse.pressed)) this.respawn();
        return;
      case 'gameover': case 'victory':
        this.particles.update(raw);
        return;
      default:
        break;
    }
    if (inp.hit('escape') || inp.hit('p')) { this.pause(); return; }
    this.trauma = Math.max(0, this.trauma - raw * 2.4);
    if (this.hitstop > 0) {
      this.hitstop -= raw;
      this.updateCamera(raw);
      this.heldInput = true;
      return;
    }
    if (this.slowT > 0) { this.slowT -= raw; this.timeScale = lerp(this.timeScale, this.slowFactor, 0.4); }
    else this.timeScale = lerp(this.timeScale, 1, 0.25);
    const dt = raw * this.timeScale;
    if (this.wipe) {
      if (this.wipe.dir === -1) {
        this.wipe.t += raw * 2.2;
        if (this.wipe.t >= 1) {
          this.wipe.t = 1;
          const cb = this.wipe.cb;
          this.wipe = { t: 1, dir: 1, cb: null };
          cb?.();
          if (this.state !== 'playing') return;
        }
        this.particles.update(dt);
        this.updateCamera(raw);
        return;
      }
      this.wipe.t -= raw * 2.2;
      if (this.wipe.t <= 0) this.wipe = null;
    }
    this.levelTime += dt;
    if (this.bannerT > 0) this.bannerT -= raw;
    this.updateWorld(dt);
    this.updateCamera(raw);
  }

  updateWorld(dt: number) {
    const p = this.player;
    this.updatePlayer(dt);
    this.flowT -= dt;
    if (this.flowT <= 0) { this.flow = flowField(this.level, p.x, p.y); this.flowT = 0.25; }
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (this.mode === 'survival') this.updateSurvival(dt);
    else if (this.spawnQueue.length && alive < this.maxAlive) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnNext(); this.spawnTimer = this.levelTime < 2 ? 0.18 : 0.5; }
    }
    if (this.state !== 'playing') return;
    this.updateTactics(dt);
    for (const e of this.enemies) if (!e.dead) updateEnemy(this, e, dt);
    this.physics(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateProps(dt);
    this.updateHazards(dt);
    for (let i = this.afterimages.length - 1; i >= 0; i--) { this.afterimages[i].life -= dt; if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1); }
    this.updateCorpses(dt);
    this.updatePools(dt);
    this.blood.update(dt);
    this.particles.update(dt);
    this.texts.update(dt);
    if (this.combo > 0) { this.comboTimer -= dt * this.stats.comboDecay; if (this.comboTimer <= 0) this.combo = 0; }
    this.comboPop -= dt;
    this.flashA = Math.max(0, this.flashA - dt * 2.5);
    if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 6);
    if (this.mode === 'story' && !this.cleared && !p.fatality && this.spawnQueue.length === 0 && this.enemies.every((e) => e.dead)) this.onLevelCleared();
    if (this.exitOpen) {
      this.portalT += dt;
      const ex = this.level.exit;
      if (Math.random() < 0.5) this.particles.add({ x: ex.x + rnd(-10, 10), y: ex.y + rnd(-4, 4), vx: 0, vy: rnd(-40, -15), life: 0.6, c: Math.random() < 0.5 ? this.pal.accent : '#ffffff', k: 7 });
      const d = dist(p.x, p.y, ex.x, ex.y);
      if (d < 40 && d > 0.5 && !p.fatality) { p.kx += ((ex.x - p.x) / d) * 60 * dt * 20; p.ky += ((ex.y - p.y) / d) * 60 * dt * 20; }
      if (d < 10 && !p.fatality) this.beginExit();
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead) this.enemies.splice(i, 1);
  }

  updateCorpses(dt: number) {
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.t += dt;
      if (c.z > 0 || c.vz !== 0) {
        c.vz -= 500 * dt;
        c.z += c.vz * dt;
        c.rot += c.spin * dt;
        // bleeding while flying (a few drops)
        if (Math.random() < 0.18) this.blood.spray(c.x, c.y - 6 - c.z, Math.atan2(c.vy, c.vx) + Math.PI, 0.3, false);
        if (c.z <= 0) {
          c.z = 0;
          if (c.gib) { this.gibAt(c.x, c.y, c.color, c.scale, Math.atan2(c.vy, c.vx), 1.3); this.corpses.splice(i, 1); continue; }
          // ragdoll bounce: first impact bounces back up a little, then settles
          if (c.vz < -90 && c.bounces < 2) { c.bounces++; c.vz = -c.vz * 0.35; c.vx *= 0.6; c.vy *= 0.6; c.spin *= 0.6; this.particles.smoke(c.x, c.y, 3, '#888', 20, 0.3); this.splat(c.x, c.y, 3); this.sfx.land(); continue; }
          c.vz = 0; c.spin = 0; c.rot = Math.round(c.rot / Math.PI) * Math.PI; // lies flat
          this.particles.smoke(c.x, c.y, 4, '#888', 25, 0.4);
          this.blood.pool(c.x, c.y + 1, 4 + c.scale);
        }
      }
      if (Math.abs(c.vx) + Math.abs(c.vy) > 1) {
        const o = { x: c.x, y: c.y, r: 3 };
        const m = moveWithCollision(this.level, o, c.vx * dt, c.vy * dt);
        c.x = o.x; c.y = o.y;
        const sp = Math.hypot(c.vx, c.vy);
        if ((m.bx || m.by) && sp > 160) {
          // body slams the wall: blood splatter on the wall, body drops
          const wx = c.x + (m.bx ? Math.sign(c.vx) * 7 : 0), wy = c.y - 6 + (m.by ? Math.sign(c.vy) * 7 : 0);
          this.splat(wx, wy, 14, '#8a0000', true);
          this.blood.spray(c.x, c.y - 6 - c.z, Math.atan2(-c.vy, -c.vx), 3, true);
          this.shake(Math.min(0.6, sp / 500)); this.sfx.slam();
          if (c.gib) { this.gibAt(c.x, c.y, c.color, c.scale, Math.atan2(-c.vy, -c.vx), 1.4); this.say('SPLAT!', '#ff3b3b', 2, 0.8); this.corpses.splice(i, 1); continue; }
          c.vz = Math.min(c.vz, 20);
        }
        if (m.bx) c.vx *= -0.3;
        if (m.by) c.vy *= -0.3;
        const f = Math.max(0, 1 - (c.z > 0 ? 0.4 : 6) * dt); c.vx *= f; c.vy *= f;
      }
    }
  }

  // ------------------------------------------------------------------ player
  updatePlayer(dt: number) {
    const p = this.player;
    const inp = this.input;
    const raw = this.rawDt;
    for (const k of ['dashCd', 'parryCd', 'iframes', 'flash', 'stunT', 'shootT', 'holdT'] as const) if (p[k] > 0) p[k] -= dt;
    p.fireCd = Math.max(-1, p.fireCd - dt);
    p.sinceDash += dt;
    if (p.bloom > 0) p.bloom = Math.max(0, p.bloom - dt * 0.25);
    if (p.muzzle > 0) p.muzzle -= raw;
    const mw = this.mouseWorld();
    if (!p.fatality && !p.focusDash) {
      p.aim = Math.atan2(mw.y - (p.y - 6), mw.x - p.x);
      if (p.attackPhase === 'windup' || p.attackPhase === 'active') p.aim = p.attackAim;
    }
    // Facing: while running with fists the body faces the direction of travel (otherwise the run cycle
    // reads as "running backwards" whenever the cursor is behind you). Guns, attacks and finishers face the aim.
    const bodyFacesTravel = p.weapon === 'fist' && !p.fatality && !p.focusDash && p.attackPhase === 'none' && p.dashT <= 0 && p.moving && Math.hypot(p.vx, p.vy) > 30;
    if (bodyFacesTravel) { if (Math.abs(p.vx) > 8) p.facing = p.vx >= 0 ? 1 : -1; }
    else p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;
    // the body's pose aims along the travel direction while running (fists); the head/eyes still track the cursor
    p.bodyAim = bodyFacesTravel ? Math.atan2(p.vy, p.vx) : p.aim;

    if (p.fatality) { this.updateFatality(raw); return; }
    if (p.focusDash) {
      const fd = p.focusDash;
      fd.t += raw / 0.14;
      const k = Math.min(1, fd.t);
      const ek = 1 - Math.pow(1 - k, 3);
      p.x = lerp(fd.sx, fd.tx, ek); p.y = lerp(fd.sy, fd.ty, ek);
      this.addAfterimage({ x: p.x, y: p.y, facing: p.facing, aim: p.aim, scale: 1 }, this.pal.accent, p.lean);
      if (k >= 1) {
        p.focusDash = null;
        const e = this.enemies.find((en) => en.id === fd.id);
        if (e) p.aim = Math.atan2(e.y - p.y, e.x - p.x);
        this.startAttack('FOCUS');
      }
      return;
    }

    // ---- movement & running
    let ix = (inp.key('d') || inp.key('arrowright') ? 1 : 0) - (inp.key('a') || inp.key('arrowleft') ? 1 : 0);
    let iy = (inp.key('s') || inp.key('arrowdown') ? 1 : 0) - (inp.key('w') || inp.key('arrowup') ? 1 : 0);
    let il = Math.hypot(ix, iy);
    if (il === 0 && inp.mouse.mdown) { ix = Math.cos(p.aim); iy = Math.sin(p.aim); il = 1; } // middle mouse = run toward cursor
    if (il > 0) { ix /= il; iy /= il; }
    const attacking = p.attackPhase !== 'none';
    const move = attacking && p.moveKey ? MOVES[p.moveKey] : null;
    const traveling = !!(move && move.travel && p.attackPhase === 'active');
    const frozen = p.stunT > 0 || p.holdT > 0;
    const sprintBefore = clamp((p.runT - 0.08) / 0.3, 0, 1);

    // ---- Taekwondo flying side kick: RUN + LEFT CLICK (handled in startAttackInput); cooldown ticks here
    if (p.tkdCd > 0) p.tkdCd -= dt;
    void sprintBefore;
    if (il > 0) p.lean = { x: ix, y: iy };
    if (il > 0 && !frozen && !attacking) p.lastDir = { x: ix, y: iy };
    if (il > 0 && !frozen) { if (!attacking && p.dashT <= 0) p.runT += dt; }
    else p.runT = 0;
    const sprint = clamp((p.runT - 0.08) / 0.3, 0, 1);
    p.running = p.runT > 0.4 && il > 0 && !frozen;
    if (p.running && !attacking && p.comboStr) p.comboStr = '';
    const airMul = p.airborne ? 0.75 : 1;
    const spd = 118 * this.stats.moveSpeed * (1 + 0.3 * sprint) * (attacking ? (p.attackPhase === 'recover' ? 0.55 : 0.25) : 1) * (p.parryT > 0 ? 0.4 : 1) * (frozen ? 0 : 1) * airMul;
    const accel = p.airborne ? 6 : 22;
    const k = 1 - Math.exp(-accel * dt);
    p.vx = lerp(p.vx, ix * spd, k);
    p.vy = lerp(p.vy, iy * spd, k);
    p.moving = il > 0 && !frozen;
    // walk cycle advances with actual ground speed so feet never slide
    const gspd = Math.hypot(p.vx, p.vy);
    // cadence: ~3.2 steps/s at full sprint (period 0.31s per step). Half-stride length follows from the speed so the
    // planted foot stays still in the world: strideHalf = speed / (2 * stepsPerSec)... clamped to what the legs can reach.
    if (!p.airborne && gspd > 5) {
      // small legs, fast cadence: 3 steps/s at a jog up to ~5.5 steps/s at full sprint. Step length saturates at the leg reach.
      const stepsPerSec = 3 + 2.5 * clamp(gspd / 160, 0, 1);
      p.strideHalf = clamp(gspd / (4 * stepsPerSec), 2.4, 5.6); // px, half of the step length
      p.walk += dt * stepsPerSec * Math.PI; // 2 steps per 2PI
    }
    else if (!p.moving) p.walk = 0;
    if (p.moving && !attacking && p.dashT <= 0 && !p.airborne) {
      p.dustT -= dt;
      if (p.dustT <= 0) { p.dustT = 0.16 - 0.07 * sprint; this.particles.smoke(p.x - p.lean.x * 4, p.y + 1, 1, '#9a9a9a', 14 + 10 * sprint, 0.35); }
      p.stepT -= dt;
      if (p.stepT <= 0) { p.stepT = 0.24 - 0.07 * sprint; this.sfx.footstep(); }
      if (sprint >= 1 && Math.random() < 0.35) this.particles.lines(p.x - p.lean.x * 7, p.y - 6 - p.lean.y * 4, 1, 'rgba(255,255,255,0.55)', Math.atan2(-p.lean.y, -p.lean.x), 140);
    }

    // ---- JUMP (space): hop over bullets, sweeps and shockwaves
    if (p.landT > 0) p.landT -= dt;
    if (p.jumpCd > 0) p.jumpCd -= dt;
    if (inp.hit(' ') && !p.airborne && p.jumpCd <= 0 && p.stunT <= 0 && p.holdT <= 0 && p.dashT <= 0 && !traveling) {
      p.jumpCd = 0.55;
      p.airborne = true; p.vz = 200; p.jumpT = 0; p.squash = 0.82;
      p.attackPhase = 'none'; p.buffered = null; p.parryT = 0;
      this.sfx.whoosh();
      this.particles.smoke(p.x, p.y, 4, '#888', 22, 0.35);
      this.particles.dirBurst(p.x, p.y, 4, '#cfcfcf', Math.PI / 2, 1.2, 50, 0.3);
    }
    if (p.airborne) {
      p.jumpT += dt;
      p.vz -= 760 * dt;
      p.z += p.vz * dt;
      // air attack: LMB in the air = dive kick
      if (inp.mouse.pressed && !attacking && p.z > 6) {
        const w = p.weapon;
        if (w === 'fist') this.startAttack('AIR');
        else if (w === 'katana') this.startAttack('KDASH');
        else if (w === 'dual') this.startAttack('DDASH');
        else if (w === 'axe') this.startAttack('ADASH');
        else if (w === 'nunchaku') this.startAttack('NDASH');
      }
      if (p.z <= 0 && p.vz < 0) {
        p.z = 0; p.vz = 0; p.airborne = false; p.landT = 0.12; p.squash = 0.72;
        this.sfx.land();
        this.particles.smoke(p.x, p.y, 5, '#888', 26, 0.4);
        this.shake(0.08);
        if (attacking && move?.air) {
          p.attackPhase = 'recover'; p.attackT = move.recover; this.shake(0.3); this.particles.shockwave(p.x, p.y, 18, '#ffffff', 0.25);
          for (const e of this.enemies) { if (e.dead || e.spawnT > 0 || p.hitSet.includes(e.id)) continue; if (dist(p.x, p.y, e.x, e.y) > 18 + e.r) continue; p.hitSet.push(e.id); this.meleeHitEnemy(e, move, Math.atan2(e.y - p.y, e.x - p.x), { x: p.x + Math.cos(p.aim) * 6, y: p.y - 2 }); }
        }
      }
    }
    p.squash = lerp(p.squash, 1, 1 - Math.exp(-16 * dt));

    // ---- SHADOW STEP (shift): fast i-frame dash, perfect-dodge rewards focus
    if (inp.hit('shift') && p.dashCd <= 0 && p.stunT <= 0 && p.holdT <= 0 && !traveling) {
      const dx = il > 0 ? ix : Math.cos(p.aim), dy = il > 0 ? iy : Math.sin(p.aim);
      p.dashT = 0.15; p.dashCd = 0.55 * this.stats.dashCd; p.dashDir = { x: dx, y: dy }; p.lean = { x: dx, y: dy }; p.sinceDash = 0;
      p.attackPhase = 'none'; p.buffered = null; p.parryT = 0; p.iframes = Math.max(p.iframes, 0.22);
      p.prevPose = 'dash';
      this.sfx.dash();
      this.particles.smoke(p.x, p.y, 5, '#7a6aa0', 28, 0.4);
      this.particles.dirBurst(p.x, p.y, 7, '#c7b3ff', Math.atan2(-dy, -dx), 0.5, 90, 0.3);
      this.particles.ring(p.x, p.y - 6, 2, 10, '#c7b3ff', 0.18, 1);
      // perfect dodge: a bullet or an attack was about to land
      let perfect = false;
      for (const b of this.bullets) if (b.owner === 'enemy' && dist(b.x, b.y, p.x, p.y - 5) < 22) { perfect = true; break; }
      if (!perfect) for (const e of this.enemies) if (!e.dead && (e.state === 'windup' || e.state === 'attack' || e.state === 'lunge') && dist(e.x, e.y, p.x, p.y) < 36) { perfect = true; break; }
      if (perfect) {
        p.focus = Math.min(300, p.focus + 25 * this.stats.focusGain);
        this.say('SHADOW STEP!', '#c7b3ff', 1, 0.6);
        this.slow(0.18, 0.35);
        this.particles.ring(p.x, p.y - 6, 4, 18, '#ffffff', 0.25, 1);
      }
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      const ds = 420 * this.stats.dashDist;
      p.vx = p.dashDir.x * ds; p.vy = p.dashDir.y * ds;
      this.addAfterimage({ x: p.x, y: p.y - p.z, facing: p.facing, aim: p.aim, scale: 1 }, '#8f7bdc', p.lean);
      if (Math.random() < 0.6) this.particles.add({ x: p.x + rnd(-4, 4), y: p.y - 6 + rnd(-5, 5), vx: -p.dashDir.x * 40, vy: -p.dashDir.y * 40, life: 0.25, c: '#c7b3ff', k: 0, s: 1 });
    }

    if (inp.hit('q')) this.cycleWeapon(1);
    if (inp.mouse.wheel !== 0) this.cycleWeapon(inp.mouse.wheel > 0 ? 1 : -1);
    if (inp.hit('1')) this.setWeapon('fist');
    if (inp.hit('2')) this.setWeapon('pistol');
    if (inp.hit('3') && p.hasRifle) this.setWeapon('rifle');
    if (inp.hit('4') && p.hasNunchaku) this.setWeapon('nunchaku');
    if (inp.hit('5') && p.hasKatana) this.setWeapon('katana');
    if (inp.hit('6') && p.hasAxe) this.setWeapon('axe');
    if (inp.hit('7') && p.hasDual) this.setWeapon('dual');

    // parry moved to RMB-hold? No: keep parry on a tap of RMB while not attacking is confusing; parry = C
    if (inp.hit('c') && p.parryCd <= 0 && p.dashT <= 0 && p.stunT <= 0 && !traveling && !p.airborne) {
      p.parryT = 0.2 * this.stats.parryWindow; p.parryCd = 0.5; p.parryHit = false;
      p.attackPhase = 'none'; p.buffered = null; p.z = 0;
      this.sfx.whoosh();
      this.particles.ring(p.x, p.y - 6, 3, 10, '#9be7ff', 0.15, 1);
    }
    if (p.parryT > 0) p.parryT -= dt;
    if (inp.hit('e')) this.tryFocus();
    if (inp.hit('f')) this.tryFatality();
    if (inp.hit('r')) this.tryRage();
    this.updateRage(dt, raw);
    if (p.rageDash) return;

    if (p.stunT <= 0 && p.holdT <= 0) {
      if (inp.mouse.rpressed && !p.airborne) this.queueAttack('H');
      if (p.weapon === 'fist' || p.weapon === 'nunchaku' || p.weapon === 'katana' || p.weapon === 'axe' || p.weapon === 'dual') {
        if (inp.mouse.pressed && !p.airborne) this.queueAttack('L');
        // HELICOPTER: holding RMB keeps the chain spinning as long as you hold it
        if (p.weapon === 'nunchaku' && inp.mouse.rdown && p.attackPhase === 'active' && p.moveKey === 'NH' && p.attackT < 0.1) p.attackT = 0.1;
      } else if (!attacking && p.dashT <= 0) {
        const semi = p.weapon === 'pistol';
        if ((semi ? inp.mouse.pressed || (inp.mouse.down && p.fireCd <= -0.15) : inp.mouse.down) && p.fireCd <= 0) this.fire();
      }
    }
    this.updateAttack(dt);
    this.updateNunchaku(dt);
    this.updateKatana(dt);

    // ---- apply movement
    const trav = p.attackPhase === 'active' && p.moveKey && MOVES[p.moveKey].travel;
    if (trav) {
      const m = MOVES[p.moveKey!];
      const sp = m.travel! * (p.travelHit ? 0.2 : 1);
      p.vx = Math.cos(p.aim) * sp; p.vy = Math.sin(p.aim) * sp;
    }
    const dx = (p.vx + p.kx) * dt, dy = (p.vy + p.ky) * dt;
    const blocked = moveWithCollision(this.level, p, dx, dy);
    if (trav && (blocked.bx || blocked.by)) p.travelHit = true;
    const fr = Math.max(0, 1 - 8 * dt); p.kx *= fr; p.ky *= fr;
    p.x = clamp(p.x, TILE, this.level.w * TILE - TILE); p.y = clamp(p.y, TILE, this.level.h * TILE - TILE);
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || e.z > 4 || p.z > 8) continue;
      const d = dist(p.x, p.y, e.x, e.y), min = p.r + e.r - 1;
      if (d < min && d > 0.01) {
        const o = (min - d) * 0.5, nx = (p.x - e.x) / d, ny = (p.y - e.y) / d;
        if (p.dashT <= 0 && !trav && this.isFree(p.x + nx * o, p.y + ny * o, p.r)) { p.x += nx * o; p.y += ny * o; }
        if (this.isFree(e.x - nx * o, e.y - ny * o, e.r)) { e.x -= nx * o; e.y -= ny * o; }
      }
    }
    unstick(this.level, p);
  }

  /** Blade angle follows the move's slash arc during the active frames; trails + iaijutsu bookkeeping. */
  updateKatana(dt: number) {
    const p = this.player;
    this.katana.update(dt);
    if (p.weapon !== 'katana' && p.weapon !== 'axe' && p.weapon !== 'dual') return;
    if (p.sheatheT > 0) p.sheatheT -= dt;
    const move = p.attackPhase !== 'none' && p.moveKey ? MOVES[p.moveKey] : null;
    p.bladePrevA = p.bladeA;
    if (move && move.slash) {
      const pt = this.attackPoseT();
      const s = move.slash;
      // windup: blade waits at the start angle; active (0.3-0.6): sweeps from->to; recover: eases back toward the aim
      const k = pt < 0.3 ? 0 : pt < 0.6 ? (pt - 0.3) / 0.3 : 1;
      const ease = k < 1 ? 1 - Math.pow(1 - k, 2.2) : 1;
      const rel = s.from + (s.to - s.from) * ease;
      const settle = pt > 0.6 ? clamp((pt - 0.6) / 0.4, 0, 1) : 0;
      p.bladeA = p.aim + rel * p.facing * (1 - settle) + 0 * settle;
      p.bladeB = p.aim - rel * p.facing * (1 - settle); // mirrored second blade (dual)
      if (move.id === 'k_heaven' || move.id === 'k_thrust' || move.id === 'k_iaijutsu') p.bladeA = p.aim + (move.id === 'k_heaven' ? (pt < 0.3 ? -1.4 * p.facing * (1 - pt / 0.3) - 0.3 * p.facing : 0.4 * p.facing * settle) : 0);
      // slash arc trail once per swing (and repeatedly for the spin/flurry moves)
      if (pt >= 0.3 && pt < 0.34 && !p.travelHit && s.from !== s.to) {
        const sk = solvePose(this.playerStickOpts(move.pose, pt));
        const hx = p.x + sk.fhand.x, hy = p.y + sk.fhand.y - p.z;
        const col = move.axe ? '#ffd27f' : '#bfe8ff';
        this.katana.addArc(hx, hy, s.r, p.aim + s.from * p.facing, p.aim + s.to * p.facing, col, s.lift ?? 0, move.rehit ? 0.3 : 0.22);
        if (move.dual) { const bx = p.x + sk.bhand.x, by = p.y + sk.bhand.y - p.z; this.katana.addArc(bx, by, s.r, p.aim - s.from * p.facing, p.aim - s.to * p.facing, col, s.lift ?? 0, 0.22); }
        if (!move.rehit) p.travelHit = true; // used as 'arc emitted' flag for the blade
        if (move.axe) this.sfx.axeSwing(); else if (move.dual) this.sfx.dualSwing(); else this.sfx.slash(move.id === 'k_heaven' || move.id === 'k_dragonfang' ? 0.7 : 1);
      }
      if (move.rehit && pt >= 0.3 && Math.random() < 0.5) {
        const sk = solvePose(this.playerStickOpts(move.pose, pt));
        const hx = p.x + sk.fhand.x, hy = p.y + sk.fhand.y - p.z;
        const a0 = p.bladePrevA, a1 = p.bladeA;
        if (Math.abs(a1 - a0) > 0.2) this.katana.addArc(hx, hy, s.r * 0.95, a0, a1, '#bfe8ff', 0, 0.12);
      }
      if (move.id === 'k_iaijutsu' && p.attackPhase === 'active') this.addAfterimage({ x: p.x, y: p.y - p.z, facing: p.facing, aim: p.aim, pose: 'k_iaijutsu', poseT: 0.5 }, '#bfe8ff', p.lean);
    } else {
      // idle: blade points along the aim (chudan guard)
      const target = p.aim + (p.sheatheT > 0 ? 0 : 0);
      p.bladeA += angleDiff(target, p.bladeA) * Math.min(1, dt * 18);
    }
  }

  /** iaijutsu: victims are frozen (doomed) while you dash through and sheathe; then they fall apart */
  iaiKill(e: Enemy) {
    if (e.dead) return;
    const a = Math.atan2(e.y - this.player.y, e.x - this.player.x);
    this.particles.blood(e.x, e.y - 6 - e.z, 40, a + Math.PI / 2, 180);
    this.particles.blood(e.x, e.y - 6 - e.z, 40, a - Math.PI / 2, 180);
    this.particles.fountain(e.x, e.y - 6, 14);
    this.sfx.slash(0.6); this.sfx.kill();
    this.hitstop = Math.max(this.hitstop, 0.06); this.shake(0.5);
    this.texts.add(e.x, e.y - 24, 'ONE CUT', '#ffffff', 1, 0.8);
    // split corpse: two halves slide apart
    const corpse = (vx: number, vy: number): Corpse => ({ x: e.x, y: e.y, rot: a, color: e.color, color2: e.color2, scale: e.scale, accessory: e.accessory, vx, vy, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
    this.corpses.push(corpse(Math.cos(a + Math.PI / 2) * 40, Math.sin(a + Math.PI / 2) * 40));
    this.corpses.push(corpse(Math.cos(a - Math.PI / 2) * 40, Math.sin(a - Math.PI / 2) * 40));
    this.splat(e.x, e.y, 26);
    this.addPool(e.x, e.y + 1, 9);
    if (e.boss) { e.doom = 0; return; }
    e.dead = true; this.kills++; this.score += Math.round(e.value * 1.5 * this.comboMult()); this.addCombo(2); this.dropLoot(e, true);
  }

  /** Drive the nunchaku chain from the posed hand every frame; the far stick is pure physics. */
  updateNunchaku(dt: number) {
    const p = this.player;
    if (p.weapon !== 'nunchaku') return;
    const move = p.attackPhase !== 'none' && p.moveKey ? MOVES[p.moveKey] : null;
    let pose: Pose = 'n_idle', t = 0;
    if (move) { pose = move.pose; t = this.attackPoseT(); }
    else if (p.dashT > 0) pose = 'dash';
    else if (p.moving && p.runT > 0.03) pose = 'run';
    const sk = solvePose(this.playerStickOpts(pose, t));
    const hand = { x: p.x + sk.fhand.x, y: p.y + sk.fhand.y - p.z };
    // the held stick points from the neck through the hand (extends the forearm)
    let ndx = sk.fhand.x - sk.neck.x, ndy = sk.fhand.y - sk.neck.y;
    const nl = Math.hypot(ndx, ndy) || 1; ndx /= nl; ndy /= nl;
    let spin = 0;
    let boost: Vec | null = null;
    if (move) {
      const ph = this.attackPoseT();
      switch (move.id) {
        case 'n_helicopter': case 'n_flyspin': spin = 26 * p.facing; break;
        case 'n_lowsweep': spin = -22 * p.facing; break;
        case 'n_tornado': spin = 30 * p.facing; break;
        case 'n_dragonlash': if (ph >= 0.28) { boost = { x: Math.cos(p.aim) * 1500, y: Math.sin(p.aim) * 900 + 300 }; } break;
        case 'n_figure8': spin = (Math.floor(ph * 4) % 2 === 0 ? 1 : -1) * 26; boost = { x: Math.cos(p.aim) * 350, y: Math.sin(p.aim) * 210 }; break;
        case 'n_tri1': case 'n_tri2': case 'n_tri3': case 'n_tri4': {
          if (ph >= 0.28 && ph <= 0.46) {
            const f = p.facing;
            const side = { x: -Math.sin(p.aim), y: Math.cos(p.aim) }; // screen 'left' of the facing direction
            let bx = 0, by = 0;
            if (move.id === 'n_tri1') { bx = Math.cos(p.aim) * 900 - side.x * f * 500; by = Math.sin(p.aim) * 540 + 700; }           // diagonal down-left
            else if (move.id === 'n_tri2') { bx = Math.cos(p.aim) * 1300; by = Math.sin(p.aim) * 500 - 900; }                       // bounce forward+up through the target to the shoulder
            else if (move.id === 'n_tri3') { bx = Math.cos(p.aim) * 1000 + side.x * f * 700; by = Math.sin(p.aim) * 600 + 80; }  // horizontal across the chest
            else { bx = Math.cos(p.aim) * 700 + side.x * f * 200; by = Math.sin(p.aim) * 420 + 900; }                                // catch: short downward smash
            boost = { x: bx, y: by };
          }
          break;
        }
        case 'n_lash': case 'n_cross': case 'n_whipcrack': case 'n_overhead': case 'n_choke': {
          // during the snap, fling the chain forward along the aim so the far stick whips out ahead of the hand
          if (ph >= 0.28 && ph <= 0.45) { const pow = move.id === 'n_whipcrack' ? 1400 : move.id === 'n_overhead' ? 1100 : 900; boost = { x: Math.cos(p.aim) * pow, y: Math.sin(p.aim) * pow * 0.6 + (move.id === 'n_overhead' ? 500 : 0) }; }
          break;
        }
      }
    }
    if (!move && p.weapon === 'nunchaku' && !p.moving && p.dashT <= 0) {
      // underarm tuck: the free stick is held folded back along the forearm (gentle pull toward the armpit)
      boost = { x: -ndx * 260, y: -ndy * 160 - 120 };
    }
    if (spin !== 0 && this.nunchaku.spinSpeed === 0) this.nunchaku.spinAng = Math.atan2(ndy, ndx);
    this.nunchaku.spinSpeed = spin;
    this.nunchaku.update(hand, { x: ndx, y: ndy }, dt, spin, boost);
    // WHIP CRACK: the moment the chain snaps taut at full reach during the crack move
    if (move && (move.id === 'n_whipcrack' || move.id === 'n_overhead') && !p.travelHit && this.attackPoseT() > 0.33 && this.nunchaku.tautness() > 0.93 && this.nunchaku.tipSpeed > 300) {
      p.travelHit = true; // reused as 'cracked' flag for nunchaku moves
      const tp = this.nunchaku.tip();
      this.sfx.nunchakuHit(true); this.sfx.hit();
      this.particles.impact(tp.x, tp.y, 7, '#ffffff');
      this.particles.ring(tp.x, tp.y, 2, 9, '#ffffff', 0.15, 1);
      this.shake(0.15);
    }
    // chatter / whoosh feedback
    if (this.nunchaku.tipSpeed > 260 && Math.random() < 0.25) this.sfx.chainRattle();
    if (this.nunchaku.tipSpeed > 420 && Math.random() < 0.5) { const tp = this.nunchaku.tip(); this.particles.lines(tp.x, tp.y, 1, 'rgba(255,255,255,0.6)', Math.atan2(tp.y - this.nunchaku.prevTip.y, tp.x - this.nunchaku.prevTip.x) + Math.PI, 120); }
  }

  cycleWeapon(dir: number) {
    const p = this.player;
    const owned: WeaponKind[] = ['fist', 'pistol'];
    if (p.hasRifle) owned.push('rifle');
    if (p.hasNunchaku) owned.push('nunchaku');
    if (p.hasKatana) owned.push('katana');
    if (p.hasAxe) owned.push('axe');
    if (p.hasDual) owned.push('dual');
    const i = (owned.indexOf(p.weapon) + dir + owned.length) % owned.length;
    this.setWeapon(owned[i]);
  }
  setWeapon(w: WeaponKind) {
    const p = this.player;
    if (p.weapon === w) return;
    p.weapon = w;
    this.sfx.select();
    this.texts.add(p.x, p.y - 22, w === 'fist' ? 'KUNG FU' : w.toUpperCase(), '#ffffff', 1, 0.5);
    if (w === 'nunchaku') this.nunchaku.reset(p.x + p.facing * 4, p.y - 8);
    if (w === 'katana') { this.katana.sheen = 0.25; p.sheatheT = 0; }
    if (w === 'axe') this.sfx.axeSwing();
    if (w === 'dual') this.sfx.dualSwing();
    p.comboStr = ''; p.attackPhase = 'none'; p.buffered = null;
  }

  // ------------------------------------------------------------------ guns
  fire() {
    const p = this.player;
    const w = p.weapon;
    if (w === 'fist') return;
    const ammo = w === 'pistol' ? p.ammoP : p.ammoR;
    if (ammo <= 0) {
      this.sfx.empty();
      this.texts.add(p.x, p.y - 22, 'EMPTY! FISTS!', '#ff3b3b', 1, 0.7);
      this.setWeapon('fist');
      return;
    }
    if (w === 'pistol') p.ammoP--; else p.ammoR--;
    const pistol = w === 'pistol';
    p.fireCd = (pistol ? 0.19 : 0.082) / this.stats.fireRate;
    const spread = (pistol ? 0.012 : 0.03) + p.bloom;
    p.bloom = Math.min(pistol ? 0.08 : 0.16, p.bloom + (pistol ? 0.03 : 0.022));
    const a = p.aim + rnd(-spread, spread);
    const sp = pistol ? 640 : 720;
    const hx = p.x + Math.cos(p.aim) * 11, hy = p.y - 7 + Math.sin(p.aim) * 7;
    this.bullets.push({
      x: hx, y: hy, px: hx, py: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2, dmg: (pistol ? 4 : 2) + this.stats.bulletDmg, owner: 'player',
      life: 1.2, color: pistol ? '#fff6c8' : '#ffe08a', pierce: this.stats.pierce, bounce: this.stats.bounce, kind: pistol ? 'pistol' : 'rifle', hitIds: [],
      structure: pistol ? 10 : 5, kb: pistol ? 90 : 35,
    });
    p.muzzleMax = pistol ? 0.07 : 0.05;
    p.muzzle = p.muzzleMax; p.muzzleX = hx; p.muzzleY = hy; p.muzzleA = a;
    this.particles.spark(hx + Math.cos(a) * 3, hy + Math.sin(a) * 3, pistol ? 6 : 3, '#fff3a0', a, 0.45, 180);
    if (pistol) this.particles.smoke(hx + Math.cos(a) * 4, hy + Math.sin(a) * 4, 2, '#777', 16, 0.5);
    this.particles.casing(p.x + Math.cos(p.aim) * 4, p.y - 6, p.aim, p.facing);
    this.sfx.shot(pistol ? 'pistol' : 'rifle');
    this.shake(pistol ? 0.28 : 0.16);
    p.recoil = 1;
    p.shootT = 0.12;
    p.kx -= Math.cos(p.aim) * (pistol ? 26 : 12); p.ky -= Math.sin(p.aim) * (pistol ? 26 : 12);
    this.camKick.x -= Math.cos(p.aim) * (pistol ? 5 : 2.5); this.camKick.y -= Math.sin(p.aim) * (pistol ? 5 : 2.5);
  }

  // ------------------------------------------------------------------ kung fu
  queueAttack(k: 'L' | 'H') {
    const p = this.player;
    if (p.stunT > 0 || p.fatality || p.focusDash || p.holdT > 0 || p.rageDash) return;
    // ---- RAGE: every LMB dashes to the nearest enemy and executes it
    if (k === 'L' && p.rageOn && p.weapon === 'fist') { this.rageStrike(); return; }
    // ---- FREESTYLE RHYTHM ENGINE (fists): the tempo of your clicks picks the style and the game chains the moves
    if (k === 'L' && p.weapon === 'fist' && !p.airborne && !p.running && p.dashT <= 0 && p.sinceDash > 0.2) {
      const gap = this.time - p.chainLast;
      p.chainLast = this.time;
      if (gap <= 1.1) { p.rhythm.push(gap); if (p.rhythm.length > 4) p.rhythm.shift(); } else { p.rhythm = []; p.style = 'none'; p.styleStreak = 0; p.flowStep = 0; p.chain = 0; }
      const style = this.classifyRhythm();
      if (style !== 'none') { this.flowMove(style); return; }
    }
    const cur = p.moveKey ? MOVES[p.moveKey] : null;
    if (p.attackPhase === 'none' || (p.attackPhase === 'recover' && cur && p.attackT < cur.recover * 0.65)) this.startAttackInput(k);
    else p.buffered = k;
  }

  /** Tempo -> style. Needs 2 consistent gaps so a single fast double-click doesn't flip styles. */
  classifyRhythm(): 'none' | 'wingchun' | 'blackleg' | 'kungfu' {
    const p = this.player;
    const r = p.rhythm;
    if (r.length < 2) return 'none';
    const a = r[r.length - 1], b = r[r.length - 2];
    const cls = (x: number) => (x >= 0.06 && x < 0.3 ? 'wingchun' : x >= 0.3 && x < 0.62 ? 'blackleg' : x >= 0.62 && x <= 1.05 ? 'kungfu' : 'none');
    const ca = cls(a), cb = cls(b);
    if (ca === 'none') return 'none';
    // continuing an established style tolerates one off-beat; switching styles needs two beats in the new tempo
    if (ca === p.style) return ca;
    if (ca === cb) return ca;
    return p.style !== 'none' && p.styleStreak > 0 ? p.style : 'none';
  }

  /** Advance the chosen style's auto-combo by one move. Styles have their own flows; transitions get a bridge move. */
  flowMove(style: 'wingchun' | 'blackleg' | 'kungfu') {
    const p = this.player;
    const switching = p.style !== style && p.style !== 'none';
    if (p.style !== style) { p.style = style; p.flowStep = 0; p.styleStreak = 0; p.chain = 0; if (switching) this.say(style === 'wingchun' ? 'WING CHUN' : style === 'blackleg' ? 'BLACK LEG' : 'KUNG FU', this.pal.accent2, 2, 0.6); }
    p.styleStreak++;
    p.styleHeat = Math.min(1, p.styleHeat + 0.08);
    if (p.styleStreak === 2) this.say(style === 'wingchun' ? 'WING CHUN' : style === 'blackleg' ? 'BLACK LEG STYLE' : 'KUNG FU', this.pal.accent2, 1, 0.6);
    // target state decides finishers
    const target = this.nearestEnemy(p.x, p.y, 34, p.aim, 1.5) ?? this.nearestEnemy(p.x, p.y, 22, p.aim, 2.8);
    const nearlyDead = !!target && !target.boss && target.hp <= Math.max(3, target.maxHp * 0.22);
    const bossSoft = !!target && target.boss && target.structure >= target.maxStructure * 0.6;
    if (style === 'wingchun') { this.chainPunch(); return; }
    // bridge move when switching styles: a flashy transition that fits the new tempo
    if (switching) { p.attackPhase = 'none'; p.buffered = null; p.comboStr = ''; this.startAttack(style === 'blackleg' ? 'S4' : 'HH'); return; }
    const flows: Record<'blackleg' | 'kungfu', string[]> = {
      blackleg: ['S1', 'S2', 'S3', 'S4', 'S5', 'S1', 'S3', 'S2', 'S6', 'S7', 'S8'],
      kungfu: ['H', 'KF1', 'LH', 'KF2', 'LLLH', 'HHL', 'LHH', 'LLLLH', 'HLL'],
    };
    const flow = flows[style];
    let key = flow[p.flowStep % flow.length];
    if ((nearlyDead || bossSoft) && p.styleStreak >= 2) key = style === 'blackleg' ? (p.flowStep % 2 ? 'S8' : 'S5') : (p.flowStep % 2 ? 'LLLH' : 'HHL');
    p.flowStep++;
    // fire NOW (interrupt the previous move's recovery so the flow feels continuous)
    const cur = p.moveKey ? MOVES[p.moveKey] : null;
    if (p.attackPhase === 'windup' || (p.attackPhase === 'active' && cur && p.attackT > cur.active * 0.5)) { p.buffered = 'L'; this._pfk = key; return; }
    p.attackPhase = 'none'; p.buffered = null; p.comboStr = '';
    this.startAttack(key);
    if (MOVES[key].finisher) this.say(MOVES[key].name, this.pal.accent2, 2, 0.8);
  }

  /** one link of the Wing Chun chain: instant restart of the punch with the other fist; finish when the target is nearly dead */
  chainPunch() {
    const p = this.player;
    p.chain++;
    p.chainSide *= -1;
    const target = this.nearestEnemy(p.x, p.y, 30, p.aim, 1.4) ?? this.nearestEnemy(p.x, p.y, 20, p.aim, 2.8);
    if (target) {
      // almost dead (or a very long chain): the next click is the FINISH
      const nearlyDead = target.hp <= Math.max(3, target.maxHp * 0.22) && !target.boss;
      const bossSoft = target.boss && target.structure >= target.maxStructure * 0.6;
      if (nearlyDead || bossSoft || p.chain >= 24) {
        p.chain = 0;
        this.startAttack('CHAINEND');
        this.say('WING CHUN FINISH', this.pal.accent2, 2, 0.8);
        return;
      }
    }
    // hard reset of the attack state so the next fist fires immediately (no recovery wait)
    p.attackPhase = 'none'; p.buffered = null; p.comboStr = '';
    this.startAttack('CHAIN');
    // speed lines + alternating fist flash
    this.particles.lines(p.x + Math.cos(p.aim) * 8, p.y - 6 + Math.sin(p.aim) * 5, 2, '#ffffff', p.aim, 220);
    if (p.chain === 6) this.say('CHAIN PUNCH!', this.pal.accent2, 2, 0.7);
    if (p.chain > 0 && p.chain % 10 === 0) this.say(`${p.chain} CHAIN`, '#ffe66d', 1, 0.5);
  }

  /** RAGE activation (R) when the meter is full */
  tryRage() {
    const p = this.player;
    if (p.rageOn) return;
    if (p.rage < 100) { this.texts.add(p.x, p.y - 22, 'RAGE NOT READY', '#777', 1, 0.5); this.sfx.empty(); return; }
    p.rage = 100; p.rageOn = true; p.rageT = 8; p.rageKills = 0; this.rageReadySaid = false;
    this.setWeapon('fist');
    this.say('RAGE!', '#ff2a2a', 4, 1.2);
    this.sfx.announce(); this.sfx.focus();
    this.flash('#ff2a2a', 0.5); this.shake(0.8); this.slow(0.5, 0.25);
    this.particles.shockwave(p.x, p.y - 4, 60, '#ff2a2a', 0.5);
    for (const e of this.enemies) if (!e.dead && dist(e.x, e.y, p.x, p.y) < 60) { e.stun = Math.max(e.stun, 0.6); e.state = 'stun'; }
  }

  /** RAGE LMB: blur-dash to the nearest enemy, then an execution strike */
  rageStrike() {
    const p = this.player;
    let e = this.nearestEnemy(p.x, p.y, 170, p.aim, 1.3);
    if (!e) e = this.nearestEnemy(p.x, p.y, 170, p.aim, Math.PI);
    if (!e) { this.startAttack('LLLL'); return; } // nobody near: a spinning kick for show
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    const gap = e.r + p.r + 3;
    p.rageDash = { sx: p.x, sy: p.y, tx: e.x - Math.cos(a) * gap, ty: e.y - Math.sin(a) * gap, t: 0, id: e.id };
    p.attackPhase = 'none'; p.buffered = null; p.comboStr = ''; p.aim = a; p.attackAim = a; p.facing = Math.cos(a) >= 0 ? 1 : -1; p.z = 0;
    e.stun = Math.max(e.stun, 0.5); e.state = 'stun';
    this.sfx.dash(); this.sfx.whoosh();
    this.particles.ring(p.x, p.y - 6, 2, 16, '#ff2a2a', 0.2, 1);
  }

  updateRage(dt: number, raw: number) {
    const p = this.player;
    if (p.rageOn) {
      p.rageT -= dt; p.rage = Math.max(0, 100 * (p.rageT / 8));
      if (Math.random() < 0.6) this.particles.add({ x: p.x + rnd(-5, 5), y: p.y - 6 + rnd(-8, 4), vx: rnd(-10, 10), vy: rnd(-50, -20), life: rnd(0.3, 0.6), c: Math.random() < 0.5 ? '#ff2a2a' : '#ffb347', k: 7 });
      if (p.rageT <= 0) { p.rageOn = false; p.rage = 0; p.rageDash = null; this.say('RAGE OVER', '#9a9a9a', 1, 0.8); }
    }
    if (p.rageDash) {
      const rd = p.rageDash;
      rd.t += raw / 0.1;
      const k = Math.min(1, rd.t), ek = 1 - Math.pow(1 - k, 3);
      const nx = lerp(rd.sx, rd.tx, ek), ny = lerp(rd.sy, rd.ty, ek);
      if (this.isFree(nx, ny, p.r)) { p.x = nx; p.y = ny; }
      this.addAfterimage({ x: p.x, y: p.y, facing: p.facing, aim: p.aim, pose: 'ragedash', poseT: 0 }, '#ff2a2a', { x: Math.cos(p.aim), y: Math.sin(p.aim) });
      if (k >= 1) {
        const e = this.enemies.find((en) => en.id === rd.id);
        p.rageDash = null;
        if (e && !e.dead) { p.aim = Math.atan2(e.y - p.y, e.x - p.x); p.attackAim = p.aim; }
        this.startAttack('RAGEKILL');
        p.iframes = Math.max(p.iframes, 0.35);
      }
    }
    // chain / style decay when the rhythm stops
    if (p.chain > 0 && this.time - p.chainLast > 0.5) p.chain = 0;
    if (this.time - p.chainLast > 1.2) { if (p.style !== 'none') { p.style = 'none'; p.styleStreak = 0; p.flowStep = 0; p.rhythm = []; } p.styleHeat = Math.max(0, p.styleHeat - dt * 0.6); }
    // all style moves build rage a little (chain builds the most); heat makes every style flow faster
    this.timeScaleBonus = 1 + 0.25 * p.styleHeat;
  }
  startAttackInput(k: 'L' | 'H') {
    const p = this.player;
    let key: string;
    const running = p.running || (p.runT > 0.25 && p.moving);
    if (p.weapon === 'nunchaku') {
      // nunchaku tree: N + sequence. RUN + LMB = DRAGON LASH (lethal charge), dash + LMB = flying helicopter.
      if (k === 'L' && running && p.comboStr === '' && p.tkdCd <= 0) { key = 'NRUN'; p.tkdCd = 1.1; this.say('DRAGON LASH!', this.pal.accent2, 2, 0.7); this.sfx.launch(); }
      else if (k === 'L' && (p.dashT > 0 || p.sinceDash < 0.16 || (running && p.comboStr === ''))) key = 'NDASH';
      else {
        const base = p.comboStr.startsWith('N') ? p.comboStr : 'N';
        const cand = base + k;
        key = MOVES[cand] ? cand : 'N' + k;
      }
      this.startAttack(key);
      return;
    }
    if (p.weapon === 'axe' || p.weapon === 'dual') {
      const R = p.weapon === 'axe' ? 'A' : 'D';
      if (k === 'L' && running && p.comboStr === '' && p.tkdCd <= 0) { key = R + 'RUN'; p.tkdCd = p.weapon === 'axe' ? 1.5 : 1.2; this.say(MOVES[key].name, p.weapon === 'axe' ? '#ffb347' : '#bfe8ff', 2, 0.7); if (p.weapon === 'axe') this.sfx.launch(); else this.sfx.dualSwing(); }
      else if (k === 'L' && (p.dashT > 0 || p.sinceDash < 0.16 || (running && p.comboStr === ''))) key = R + 'DASH';
      else { const base = p.comboStr.startsWith(R) ? p.comboStr : R; const cand = base + k; key = MOVES[cand] ? cand : R + k; }
      this.startAttack(key);
      return;
    }
    if (p.weapon === 'katana') {
      // katana tree: K + sequence. RUN + LMB = IAIJUTSU dash-through, dash + LMB = dash cut.
      if (k === 'L' && running && p.comboStr === '' && p.tkdCd <= 0) { key = 'KRUN'; p.tkdCd = 1.3; this.say('IAIJUTSU', '#ffffff', 2, 0.7); this.sfx.whoosh(); }
      else if (k === 'L' && (p.dashT > 0 || p.sinceDash < 0.16 || (running && p.comboStr === ''))) key = 'KDASH';
      else {
        const base = p.comboStr.startsWith('K') ? p.comboStr : 'K';
        const cand = base + k;
        key = MOVES[cand] ? cand : 'K' + k;
      }
      this.startAttack(key);
      return;
    }
    if (k === 'L' && (p.dashT > 0 || p.sinceDash < 0.16)) key = 'DASH';
    else if (k === 'L' && running && p.comboStr === '') {
      // RUN + LEFT CLICK = Taekwondo flying side kick (falls back to the running straight while on cooldown)
      if (p.tkdCd <= 0) {
        key = 'TKD';
        p.tkdCd = 0.9;
        p.tkdDir = { x: Math.cos(p.aim), y: Math.sin(p.aim) };
        this.say('TAEKWONDO!', this.pal.accent2, 2, 0.7);
        this.sfx.launch();
      } else key = 'RUNPUNCH';
    }
    else if (k === 'H' && running && p.comboStr === '' && p.weapon === 'fist') key = p.tkdCd > 0.45 ? 'DASH' : this.runHeavyToggle++ % 2 === 0 ? 'RUNPUNCH' : 'DASH';
    else { const cand = p.comboStr + k; key = MOVES[cand] ? cand : k; }
    this.startAttack(key);
  }
  /** attack-token system: how many melee enemies may press the attack at once */
  maxTokens() {
    if (this.mode === 'survival') return Math.min(6, 1 + Math.floor(this.wave / 3));
    return this.levelN < 8 ? 1 : this.levelN < 35 ? 2 : this.levelN < 110 ? 3 : 4;
  }
  /** 0..1 how smart/aggressive the AI behaves right now */
  brutality() {
    return this.mode === 'survival' ? clamp(this.wave / 18, 0, 1) : clamp(this.levelN / 160, 0, 1);
  }
  releaseToken(e: Enemy) {
    if (e.token) { e.token = false; e.tokenT = 0; }
  }
  slotCount(role: 'melee' | 'ranged') {
    let n = 0;
    for (const e of this.enemies) if (!e.dead && e.role === role && e.kind !== 'boss' && e.kind !== 'bomber') n++;
    return n;
  }
  /** assign ring slots + attack tokens; called every frame (cheap) */
  updateTactics(dt: number) {
    const p = this.player;
    const melee: Enemy[] = [], ranged: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || e.kind === 'boss' || e.kind === 'bomber') continue;
      (e.role === 'melee' ? melee : ranged).push(e);
    }
    // slots: sort by angle around the player so neighbours don't cross paths, assign evenly
    // each enemy's ring angle = its own bearing, relaxed toward the midpoint between its angular neighbours.
    // Nobody is ever sent to the far side of the player, so they spread out without crossing through him.
    const relax = (arr: Enemy[]) => {
      arr.sort((a, b) => Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x));
      const n = arr.length;
      const angs = arr.map((e) => Math.atan2(e.y - p.y, e.x - p.x));
      for (let i = 0; i < n; i++) {
        arr[i].slot = i;
        if (n === 1) { arr[i].slotAng = angs[i]; continue; }
        const prev = angs[(i - 1 + n) % n] - (i === 0 ? Math.PI * 2 : 0);
        const next = angs[(i + 1) % n] + (i === n - 1 ? Math.PI * 2 : 0);
        const minGap = Math.min(1.1, Math.PI * 2 / n); // keep at least this much arc from the neighbours when possible
        let a = angs[i];
        if (a - prev < minGap) a += (minGap - (a - prev)) * 0.5;
        if (next - a < minGap) a -= (minGap - (next - a)) * 0.5;
        arr[i].slotAng = a;
      }
    };
    relax(melee); relax(ranged);
    // tokens: expire stale ones, hand out to the closest eligible attackers
    let held = 0;
    for (const e of melee) {
      if (e.token) { e.tokenT -= dt; if (e.tokenT <= 0 || e.stagger > 0 || e.down > 0) this.releaseToken(e); else held++; }
    }
    const max = this.maxTokens();
    this.tokenTimer -= dt;
    if (held < max && this.tokenTimer <= 0) {
      const cands = melee.filter((e) => !e.token && e.stagger <= 0 && e.down <= 0 && e.stun <= 0 && e.attackCd <= 0.3 && e.state === 'chase').sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
      // one attacker at a time with a short gap between hand-offs; sometimes a coordinated pair/trio rushes together
      const coordinated = Math.random() < 0.2 + this.brutality() * 0.5;
      const want = coordinated ? max : Math.min(max, held + 1);
      for (const e of cands) {
        if (held >= want) break;
        e.token = true; e.tokenT = 2.4; held++;
      }
      this.tokenTimer = coordinated ? 1.0 - this.brutality() * 0.5 : Math.max(0.1, 0.45 - this.brutality() * 0.3);
    }
    // separation vectors (allies + player) so nobody stacks
    const all = this.enemies;
    for (const e of all) {
      e.sepx = 0; e.sepy = 0;
      if (e.dead || e.spawnT > 0) continue;
      for (const o of all) {
        if (o === e || o.dead || o.spawnT > 0) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d = Math.hypot(dx, dy);
        const want = (e.r + o.r) * 2.2;
        if (d < want && d > 0.01) { const f = (want - d) / want; e.sepx += (dx / d) * f; e.sepy += (dy / d) * f; }
      }
    }
  }
  startAttack(key: string) {
    const p = this.player;
    const move = MOVES[key];
    p.comboStr = ['DASH', 'FOCUS', 'RUNPUNCH', 'NDASH', 'NRUN', 'KDASH', 'KRUN', 'ARUN', 'ADASH', 'DRUN', 'DDASH', 'TKD', 'AIR', 'CHAIN', 'CHAINEND', 'RAGEKILL'].includes(key) ? '' : key;
    if (move.katana || move.axe || move.dual) { p.iaiVictims = []; p.sheatheT = 0; p.bladeA = p.aim + (move.slash ? move.slash.from * p.facing : 0); p.bladePrevA = p.bladeA; p.bladeB = p.aim - (move.slash ? move.slash.from * p.facing : 0); }
    p.moveKey = key; p.attackPhase = 'windup'; p.attackT = move.windup; p.attackElapsed = 0; p.hitSet = []; p.hitTimes = {}; p.prevLimb = null; p.travelHit = false; this.prevBlade = null;
    p.comboTimer = 0.9;
    if (key !== 'FOCUS') {
      // soft aim assist: snap toward the nearest enemy in a generous cone around the cursor direction
      const searchArc = Math.max(1.3, move.arc + 0.7);
      let target = this.nearestEnemy(p.x, p.y, move.range * this.stats.meleeRange * 1.7 + 12 + (move.travel ? 50 : 0), p.aim, searchArc);
      // point-blank: an enemy touching you gets the strike even if the cursor drifted behind you
      if (!target) target = this.nearestEnemy(p.x, p.y, 16, p.aim, 2.6);
      if (target) {
        const ta = Math.atan2(target.y - p.y, target.x - p.x);
        p.aim += angleDiff(ta, p.aim) * 0.85;
      }
    }
    p.attackAim = p.aim;
    p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;
    if (p.dashT > 0) p.dashT = 0;
    p.parryT = 0;
    p.runT = 0; p.running = false;
    if (move.jump && !move.air) { this.particles.smoke(p.x, p.y, 5, '#888', 30, 0.4); p.squash = 0.85; }
    if (move.id === 'tkd') {
      p.lean = { x: Math.cos(p.aim), y: Math.sin(p.aim) }; p.tkdDir = { ...p.lean };
      this.particles.dirBurst(p.x, p.y, 8, '#cfcfcf', p.aim + Math.PI, 0.5, 110, 0.35);
      this.particles.ring(p.x, p.y, 3, 12, '#ffffff', 0.18, 1);
    }
  }
  attackPoseT() {
    const p = this.player;
    if (!p.moveKey) return 0;
    const m = MOVES[p.moveKey];
    if (p.attackPhase === 'windup') return 0.3 * (1 - p.attackT / m.windup);
    if (p.attackPhase === 'active') return 0.3 + 0.3 * (1 - p.attackT / m.active);
    if (p.attackPhase === 'recover') return 0.6 + 0.4 * (1 - p.attackT / m.recover);
    return 0;
  }
  updateAttack(dt: number) {
    const p = this.player;
    if (p.attackPhase === 'none') {
      if (p.comboStr) { p.comboTimer -= dt; if (p.comboTimer <= 0) p.comboStr = ''; }
      return;
    }
    const move = MOVES[p.moveKey!];
    const spd = move.id === 'chain' ? 1 : this.timeScaleBonus;
    p.attackT -= dt * spd;
    p.attackElapsed += dt * spd;
    if (p.attackPhase === 'windup') {
      if (p.attackT <= 0) {
        p.attackPhase = 'active'; p.attackT = move.active;
        p.kx += Math.cos(p.aim) * move.lunge; p.ky += Math.sin(p.aim) * move.lunge;
        this.sfx.swing(move.sfx === 'heavy' ? 0.7 : move.sfx === 'kick' ? 0.85 : move.sfx === 'nunchaku' ? 1.4 : 1.1);
        if (move.nunchaku) { this.nunchaku.spinSpeed = 0; if (move.id === 'n_whipcrack' || move.id === 'n_overhead') this.sfx.whoosh(); }
        const a = p.aim;
        const fx = p.x + Math.cos(a) * 9, fy = p.y - 6 + Math.sin(a) * 6;
        switch (move.id) {
          case 'jab': case 'cross': this.particles.lines(fx, fy, 3, '#ffffff', a, 240); break;
          case 'runpunch': this.particles.lines(fx, fy, 6, '#ffffff', a, 320); this.particles.smoke(p.x, p.y, 4, '#888', 30, 0.4); break;
          case 'sweep': this.particles.ring(p.x, p.y, 6, move.range * this.stats.meleeRange, '#ffffff', 0.22, 1); this.particles.smoke(p.x, p.y, 5, '#777', 30, 0.4); break;
          case 'roundhouse': this.particles.smoke(p.x, p.y, 3, '#777', 25, 0.35); break;
          case 'dragon': case 'focus':
            this.particles.smoke(p.x, p.y, 6, '#888', 35, 0.45);
            this.particles.dirBurst(fx, fy, 8, '#ffffff', -Math.PI / 2, 0.35, 180, 0.3);
            if (move.id === 'focus') this.particles.shockwave(p.x, p.y - 4, 30, this.pal.accent, 0.3);
            break;
          case 'palm': this.particles.ring(fx, fy, 2, 10, '#ffffff', 0.15, 1); break;
          case 'flying': this.sfx.launch(); this.particles.dirBurst(p.x, p.y, 6, '#cfcfcf', a + Math.PI, 0.4, 90, 0.3); break;
        }
      }
    }
    if (p.attackPhase === 'active') {
      if (move.travel) {
        const prog = 1 - p.attackT / move.active;
        if (!move.air) p.z = (move.jump ?? 0) * Math.sin(Math.PI * clamp(prog, 0, 1));
        this.addAfterimage({ x: p.x, y: p.y - p.z, facing: p.facing, aim: p.aim, pose: move.pose, poseT: move.id === 'tkd' ? 0.5 : 0.45 }, this.pal.accent, p.lean);
        if (Math.random() < 0.8) this.particles.lines(p.x - Math.cos(p.aim) * 6, p.y - 6 - Math.sin(p.aim) * 4, 1, '#ffffff', p.aim + Math.PI, 160);
        if (move.air) { p.vz = Math.min(p.vz, -90); }
      }
      this.resolveMelee(move);
      if (p.attackT <= 0) {
        p.attackPhase = 'recover'; p.attackT = move.recover;
        if (move.jump && !move.air) { p.z = 0; p.squash = 0.78; this.particles.smoke(p.x, p.y, 6, '#888', 30, 0.4); this.sfx.land(); this.shake(0.15); }
      }
    } else if (p.attackPhase === 'recover') {
      if (p.buffered && p.attackT < move.recover * 0.65) { const b = p.buffered; p.buffered = null; if (this._pfk) { const k2 = this._pfk; this._pfk = null; this.startAttack(k2); } else this.startAttackInput(b); return; }
      if (p.attackT <= 0) {
        p.attackPhase = 'none'; p.buffered = null; p.comboTimer = 0.9;
        if (move.finisher || p.moveKey === 'FOCUS' || p.moveKey === 'NH' || p.moveKey === 'NHL' || p.moveKey === 'LLH' || p.moveKey === 'KLLL') p.comboStr = '';
        if (p.moveKey === 'NLLLL' && p.buffered === 'L') { /* allow the 5th hit: keep the chain alive one more input */ p.comboStr = 'NLLLL'; }
        if (move.katana) { p.sheatheT = 0.45; if (move.id === 'k_iaijutsu') { this.sfx.sheathe(); this.slow(0.25, 0.3); } }
      }
    }
  }

  /** World position of the striking limb for the current frame of the current move (from the real animated skeleton). */
  /** current blade segment in world space (hand -> tip) for a katana move */
  bladeSeg(move: Move, second = false): { base: Vec; tip: Vec } {
    const p = this.player;
    const sk = solvePose(this.playerStickOpts(move.pose, this.attackPoseT()));
    const hand = second ? { x: p.x + sk.bhand.x, y: p.y + sk.bhand.y - p.z } : { x: p.x + sk.fhand.x, y: p.y + sk.fhand.y - p.z };
    const len = move.axe ? AXE_LEN : move.dual ? DUAL_LEN : this.katana.len;
    const ang = second ? p.bladeB : p.bladeA;
    const lift = move.slash?.lift ?? 0;
    return { base: hand, tip: { x: hand.x + Math.cos(ang) * len, y: hand.y + Math.sin(ang) * len * 0.6 - lift * 10 } };
  }
  strikePoint(move: Move): { pt: Vec; r: number; seg?: { base: Vec; tip: Vec }; seg2?: { base: Vec; tip: Vec } } | null {
    const p = this.player;
    if (move.limb === 'blade' || move.limb === 'blade2') {
      const b = this.bladeSeg(move);
      return { pt: { x: (b.base.x + b.tip.x * 2) / 3, y: (b.base.y + b.tip.y * 2) / 3 }, r: move.hitR, seg: b, seg2: move.limb === 'blade2' ? this.bladeSeg(move, true) : undefined };
    }
    if (move.limb === 'nunchaku') {
      const tip = this.nunchaku.tip();
      const mid = this.nunchaku.farMid();
      // hitbox covers the far stick: point between its middle and tip
      return { pt: { x: (tip.x + mid.x) / 2, y: (tip.y + mid.y) / 2 }, r: move.hitR + this.stats.meleeRange * 1.5 - 1.5 };
    }
    const sk = solvePose(this.playerStickOpts(move.pose, this.attackPoseT()));
    const lift = p.z;
    const at = (v: Vec): Vec => ({ x: p.x + v.x, y: p.y + v.y - lift });
    if (move.id === 'chain') return { pt: at(p.chainSide < 0 ? sk.bhand : sk.fhand), r: move.hitR };
    switch (move.limb) {
      case 'fhand': return { pt: at(sk.fhand), r: move.hitR };
      case 'bhand': return { pt: at(sk.bhand), r: move.hitR };
      case 'ffoot': return { pt: at(sk.ffoot), r: move.hitR };
      case 'bfoot': return { pt: at(sk.bfoot), r: move.hitR };
      case 'both': { const a = at(sk.fhand), b = at(sk.bhand); return { pt: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, r: move.hitR + 1.5 }; }
      case 'sweep': return { pt: at(sk.ffoot), r: move.hitR + 1 };
      default: return { pt: { x: p.x, y: p.y - 6 }, r: move.hitR + 4 };
    }
  }

  /** distance from point c to segment ab */
  segDist(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(cx - (ax + dx * t), cy - (ay + dy * t));
  }

  /**
   * Hit resolution that matches what you see: the limb (fist / foot / nunchaku stick) carrying the move is sampled
   * from the animated skeleton every frame; the segment it swept since the previous frame is tested against enemy
   * bodies. No more "hit from 20px away before the arm is extended".
   */
  resolveMelee(move: Move) {
    const p = this.player;
    const sp = this.strikePoint(move);
    if (!sp) return;
    const cur = sp.pt;
    const prev = p.prevLimb ?? cur;
    p.prevLimb = cur;
    const prevBladeThisFrame = this.prevBlade;
    if (sp.seg) this.prevBlade = { base: { ...sp.seg.base }, tip: { ...sp.seg.tip } };
    void prevBladeThisFrame;
    // the strike only counts during the impact window of the animation (the snap + settle part)
    const pt = this.attackPoseT();
    const wide = move.limb === 'nunchaku' || move.limb === 'blade' || move.rehit || move.id === 'spinback' || move.id === 'sweep' || move.id === 'axekick' || move.id === 'dragontail' || move.id === 'monkeyflip';
    const spin360 = move.id === 'spinback' || move.id === 'dragontail' || move.id === 'sweep';
    const impactWindow = move.id === 'chain' ? pt >= 0.08 && pt <= 0.6 : move.id === 'ragekill' ? pt >= 0.2 : spin360 ? pt >= 0.2 && pt <= 0.8 : wide ? pt >= 0.3 && pt <= 0.72 : pt >= 0.33 && pt <= 0.62;
    if (!impactWindow && !move.travel) return;
    // very short moves (elbow / knee / uppercut) also count a tight body-contact zone in front of the chest,
    // because the striking joint stays close to the torso by design
    // travelling strikes (flying kicks, running straight, dive kick) carry the whole body: a contact zone just ahead
    // of the chest counts too, since the character is physically crashing into the target
    const contact = move.id === 'elbow' || move.id === 'knee' || move.id === 'dragon' ? { x: p.x + Math.cos(p.aim) * 7, y: p.y - 5 - p.z + Math.sin(p.aim) * 4, r: 6 }
      : move.travel || move.id === 'k_thrust' ? { x: p.x + Math.cos(p.aim) * 9, y: p.y - 5 - p.z * 0.5 + Math.sin(p.aim) * 5, r: 7 } : null;
    const reach = move.range * this.stats.meleeRange + 6; // sanity cap from the body (prevents long-chain exploits)
    const now = this.time;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      if (!move.rehit && p.hitSet.includes(e.id)) continue;
      if (move.rehit && now - (p.hitTimes[e.id] ?? -9) < move.rehit) continue;
      const ex = e.x, ey = e.y - 5 - e.z; // body centre (chest height)
      const bodyR = e.r + 1.0;
      // body-shaped target: a continuous vertical capsule from the feet to the top of the head
      const top = e.y - 13 * e.scale - e.z, bottom = e.y + 1 - e.z;
      let dmin = 1e9;
      for (let k = 0; k <= 4; k++) { const yy = top + ((bottom - top) * k) / 4; dmin = Math.min(dmin, this.segDist(prev.x, prev.y, cur.x, cur.y, e.x, yy)); }
      let near = dmin <= sp.r + bodyR;
      if (!near && sp.seg && (this.prevBlade || sp.seg)) {
        if (!this.prevBlade) this.prevBlade = sp.seg;
        // the blade swept the area between its previous and current segment: sample a few blade points along both
        for (let k = 0; k <= 4 && !near; k++) {
          const f = k / 4;
          const ax = this.prevBlade.base.x + (this.prevBlade.tip.x - this.prevBlade.base.x) * f, ay = this.prevBlade.base.y + (this.prevBlade.tip.y - this.prevBlade.base.y) * f;
          const bx = sp.seg.base.x + (sp.seg.tip.x - sp.seg.base.x) * f, by = sp.seg.base.y + (sp.seg.tip.y - sp.seg.base.y) * f;
          for (let q = 0; q <= 4; q++) { const yy = top + ((bottom - top) * q) / 4; if (this.segDist(ax, ay, bx, by, e.x, yy) <= sp.r + bodyR) { near = true; break; } }
        }
        // also the blade itself as a segment this frame
        if (!near) for (let q = 0; q <= 4; q++) { const yy = top + ((bottom - top) * q) / 4; if (this.segDist(sp.seg.base.x, sp.seg.base.y, sp.seg.tip.x, sp.seg.tip.y, e.x, yy) <= sp.r + bodyR) { near = true; break; } }
      }
      if (!near && sp.seg2) for (let q = 0; q <= 4; q++) { const yy = top + ((bottom - top) * q) / 4; if (this.segDist(sp.seg2.base.x, sp.seg2.base.y, sp.seg2.tip.x, sp.seg2.tip.y, e.x, yy) <= sp.r + bodyR) { near = true; break; } }
      if (!near && contact && dist(contact.x, contact.y, ex, ey) <= contact.r + bodyR) near = true;
      if (!near) continue;
      if (dist(p.x, p.y, e.x, e.y) > reach + e.r + (move.limb === 'nunchaku' ? 10 : move.limb === 'blade' ? 8 : 0)) continue;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      p.hitSet.push(e.id); p.hitTimes[e.id] = now;
      this.meleeHitEnemy(e, move, a, cur);
    }
    for (const pr of this.props) {
      if (pr.dead) continue;
      const key = -1000 - this.props.indexOf(pr);
      if (p.hitSet.includes(key)) continue;
      if (this.segDist(prev.x, prev.y, cur.x, cur.y, pr.x, pr.y - 4) > sp.r + pr.r) continue;
      p.hitSet.push(key);
      this.damageProp(pr, move.dmg, Math.atan2(pr.y - p.y, pr.x - p.x));
      this.hitstop = Math.max(this.hitstop, 0.02);
    }
    for (const b of this.bullets) {
      if (b.owner !== 'enemy' || b.kind === 'bomb') continue;
      if (this.segDist(prev.x, prev.y, cur.x, cur.y, b.x, b.y) > sp.r + 3) continue;
      this.deflectBullet(b, p.aim);
    }
  }

  /** StickOpts for the player as drawn this frame (shared by the renderer and the hit tester) */
  playerStickOpts(pose: Pose, t: number): import('./stick').StickOpts {
    const p = this.player;
    const runBlend = clamp(p.runT / 0.2, 0, 1);
    const moving = p.moving && (pose === 'idle' || pose === 'run' || pose === 'shoot' || pose === 'n_idle' || pose === 'k_idle' || pose === 'a_idle' || pose === 'd_idle');
    return {
      x: p.x, y: p.y, c: PLAYER_COLOR, c2: PLAYER_BAND, scale: 1, facing: p.facing, aim: pose === 'run' || pose === 'idle' || pose === 'n_idle' ? p.bodyAim : p.aim, look: p.aim, walk: p.walk, moving,
      pose, t, acc: 'headband', weapon: p.weapon === 'pistol' || p.weapon === 'rifle' ? p.weapon : 'none', flash: p.flash > 0, alpha: 1, outline: '#000000', eyes: '#111111', time: this.time, lean: p.lean,
      z: p.z, recoil: p.recoil, run: runBlend, squash: p.squash, vel: this.moveDirOf(p.vx + p.kx * 0.3, p.vy + p.ky * 0.3), stride: p.strideHalf, chainSide: p.chainSide,
    };
  }

  deflectBullet(b: Bullet, dir: number) {
    const sp = Math.hypot(b.vx, b.vy) * 1.5 + 80;
    b.owner = 'player'; b.vx = Math.cos(dir) * sp; b.vy = Math.sin(dir) * sp; b.dmg = Math.max(4, b.dmg * 3); b.color = this.pal.accent; b.kind = 'deflect'; b.life = 1.5; b.hitIds = []; b.pierce = 1; b.kb = 200;
    this.sfx.parry();
    this.particles.spark(b.x, b.y, 6, '#ffffff', dir, 0.6, 200);
    this.particles.impact(b.x, b.y, 5, '#9be7ff');
    this.texts.add(b.x, b.y - 10, 'DEFLECT!', '#35f0ff', 1, 0.5);
    this.hitstop = Math.max(this.hitstop, 0.04);
    this.player.focus = Math.min(300, this.player.focus + 15 * this.stats.focusGain);
    this.addCombo();
  }

  meleeHitEnemy(e: Enemy, move: Move, a: number, at?: Vec) {
    const p = this.player;
    const heavy = !['jab', 'cross', 'hook', 'n_lash', 'n_cross', 'n_figure8', 'n_helicopter'].includes(move.id);
    // impact FX exactly at the limb contact point (clamped onto the body surface)
    let hx = e.x - Math.cos(a) * e.r, hy = e.y - e.z - 6 - Math.sin(a) * e.r;
    if (at) { const ddx = at.x - e.x, ddy = at.y - (e.y - e.z - 5); const dl = Math.hypot(ddx, ddy) || 1; const cl = Math.min(dl, e.r + 1); hx = e.x + (ddx / dl) * cl; hy = e.y - e.z - 5 + (ddy / dl) * cl; }
    if (e.kind === 'shield' && e.stagger <= 0 && e.down <= 0 && e.z <= 0 && !heavy && Math.abs(angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.aim)) < 1.3) {
      this.particles.spark(hx, hy, 8, '#ffffff', a + Math.PI, 0.8, 180);
      this.particles.impact(hx, hy, 4, '#cccccc');
      this.sfx.hit();
      e.structure += move.structure * 0.6 * this.stats.structureDmg;
      e.flash = 0.05;
      this.texts.add(e.x, e.y - 20, 'BLOCKED', '#cccccc', 1, 0.4);
      this.hitstop = Math.max(this.hitstop, 0.03);
      p.kx -= Math.cos(a) * 70; p.ky -= Math.sin(a) * 70;
      if (e.structure >= e.maxStructure) this.staggerEnemy(e);
      return;
    }
    if (e.canParry && e.parryCd <= 0 && e.stagger <= 0 && e.down <= 0 && e.stun <= 0 && e.z <= 0 && (e.state === 'chase' || e.state === 'recover') && Math.random() < (e.boss ? 0.4 : 0.28)) {
      e.parryCd = 2.5;
      this.sfx.parry();
      this.particles.ring(e.x, e.y - 6, 3, 14, '#ffd700', 0.2, 1);
      this.particles.spark(hx, hy, 8, '#ffd700', a + Math.PI, 1, 200);
      this.texts.add(e.x, e.y - 22, 'PARRIED!', '#ffd700', 1, 0.6);
      p.stunT = 0.32; p.kx -= Math.cos(a) * 170; p.ky -= Math.sin(a) * 170;
      p.attackPhase = 'none'; p.buffered = null; p.comboStr = ''; p.z = 0;
      this.hitstop = Math.max(this.hitstop, 0.08); this.shake(0.3);
      e.state = 'windup'; e.stateT = 0.14; e.pose = 'windup'; e.poseT = 0; e.poseDur = 0.14; e.hitDone = false; e.burst = 0;
      return;
    }
    if (move.id === 'k_iaijutsu' && !e.boss && e.doom <= 0) {
      // the cut is already fatal: freeze them until the sheathe, then they fall (classic iai)
      e.doom = 0.55 + 0.08 * p.iaiVictims.length; e.state = 'doom'; e.kx = e.ky = 0; e.flash = 0.1; e.token = false;
      p.iaiVictims.push(e.id);
      this.particles.lines(hx, hy, 3, '#ffffff', p.aim + Math.PI / 2, 80); this.particles.lines(hx, hy, 3, '#ffffff', p.aim - Math.PI / 2, 80);
      this.particles.impact(hx, hy, 5, '#bfe8ff');
      this.sfx.slash(1.3);
      this.addCombo();
      return;
    }
    let dmg = move.dmg * this.stats.meleeDmg * this.ageDmg() * (1 + Math.min(0.6, this.combo * this.stats.berserk)) * (1 + 0.5 * p.styleHeat);
    if (e.stagger > 0) dmg *= 2; else if (e.down > 0) dmg *= 1.5;
    if (e.z > 0) dmg *= 1.25; // juggle bonus
    const kb = move.kb * 0.45 * this.stats.knockback * (heavy ? 1 : 0.6);
    const wasAlive = !e.dead;
    const launch = move.launch ? move.launch * 0.6 * (1 - e.kbRes * 0.6) : 0;
    this.damageEnemy(e, dmg, move.structure * this.stats.structureDmg, a, kb, { knockdown: move.knockdown, hitstop: move.hitstop, shake: move.shake, melee: true, launch });
    this.particles.spark(hx, hy, 5 + (heavy ? 5 : 0), '#ffffff', a, 0.9, 200 + kb * 0.2);
    this.particles.blood(hx, hy, 3 + Math.floor(dmg * 0.8), a, 100 + kb * 0.3);
    this.blood.spray(hx, hy, a, dmg, heavy);
    if (heavy) this.stamp(e.x + rnd(-3, 3), e.y + rnd(-1, 2), '#8a0000', 1);
    this.particles.impact(hx, hy, heavy ? 8 : 5, '#ffffff');
    if (move.showName && p.hitSet.length === 1) this.say(move.name, this.pal.accent2, move.finisher ? 2 : 1, move.finisher ? 0.8 : 0.6);
    if (e.z > 0 && wasAlive) this.say('JUGGLE!', '#ffe66d', 1, 0.5);
    this.sfx.hit();
    if (move.sfx === 'punch') this.sfx.punch(); else if (move.sfx === 'kick') this.sfx.kick(); else if (move.sfx === 'nunchaku') { this.sfx.nunchakuHit(heavy); } else if (move.sfx === 'slash') { this.sfx.slashHit(heavy); } else if (move.sfx === 'axe') { this.sfx.axeHit(heavy); this.sfx.batCrack(); if (move.id === 'a_homerun' || move.id === 'a_grandslam') { this.slow(0.25, 0.25); this.flash('#ffffff', 0.15); this.zoomKick = 0.08; this.say(move.id === 'a_homerun' ? 'HOME RUN!' : 'GRAND SLAM!', '#ffb347', 3, 1.0); } } else if (move.sfx === 'dual') { this.sfx.dualHit(); } else this.sfx.heavy();
    if (move.bleed && !e.dead) { e.bleed = Math.min(6, e.bleed + (heavy ? 3 : 2)); if (e.bleedT <= 0) e.bleedT = 0.3; }
    if ((move.sfx === 'slash' || move.sfx === 'dual' || move.sfx === 'axe') && !e.dead) {
      // a clean cut line across the body
      const ca = p.bladeA + Math.PI / 2;
      this.particles.lines(hx, hy, 2, '#ffffff', ca, 60); this.particles.lines(hx, hy, 2, '#ffffff', ca + Math.PI, 60);
      this.particles.blood(hx, hy, 6, p.bladeA + Math.PI / 2, 90);
    }
    p.focus = Math.min(300, p.focus + 7 * this.stats.focusGain);
    this.addCombo();
    this.meleeHits++;
    if ((move.id === 'chain' || p.style !== 'none') && !p.rageOn) { p.rage = Math.min(100, p.rage + (move.id === 'chain' ? 2.2 : move.finisher ? 5 : 3)); if (p.rage >= 100 && !this.rageReadySaid) { this.rageReadySaid = true; this.say('RAGE READY - PRESS R', '#ff2a2a', 2, 1.4); this.sfx.select(); } }
    if (move.id === 'chainend') { p.rage = Math.min(100, p.rage + 10); this.slow(0.2, 0.3); }
    if (move.id === 'ragekill') {
      p.rageKills++;
      this.flash('#ff2a2a', 0.15); this.zoomKick = 0.06;
      if (!e.dead && !e.boss) this.killEnemy(e, a, 700, false, true);
      else if (!e.dead && e.boss) this.damageEnemy(e, e.maxHp * 0.08, 60, a, 300, { knockdown: true, hitstop: 0.08, shake: 0.6, melee: true });
      if (p.rageKills % 3 === 0) this.heal(1);
    }
    if (move.travel) p.travelHit = true;
    if (move.finisher) this.zoomKick = Math.max(this.zoomKick, 0.04);
    if (move.id === 'n_dragonlash' && p.hitSet.length === 1) {
      // detonation: the chain whips around the first target and blasts everyone nearby
      this.particles.shockwave(e.x, e.y - 4, 44, this.pal.accent, 0.35);
      this.particles.impact(hx, hy, 12, '#ffffff');
      this.flash('#ffffff', 0.2); this.slow(0.2, 0.3);
      this.sfx.explosion();
      for (const o of this.enemies) {
        if (o === e || o.dead || o.spawnT > 0 || dist(o.x, o.y, e.x, e.y) > 44 + o.r) continue;
        p.hitSet.push(o.id);
        this.damageEnemy(o, move.dmg * 0.6 * this.stats.meleeDmg, 40, Math.atan2(o.y - e.y, o.x - e.x), 420, { knockdown: true, hitstop: 0.02, shake: 0.2, melee: true, launch: 90 });
      }
    }
    if (this.stats.lifesteal > 0 && this.meleeHits % Math.max(10, 25 - this.stats.lifesteal * 5) === 0) this.heal(1);
    if (this.stats.shockwave > 0 && move.finisher && wasAlive) this.shockwaveHit(e.x, e.y, 34, dmg * 0.6, e.id);
  }

  shockwaveHit(x: number, y: number, r: number, dmg: number, excludeId: number) {
    this.particles.shockwave(x, y - 4, r, this.pal.accent, 0.3);
    this.sfx.heavy();
    for (const e of this.enemies) {
      if (e.dead || e.id === excludeId || e.spawnT > 0) continue;
      const d = dist(x, y, e.x, e.y);
      if (d > r + e.r) continue;
      this.damageEnemy(e, dmg, 20, Math.atan2(e.y - y, e.x - x), 200, { knockdown: true, hitstop: 0.02, shake: 0.1, melee: false });
    }
  }

  heal(n: number) {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(this.maxHp(), p.hp + n);
    if (p.hp > before) { this.texts.add(p.x, p.y - 26, `+${p.hp - before} HP`, '#ff6b6b', 1, 0.8); this.particles.burst(p.x, p.y - 8, 8, '#ff6b6b', 50, 0.5); }
  }

  staggerEnemy(e: Enemy) {
    e.stagger = e.boss ? 1.8 : 2.6; e.state = 'stagger'; e.down = 0; e.stun = 0; e.kx *= 0.4; e.ky *= 0.4; e.fuse = -1;
    this.sfx.stagger();
    this.particles.ring(e.x, e.y - 8, 2, 18, '#ffd700', 0.3, 1);
    if (this.finishCd <= 0 && dist(e.x, e.y, this.player.x, this.player.y) < 90) { this.finishCd = 4; this.sfx.announce(); }
  }

  damageEnemy(e: Enemy, dmg: number, structure: number, dir: number, kb: number, o: { knockdown?: boolean; hitstop?: number; shake?: number; melee?: boolean; launch?: number }) {
    if (e.dead || e.spawnT > 0) return;
    e.hp -= dmg;
    e.flash = 0.1;
    e.flinch = 0.12;
    e.structure += structure;
    const kbMul = (1 - e.kbRes) * (1 - e.kbRes * 0.5) * (e.stagger > 0 ? 1.25 : 1) * (e.z > 0 ? 0.6 : 1);
    e.kx += Math.cos(dir) * kb * kbMul; e.ky += Math.sin(dir) * kb * kbMul;
    this.hitstop = Math.max(this.hitstop, o.hitstop ?? 0.02);
    this.shake(o.shake ?? 0.1);
    if (e.hp <= 0) { this.killEnemy(e, dir, kb + dmg * 20, false, !!o.melee, e.z > 0 || (o.launch ?? 0) > 0); return; }
    if (o.launch && o.launch > 0 && !e.armor) {
      // real launchers (uppercut, taekwondo kick, crane, monkey flip, focus) always lift; small pops need a softened target
      const softened = e.structure >= e.maxStructure * 0.35 || e.hp <= e.maxHp * 0.55 || e.stagger > 0 || o.launch >= 50;
      if (!softened) { e.stun = Math.max(e.stun, 0.3); e.state = 'stun'; e.kx *= 0.5; e.ky *= 0.5; return; }
      e.vz = Math.max(e.vz, o.launch); e.z = Math.max(e.z, 0.1); e.down = 0; e.stun = 0; e.state = 'air'; e.pose = 'launched'; e.fuse = -1;
      this.sfx.launch();
      return;
    }
    if (e.z > 0) { e.vz += 70; return; }
    if (e.structure >= e.maxStructure && e.stagger <= 0) { this.staggerEnemy(e); return; }
    if (e.stagger > 0) return;
    if (o.knockdown && !e.armor) {
      if (e.boss && Math.random() < 0.6) { e.stun = Math.max(e.stun, 0.25); e.state = 'stun'; return; }
      // tough enemies only go down once softened up: enough structure damage, low hp, or an elite's luck
      const softened = e.structure >= e.maxStructure * 0.4 || e.hp <= e.maxHp * 0.5 || e.stagger > 0;
      if (!softened && !(o.launch && o.launch > 0)) { e.stun = Math.max(e.stun, 0.3); e.state = 'stun'; return; }
      e.down = e.boss ? 0.7 : 1.0; e.state = 'down'; e.fuse = -1; return;
    }
    if (!e.armor && o.melee && e.down <= 0) {
      const committed = (e.state === 'windup' && e.stateT < 0.12) || e.state === 'attack' || e.state === 'lunge';
      const poise = e.boss ? 0.7 : e.elite ? 0.45 : e.kind === 'monk' ? 0.25 : 0;
      if (!committed && Math.random() >= poise) { e.stun = Math.max(e.stun, 0.16); e.state = 'stun'; }
    }
  }

  enemyLand(e: Enemy) {
    this.particles.smoke(e.x, e.y, 6, '#888', 30, 0.45);
    this.particles.burst(e.x, e.y, 6, this.pal.wallTop, 80, 0.4);
    this.particles.blood(e.x, e.y - 3, 10, rnd(0, 6.3), 90);
    this.splat(e.x, e.y, 8);
    this.sfx.land();
    this.shake(0.2);
    if (e.dead) return;
    if (e.stagger > 0) { e.state = 'stagger'; e.pose = 'stagger'; return; }
    e.down = e.boss ? 0.6 : 1.0; e.state = 'down'; e.pose = 'down';
    e.hp -= 1;
    if (e.hp <= 0) this.killEnemy(e, Math.atan2(e.ky, e.kx), 150, false, true);
  }

  killEnemy(e: Enemy, dir: number, power: number, silent = false, melee = false, airborne = false) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    this.score += Math.round(e.value * this.comboMult());
    const gy = e.y - 6 - e.z;
    // blood: classic particles (normal/combined) + the new gore emitters (gore/combined)
    this.particles.blood(e.x, gy, 8 + Math.min(10, power / 30), dir, 110 + power * 0.4);
    this.blood.spray(e.x, gy, dir, 3 + Math.min(4, power / 100), true);
    this.particles.ring(e.x, gy, 3, 14, '#ffffff', 0.18, 1);
    this.splat(e.x, e.y, 6 + Math.floor(e.scale * 2));
    this.addPool(e.x, e.y + 1, 4 + e.scale);
    // RAGDOLL: the body is flung along the hit direction, tumbling in the air, bouncing when it lands
    if (this.corpses.length > 80) this.corpses.shift();
    const fling = Math.min(520, 120 + power * 0.9);
    const up = airborne ? Math.max(e.vz, 120) : Math.min(260, 60 + power * 0.35);
    this.corpses.push({
      x: e.x, y: e.y, rot: dir + (Math.random() < 0.5 ? 0.3 : -0.3), color: e.color, color2: e.color2, scale: e.scale, accessory: e.accessory,
      vx: Math.cos(dir) * fling, vy: Math.sin(dir) * fling * 0.75, spin: rnd(6, 14) * (Math.random() < 0.5 ? 1 : -1), t: 0, z: Math.max(e.z, 1), vz: up, gib: false, bounces: 0,
    });
    if (!silent) { this.sfx.kill(); this.shake(0.3 + Math.min(0.4, power / 900)); this.hitstop = Math.max(this.hitstop, 0.045); }
    if (e.kind === 'bomber') this.pendingBooms.push({ x: e.x, y: e.y, t: 0.05, r: 30, dmg: 2, fromPlayer: true });
    this.dropLoot(e, melee);
    this.addCombo();
    if (e.boss) {
      this.slow(1.4, 0.2);
      this.flash('#ffffff', 0.6);
      this.shake(1);
      this.say('BOSS DEFEATED!', '#ffd700', 3, 2.2);
      this.deathCounter = 1;
      this.score += 500;
      for (let i = 0; i < 3; i++) this.particles.shockwave(e.x, e.y - 6, 60 + i * 30, this.pal.accent, 0.6 + i * 0.2);
      this.bossBeatenT = 2;
      for (const o of this.enemies) if (!o.dead && o !== e) this.killEnemy(o, Math.atan2(o.y - e.y, o.x - e.x), 200, true);
    } else if (melee && this.combo >= 3) this.slow(0.1, 0.35);
  }

  gibAt(x: number, y: number, color: string, scale: number, dir = 0, power = 1) {
    this.particles.blood(x, y - 6, 30, dir, 170 * power);
    this.particles.blood(x, y - 6, 16, rnd(0, 6.3), 100 * power);
    this.particles.fountain(x, y - 6, 8);
    this.blood.spray(x, y - 6, dir, 5 * power, true); this.blood.arterial(x, y - 6, dir, power * 0.7); this.blood.fountain(x, y - 6, 10); this.blood.gibs(x, y - 6, dir, 200 * power, color, 3);
    for (let i = 0; i < 5; i++) this.particles.limb(x, y - 6, dir + rnd(-1.2, 1.2), 180 * power, color, 3 + scale * 2);
    this.particles.burst(x, y - 6, 12, color, 140, 0.4);
    this.particles.ring(x, y - 6, 3, 20, '#ffffff', 0.2, 1);
    this.particles.impact(x, y - 6, 9, '#ff4040');
    this.splat(x, y, 40);
    this.addPool(x, y + 1, 9 + scale * 3);
    this.sfx.kill(); this.sfx.heavy();
    this.shake(0.6);
  }

  explode(x: number, y: number, r: number, dmg: number, fromPlayer: boolean) {
    this.particles.smoke(x, y, 12, '#555555', 60, 0.7);
    this.particles.burst(x, y, 24, '#ffb347', 180, 0.45, 2, 3);
    this.particles.burst(x, y, 14, '#ffffff', 120, 0.25, 1, 3);
    this.particles.shockwave(x, y, r + 10, '#ffd27f', 0.35);
    this.particles.ember(x, y, 10, '#ff6a00');
    this.sfx.explosion();
    this.shake(0.8);
    this.hitstop = Math.max(this.hitstop, 0.05);
    this.flash('#ffb060', 0.25);
    this.splat(x, y, 16, '#111111');
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = dist(x, y, e.x, e.y);
      if (d > r + e.r) continue;
      this.damageEnemy(e, dmg * 3, 60, Math.atan2(e.y - y, e.x - x), 320, { knockdown: true, hitstop: 0.02, shake: 0.1, melee: false, launch: 120 });
    }
    const p = this.player;
    if (!fromPlayer && dist(x, y, p.x, p.y) < r + p.r) this.damagePlayer(dmg, Math.atan2(p.y - y, p.x - x));
    for (const pr of this.props) {
      if (pr.dead) continue;
      if (dist(x, y, pr.x, pr.y) < r + pr.r) this.damageProp(pr, 10, Math.atan2(pr.y - y, pr.x - x));
    }
  }

  damageProp(pr: Prop, dmg: number, dir: number) {
    if (pr.dead || pr.hp <= 0) return;
    pr.hp -= dmg;
    pr.flash = 0.08;
    this.particles.burst(pr.x, pr.y - 4, 5, pr.kind === 'crate' ? '#b07a3c' : '#c0392b', 90, 0.4);
    this.sfx.hit();
    if (pr.hp <= 0) {
      pr.dead = true;
      if (pr.kind === 'crate') {
        this.particles.burst(pr.x, pr.y - 4, 16, '#b07a3c', 140, 0.6, 2, 3);
        for (let i = 0; i < 3; i++) this.particles.limb(pr.x, pr.y - 4, dir, 120, '#8a5a2b', 4);
        const n = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const k: Pickup['kind'][] = ['ammoP', 'ammoP', 'hp', 'focus', this.player.hasRifle ? 'ammoR' : 'ammoP'];
          this.spawnPickup(pr.x, pr.y, k[Math.floor(Math.random() * k.length)]);
        }
        this.sfx.kick();
      } else {
        pr.dead = false;
        pr.flash = 0.5;
        this.pendingBooms.push({ x: pr.x, y: pr.y, t: 0.5, r: 38, dmg: 2, fromPlayer: false });
        this.sfx.beep();
      }
    }
  }

  enemyMeleeHit(e: Enemy, dmg: number, range: number, arc: number, knockdown: boolean) {
    const p = this.player;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d > range + p.r) return;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (Math.abs(angleDiff(a, e.aim)) > arc) return;
    // fair enemy strikes too: for normal punches/kicks the striking limb (from the enemy's own posed skeleton)
    // must actually reach the player's body; area attacks (brute slam, charges, sweeps with arc >= PI) skip this
    if (arc < 3 && (e.pose === 'punch' || e.pose === 'kick' || e.pose === 'palm')) {
      const sk = solvePose({ x: e.x, y: e.y, c: e.color, c2: e.color2, scale: e.scale, facing: e.facing, aim: e.aim, walk: e.walk, moving: false, pose: e.pose, t: Math.min(1, Math.max(0.36, e.poseT)), acc: 'none', weapon: 'none', flash: false, alpha: 1, outline: null, eyes: '#000', time: this.time, lean: { x: Math.cos(e.aim), y: Math.sin(e.aim) } });
      const j = e.pose === 'kick' ? sk.ffoot : e.pose === 'palm' ? sk.fhand : sk.bhand;
      const jx = e.x + j.x, jy = e.y + j.y - e.z;
      const hitR = 5 * e.scale + 2;
      let dmin = 1e9;
      for (let k = 0; k <= 4; k++) { const yy = p.y - 13 + (14 * k) / 4 - p.z; dmin = Math.min(dmin, Math.hypot(jx - p.x, jy - yy)); }
      if (dmin > hitR + p.r + 1.5) return;
    }
    if (p.parryT > 0) { this.perfectParry(e, a); return; }
    if (p.z > 12 && !e.boss) { this.texts.add(p.x, p.y - 26 - p.z, 'JUMPED!', '#9be7ff', 1, 0.5); return; } // leapt clean over a sweep/strike
    this.damagePlayer(dmg, a, knockdown);
  }

  perfectParry(e: Enemy, a: number) {
    const p = this.player;
    p.parryHit = true;
    this.sfx.parry();
    this.hitstop = Math.max(this.hitstop, 0.12);
    this.shake(0.5);
    this.slow(0.25, 0.3);
    this.flash('#ffffff', 0.18);
    this.particles.ring(p.x, p.y - 6, 4, 22, '#ffffff', 0.25, 2);
    this.particles.spark(p.x + Math.cos(a + Math.PI) * 6, p.y - 6, 14, '#9be7ff', a + Math.PI, 1.2, 240);
    this.particles.impact(p.x + Math.cos(a + Math.PI) * 8, p.y - 6, 10, '#9be7ff');
    e.structure += e.maxStructure * (e.boss ? 0.25 : 0.5);
    e.stun = Math.max(e.stun, 0.9); e.state = 'stun'; e.pose = 'hurt';
    e.kx -= Math.cos(a) * 200 * (1 - e.kbRes * 0.5); e.ky -= Math.sin(a) * 200 * (1 - e.kbRes * 0.5);
    e.attackCd = 1.2;
    if (e.structure >= e.maxStructure) this.staggerEnemy(e);
    this.say('PARRY!', '#35f0ff', 2, 0.7);
    p.focus = Math.min(300, p.focus + 45 * this.stats.focusGain);
    this.addCombo();
  }

  damagePlayer(dmg: number, dir: number, knockdown = false) {
    const p = this.player;
    if (this.state !== 'playing') return;
    if (p.iframes > 0 || p.dashT > 0 || p.fatality || p.focusDash) return;
    if (p.z > 12) { this.texts.add(p.x, p.y - 26 - p.z, 'JUMPED!', '#9be7ff', 1, 0.5); return; }
    if (p.rageOn && Math.random() < 0.5) { this.texts.add(p.x, p.y - 24, 'RAGE', '#ff2a2a', 1, 0.4); return; }
    if (this.stats.dodgeChance > 0 && Math.random() < this.stats.dodgeChance) {
      this.texts.add(p.x, p.y - 24, 'DODGE', '#9be7ff', 1, 0.6);
      this.particles.ring(p.x, p.y - 6, 4, 12, '#9be7ff', 0.2, 1);
      return;
    }
    p.hp -= dmg;
    p.iframes = 1.0; p.flash = 0.15;
    p.kx += Math.cos(dir) * (knockdown ? 260 : 170); p.ky += Math.sin(dir) * (knockdown ? 260 : 170);
    p.stunT = Math.max(p.stunT, knockdown ? 0.35 : 0.18);
    p.attackPhase = 'none'; p.buffered = null; p.comboStr = ''; p.z = 0; p.runT = 0; p.chain = 0; p.rageDash = null; p.styleHeat = Math.max(0, p.styleHeat - 0.4); p.style = 'none'; p.styleStreak = 0; p.rhythm = [];
    this.shake(0.7); this.hitstop = Math.max(this.hitstop, 0.1);
    this.flash('#ff2020', 0.35);
    this.slow(0.2, 0.35);
    this.sfx.hurt();
    this.particles.blood(p.x, p.y - 6, 6, dir, 130);
    this.blood.spray(p.x, p.y - 6, dir, 2 + dmg, knockdown || dmg >= 2);
    this.blood.pool(p.x, p.y + 1, 3);
    this.blood.screenSplat(knockdown || dmg >= 2);
    this.combo = 0;
    if (p.hp <= 0) this.die();
  }

  tryFocus() {
    const p = this.player;
    if (p.focus < 100) { this.texts.add(p.x, p.y - 22, 'NO FOCUS', '#5a7a80', 1, 0.5); this.sfx.empty(); return; }
    let e = this.nearestEnemy(p.x, p.y, 130, p.aim, 1.2);
    if (e && !lineOfSight(this.level, p.x, p.y, e.x, e.y)) e = this.nearestEnemy(p.x, p.y, 60, p.aim, 1.6);
    if (!e) { this.texts.add(p.x, p.y - 22, 'NO TARGET', '#5a7a80', 1, 0.5); this.sfx.empty(); return; }
    p.focus -= 100;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    const gap = e.r + p.r + 4;
    p.focusDash = { sx: p.x, sy: p.y, tx: e.x - Math.cos(a) * gap, ty: e.y - Math.sin(a) * gap, t: 0, id: e.id };
    p.attackPhase = 'none'; p.buffered = null; p.dashT = 0; p.aim = a; p.z = 0;
    e.stun = Math.max(e.stun, 0.6); e.state = 'stun';
    this.slow(0.6, 0.3);
    this.sfx.focus();
    this.flash(this.pal.accent, 0.2);
    this.particles.ring(p.x, p.y - 6, 2, 30, this.pal.accent, 0.3, 2);
  }

  // ------------------------------------------------------------------ FATALITY
  tryFatality() {
    const p = this.player;
    if (p.fatality || p.stunT > 0) return;
    const ft = this.fatalityTarget();
    if (!ft) { this.texts.add(p.x, p.y - 22, 'NO TARGET', '#777', 1, 0.5); this.sfx.empty(); return; }
    const best = ft.e;
    const perfect = best.stagger > 0;
    if (!perfect && this.fatalityCd > 0) { this.texts.add(p.x, p.y - 22, `FATALITY IN ${this.fatalityCd.toFixed(1)}S`, '#777', 1, 0.5); this.sfx.empty(); return; }
    if (!perfect) this.fatalityCd = Game.FATALITY_CD;
    const a = Math.atan2(best.y - p.y, best.x - p.x);
    const idx = this.fatalityIdx++;
    let kind: FatalityKind;
    if (p.weapon === 'nunchaku') { const pool: FatalityKind[] = ['n_garrote', 'n_drum', 'n_decap']; kind = best.boss ? (idx % 2 === 0 ? 'n_drum' : 'n_decap') : pool[idx % pool.length]; }
    else if (p.weapon === 'axe') kind = idx % 2 === 0 ? 'k_bisect' : 'k_behead';
    else if (p.weapon === 'dual') kind = idx % 2 === 0 ? 'k_behead' : 'k_impale';
    else if (p.weapon === 'katana') { const pool: FatalityKind[] = ['k_bisect', 'k_behead', 'k_impale']; kind = best.boss ? (idx % 2 === 0 ? 'k_impale' : 'k_bisect') : pool[idx % pool.length]; }
    else if (ft.far || p.running || p.sinceDash < 0.25) { const far: FatalityKind[] = ['runpunch', 'flykick', 'kneedrop']; kind = far[idx % far.length]; }
    else if (best.boss) { const bossPool: FatalityKind[] = ['rush', 'uppercut', 'hammer', 'spinkick']; kind = bossPool[idx % bossPool.length]; }
    else if (best.down > 0) kind = 'stomp';
    else { const pool: FatalityKind[] = ['uppercut', 'neckbreak', 'flykick', 'spinkick', 'rush', 'hammer', 'runpunch', 'kneedrop', 'stomp']; kind = pool[idx % pool.length]; }
    const F: Fatality = { kind, id: best.id, t: 0, step: 0, stepT: 0, sx: p.x, sy: p.y, tx: best.x, ty: best.y, dir: a, hit: false, hitT: 0, perfect };
    p.fatality = F;
    p.attackPhase = 'none'; p.buffered = null; p.dashT = 0; p.parryT = 0; p.focusDash = null; p.z = 0; p.runT = 0; p.running = false;
    p.aim = a; p.attackAim = a; p.facing = Math.cos(a) >= 0 ? 1 : -1; p.vx = p.vy = p.kx = p.ky = 0; p.moving = false;
    p.holdPose = 'crouch'; p.holdPoseT = 0;
    if (['uppercut', 'rush', 'neckbreak', 'spinkick', 'hammer', 'stomp', 'n_garrote', 'n_drum', 'n_decap', 'k_bisect', 'k_behead', 'k_impale'].includes(kind)) {
      const gap = kind === 'stomp' ? best.r + 1 : kind === 'spinkick' || kind === 'n_decap' ? best.r + p.r + 9 : kind.startsWith('k_') ? best.r + p.r + 12 : best.r + p.r + 3;
      const nx = best.x - Math.cos(a) * gap, ny = best.y - Math.sin(a) * gap;
      if (this.isFree(nx, ny, p.r)) { p.x = nx; p.y = ny; }
      F.sx = p.x; F.sy = p.y;
    }
    if (kind === 'stomp') { best.down = 10; best.state = 'down'; best.pose = 'down'; }
    // grab the victim: freeze whatever they were doing
    best.stagger = 10; best.state = kind === 'stomp' ? 'down' : 'stagger'; best.pose = kind === 'stomp' ? 'down' : 'stagger'; best.kx = best.ky = 0; best.vx = best.vy = 0; best.z = 0; best.vz = 0;
    if (kind !== 'stomp') best.down = 0;
    best.stun = 0; best.fuse = -1; best.flinch = 0; best.tele = null; this.releaseToken(best);
    this.cinematic = true; this.zoomTarget = 1.45; this.camFocus = { x: (p.x + best.x) / 2, y: (p.y + best.y) / 2 };
    this.slowFactor = 0.45; this.slowT = 0.2;
    p.iframes = 6;
    for (const o of this.enemies) if (o !== best && !o.dead) o.attackCd = Math.max(o.attackCd, 1.5);
    this.sfx.announce();
    if (perfect) this.say('PERFECT FATALITY', '#ffd700', 2, 1.0);
  }

  updateFatality(raw: number) {
    const p = this.player;
    const F = p.fatality!;
    const e = this.enemies.find((en) => en.id === F.id);
    const target = e && !e.dead ? e : null;
    this.slowT = Math.max(this.slowT, 0.2);
    this.slowFactor = F.hit ? 0.3 : 0.45;
    if (!F.hit && !target) { this.endFatality(); return; }
    F.t += raw;
    if (target && !F.hit) { target.stagger = 10; if (F.kind === 'stomp') { target.down = 10; target.pose = 'down'; } else target.pose = 'stagger'; F.tx = target.x; F.ty = target.y; }
    this.camFocus = { x: (p.x + F.tx) / 2, y: (p.y + F.ty) / 2 };
    const dir = F.dir, cd = Math.cos(dir), sd = Math.sin(dir);
    const since = F.t - F.hitT;
    switch (F.kind) {
      case 'uppercut': {
        if (F.step === 0) {
          p.holdPose = 'crouch';
          if (F.t > 0.08 && Math.random() < 0.7) {
            const a = rnd(0, 6.3), r = rnd(10, 16);
            this.particles.add({ x: p.x + cd * 5 + Math.cos(a) * r, y: p.y - 4 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * 90, vy: -Math.sin(a) * 60, life: 0.16, c: '#ffd700', k: 0, s: 1 });
          }
          if (F.t >= 0.34) {
            F.step = 1;
            this.particles.dirBurst(p.x + cd * 6, p.y - 6, 10, '#ffffff', -Math.PI / 2, 0.4, 200, 0.3);
            this.particles.smoke(p.x, p.y, 6, '#888', 35, 0.45);
            this.finishBlow(target, F);
          }
        } else if (F.step === 1) {
          p.holdPose = 'uppercut'; p.holdPoseT = clamp(0.3 + since * 2.5, 0.3, 0.6);
          if (since > 0.8) { F.step = 2; }
        } else { p.holdPose = 'flex'; }
        if (F.hit && since > 1.7) this.endFatality();
        break;
      }
      case 'runpunch': {
        if (F.step === 0) {
          const q = Math.min(1, F.t / 0.22);
          const bx = F.sx - cd * 16 * easeOut(q), by = F.sy - sd * 16 * easeOut(q);
          if (this.isFree(bx, by, p.r)) { p.x = bx; p.y = by; }
          p.holdPose = 'runpunch'; p.holdPoseT = 0.28 * q;
          if (q > 0.5 && Math.random() < 0.5) this.particles.smoke(p.x - cd * 3, p.y + 1, 1, '#888', 15, 0.3);
          if (F.t >= 0.28) { F.step = 1; this.sfx.dash(); this.particles.dirBurst(p.x, p.y, 8, '#cfcfcf', dir + Math.PI, 0.4, 100, 0.3); }
        } else if (F.step === 1) {
          p.holdPose = 'runpunch'; p.holdPoseT = 0.45;
          const o = { x: p.x, y: p.y, r: p.r };
          const m = moveWithCollision(this.level, o, cd * 430 * raw, sd * 430 * raw);
          p.x = o.x; p.y = o.y;
          this.addAfterimage({ x: p.x, y: p.y, facing: p.facing, aim: p.aim, pose: 'runpunch', poseT: 0.45 }, this.pal.accent, p.lean);
          this.particles.lines(p.x - cd * 6, p.y - 6, 1, '#ffffff', dir + Math.PI, 200);
          if (Math.random() < 0.7) this.particles.smoke(p.x - cd * 4, p.y + 1, 1, '#888', 20, 0.3);
          if (target && !F.hit && dist(p.x, p.y, target.x, target.y) < p.r + target.r + 3) this.finishBlow(target, F);
          if (F.hit && since > 0.12) F.step = 2;
          if (m.bx || m.by || F.t > 1.4) { if (!F.hit) { this.endFatality(); return; } F.step = 2; }
        } else {
          p.holdPose = since > 0.85 ? 'flex' : 'runpunch'; p.holdPoseT = 0.5;
          if (since > 1.7) this.endFatality();
        }
        break;
      }
      case 'flykick': {
        if (F.step === 0) {
          p.holdPose = 'crouch';
          const q = Math.min(1, F.t / 0.22);
          const bx = F.sx - cd * 10 * easeOut(q), by = F.sy - sd * 10 * easeOut(q);
          if (this.isFree(bx, by, p.r)) { p.x = bx; p.y = by; }
          if (F.t >= 0.3) { F.step = 1; F.stepT = 0; this.sfx.launch(); this.particles.smoke(p.x, p.y, 6, '#888', 30, 0.4); this.particles.dirBurst(p.x, p.y, 8, '#cfcfcf', dir + Math.PI, 0.4, 100, 0.3); }
        } else if (F.step === 1) {
          F.stepT += raw;
          p.holdPose = 'flying'; p.holdPoseT = 0.5;
          p.z = 12 * Math.sin(Math.min(1, F.stepT / 0.55) * Math.PI);
          const o = { x: p.x, y: p.y, r: p.r };
          const m = moveWithCollision(this.level, o, cd * 400 * raw, sd * 400 * raw);
          p.x = o.x; p.y = o.y;
          this.addAfterimage({ x: p.x, y: p.y - p.z, facing: p.facing, aim: p.aim, pose: 'flying', poseT: 0.5 }, this.pal.accent, p.lean);
          this.particles.lines(p.x - cd * 8, p.y - 8 - p.z, 1, '#ffffff', dir + Math.PI, 200);
          if (target && !F.hit && dist(p.x, p.y, target.x, target.y) < p.r + target.r + 4) this.finishBlow(target, F);
          if ((F.hit && since > 0.12) || m.bx || m.by || F.stepT > 0.65) {
            p.z = 0;
            if (!F.hit) { this.endFatality(); return; }
            F.step = 2;
            this.particles.smoke(p.x, p.y, 6, '#888', 30, 0.4); this.sfx.land(); this.shake(0.2);
          }
        } else {
          p.holdPose = since > 0.85 ? 'flex' : 'crouch';
          if (since > 1.7) this.endFatality();
        }
        break;
      }
      case 'neckbreak': {
        // grab the head (0-0.35), twist (0.35-0.5 snap), let the body drop, flex
        if (F.step === 0) {
          p.holdPose = 'grab'; p.holdPoseT = F.t / 0.35;
          if (target) { target.pose = 'stagger'; }
          if (F.t >= 0.38) { F.step = 1; this.sfx.whoosh(); }
        } else if (F.step === 1) {
          p.holdPose = 'grab'; p.holdPoseT = 1;
          if (target) { target.aim += raw * 14 * p.facing; target.facing = Math.cos(target.aim) >= 0 ? 1 : -1; }
          if (F.t >= 0.52) { F.step = 2; this.finishBlow(target, F); }
        } else { p.holdPose = since > 0.7 ? 'flex' : 'grab'; p.holdPoseT = 1; if (since > 1.6) this.endFatality(); }
        break;
      }
      case 'kneedrop': {
        // leap high (0-0.45 travel toward the target), drop with the knee onto them
        if (F.step === 0) {
          p.holdPose = 'crouch';
          if (F.t >= 0.18) { F.step = 1; F.stepT = 0; this.sfx.launch(); this.particles.smoke(p.x, p.y, 6, '#888', 30, 0.4); }
        } else if (F.step === 1) {
          F.stepT += raw;
          const T = 0.5, q = Math.min(1, F.stepT / T);
          p.holdPose = 'kneedrop'; p.holdPoseT = 0.44 * q;
          const gap = (target ? target.r : 5) + 2;
          const tx = F.tx - cd * gap * 0.3, ty = F.ty - sd * gap * 0.3;
          const nx = lerp(F.sx, tx, q), ny = lerp(F.sy, ty, q);
          if (this.isFree(nx, ny, p.r)) { p.x = nx; p.y = ny; }
          p.z = 26 * Math.sin(q * Math.PI);
          this.addAfterimage({ x: p.x, y: p.y - p.z, facing: p.facing, aim: p.aim, pose: 'kneedrop', poseT: 0.3 }, this.pal.accent, p.lean);
          if (q >= 1) { p.z = 0; F.step = 2; p.holdPoseT = 0.6; this.finishBlow(target, F); this.particles.shockwave(p.x, p.y, 34, '#ffffff', 0.3); this.particles.smoke(p.x, p.y, 10, '#777', 40, 0.5); }
        } else { p.holdPose = since > 0.9 ? 'flex' : 'kneedrop'; p.holdPoseT = since > 0.9 ? 0 : 0.6; if (since > 1.7) this.endFatality(); }
        break;
      }
      case 'spinkick': {
        // wind up (0-0.25), 360 spinning heel kick, heel connects at the end of the spin
        if (F.step === 0) {
          p.holdPose = 'spin'; p.holdPoseT = 0.1;
          if (F.t >= 0.25) { F.step = 1; F.stepT = 0; this.sfx.swing(0.7); }
        } else if (F.step === 1) {
          F.stepT += raw;
          p.holdPose = 'spin'; p.holdPoseT = 0.15 + 0.5 * Math.min(1, F.stepT / 0.3);
          if (F.stepT >= 0.3) { F.step = 2; this.finishBlow(target, F); }
        } else { p.holdPose = since > 0.8 ? 'flex' : 'spin'; p.holdPoseT = since > 0.8 ? 0 : 0.66; if (since > 1.6) this.endFatality(); }
        break;
      }
      case 'stomp': {
        // victim is on the ground: raise the knee (0-0.4), stomp the head
        if (F.step === 0) {
          p.holdPose = 'stomp'; p.holdPoseT = 0.5 * Math.min(1, F.t / 0.4);
          if (F.t >= 0.42) { F.step = 1; F.stepT = 0; }
        } else if (F.step === 1) {
          F.stepT += raw;
          p.holdPose = 'stomp'; p.holdPoseT = 0.5 + 0.1 * Math.min(1, F.stepT / 0.07);
          if (F.stepT >= 0.07) { F.step = 2; this.finishBlow(target, F); this.particles.shockwave(p.x + cd * 6, p.y, 24, '#ffffff', 0.25); }
        } else { p.holdPose = since > 0.8 ? 'flex' : 'stomp'; p.holdPoseT = since > 0.8 ? 0 : 0.6; if (since > 1.6) this.endFatality(); }
        break;
      }
      case 'hammer': {
        // both fists overhead (0-0.4), slam down on the skull
        if (F.step === 0) {
          p.holdPose = 'hammer'; p.holdPoseT = 0.45 * Math.min(1, F.t / 0.4);
          if (F.t > 0.1 && Math.random() < 0.6) this.particles.add({ x: p.x + rnd(-6, 6), y: p.y - 16 + rnd(-4, 4), vx: 0, vy: -40, life: 0.2, c: '#ffd700', k: 0, s: 1 });
          if (F.t >= 0.42) { F.step = 1; F.stepT = 0; }
        } else if (F.step === 1) {
          F.stepT += raw;
          p.holdPose = 'hammer'; p.holdPoseT = 0.45 + 0.15 * Math.min(1, F.stepT / 0.08);
          if (F.stepT >= 0.08) { F.step = 2; this.finishBlow(target, F); this.particles.shockwave(p.x + cd * 8, p.y, 30, '#ffffff', 0.3); }
        } else { p.holdPose = since > 0.8 ? 'flex' : 'hammer'; p.holdPoseT = since > 0.8 ? 0 : 0.6; if (since > 1.6) this.endFatality(); }
        break;
      }
      case 'n_garrote': {
        // whip the chain around the neck, pull tight (victim thrashes), snap
        if (F.step === 0) {
          p.holdPose = 'n_garrote'; p.holdPoseT = F.t / 0.3;
          if (F.t >= 0.3) { F.step = 1; this.sfx.chainRattle(); }
        } else if (F.step === 1) {
          p.holdPose = 'n_garrote'; p.holdPoseT = 1;
          if (target) { target.x = F.tx + Math.sin(F.t * 40) * 1.5; target.flash = Math.sin(F.t * 30) > 0 ? 0.05 : 0; }
          if (F.t >= 0.95) { F.step = 2; this.finishBlow(target, F); }
        } else { p.holdPose = since > 0.7 ? 'flex' : 'n_garrote'; p.holdPoseT = 1; if (since > 1.6) this.endFatality(); }
        break;
      }
      case 'n_drum': {
        // skull drum: 10 rapid overhead cracks, then the big one
        p.holdPose = 'n_drum'; p.holdPoseT = F.t;
        if (F.step < 10) {
          if (target && F.t > 0.1 + F.step * 0.07) {
            F.step++; target.flash = 0.05;
            const hx = target.x + rnd(-2, 2), hy = target.y - 12 * target.scale + rnd(-2, 2);
            this.particles.spark(hx, hy, 4, '#ffffff', -Math.PI / 2, 1, 160); this.particles.blood(hx, hy, 4, -Math.PI / 2, 110); this.particles.impact(hx, hy, 3, '#ffffff');
            this.sfx.nunchakuHit(false); this.hitstop = Math.max(this.hitstop, 0.012); this.shake(0.2); this.addCombo();
            target.y += 0.4; // driven into the ground
          }
        } else if (F.step === 10) {
          p.holdPose = 'n_overhead'; p.holdPoseT = 0.2;
          if (F.t > 0.1 + 10 * 0.07 + 0.3) { F.step = 11; p.holdPoseT = 0.45; this.finishBlow(target, F); }
        } else { p.holdPose = since > 0.8 ? 'flex' : 'n_overhead'; p.holdPoseT = 0.5; if (since > 1.6) this.endFatality(); }
        break;
      }
      case 'n_decap': {
        // helicopter spin-up, then the chain takes the head clean off
        p.holdPose = 'n_helicopter'; p.holdPoseT = F.t;
        if (F.step === 0) { if (F.t >= 0.6) { F.step = 1; this.finishBlow(target, F); } }
        else { p.holdPose = since > 0.8 ? 'flex' : 'n_helicopter'; if (since > 1.6) this.endFatality(); }
        break;
      }
      case 'k_bisect': {
        // jodan raise (0-0.45), vertical cut; the body splits after a beat
        if (F.step === 0) {
          p.holdPose = 'k_heaven'; p.holdPoseT = 0.3 * Math.min(1, F.t / 0.45);
          p.bladeA = p.aim - 1.5 * p.facing;
          if (F.t >= 0.47) { F.step = 1; F.stepT = 0; this.sfx.slash(0.6); }
        } else if (F.step === 1) {
          F.stepT += raw; p.holdPose = 'k_heaven'; p.holdPoseT = 0.3 + 0.3 * Math.min(1, F.stepT / 0.08); p.bladeA = p.aim + 0.4 * p.facing;
          if (F.stepT >= 0.09) { F.step = 2; this.finishBlow(target, F); }
        } else { p.holdPose = since > 0.9 ? 'k_sheathe' : 'k_heaven'; p.holdPoseT = since > 0.9 ? Math.min(1, (since - 0.9) / 0.5) : 0.62; if (since > 1.7) this.endFatality(); }
        break;
      }
      case 'k_behead': {
        // horizontal crescent at neck height
        if (F.step === 0) {
          p.holdPose = 'k_crescent'; p.holdPoseT = 0.28 * Math.min(1, F.t / 0.35); p.bladeA = p.aim + 2.2 * p.facing;
          if (F.t >= 0.37) { F.step = 1; F.stepT = 0; this.sfx.slash(1.1); const sk = solvePose(this.playerStickOpts('k_crescent', 0.4)); this.katana.addArc(p.x + sk.fhand.x, p.y + sk.fhand.y, 30, p.aim + 2.2 * p.facing, p.aim - 1.4 * p.facing, '#ffffff', 0.5, 0.3); }
        } else if (F.step === 1) {
          F.stepT += raw; const q = Math.min(1, F.stepT / 0.08); p.holdPose = 'k_crescent'; p.holdPoseT = 0.28 + 0.32 * q; p.bladeA = p.aim + (2.2 - 3.6 * q) * p.facing;
          if (F.stepT >= 0.09) { F.step = 2; this.finishBlow(target, F); }
        } else { p.holdPose = since > 0.9 ? 'k_sheathe' : 'k_crescent'; p.holdPoseT = since > 0.9 ? Math.min(1, (since - 0.9) / 0.5) : 0.6; if (since > 1.7) this.endFatality(); }
        break;
      }
      case 'k_impale': {
        // thrust through the chest, lift them on the blade, flick them off
        if (F.step === 0) {
          p.holdPose = 'k_thrust'; p.holdPoseT = 0.3 * Math.min(1, F.t / 0.3); p.bladeA = p.aim;
          if (F.t >= 0.32) { F.step = 1; F.stepT = 0; this.sfx.slashHit(true); this.particles.blood(F.tx, F.ty - 6, 20, F.dir, 120); this.hitstop = Math.max(this.hitstop, 0.08); this.shake(0.5); }
        } else if (F.step === 1) {
          F.stepT += raw; const q = Math.min(1, F.stepT / 0.6);
          p.holdPose = 'k_impale'; p.holdPoseT = q; p.bladeA = p.aim - 0.9 * q * p.facing * 0.5 - 0.5 * q;
          if (target) { target.z = 10 * q; target.pose = 'launched'; target.rot = 0.6 * q * p.facing; target.x = p.x + cd * (target.r + p.r + 10); target.y = p.y + sd * (target.r + p.r + 10) + 0.01; if (Math.random() < 0.6) this.particles.blood(target.x, target.y - 6 - target.z, 2, Math.PI / 2, 40); }
          if (F.stepT >= 0.65) { F.step = 2; this.finishBlow(target, F); }
        } else { p.holdPose = since > 0.9 ? 'k_sheathe' : 'k_impale'; p.holdPoseT = since > 0.9 ? Math.min(1, (since - 0.9) / 0.5) : 1; if (since > 1.7) this.endFatality(); }
        break;
      }
      case 'rush': {
        p.holdPose = 'rush'; p.holdPoseT = F.t;
        if (F.step < 14) {
          if (target && F.t > 0.1 + F.step * 0.05) {
            F.step++;
            target.flash = 0.05;
            const hx = target.x - cd * target.r + rnd(-2, 2), hy = target.y - 6 - sd * target.r + rnd(-3, 3);
            this.particles.spark(hx, hy, 5, '#ffffff', dir, 1, 180);
            this.particles.blood(hx, hy, 3, dir, 100);
            this.particles.impact(hx, hy, 4, '#ffffff');
            if (F.step % 2) this.sfx.punch(); else this.sfx.kick();
            this.sfx.hit();
            this.hitstop = Math.max(this.hitstop, 0.012); this.shake(0.2); this.addCombo();
            target.x += cd * 0.6; target.y += sd * 0.6;
          }
        } else if (F.step === 14) {
          p.holdPose = 'palm'; p.holdPoseT = 0.15;
          if (F.t > 0.1 + 14 * 0.05 + 0.3) {
            F.step = 15; p.holdPoseT = 0.45;
            this.finishBlow(target, F);
            this.particles.shockwave(p.x + cd * 10, p.y - 4, 40, '#ffffff', 0.35);
          }
        } else {
          p.holdPose = since > 0.75 ? 'flex' : 'palm'; p.holdPoseT = 0.5;
          if (since > 1.6) this.endFatality();
        }
        break;
      }
    }
  }

  finishBlow(e: Enemy | null, F: Fatality) {
    F.hit = true; F.hitT = F.t;
    const p = this.player;
    const dir = F.dir, cd = Math.cos(dir), sd = Math.sin(dir);
    this.hitstop = Math.max(this.hitstop, 0.14); this.flash('#ffffff', 0.4); this.shake(1); this.zoomKick = 0.1;
    this.sfx.fatality(); this.sfx.heavy(); this.sfx.kill();
    this.fatalityTextT = 1.8;
    if (!e || e.dead) return;
    const hx = e.x - cd * e.r, hy = e.y - 6 - sd * e.r;
    this.particles.impact(hx, hy, 12, '#ffffff');
    this.particles.spark(hx, hy, 16, '#ffffff', dir, 1.2, 260);
    this.blood.arterial(hx, hy, dir, 1.0); this.blood.fountain(e.x, e.y - 6, 16); this.blood.mist(hx, hy, dir, 6);
    p.focus = Math.min(300, p.focus + (F.perfect ? 60 : 30) * this.stats.focusGain);
    if (F.perfect) this.heal(1 + this.stats.takedownHeal);
    this.score += F.perfect ? 150 : 75;
    p.iframes = Math.max(p.iframes, 2.5);
    if (e.boss) {
      // bosses survive: perfect (staggered) fatality = 16%, otherwise a decaying chunk so it can't be spammed to death
      const pct = F.perfect ? 0.16 : Math.max(0.04, 0.09 * Math.pow(0.72, e.fatalCount));
      e.fatalCount++;
      const dmg = e.maxHp * pct * this.ageDmg();
      e.stagger = 0; e.structure = 0;
      this.damageEnemy(e, dmg, 0, dir, F.kind === 'runpunch' || F.kind === 'flykick' ? 600 : 250, { knockdown: true, hitstop: 0.1, shake: 0.9, melee: false, launch: F.kind === 'uppercut' ? 280 : 100 });
      this.particles.blood(hx, hy, 48, dir, 220);
      this.particles.fountain(e.x, e.y - 8, 14);
      this.splat(e.x, e.y, 20);
      this.texts.add(e.x, e.y - 30, F.perfect ? 'DEVASTATING!' : `-${Math.round(pct * 100)}%`, '#ffd700', 2, 1.2);
      return;
    }
    e.dead = true; this.kills++; this.score += Math.round(e.value * 2 * this.comboMult()); this.addCombo(3); this.dropLoot(e, true);
    this.addPool(e.x, e.y + 1, 7 + e.scale * 3);
    const corpse = (vx: number, vy: number, vz: number, spin: number): Corpse => ({ x: e.x, y: e.y, rot: 0, color: e.color, color2: e.color2, scale: e.scale, accessory: e.accessory, vx, vy, spin, t: 0, z: 1, vz, gib: true, bounces: 0 });
    switch (F.kind) {
      case 'uppercut':
        this.particles.blood(hx, hy, 20, -Math.PI / 2, 200);
        this.particles.fountain(e.x, e.y - 8, 16);
        this.corpses.push(corpse(cd * 40, sd * 40, 340, 16));
        this.particles.head(e.x, e.y - 10, cd * 30 + rnd(-20, 20), sd * 30, 300, e.color);
        this.splat(e.x, e.y, 14);
        break;
      case 'runpunch':
        this.gibAt(e.x, e.y, e.color, e.scale, dir, 1.5);
        for (let i = 0; i < 12; i++) this.stamp(e.x + cd * i * 5 + rnd(-3, 3), e.y + sd * i * 5 + rnd(-3, 3), '#8a0000', 2);
        this.particles.head(e.x, e.y - 10, cd * 260, sd * 260, 160, e.color);
        break;
      case 'flykick':
        this.particles.blood(hx, hy, 20, dir, 220);
        this.corpses.push(corpse(cd * 560, sd * 560, 70, 14));
        this.particles.head(e.x, e.y - 10, cd * 200 + rnd(-40, 40), sd * 200, 200, e.color);
        break;
      case 'rush':
        this.gibAt(e.x, e.y, e.color, e.scale, dir, 1.2);
        this.particles.head(e.x, e.y - 10, cd * 150, sd * 150 - 60, 220, e.color);
        break;
      case 'neckbreak': {
        // snap: body crumples in place, head stays at an impossible angle then rolls off
        this.sfx.stagger(); this.sfx.heavy();
        this.particles.blood(hx, hy, 10, dir, 60);
        this.corpses.push({ x: e.x, y: e.y, rot: dir + Math.PI / 2, color: e.color, color2: e.color2, scale: e.scale, accessory: e.accessory, vx: cd * 20, vy: sd * 20, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
        this.particles.head(e.x, e.y - 10, -cd * 40 + rnd(-15, 15), -sd * 40, 90, e.color);
        this.particles.fountain(e.x, e.y - 8, 10);
        this.splat(e.x, e.y, 12);
        break;
      }
      case 'kneedrop':
        this.gibAt(e.x, e.y, e.color, e.scale, -Math.PI / 2, 1.1);
        this.particles.blood(e.x, e.y - 4, 24, rnd(0, 6.3), 150);
        this.particles.head(e.x, e.y - 10, cd * 60 + rnd(-40, 40), sd * 60 + rnd(-40, 40), 260, e.color);
        break;
      case 'spinkick':
        this.particles.blood(hx, hy, 26, dir + 0.4 * p.facing, 240);
        this.particles.head(e.x, e.y - 10, cd * 330, sd * 330, 140, e.color);
        this.corpses.push(corpse(cd * 300, sd * 300, 160, 18));
        this.splat(e.x, e.y, 10);
        break;
      case 'stomp':
        this.particles.blood(e.x + cd * 6, e.y - 2, 30, dir, 170);
        this.particles.blood(e.x + cd * 6, e.y - 2, 20, dir + Math.PI, 110);
        this.splat(e.x + cd * 6, e.y, 30);
        this.addPool(e.x + cd * 4, e.y + 1, 9);
        this.corpses.push({ x: e.x, y: e.y, rot: dir, color: e.color, color2: e.color2, scale: e.scale, accessory: 'none', vx: 0, vy: 0, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
        for (let i = 0; i < 5; i++) this.particles.limb(e.x + cd * 6, e.y - 2, rnd(0, 6.3), 120, '#d40000', 2);
        break;
      case 'n_garrote': {
        this.sfx.stagger(); this.sfx.chainRattle();
        this.particles.blood(e.x, e.y - 10, 14, -Math.PI / 2, 80);
        this.corpses.push({ x: e.x, y: e.y, rot: dir, color: e.color, color2: e.color2, scale: e.scale, accessory: e.accessory, vx: cd * 10, vy: sd * 10, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
        this.particles.head(e.x, e.y - 10, cd * 20, sd * 20, 140, e.color);
        this.addPool(e.x, e.y + 1, 7);
        break;
      }
      case 'n_drum':
        this.gibAt(e.x, e.y, e.color, e.scale, -Math.PI / 2, 1.2);
        this.particles.fountain(e.x, e.y - 6, 20);
        this.splat(e.x, e.y, 30); this.addPool(e.x, e.y + 1, 10);
        break;
      case 'n_decap': {
        this.sfx.nunchakuHit(true);
        this.particles.fountain(e.x, e.y - 10, 24);
        this.particles.head(e.x, e.y - 10, cd * 260 + rnd(-30, 30), sd * 260, 220, e.color);
        this.corpses.push({ x: e.x, y: e.y, rot: dir, color: e.color, color2: e.color2, scale: e.scale, accessory: 'none', vx: cd * 30, vy: sd * 30, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
        this.addPool(e.x, e.y + 1, 9);
        break;
      }
      case 'k_bisect': {
        this.sfx.slashHit(true);
        const sa = dir + Math.PI / 2;
        this.particles.blood(e.x, e.y - 8, 30, sa, 170); this.particles.blood(e.x, e.y - 8, 30, sa + Math.PI, 170);
        this.particles.lines(e.x, e.y - 8, 6, '#ffffff', -Math.PI / 2, 120);
        const half = (vx: number, vy: number): Corpse => ({ x: e.x, y: e.y, rot: dir, color: e.color, color2: e.color2, scale: e.scale, accessory: e.accessory, vx, vy, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
        this.corpses.push(half(Math.cos(sa) * 70, Math.sin(sa) * 70)); this.corpses.push(half(Math.cos(sa + Math.PI) * 70, Math.sin(sa + Math.PI) * 70));
        this.splat(e.x, e.y, 28); this.addPool(e.x, e.y + 1, 10);
        break;
      }
      case 'k_behead': {
        this.sfx.slashHit(true);
        this.particles.fountain(e.x, e.y - 10, 26);
        this.particles.head(e.x, e.y - 10, cd * 120 + rnd(-30, 30), sd * 120, 260, e.color);
        // body stands for a moment then drops
        this.corpses.push({ x: e.x, y: e.y, rot: dir, color: e.color, color2: e.color2, scale: e.scale, accessory: 'none', vx: cd * 15, vy: sd * 15, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
        this.addPool(e.x, e.y + 1, 9);
        break;
      }
      case 'k_impale': {
        this.sfx.slashHit(true); this.sfx.whoosh();
        this.particles.blood(e.x, e.y - 10, 24, dir, 160);
        this.corpses.push(corpse(cd * 380, sd * 380, 140, 10));
        this.splat(e.x, e.y, 14);
        break;
      }
      case 'hammer':
        this.particles.blood(hx, hy, 34, -Math.PI / 2 + rnd(-0.5, 0.5), 200);
        this.particles.fountain(e.x, e.y - 6, 18);
        this.splat(e.x, e.y, 24);
        this.addPool(e.x, e.y + 1, 9);
        // body hammered flat into the floor
        this.corpses.push({ x: e.x, y: e.y, rot: dir, color: e.color, color2: e.color2, scale: e.scale, accessory: 'none', vx: 0, vy: 0, spin: 0, t: 0, z: 0, vz: 0, gib: false, bounces: 0 });
        for (let i = 0; i < 6; i++) this.particles.limb(e.x, e.y - 4, rnd(0, 6.3), 140, e.color, 3);
        break;
    }
  }

  endFatality() {
    const p = this.player;
    p.fatality = null; p.holdT = 0; p.z = 0; p.iframes = Math.max(0.5, Math.min(p.iframes, 1));
    this.cinematic = false; this.zoomTarget = 1; this.camFocus = null; this.slowT = 0;
  }

  // ------------------------------------------------------------------ physics
  physics(dt: number) {
    const es = this.enemies;
    for (const e of es) {
      if (e.dead || e.spawnT > 0) continue;
      unstick(this.level, e);
      const kSpeed = Math.hypot(e.kx, e.ky);
      const { bx, by } = moveWithCollision(this.level, e, (e.vx + e.kx) * dt, (e.vy + e.ky) * dt);
      if (bx || by) {
        if (kSpeed > 170) this.wallSlam(e, kSpeed);
        if (e.state === 'charge') {
          e.state = 'stun'; e.stun = 1.4; e.structure += 70; e.pose = 'hurt';
          this.shake(1); this.sfx.slam(); this.hitstop = Math.max(this.hitstop, 0.06);
          this.particles.smoke(e.x, e.y, 16, '#888', 60, 0.7);
          this.particles.burst(e.x, e.y - 6, 20, this.pal.wallTop, 160, 0.6, 2, 3);
          this.say('CRASH!', '#ffd700', 2, 0.8);
          if (e.structure >= e.maxStructure) this.staggerEnemy(e);
        }
        if (bx) e.kx *= -0.25;
        if (by) e.ky *= -0.25;
      }
      if (kSpeed > 150) {
        for (const pr of this.props) {
          if (pr.dead || pr.hp <= 0 || dist(e.x, e.y, pr.x, pr.y) > e.r + pr.r) continue;
          const a = Math.atan2(e.ky, e.kx);
          this.damageProp(pr, 10, a);
          this.damageEnemy(e, 2, 20, a + Math.PI, 40, { knockdown: true, hitstop: 0.03, shake: 0.2, melee: false });
          e.kx *= 0.3; e.ky *= 0.3;
          this.texts.add(e.x, e.y - 22, 'CRASH!', this.pal.accent2, 1, 0.6);
        }
      }
      // bleeding trail while being knocked around
      if (e.flinch > 0 && kSpeed > 90 && e.z <= 0 && Math.random() < 0.7) this.stamp(e.x + rnd(-3, 3), e.y + rnd(-1, 3), Math.random() < 0.3 ? '#5e0000' : '#8a0000', Math.random() < 0.35 ? 2 : 1);
      const f = Math.max(0, 1 - (e.z > 0 ? 1.2 : 6) * dt);
      e.kx *= f; e.ky *= f;
      if (Math.abs(e.kx) < 1) e.kx = 0;
      if (Math.abs(e.ky) < 1) e.ky = 0;
    }
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead || a.spawnT > 0) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.dead || b.spawnT > 0) continue;
        if ((a.z > 6) !== (b.z > 6)) continue;
        const d = dist(a.x, a.y, b.x, b.y), min = a.r + b.r;
        if (d >= min || d < 0.01) continue;
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, o = (min - d) * 0.5;
        const wa = b.r / (a.r + b.r), wb = a.r / (a.r + b.r);
        if (this.isFree(a.x - nx * o * wa * 2, a.y - ny * o * wa * 2, a.r)) { a.x -= nx * o * wa * 2; a.y -= ny * o * wa * 2; }
        if (this.isFree(b.x + nx * o * wb * 2, b.y + ny * o * wb * 2, b.r)) { b.x += nx * o * wb * 2; b.y += ny * o * wb * 2; }
        const ka = Math.hypot(a.kx, a.ky), kb = Math.hypot(b.kx, b.ky);
        if (ka > 180 && b.flash <= 0) this.bowl(a, b);
        else if (kb > 180 && a.flash <= 0) this.bowl(b, a);
      }
    }
  }
  bowl(mover: Enemy, hit: Enemy) {
    const a = Math.atan2(hit.y - mover.y, hit.x - mover.x);
    const sp = Math.hypot(mover.kx, mover.ky);
    mover.kx *= 0.4; mover.ky *= 0.4;
    this.damageEnemy(hit, 2 + sp / 80, 25, a, sp * 0.8, { knockdown: true, hitstop: 0.03, shake: 0.2, melee: false });
    this.damageEnemy(mover, 1, 10, a + Math.PI, 20, { knockdown: true, hitstop: 0.0, shake: 0, melee: false });
    this.say('BOWLING!', this.pal.accent2, 1, 0.6);
    this.particles.spark(hit.x, hit.y - 6, 6, '#ffffff', a, 1, 150);
    this.particles.impact(hit.x, hit.y - 6, 6, '#ffffff');
  }
  wallSlam(e: Enemy, speed: number) {
    const dmg = 3 + speed / 70;
    e.hp -= dmg;
    e.flash = 0.12;
    e.structure += 35 * this.stats.structureDmg;
    this.sfx.slam();
    this.shake(0.5);
    this.hitstop = Math.max(this.hitstop, 0.05);
    this.particles.smoke(e.x, e.y, 8, '#999', 40, 0.5);
    this.particles.burst(e.x, e.y - 6, 10, this.pal.wallTop, 120, 0.5, 2, 3);
    this.particles.blood(e.x, e.y - 6, 18, Math.atan2(-e.ky, -e.kx), 110);
    this.particles.impact(e.x, e.y - 6 - e.z, 8, '#ffffff');
    // blood splatter on the wall itself
    const kl = Math.hypot(e.kx, e.ky) || 1;
    const wx = e.x + (e.kx / kl) * 8, wy = e.y - 6 + (e.ky / kl) * 8;
    this.splat(wx, wy, 16, '#8a0000', true);
    for (let i = 0; i < 6; i++) this.stamp(wx + rnd(-4, 4), wy + i * 2, '#6e0000', 1, true);
    this.say('WALL SLAM!', this.pal.accent2, 1, 0.7);
    this.score += 15;
    this.addCombo();
    if (e.z > 0) e.vz = Math.min(e.vz, 0);
    if (e.hp <= 0) { this.killEnemy(e, Math.atan2(-e.ky, -e.kx), 300, false, true); return; }
    if (e.structure >= e.maxStructure && e.stagger <= 0) this.staggerEnemy(e);
    else if (!e.boss && e.stagger <= 0 && e.z <= 0) { e.down = 1.2; e.state = 'down'; }
    else if (e.boss) { e.stun = Math.max(e.stun, 0.5); e.state = 'stun'; }
  }

  // ------------------------------------------------------------------ bullets
  fireEnemyBullet(e: Enemy, angle: number, speed: number, dmg: number, kind: Bullet['kind'], color: string) {
    const hx = e.x + Math.cos(e.aim) * 8 * e.scale, hy = e.y - 7 * e.scale + Math.sin(e.aim) * 6;
    this.bullets.push({ x: hx, y: hy, px: hx, py: hy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: kind === 'orb' ? 3 : 2, dmg, owner: 'enemy', life: 3, color, pierce: 0, bounce: 0, kind, hitIds: [], structure: 0, kb: 0 });
    this.particles.spark(hx, hy, 3, color, angle, 0.4, 120);
    // enemy muzzle flash
    this.enemyMuzzles.push({ x: hx, y: hy, a: angle, t: 0.06, c: color });
    if (this.enemyMuzzles.length > 24) this.enemyMuzzles.shift();
    if (kind !== 'sniper') this.sfx.enemyShot();
    if (kind !== 'orb') this.particles.casing(e.x, e.y - 6, e.aim, e.facing);
  }
  throwBomb(e: Enemy, tx: number, ty: number, dmg: number) {
    const T = 0.9;
    this.bullets.push({ x: e.x, y: e.y - 8, px: e.x, py: e.y, vx: (tx - e.x) / T, vy: (ty - e.y) / T, r: 3, dmg, owner: 'enemy', life: T, color: '#222', pierce: 0, bounce: 0, kind: 'bomb', hitIds: [], structure: 0, kb: 0, z: 0, vz: 180 });
  }
  updateBullets(dt: number) {
    const p = this.player;
    const bs = this.bullets;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.px = b.x; b.py = b.y;
      b.life -= dt;
      if (b.kind === 'bomb') {
        b.x += b.vx * dt; b.y += b.vy * dt; b.z = (b.z ?? 0) + (b.vz ?? 0) * dt; b.vz = (b.vz ?? 0) - 400 * dt;
        if (b.life <= 0) {
          this.explode(b.x, b.y, 28, b.dmg, false);
          this.addHazard({ x: b.x, y: b.y, r: 20, maxR: 0.3, life: 2.6, kind: 'fire', dmg: 1 });
          bs.splice(i, 1);
        }
        continue;
      }
      const sp = Math.hypot(b.vx, b.vy);
      const steps = Math.max(1, Math.ceil((sp * dt) / 4));
      let alive = true;
      for (let s = 0; s < steps && alive; s++) {
        b.x += (b.vx * dt) / steps; b.y += (b.vy * dt) / steps;
        if (solidAt(this.level, b.x, b.y)) {
          if (b.bounce > 0) {
            b.bounce--;
            if (solidAt(this.level, b.x - (b.vx * dt) / steps, b.y)) b.vy *= -1; else b.vx *= -1;
            b.x += (b.vx * dt) / steps * 2; b.y += (b.vy * dt) / steps * 2;
            this.particles.spark(b.x, b.y, 4, b.color, Math.atan2(b.vy, b.vx), 0.8, 120);
            this.sfx.ricochet();
          } else {
            const back = Math.atan2(-b.vy, -b.vx);
            this.particles.spark(b.x, b.y, b.owner === 'player' ? 5 : 3, b.color, back, 1, 120);
            this.particles.smoke(b.x - Math.cos(back) * -2, b.y, 1, '#777', 10, 0.35);
            this.particles.burst(b.x, b.y, 3, this.pal.wallTop, 60, 0.3);
            if (b.owner === 'player') { this.bulletHole(b.px, b.py); if (Math.random() < 0.2) this.sfx.ricochet(); }
            alive = false;
          }
          break;
        }
        if (b.owner === 'player') {
          for (const e of this.enemies) {
            if (e.dead || e.spawnT > 0 || b.hitIds.includes(e.id)) continue;
            if (dist(b.x, b.y, e.x, e.y - 4 - e.z * 0.5) > e.r + b.r + 1) continue;
            b.hitIds.push(e.id);
            const a = Math.atan2(b.vy, b.vx);
            if (e.kind === 'shield' && e.stagger <= 0 && e.z <= 0 && Math.abs(angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.aim)) < 1.3) {
              this.particles.spark(b.x, b.y, 5, '#ffffff', a + Math.PI, 0.8, 150);
              this.particles.impact(b.x, b.y, 3, '#cccccc');
              this.sfx.hit(); this.sfx.ricochet();
              e.structure += 6;
              alive = false; break;
            }
            const hpBefore = e.hp;
            this.damageEnemy(e, b.dmg, b.structure, a, b.kb, { hitstop: b.kind === 'deflect' ? 0.05 : b.kind === 'pistol' ? 0.02 : 0.01, shake: b.kind === 'pistol' ? 0.08 : 0.05, melee: false });
            this.particles.blood(b.x, b.y, 3 + Math.floor(b.dmg * 0.6), a, 110);
            this.blood.spray(b.x, b.y, a, b.dmg * 0.7, false);
            this.stamp(e.x + rnd(-3, 3), e.y + rnd(0, 2), '#8a0000', 1);
            this.particles.spark(b.x, b.y, 3, '#ffffff', a, 0.7, 120);
            this.particles.impact(b.x, b.y, 3, '#ffffff');
            this.sfx.hit();
            this.addCombo();
            this.hitMarkerT = 0.14; this.hitMarkerKill = e.dead;
            if (e.dead && b.dmg >= hpBefore * 2 && Math.random() < 0.5) this.gibAt(e.x, e.y, e.color, e.scale, a, 0.8);
            if (b.pierce > 0) b.pierce--; else { alive = false; break; }
          }
          if (alive) for (const pr of this.props) {
            if (pr.dead) continue;
            if (dist(b.x, b.y, pr.x, pr.y - 3) > pr.r + b.r) continue;
            this.damageProp(pr, b.dmg, Math.atan2(b.vy, b.vx));
            alive = false; break;
          }
        } else {
          if (dist(b.x, b.y, p.x, p.y - 5) < p.r + b.r + 1) {
            if (p.parryT > 0) { this.deflectBullet(b, p.aim); this.say('PARRY!', '#35f0ff', 2, 0.6); this.slow(0.15, 0.3); break; }
            if (p.dashT > 0 || p.z > 12) {
              if (!b.hitIds.includes(-1)) {
                b.hitIds.push(-1); p.focus = Math.min(300, p.focus + 8 * this.stats.focusGain);
                if (p.z > 12) this.texts.add(p.x, p.y - 24 - p.z, 'HOP!', '#9be7ff', 1, 0.4);
              }
              continue;
            }
            if (p.iframes > 0) continue;
            this.damagePlayer(b.dmg, Math.atan2(b.vy, b.vx));
            alive = false; break;
          }
        }
      }
      if (!alive || b.life <= 0) bs.splice(i, 1);
    }
    for (let i = this.pendingBooms.length - 1; i >= 0; i--) {
      const pb = this.pendingBooms[i];
      pb.t -= dt;
      if (pb.t <= 0) { this.pendingBooms.splice(i, 1); this.explode(pb.x, pb.y, pb.r, pb.dmg, pb.fromPlayer); }
    }
  }

  updatePickups(dt: number) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      const o = { x: k.x, y: k.y, r: 3 };
      moveWithCollision(this.level, o, k.vx * dt, k.vy * dt);
      k.x = o.x; k.y = o.y;
      const f = Math.max(0, 1 - 5 * dt); k.vx *= f; k.vy *= f;
      const d = dist(p.x, p.y, k.x, k.y);
      if (d < 34 || k.magnet) {
        k.magnet = true;
        const sp = 240;
        k.x += ((p.x - k.x) / d) * sp * dt; k.y += ((p.y - k.y) / d) * sp * dt;
      }
      if (d < 9) {
        this.pickups.splice(i, 1);
        this.sfx.pickup();
        this.particles.burst(k.x, k.y - 4, 8, '#ffffff', 60, 0.4);
        let txt = '';
        let col = '#ffffff';
        switch (k.kind) {
          case 'ammoP': p.ammoP = Math.min(Math.round(60 * this.stats.maxAmmo), p.ammoP + 12); txt = '+12 PISTOL'; col = '#ffd166'; break;
          case 'ammoR': p.ammoR = Math.min(Math.round(180 * this.stats.maxAmmo), p.ammoR + 30); txt = '+30 RIFLE'; col = '#7bed9f'; break;
          case 'hp': this.heal(1); break;
          case 'focus': p.focus = Math.min(300, p.focus + 100); txt = '+FOCUS'; col = '#35f0ff'; break;
          case 'rifle': p.hasRifle = true; p.ammoR = Math.min(Math.round(180 * this.stats.maxAmmo), p.ammoR + 60); txt = 'RIFLE! (3)'; col = '#7bed9f'; this.setWeapon('rifle'); break;
          case 'nunchaku': p.hasNunchaku = true; txt = 'NUNCHAKU! (4)'; col = '#ffd166'; this.setWeapon('nunchaku'); this.slow(0.5, 0.3); this.flash('#ffd166', 0.2); break;
          case 'katana': p.hasKatana = true; txt = 'KATANA! (5)'; col = '#bfe8ff'; this.setWeapon('katana'); this.slow(0.5, 0.3); this.flash('#bfe8ff', 0.25); this.sfx.sheathe(); break;
          case 'axe': p.hasAxe = true; txt = 'AXE! (6)'; col = '#ffb347'; this.setWeapon('axe'); this.slow(0.5, 0.3); this.flash('#ffb347', 0.25); this.sfx.axeHit(true); break;
          case 'dual': p.hasDual = true; txt = 'DUAL BLADES! (7)'; col = '#bfe8ff'; this.setWeapon('dual'); this.slow(0.5, 0.3); this.flash('#bfe8ff', 0.25); this.sfx.dualSwing(); break;
        }
        if (txt) this.texts.add(p.x + 22 * p.facing, p.y + 6, txt, col, 1, 0.7);
      }
    }
  }
  updateProps(dt: number) {
    for (const pr of this.props) {
      if (pr.flash > 0) pr.flash -= dt;
      if (pr.hp <= 0 && !pr.dead && pr.flash <= 0) pr.dead = true;
    }
  }
  updateHazards(dt: number) {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.life -= dt;
      if (h.kind === 'ring') {
        h.r += ((h.maxR + 36) / h.max) * dt;
        if (h.r > 0 && !h.hit) {
          const d = dist(h.x, h.y, p.x, p.y);
          if (Math.abs(d - h.r) < 7) { h.hit = true; this.damagePlayer(h.dmg, Math.atan2(p.y - h.y, p.x - h.x)); }
        }
      } else if (h.kind === 'fire') {
        if (Math.random() < 0.6) this.particles.ember(h.x + rnd(-h.r, h.r) * 0.7, h.y + rnd(-h.r, h.r) * 0.5, 1, Math.random() < 0.5 ? '#ff6a00' : '#ffd27f');
        if (dist(h.x, h.y, p.x, p.y) < h.r) this.damagePlayer(h.dmg, Math.atan2(p.y - h.y, p.x - h.x));
        h.maxR -= dt;
        if (h.maxR <= 0) {
          h.maxR = 0.5;
          for (const e of this.enemies) if (!e.dead && dist(h.x, h.y, e.x, e.y) < h.r) this.damageEnemy(e, 1.5, 5, Math.atan2(e.y - h.y, e.x - h.x), 30, { hitstop: 0, shake: 0, melee: false });
        }
      }
      if (h.life <= 0) this.hazards.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ camera
  updateCamera(raw: number) {
    const p = this.player;
    const look = this.state === 'menu' ? 0 : 0.22;
    let tx: number, ty: number;
    if (this.camFocus) { tx = this.camFocus.x - VIEW_W / 2; ty = this.camFocus.y - 6 - VIEW_H / 2; }
    else {
      const mw = this.mouseWorld();
      tx = p.x + (mw.x - p.x) * look - VIEW_W / 2; ty = p.y - 6 + (mw.y - p.y) * look - VIEW_H / 2;
    }
    const k = 1 - Math.exp(-(this.camFocus ? 12 : 9) * raw);
    this.cam.x = lerp(this.cam.x, tx, k); this.cam.y = lerp(this.cam.y, ty, k);
    const lw = this.level.w * TILE, lh = this.level.h * TILE;
    // clamp the *visible* (zoomed) region to the level bounds
    const hw = VIEW_W / (2 * this.zoom), hh = VIEW_H / (2 * this.zoom);
    this.cam.x = lw < 2 * hw ? (lw - VIEW_W) / 2 : clamp(this.cam.x, hw - VIEW_W / 2, lw - VIEW_W / 2 - hw);
    this.cam.y = lh < 2 * hh ? (lh - VIEW_H) / 2 : clamp(this.cam.y, hh - VIEW_H / 2, lh - VIEW_H / 2 - hh);
    const s = this.trauma * this.trauma;
    this.shakeX = rnd(-1, 1) * s * 8; this.shakeY = rnd(-1, 1) * s * 6;
    const kd = Math.exp(-14 * raw);
    this.camKick.x *= kd; this.camKick.y *= kd;
    this.zoomKick = Math.max(0, this.zoomKick - raw * 0.6);
    this.zoom = lerp(this.zoom, this.zoomTarget + this.zoomKick, 1 - Math.exp(-7 * raw));
    if (Math.abs(this.zoom - 1) < 0.004 && this.zoomTarget === 1 && this.zoomKick === 0) this.zoom = 1;
  }

  // ------------------------------------------------------------------ render
  render() {
    const ctx = this.wctx;
    const sc = this.ctx;
    const p = this.player;
    const pal = this.pal;
    ctx.imageSmoothingEnabled = false;
    sc.imageSmoothingEnabled = false;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const ox = Math.round(-this.cam.x + this.shakeX + this.camKick.x), oy = Math.round(-this.cam.y + this.shakeY + this.camKick.y);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.drawImage(this.levelCanvas, 0, 0);
    this.blood.drawStains(ctx);
    for (const h of this.hazards) {
      if (h.kind === 'fire') {
        ctx.globalAlpha = 0.5 * Math.min(1, h.life);
        for (let i = 0; i < 10; i++) px(ctx, h.x + rnd(-h.r, h.r) * 0.8, h.y + rnd(-h.r, h.r) * 0.55, i % 3 ? '#ff6a00' : '#ffd27f');
        pring(ctx, h.x, h.y, h.r, '#ff6a00', 1);
        ctx.globalAlpha = 1;
      } else if (h.kind === 'ring' && h.r > 0) {
        ctx.globalAlpha = clamp(h.life / h.max, 0, 1);
        pring(ctx, h.x, h.y, h.r, '#ffffff', 2);
        pring(ctx, h.x, h.y, Math.max(0, h.r - 3), pal.accent2, 1);
        ctx.globalAlpha = 1;
      }
    }
    if (this.exitOpen) {
      const ex = this.level.exit;
      const t = this.portalT;
      ctx.globalAlpha = 0.18;
      prect(ctx, ex.x - 5, ex.y - 70, 10, 70, pal.accent);
      ctx.globalAlpha = 0.1;
      prect(ctx, ex.x - 9, ex.y - 70, 18, 70, pal.accent);
      ctx.globalAlpha = 0.2;
      pcircle(ctx, ex.x, ex.y, 12 + Math.sin(t * 4) * 2, pal.accent);
      ctx.globalAlpha = 1;
      pring(ctx, ex.x, ex.y, 12 + Math.sin(t * 4) * 2, pal.accent, 2);
      pring(ctx, ex.x, ex.y, 7 + Math.cos(t * 5) * 1.5, '#ffffff', 1);
      for (let i = 0; i < 6; i++) { const a = t * 3 + (i * Math.PI) / 3; px(ctx, ex.x + Math.cos(a) * 10, ex.y + Math.sin(a) * 10 * 0.6, '#ffffff'); }
      pfontO(ctx, 'EXIT', ex.x, ex.y - 26 + Math.sin(t * 3) * 2, '#ffffff', '#000', 1, 'center');
    }
    for (const k of this.pickups) {
      const bob = Math.sin(k.t * 5 + k.x) * 1.5;
      const y = k.y - 4 + bob;
      pellipseShadow(ctx, k.x, k.y + 1);
      const glow = Math.sin(this.time * 6) > 0;
      switch (k.kind) {
        case 'ammoP': prect(ctx, k.x - 2, y - 2, 5, 4, '#1a1200'); prect(ctx, k.x - 1, y - 1, 3, 2, glow ? '#fff2a8' : '#ffd166'); break;
        case 'ammoR': prect(ctx, k.x - 3, y - 2, 7, 4, '#0a1a0e'); prect(ctx, k.x - 2, y - 1, 5, 2, glow ? '#c8ffd4' : '#7bed9f'); break;
        case 'hp': prect(ctx, k.x - 1, y - 3, 3, 7, '#ff3b3b'); prect(ctx, k.x - 3, y - 1, 7, 3, '#ff3b3b'); px(ctx, k.x, y, '#ffffff'); break;
        case 'focus': pline(ctx, k.x, y - 3, k.x + 3, y, '#35f0ff'); pline(ctx, k.x + 3, y, k.x, y + 3, '#35f0ff'); pline(ctx, k.x, y + 3, k.x - 3, y, '#35f0ff'); pline(ctx, k.x - 3, y, k.x, y - 3, '#35f0ff'); px(ctx, k.x, y, '#ffffff'); break;
        case 'rifle': prect(ctx, k.x - 5, y - 1, 10, 2, '#d4d4d4'); prect(ctx, k.x - 5, y + 1, 2, 2, '#8a5a2b'); pfontO(ctx, 'RIFLE', k.x, y - 10, '#7bed9f', '#000', 1, 'center'); break;
        case 'axe': { drawAxeIcon(ctx, k.x, y); ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.3; pring(ctx, k.x, y, 9, '#ffb347', 1); ctx.globalAlpha = 1; pfontO(ctx, 'AXE', k.x, y - 13, '#ffb347', '#000', 1, 'center'); break; }
        case 'dual': { drawDualIcon(ctx, k.x, y); ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.3; pring(ctx, k.x, y, 9, '#bfe8ff', 1); ctx.globalAlpha = 1; pfontO(ctx, 'DUAL BLADES', k.x, y - 13, '#bfe8ff', '#000', 1, 'center'); break; }
        case 'katana': {
          pline(ctx, k.x - 8, y + 3, k.x + 7, y - 4, '#000', 3); pline(ctx, k.x - 8, y + 3, k.x + 7, y - 4, '#d9dde3', 1); pline(ctx, k.x - 6, y + 1, k.x - 8, y + 3, '#3b2a6b', 2); px(ctx, k.x - 5, y + 1, '#c9a033');
          ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.3; pring(ctx, k.x, y, 9, '#bfe8ff', 1); ctx.globalAlpha = 1;
          pfontO(ctx, 'KATANA', k.x, y - 12, '#bfe8ff', '#000', 1, 'center');
          break;
        }
        case 'nunchaku': {
          pline(ctx, k.x - 6, y + 2, k.x - 1, y - 3, '#c9a063', 2); pline(ctx, k.x + 1, y - 3, k.x + 6, y + 2, '#c9a063', 2);
          pline(ctx, k.x - 1, y - 3, k.x + 1, y - 3, '#dcdcdc', 1);
          ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.3; pring(ctx, k.x, y, 8, '#ffd166', 1); ctx.globalAlpha = 1;
          pfontO(ctx, 'NUNCHAKU', k.x, y - 12, '#ffd166', '#000', 1, 'center');
          break;
        }
      }
    }
    for (const pr of this.props) {
      if (pr.dead) continue;
      pellipseShadow(ctx, pr.x, pr.y + 2, 6);
      const fl = pr.flash > 0 && (pr.hp > 0 || Math.floor(this.time * 18) % 2 === 0);
      if (pr.kind === 'crate') {
        prect(ctx, pr.x - 5, pr.y - 9, 11, 11, fl ? '#fff' : '#3a2410');
        prect(ctx, pr.x - 4, pr.y - 8, 9, 9, fl ? '#fff' : '#8a5a2b');
        pline(ctx, pr.x - 4, pr.y - 8, pr.x + 4, pr.y, fl ? '#fff' : '#5a3a1b');
        pline(ctx, pr.x + 4, pr.y - 8, pr.x - 4, pr.y, fl ? '#fff' : '#5a3a1b');
      } else {
        prect(ctx, pr.x - 4, pr.y - 11, 9, 13, fl ? '#fff' : '#5a0f0f');
        prect(ctx, pr.x - 3, pr.y - 10, 7, 11, fl ? '#fff' : '#c0392b');
        prect(ctx, pr.x - 3, pr.y - 7, 7, 1, '#2a0a0a');
        prect(ctx, pr.x - 3, pr.y - 3, 7, 1, '#2a0a0a');
        prect(ctx, pr.x - 1, pr.y - 6, 3, 2, fl ? '#fff' : '#ffd166');
      }
    }
    for (const c of this.corpses) {
      if (c.z > 0) drawShadow(ctx, c.x, c.y, c.scale, c.z);
      drawStick(ctx, { x: c.x, y: c.y, c: c.color, c2: c.color2, scale: c.scale, facing: Math.cos(c.rot) >= 0 ? 1 : -1, aim: c.rot, walk: 0, moving: false, pose: c.z > 0 ? 'launched' : 'down', t: 0, acc: c.accessory, weapon: 'none', flash: false, alpha: c.z > 0 ? 1 : 0.8, outline: c.z > 0 ? '#000' : null, eyes: '#000', time: 0, lean: { x: 1, y: 0 }, rot: c.z > 0 ? c.rot : 0, z: c.z, mood: 'dead' });
    }
    const shadowScale = 1;
    for (const e of this.enemies) if (!e.dead && e.spawnT <= 0) drawShadow(ctx, e.x, e.y, e.scale * shadowScale, e.z);
    if (this.state !== 'dead') drawShadow(ctx, p.x, p.y, shadowScale, p.z);
    for (const a of this.afterimages) {
      drawStick(ctx, { x: a.x, y: a.y, c: a.color, c2: a.color, scale: a.scale, facing: a.facing, aim: a.aim, walk: 0, moving: false, pose: a.pose, t: a.t, acc: 'none', weapon: 'none', flash: true, alpha: (a.life / a.max) * 0.45, outline: null, eyes: a.color, time: 0, lean: a.lean });
    }
    const ftg = this.state === 'playing' && !p.fatality ? this.fatalityTarget() : null;
    this.fatTargetId = ftg && (ftg.e.stagger > 0 || this.fatalityCd <= 0) ? ftg.e.id : -1;
    const ents: (Enemy | 'player')[] = [...this.enemies.filter((e) => !e.dead)];
    if (this.state !== 'dead') ents.push('player');
    ents.sort((a, b) => (a === 'player' ? p.y : a.y) - (b === 'player' ? p.y : b.y));
    for (const en of ents) {
      if (en === 'player') this.drawPlayer();
      else this.drawEnemy(en);
    }
    for (const b of this.bullets) {
      if (b.kind === 'bomb') {
        const land = { x: b.x + b.vx * b.life, y: b.y + b.vy * b.life };
        ctx.globalAlpha = 0.5 + Math.sin(this.time * 20) * 0.3;
        pring(ctx, land.x, land.y, 20, '#ff4040', 1);
        ctx.globalAlpha = 1;
        pellipseShadow(ctx, b.x, b.y, 3);
        pcircle(ctx, b.x, b.y - (b.z ?? 0), 2.5, '#1a1a1a');
        px(ctx, b.x, b.y - (b.z ?? 0) - 3, Math.floor(this.time * 20) % 2 ? '#fff' : '#ff9f43');
      } else {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const nx = b.vx / sp, ny = b.vy / sp;
        if (b.kind === 'orb') {
          ctx.globalAlpha = 0.35; pline(ctx, b.x, b.y, b.x - nx * 6, b.y - ny * 6, b.color, 1); ctx.globalAlpha = 1;
          pcircle(ctx, b.x, b.y, 2.5 + Math.sin(this.time * 20) * 0.5, b.color); px(ctx, b.x, b.y, '#ffffff');
        } else if (b.kind === 'sniper') {
          pline(ctx, b.x, b.y, b.x - b.vx * 0.03, b.y - b.vy * 0.03, '#ffffff', 2);
        } else {
          const len = b.owner === 'player' ? 22 : 10;
          ctx.globalAlpha = 0.18; pline(ctx, b.x - nx * len * 0.5, b.y - ny * len * 0.5, b.x - nx * len, b.y - ny * len, b.color, 1);
          ctx.globalAlpha = 0.45; pline(ctx, b.x - nx * len * 0.2, b.y - ny * len * 0.2, b.x - nx * len * 0.5, b.y - ny * len * 0.5, b.color, 1);
          ctx.globalAlpha = 0.9; pline(ctx, b.x, b.y, b.x - nx * len * 0.2, b.y - ny * len * 0.2, '#ffffff', 1);
          ctx.globalAlpha = 1;
          prect(ctx, b.x - 1, b.y - 1, 3, 3, b.color); px(ctx, b.x, b.y, '#ffffff');
        }
      }
    }
    this.particles.draw(ctx);
    this.blood.drawDrops(ctx);
    this.katana.drawArcs(ctx);
    // enemy muzzle flashes
    for (let i = this.enemyMuzzles.length - 1; i >= 0; i--) {
      const m = this.enemyMuzzles[i];
      m.t -= this.rawDt;
      if (m.t <= 0) { this.enemyMuzzles.splice(i, 1); continue; }
      const k = m.t / 0.06;
      ctx.globalAlpha = 0.9 * k;
      const len = 5 + rnd(0, 2);
      pline(ctx, m.x, m.y, m.x + Math.cos(m.a) * len, m.y + Math.sin(m.a) * len, m.c, 2);
      pline(ctx, m.x, m.y, m.x + Math.cos(m.a + 0.6) * len * 0.5, m.y + Math.sin(m.a + 0.6) * len * 0.5, m.c, 1);
      pline(ctx, m.x, m.y, m.x + Math.cos(m.a - 0.6) * len * 0.5, m.y + Math.sin(m.a - 0.6) * len * 0.5, m.c, 1);
      pcircle(ctx, m.x, m.y, 1.5, '#ffffff');
      ctx.globalAlpha = 0.12 * k;
      pcircle(ctx, m.x, m.y, 14, m.c);
      ctx.globalAlpha = 1;
    }
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const shooter = e.kind === 'gunner' || e.kind === 'rifleman' || e.kind === 'sniper' || e.kind === 'smg' || e.kind === 'shotgun' || e.boss === 'queen';
      if (e.state === 'windup' && shooter) {
        // aim telegraph: a laser that solidifies as the shot comes; wide cone for shotgun / smg
        const a = clamp(1 - e.stateT / e.poseDur, 0, 1);
        const len = e.kind === 'sniper' ? 320 : e.kind === 'shotgun' ? 70 : 170;
        const hx = e.x + Math.cos(e.aim) * 8 * e.scale, hy = e.y - 7 * e.scale + Math.sin(e.aim) * 6;
        const col = e.kind === 'sniper' ? '#ff2a2a' : e.kind === 'smg' ? '#7fe3ff' : e.kind === 'shotgun' ? '#ffb8b8' : '#ff8080';
        if (e.kind === 'shotgun' || e.kind === 'smg') {
          const spread = e.kind === 'shotgun' ? 0.36 : 0.3;
          ctx.globalAlpha = a * 0.35;
          pline(ctx, hx, hy, hx + Math.cos(e.aim + spread) * len, hy + Math.sin(e.aim + spread) * len, col, 1);
          pline(ctx, hx, hy, hx + Math.cos(e.aim - spread) * len, hy + Math.sin(e.aim - spread) * len, col, 1);
        }
        ctx.globalAlpha = a * (e.kind === 'sniper' ? 0.9 : 0.55);
        const dashLen = a < 0.7 ? 6 : 1000;
        for (let d0 = 0; d0 < len; d0 += dashLen * 2) {
          const d1 = Math.min(len, d0 + dashLen);
          pline(ctx, hx + Math.cos(e.aim) * d0, hy + Math.sin(e.aim) * d0, hx + Math.cos(e.aim) * d1, hy + Math.sin(e.aim) * d1, col, 1);
          if (dashLen > len) break;
        }
        // "!" over the head right before the shot
        if (a > 0.6) pfontO(ctx, '!', e.x, e.y - e.z - 15 * e.scale - 8, Math.floor(this.time * 20) % 2 ? col : '#ffffff', '#000', 1, 'center');
        ctx.globalAlpha = 1;
      }
      if (e.reload > 0 && !e.boss) {
        const def = e.kind !== 'boss' ? (e.reload / 2.2) : 0;
        prect(ctx, e.x - 6, e.y - 15 * e.scale - 6, 12, 2, '#111');
        prect(ctx, e.x - 6, e.y - 15 * e.scale - 6, Math.round(12 * (1 - clamp(def, 0, 1))), 2, '#aaaaaa');
      }
      if (e.state === 'chargewind') {
        ctx.globalAlpha = 0.3 + Math.sin(this.time * 25) * 0.2;
        pline(ctx, e.x, e.y, e.x + Math.cos(e.aim) * 300, e.y + Math.sin(e.aim) * 300, '#ff3030', 3);
        ctx.globalAlpha = 1;
      }
      if (e.state === 'slamwind') {
        ctx.globalAlpha = 0.3 + Math.sin(this.time * 20) * 0.2;
        pring(ctx, e.x, e.y, 34, '#ff3030', 1);
        ctx.globalAlpha = 1;
      }
    }
    this.texts.draw(ctx);
    ctx.restore();

    // ---- present scene (with cinematic zoom) + screen-space layers
    sc.fillStyle = pal.bg;
    sc.fillRect(0, 0, VIEW_W, VIEW_H);
    if (this.zoom !== 1) {
      sc.save();
      sc.translate(VIEW_W / 2, VIEW_H / 2);
      sc.scale(this.zoom, this.zoom);
      sc.translate(-VIEW_W / 2, -VIEW_H / 2);
      sc.drawImage(this.scene, 0, 0);
      sc.restore();
    } else sc.drawImage(this.scene, 0, 0);
    if (this.wipe) {
      const r = Math.max(0, (1 - this.wipe.t) * 560);
      sc.fillStyle = '#000';
      sc.beginPath();
      sc.rect(0, 0, VIEW_W, VIEW_H);
      sc.arc(p.x + ox, p.y - 6 + oy, r, 0, Math.PI * 2, true);
      sc.fill('evenodd');
    }
    if (this.flashA > 0) { sc.globalAlpha = Math.min(0.8, this.flashA); sc.fillStyle = this.flashC; sc.fillRect(0, 0, VIEW_W, VIEW_H); sc.globalAlpha = 1; }
    drawVignette(sc, this.vignette);
    if (this.blood.gore && this.state !== 'menu') this.blood.drawScreen(sc, this.player.hp / this.maxHp(), this.time);
    if (this.state === 'playing' && p.hp <= 1) { sc.globalAlpha = 0.08 + Math.sin(this.time * 6) * 0.05; sc.fillStyle = '#ff0000'; sc.fillRect(0, 0, VIEW_W, VIEW_H); sc.globalAlpha = 1; }
    if (this.timeScale < 0.75 || this.cinematic) {
      const h = this.cinematic ? 18 : Math.round((0.75 - this.timeScale) * 40);
      prect(sc, 0, 0, VIEW_W, h, '#000'); prect(sc, 0, VIEW_H - h, VIEW_W, h, '#000');
    }
    if (this.state === 'menu') {
      sc.fillStyle = 'rgba(0,0,0,0.15)';
      sc.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    drawHUD(sc, this);
    if (this.state === 'playing') {
      const alive = this.enemies.filter((e) => !e.dead);
      const targets: { x: number; y: number; c: string; label?: string }[] = [];
      if (this.mode === 'survival') { for (const e of alive) if (e.boss) targets.push({ x: e.x, y: e.y, c: '#ff2a2a', label: 'BOSS' }); }
      else if (alive.length <= 3 && this.spawnQueue.length === 0) for (const e of alive) targets.push({ x: e.x, y: e.y, c: e.color });
      if (this.exitOpen) targets.push({ x: this.level.exit.x, y: this.level.exit.y, c: pal.accent, label: 'EXIT' });
      for (const t of targets) {
        const sx = t.x - this.cam.x, sy = t.y - this.cam.y;
        if (sx >= 0 && sx <= VIEW_W && sy >= 0 && sy <= VIEW_H) continue;
        const m = 14;
        const ax = clamp(sx, m, VIEW_W - m), ay = clamp(sy, m, VIEW_H - m);
        const a = Math.atan2(sy - ay, sx - ax);
        const tipx = ax + Math.cos(a) * 6, tipy = ay + Math.sin(a) * 6;
        const b1x = ax + Math.cos(a + 2.5) * 5, b1y = ay + Math.sin(a + 2.5) * 5;
        const b2x = ax + Math.cos(a - 2.5) * 5, b2y = ay + Math.sin(a - 2.5) * 5;
        sc.globalAlpha = 0.6 + Math.sin(this.time * 8) * 0.3;
        pline(sc, tipx, tipy, b1x, b1y, t.c, 1); pline(sc, tipx, tipy, b2x, b2y, t.c, 1); pline(sc, b1x, b1y, b2x, b2y, t.c, 1);
        if (t.label) pfontO(sc, t.label, ax, ay + (sy > ay ? -14 : 9), t.c, '#000', 1, 'center');
        sc.globalAlpha = 1;
      }
    }
    if (this.bannerT > 0 && this.state === 'playing' && this.mode === 'story') {
      const el = 2.4 - this.bannerT;
      const a = el < 0.25 ? el / 0.25 : this.bannerT < 0.5 ? this.bannerT / 0.5 : 1;
      sc.globalAlpha = a * 0.7;
      prect(sc, 0, VIEW_H / 2 - 26, VIEW_W, 52, '#000');
      sc.globalAlpha = a;
      prect(sc, 0, VIEW_H / 2 - 27, VIEW_W, 1, pal.accent);
      prect(sc, 0, VIEW_H / 2 + 26, VIEW_W, 1, pal.accent);
      const z = ZONES[this.level.zone];
      pfontO(sc, z.name, VIEW_W / 2, VIEW_H / 2 - 18, pal.accent, '#000', 3, 'center');
      pfont(sc, `LEVEL ${this.levelN}${this.level.isBoss ? ' - BOSS' : ''}`, VIEW_W / 2, VIEW_H / 2 + 2, '#ffffff', 2, 'center');
      pfont(sc, z.sub, VIEW_W / 2, VIEW_H / 2 + 15, '#9a9a9a', 1, 'center');
      sc.globalAlpha = 1;
    }
    if (this.state === 'dead') {
      sc.fillStyle = 'rgba(60,0,0,0.35)';
      sc.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawPlayer() {
    const ctx = this.wctx;
    const p = this.player;
    let pose: Pose = 'idle';
    let t = 0;
    let trail: string | null = null;
    if (this.state === 'menu' && this.menuMove) { pose = MOVES[this.menuMove].pose; t = 0.3 + 0.6 * Math.min(1, this.menuMoveT / 0.5); }
    else if (p.fatality || p.holdT > 0) { pose = p.holdPose; t = p.holdPoseT; }
    else if (p.rageDash) pose = 'ragedash';
    else if (p.dashT > 0 || p.focusDash) pose = 'dash';
    else if (p.attackPhase !== 'none' && p.moveKey) { const m = MOVES[p.moveKey]; pose = m.pose; t = this.attackPoseT(); if (m.trail) trail = this.pal.accent2; }
    else if (p.airborne) { pose = 'jump'; t = p.vz > 60 ? 0.15 + 0.2 * (1 - p.vz / 215) : p.vz > -60 ? 0.45 : clamp(0.55 + 0.3 * (1 - Math.max(0, p.z) / 30), 0.5, 0.84); }
    else if (p.landT > 0) { pose = 'jump'; t = 0.85 + 0.15 * (1 - p.landT / 0.12); }
    else if (p.parryT > 0 || p.parryCd > 0.3) pose = 'parry';
    else if (p.stunT > 0) pose = 'hurt';
    else if (p.weapon === 'pistol' || p.weapon === 'rifle') pose = 'shoot';
    else if (p.moving && p.runT > 0.03) pose = 'run';
    else if (p.weapon === 'nunchaku') pose = 'n_idle';
    else if (p.weapon === 'katana') pose = p.sheatheT > 0 ? 'k_sheathe' : 'k_idle';
    else if (p.weapon === 'axe') pose = 'a_idle';
    else if (p.weapon === 'dual') pose = 'd_idle';
    if (pose === 'k_sheathe') t = 1 - p.sheatheT / 0.45;
    // pose transition blending: whenever the pose changes, cross-fade from the previous skeleton over ~70ms
    if (pose !== p.prevPose && p.blend <= 0.01) { p.prevPoseT = this.lastPoseT; p.blend = pose === 'dash' || pose === 'hurt' ? 0.5 : 1; }
    p.blend = Math.max(0, p.blend - this.rawDt / 0.07);
    const prevPose = p.prevPose;
    if (p.blend <= 0.01) p.prevPose = pose;
    this.lastPoseT = t;
    const blink = p.iframes > 0 && !p.fatality && Math.floor(this.time * 24) % 2 === 0;
    const opts = this.playerStickOpts(pose, t); // SAME skeleton the hit-tester uses
    if (pose === 'ragedash' || p.rageDash) { opts.pose = 'ragedash'; opts.c = '#ff6a6a'; }
    if (p.rageOn) { opts.c2 = '#ff2a2a'; opts.eyes = '#ff2a2a'; }
    opts.alpha = blink ? 0.45 : 1; opts.trail = trail;
    if (p.attackPhase !== 'none' && p.moveKey) {
      const m = MOVES[p.moveKey];
      if (m.limb === 'fhand' || m.limb === 'bhand' || m.limb === 'ffoot' || m.limb === 'bfoot' || m.limb === 'both') { opts.strike = m.id === 'chain' && p.chainSide < 0 ? 'bhand' : m.limb; opts.impact = m.id === 'chain' ? (t <= 0.35 ? 1 : 0) : t >= 0.3 && t <= 0.62 ? 1 : 0; }
      if (m.limb === 'sweep') { opts.strike = 'ffoot'; opts.impact = t >= 0.3 && t <= 0.7 ? 1 : 0; }
    }
    opts.mood = p.stunT > 0 ? 'hurt' : p.fatality || p.attackPhase !== 'none' ? 'angry' : this.combo >= 6 ? 'happy' : 'normal';
    drawStick(ctx, opts, prevPose !== pose ? { pose: prevPose, t: p.prevPoseT, blend: p.blend } : undefined);
    if (p.parryT > 0) pring(ctx, p.x, p.y - 6, 9, '#9be7ff', 1, p.aim - 1, p.aim + 1);
    if (p.weapon === 'nunchaku' && !p.fatality) this.nunchaku.draw(ctx, '#c9a063', '#bdbdbd', p.attackPhase !== 'none' ? this.pal.accent2 : null);
    if (p.weapon === 'axe' || p.weapon === 'dual') {
      const sk = solvePose(opts);
      const m = p.attackPhase !== 'none' && p.moveKey ? MOVES[p.moveKey] : null;
      const lift = m?.slash?.lift ?? 0;
      const fh = { x: p.x + sk.fhand.x, y: p.y + sk.fhand.y - p.z }, bh = { x: p.x + sk.bhand.x, y: p.y + sk.bhand.y - p.z };
      const a1 = p.attackPhase !== 'none' ? p.bladeA : p.weapon === 'axe' ? p.aim + Math.PI + 0.9 * p.facing : p.aim;
      if (p.weapon === 'axe') drawAxe(ctx, fh, a1, lift);
      else { drawShortBlade(ctx, fh, a1, lift); drawShortBlade(ctx, bh, p.attackPhase !== 'none' ? p.bladeB : p.aim + Math.PI * 0.85, lift); }
    }
    if (p.weapon === 'katana') {
      const sk = solvePose(opts);
      const hand = { x: p.x + sk.fhand.x, y: p.y + sk.fhand.y - p.z };
      const hip = { x: p.x + sk.hip.x, y: p.y + sk.hip.y - p.z };
      const sheathed = pose === 'k_sheathe' && t > 0.6;
      this.katana.drawScabbard(ctx, hip, p.facing);
      const ba = p.fatality ? p.bladeA : (p.attackPhase !== 'none' ? p.bladeA : p.aim);
      const m = p.attackPhase !== 'none' && p.moveKey ? MOVES[p.moveKey] : null;
      const b = this.katana.blade(hand, ba, m?.slash?.lift ?? 0);
      this.katana.drawBlade(ctx, b.base, b.tip, sheathed);
    }
    // muzzle flash
    if (p.muzzle > 0) {
      const k = p.muzzle / p.muzzleMax;
      const a = p.muzzleA;
      const mx = p.muzzleX + Math.cos(a) * 2, my = p.muzzleY + Math.sin(a) * 2;
      const big = p.weapon === 'pistol';
      ctx.globalAlpha = 0.16 * k;
      pcircle(ctx, p.x, p.y, big ? 26 : 18, '#ffd27f');
      ctx.globalAlpha = 0.8 * k;
      const len = (big ? 9 : 6) + rnd(0, 3);
      pline(ctx, mx, my, mx + Math.cos(a) * len, my + Math.sin(a) * len, '#ffc14d', 2);
      pline(ctx, mx, my, mx + Math.cos(a + 0.55) * len * 0.5, my + Math.sin(a + 0.55) * len * 0.5, '#ffc14d', 1);
      pline(ctx, mx, my, mx + Math.cos(a - 0.55) * len * 0.5, my + Math.sin(a - 0.55) * len * 0.5, '#ffc14d', 1);
      pline(ctx, mx, my, mx + Math.cos(a) * len * 0.6, my + Math.sin(a) * len * 0.6, '#ffffff', 1);
      pcircle(ctx, mx, my, big ? 2.5 : 1.5, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }

  drawEnemy(e: Enemy) {
    const ctx = this.wctx;
    const pal = this.pal;
    if (e.spawnT > 0) {
      const max = e.boss ? 1.2 : 0.7;
      const k = 1 - e.spawnT / max;
      pring(ctx, e.x, e.y - 6, (1 - k) * 16 + 3, pal.accent, 1);
      if (k > 0.35) drawStick(ctx, { x: e.x, y: e.y, c: pal.accent, c2: pal.accent, scale: e.scale, facing: e.facing, aim: e.aim, walk: 0, moving: false, pose: 'idle', t: 0, acc: 'none', weapon: 'none', flash: true, alpha: (k - 0.35) / 0.65, outline: null, eyes: '#000', time: this.time, lean: { x: 1, y: 0 } });
      if (e.boss && k > 0.5) pfontO(ctx, e.name, e.x, e.y - 30 * e.scale, '#ffffff', '#000', 1, 'center');
      return;
    }
    const flash = e.flash > 0;
    const outline = e.elite ? '#ffffff' : '#000000';
    const eyes = e.elite ? '#ff2a2a' : e.boss ? e.color2 : '#101010';
    const pose: Pose = e.flinch > 0 && e.pose === 'idle' && e.z <= 0 ? 'hurt' : e.pose;
    const moving = e.moving && (pose === 'idle' || pose === 'reload' || pose === 'charge');
    const eStrike = pose === 'punch' ? 'bhand' : pose === 'kick' ? 'ffoot' : pose === 'palm' ? 'both' : null;
    drawStick(ctx, { x: e.x, y: e.y, c: e.color, c2: e.color2, scale: e.scale, facing: e.facing, aim: moving && (pose === 'idle' || pose === 'reload') ? e.bodyAim : e.aim, look: e.aim, walk: e.walk, moving, pose, strike: eStrike, impact: eStrike && e.poseT >= 0.3 && e.poseT <= 0.7 ? 1 : 0, t: Math.min(1, e.poseT), acc: e.accessory, weapon: e.weapon, flash, alpha: 1, outline, eyes, time: this.time, lean: { x: Math.cos(e.aim), y: Math.sin(e.aim) }, z: e.z, rot: e.z > 0 ? e.rot : 0, vel: this.moveDirOf(e.vx + e.kx * 0.3, e.vy + e.ky * 0.3), stride: e.strideHalf, mood: e.stagger > 0 || e.down > 0 || e.flinch > 0 ? 'hurt' : e.state === 'windup' || e.state === 'attack' || e.state === 'charge' || e.state === 'lunge' ? 'angry' : 'normal' });
    const top = e.y - e.z - 15 * e.scale;
    if (e.stagger > 0) {
      for (let i = 0; i < 3; i++) { const a = this.time * 7 + (i * Math.PI * 2) / 3; px(ctx, e.x + Math.cos(a) * 6, top - 3 + Math.sin(a) * 2, '#ffd700'); }
      if (Math.floor(this.time * 6) % 2 === 0) pfontO(ctx, 'F', e.x, top - 12, '#ffd700', '#000', 1, 'center');
    } else if (e.id === this.fatTargetId) {
      // fatality available on this enemy right now
      const yy = top - 11 + Math.round(Math.sin(this.time * 7) * 1.5);
      prect(ctx, e.x - 3, yy - 1, 7, 7, '#000');
      prect(ctx, e.x - 2, yy, 5, 5, Math.floor(this.time * 8) % 2 ? '#ff1a1a' : '#b30000');
      pfont(ctx, 'F', e.x - 1, yy, '#ffffff', 1);
    }
    if (e.state === 'windup' && e.kind !== 'gunner' && e.kind !== 'rifleman' && e.kind !== 'sniper') {
      pfontO(ctx, '!', e.x, top - 8, Math.floor(this.time * 20) % 2 ? '#ff3b3b' : '#ffffff', '#000', 1, 'center');
    }
    if (!e.boss) {
      if (e.structure > 0 && e.stagger <= 0) {
        prect(ctx, e.x - 6, e.y + 3, 12, 1, '#1a1a1a');
        prect(ctx, e.x - 6, e.y + 3, Math.round(12 * clamp(e.structure / e.maxStructure, 0, 1)), 1, '#ffd700');
      }
      if (e.elite || e.hp < e.maxHp) {
        prect(ctx, e.x - 6, e.y + 5, 12, 1, '#1a1a1a');
        prect(ctx, e.x - 6, e.y + 5, Math.round(12 * clamp(e.hp / e.maxHp, 0, 1)), 1, e.elite ? '#ff2a2a' : '#ff6b6b');
      }
    }
  }
}

function pellipseShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r = 4) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(Math.round(x - r), Math.round(y), r * 2, 1);
  ctx.fillRect(Math.round(x - r + 1), Math.round(y - 1), r * 2 - 2, 1);
}

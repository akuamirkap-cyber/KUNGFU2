// ===== Core constants, types, biomes, enemy defs, upgrades =====
export const VW = 480;
export const VH = 270;
export const TILE = 16;
export const MAX_LEVEL = 200;

export type Vec = { x: number; y: number };

export interface Biome {
  name: string;
  bg: string;
  floor: string;
  floorDot: string;
  wall: string;
  wallTop: string;
  accent: string;
  enemy: string;
  enemy2: string;
}

// Downwell-like limited palettes, one per 20 levels
export const BIOMES: Biome[] = [
  { name: 'SLUM ROOFTOPS', bg: '#0b0b12', floor: '#15151f', floorDot: '#1d1d2a', wall: '#2a2a3d', wallTop: '#3b3b55', accent: '#ff3b3b', enemy: '#e8e8ff', enemy2: '#9a9ab8' },
  { name: 'NEON DISTRICT', bg: '#08060f', floor: '#120d20', floorDot: '#1a1330', wall: '#2b1b4d', wallTop: '#4b2d85', accent: '#ff2d95', enemy: '#f6e9ff', enemy2: '#b78fff' },
  { name: 'BAMBOO DOJO', bg: '#070d08', floor: '#0f1a10', floorDot: '#15241a', wall: '#1e3a22', wallTop: '#2f5a34', accent: '#ffcc33', enemy: '#f3ffe8', enemy2: '#9ccf7a' },
  { name: 'SCRAPYARD', bg: '#0e0a06', floor: '#1b1409', floorDot: '#241b0e', wall: '#3a2c14', wallTop: '#5a4520', accent: '#ff7a1a', enemy: '#fff0d8', enemy2: '#d6a86b' },
  { name: 'FROZEN PASS', bg: '#060a12', floor: '#0e1626', floorDot: '#152036', wall: '#223a5a', wallTop: '#3a5f8f', accent: '#5ff0ff', enemy: '#ffffff', enemy2: '#9fd4ff' },
  { name: 'CRIMSON TEMPLE', bg: '#120406', floor: '#1e080b', floorDot: '#2a0c10', wall: '#4a1218', wallTop: '#7a1c26', accent: '#ffd166', enemy: '#ffe6e6', enemy2: '#ff8a8a' },
  { name: 'UNDERWORLD', bg: '#050505', floor: '#0e0e0e', floorDot: '#161616', wall: '#262626', wallTop: '#3d3d3d', accent: '#a3ff3b', enemy: '#ffffff', enemy2: '#8d8d8d' },
  { name: 'SKY FORTRESS', bg: '#0a0e1c', floor: '#141a30', floorDot: '#1b2340', wall: '#2c3a66', wallTop: '#4a5f9c', accent: '#ffffff', enemy: '#ffe9a8', enemy2: '#c9b26b' },
  { name: 'VOID GARDEN', bg: '#07000f', floor: '#10021c', floorDot: '#170528', wall: '#2c0a4e', wallTop: '#4e1486', accent: '#3bffd8', enemy: '#f0e0ff', enemy2: '#a070e0' },
  { name: 'THE THRONE', bg: '#0c0a04', floor: '#17130a', floorDot: '#1f1a0e', wall: '#3d3214', wallTop: '#6b5a22', accent: '#ffe14d', enemy: '#ffffff', enemy2: '#ffd27a' },
];

export type EnemyKind = 'thug' | 'gunner' | 'brute' | 'dasher' | 'rifleman' | 'shield' | 'ninja' | 'bomber' | 'smg' | 'sniper' | 'samurai' | 'pipeswing' | 'cleaver' | 'boss';

export interface EnemyDef {
  kind: EnemyKind;
  hp: number;
  posture: number;
  speed: number;
  radius: number;
  dmg: number;
  range: number; // distance at which it attacks
  windup: number; // telegraph seconds
  cooldown: number;
  unlock: number; // level at which this enemy appears
  weight: number;
  score: number;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  thug: { kind: 'thug', hp: 30, posture: 30, speed: 42, radius: 5, dmg: 10, range: 18, windup: 0.45, cooldown: 0.9, unlock: 1, weight: 10, score: 10 },
  gunner: { kind: 'gunner', hp: 24, posture: 20, speed: 34, radius: 5, dmg: 8, range: 120, windup: 0.85, cooldown: 1.6, unlock: 3, weight: 6, score: 15 },
  dasher: { kind: 'dasher', hp: 22, posture: 22, speed: 60, radius: 4.5, dmg: 12, range: 70, windup: 0.5, cooldown: 1.4, unlock: 8, weight: 6, score: 20 },
  brute: { kind: 'brute', hp: 90, posture: 80, speed: 26, radius: 6.5, dmg: 22, range: 26, windup: 0.8, cooldown: 1.6, unlock: 14, weight: 4, score: 40 },
  shield: { kind: 'shield', hp: 55, posture: 60, speed: 32, radius: 5.5, dmg: 12, range: 20, windup: 0.5, cooldown: 1.1, unlock: 24, weight: 4, score: 35 },
  rifleman: { kind: 'rifleman', hp: 34, posture: 26, speed: 30, radius: 5, dmg: 6, range: 150, windup: 0.8, cooldown: 2.0, unlock: 32, weight: 5, score: 30 },
  ninja: { kind: 'ninja', hp: 40, posture: 35, speed: 70, radius: 4.5, dmg: 14, range: 24, windup: 0.32, cooldown: 1.2, unlock: 45, weight: 4, score: 45 },
  bomber: { kind: 'bomber', hp: 20, posture: 10, speed: 58, radius: 5, dmg: 30, range: 22, windup: 0.6, cooldown: 99, unlock: 60, weight: 3, score: 25 },
  samurai: { kind: 'samurai', hp: 55, posture: 42, speed: 56, radius: 5, dmg: 16, range: 23, windup: 0.38, cooldown: 1.25, unlock: 26, weight: 4, score: 50 },
  pipeswing: { kind: 'pipeswing', hp: 40, posture: 34, speed: 52, radius: 5, dmg: 12, range: 25, windup: 0.55, cooldown: 1.5, unlock: 16, weight: 5, score: 32 },
  cleaver: { kind: 'cleaver', hp: 34, posture: 28, speed: 62, radius: 5, dmg: 14, range: 22, windup: 0.45, cooldown: 1.3, unlock: 22, weight: 4, score: 38 },
  smg: { kind: 'smg', hp: 26, posture: 20, speed: 38, radius: 5, dmg: 5, range: 130, windup: 0.55, cooldown: 2.0, unlock: 20, weight: 4, score: 25 },
  sniper: { kind: 'sniper', hp: 30, posture: 24, speed: 30, radius: 5, dmg: 26, range: 260, windup: 1.5, cooldown: 3.4, unlock: 42, weight: 3, score: 45 },
  boss: { kind: 'boss', hp: 600, posture: 200, speed: 40, radius: 11, dmg: 18, range: 30, windup: 0.6, cooldown: 1.0, unlock: 10, weight: 0, score: 500 },
};

export interface BossDef { name: string; title: string; style: 'fists' | 'pistol' | 'katana' | 'machete' | 'staff' | 'spear' | 'axe' | 'dual' | 'nunchaku' | 'rifle'; color: string; band: string }
// 10 bosses, one per 5 floors: each is a master of a specific weapon
export const BOSSES: BossDef[] = [
  { name: 'IRON FIST GOREN', title: 'master of the bare fist', style: 'fists', color: '#d8a06a', band: '#8a3a2a' },
  { name: 'QUICKDRAW HOLLOWAY', title: 'six rounds, no misses', style: 'pistol', color: '#b8b0a0', band: '#3a4a5a' },
  { name: 'MASTER BAMBOO', title: 'the staff never stops', style: 'staff', color: '#9ab87a', band: '#4a5a2a' },
  { name: 'CAMP SLASHER KANE', title: 'machete in the dark', style: 'machete', color: '#c4b8a8', band: '#c02830' },
  { name: 'TWIN BLADE VIET', title: 'two edges, one motion', style: 'dual', color: '#a8a0c4', band: '#5a3a7a' },
  { name: 'YUKIMURA THE LAST', title: 'the spear that split a sky', style: 'spear', color: '#d0b4a8', band: '#7a1c26' },
  { name: 'SILENT RYUZO', title: 'one cut, one breath', style: 'katana', color: '#cfd8e4', band: '#1c2430' },
  { name: 'TREESTUMPER MOSS', title: 'the axe falls like weather', style: 'axe', color: '#b09a7a', band: '#3a5a3a' },
  { name: 'WHIRLWIND DAE-SUN', title: 'chains that sing', style: 'nunchaku', color: '#c8b898', band: '#6a4a2a' },
  { name: 'WARDEN CROSS', title: 'full-auto judgement', style: 'rifle', color: '#a0a8b4', band: '#2a3038' },
];
export const BOSS_NAMES = [
  'IRON FIST GOREN', 'QUICKDRAW HOLLOWAY', 'MASTER BAMBOO', 'CAMP SLASHER KANE', 'TWIN BLADE VIET',
  'YUKIMURA THE LAST', 'SILENT RYUZO', 'TREESTUMPER MOSS', 'WHIRLWIND DAE-SUN', 'WARDEN CROSS',
  'GOREN REBORN', 'HOLLOWAY PRIME', 'BAMBOO GHOST', 'KANE ETERNAL', 'VIET PRIME',
  'YUKIMURA REBORN', 'RYUZO PRIME', 'MOSS TITAN', 'DAE-SUN PRIME', 'CROSS OMEGA',
];

export interface Mods {
  maxHp: number;
  atkSpeed: number;
  dmg: number;
  parryWindow: number;
  focusGain: number;
  dashCd: number;
  ammoMult: number;
  lifesteal: number;
  gunDmg: number;
  moveSpeed: number;
  deflectDmg: number;
  takedownHeal: number;
  comboLen: number;
  critChance: number;
  thorns: number;
  pickupRange: number;
  regen: number;
}

export const DEFAULT_MODS: Mods = {
  maxHp: 100, atkSpeed: 1, dmg: 1, parryWindow: 1, focusGain: 1, dashCd: 1, ammoMult: 1,
  lifesteal: 0, gunDmg: 1, moveSpeed: 1, deflectDmg: 1, takedownHeal: 8, comboLen: 5, critChance: 0.05, thorns: 0, pickupRange: 1, regen: 0,
};

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  icon: string;
  apply: (m: Mods) => void;
}

export const UPGRADES: Upgrade[] = [
  { id: 'hp', name: 'IRON BODY', desc: '+25 max HP', icon: '♥', apply: (m) => { m.maxHp += 25; } },
  { id: 'spd', name: 'QUICK HANDS', desc: '+15% attack speed', icon: '»', apply: (m) => { m.atkSpeed *= 1.15; } },
  { id: 'dmg', name: 'TIGER PALM', desc: '+20% melee damage', icon: '✊', apply: (m) => { m.dmg *= 1.2; } },
  { id: 'parry', name: 'STILL WATER', desc: '+40% parry window', icon: '◐', apply: (m) => { m.parryWindow *= 1.4; } },
  { id: 'focus', name: 'INNER CHI', desc: '+35% focus gain', icon: '✺', apply: (m) => { m.focusGain *= 1.35; } },
  { id: 'dash', name: 'WIND STEP', desc: '-25% dash cooldown', icon: '⇢', apply: (m) => { m.dashCd *= 0.75; } },
  { id: 'ammo', name: 'DEEP POCKETS', desc: '+50% ammo drops', icon: '▪', apply: (m) => { m.ammoMult *= 1.5; } },
  { id: 'life', name: 'VAMPIRE STYLE', desc: 'Melee hits heal 1 HP', icon: '✚', apply: (m) => { m.lifesteal += 1; } },
  { id: 'gun', name: 'GUN KATA', desc: '+30% gun damage', icon: '▸', apply: (m) => { m.gunDmg *= 1.3; } },
  { id: 'move', name: 'LIGHT FEET', desc: '+12% move speed', icon: '⤳', apply: (m) => { m.moveSpeed *= 1.12; } },
  { id: 'deflect', name: 'MIRROR GUARD', desc: 'Deflected bullets +100% dmg', icon: '◇', apply: (m) => { m.deflectDmg *= 2; } },
  { id: 'take', name: 'SOUL HARVEST', desc: 'Takedowns heal +10 HP', icon: '☯', apply: (m) => { m.takedownHeal += 10; } },
  { id: 'combo', name: 'DRAGON CHAIN', desc: '+1 hit in combo string', icon: '∞', apply: (m) => { m.comboLen = Math.min(7, m.comboLen + 1); } },
  { id: 'crit', name: 'PRESSURE POINT', desc: '+15% crit chance', icon: '✦', apply: (m) => { m.critChance += 0.15; } },
  { id: 'thorns', name: 'THORN STANCE', desc: 'Blocked hits deal 10 dmg back', icon: '✶', apply: (m) => { m.thorns += 10; } },
  { id: 'magnet', name: 'CHI MAGNET', desc: '+60% pickup range', icon: '◎', apply: (m) => { m.pickupRange *= 1.6; } },
  { id: 'regen', name: 'MEDITATION', desc: 'Regenerate 1 HP / sec', icon: '☸', apply: (m) => { m.regen += 1; } },
];

export const AI_TIERS = [
  { name: 'MINDLESS', desc: 'Enemies charge straight at you.' },
  { name: 'FLANKING', desc: 'Melee enemies spread out and surround you.' },
  { name: 'LEADING SHOTS', desc: 'Gunners aim where you WILL be.' },
  { name: 'PARRY BAIT', desc: 'Enemies delay strikes while you parry.' },
  { name: 'EVASIVE', desc: 'Enemies sidestep your bullets.' },
  { name: 'VOLLEY FIRE', desc: 'Ranged enemies fire in sync.' },
  { name: 'PUNISHER', desc: 'Whiffed attacks get punished instantly.' },
  { name: 'TACTICAL RETREAT', desc: 'Weak-posture enemies back off to recover.' },
  { name: 'BLOODLUST', desc: 'Allies enrage when one of them dies.' },
];

export const TECHNIQUES = [
  { key: 'HOLD WASD', name: 'Sprint', desc: 'Keep moving to build up to 3x speed until you release the keys.' },
  { key: 'LMB / J', name: 'Combo Strike', desc: 'Jab → Cross → Hook → Elbow → Roundhouse. 5-hit combo; light hits keep enemies close instead of launching them. Press during a dash for a DASH STRIKE.' },
  { key: 'LMB SPAM', name: 'Wing Chun Chain', desc: 'Fists only: spam LMB fast and you enter a Wing Chun chain — blinding alternating centreline punches that glue the enemy in place. Land 6+ chain hits, keep spamming, then pause to unleash the FINAL HIT finisher.' },
  { key: 'SPRINT+LMB', name: 'Weapon Rush', desc: 'While sprinting, click LMB: FISTS fly kick · NUNCHAKU cyclone · KATANA iai dash · AXE rush · DUAL blade rush.' },
  { key: 'SPRINT+LMB', name: 'Nunchaku Cyclone', desc: 'NUNCHAKU ONLY: while sprinting, click LMB (or Q) for a spinning chain cyclone. Fatalities become chain finishers.' },
  { key: 'RMB / K', name: 'Parry / Guard', desc: 'Hold RMB to guard. A strike landing in the first moment = PERFECT PARRY (stuns them + riposte). Held longer = block. Also deflects bullets.' },
  { key: 'SPACE', name: 'Jump', desc: 'Leap over bullets and melee swings. Time it well.' },
  { key: 'SHIFT', name: 'Shadow Step', desc: 'Fast dash with i-frames. Perfect dodge = slow-mo.' },
  { key: 'Q', name: 'Flying Kick', desc: 'MK-style airborne kick that pierces through multiple enemies and slams them into walls. (1 focus)' },
  { key: 'E', name: 'Leg Sweep', desc: 'Spin kick breaking posture around you. (1 focus)' },
  { key: 'F', name: 'FATALITY', desc: 'Finish a posture-broken enemy: 8 random finishers (Uppercut, Rush Punch, Axe Kick, Palm Blast...). Heals you.' },
  { key: 'LMB AIR', name: 'Air Kick', desc: 'Jump, then LMB: diving kick. Bounce off enemies and juggle the launched ones.' },
  { key: 'HOLD J / LMB', name: 'Charge Palm', desc: 'Keep LMB held, release for a blasting palm.' },
  { key: 'PARRY→LMB', name: 'Riposte', desc: 'Strike right after a perfect parry: devastating counter.' },
  { key: '5', name: 'Katana', desc: 'Variable iai chains: sometimes 1 cut + SHEATHE FLASH, sometimes 2 cuts + IAI DASH through them, sometimes 3 cuts + THRUST. Dash, then LMB: dash-slash IAI DASH. Hold LMB then release: IAI DASH. Slashes bleed. Beware: SAMURAI enemies can parry you!' },
  { key: '6', name: 'Axe', desc: 'Baseball-bat swings: slow, huge arcs, monstrous knockback. HOME RUN launches victims.' },
  { key: '7', name: 'Dual Blades', desc: 'Twin daggers: fastest string in the game, every cut bleeds.' },
  { key: '8', name: 'Bo Staff', desc: 'Spinning staff: huge arcs, big posture. Sprint/Q: POLE VAULT slam.' },
  { key: '9', name: 'Sanada Spear', desc: 'Yukimura cross spear: longest reach thrusts. Sprint/Q: LANCE RUSH through the line.' },
  { key: '0', name: 'Machete', desc: 'Jason-style bolo blade. 3rd combo hit = SPLIT CLEAVE, bisecting enemies. Sprint/Q: SLASHER DASH.' },
  { key: 'HOLD L', name: 'Fast Level', desc: 'Hold L to grind levels fast — campaign floors skip quickly, endless showers XP.' },
  { key: 'B', name: 'Blood FX', desc: 'Cycle blood: NORMAL / PARTICLE / COMBINED (particles + permanent floor stains).' },
  { key: 'SPAM LMB', name: 'Wing Chun Chain', desc: 'FISTS only: click LMB every 0.1-0.4s to chain-punch at blinding speed. Nearly-dead targets eat a CHAIN FINISHER.' },
  { key: 'R + LMB', name: 'RAGE', desc: 'Earn rage by taking hits & perfect parries. At 60+, press R: every LMB blur-dashes you to the nearest enemy for a slow-mo EXECUTION (1.7x damage, heavy knockback).' },
  { key: 'C', name: 'Focus Strike', desc: 'Spend 100 FOCUS: time slows, you blur-dash to the nearest enemy, they stagger, and you land the heavy finisher of whatever is in your hands (FISTS = DRAGON PALM). Focus builds from landed hits (+7), kills (+20, boss +60), perfect parries (+60), perfect dodges (+30), deflects (+25) and posture breaks (+15). Max 300.' },
  { key: 'X', name: 'ONE FOR ALL', desc: 'At 25+ charge: ~12s of slow-mo where YOU move at 4x speed and AUTO-LOCK the nearest enemy — kill it and the lock jumps to the next. Spam everything.' },
  { key: '1-9', name: 'Weapons', desc: 'Fists / Pistol / Rifle / Nunchaku / Katana / Axe / Dual / Staff / Sanada Spear. Scroll swaps.' },
];


export interface Skin { name: string; body: string; band: string; hat?: string; note: string }
export const SKINS: Skin[] = [
  { name: 'CLASSIC DRIFTER', body: '#ffffff', band: '#ff3b3b', note: 'The original wanderer.' },
  { name: 'NEON RONIN', body: '#e6fbff', band: '#ff2d95', note: 'Straight out of the neon district.' },
  { name: 'GOLDEN MONK', body: '#ffe9a8', band: '#b8860b', hat: 'tophat', note: 'Top hat, endless manners.' },
  { name: 'SHADOW', body: '#aab4c4', band: '#14141c', note: 'You never saw him coming.' },
  { name: 'JADE SERPENT', body: '#d8ffe8', band: '#22c55e', hat: 'oni', note: 'Oni mask, bamboo speed.' },
  { name: 'VOID WALKER', body: '#e9d5ff', band: '#7c3aed', note: 'Touched by the void garden.' },
  { name: 'CAMP SLASHER', body: '#dfe4ea', band: '#c02830', hat: 'hockey', note: 'Jason Vorhees hockey mask. Machete not included.' },
  { name: 'GENTLEMAN REAPER', body: '#f2f2f2', band: '#111118', hat: 'tophat', note: 'Dressed for your funeral.' },
];

export interface RankDef { name: string; min: number }
export const RANKS: RankDef[] = [
  { name: 'FIST NOVICE', min: 0 },
  { name: 'STREET BRAWLER', min: 5000 },
  { name: 'DOJO FIGHTER', min: 15000 },
  { name: 'KUNG FU MASTER', min: 35000 },
  { name: 'GRANDMASTER', min: 75000 },
  { name: 'LIVING WEAPON', min: 150000 },
  { name: 'THRONE LEGEND', min: 300000 },
];
export function rankFor(score: number): { cur: RankDef; next: RankDef | null; idx: number; progress: number } {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i].min) idx = i;
  const cur = RANKS[idx], next = RANKS[idx + 1] ?? null;
  const progress = next ? Math.min(1, (score - cur.min) / (next.min - cur.min)) : 1;
  return { cur, next, idx, progress };
}

import type { Pose } from './types';

export type Limb = 'fhand' | 'bhand' | 'ffoot' | 'bfoot' | 'both' | 'body' | 'nunchaku' | 'sweep' | 'blade' | 'blade2';

export interface Move {
  id: string;
  name: string;
  pose: Pose;
  dmg: number;
  structure: number;
  range: number;
  arc: number;
  windup: number;
  active: number;
  recover: number;
  kb: number;
  knockdown: boolean;
  lunge: number;
  hitstop: number;
  shake: number;
  sfx: 'punch' | 'kick' | 'heavy' | 'nunchaku' | 'slash' | 'axe' | 'dual';
  /** which skeleton joint carries the hitbox (hit tests use the real animated joint position) */
  limb: Limb;
  /** hitbox radius around the striking joint, px */
  hitR: number;
  launch?: number;
  finisher?: boolean;
  showName?: boolean;
  travel?: number;
  jump?: number;
  trail?: boolean;
  air?: boolean;
  /** multi-hit: minimum seconds between hits on the same target */
  rehit?: number;
  nunchaku?: boolean;
  katana?: boolean;
  axe?: boolean;
  dual?: boolean;
  /** blade arc (radians) swept during the active frames: from -> to relative to aim, times facing */
  slash?: { from: number; to: number; r: number; lift?: number };
  bleed?: boolean;
}

// ============================== KUNG FU (fists) ==============================
// Sifu-style tree. Keys are input sequences: L = light (LMB), H = heavy (RMB).
export const MOVES: Record<string, Move> = {
  L: { id: 'jab', name: 'JAB', pose: 'jab', dmg: 2, structure: 8, range: 17, arc: 1.1, windup: 0.05, active: 0.09, recover: 0.1, kb: 70, knockdown: false, lunge: 60, hitstop: 0.035, shake: 0.18, sfx: 'punch', limb: 'fhand', hitR: 3.8 },
  LL: { id: 'cross', name: 'CROSS', pose: 'cross', dmg: 2, structure: 10, range: 18, arc: 1.1, windup: 0.06, active: 0.09, recover: 0.12, kb: 100, knockdown: false, lunge: 80, hitstop: 0.04, shake: 0.2, sfx: 'punch', limb: 'bhand', hitR: 3.8 },
  LLL: { id: 'hook', name: 'HOOK', pose: 'hook', dmg: 3, structure: 14, range: 17, arc: 1.4, windup: 0.08, active: 0.1, recover: 0.14, kb: 130, knockdown: false, lunge: 70, hitstop: 0.05, shake: 0.28, sfx: 'kick', limb: 'bhand', hitR: 5, trail: true },
  LLLL: { id: 'roundhouse', name: 'ROUNDHOUSE', pose: 'roundhouse', dmg: 5, structure: 22, range: 23, arc: 1.7, windup: 0.11, active: 0.13, recover: 0.26, kb: 300, knockdown: true, lunge: 50, hitstop: 0.08, shake: 0.5, sfx: 'heavy', limb: 'ffoot', hitR: 6, launch: 50, trail: true, finisher: true, showName: true },
  LLLLL: { id: 'dragontail', name: 'DRAGON TAIL', pose: 'dragontail', dmg: 7, structure: 40, range: 26, arc: Math.PI, windup: 0.1, active: 0.2, recover: 0.3, kb: 420, knockdown: true, lunge: 30, hitstop: 0.1, shake: 0.8, sfx: 'heavy', limb: 'bfoot', hitR: 6.5, launch: 90, trail: true, finisher: true, showName: true },
  H: { id: 'palm', name: 'PALM STRIKE', pose: 'palm', dmg: 3, structure: 28, range: 19, arc: 1.0, windup: 0.13, active: 0.11, recover: 0.28, kb: 420, knockdown: false, lunge: 110, hitstop: 0.07, shake: 0.45, sfx: 'heavy', limb: 'both', hitR: 5.5, showName: true },
  LH: { id: 'elbow', name: 'ELBOW SMASH', pose: 'elbow', dmg: 4, structure: 32, range: 17, arc: 1.2, windup: 0.08, active: 0.1, recover: 0.2, kb: 100, knockdown: false, lunge: 150, hitstop: 0.06, shake: 0.35, sfx: 'kick', limb: 'bhand', hitR: 5, trail: true, showName: true },
  LLH: { id: 'sweep', name: 'SWEEP KICK', pose: 'sweep', dmg: 3, structure: 20, range: 26, arc: Math.PI, windup: 0.11, active: 0.18, recover: 0.3, kb: 140, knockdown: true, lunge: 0, hitstop: 0.06, shake: 0.4, sfx: 'heavy', limb: 'sweep', hitR: 6, trail: true, showName: true },
  LLLH: { id: 'dragon', name: 'DRAGON UPPERCUT', pose: 'uppercut', dmg: 8, structure: 45, range: 19, arc: 1.0, windup: 0.13, active: 0.11, recover: 0.38, kb: 120, knockdown: true, lunge: 70, hitstop: 0.1, shake: 0.7, sfx: 'heavy', limb: 'bhand', hitR: 6, launch: 200, finisher: true, showName: true },
  HL: { id: 'knee', name: 'KNEE STRIKE', pose: 'knee', dmg: 4, structure: 30, range: 16, arc: 1.0, windup: 0.07, active: 0.11, recover: 0.18, kb: 160, knockdown: false, lunge: 170, hitstop: 0.06, shake: 0.35, sfx: 'kick', limb: 'ffoot', hitR: 5.5, launch: 40, showName: true },
  HLL: { id: 'axekick', name: 'AXE KICK', pose: 'axekick', dmg: 7, structure: 50, range: 20, arc: 0.9, windup: 0.16, active: 0.1, recover: 0.34, kb: 90, knockdown: true, lunge: 60, hitstop: 0.11, shake: 0.8, sfx: 'heavy', limb: 'ffoot', hitR: 6.5, trail: true, finisher: true, showName: true },
  HLH: { id: 'monkeyflip', name: 'MONKEY FLIP KICK', pose: 'monkeyflip', dmg: 8, structure: 44, range: 22, arc: 1.1, windup: 0.12, active: 0.18, recover: 0.36, kb: 260, knockdown: true, lunge: 40, hitstop: 0.11, shake: 0.8, sfx: 'heavy', limb: 'ffoot', hitR: 6.5, launch: 240, jump: 14, trail: true, finisher: true, showName: true },
  HH: { id: 'spinback', name: 'SPINNING BACKFIST', pose: 'spinback', dmg: 6, structure: 36, range: 22, arc: Math.PI, windup: 0.12, active: 0.26, recover: 0.26, kb: 340, knockdown: true, lunge: 40, hitstop: 0.09, shake: 0.6, sfx: 'heavy', limb: 'bhand', hitR: 7, trail: true, finisher: true, showName: true },
  HHL: { id: 'cranekick', name: 'CRANE KICK', pose: 'cranekick', dmg: 9, structure: 55, range: 24, arc: 0.9, windup: 0.22, active: 0.1, recover: 0.4, kb: 520, knockdown: true, lunge: 120, hitstop: 0.13, shake: 0.9, sfx: 'heavy', limb: 'ffoot', hitR: 7, launch: 120, finisher: true, showName: true },
  LHL: { id: 'doublepalm', name: 'TWIN PALM', pose: 'palm', dmg: 5, structure: 40, range: 19, arc: 1.0, windup: 0.1, active: 0.1, recover: 0.26, kb: 520, knockdown: true, lunge: 140, hitstop: 0.09, shake: 0.6, sfx: 'heavy', limb: 'both', hitR: 6, finisher: true, showName: true },
  LHH: { id: 'tigerclaw', name: 'TIGER CLAW', pose: 'tigerclaw', dmg: 6, structure: 34, range: 18, arc: 1.1, windup: 0.09, active: 0.14, recover: 0.26, kb: 180, knockdown: false, lunge: 110, hitstop: 0.08, shake: 0.5, sfx: 'kick', limb: 'both', hitR: 6, rehit: 0.07, bleed: true, finisher: true, showName: true },
  LLLLH: { id: 'mantis', name: 'MANTIS STRIKE', pose: 'mantis', dmg: 10, structure: 80, range: 20, arc: 0.9, windup: 0.18, active: 0.1, recover: 0.42, kb: 80, knockdown: false, lunge: 100, hitstop: 0.14, shake: 0.9, sfx: 'heavy', limb: 'fhand', hitR: 5, finisher: true, showName: true },
  DASH: { id: 'flying', name: 'FLYING KICK', pose: 'flying', dmg: 6, structure: 30, range: 20, arc: 1.0, windup: 0.05, active: 0.3, recover: 0.22, kb: 400, knockdown: true, lunge: 0, hitstop: 0.08, shake: 0.55, sfx: 'heavy', limb: 'ffoot', hitR: 6, launch: 70, travel: 330, jump: 10, finisher: true, showName: true },
  RUNPUNCH: { id: 'runpunch', name: 'RUNNING STRAIGHT', pose: 'runpunch', dmg: 6, structure: 30, range: 20, arc: 1.0, windup: 0.06, active: 0.22, recover: 0.26, kb: 440, knockdown: true, lunge: 0, hitstop: 0.08, shake: 0.5, sfx: 'heavy', limb: 'bhand', hitR: 6, travel: 300, finisher: true, showName: true },
  TKD: { id: 'tkd', name: 'TAEKWONDO SIDE KICK', pose: 'sidekick', dmg: 8, structure: 40, range: 24, arc: 1.0, windup: 0.08, active: 0.34, recover: 0.3, kb: 560, knockdown: true, lunge: 0, hitstop: 0.11, shake: 0.7, sfx: 'heavy', limb: 'ffoot', hitR: 6.5, launch: 90, travel: 360, jump: 16, finisher: true, showName: true },
  AIR: { id: 'divekick', name: 'DIVE KICK', pose: 'flying', dmg: 5, structure: 26, range: 22, arc: 1.2, windup: 0.03, active: 0.26, recover: 0.2, kb: 260, knockdown: true, lunge: 0, hitstop: 0.07, shake: 0.5, sfx: 'heavy', limb: 'ffoot', hitR: 7, launch: 40, travel: 340, finisher: true, showName: true, air: true },
  // ---- BLACK LEG (Sanji): a rolling kick flow built by MEDIUM rhythm (0.3-0.6s between clicks). Each click = next kick.
  S1: { id: 's_collier', name: 'COLLIER', pose: 's_collier', dmg: 4, structure: 18, range: 24, arc: 1.2, windup: 0.06, active: 0.1, recover: 0.12, kb: 160, knockdown: false, lunge: 90, hitstop: 0.05, shake: 0.3, sfx: 'kick', limb: 'ffoot', hitR: 5.5, trail: true },
  S2: { id: 's_epaule', name: 'EPAULE', pose: 's_epaule', dmg: 4, structure: 20, range: 24, arc: 1.2, windup: 0.06, active: 0.1, recover: 0.12, kb: 180, knockdown: false, lunge: 80, hitstop: 0.05, shake: 0.3, sfx: 'kick', limb: 'ffoot', hitR: 5.5, trail: true },
  S3: { id: 's_cotelette', name: 'COTELETTE', pose: 's_cotelette', dmg: 4, structure: 20, range: 22, arc: 1.3, windup: 0.06, active: 0.1, recover: 0.12, kb: 190, knockdown: false, lunge: 80, hitstop: 0.05, shake: 0.32, sfx: 'kick', limb: 'bfoot', hitR: 5.5, trail: true },
  S4: { id: 's_antimanner', name: 'ANTI-MANNER KICK COURSE', pose: 's_antimanner', dmg: 6, structure: 32, range: 25, arc: 1.3, windup: 0.08, active: 0.12, recover: 0.16, kb: 260, knockdown: false, lunge: 110, hitstop: 0.07, shake: 0.45, sfx: 'heavy', limb: 'ffoot', hitR: 6, trail: true, showName: true },
  S5: { id: 's_mouton', name: 'MOUTON SHOT', pose: 's_mouton', dmg: 9, structure: 50, range: 26, arc: 1.2, windup: 0.1, active: 0.12, recover: 0.3, kb: 620, knockdown: true, lunge: 140, hitstop: 0.12, shake: 0.9, sfx: 'heavy', limb: 'ffoot', hitR: 6.5, launch: 60, trail: true, finisher: true, showName: true },
  S6: { id: 's_concasse', name: 'CONCASSE', pose: 's_concasse', dmg: 10, structure: 70, range: 24, arc: 1.0, windup: 0.14, active: 0.1, recover: 0.34, kb: 160, knockdown: true, lunge: 60, hitstop: 0.13, shake: 1.0, sfx: 'heavy', limb: 'ffoot', hitR: 6.5, jump: 12, trail: true, finisher: true, showName: true },
  S7: { id: 's_partytable', name: 'PARTY TABLE KICK COURSE', pose: 's_partyTable', dmg: 5, structure: 24, range: 30, arc: Math.PI, windup: 0.1, active: 0.5, recover: 0.3, kb: 300, knockdown: true, lunge: 0, hitstop: 0.05, shake: 0.5, sfx: 'kick', limb: 'ffoot', hitR: 6, trail: true, rehit: 0.14, finisher: true, showName: true },
  S8: { id: 's_diable', name: 'DIABLE JAMBE', pose: 's_diable', dmg: 16, structure: 120, range: 28, arc: 1.1, windup: 0.16, active: 0.14, recover: 0.4, kb: 760, knockdown: true, lunge: 180, hitstop: 0.16, shake: 1.2, sfx: 'heavy', limb: 'ffoot', hitR: 7.5, launch: 140, trail: true, finisher: true, showName: true },
  // ---- KUNG FU heavy flow (SLOW rhythm 0.6-1.0s): iron palm / hammer fist additions
  KF1: { id: 'k_ironpalm', name: 'IRON PALM', pose: 'k_ironpalm', dmg: 8, structure: 55, range: 20, arc: 1.0, windup: 0.16, active: 0.1, recover: 0.3, kb: 520, knockdown: true, lunge: 120, hitstop: 0.12, shake: 0.8, sfx: 'heavy', limb: 'fhand', hitR: 6, showName: true },
  KF2: { id: 'k_hammerfist', name: 'HAMMER FIST', pose: 'k_hammerfist', dmg: 9, structure: 70, range: 18, arc: 1.0, windup: 0.18, active: 0.1, recover: 0.34, kb: 140, knockdown: true, lunge: 100, hitstop: 0.13, shake: 0.9, sfx: 'heavy', limb: 'bhand', hitR: 6, showName: true },
  // ---- WING CHUN chain punch: rapid alternating vertical fists; spamming LMB in rhythm (0.1-0.4s) keeps the chain unbroken
  CHAIN: { id: 'chain', name: 'CHAIN PUNCH', pose: 'chainpunch', dmg: 1.4, structure: 7, range: 17, arc: 1.0, windup: 0.02, active: 0.06, recover: 0.05, kb: 25, knockdown: false, lunge: 50, hitstop: 0.018, shake: 0.1, sfx: 'punch', limb: 'fhand', hitR: 4.5 },
  // the chain's finishing blow: fires automatically when the target is almost dead (or on a long chain)
  CHAINEND: { id: 'chainend', name: 'WING CHUN FINISH', pose: 'chainfinish', dmg: 9, structure: 60, range: 20, arc: 1.0, windup: 0.08, active: 0.1, recover: 0.3, kb: 560, knockdown: true, lunge: 120, hitstop: 0.12, shake: 0.9, sfx: 'heavy', limb: 'both', hitR: 6, launch: 60, finisher: true, showName: true },
  // RAGE execution strike (after the rage dash): instant, lethal to normal enemies
  RAGEKILL: { id: 'ragekill', name: 'RAGE', pose: 'ragekill', dmg: 30, structure: 999, range: 22, arc: 1.4, windup: 0.03, active: 0.08, recover: 0.12, kb: 520, knockdown: true, lunge: 0, hitstop: 0.06, shake: 0.6, sfx: 'heavy', limb: 'bhand', hitR: 7, finisher: true },
  FOCUS: { id: 'focus', name: 'DRAGON PALM', pose: 'palm', dmg: 14, structure: 999, range: 24, arc: 1.4, windup: 0.06, active: 0.12, recover: 0.3, kb: 460, knockdown: true, lunge: 0, hitstop: 0.14, shake: 0.9, sfx: 'heavy', limb: 'both', hitR: 9, launch: 120, finisher: true, showName: true },

  // ============================== NUNCHAKU ==============================
  // The striking end of the chain IS the hitbox (physics-driven), so these moves hit exactly where the weapon is.
  // ---- Bruce Lee TRIANGLE COMBO: from the underarm tuck -> diagonal down-left strike -> bounce up to the left shoulder
  //      -> horizontal chest sweep back right -> catch & lock under the right armpit (an imaginary triangle in front of the body)
  NL: { id: 'n_tri1', name: 'TRIANGLE: DIAGONAL', pose: 'n_tri1', dmg: 4, structure: 18, range: 24, arc: 1.4, windup: 0.06, active: 0.12, recover: 0.1, kb: 110, knockdown: false, lunge: 70, hitstop: 0.045, shake: 0.25, sfx: 'nunchaku', limb: 'nunchaku', hitR: 4.5, nunchaku: true },
  NLL: { id: 'n_tri2', name: 'TRIANGLE: SHOULDER BOUNCE', pose: 'n_tri2', dmg: 3, structure: 16, range: 24, arc: 1.4, windup: 0.05, active: 0.14, recover: 0.1, kb: 100, knockdown: false, lunge: 80, hitstop: 0.04, shake: 0.22, sfx: 'nunchaku', limb: 'nunchaku', hitR: 4.5, nunchaku: true },
  NLLL: { id: 'n_tri3', name: 'TRIANGLE: CHEST SWEEP', pose: 'n_tri3', dmg: 5, structure: 26, range: 26, arc: 1.6, windup: 0.05, active: 0.14, recover: 0.1, kb: 180, knockdown: false, lunge: 60, hitstop: 0.06, shake: 0.35, sfx: 'nunchaku', limb: 'nunchaku', hitR: 5, nunchaku: true, showName: true },
  NLLLL: { id: 'n_tri4', name: 'TRIANGLE: CATCH & LOCK', pose: 'n_tri4', dmg: 7, structure: 45, range: 22, arc: 1.2, windup: 0.08, active: 0.12, recover: 0.26, kb: 260, knockdown: true, lunge: 50, hitstop: 0.1, shake: 0.7, sfx: 'nunchaku', limb: 'nunchaku', hitR: 5.5, nunchaku: true, finisher: true, showName: true },
  NLLLLL: { id: 'n_overhead', name: 'SKULL CRACKER', pose: 'n_overhead', dmg: 9, structure: 55, range: 26, arc: 1.0, windup: 0.14, active: 0.1, recover: 0.3, kb: 220, knockdown: true, lunge: 80, hitstop: 0.11, shake: 0.8, sfx: 'nunchaku', limb: 'nunchaku', hitR: 6, nunchaku: true, finisher: true, showName: true },
  NH: { id: 'n_helicopter', name: 'HELICOPTER', pose: 'n_helicopter', dmg: 2, structure: 12, range: 28, arc: Math.PI, windup: 0.08, active: 0.55, recover: 0.2, kb: 150, knockdown: false, lunge: 0, hitstop: 0.03, shake: 0.2, sfx: 'nunchaku', limb: 'nunchaku', hitR: 5, nunchaku: true, rehit: 0.14, showName: true },
  NLH: { id: 'n_whipcrack', name: 'WHIP CRACK', pose: 'n_whipcrack', dmg: 6, structure: 40, range: 32, arc: 0.9, windup: 0.12, active: 0.1, recover: 0.26, kb: 360, knockdown: true, lunge: 40, hitstop: 0.09, shake: 0.6, sfx: 'nunchaku', limb: 'nunchaku', hitR: 5.5, nunchaku: true, finisher: true, showName: true },
  NLLH: { id: 'n_choke', name: 'CHAIN CHOKE SLAM', pose: 'n_choke', dmg: 9, structure: 70, range: 20, arc: 0.9, windup: 0.14, active: 0.14, recover: 0.36, kb: 500, knockdown: true, lunge: 90, hitstop: 0.12, shake: 0.9, sfx: 'nunchaku', limb: 'nunchaku', hitR: 6, nunchaku: true, launch: 60, finisher: true, showName: true },
  NHL: { id: 'n_lowsweep', name: 'ANKLE BREAKER', pose: 'n_lowsweep', dmg: 4, structure: 30, range: 26, arc: Math.PI, windup: 0.1, active: 0.2, recover: 0.26, kb: 160, knockdown: true, lunge: 0, hitstop: 0.06, shake: 0.4, sfx: 'nunchaku', limb: 'nunchaku', hitR: 5.5, nunchaku: true, rehit: 0.2, showName: true },
  NHH: { id: 'n_tornado', name: 'TORNADO', pose: 'n_tornado', dmg: 3, structure: 18, range: 30, arc: Math.PI, windup: 0.1, active: 0.7, recover: 0.3, kb: 220, knockdown: true, lunge: 0, hitstop: 0.04, shake: 0.3, sfx: 'nunchaku', limb: 'nunchaku', hitR: 5.5, nunchaku: true, rehit: 0.12, launch: 50, finisher: true, showName: true },
  // RUN + LMB with the nunchaku: the lethal charging strike (replaces the taekwondo kick while the nunchaku is out)
  NRUN: { id: 'n_dragonlash', name: 'DRAGON LASH', pose: 'n_dragonlash', dmg: 12, structure: 90, range: 30, arc: 1.0, windup: 0.08, active: 0.34, recover: 0.3, kb: 620, knockdown: true, lunge: 0, hitstop: 0.13, shake: 0.9, sfx: 'nunchaku', limb: 'nunchaku', hitR: 7, nunchaku: true, launch: 140, travel: 360, jump: 8, rehit: 0.18, finisher: true, showName: true },
  NDASH: { id: 'n_flyspin', name: 'FLYING HELICOPTER', pose: 'n_helicopter', dmg: 3, structure: 16, range: 28, arc: Math.PI, windup: 0.05, active: 0.36, recover: 0.22, kb: 300, knockdown: true, lunge: 0, hitstop: 0.05, shake: 0.4, sfx: 'nunchaku', limb: 'nunchaku', hitR: 5.5, nunchaku: true, rehit: 0.12, travel: 300, jump: 10, finisher: true, showName: true },

  // ============================== KATANA ==============================
  // The blade sweeps an arc during the active frames; the hitbox is the swept blade segment (base->tip).
  KL: { id: 'k_draw', name: 'IAI DRAW', pose: 'k_draw', dmg: 6, structure: 20, range: 30, arc: 1.3, windup: 0.08, active: 0.08, recover: 0.16, kb: 160, knockdown: false, lunge: 150, hitstop: 0.07, shake: 0.35, sfx: 'slash', limb: 'blade', hitR: 3.5, katana: true, bleed: true, slash: { from: -1.4, to: 0.9, r: 18 } },
  KLL: { id: 'k_return', name: 'RETURN CUT', pose: 'k_return', dmg: 6, structure: 22, range: 30, arc: 1.3, windup: 0.07, active: 0.08, recover: 0.16, kb: 170, knockdown: false, lunge: 120, hitstop: 0.07, shake: 0.35, sfx: 'slash', limb: 'blade', hitR: 3.5, katana: true, bleed: true, slash: { from: 1.2, to: -1.0, r: 18 } },
  KLLL: { id: 'k_crescent', name: 'CRESCENT MOON', pose: 'k_crescent', dmg: 8, structure: 30, range: 32, arc: 2.0, windup: 0.1, active: 0.12, recover: 0.2, kb: 220, knockdown: true, lunge: 110, hitstop: 0.09, shake: 0.5, sfx: 'slash', limb: 'blade', hitR: 4, katana: true, bleed: true, slash: { from: -2.2, to: 1.6, r: 20 }, finisher: false, showName: true },
  KLLLL: { id: 'k_heaven', name: 'HEAVEN SPLITTER', pose: 'k_heaven', dmg: 16, structure: 80, range: 32, arc: 0.9, windup: 0.2, active: 0.08, recover: 0.4, kb: 300, knockdown: true, lunge: 140, hitstop: 0.16, shake: 1, sfx: 'slash', limb: 'blade', hitR: 5, katana: true, bleed: true, slash: { from: 0, to: 0, r: 22, lift: 1 }, finisher: true, showName: true },
  KH: { id: 'k_thrust', name: 'LUNGING THRUST', pose: 'k_thrust', dmg: 10, structure: 40, range: 40, arc: 0.6, windup: 0.14, active: 0.16, recover: 0.3, kb: 380, knockdown: true, lunge: 220, hitstop: 0.11, shake: 0.7, sfx: 'slash', limb: 'blade', hitR: 4, katana: true, bleed: true, slash: { from: 0, to: 0, r: 24 }, finisher: true, showName: true },
  KLH: { id: 'k_rising', name: 'RISING MOON', pose: 'k_rising', dmg: 9, structure: 50, range: 28, arc: 1.0, windup: 0.11, active: 0.1, recover: 0.3, kb: 140, knockdown: true, lunge: 90, hitstop: 0.11, shake: 0.7, sfx: 'slash', limb: 'blade', hitR: 4, katana: true, bleed: true, slash: { from: 0.9, to: -1.9, r: 20, lift: 0.6 }, launch: 220, finisher: true, showName: true },
  KLLH: { id: 'k_whirlwind', name: 'WHIRLWIND', pose: 'k_whirlwind', dmg: 5, structure: 24, range: 34, arc: Math.PI, windup: 0.12, active: 0.4, recover: 0.32, kb: 260, knockdown: true, lunge: 0, hitstop: 0.06, shake: 0.5, sfx: 'slash', limb: 'blade', hitR: 4, katana: true, bleed: true, rehit: 0.16, slash: { from: 0, to: Math.PI * 4, r: 21 }, finisher: true, showName: true },
  KHL: { id: 'k_thousand', name: 'THOUSAND CUTS', pose: 'k_thousand', dmg: 2, structure: 10, range: 30, arc: 1.1, windup: 0.06, active: 0.5, recover: 0.3, kb: 40, knockdown: false, lunge: 60, hitstop: 0.025, shake: 0.15, sfx: 'slash', limb: 'blade', hitR: 4, katana: true, bleed: true, rehit: 0.07, slash: { from: -1.2, to: 1.2, r: 18 }, finisher: true, showName: true },
  KHH: { id: 'k_dragonfang', name: 'DRAGON FANG', pose: 'k_dragonfang', dmg: 14, structure: 70, range: 36, arc: 1.2, windup: 0.18, active: 0.14, recover: 0.42, kb: 480, knockdown: true, lunge: 60, hitstop: 0.15, shake: 1, sfx: 'slash', limb: 'blade', hitR: 5, katana: true, bleed: true, slash: { from: -2.4, to: 0.6, r: 24 }, launch: 80, finisher: true, showName: true },
  // RUN + LMB with the katana: the dash-through "one cut" (Iaijutsu)
  KRUN: { id: 'k_iaijutsu', name: 'IAIJUTSU', pose: 'k_iaijutsu', dmg: 18, structure: 120, range: 36, arc: 1.0, windup: 0.1, active: 0.26, recover: 0.5, kb: 120, knockdown: true, lunge: 0, hitstop: 0.0, shake: 0.3, sfx: 'slash', limb: 'blade', hitR: 6, katana: true, bleed: true, travel: 520, rehit: 0.3, slash: { from: 0, to: 0, r: 21 }, finisher: true, showName: true },
  KDASH: { id: 'k_dashcut', name: 'DASH CUT', pose: 'k_crescent', dmg: 9, structure: 36, range: 32, arc: 1.6, windup: 0.04, active: 0.24, recover: 0.24, kb: 280, knockdown: true, lunge: 0, hitstop: 0.09, shake: 0.5, sfx: 'slash', limb: 'blade', hitR: 4.5, katana: true, bleed: true, travel: 300, slash: { from: -2.0, to: 1.4, r: 20 }, finisher: true, showName: true },
};

// ============================== AXE: baseball-bat swings (flat, hip-driven, follow-through) ==============================
Object.assign(MOVES, {
  // LMB chain: a slugger's combo. Every swing is a full horizontal bat swing with a load (wind-up), hip rotation, contact and follow-through.
  AL: { id: 'a_swing1', name: 'SWING', pose: 'a_swing1', dmg: 9, structure: 40, range: 28, arc: 1.5, windup: 0.14, active: 0.1, recover: 0.26, kb: 380, knockdown: true, lunge: 90, hitstop: 0.1, shake: 0.7, sfx: 'axe', limb: 'blade', hitR: 5.5, axe: true, bleed: true, slash: { from: -2.4, to: 0.9, r: 21 } },
  ALL: { id: 'a_swing2', name: 'BACKHAND', pose: 'a_swing2', dmg: 9, structure: 40, range: 28, arc: 1.5, windup: 0.12, active: 0.1, recover: 0.24, kb: 380, knockdown: true, lunge: 80, hitstop: 0.1, shake: 0.7, sfx: 'axe', limb: 'blade', hitR: 5.5, axe: true, bleed: true, slash: { from: 2.4, to: -0.9, r: 21 } },
  ALLL: { id: 'a_homerun', name: 'HOME RUN', pose: 'a_homerun', dmg: 16, structure: 90, range: 32, arc: 1.6, windup: 0.22, active: 0.1, recover: 0.4, kb: 760, knockdown: true, lunge: 120, hitstop: 0.16, shake: 1.2, sfx: 'axe', limb: 'blade', hitR: 6.5, axe: true, bleed: true, launch: 160, slash: { from: -2.8, to: 1.1, r: 24 }, finisher: true, showName: true },
  // RMB: a 720 spinning swing that keeps going
  AH: { id: 'a_spin', name: 'TORNADO SWING', pose: 'a_spin', dmg: 7, structure: 40, range: 32, arc: Math.PI, windup: 0.18, active: 0.56, recover: 0.4, kb: 420, knockdown: true, lunge: 0, hitstop: 0.08, shake: 0.7, sfx: 'axe', limb: 'blade', hitR: 6, axe: true, bleed: true, rehit: 0.22, slash: { from: 0, to: Math.PI * 4, r: 24 }, finisher: true, showName: true },
  // LMB, RMB: golf-swing upper: scoops the target off the floor into the air
  ALH: { id: 'a_golf', name: 'GOLF SWING', pose: 'a_golf', dmg: 11, structure: 60, range: 28, arc: 1.1, windup: 0.16, active: 0.1, recover: 0.36, kb: 200, knockdown: true, lunge: 70, hitstop: 0.12, shake: 0.9, sfx: 'axe', limb: 'blade', hitR: 6, axe: true, bleed: true, launch: 260, slash: { from: 1.2, to: -1.6, r: 22, lift: 0.5 }, finisher: true, showName: true },
  // LMB, LMB, RMB: the overhead chop (the only vertical one)
  ALLH: { id: 'a_overhead', name: 'SKULL SPLITTER', pose: 'a_overhead', dmg: 18, structure: 110, range: 28, arc: 0.9, windup: 0.26, active: 0.08, recover: 0.5, kb: 200, knockdown: true, lunge: 140, hitstop: 0.18, shake: 1.2, sfx: 'axe', limb: 'blade', hitR: 6.5, axe: true, bleed: true, slash: { from: 0, to: 0, r: 22, lift: 1.2 }, finisher: true, showName: true },
  // RMB, LMB: bunt - a short, fast jab with the haft that staggers
  AHL: { id: 'a_bunt', name: 'BUNT', pose: 'a_bunt', dmg: 5, structure: 55, range: 22, arc: 1.0, windup: 0.06, active: 0.1, recover: 0.16, kb: 240, knockdown: false, lunge: 110, hitstop: 0.06, shake: 0.4, sfx: 'axe', limb: 'blade', hitR: 5, axe: true, slash: { from: 0, to: 0, r: 18 }, showName: true },
  // RUN + LMB: grand slam - sprinting flat swing with a huge launch
  ARUN: { id: 'a_grandslam', name: 'GRAND SLAM', pose: 'a_homerun', dmg: 20, structure: 130, range: 34, arc: 1.6, windup: 0.1, active: 0.3, recover: 0.46, kb: 900, knockdown: true, lunge: 0, hitstop: 0.18, shake: 1.3, sfx: 'axe', limb: 'blade', hitR: 7, axe: true, bleed: true, launch: 200, travel: 300, slash: { from: -2.8, to: 1.1, r: 24 }, finisher: true, showName: true },
  ADASH: { id: 'a_dashswing', name: 'SLIDING SWING', pose: 'a_swing1', dmg: 12, structure: 60, range: 30, arc: 1.5, windup: 0.05, active: 0.24, recover: 0.36, kb: 460, knockdown: true, lunge: 0, hitstop: 0.12, shake: 0.8, sfx: 'axe', limb: 'blade', hitR: 6, axe: true, bleed: true, travel: 280, slash: { from: -2.4, to: 0.9, r: 21 }, finisher: true, showName: true },
  // ============================== DUAL BLADES (fast, flurry, two hitboxes) ==============================
  DL: { id: 'd_cross', name: 'CROSS CUT', pose: 'd_cross', dmg: 4, structure: 12, range: 24, arc: 1.3, windup: 0.04, active: 0.08, recover: 0.08, kb: 90, knockdown: false, lunge: 90, hitstop: 0.04, shake: 0.25, sfx: 'dual', limb: 'blade2', hitR: 3.5, dual: true, bleed: true, slash: { from: -1.2, to: 0.8, r: 16 } },
  DLL: { id: 'd_scissor', name: 'SCISSOR', pose: 'd_scissor', dmg: 5, structure: 16, range: 24, arc: 1.3, windup: 0.05, active: 0.08, recover: 0.09, kb: 120, knockdown: false, lunge: 90, hitstop: 0.05, shake: 0.3, sfx: 'dual', limb: 'blade2', hitR: 3.5, dual: true, bleed: true, slash: { from: 1.1, to: -0.9, r: 16 } },
  DLLL: { id: 'd_flurry', name: 'BLADE FLURRY', pose: 'd_flurry', dmg: 2, structure: 8, range: 24, arc: 1.2, windup: 0.05, active: 0.45, recover: 0.2, kb: 30, knockdown: false, lunge: 70, hitstop: 0.02, shake: 0.15, sfx: 'dual', limb: 'blade2', hitR: 3.5, dual: true, bleed: true, rehit: 0.06, slash: { from: -1.0, to: 1.0, r: 16 }, showName: true },
  DLLLL: { id: 'd_xslash', name: 'X-SLASH', pose: 'd_xslash', dmg: 12, structure: 50, range: 26, arc: 1.2, windup: 0.14, active: 0.1, recover: 0.3, kb: 300, knockdown: true, lunge: 120, hitstop: 0.12, shake: 0.8, sfx: 'dual', limb: 'blade2', hitR: 4.5, dual: true, bleed: true, slash: { from: -1.4, to: 1.4, r: 18 }, finisher: true, showName: true },
  DH: { id: 'd_dance', name: 'BLADE DANCE', pose: 'd_dance', dmg: 4, structure: 16, range: 28, arc: Math.PI, windup: 0.1, active: 0.6, recover: 0.3, kb: 200, knockdown: true, lunge: 0, hitstop: 0.04, shake: 0.4, sfx: 'dual', limb: 'blade2', hitR: 4, dual: true, bleed: true, rehit: 0.14, slash: { from: 0, to: Math.PI * 6, r: 18 }, finisher: true, showName: true },
  DLH: { id: 'd_launch', name: 'TWIN RISING', pose: 'd_launch', dmg: 9, structure: 40, range: 24, arc: 1.0, windup: 0.1, active: 0.12, recover: 0.3, kb: 120, knockdown: true, lunge: 140, hitstop: 0.1, shake: 0.7, sfx: 'dual', limb: 'blade2', hitR: 5, dual: true, bleed: true, launch: 220, slash: { from: 0.6, to: -1.2, r: 17, lift: 0.3 }, finisher: true, showName: true },
  DRUN: { id: 'd_dash', name: 'PHANTOM CROSS', pose: 'd_dash', dmg: 14, structure: 70, range: 30, arc: 1.0, windup: 0.08, active: 0.26, recover: 0.4, kb: 200, knockdown: true, lunge: 0, hitstop: 0.0, shake: 0.4, sfx: 'dual', limb: 'blade2', hitR: 5, dual: true, bleed: true, travel: 540, rehit: 0.3, slash: { from: 0, to: 0, r: 16 }, finisher: true, showName: true },
  DDASH: { id: 'd_dashcut', name: 'DASH SCISSOR', pose: 'd_scissor', dmg: 8, structure: 30, range: 26, arc: 1.4, windup: 0.04, active: 0.22, recover: 0.22, kb: 220, knockdown: true, lunge: 0, hitstop: 0.08, shake: 0.5, sfx: 'dual', limb: 'blade2', hitR: 4, dual: true, bleed: true, travel: 300, slash: { from: 1.3, to: -1.1, r: 16 }, finisher: true, showName: true },
} as Record<string, Move>);

export const MOVE_LIST: { keys: string; name: string; desc: string }[] = [
  { keys: 'LMB x5', name: 'JAB > CROSS > HOOK > ROUNDHOUSE > DRAGON TAIL', desc: 'Light chain ending in a 360 launcher. Every hit lands where the fist/foot is.' },
  { keys: 'RHYTHM = STYLE', name: 'FREESTYLE FLOW (FISTS)', desc: 'Your click TEMPO picks the style and the game chains the moves. FAST taps (0.1-0.3s) = WING CHUN chain punch. MEDIUM groove (0.3-0.6s) = BLACK LEG kick flow (Collier > Epaule > Cotelette > Anti-Manner > Mouton Shot > Concasse > Party Table > DIABLE JAMBE). SLOW heavy beats (0.6-1.0s) = KUNG FU heavies (Palm > Iron Palm > Hammer Fist > Dragon Uppercut). Switch tempo mid-fight to transition styles; nearly-dead targets get an automatic finisher.' },
  { keys: 'HEAT', name: 'IN THE ZONE', desc: 'Stay in one rhythm to build HEAT: damage and move speed rise, the screen pulses with the beat. Getting hit cools you down.' },
  { keys: 'R (RAGE FULL)', name: 'RAGE MODE', desc: '8 seconds: every LMB dashes to the nearest enemy and executes it (bosses take heavy damage). Fair: rage only fills by landing chain punches.' },
  { keys: 'LMB x4, RMB', name: 'MANTIS STRIKE', desc: 'One-inch finger strike. Shatters structure.' },
  { keys: 'LMB x3, RMB', name: 'DRAGON UPPERCUT', desc: 'Launcher. Juggle them in the air.' },
  { keys: 'LMB, LMB, RMB', name: 'SWEEP KICK', desc: '360 sweep. Knocks everyone down.' },
  { keys: 'LMB, RMB, LMB / RMB', name: 'TWIN PALM / TIGER CLAW', desc: 'Palm blast across the room, or a 4-hit bleeding claw rake.' },
  { keys: 'RMB, LMB, LMB / RMB', name: 'AXE KICK / MONKEY FLIP', desc: 'Heel crash, or a backflip kick that launches.' },
  { keys: 'RMB, RMB, LMB', name: 'CRANE KICK', desc: 'The classic. Long windup, devastating.' },
  { keys: 'RUN + LMB', name: 'TAEKWONDO FLYING SIDE KICK', desc: 'Fists only. Sprint, then left click.' },
  { keys: '4: NUNCHAKU LMB x4', name: 'BRUCE LEE TRIANGLE COMBO', desc: 'From the underarm tuck: diagonal down-left strike > bounce up to the left shoulder > horizontal chest sweep back right > catch & lock under the right armpit. 5th LMB: SKULL CRACKER.' },
  { keys: 'NUNCHAKU RMB', name: 'HELICOPTER / SPECIALS', desc: 'RMB: HELICOPTER (hold). RMB,LMB: ANKLE BREAKER. RMB,RMB: TORNADO. LMB,RMB: WHIP CRACK. LMB,LMB,RMB: CHAIN CHOKE SLAM.' },
  { keys: 'NUNCHAKU: RUN + LMB', name: 'DRAGON LASH', desc: 'Lethal charging strike: leap in, chain whips around and detonates. Replaces the kick.' },
  { keys: 'NUNCHAKU: F', name: 'CHAIN FATALITIES', desc: 'Garrote snap, skull drum, helicopter decapitation.' },
  { keys: '5: KATANA', name: 'IAI DRAW > RETURN CUT > CRESCENT MOON > HEAVEN SPLITTER', desc: 'RMB: LUNGING THRUST. LMB,RMB: RISING MOON (launch). LMB,LMB,RMB: WHIRLWIND. RMB,LMB: THOUSAND CUTS. RMB,RMB: DRAGON FANG. Cuts bleed.' },
  { keys: 'KATANA: RUN + LMB', name: 'IAIJUTSU', desc: 'Dash through them. One cut. They fall after you sheathe.' },
  { keys: 'KATANA: F', name: 'BLADE FATALITIES', desc: 'Bisection, beheading, impale & flick.' },
  { keys: '6: AXE', name: 'SWING > BACKHAND > HOME RUN', desc: 'Baseball-bat swings: load, hips, contact, follow-through. 3rd swing is a HOME RUN launcher. RMB: TORNADO SWING (720). LMB,RMB: GOLF SWING (scoop launch). LMB,LMB,RMB: SKULL SPLITTER. RMB,LMB: BUNT. RUN+LMB: GRAND SLAM.' },
  { keys: '7: DUAL BLADES', name: 'CROSS > SCISSOR > FLURRY > X-SLASH', desc: 'Two hitboxes, very fast. RMB: BLADE DANCE. LMB,RMB: TWIN RISING (launch). RUN+LMB: PHANTOM CROSS (dash through).' },
  { keys: 'SPACE', name: 'JUMP', desc: 'Hop over bullets and sweeps. LMB in the air = DIVE KICK.' },
  { keys: 'SHIFT', name: 'SHADOW STEP', desc: 'Dash with i-frames. Perfect-dodge to refill focus.' },
  { keys: 'E', name: 'DRAGON PALM', desc: 'Focus attack. Costs 1 focus bar.' },
  { keys: 'F', name: 'FATALITY', desc: 'Weapon-specific finishers. Staggered (yellow) enemy = PERFECT.' },
];

import type { PlayerStats } from './types';

export interface Mutation {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  apply: (s: PlayerStats) => void;
  max?: number;
  instant?: 'heal' | 'ammo' | 'youth' | 'fullheal';
}

export const MUTATIONS: Mutation[] = [
  { id: 'ironfist', name: 'IRON FIST', desc: '+25% kung fu damage', icon: '✊', color: '#ff5a36', apply: (s) => (s.meleeDmg += 0.25), max: 10 },
  { id: 'secondwind', name: 'SECOND WIND', desc: 'Full heal + full focus right now', icon: '💊', color: '#ff6b6b', apply: () => {}, instant: 'fullheal' },
  { id: 'ammocache', name: 'AMMO CACHE', desc: '+40 pistol, +100 rifle ammo', icon: '🧰', color: '#ffd166', apply: () => {}, instant: 'ammo' },
  { id: 'longarms', name: 'LONG ARMS', desc: '+20% melee reach', icon: '🦾', color: '#ffd166', apply: (s) => (s.meleeRange += 0.2), max: 3 },
  { id: 'steelbody', name: 'STEEL BODY', desc: '+1 max HP, heal 1', icon: '❤️', color: '#ff3b3b', apply: (s) => (s.hpBonus += 1), instant: 'heal', max: 5 },
  { id: 'quickfeet', name: 'QUICK FEET', desc: '+12% move speed', icon: '👟', color: '#7cff6b', apply: (s) => (s.moveSpeed += 0.12), max: 4 },
  { id: 'shadowstep', name: 'SHADOW STEP', desc: 'Dash cooldown -30%, dash length +15%', icon: '💨', color: '#35f0ff', apply: (s) => { s.dashCd *= 0.7; s.dashDist += 0.15; }, max: 3 },
  { id: 'deeppockets', name: 'DEEP POCKETS', desc: '+50% max ammo, refill some ammo', icon: '🎒', color: '#ffd23c', apply: (s) => (s.maxAmmo += 0.5), instant: 'ammo', max: 3 },
  { id: 'trigger', name: 'TRIGGER FINGER', desc: '+30% fire rate', icon: '🔫', color: '#ff9f43', apply: (s) => (s.fireRate += 0.3), max: 3 },
  { id: 'hollow', name: 'HOLLOW POINTS', desc: '+1 bullet damage', icon: '🎯', color: '#ff7f50', apply: (s) => (s.bulletDmg += 1), max: 4 },
  { id: 'vampire', name: 'VAMPIRE PALM', desc: 'Takedowns heal +1 extra', icon: '🩸', color: '#ff2e63', apply: (s) => (s.takedownHeal += 1), max: 2 },
  { id: 'calm', name: "MONK'S CALM", desc: '+50% focus gain', icon: '🧘', color: '#3dffa0', apply: (s) => (s.focusGain += 0.5), max: 3 },
  { id: 'crowd', name: 'CROWD CONTROL', desc: '+40% knockback. Wall slams hurt more', icon: '🌪️', color: '#b24dff', apply: (s) => (s.knockback += 0.4), max: 3 },
  { id: 'bonebreaker', name: 'BONE BREAKER', desc: '+50% structure damage. Stagger faster', icon: '🦴', color: '#f5e9d0', apply: (s) => (s.structureDmg += 0.5), max: 3 },
  { id: 'thickskin', name: 'THICK SKIN', desc: '15% chance to ignore damage', icon: '🛡️', color: '#9be7ff', apply: (s) => (s.dodgeChance = Math.min(0.45, s.dodgeChance + 0.15)), max: 3 },
  { id: 'scavenger', name: 'SCAVENGER', desc: '+60% item drops', icon: '📦', color: '#a3ff3a', apply: (s) => (s.dropRate += 0.6), max: 2 },
  { id: 'piercing', name: "HUNTER'S EYE", desc: 'Bullets pierce +1 enemy', icon: '👁️', color: '#4dd2ff', apply: (s) => (s.pierce += 1), max: 2 },
  { id: 'rebound', name: 'REBOUND', desc: 'Parry window +50%', icon: '⚡', color: '#ffe600', apply: (s) => (s.parryWindow += 0.5), max: 2 },
  { id: 'berserk', name: 'BERSERKER', desc: '+3% melee damage per combo hit (max +60%)', icon: '🔥', color: '#ff6a00', apply: (s) => (s.berserk += 0.03), max: 2 },
  { id: 'ricochet', name: 'RICOCHET', desc: 'Bullets bounce off walls', icon: '↩️', color: '#ff3df2', apply: (s) => (s.bounce += 1), max: 2 },
  { id: 'shockfist', name: 'SHOCK FIST', desc: 'Combo finishers release a shockwave', icon: '💥', color: '#ff4fa3', apply: (s) => (s.shockwave += 1), max: 1 },
  { id: 'youth', name: 'YOUTH ELIXIR', desc: 'Age -6 years', icon: '🧪', color: '#5ff2d6', apply: () => {}, instant: 'youth' },
  { id: 'lifesteal', name: 'BLOOD RITE', desc: 'Every 25 melee hits heals 1 HP', icon: '🩹', color: '#ff4d6d', apply: (s) => (s.lifesteal += 1), max: 2 },
  { id: 'flow', name: 'FLOW STATE', desc: 'Combo meter decays 50% slower', icon: '🌊', color: '#8fb8ff', apply: (s) => (s.comboDecay *= 0.5), max: 2 },
];

export function rollMutations(taken: string[], n = 3, rng: () => number = Math.random): Mutation[] {
  const counts: Record<string, number> = {};
  taken.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  const pool = MUTATIONS.filter((m) => !m.max || (counts[m.id] || 0) < m.max);
  const out: Mutation[] = [];
  const copy = [...pool];
  while (out.length < n && copy.length) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

export const VIEW_W = 480;
export const VIEW_H = 270;
export const TILE = 16;
export const TOTAL_LEVELS = 200;
export const LEVELS_PER_ZONE = 10;

export interface Palette {
  bg: string;
  floor: string;
  floorAlt: string;
  wall: string;
  wallTop: string;
  accent: string;
  accent2: string;
}

export interface Zone {
  name: string;
  sub: string;
  pal: Palette;
}

/** V2 terrain colours: the EXACT STICK FIST biome hexes (bg/floor/floorDot/wall/wallTop/accent), so game2's
 *  ground reads 100% like game1. floorAlt = game1's floorDot, accent2 = game1's single accent. */
export const G1_BIOMES: Palette[] = [
  { bg: '#0b0b12', floor: '#15151f', floorAlt: '#1d1d2a', wall: '#2a2a3d', wallTop: '#3b3b55', accent: '#ff3b3b', accent2: '#ff3b3b' },
  { bg: '#08060f', floor: '#120d20', floorAlt: '#1a1330', wall: '#2b1b4d', wallTop: '#4b2d85', accent: '#ff2d95', accent2: '#ff2d95' },
  { bg: '#070d08', floor: '#0f1a10', floorAlt: '#15241a', wall: '#1e3a22', wallTop: '#2f5a34', accent: '#ffcc33', accent2: '#ffcc33' },
  { bg: '#0e0a06', floor: '#1b1409', floorAlt: '#241b0e', wall: '#3a2c14', wallTop: '#5a4520', accent: '#ff7a1a', accent2: '#ff7a1a' },
  { bg: '#060a12', floor: '#0e1626', floorAlt: '#152036', wall: '#223a5a', wallTop: '#3a5f8f', accent: '#5ff0ff', accent2: '#5ff0ff' },
  { bg: '#120406', floor: '#1e080b', floorAlt: '#2a0c10', wall: '#4a1218', wallTop: '#7a1c26', accent: '#ffd166', accent2: '#ffd166' },
  { bg: '#050505', floor: '#0e0e0e', floorAlt: '#161616', wall: '#262626', wallTop: '#3d3d3d', accent: '#a3ff3b', accent2: '#a3ff3b' },
  { bg: '#0a0e1c', floor: '#141a30', floorAlt: '#1b2340', wall: '#2c3a66', wallTop: '#4a5f9c', accent: '#ffffff', accent2: '#ffffff' },
  { bg: '#07000f', floor: '#10021c', floorAlt: '#170528', wall: '#2c0a4e', wallTop: '#4e1486', accent: '#3bffd8', accent2: '#3bffd8' },
  { bg: '#0c0a04', floor: '#17130a', floorAlt: '#1f1a0e', wall: '#3d3214', wallTop: '#6b5a22', accent: '#ffe14d', accent2: '#ffe14d' },
];

export const ZONES: Zone[] = [
  { name: 'RUST YARD', sub: 'THE FIRST STEP', pal: { bg: '#120a0a', floor: '#241512', floorAlt: '#2a1915', wall: '#4a2a22', wallTop: '#6b3a2c', accent: '#ff5a36', accent2: '#ffd166' } },
  { name: 'NEON DOJO', sub: 'LIGHTS IN THE DARK', pal: { bg: '#070b18', floor: '#10162b', floorAlt: '#141b33', wall: '#232f5c', wallTop: '#3a4c8a', accent: '#35f0ff', accent2: '#ff3df2' } },
  { name: 'BLOOD GARDEN', sub: 'PETALS AND BONES', pal: { bg: '#0c070c', floor: '#1c0f1a', floorAlt: '#211322', wall: '#3d1c38', wallTop: '#5e2a56', accent: '#ff2e63', accent2: '#7cff6b' } },
  { name: 'ASH MONASTERY', sub: 'SILENT MONKS', pal: { bg: '#0b0b0d', floor: '#1b1b20', floorAlt: '#202026', wall: '#3a3a44', wallTop: '#55556a', accent: '#ff8c42', accent2: '#f2f2f2' } },
  { name: 'JADE TEMPLE', sub: 'GREEN SERPENT', pal: { bg: '#061009', floor: '#0f1f14', floorAlt: '#122418', wall: '#1f4a2e', wallTop: '#2f6f44', accent: '#3dffa0', accent2: '#ffe66d' } },
  { name: 'VIOLET CATACOMBS', sub: 'BENEATH THE CITY', pal: { bg: '#0a0612', floor: '#170f26', floorAlt: '#1c132c', wall: '#33225a', wallTop: '#4e3685', accent: '#b24dff', accent2: '#ff9ff3' } },
  { name: 'GOLDEN PAGODA', sub: 'WEALTH OF THE WICKED', pal: { bg: '#120c05', floor: '#241a0c', floorAlt: '#2a1f10', wall: '#5a4316', wallTop: '#8a6a22', accent: '#ffd23c', accent2: '#ff5e5e' } },
  { name: 'FROST SHRINE', sub: 'COLD BREATH', pal: { bg: '#06101a', floor: '#0f2030', floorAlt: '#132537', wall: '#244a66', wallTop: '#3b7399', accent: '#9be7ff', accent2: '#ffffff' } },
  { name: 'CRIMSON BAZAAR', sub: 'EVERYTHING FOR SALE', pal: { bg: '#140508', floor: '#2a0c14', floorAlt: '#31101a', wall: '#5c1c2e', wallTop: '#8a2a44', accent: '#ff4d6d', accent2: '#ffd166' } },
  { name: 'VOID ARENA', sub: 'HALFWAY TO NOTHING', pal: { bg: '#000000', floor: '#0d0d12', floorAlt: '#111118', wall: '#26262f', wallTop: '#44444f', accent: '#ffffff', accent2: '#ff2bd6' } },
  { name: 'SUNSET DOCKS', sub: 'LAST LIGHT', pal: { bg: '#120818', floor: '#241230', floorAlt: '#2a1738', wall: '#5a2a4a', wallTop: '#8a3f5e', accent: '#ff9f43', accent2: '#ff4fa3' } },
  { name: 'TOXIC SEWERS', sub: 'HOLD YOUR BREATH', pal: { bg: '#070c06', floor: '#121a0e', floorAlt: '#161f11', wall: '#2d3d1c', wallTop: '#4a6128', accent: '#a3ff3a', accent2: '#ff6b35' } },
  { name: 'ELECTRIC TOWER', sub: 'HIGH VOLTAGE', pal: { bg: '#06080f', floor: '#0f1322', floorAlt: '#131829', wall: '#242c55', wallTop: '#3d4a8a', accent: '#ffe600', accent2: '#4dd2ff' } },
  { name: 'BONE PIT', sub: 'THEY NEVER LEFT', pal: { bg: '#0c0a08', floor: '#1c1814', floorAlt: '#221d18', wall: '#4a4036', wallTop: '#7a6a58', accent: '#f5e9d0', accent2: '#ff3b3b' } },
  { name: 'CORAL DEPTHS', sub: 'DROWNED DOJO', pal: { bg: '#031014', floor: '#082028', floorAlt: '#0b2630', wall: '#124a55', wallTop: '#1c7580', accent: '#ff7f7f', accent2: '#5ff2d6' } },
  { name: 'SMOG CITY', sub: 'NO SKY', pal: { bg: '#0d0d0b', floor: '#1d1d1a', floorAlt: '#23231f', wall: '#3f3f38', wallTop: '#5f5f55', accent: '#ffcf3a', accent2: '#8cff8c' } },
  { name: 'LAVA FORGE', sub: 'WHERE FISTS ARE MADE', pal: { bg: '#0e0503', floor: '#1e0c08', floorAlt: '#24100a', wall: '#4a1a10', wallTop: '#7a2a16', accent: '#ff6a00', accent2: '#ffe08a' } },
  { name: 'STARLIT PEAK', sub: 'ABOVE THE CLOUDS', pal: { bg: '#05081a', floor: '#0d1230', floorAlt: '#101638', wall: '#262f6a', wallTop: '#3f4c9e', accent: '#ffffff', accent2: '#8fb8ff' } },
  { name: 'PHANTOM DOJO', sub: 'GHOSTS OF MASTERS', pal: { bg: '#050a0a', floor: '#0d1a1a', floorAlt: '#102020', wall: '#1f3f3f', wallTop: '#2f6060', accent: '#7bffde', accent2: '#c77dff' } },
  { name: 'THRONE OF THE MASTER', sub: 'THE END OF THE ROAD', pal: { bg: '#0a0808', floor: '#1a1414', floorAlt: '#201818', wall: '#5a4a3a', wallTop: '#9a8060', accent: '#ffd700', accent2: '#ff2a2a' } },
];

export function zoneOf(level: number): number {
  return Math.min(ZONES.length - 1, Math.max(0, Math.floor((level - 1) / LEVELS_PER_ZONE)));
}

export const PLAYER_COLOR = '#ffffff';
export const PLAYER_BAND = '#ff3b3b';

/** Permanent camera zoom-in for the whole game (+40%). Cinematic zooms are multiplied on top of it. */
export const BASE_ZOOM = 1.4;

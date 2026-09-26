/**
 * Master palette (ENDESGA 32). All pixel art, UI and anime art should draw from
 * these colors so the whole game reads as one cohesive image. A few extra shades
 * are fine when genuinely needed, but prefer these.
 */
export const PAL = {
  rust: '#be4a2f',
  orangeBrown: '#d77643',
  sand: '#ead4aa',
  tan: '#e4a672',
  brown: '#b86f50',
  darkBrown: '#733e39',
  plum: '#3e2731',
  darkRed: '#a22633',
  red: '#e43b44',
  orange: '#f77622',
  gold: '#feae34',
  yellow: '#fee761',
  green: '#63c74d',
  darkGreen: '#3e8948',
  forest: '#265c42',
  deepTeal: '#193c3e',
  blue: '#124e89',
  sky: '#0099db',
  cyan: '#2ce8f5',
  white: '#ffffff',
  lightGray: '#c0cbdc',
  gray: '#8b9bb4',
  slate: '#5a6988',
  darkSlate: '#3a4466',
  navy: '#262b44',
  black: '#181425',
  hotPink: '#ff0044',
  purple: '#68386c',
  magenta: '#b55088',
  pink: '#f6757a',
  skin: '#e8b796',
  skinShade: '#c28569',
} as const;

export type PaletteKey = keyof typeof PAL;

/** Item rarity colors used across UI, loot beams and names. */
export const RARITY_COLORS = {
  common: PAL.lightGray,
  uncommon: PAL.green,
  rare: PAL.sky,
  epic: PAL.magenta,
  legendary: PAL.orange,
  abyssal: PAL.hotPink,
} as const;

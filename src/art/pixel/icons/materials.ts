/**
 * Tier materials for equipment icons (0 wood/rust → 5 aether).
 */
import { PAL } from '../../palette';
import type { Col } from '../env/raster';

export interface Material {
  /** main metal ramp, dark → light (5) */
  metal: readonly [Col, Col, Col, Col, Col];
  /** grip / leather / wood ramp, dark → light (3) */
  grip: readonly [Col, Col, Col];
  /** trim / guard accent ramp, dark → light (3) */
  trim: readonly [Col, Col, Col];
  gem: Col;
  gemHi: Col;
  /** optional glow colour for high tiers */
  glow?: Col;
  outline: Col;
}

export const MATERIALS: readonly Material[] = [
  // 0: wood / rusty iron
  {
    metal: [PAL.plum, PAL.darkBrown, '#8f5a44', PAL.brown, PAL.tan],
    grip: [PAL.plum, PAL.darkBrown, '#9a5b45'],
    trim: [PAL.darkBrown, '#8f5a44', PAL.brown],
    gem: PAL.slate,
    gemHi: PAL.lightGray,
    outline: PAL.black,
  },
  // 1: iron
  {
    metal: [PAL.navy, PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray],
    grip: [PAL.plum, PAL.darkBrown, '#9a5b45'],
    trim: [PAL.darkSlate, PAL.slate, PAL.gray],
    gem: PAL.sky,
    gemHi: PAL.white,
    outline: PAL.black,
  },
  // 2: steel (with gold trim)
  {
    metal: [PAL.darkSlate, PAL.slate, PAL.gray, PAL.lightGray, PAL.white],
    grip: [PAL.navy, PAL.blue, PAL.sky],
    trim: [PAL.rust, PAL.gold, PAL.yellow],
    gem: PAL.red,
    gemHi: PAL.pink,
    outline: PAL.black,
  },
  // 3: sky crystal
  {
    metal: [PAL.blue, PAL.sky, PAL.cyan, '#9ff6ff', PAL.white],
    grip: [PAL.navy, PAL.darkSlate, PAL.slate],
    trim: [PAL.slate, PAL.lightGray, PAL.white],
    gem: PAL.cyan,
    gemHi: PAL.white,
    glow: PAL.cyan,
    outline: '#0b1f3a',
  },
  // 4: ember
  {
    metal: [PAL.darkRed, PAL.red, PAL.orange, PAL.gold, PAL.yellow],
    grip: [PAL.plum, PAL.darkBrown, PAL.rust],
    trim: [PAL.rust, PAL.gold, PAL.yellow],
    gem: PAL.red,
    gemHi: PAL.yellow,
    glow: PAL.orange,
    outline: '#2a0f14',
  },
  // 5: aether
  {
    metal: [PAL.purple, PAL.magenta, PAL.pink, '#9ff6ff', PAL.white],
    grip: [PAL.navy, PAL.purple, PAL.magenta],
    trim: [PAL.rust, PAL.gold, PAL.yellow],
    gem: PAL.cyan,
    gemHi: PAL.white,
    glow: PAL.cyan,
    outline: '#1a0b24',
  },
];

export function material(tier: number): Material {
  const t = Math.max(0, Math.min(5, Math.floor(Number.isFinite(tier) ? tier : 0)));
  return MATERIALS[t];
}

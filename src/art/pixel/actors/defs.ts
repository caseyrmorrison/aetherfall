import type { AnimInfo, AnimName, SpriteInfo } from '../types';
import type { Buf } from './buf';

/** Directions a sprite is authored in. 'left' is always a mirror of 'right'. */
export type FaceDir = 'down' | 'up' | 'right';

export interface SpriteDef {
  info: SpriteInfo;
  /** Draw one frame. `anim` is guaranteed to exist in info.anims and `frame` is in range. */
  draw(anim: AnimName, frame: number, dir: FaceDir): Buf;
}

/** Def for a side-view sprite authored facing right (dirs 2) or with no facing (dirs 1). */
export function sideDef(
  info: Omit<SpriteInfo, 'dirs'>,
  fn: (anim: AnimName, f: number) => Buf,
  dirs: 1 | 2 = 2,
): SpriteDef {
  return { info: { ...info, dirs }, draw: (anim, f) => fn(anim, f) };
}

/** Shorthand for anim tables: anims({ idle: [2, 2], move: [4, 8] }). */
export function anims(
  t: Partial<Record<AnimName, readonly [number, number]>>,
): Partial<Record<AnimName, AnimInfo>> {
  const out: Partial<Record<AnimName, AnimInfo>> = {};
  for (const [k, v] of Object.entries(t) as [AnimName, readonly [number, number]][])
    out[k] = { frames: v[0], fps: v[1] };
  return out;
}

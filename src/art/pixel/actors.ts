/**
 * Actor sprites: characters, creatures, bosses, projectiles, effects and weapons.
 *
 * Everything is generated procedurally on first request and cached (each frame
 * is built at most once). The individual groups live in ./actors/*. Frames are
 * authored facing down / up / right; 'left' is always the mirrored 'right'.
 */
import { flipX, memo, paint, type Canvas } from './core';
import type { AnimName, BossId, Dir, SpriteId, SpriteInfo, WeaponInfo, WeaponKind } from './types';
import { Buf, INK } from './actors/buf';
import { anims, type FaceDir, type SpriteDef } from './actors/defs';
import { CHARACTER_DEFS } from './actors/characters';
import { CREATURE_A_DEFS } from './actors/creatures-a';
import { CREATURE_B_DEFS } from './actors/creatures-b';
import { CREATURE_C_DEFS } from './actors/creatures-c';
import { CREATURE_D_DEFS } from './actors/creatures-d';
import { BOSS_DEFS } from './actors/bosses';
import { ACT2_BOSS_DEFS } from './actors/bosses-act2';
import { FX_DEFS, PROJECTILE_DEFS } from './actors/fx';
import { drawWeapon, weaponSize } from './actors/weapons';

/** Hero weapon-hand position per frame (see characters.ts). */
export { heroHand } from './actors/characters';

const PLACEHOLDER: SpriteDef = {
  info: { w: 16, h: 16, anchorX: 8, anchorY: 15, dirs: 1, anims: anims({ idle: [1, 1] }) },
  draw() {
    const b = new Buf(16, 16);
    b.rect(3, 3, 10, 12, '#ff00ff');
    return b.outline(INK);
  },
};

/** Every boss must have art (split across modules by act). */
const BOSSES: Record<BossId, SpriteDef> = { ...BOSS_DEFS, ...ACT2_BOSS_DEFS };

const DEFS: Partial<Record<SpriteId, SpriteDef>> = {
  ...CHARACTER_DEFS,
  ...CREATURE_A_DEFS,
  ...CREATURE_B_DEFS,
  ...CREATURE_C_DEFS,
  ...CREATURE_D_DEFS,
  ...BOSSES,
  ...PROJECTILE_DEFS,
  ...FX_DEFS,
};

function defOf(id: SpriteId): SpriteDef {
  return DEFS[id] ?? PLACEHOLDER;
}

/** Frame size, anchor, facing support and the anims (with frame counts / fps) a sprite has. */
export function spriteInfo(id: SpriteId): SpriteInfo {
  return defOf(id).info;
}

const FALLBACK_ORDER: readonly AnimName[] = ['idle', 'move', 'walk', 'fly'];

function resolveAnim(info: SpriteInfo, anim: AnimName): AnimName {
  if (info.anims[anim]) return anim;
  for (const a of FALLBACK_ORDER) if (info.anims[a]) return a;
  return (Object.keys(info.anims)[0] as AnimName | undefined) ?? 'idle';
}

const baseFrame = memo(
  (id: SpriteId, anim: AnimName, frame: number, dir: FaceDir) => `${id}|${anim}|${frame}|${dir}`,
  (id: SpriteId, anim: AnimName, frame: number, dir: FaceDir): Canvas =>
    defOf(id).draw(anim, frame, dir).toCanvas(),
);

const mirroredFrame = memo(
  (id: SpriteId, anim: AnimName, frame: number) => `${id}|${anim}|${frame}`,
  (id: SpriteId, anim: AnimName, frame: number): Canvas => flipX(baseFrame(id, anim, frame, 'right')),
);

let errorCanvas: Canvas | null = null;
function fallbackCanvas(): Canvas {
  errorCanvas ??= paint(8, 8, (ctx) => {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 8, 8);
  });
  return errorCanvas;
}

/**
 * Get one animation frame. Never throws: unknown anims fall back to
 * idle / move / walk / fly, frame indices wrap, and directions are normalised
 * to what the sprite supports (dirs 2: up/down → right; dirs 1: dir ignored).
 */
export function getSprite(id: SpriteId, anim: AnimName, frame: number, dir: Dir): Canvas {
  try {
    const info = defOf(id).info;
    const a = resolveAnim(info, anim);
    const n = Math.max(1, info.anims[a]?.frames ?? 1);
    const fi = Number.isFinite(frame) ? Math.floor(frame) : 0;
    const f = ((fi % n) + n) % n;
    if (info.dirs === 1) return baseFrame(id, a, f, 'down');
    if (info.dirs === 2) return dir === 'left' ? mirroredFrame(id, a, f) : baseFrame(id, a, f, 'right');
    if (dir === 'left') return mirroredFrame(id, a, f);
    return baseFrame(id, a, f, dir === 'up' ? 'up' : dir === 'right' ? 'right' : 'down');
  } catch (err) {
    console.error('getSprite failed', id, anim, frame, dir, err);
    return fallbackCanvas();
  }
}

// ---------------------------------------------------------------- weapons ---

/** Image size and grip point; weapon images point RIGHT with the grip on the left. */
export function weaponInfo(kind: WeaponKind): WeaponInfo {
  return { ...weaponSize(kind) };
}

const weaponCanvas = memo(
  (kind: WeaponKind, tier: number) => `${kind}|${tier}`,
  (kind: WeaponKind, tier: number): Canvas => drawWeapon(kind, tier).toCanvas(),
);

/** tier 0-5: wood/rusty, iron, steel, crystal, ember, aether (clamped). */
export function getWeapon(kind: WeaponKind, tier: number): Canvas {
  try {
    const t = Math.max(0, Math.min(5, Number.isFinite(tier) ? Math.floor(tier) : 0));
    return weaponCanvas(kind, t);
  } catch (err) {
    console.error('getWeapon failed', kind, tier, err);
    return fallbackCanvas();
  }
}

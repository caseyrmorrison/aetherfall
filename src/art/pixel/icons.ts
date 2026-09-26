/**
 * 16x16 item, skill and UI icons. Generated procedurally on first use and cached.
 * Equipment icons are tinted by `tier` (0 wood/rust, 1 iron, 2 steel, 3 sky crystal,
 * 4 ember, 5 aether); `tier` is ignored for every other icon.
 */
import { memo, type Canvas } from './core';
import type { IconId } from './types';
import { Grid } from './env/raster';
import { amulet, armor, boots, dagger, greatsword, helm, ring, staff, sword } from './icons/equip';
import { belt, charm, gloves } from './icons/gear-extra';
import { gem, type GemArtType } from './icons/gems';
import { material } from './icons/materials';
import { ITEM_ICONS } from './icons/items';
import { SKILL_ICONS } from './icons/skills';
import { EMBLEM_ICONS } from './icons/emblems';
import { UI_ICONS } from './icons/ui';

const EQUIP: Partial<Record<IconId, (tier: number) => Grid>> = {
  icon_sword: (t) => sword(material(t)),
  icon_greatsword: (t) => greatsword(material(t)),
  icon_dagger: (t) => dagger(material(t)),
  icon_staff: (t) => staff(material(t), t),
  icon_helm: (t) => helm(material(t)),
  icon_armor: (t) => armor(material(t)),
  icon_boots: (t) => boots(material(t)),
  icon_ring: (t) => ring(material(t)),
  icon_amulet: (t) => amulet(material(t)),
  icon_gloves: (t) => gloves(material(t)),
  icon_belt: (t) => belt(material(t)),
  icon_charm_small: (t) => charm(material(t), 'small'),
  icon_charm_large: (t) => charm(material(t), 'large'),
  icon_charm_grand: (t) => charm(material(t), 'grand'),
};

const OTHER: Partial<Record<IconId, () => Grid>> = {
  ...ITEM_ICONS,
  ...SKILL_ICONS,
  ...EMBLEM_ICONS,
  ...UI_ICONS,
};

const clampTier = (t: number | undefined) =>
  Math.max(0, Math.min(5, Math.floor(Number.isFinite(t) ? (t as number) : 0)));

function build(id: IconId, tier: number): Grid {
  const eq = EQUIP[id];
  if (eq) return eq(tier);
  const other = OTHER[id];
  if (other) return other();
  if (id.startsWith('icon_gem_')) {
    const [, , type, q] = id.split('_');
    return gem(type as GemArtType, Number(q));
  }
  return new Grid(16, 16).rect(4, 4, 8, 8, '#ff00ff');
}

/** tier (0-5) tints equipment icons by material; ignored for other icons. */
export const getIcon: (id: IconId, tier?: number) => Canvas = memo(
  (id, tier) => `${id}|${EQUIP[id] ? clampTier(tier) : 0}`,
  (id, tier) => build(id, EQUIP[id] ? clampTier(tier) : 0).toCanvas(),
);

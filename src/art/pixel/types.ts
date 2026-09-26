/**
 * Shared type contracts for all procedural pixel art. The engine only talks to
 * the art modules through these IDs and the functions exported from ./index.ts.
 */

export type Dir = 'down' | 'up' | 'left' | 'right';

// ---------------------------------------------------------------- actors ----

/** Humanoid characters: drawn in 4 directions (left may be a mirrored right). */
export type CharacterId =
  | 'hero'
  | 'lyra'
  | 'elder'
  | 'blacksmith'
  | 'merchant'
  | 'innkeeper'
  | 'villager_man'
  | 'villager_woman'
  | 'child'
  | 'guard';

/** Regular enemies (side-view; 'dirs' reported by spriteInfo). */
export type CreatureId =
  | 'slime'
  | 'slime_crystal'
  | 'slime_magma'
  | 'wolf'
  | 'wolf_ice'
  | 'mushroom'
  | 'goblin'
  | 'bat'
  | 'skeleton'
  | 'golem'
  | 'golem_ice'
  | 'fire_imp'
  | 'salamander'
  | 'ember_wisp'
  | 'hollow_wisp'
  | 'yeti'
  | 'frost_wraith'
  | 'shadow_knight'
  | 'void_mage'
  | 'gargoyle'
  | 'sapling';

export type BossId =
  | 'boss_thornmaw'
  | 'boss_crystal_golem'
  | 'boss_ignis'
  | 'boss_seraphine'
  | 'boss_malachar'
  | 'boss_malachar_true';

export type ProjectileId =
  | 'proj_arrow'
  | 'proj_fireball'
  | 'proj_iceshard'
  | 'proj_magic'
  | 'proj_void'
  | 'proj_seed'
  | 'proj_rock'
  | 'proj_snowball'
  | 'proj_bolt'
  | 'proj_crystal';

export type FxId = 'fx_hit' | 'fx_explosion' | 'fx_smoke' | 'fx_sparkle' | 'fx_poof';

export type SpriteId = CharacterId | CreatureId | BossId | ProjectileId | FxId;

/**
 * Animation names. Not every sprite has every anim — spriteInfo().anims lists
 * what exists. Conventions:
 *  - idle:   2+ frames, looping breathing/bob
 *  - walk:   4 frames (humanoids) / move: 2-4 frames (creatures)
 *  - attack: 2 frames (0 = wind-up / anticipation, 1 = strike)
 *  - cast:   1-2 frames, arms raised (humanoids / casters)
 *  - hurt:   1 frame
 *  - roll:   4 frames (hero only; tumbling dodge)
 *  - special:2+ frames for bosses (e.g. charge, breath, slam)
 *  - fly:    projectiles/fx loop
 */
export type AnimName = 'idle' | 'walk' | 'move' | 'attack' | 'cast' | 'hurt' | 'roll' | 'special' | 'fly';

export interface AnimInfo {
  frames: number;
  /** Suggested playback speed in frames per second. */
  fps: number;
}

export interface SpriteInfo {
  /** Frame size in pixels. */
  w: number;
  h: number;
  /** Pixel inside the frame that sits on the entity's world position (usually feet, bottom-center). */
  anchorX: number;
  anchorY: number;
  /** 4 = distinct down/up/side art. 2 = side view only (engine passes left/right). 1 = no facing. */
  dirs: 1 | 2 | 4;
  anims: Partial<Record<AnimName, AnimInfo>>;
}

// --------------------------------------------------------------- weapons ----

export type WeaponKind = 'sword' | 'greatsword' | 'dagger' | 'staff';

export interface WeaponInfo {
  w: number;
  h: number;
  /** Grip point in the image; the weapon image points to the RIGHT (angle 0). */
  gripX: number;
  gripY: number;
}

// ----------------------------------------------------------- environment ----

export type Theme = 'town' | 'forest' | 'cave' | 'volcano' | 'tundra' | 'citadel' | 'abyss';

export type GroundKind = 'floor' | 'floorAlt' | 'path' | 'bridge';

export type PropId =
  // nature
  | 'tree_oak'
  | 'tree_pine'
  | 'tree_dead'
  | 'tree_snowpine'
  | 'bush'
  | 'flowers_red'
  | 'flowers_blue'
  | 'flowers_yellow'
  | 'grass_tuft'
  | 'mushroom_cluster'
  | 'log'
  | 'stump'
  | 'reeds'
  | 'rock_small'
  | 'rock_big'
  // cave
  | 'crystal_small'
  | 'crystal_big'
  | 'stalagmite'
  | 'bones'
  // volcano
  | 'lava_rock'
  | 'vent'
  | 'obsidian_spike'
  // tundra
  | 'ice_spike'
  | 'snow_rock'
  // citadel / abyss
  | 'pillar'
  | 'pillar_broken'
  | 'brazier'
  | 'banner'
  | 'void_crystal'
  // town
  | 'house_a'
  | 'house_b'
  | 'inn'
  | 'shop'
  | 'smithy'
  | 'elder_house'
  | 'quest_board'
  | 'fountain'
  | 'well'
  | 'fence_h'
  | 'fence_v'
  | 'lamp_post'
  | 'crate'
  | 'barrel'
  | 'market_stall'
  | 'hay_bale'
  | 'statue'
  // interactables
  | 'chest'
  | 'chest_rare'
  | 'waypoint'
  | 'save_crystal'
  | 'sign'
  | 'boss_gate'
  | 'portal'
  | 'torch_wall';

export interface PropInfo {
  w: number;
  h: number;
  /** Anchor (bottom-center of the footprint) in image pixels. */
  anchorX: number;
  anchorY: number;
  frames: number;
  fps: number;
  /**
   * Solid footprint relative to the anchor, in pixels (x/y offsets can be negative).
   * Omit for walk-through decoration.
   */
  collider?: { x: number; y: number; w: number; h: number };
  /** Optional light emitted (radius in px, CSS color). */
  light?: { radius: number; color: string };
}

// ----------------------------------------------------------------- icons ----

/** Gem icons: `icon_gem_<type>_<quality 0-7>`. */
export type GemIconId =
  `icon_gem_${'ruby' | 'emerald' | 'topaz' | 'amethyst' | 'diamond'}_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`;

export type IconId =
  | GemIconId
  // equipment (tinted by tier 0-5)
  | 'icon_sword'
  | 'icon_greatsword'
  | 'icon_dagger'
  | 'icon_staff'
  | 'icon_helm'
  | 'icon_armor'
  | 'icon_boots'
  | 'icon_ring'
  | 'icon_amulet'
  | 'icon_gloves'
  | 'icon_belt'
  | 'icon_charm_small'
  | 'icon_charm_large'
  | 'icon_charm_grand'
  // consumables & materials
  | 'icon_potion_hp'
  | 'icon_potion_mp'
  | 'icon_elixir'
  | 'icon_phoenix'
  | 'icon_dust'
  | 'icon_shard'
  | 'icon_key'
  | 'icon_gold'
  | 'icon_letter'
  | 'icon_herb'
  | 'icon_pelt'
  | 'icon_crystal'
  | 'icon_ember'
  | 'icon_frost'
  | 'icon_void'
  // skills
  | 'skill_slash'
  | 'skill_whirlwind'
  | 'skill_fireball'
  | 'skill_frostnova'
  | 'skill_heal'
  | 'skill_lightning'
  | 'skill_blades'
  | 'skill_meteor'
  | 'skill_surge'
  | 'passive_blade'
  | 'passive_arcane'
  | 'passive_guard'
  // ui
  | 'ui_heart'
  | 'ui_mana'
  | 'ui_coin'
  | 'ui_star'
  | 'ui_lock'
  | 'ui_check'
  | 'ui_quest'
  | 'ui_waypoint'
  | 'ui_skull'
  | 'ui_chest'
  | 'ui_save'
  | 'ui_sword'
  | 'ui_shield';

/**
 * The persistent game state (what goes into a save file) and pure helpers for
 * mutating it. No rendering or DOM access here.
 */
import type { SkillId } from '../data/skills';
import { SKILLS, SKILL_ORDER } from '../data/skills';
import { MAX_LEVEL, xpToNext } from './balance';
import { equipTargetFor } from './items';
import type { ConsumableId, Difficulty, EquipSlot, Item, MaterialId } from './types';

export const SAVE_VERSION = 2;

export interface QuestState {
  id: string;
  stage: number;
  progress: number;
  done: boolean;
  /** Tracked in the HUD. */
  tracked?: boolean;
}

export interface Bounty {
  id: string;
  enemy: string;
  count: number;
  progress: number;
  zone: string;
  gold: number;
  xp: number;
  dust: number;
}

export interface HeroState {
  name: string;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  gold: number;
  skillPoints: number;
  /** Skill ranks (0/undefined = locked). */
  skills: Partial<Record<SkillId, number>>;
  slots: (SkillId | null)[];
  passives: Record<string, number>;
  surge: number;
  surgeUnlocked: boolean;
  flaskHp: number;
  flaskMp: number;
  flaskUpgrades: number;
}

export interface SaveData {
  version: number;
  slot: number;
  createdAt: number;
  savedAt: number;
  playTime: number;
  difficulty: Difficulty;
  ngPlus: number;
  hero: HeroState;
  inventory: Item[];
  equipment: Record<EquipSlot, Item | null>;
  consumables: Partial<Record<ConsumableId, number>>;
  materials: Partial<Record<MaterialId, number>>;
  flags: Record<string, number>;
  quests: Record<string, QuestState>;
  bounties: Bounty[];
  location: { map: string; x: number; y: number };
  respawn: { map: string; x: number; y: number };
  discovered: string[];
  explored: Record<string, string>;
  bestiary: Record<string, number>;
  stats: {
    kills: number;
    deaths: number;
    bosses: number;
    goldEarned: number;
    itemsFound: number;
    legendaries: number;
    abyssBest: number;
    damageDealt: number;
  };
  droppedGold: { map: string; x: number; y: number; amount: number } | null;
  shop: { stock: Item[]; refreshedAt: number };
}

export const INVENTORY_SIZE = 60;
export const BASE_FLASK_HP = 4;
export const BASE_FLASK_MP = 3;

export function newGame(slot: number, name: string, difficulty: Difficulty): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    slot,
    createdAt: now,
    savedAt: now,
    playTime: 0,
    difficulty,
    ngPlus: 0,
    hero: {
      name,
      level: 1,
      xp: 0,
      hp: 100,
      mp: 40,
      gold: 30,
      skillPoints: 0,
      skills: { slash: 1 },
      slots: ['slash', null, null, null],
      passives: {},
      surge: 0,
      surgeUnlocked: false,
      flaskHp: BASE_FLASK_HP,
      flaskMp: BASE_FLASK_MP,
      flaskUpgrades: 0,
    },
    inventory: [],
    equipment: {
      weapon: null,
      helm: null,
      amulet: null,
      armor: null,
      gloves: null,
      belt: null,
      ring1: null,
      ring2: null,
      boots: null,
    },
    consumables: { elixir: 1 },
    materials: {},
    flags: {},
    quests: {},
    bounties: [],
    location: { map: 'town', x: -1, y: -1 },
    respawn: { map: 'town', x: -1, y: -1 },
    discovered: ['town_crystal'],
    explored: {},
    bestiary: {},
    stats: {
      kills: 0,
      deaths: 0,
      bosses: 0,
      goldEarned: 0,
      itemsFound: 0,
      legendaries: 0,
      abyssBest: 0,
      damageDealt: 0,
    },
    droppedGold: null,
    shop: { stock: [], refreshedAt: 0 },
  };
}

export const getFlag = (s: SaveData, f: string): number => s.flags[f] ?? 0;
export const hasFlag = (s: SaveData, f: string): boolean => (s.flags[f] ?? 0) > 0;
/** Has this zone guardian been fully defeated? (Malachar needs both of his forms.) */
export function bossCleared(s: SaveData, boss: string): boolean {
  if (boss === 'malachar') return hasFlag(s, 'boss_malachar_true');
  return hasFlag(s, `boss_${boss}`);
}

export function setFlag(s: SaveData, f: string, v = 1): void {
  s.flags[f] = v;
}

export interface LevelUpResult {
  levels: number;
  newSkills: SkillId[];
}

/** Grant XP; handles multiple level-ups, skill points and skill unlocks. */
export function grantXp(s: SaveData, amount: number): LevelUpResult {
  const h = s.hero;
  const result: LevelUpResult = { levels: 0, newSkills: [] };
  if (h.level >= MAX_LEVEL) return result;
  h.xp += Math.max(0, Math.round(amount));
  while (h.level < MAX_LEVEL && h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level);
    h.level++;
    h.skillPoints++;
    result.levels++;
    for (const id of SKILL_ORDER) {
      if (SKILLS[id].unlockLevel === h.level && !h.skills[id]) {
        h.skills[id] = 1;
        result.newSkills.push(id);
        const free = h.slots.indexOf(null);
        if (free >= 0) h.slots[free] = id;
      }
    }
  }
  if (h.level >= MAX_LEVEL) h.xp = 0;
  return result;
}

/** Skills unlocked by level that the hero is missing (e.g. after loading an old save). */
export function syncUnlockedSkills(s: SaveData): void {
  for (const id of SKILL_ORDER) {
    if (SKILLS[id].unlockLevel <= s.hero.level && !s.hero.skills[id]) s.hero.skills[id] = 1;
  }
}

export function addGold(s: SaveData, amount: number): void {
  s.hero.gold = Math.max(0, s.hero.gold + Math.round(amount));
  if (amount > 0) s.stats.goldEarned += Math.round(amount);
}

export function addMaterial(s: SaveData, id: MaterialId, n = 1): void {
  s.materials[id] = Math.max(0, (s.materials[id] ?? 0) + n);
}

export function addConsumable(s: SaveData, id: ConsumableId, n = 1): void {
  s.consumables[id] = Math.max(0, (s.consumables[id] ?? 0) + n);
}

export function inventoryFull(s: SaveData): boolean {
  return s.inventory.length >= INVENTORY_SIZE;
}

/** Add gear to the bag. Returns false if the bag is full. */
export function addItem(s: SaveData, item: Item): boolean {
  if (inventoryFull(s)) return false;
  s.inventory.push(item);
  s.stats.itemsFound++;
  if (item.rarity === 'legendary') s.stats.legendaries++;
  return true;
}

/** Equip an item from the bag; the previously equipped item goes back to the bag. */
export function equipItem(s: SaveData, uid: string, target?: EquipSlot): Item | null {
  const idx = s.inventory.findIndex((i) => i.uid === uid);
  if (idx < 0) return null;
  const item = s.inventory[idx];
  const slot = target ?? equipTargetFor(s, item);
  if (!slot) return null; // charms are never equipped
  const prev = s.equipment[slot];
  s.inventory.splice(idx, 1);
  item.isNew = false;
  s.equipment[slot] = item;
  if (prev) s.inventory.splice(idx, 0, prev);
  return prev;
}

export function unequip(s: SaveData, slot: EquipSlot): boolean {
  const it = s.equipment[slot];
  if (!it || inventoryFull(s)) return false;
  s.equipment[slot] = null;
  s.inventory.unshift(it);
  return true;
}

export function removeItem(s: SaveData, uid: string): Item | null {
  const idx = s.inventory.findIndex((i) => i.uid === uid);
  if (idx < 0) return null;
  return s.inventory.splice(idx, 1)[0];
}

/** Find an item anywhere (bag or equipped). */
export function findItem(s: SaveData, uid: string): Item | null {
  return (
    s.inventory.find((i) => i.uid === uid) ?? Object.values(s.equipment).find((i) => i?.uid === uid) ?? null
  );
}

// -------------------------------------------------------------- explored ----

/** Encode a 0/1 byte array as a compact base64 bitset. */
export function encodeBits(bits: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function decodeBits(str: string | undefined, length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (!str) return out;
  try {
    const bin = atob(str);
    for (let i = 0; i < length; i++) {
      const b = bin.charCodeAt(i >> 3);
      if (b & (1 << (i & 7))) out[i] = 1;
    }
  } catch {
    /* corrupt data: treat as unexplored */
  }
  return out;
}

/** Bring older saves up to the current version. */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<SaveData>;
  if (typeof s.version !== 'number' || !s.hero || !s.equipment) return null;
  // Fill any fields added after the save was written.
  const base = newGame(s.slot ?? 0, s.hero.name ?? 'Kai', s.difficulty ?? 'normal');
  const merged: SaveData = {
    ...base,
    ...s,
    hero: { ...base.hero, ...s.hero },
    stats: { ...base.stats, ...(s.stats ?? {}) },
    shop: s.shop ?? base.shop,
    version: SAVE_VERSION,
  } as SaveData;
  // v1 -> v2: a single `ring` slot became two ring fingers, plus gloves & belt
  const eq = { ...(s.equipment as unknown as Record<string, Item | null>) };
  if ('ring' in eq) {
    eq.ring1 = eq.ring1 ?? eq.ring;
    delete eq.ring;
  }
  merged.equipment = { ...base.equipment, ...eq } as Record<EquipSlot, Item | null>;
  syncUnlockedSkills(merged);
  return merged;
}

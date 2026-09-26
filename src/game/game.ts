/**
 * Game services hub: current save, settings, events, stat cache, rewards and
 * notifications. Scenes and world systems talk to each other through this.
 */
import type { IconId } from '../art/pixel/types';
import { audio } from '../audio';
import { SKILLS, type SkillId } from '../data/skills';
import type { App } from '../engine/app';
import { Emitter } from '../engine/events';
import { rng } from '../engine/rng';
import { effectiveDifficulty, MAX_LEVEL, type DifficultyMods, xpToNext } from './balance';
import { categoryForLevel, paragonXpToNext } from './paragon';
import { PARAGON_CATEGORY_INFO } from '../data/paragon';
import { displayName, generateItem, itemIcon, type GenerateOptions } from './items';
import { Achievements } from './achievements';
import { QuestSystem } from './quests';
import { SaveStore } from './saves';
import { loadSettings, saveSettings, type Settings } from './settings';
import { addGold, addItem, grantXp, type SaveData } from './state';
import { computeHeroStats, NO_BUFFS, type Buffs, type HeroStats } from './stats';
import type { Item } from './types';

export interface Toast {
  text: string;
  icon?: IconId;
  tier?: number;
  color?: string;
  t: number;
}

export interface GameEvents extends Record<string, unknown> {
  enemyKilled: { id: string; map: string; elite: boolean; boss: boolean };
  levelUp: { level: number; newSkills: SkillId[] };
  paragonUp: { level: number };
  itemLooted: { item: Item };
  questChanged: { id: string };
  flagChanged: { flag: string };
  materialsChanged: undefined;
  statsChanged: undefined;
  saved: undefined;
}

export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly saves = new SaveStore();
  readonly quests: QuestSystem;
  readonly achievements: Achievements;
  settings: Settings = loadSettings();
  private _save: SaveData | null = null;
  private statsCache: HeroStats | null = null;
  buffs: Buffs = { ...NO_BUFFS };
  private challengeT = 0;
  toasts: Toast[] = [];
  /** Recent dialogue for the backlog viewer. */
  backlog: { who?: string; text: string }[] = [];
  /** Big centered banner (level up, area discovered). */
  banner: { title: string; sub?: string; t: number; color?: string } | null = null;

  constructor(readonly app: App) {
    this.quests = new QuestSystem(this);
    this.achievements = new Achievements(this);
    this.applySettings();
  }

  get save(): SaveData {
    if (!this._save) throw new Error('No active save');
    return this._save;
  }

  get hasSave(): boolean {
    return this._save !== null;
  }

  setSave(s: SaveData | null): void {
    this._save = s;
    this.buffs = { ...NO_BUFFS };
    this.toasts = [];
    this.invalidateStats();
  }

  /** Current difficulty modifiers, including Torment. */
  get difficulty(): DifficultyMods {
    return effectiveDifficulty(this.save.difficulty, this.save.torment);
  }

  // ----------------------------------------------------------- settings ----
  applySettings(): void {
    const s = this.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
    this.app.input.setBindings(s.keys);
  }

  persistSettings(): void {
    saveSettings(this.settings);
    this.applySettings();
  }

  // --------------------------------------------------------------- stats ----
  stats(): HeroStats {
    if (!this.statsCache) this.statsCache = computeHeroStats(this.save, this.buffs);
    return this.statsCache;
  }

  invalidateStats(): void {
    this.statsCache = null;
    if (this._save) this.events.emit('statsChanged', undefined);
  }

  // -------------------------------------------------------------- saving ----
  saveNow(): boolean {
    if (!this._save) return false;
    const ok = this.saves.write(this._save);
    if (ok) this.events.emit('saved', undefined);
    return ok;
  }

  // ------------------------------------------------------------- rewards ----
  giveXp(amount: number): void {
    const s = this.save;
    const bonus = 1 + this.stats().xpBonus;
    const res = grantXp(s, amount * bonus);
    if (res.levels > 0) {
      this.invalidateStats();
      const st = this.stats();
      s.hero.hp = st.maxHp;
      s.hero.mp = st.maxMp;
      audio.playSfx('stinger_levelup');
      this.banner = {
        title: `LEVEL ${s.hero.level}`,
        sub: '+1 Skill Point • HP & MP restored',
        t: 0,
        color: '#feae34',
      };
      this.events.emit('levelUp', { level: s.hero.level, newSkills: res.newSkills });
      for (const sk of res.newSkills) this.toast(`New skill: {gold}${SKILLS[sk].name}{/}`, SKILLS[sk].icon);
    }
    if (res.paragonLevels > 0) {
      const p = s.hero.paragon;
      const cat = PARAGON_CATEGORY_INFO[categoryForLevel(p.level)];
      audio.playSfx('stinger_levelup');
      this.banner = {
        title: `PARAGON ${p.level}`,
        sub: res.paragonLevels > 1 ? `+${res.paragonLevels} Paragon points` : `+1 ${cat.name} point`,
        t: 0,
        color: '#2ce8f5',
      };
      this.events.emit('paragonUp', { level: p.level });
    }
  }

  xpProgress(): number {
    const h = this.save.hero;
    if (h.level >= MAX_LEVEL) return h.paragon.xp / paragonXpToNext(h.paragon.level);
    const need = xpToNext(h.level);
    return Number.isFinite(need) ? h.xp / need : 1;
  }

  giveGold(amount: number, silent = false): void {
    addGold(this.save, amount);
    if (!silent) this.toast(`+${Math.round(amount)} gold`, 'ui_coin');
  }

  /** Put an item in the bag, or toast that the bag is full. Returns success. */
  giveItem(item: Item, silent = false): boolean {
    if (!addItem(this.save, item)) {
      this.toast(
        `Inventory full! Press ${this.app.input.label('townPortal')} for a Town Portal to go sell.`,
        'ui_portal',
        undefined,
        '#e43b44',
      );
      return false;
    }
    if (!silent) {
      const icon = itemIcon(item);
      this.toast(`{${item.rarity}}${displayName(item)}{/}`, icon, item.tier);
    }
    if (item.rarity === 'legendary' || item.rarity === 'abyssal') audio.playSfx('stinger_legendary');
    this.events.emit('itemLooted', { item });
    return true;
  }

  rollItem(ilvl: number, opts: GenerateOptions = {}): Item {
    const mf = this.stats().magicFind + this.difficulty.lootBonus;
    return generateItem(rng, ilvl, { ...opts, rarityRoll: { magicFind: mf, ...(opts.rarityRoll ?? {}) } });
  }

  logLine(who: string | undefined, text: string): void {
    this.backlog.push({ who, text });
    if (this.backlog.length > 80) this.backlog.shift();
  }

  toast(text: string, icon?: IconId, tier?: number, color?: string): void {
    this.toasts.push({ text, icon, tier, color, t: 0 });
    if (this.toasts.length > 6) this.toasts.shift();
  }

  // ---------------------------------------------------------------- time ----
  /** Increment a numeric counter stored in save flags. */
  count(flag: string, n = 1): void {
    this.save.flags[flag] = (this.save.flags[flag] ?? 0) + n;
  }

  tick(dt: number): void {
    if (!this._save) return;
    this.achievements.update(dt);
    this.save.playTime += dt;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 4);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 3.2) this.banner = null;
    }
    this.challengeT -= dt;
    if (this.challengeT <= 0) {
      this.challengeT = 2;
      this.quests.checkChallenges();
    }
    let changed = false;
    for (const k of ['might', 'guard', 'fortune', 'rite'] as const) {
      if (this.buffs[k] <= 0) continue;
      this.buffs[k] -= dt;
      if (this.buffs[k] <= 0) changed = true;
    }
    if (changed) this.invalidateStats();
  }
}

/** Global achievements (shared across save slots), checked periodically during play. */
import { audio } from '../audio';
import type { Game } from './game';
import { hasFlag } from './state';
import { EQUIP_SLOTS } from './types';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** Hidden until unlocked (spoilers). */
  secret?: boolean;
  check: (g: Game) => boolean;
}

const s = (g: Game) => g.save;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    desc: 'Defeat your first monster.',
    check: (g) => s(g).stats.kills >= 1,
  },
  {
    id: 'slayer_100',
    name: 'Monster Slayer',
    desc: 'Defeat 100 monsters.',
    check: (g) => s(g).stats.kills >= 100,
  },
  {
    id: 'slayer_1000',
    name: 'Legend of the Wilds',
    desc: 'Defeat 1,000 monsters.',
    check: (g) => s(g).stats.kills >= 1000,
  },
  {
    id: 'elite_25',
    name: 'Champion Hunter',
    desc: 'Defeat 25 elite monsters.',
    check: (g) => (s(g).flags['elites'] ?? 0) >= 25,
  },
  {
    id: 'perfect_10',
    name: 'Untouchable',
    desc: 'Perform 10 perfect dodges.',
    check: (g) => (s(g).flags['perfects'] ?? 0) >= 10,
  },
  {
    id: 'surge_10',
    name: 'Aether Overflow',
    desc: 'Unleash Aether Surge 10 times.',
    check: (g) => (s(g).flags['surges'] ?? 0) >= 10,
  },
  {
    id: 'boss_1',
    name: 'Shardbearer',
    desc: 'Defeat Thornmaw.',
    check: (g) => hasFlag(s(g), 'boss_thornmaw'),
  },
  {
    id: 'boss_2',
    name: 'Crystal Clear',
    desc: 'Defeat the Crystal Colossus.',
    check: (g) => hasFlag(s(g), 'boss_crystal_golem'),
  },
  { id: 'boss_3', name: 'Dragonslayer', desc: 'Defeat Ignis.', check: (g) => hasFlag(s(g), 'boss_ignis') },
  {
    id: 'boss_4',
    name: "Winter's End",
    desc: 'Free Seraphine from the cold.',
    secret: true,
    check: (g) => hasFlag(s(g), 'boss_seraphine'),
  },
  {
    id: 'boss_5',
    name: 'Dawnbringer',
    desc: 'Defeat Malachar and restore the sky.',
    secret: true,
    check: (g) => hasFlag(s(g), 'game_clear'),
  },
  {
    id: 'nightmare',
    name: 'Stuff of Nightmares',
    desc: 'Defeat any guardian on Nightmare difficulty.',
    check: (g) => (s(g).flags['nightmare_boss'] ?? 0) > 0,
  },
  {
    id: 'legendary_1',
    name: 'Legendary!',
    desc: 'Find a legendary item.',
    check: (g) => s(g).stats.legendaries >= 1,
  },
  {
    id: 'legendary_5',
    name: 'Hoarder of Legends',
    desc: 'Find 5 legendary items.',
    check: (g) => s(g).stats.legendaries >= 5,
  },
  {
    id: 'upgrade_10',
    name: 'Masterwork',
    desc: 'Upgrade an item to +10 at the forge.',
    check: (g) =>
      EQUIP_SLOTS.some((sl) => (s(g).equipment[sl]?.upgrade ?? 0) >= 10) ||
      s(g).inventory.some((i) => i.upgrade >= 10),
  },
  {
    id: 'rich',
    name: 'Filthy Rich',
    desc: 'Hold 10,000 gold at once.',
    check: (g) => s(g).hero.gold >= 10000,
  },
  { id: 'level_20', name: 'Seasoned', desc: 'Reach level 20.', check: (g) => s(g).hero.level >= 20 },
  { id: 'level_40', name: 'Veteran', desc: 'Reach level 40.', check: (g) => s(g).hero.level >= 40 },
  {
    id: 'bounty_10',
    name: 'Bounty Hunter',
    desc: 'Complete 10 bounties.',
    check: (g) => (s(g).flags['bounties_done'] ?? 0) >= 10,
  },
  {
    id: 'abyss_10',
    name: 'Into the Deep',
    desc: 'Clear floor 10 of the Abyss.',
    secret: true,
    check: (g) => s(g).stats.abyssBest >= 10,
  },
  {
    id: 'abyss_25',
    name: 'Abyss Walker',
    desc: 'Clear floor 25 of the Abyss.',
    secret: true,
    check: (g) => s(g).stats.abyssBest >= 25,
  },
  {
    id: 'abyssal_1',
    name: 'Forged in the Dark',
    desc: 'Find an Abyssal item.',
    secret: true,
    check: (g) => s(g).stats.abyssals >= 1,
  },
  {
    id: 'gem_royal',
    name: 'Crown Jewel',
    desc: 'Combine a Royal gem.',
    secret: true,
    check: (g) => hasFlag(s(g), 'gem_royal'),
  },
  {
    id: 'ascended',
    name: 'Ascended',
    desc: 'Complete a Trial of Ascension and choose an Ascendancy.',
    check: (g) => !!s(g).ascendancy.cls,
  },
  {
    id: 'trials_all',
    name: 'Trial Master',
    desc: 'Complete all four Trials of Ascension.',
    secret: true,
    check: (g) => s(g).ascendancy.trials >= 4,
  },
  {
    id: 'paragon_50',
    name: 'Paragon of Havenbrook',
    desc: 'Reach Paragon level 50.',
    secret: true,
    check: (g) => s(g).hero.paragon.level >= 50,
  },
  {
    id: 'challenges_all',
    name: 'Challenger',
    desc: 'Complete all four challenges and learn their skills.',
    secret: true,
    check: (g) =>
      ['shadowstep', 'earthshatter', 'blizzard', 'bloodrite'].every(
        (k) => (s(g).hero.skills as Record<string, number>)[k],
      ),
  },
  {
    id: 'torment_6',
    name: 'Into Torment',
    desc: 'Defeat a guardian on Torment VI.',
    secret: true,
    check: (g) => hasFlag(s(g), 'torment6_boss'),
  },
  {
    id: 'world_boss_1',
    name: 'Giant Slayer',
    desc: 'Defeat a world boss.',
    check: (g) => s(g).stats.worldBosses >= 1,
  },
  {
    id: 'world_boss_10',
    name: 'World Ender',
    desc: 'Defeat 10 world bosses.',
    secret: true,
    check: (g) => s(g).stats.worldBosses >= 10,
  },
  {
    id: 'ngplus',
    name: 'Once More, With Feeling',
    desc: 'Begin New Game+.',
    secret: true,
    check: (g) => s(g).ngPlus >= 1,
  },
];

const KEY = 'aetherfall.achievements';

export class Achievements {
  private unlocked: Set<string>;
  private t = 0;

  constructor(private game: Game) {
    this.unlocked = new Set(Achievements.load());
  }

  static load(): string[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  }

  has(id: string): boolean {
    return this.unlocked.has(id);
  }

  get count(): number {
    return this.unlocked.size;
  }

  /** Call every frame; actually checks about twice per second. */
  update(dt: number): void {
    this.t -= dt;
    if (this.t > 0 || !this.game.hasSave) return;
    this.t = 0.5;
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked.has(a.id) || !a.check(this.game)) continue;
      this.unlocked.add(a.id);
      changed = true;
      audio.playSfx('stinger_legendary', { volume: 0.6 });
      this.game.toast(`Achievement: {gold}${a.name}{/}`, 'ui_star', 0);
    }
    if (changed) {
      try {
        localStorage.setItem(KEY, JSON.stringify([...this.unlocked]));
      } catch {
        /* storage unavailable */
      }
    }
  }
}

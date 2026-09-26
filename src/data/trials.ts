/**
 * Trials of Ascension: wave-survival challenges at the Statue of the First Hero.
 * Each grants Ascendancy points the first time it's completed, and each has a twist.
 */
export interface TrialDef {
  tier: number;
  name: string;
  /** Flag needed before the statue offers this trial. */
  requires: string;
  requiresText: string;
  /** Minimum enemy level (trials scale up to your level if you're higher). */
  level: number;
  waves: number;
  affliction: { name: string; desc: string } | null;
}

export const TRIALS: readonly TrialDef[] = [
  {
    tier: 1,
    name: 'Trial of Steel',
    requires: 'boss_crystal_golem',
    requiresText: 'Defeat the guardian of the Crystal Caverns.',
    level: 16,
    waves: 4,
    affliction: null,
  },
  {
    tier: 2,
    name: 'Trial of Swiftness',
    requires: 'boss_ignis',
    requiresText: 'Defeat the guardian of Emberpeak.',
    level: 26,
    waves: 4,
    affliction: { name: 'Haste', desc: 'Enemies move 25% faster.' },
  },
  {
    tier: 3,
    name: 'Trial of Flame',
    requires: 'boss_seraphine',
    requiresText: 'Defeat the guardian of Frostveil.',
    level: 36,
    waves: 5,
    affliction: { name: 'Scorched Earth', desc: 'Fire rains down around you throughout the trial.' },
  },
  {
    tier: 4,
    name: 'Trial of Resolve',
    requires: 'game_clear',
    requiresText: 'Restore the sky (finish the story).',
    level: 50,
    waves: 5,
    affliction: { name: 'No Respite', desc: 'Flasks cannot be used during the trial.' },
  },
];

export const trialMapId = (tier: number): string => `trial_${tier}`;

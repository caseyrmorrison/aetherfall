/** Dialogue script primitives used by NPCs, quests and cutscenes. */
import type { Expression, PortraitId } from '../art/anime';

export interface Line {
  who?: string;
  portrait?: PortraitId;
  expr?: Expression;
  text: string;
}

export interface Choice {
  label: string;
  then?: Step[];
  action?: () => void;
}

export type Step = Line | { choices: Choice[] } | { run: () => void };

export const isLine = (s: Step): s is Line => 'text' in s;
export const isChoice = (s: Step): s is { choices: Choice[] } => 'choices' in s;

const SPEAKERS: Record<string, { name: string; portrait?: PortraitId }> = {
  kai: { name: '', portrait: 'kai' },
  lyra: { name: 'Lyra', portrait: 'lyra' },
  maren: { name: 'Elder Maren', portrait: 'maren' },
  brom: { name: 'Brom', portrait: 'brom' },
  mira: { name: 'Mira', portrait: 'mira' },
  seraphine: { name: 'Seraphine', portrait: 'seraphine' },
  malachar: { name: 'Malachar', portrait: 'malachar' },
  tessaly: { name: 'Tessaly', portrait: 'tessaly' },
  aurelian: { name: 'Aurelian', portrait: 'aurelian' },
  nereth: { name: 'Nereth' },
};

/**
 * Parse a compact line like "maren|sad: Kai, you're awake!" into a Line.
 * Without a prefix the default speaker is used. The hero's name is substituted for "kai".
 */
export function parseLine(raw: string, heroName: string, def?: { who: string; portrait?: PortraitId }): Line {
  const m = /^([a-z]+)(?:\|([a-z]+))?:\s(.*)$/s.exec(raw);
  if (m && SPEAKERS[m[1]]) {
    const sp = SPEAKERS[m[1]];
    return {
      who: m[1] === 'kai' ? heroName : sp.name,
      portrait: sp.portrait,
      expr: (m[2] as Expression | undefined) ?? 'neutral',
      text: m[3].replace(/\{hero\}/g, heroName),
    };
  }
  return {
    who: def?.who,
    portrait: def?.portrait,
    expr: 'neutral',
    text: raw.replace(/\{hero\}/g, heroName),
  };
}

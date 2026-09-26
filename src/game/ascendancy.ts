/** Ascendancy progress: chosen class, trials completed and notables taken. */
import {
  ASC_NODE_BY_ID,
  ASC_NODE_COST,
  ASC_POINTS_PER_TRIAL,
  type AscClass,
  type AscNodeDef,
} from '../data/ascendancy';

export interface AscendancyState {
  cls: AscClass | null;
  /** Trials of Ascension completed (each grants points once). */
  trials: number;
  nodes: string[];
}

export const newAscendancy = (): AscendancyState => ({ cls: null, trials: 0, nodes: [] });

export const ascPoints = (a: AscendancyState): number => a.trials * ASC_POINTS_PER_TRIAL;
export const ascUnspent = (a: AscendancyState): number => ascPoints(a) - a.nodes.length * ASC_NODE_COST;

/** Why a notable can't be taken, or null if it can. */
export function ascBlocker(a: AscendancyState, node: AscNodeDef): string | null {
  if (!a.cls) return 'Choose an Ascendancy first.';
  if (node.cls !== a.cls) return 'That notable belongs to another Ascendancy.';
  if (a.nodes.includes(node.id)) return 'Already learned.';
  if (node.requires && !node.requires.some((r) => a.nodes.includes(r)))
    return `Requires ${node.requires.map((r) => ASC_NODE_BY_ID[r].name).join(' or ')}.`;
  if (ascUnspent(a) < ASC_NODE_COST) return 'Complete more Trials of Ascension to earn points.';
  return null;
}

export function takeAscNode(a: AscendancyState, id: string): string | null {
  const node = ASC_NODE_BY_ID[id];
  if (!node) return 'Unknown notable.';
  const why = ascBlocker(a, node);
  if (!why) a.nodes.push(id);
  return why;
}

/** Gold to reset notables (and optionally change class) at the Statue of the First Hero. */
export const ascRespecCost = (level: number): number => 500 + level * 60;

export function resetAscendancy(a: AscendancyState, keepClass: boolean): void {
  a.nodes = [];
  if (!keepClass) a.cls = null;
}

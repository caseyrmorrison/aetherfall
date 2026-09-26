/**
 * The shared stash: one chest for every save slot (like Diablo's), stored in its own
 * localStorage key next to the settings and achievements.
 */
import { FREE_STASH_TABS, STASH_TAB_SIZE } from './balance';
import type { Item } from './types';

const KEY = 'aetherfall.stash';

export interface SharedStash {
  version: 1;
  tabs: Item[][];
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;

export const newStash = (): SharedStash => ({
  version: 1,
  tabs: Array.from({ length: FREE_STASH_TABS }, () => []),
});

export class StashStore {
  constructor(private storage: KV | null = typeof localStorage === 'undefined' ? null : localStorage) {}

  load(): SharedStash {
    try {
      const raw = this.storage?.getItem(KEY);
      const data = raw ? (JSON.parse(raw) as Partial<SharedStash>) : null;
      if (!data || !Array.isArray(data.tabs)) return newStash();
      const tabs = data.tabs.filter(Array.isArray);
      while (tabs.length < FREE_STASH_TABS) tabs.push([]);
      return { version: 1, tabs };
    } catch {
      return newStash();
    }
  }

  write(stash: SharedStash): boolean {
    try {
      this.storage?.setItem(KEY, JSON.stringify(stash));
      return !!this.storage;
    } catch {
      return false;
    }
  }
}

/**
 * Move a save's old per-slot stash (saves from before the stash was shared) into the
 * shared one. Its tabs count as owned; items fill free space, and extra tabs are added
 * if it ever runs out. Returns how many items moved.
 */
export function absorbLegacyStash(shared: SharedStash, legacy: { tabs: Item[][] } | undefined): number {
  if (!legacy?.tabs?.length) return 0;
  while (shared.tabs.length < legacy.tabs.length) shared.tabs.push([]);
  let moved = 0;
  for (const it of legacy.tabs.flat()) {
    let tab = shared.tabs.find((t) => t.length < STASH_TAB_SIZE);
    if (!tab) shared.tabs.push((tab = []));
    tab.push(it);
    moved++;
  }
  legacy.tabs = [];
  return moved;
}

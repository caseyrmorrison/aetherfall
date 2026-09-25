/** Save-slot persistence (localStorage) with validation, migration and export/import. */
import { migrate, type SaveData } from './state';

export const SLOT_COUNT = 3;
const key = (slot: number): string => `aetherfall.save.${slot}`;

export interface SlotSummary {
  slot: number;
  name: string;
  level: number;
  location: string;
  playTime: number;
  savedAt: number;
  difficulty: string;
  ngPlus: number;
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class SaveStore {
  constructor(private storage: KV = localStorage) {}

  load(slot: number): SaveData | null {
    try {
      const raw = this.storage.getItem(key(slot));
      if (!raw) return null;
      const data = migrate(JSON.parse(raw));
      if (data) data.slot = slot;
      return data;
    } catch {
      return null;
    }
  }

  write(data: SaveData): boolean {
    try {
      data.savedAt = Date.now();
      this.storage.setItem(key(data.slot), JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  delete(slot: number): void {
    this.storage.removeItem(key(slot));
  }

  summaries(locationName: (map: string) => string): (SlotSummary | null)[] {
    const out: (SlotSummary | null)[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const d = this.load(i);
      out.push(
        d
          ? {
              slot: i,
              name: d.hero.name,
              level: d.hero.level,
              location: locationName(d.location.map),
              playTime: d.playTime,
              savedAt: d.savedAt,
              difficulty: d.difficulty,
              ngPlus: d.ngPlus,
            }
          : null,
      );
    }
    return out;
  }

  /** Slot with the newest save, or -1. */
  mostRecent(): number {
    let best = -1;
    let bestT = -1;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const d = this.load(i);
      if (d && d.savedAt > bestT) {
        bestT = d.savedAt;
        best = i;
      }
    }
    return best;
  }

  firstEmpty(): number {
    for (let i = 0; i < SLOT_COUNT; i++) if (!this.storage.getItem(key(i))) return i;
    return -1;
  }

  exportString(slot: number): string | null {
    return this.storage.getItem(key(slot));
  }

  /** Import a save JSON string into a slot. Returns false if invalid. */
  importString(slot: number, json: string): boolean {
    try {
      const data = migrate(JSON.parse(json));
      if (!data) return false;
      data.slot = slot;
      return this.write(data);
    } catch {
      return false;
    }
  }
}

export function formatPlayTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

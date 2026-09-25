/** Player preferences persisted separately from save slots. */
import type { KeyBindings } from '../engine/input';
import type { Difficulty } from './types';

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  textSpeed: TextSpeed;
  autoAdvance: boolean;
  screenShake: number;
  damageNumbers: boolean;
  enemyHealthBars: boolean;
  autoLoot: boolean;
  showFps: boolean;
  reduceFlashing: boolean;
  touchControls: 'auto' | 'on' | 'off';
  aimAssist: boolean;
  keys: Partial<KeyBindings>;
  /** Default difficulty for new games. */
  difficulty: Difficulty;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  textSpeed: 'normal',
  autoAdvance: false,
  screenShake: 1,
  damageNumbers: true,
  enemyHealthBars: true,
  autoLoot: true,
  showFps: false,
  reduceFlashing: false,
  touchControls: 'auto',
  aimAssist: true,
  keys: {},
  difficulty: 'normal',
};

export const TEXT_SPEED_CPS: Record<TextSpeed, number> = {
  slow: 28,
  normal: 55,
  fast: 110,
  instant: 100000,
};

const KEY = 'aetherfall.settings';

export function loadSettings(storage: Pick<Storage, 'getItem'> = localStorage): Settings {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or unavailable (private mode) — settings just won't persist */
  }
}

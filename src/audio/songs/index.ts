/** Song registry. */
import type { MusicId } from '../index';
import type { SongDef } from '../notation';
import { boss, final_boss } from './battle';
import { abyss, cave, citadel, forest, tundra, volcano } from './exploration';
import {
  credits,
  cutscene_calm,
  cutscene_epic,
  cutscene_sad,
  cutscene_tense,
  gameover,
  title,
  town,
  victory,
} from './story';

export const SONGS: Record<MusicId, SongDef> = {
  title,
  town,
  forest,
  cave,
  volcano,
  tundra,
  citadel,
  abyss,
  boss,
  final_boss,
  cutscene_calm,
  cutscene_sad,
  cutscene_tense,
  cutscene_epic,
  victory,
  gameover,
  credits,
};

export const MUSIC_IDS = Object.keys(SONGS) as MusicId[];

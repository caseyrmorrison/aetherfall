/** Song registry. */
import type { MusicId } from '../index';
import type { SongDef } from '../notation';
import { boss, final_boss, final_boss2 } from './battle';
import { abyss, cave, citadel, desert, eclipse, forest, ruins, storm, tundra, volcano } from './exploration';
import {
  credits,
  cutscene_calm,
  cutscene_epic,
  cutscene_sad,
  cutscene_tense,
  gameover,
  solenne,
  title,
  town,
  victory,
} from './story';

export const SONGS: Record<MusicId, SongDef> = {
  title,
  town,
  solenne,
  forest,
  cave,
  volcano,
  tundra,
  citadel,
  abyss,
  desert,
  ruins,
  storm,
  eclipse,
  boss,
  final_boss,
  final_boss2,
  cutscene_calm,
  cutscene_sad,
  cutscene_tense,
  cutscene_epic,
  victory,
  gameover,
  credits,
};

export const MUSIC_IDS = Object.keys(SONGS) as MusicId[];

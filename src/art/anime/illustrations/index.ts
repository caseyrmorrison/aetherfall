/** Illustration registry. */
import { drawTitle } from './title';
import { drawSkyShatter } from './skyShatter';
import { drawKaiAwakens } from './kaiAwakens';
import { drawShardFusion } from './shardFusion';
import { drawLyraArrives } from './lyraArrives';
import { drawMalacharReveal } from './malacharReveal';
import { drawSeraphineMemory } from './seraphineMemory';
import { drawFinalClash } from './finalClash';
import { drawEndingDawn } from './endingDawn';
import { drawKaiPowerup, drawMalacharPowerup } from './powerup';
import { drawBeamClash } from './beamClash';
import { drawRushExchange } from './rushExchange';
import { drawKaiKneeling } from './kaiKneeling';
import { drawSolenneArrival } from './solenneArrival';
import { drawAurelianReveal } from './aurelianReveal';
import { drawEclipseEnding } from './eclipseEnding';

export type IllusFn = (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void;

export const ILLUS: Record<string, IllusFn> = {
  title: drawTitle,
  sky_shatter: drawSkyShatter,
  kai_awakens: drawKaiAwakens,
  shard_fusion: drawShardFusion,
  lyra_arrives: drawLyraArrives,
  malachar_reveal: drawMalacharReveal,
  seraphine_memory: drawSeraphineMemory,
  final_clash: drawFinalClash,
  ending_dawn: drawEndingDawn,
  kai_powerup: drawKaiPowerup,
  malachar_powerup: drawMalacharPowerup,
  beam_clash: drawBeamClash,
  rush_exchange: drawRushExchange,
  kai_kneeling: drawKaiKneeling,
  solenne_arrival: drawSolenneArrival,
  aurelian_reveal: drawAurelianReveal,
  eclipse_ending: drawEclipseEnding,
};

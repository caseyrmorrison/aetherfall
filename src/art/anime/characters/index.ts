import type { Spec } from '../face';
import { aurelian } from './aurelian';
import { brom } from './brom';
import { kai } from './kai';
import { lyra } from './lyra';
import { malachar } from './malachar';
import { maren } from './maren';
import { mira } from './mira';
import { seraphine } from './seraphine';
import { tessaly } from './tessaly';

export type PortraitId =
  'kai' | 'lyra' | 'maren' | 'brom' | 'mira' | 'seraphine' | 'malachar' | 'aurelian' | 'tessaly';

export const SPECS: Record<PortraitId, Spec> = {
  kai,
  lyra,
  maren,
  brom,
  mira,
  seraphine,
  malachar,
  aurelian,
  tessaly,
};

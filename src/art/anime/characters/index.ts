import type { Spec } from '../face';
import { brom } from './brom';
import { kai } from './kai';
import { lyra } from './lyra';
import { malachar } from './malachar';
import { maren } from './maren';
import { mira } from './mira';
import { seraphine } from './seraphine';

export type PortraitId = 'kai' | 'lyra' | 'maren' | 'brom' | 'mira' | 'seraphine' | 'malachar';

export const SPECS: Record<PortraitId, Spec> = { kai, lyra, maren, brom, mira, seraphine, malachar };

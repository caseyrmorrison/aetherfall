/**
 * Environment art: ground tiles, liquids, walls and props. Everything is
 * generated procedurally on first use and cached.
 *
 * Conventions for the engine:
 *  - Tiles are 16x16. Ground variants 0-3 tile seamlessly in any combination.
 *  - Liquids: mask bits 1=N, 2=E, 4=S, 8=W are set when that neighbour is ALSO liquid
 *    (count bridge cells as liquid). Shores are drawn inside the liquid cell. 4-frame loop.
 *  - Walls: face=true when the cell below is walkable. The top ~4px of a face continue the
 *    cap material so cap-over-face reads as one block.
 *  - Props: drawn at (x - anchorX, y - anchorY); anchor = bottom-centre of the footprint.
 *    Wall-mounted props (torch_wall, banner) are 16px wide and designed to be anchored at the
 *    bottom-centre of the wall-face tile they hang on.
 */
import { memo, type Canvas } from './core';
import type { GroundKind, PropId, PropInfo, Theme } from './types';
import { buildGround } from './env/ground';
import { buildLiquid } from './env/liquid';
import { buildWall } from './env/walls';
import { Grid } from './env/raster';
import type { PropDef, PropTable } from './env/kit';
import { NATURE } from './env/props-nature';
import { DUNGEON } from './env/props-dungeon';
import { TOWN } from './env/props-town';
import { INTERACT } from './env/props-interact';
import { ACT2 } from './env/props-act2';

export const TILE = 16;

const wrap = (v: number, n: number) => ((Math.floor(v) % n) + n) % n;

export const getGroundTile: (theme: Theme, kind: GroundKind, variant: number) => Canvas = memo(
  (t, k, v) => `${t}|${k}|${wrap(v, 4)}`,
  (theme, kind, variant) => buildGround(theme, kind, wrap(variant, 4)).toCanvas(),
);

/** mask bits: 1 = north neighbour is liquid, 2 = east, 4 = south, 8 = west. */
export const getLiquidTile: (theme: Theme, mask: number, frame: number) => Canvas = memo(
  (t, m, f) => `${t}|${m & 15}|${wrap(f, 4)}`,
  (theme, mask, frame) => buildLiquid(theme, mask & 15, wrap(frame, 4)).toCanvas(),
);

/** face = true when the tile below is walkable (draw the wall's front face), false for the top/cap. */
export const getWallTile: (theme: Theme, face: boolean, variant: number) => Canvas = memo(
  (t, f, v) => `${t}|${f ? 1 : 0}|${wrap(v, 4)}`,
  (theme, face, variant) => buildWall(theme, face, wrap(variant, 4)).toCanvas(),
);

// ------------------------------------------------------------------ props ---

const PROPS: PropTable = { ...NATURE, ...DUNGEON, ...TOWN, ...INTERACT, ...ACT2 };

const FALLBACK: PropDef = {
  info: { w: 16, h: 16, anchorX: 8, anchorY: 15, frames: 1, fps: 0 },
  draw: () => new Grid(16, 16).rect(4, 4, 8, 8, '#ff00ff'),
};

function propDef(id: PropId): PropDef {
  return PROPS[id] ?? FALLBACK;
}

export function propInfo(id: PropId): PropInfo {
  return propDef(id).info;
}

export const getProp: (id: PropId, frame: number) => Canvas = memo(
  (id, f) => `${id}|${wrap(f, propDef(id).info.frames)}`,
  (id, frame) => {
    const d = propDef(id);
    return d.draw(wrap(frame, d.info.frames)).toCanvas();
  },
);

/** Every prop id that has real art (handy for tools / previews). */
export const PROP_IDS = Object.keys(PROPS) as PropId[];

/** Cached bust portraits. */
import { Raster } from './raster';
import { renderBust, type BustOpts, type Expression, type Spec } from './face';
import { SPECS, type PortraitId } from './characters';

export interface PortraitOptions {
  talking?: boolean;
  blink?: boolean;
  flip?: boolean;
}

const cache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 400;

/**
 * Design-space → rect fit used by portraits. Near-square rects (dialogue box)
 * get a tight head crop; tall rects get the full bust resting on the bottom edge.
 */
export function portraitTransform(r: Raster, w: number, h: number, flip = false): void {
  const tight = h / w < 1.2;
  const s = tight ? Math.min(w / 78, h / 86) : Math.min(w / 100, h / 116);
  const cx = 51;
  const ox = w / 2 - cx * s;
  const oy = tight ? 0 : Math.max(0, h - 120 * s);
  if (flip) r.setTransform(s, w - ox, oy, 0, true);
  else r.setTransform(s, ox, oy);
}

export function renderPortrait(
  spec: Spec,
  expr: Expression,
  w: number,
  h: number,
  o: BustOpts & { flip?: boolean } = {},
): HTMLCanvasElement {
  const r = new Raster(w, h);
  portraitTransform(r, w, h, o.flip);
  renderBust(r, spec, expr, o);
  return r.toCanvas();
}

export function getPortrait(
  id: PortraitId,
  expr: Expression,
  w: number,
  h: number,
  opts: PortraitOptions = {},
): HTMLCanvasElement {
  w = Math.max(8, Math.round(w));
  h = Math.max(8, Math.round(h));
  const key = `${id}|${expr}|${opts.talking ? 1 : 0}${opts.blink ? 1 : 0}${opts.flip ? 1 : 0}|${w}x${h}`;
  let c = cache.get(key);
  if (!c) {
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
    const spec = SPECS[id] ?? SPECS.kai;
    c = renderPortrait(spec, expr, w, h, { talking: opts.talking, blink: opts.blink, flip: opts.flip });
    cache.set(key, c);
  }
  return c;
}

export function clearPortraitCache(): void {
  cache.clear();
}

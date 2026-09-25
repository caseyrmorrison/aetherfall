/**
 * Map rendering: static ground/walls are baked into cached chunks; liquids animate
 * per frame; tall props & trees are emitted as y-sorted drawables; lighting is a
 * darkness layer with light "stamps" punched out of it.
 */
import { getGroundTile, getLiquidTile, getProp, getWallTile, hash2, propInfo } from '../art/pixel';
import type { GroundKind, PropId, Theme } from '../art/pixel/types';
import { DYNAMIC_PROPS } from './entities/objects';
import { CELL, GROUND, TILE, type MapData, type PropPlacement } from './mapdata';

const CHUNK = 16;
const FLAT_PROPS: ReadonlySet<PropId> = new Set<PropId>([
  'flowers_red',
  'flowers_blue',
  'flowers_yellow',
  'grass_tuft',
  'mushroom_cluster',
  'bones',
  'reeds',
  'crystal_small',
]);

export interface Drawable {
  y: number;
  draw: (ctx: CanvasRenderingContext2D, camX: number, camY: number) => void;
}

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: string;
  flicker?: number;
}

const TREE_FOR: Record<Theme, PropId[]> = {
  town: ['tree_oak', 'tree_oak', 'tree_pine'],
  forest: ['tree_oak', 'tree_oak', 'tree_pine'],
  cave: ['stalagmite'],
  volcano: ['tree_dead', 'obsidian_spike'],
  tundra: ['tree_snowpine', 'tree_snowpine', 'ice_spike'],
  citadel: ['pillar'],
  abyss: ['void_crystal'],
};

export const BG_COLOR: Record<Theme, string> = {
  town: '#265c42',
  forest: '#193c3e',
  cave: '#181425',
  volcano: '#3e2731',
  tundra: '#5a6988',
  citadel: '#181425',
  abyss: '#0b0a12',
};

export class MapRenderer {
  private chunks = new Map<number, HTMLCanvasElement>();
  private flat: PropPlacement[][];
  private tall: PropPlacement[][];
  private lights: Light[] = [];
  private darkCanvas: HTMLCanvasElement | null = null;
  private stamps = new Map<string, HTMLCanvasElement>();
  readonly theme: Theme;

  constructor(private data: MapData) {
    this.theme = data.theme;
    // bucket props by tile row for fast culling
    this.flat = Array.from({ length: data.h + 4 }, () => []);
    this.tall = Array.from({ length: data.h + 4 }, () => []);
    for (const p of data.props) {
      if (DYNAMIC_PROPS.has(p.id)) continue;
      const row = Math.max(0, Math.min(data.h + 3, Math.floor(p.y / TILE)));
      (FLAT_PROPS.has(p.id) ? this.flat : this.tall)[row].push(p);
      const info = propInfo(p.id);
      if (info.light)
        this.lights.push({
          x: p.x,
          y: p.y - info.h * 0.5,
          radius: info.light.radius,
          color: info.light.color,
          flicker: 0.08,
        });
    }
    // glowing liquids
    if (data.theme === 'volcano') {
      for (let y = 0; y < data.h; y += 2)
        for (let x = 0; x < data.w; x += 2)
          if (data.cells[y * data.w + x] === CELL.Liquid)
            this.lights.push({
              x: x * TILE + 8,
              y: y * TILE + 8,
              radius: 40,
              color: '#f77622',
              flicker: 0.05,
            });
    }
  }

  get staticLights(): readonly Light[] {
    return this.lights;
  }

  private cell(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.data.w || y >= this.data.h) return CELL.Wall;
    return this.data.cells[y * this.data.w + x];
  }

  private isWallish(x: number, y: number): boolean {
    const c = this.cell(x, y);
    return c === CELL.Wall || c === CELL.Void;
  }

  private buildChunk(cx: number, cy: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = CHUNK * TILE;
    c.height = CHUNK * TILE;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const d = this.data;
    const kinds: GroundKind[] = ['floor', 'floorAlt', 'path'];
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const x = cx * CHUNK + tx;
        const y = cy * CHUNK + ty;
        if (x >= d.w || y >= d.h) continue;
        const i = y * d.w + x;
        const cell = d.cells[i];
        const v = Math.floor(hash2(x, y, 7) * 4);
        const px = tx * TILE;
        const py = ty * TILE;
        if (cell === CELL.Wall || cell === CELL.Void) {
          const face = !this.isWallish(x, y + 1);
          ctx.drawImage(getWallTile(this.theme, face, v), px, py);
        } else if (cell !== CELL.Liquid) {
          const g = d.ground[i];
          const kind = kinds[g === GROUND.Alt ? 1 : g === GROUND.Path ? 2 : 0];
          ctx.drawImage(getGroundTile(this.theme, kind, v), px, py);
          if (cell === CELL.Bridge) ctx.drawImage(getGroundTile(this.theme, 'bridge', v), px, py);
        }
      }
    }
    return c;
  }

  /** Draw the static ground layer, animated liquids and flat decorations. */
  renderGround(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    vw: number,
    vh: number,
    time: number,
  ): void {
    const d = this.data;
    ctx.fillStyle = BG_COLOR[this.theme];
    ctx.fillRect(0, 0, vw, vh);
    const cx0 = Math.max(0, Math.floor(camX / (CHUNK * TILE)));
    const cy0 = Math.max(0, Math.floor(camY / (CHUNK * TILE)));
    const cx1 = Math.min(Math.ceil(d.w / CHUNK) - 1, Math.floor((camX + vw) / (CHUNK * TILE)));
    const cy1 = Math.min(Math.ceil(d.h / CHUNK) - 1, Math.floor((camY + vh) / (CHUNK * TILE)));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = cy * 1000 + cx;
        let ch = this.chunks.get(key);
        if (!ch) {
          ch = this.buildChunk(cx, cy);
          this.chunks.set(key, ch);
        }
        ctx.drawImage(ch, cx * CHUNK * TILE - camX, cy * CHUNK * TILE - camY);
      }
    }
    // liquids
    const frame = Math.floor(time * 4) % 4;
    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const ty0 = Math.max(0, Math.floor(camY / TILE));
    const tx1 = Math.min(d.w - 1, Math.floor((camX + vw) / TILE));
    const ty1 = Math.min(d.h - 1, Math.floor((camY + vh) / TILE));
    const liquidish = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= d.w || y >= d.h) return true;
      const c = this.cell(x, y);
      return c === CELL.Liquid || c === CELL.Bridge;
    };
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const c = d.cells[y * d.w + x];
        if (c !== CELL.Liquid && c !== CELL.Bridge) continue;
        const mask =
          (liquidish(x, y - 1) ? 1 : 0) |
          (liquidish(x + 1, y) ? 2 : 0) |
          (liquidish(x, y + 1) ? 4 : 0) |
          (liquidish(x - 1, y) ? 8 : 0);
        ctx.drawImage(getLiquidTile(this.theme, mask, frame), x * TILE - camX, y * TILE - camY);
        if (c === CELL.Bridge)
          ctx.drawImage(getGroundTile(this.theme, 'bridge', 0), x * TILE - camX, y * TILE - camY);
      }
    }
    // flat decorations
    for (let row = Math.max(0, ty0 - 1); row <= Math.min(this.flat.length - 1, ty1 + 2); row++) {
      for (const p of this.flat[row]) this.drawProp(ctx, p, camX, camY, time, vw);
    }
  }

  private drawProp(
    ctx: CanvasRenderingContext2D,
    p: PropPlacement,
    camX: number,
    camY: number,
    time: number,
    vw: number,
  ): void {
    const info = propInfo(p.id);
    const x = Math.round(p.x - info.anchorX - camX);
    if (x > vw || x + info.w < 0) return;
    const frame = info.frames > 1 ? Math.floor(time * info.fps + p.x * 0.013) % info.frames : (p.frame ?? 0);
    ctx.drawImage(getProp(p.id, frame), x, Math.round(p.y - info.anchorY - camY));
  }

  /** Emit y-sorted drawables for tall props and tree cells in view. */
  collectTall(out: Drawable[], camX: number, camY: number, vw: number, vh: number, time: number): void {
    const d = this.data;
    const tx0 = Math.max(0, Math.floor(camX / TILE) - 2);
    const tx1 = Math.min(d.w - 1, Math.floor((camX + vw) / TILE) + 2);
    const ty0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const ty1 = Math.min(d.h - 1, Math.floor((camY + vh) / TILE) + 4);
    const trees = TREE_FOR[this.theme];
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        if (d.cells[y * d.w + x] !== CELL.Tree) continue;
        const h = hash2(x, y, 3);
        const id = trees[Math.floor(h * trees.length)];
        const ox = Math.round((hash2(x, y, 5) - 0.5) * 6);
        const px = x * TILE + 8 + ox;
        const py = y * TILE + 14;
        out.push({
          y: py,
          draw: (ctx, cx, cy) => {
            const info = propInfo(id);
            ctx.drawImage(
              getProp(id, 0),
              Math.round(px - info.anchorX - cx),
              Math.round(py - info.anchorY - cy),
            );
          },
        });
      }
    }
    for (let row = ty0; row <= Math.min(this.tall.length - 1, ty1 + 3); row++) {
      for (const p of this.tall[row]) {
        out.push({ y: p.y, draw: (ctx, cx, cy) => this.drawProp(ctx, p, cx, cy, time, vw + 200) });
      }
    }
  }

  // ------------------------------------------------------------ lighting ----
  private stamp(color: string): HTMLCanvasElement {
    let s = this.stamps.get(color);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 128;
      const c = s.getContext('2d')!;
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, color);
      g.addColorStop(0.45, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      // posterize into bands for a pixel-art look
      const img = c.getImageData(0, 0, 128, 128);
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.round(img.data[i] / 64) * 64;
      c.putImageData(img, 0, 0);
      this.stamps.set(color, s);
    }
    return s;
  }

  renderLighting(
    ctx: CanvasRenderingContext2D,
    darkness: number,
    lights: Light[],
    camX: number,
    camY: number,
    vw: number,
    vh: number,
    time: number,
  ): void {
    if (darkness <= 0) return;
    if (!this.darkCanvas || this.darkCanvas.width !== vw || this.darkCanvas.height !== vh) {
      this.darkCanvas = document.createElement('canvas');
      this.darkCanvas.width = vw;
      this.darkCanvas.height = vh;
    }
    const dc = this.darkCanvas.getContext('2d')!;
    dc.globalCompositeOperation = 'source-over';
    dc.clearRect(0, 0, vw, vh);
    dc.fillStyle = `rgba(10,8,24,${darkness})`;
    dc.fillRect(0, 0, vw, vh);
    dc.globalCompositeOperation = 'destination-out';
    const white = this.stamp('#ffffff');
    const all = [...this.lights, ...lights];
    for (const l of all) {
      const f = l.flicker ? 1 + Math.sin(time * 9 + l.x * 0.1) * l.flicker : 1;
      const r = l.radius * f;
      const x = l.x - camX;
      const y = l.y - camY;
      if (x + r < 0 || y + r < 0 || x - r > vw || y - r > vh) continue;
      dc.drawImage(white, x - r, y - r, r * 2, r * 2);
    }
    ctx.drawImage(this.darkCanvas, 0, 0);
    // colored glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22;
    for (const l of all) {
      if (l.color === '#ffffff') continue;
      const r = l.radius * 0.8;
      const x = l.x - camX;
      const y = l.y - camY;
      if (x + r < 0 || y + r < 0 || x - r > vw || y - r > vh) continue;
      ctx.drawImage(this.stamp(l.color), x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}

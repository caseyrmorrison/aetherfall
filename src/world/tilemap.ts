/** Collision & visibility queries over a MapData (solid cells + prop footprints). */
import { propInfo } from '../art/pixel';
import type { Rect } from '../engine/math';
import { CELL, TILE, type MapData } from './mapdata';

export class TileMap {
  readonly w: number;
  readonly h: number;
  readonly pxW: number;
  readonly pxH: number;
  /** Prop collider rects bucketed per tile index. */
  private buckets = new Map<number, Rect[]>();
  /** Extra dynamic blockers (e.g. a sealed arena door). */
  dynamic: Rect[] = [];

  constructor(readonly data: MapData) {
    this.w = data.w;
    this.h = data.h;
    this.pxW = data.w * TILE;
    this.pxH = data.h * TILE;
    for (const p of data.props) {
      const c = propInfo(p.id).collider;
      if (!c) continue;
      this.addCollider({ x: p.x + c.x, y: p.y + c.y, w: c.w, h: c.h });
    }
  }

  addCollider(r: Rect): void {
    const x0 = Math.floor(r.x / TILE);
    const y0 = Math.floor(r.y / TILE);
    const x1 = Math.floor((r.x + r.w - 0.01) / TILE);
    const y1 = Math.floor((r.y + r.h - 0.01) / TILE);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = y * this.w + x;
        let b = this.buckets.get(k);
        if (!b) this.buckets.set(k, (b = []));
        b.push(r);
      }
    }
  }

  cell(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return CELL.Wall;
    return this.data.cells[ty * this.w + tx];
  }

  /** Is this tile impassable? Flying actors cross liquids. */
  solidCell(tx: number, ty: number, flying = false): boolean {
    const c = this.cell(tx, ty);
    if (c === CELL.Floor || c === CELL.Bridge) return false;
    if (c === CELL.Liquid) return !flying;
    return true;
  }

  walkableAt(px: number, py: number, flying = false): boolean {
    return !this.solidCell(Math.floor(px / TILE), Math.floor(py / TILE), flying);
  }

  /** Does an axis-aligned box collide with the map? */
  boxBlocked(x: number, y: number, w: number, h: number, flying = false): boolean {
    const x0 = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    const y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.solidCell(tx, ty, flying)) return true;
        if (flying) continue;
        const b = this.buckets.get(ty * this.w + tx);
        if (b)
          for (const r of b) if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
      }
    }
    for (const r of this.dynamic)
      if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
    return false;
  }

  /** Grid raycast; true if nothing opaque (walls/trees) lies between the points. */
  lineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const steps = Math.ceil(len / (TILE / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const c = this.cell(Math.floor((ax + dx * t) / TILE), Math.floor((ay + dy * t) / TILE));
      if (c === CELL.Wall || c === CELL.Tree || c === CELL.Void) return false;
    }
    return true;
  }
}

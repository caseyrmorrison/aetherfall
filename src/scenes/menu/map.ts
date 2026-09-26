/** Map tab: explored layout of the current area with markers and a legend. */
import { enemyDef } from '../../data/enemies';
import { drawText } from '../../engine/font';
import type { Rect } from '../../engine/math';
import { CELL, TILE } from '../../world/mapdata';
import { areaName } from '../../world/maps';
import { ellipsize, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

export class MapTab implements TabView {
  readonly label = 'Map';
  private img: HTMLCanvasElement | null = null;
  private t = 0;

  constructor(private menu: MenuScene) {}

  update(dt: number): 'close' | void {
    this.t += dt;
    if (this.menu.game.app.input.pressed('cancel')) return 'close';
  }

  hints(): [string, string][] {
    return [];
  }

  private build(): HTMLCanvasElement {
    const w = this.menu.ws.world;
    const d = w.data;
    const c = document.createElement('canvas');
    c.width = d.w;
    c.height = d.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(d.w, d.h);
    for (let i = 0; i < d.w * d.h; i++) {
      if (!w.explored[i]) continue;
      const cell = d.cells[i];
      const below = i + d.w < d.w * d.h ? d.cells[i + d.w] : cell;
      let col: number[];
      if (cell === CELL.Floor || cell === CELL.Bridge)
        col = d.ground[i] === 2 ? [184, 111, 80] : [104, 118, 150];
      else if (cell === CELL.Liquid)
        col =
          d.theme === 'volcano'
            ? [247, 118, 34]
            : d.theme === 'citadel' || d.theme === 'abyss'
              ? [62, 39, 49]
              : [18, 78, 137];
      else col = below === CELL.Floor ? [58, 68, 102] : [38, 43, 68];
      img.data.set([col[0], col[1], col[2], 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const world = this.menu.ws.world;
    const d = world.data;
    if (!this.img || this.t < 0.02) this.img = this.build();
    const scale = Math.max(1, Math.floor(Math.min((r.w - 110) / d.w, (r.h - 16) / d.h)));
    const mw = d.w * scale;
    const mh = d.h * scale;
    const x = r.x + Math.round((r.w - 110 - mw) / 2);
    const y = r.y + Math.round((r.h - 10 - mh) / 2);
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(x - 2, y - 2, mw + 4, mh + 4);
    ctx.drawImage(this.img, x, y, mw, mh);
    const mark = (wx: number, wy: number, color: string, s: number): void => {
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(x + (wx / TILE) * scale - s / 2),
        Math.round(y + (wy / TILE) * scale - s / 2),
        s,
        s,
      );
    };
    for (const o of world.objects) {
      const k = o.obj.kind;
      if (k === 'crystal') mark(o.x, o.y, UI.cyan, 4);
      else if (k === 'bossGate') mark(o.x, o.y, '#ff0044', 4);
      else if (
        k === 'chest' &&
        !world.isChestOpen(o.obj.id) &&
        world.explored[Math.floor(o.y / TILE) * d.w + Math.floor(o.x / TILE)]
      )
        mark(o.x, o.y, UI.accent, 3);
      else if (k === 'door') mark(o.x, o.y, '#c0cbdc', 3);
    }
    for (const n of world.npcs) mark(n.x, n.y, '#fee761', 2);
    for (const o of d.objects) if (o.kind === 'warp') mark(o.x + o.w / 2, o.y + o.h / 2, '#63c74d', 4);
    const qt = this.menu.ws.hud.questTargetPos(world);
    if (qt && Math.floor(this.t * 2) % 2 === 0) mark(qt.x, qt.y + 12, '#fee761', 5);
    const wb = world.worldBosses.enemy;
    if (wb && !wb.dead) mark(wb.x, wb.y, '#ff0044', 7);
    if (Math.floor(this.t * 3) % 2 === 0) mark(world.player.x, world.player.y, '#ffffff', 4);
    // legend
    const lx = r.x + r.w - 104;
    let ly = r.y + 4;
    drawText(ctx, d.name, lx, ly, { color: UI.accent });
    ly += 16;
    const legend: [string, string][] = [
      ['#ffffff', 'You'],
      [UI.cyan, 'Aether Crystal'],
      ['#ff0044', 'Boss Gate'],
      [UI.accent, 'Chest'],
      ['#63c74d', 'Exit'],
      ['#ff0044', 'World Boss'],
      ['#fee761', 'Person / Quest'],
    ];
    for (const [c, label] of legend) {
      ctx.fillStyle = c;
      ctx.fillRect(lx, ly + 2, 4, 4);
      drawText(ctx, label, lx + 8, ly, { color: '#c0cbdc' });
      ly += 11;
    }
    const total = d.w * d.h;
    let seen = 0;
    for (let i = 0; i < total; i++) if (world.explored[i]) seen++;
    drawText(ctx, `Explored ${Math.round((seen / total) * 100)}%`, lx, ly + 6, { color: UI.dim });
    const ev = world.game.save.worldBoss;
    if (ev) {
      ly += 22;
      const left = Math.ceil(world.worldBosses.timeLeft());
      for (const line of [
        '{red}World Boss{/}',
        enemyDef(ev.boss).name,
        `{gray}${areaName(ev.zone)}{/}`,
        `{gray}Leaves in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}{/}`,
      ]) {
        drawText(ctx, ellipsize(line, 100), lx, ly);
        ly += 10;
      }
    }
  }
}

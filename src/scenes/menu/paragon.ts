/** Paragon tab: spend points earned past the level cap across four categories (Diablo 3 style). */
import { audio } from '../../audio';
import {
  PARAGON_CATEGORIES,
  PARAGON_CATEGORY_INFO,
  PARAGON_STATS,
  type ParagonStatDef,
} from '../../data/paragon';
import { drawText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import { MAX_LEVEL } from '../../game/balance';
import {
  allocate,
  categoryForLevel,
  earnedIn,
  paragonValue,
  paragonXpToNext,
  resetCategory,
  totalUnspent,
  unspentIn,
} from '../../game/paragon';
import { drawBar, drawTooltip, ellipsize, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

const ROW_H = 24;

function fmt(def: ParagonStatDef, v: number): string {
  if (def.pct) {
    const p = Math.round(v * 1000) / 10;
    return `+${Number.isInteger(p) ? p : p.toFixed(1)}%`;
  }
  return `+${Number.isInteger(v) ? v : v.toFixed(1)}`;
}

export class ParagonTab implements TabView {
  readonly label = 'Paragon';
  private col = 0;
  private row = 0;
  private rects: { r: Rect; col: number; row: number }[] = [];

  constructor(private menu: MenuScene) {}

  private get para() {
    return this.menu.game.save.hero.paragon;
  }

  visible(): boolean {
    return this.menu.game.save.hero.level >= MAX_LEVEL || this.para.level > 0;
  }

  badge(): boolean {
    return totalUnspent(this.para) > 0;
  }

  private stat(col: number, row: number): ParagonStatDef | undefined {
    return PARAGON_STATS.filter((d) => d.category === PARAGON_CATEGORIES[col])[row];
  }

  update(): 'close' | void {
    const g = this.menu.game;
    const input = g.app.input;
    let moved = false;
    if (input.repeat('left')) moved = this.move(-1, 0);
    if (input.repeat('right')) moved = this.move(1, 0) || moved;
    if (input.repeat('up')) moved = this.move(0, -1) || moved;
    if (input.repeat('down')) moved = this.move(0, 1) || moved;
    const m = input.mouse;
    let click = false;
    for (const c of this.rects) {
      if (!pointInRect(m.x, m.y, c.r)) continue;
      if (m.moved && (c.col !== this.col || c.row !== this.row)) {
        this.col = c.col;
        this.row = c.row;
        moved = true;
      }
      if (m.clicked) click = true;
      if (m.rightClicked) this.change(-1);
    }
    if (moved) audio.playSfx('ui_move');
    if (input.pressed('confirm') || click) this.change(1);
    if (input.pressed('menuAlt')) this.change(-1);
    if (input.pressed('menuAlt2')) {
      resetCategory(this.para, PARAGON_CATEGORIES[this.col]);
      g.invalidateStats();
      audio.playSfx('ui_tab');
      g.toast(`${PARAGON_CATEGORY_INFO[PARAGON_CATEGORIES[this.col]].name} points refunded`, 'ui_check');
    }
    if (input.pressed('cancel')) return 'close';
  }

  private move(dx: number, dy: number): boolean {
    const col = Math.max(0, Math.min(PARAGON_CATEGORIES.length - 1, this.col + dx));
    const row = Math.max(0, Math.min(3, this.row + dy));
    if (col === this.col && row === this.row) return false;
    this.col = col;
    this.row = row;
    return true;
  }

  private change(delta: 1 | -1): void {
    const g = this.menu.game;
    const def = this.stat(this.col, this.row);
    if (!def) return;
    const why = allocate(this.para, def.id, delta);
    if (why) {
      audio.playSfx('ui_error');
      g.toast(why, 'ui_lock', 0, UI.bad);
      return;
    }
    g.invalidateStats();
    this.menu.ws.world.player.syncFromSave(this.menu.ws.world);
    audio.playSfx(delta > 0 ? 'upgrade_success' : 'ui_select');
  }

  hints(): [string, string][] {
    return [
      ['confirm', 'Add'],
      ['menuAlt', 'Remove'],
      ['menuAlt2', 'Reset'],
    ];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const p = this.para;
    this.rects = [];
    const need = paragonXpToNext(p.level);
    drawText(ctx, `{cyan}Paragon ${p.level}{/}`, r.x + 2, r.y + 2);
    drawBar(ctx, r.x + 64, r.y + 5, 110, 3, p.xp / need, '#2ce8f5');
    drawText(
      ctx,
      `{gray}Next point: ${PARAGON_CATEGORY_INFO[categoryForLevel(p.level + 1)].name}{/}`,
      r.x + 180,
      r.y + 2,
    );
    const colW = Math.floor((r.w - 4) / PARAGON_CATEGORIES.length);
    const top = r.y + 16;
    PARAGON_CATEGORIES.forEach((cat, ci) => {
      const info = PARAGON_CATEGORY_INFO[cat];
      const x = r.x + ci * colW;
      const free = unspentIn(p, cat);
      ctx.fillStyle = info.color;
      ctx.fillRect(x + 2, top, colW - 6, 1);
      drawText(ctx, info.name, x + 3, top + 3, { color: info.color });
      drawText(
        ctx,
        `${free > 0 ? '{cyan}' : '{gray}'}${free}{/}{gray}/${earnedIn(p, cat)}{/}`,
        x + colW - 6,
        top + 3,
        {
          align: 'right',
        },
      );
      PARAGON_STATS.filter((d) => d.category === cat).forEach((d, ri) => {
        const y = top + 15 + ri * ROW_H;
        const sel = this.col === ci && this.row === ri;
        const pts = p.alloc[d.id] ?? 0;
        ctx.fillStyle = sel ? UI.sel : UI.bg;
        ctx.fillRect(x + 2, y, colW - 6, ROW_H - 3);
        if (sel) {
          ctx.strokeStyle = UI.accent;
          ctx.strokeRect(x + 2.5, y + 0.5, colW - 7, ROW_H - 4);
        }
        drawText(ctx, ellipsize(d.name, colW - 40), x + 5, y + 2, { color: pts ? '#ffffff' : UI.dim });
        drawText(ctx, d.cap ? `${pts}/${d.cap}` : `${pts}`, x + colW - 8, y + 2, {
          align: 'right',
          color: d.cap && pts >= d.cap ? UI.accent : pts ? '#ffffff' : UI.dim,
        });
        drawText(ctx, ellipsize(`${fmt(d, paragonValue(p, d))} ${d.label}`, colW - 12), x + 5, y + 11, {
          color: pts ? info.color : UI.dim,
        });
        this.rects.push({ r: { x: x + 2, y, w: colW - 6, h: ROW_H - 3 }, col: ci, row: ri });
      });
    });
    const d = this.stat(this.col, this.row);
    if (d) {
      const pts = p.alloc[d.id] ?? 0;
      const lines = [
        `{${PARAGON_CATEGORY_INFO[d.category].markup}}${d.name}{/} {gray}(${PARAGON_CATEGORY_INFO[d.category].name}){/}`,
        `${fmt(d, d.per)} ${d.label} per point${d.cap ? `, up to ${d.cap} points` : ' (no limit)'}.`,
        `Now: ${fmt(d, pts * d.per)} ${d.label}`,
      ];
      const ty = top + 15 + 4 * ROW_H + 4;
      drawTooltip(ctx, lines, r.x + 2, ty, r.w - 4, r.y + r.h - ty);
    }
  }
}

/** Talents tab: three passive trees (Blade / Arcane / Guardian). */
import { audio } from '../../audio';
import { BRANCH_INFO, PASSIVES, PASSIVE_BY_ID, type Branch, type PassiveDef } from '../../data/skills';
import { drawText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import { drawIcon, drawTooltip, ellipsize, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

const BRANCHES: Branch[] = ['blade', 'arcane', 'guard'];

export class TalentsTab implements TabView {
  readonly label = 'Talents';
  private col = 0;
  private row = 0;
  private rects: { r: Rect; col: number; row: number }[] = [];

  constructor(private menu: MenuScene) {}

  badge(): boolean {
    return this.menu.game.save.hero.skillPoints > 0;
  }

  private node(col: number, row: number): PassiveDef | undefined {
    return PASSIVES.find((p) => p.branch === BRANCHES[col] && p.row === row);
  }

  private canRank(p: PassiveDef): string | null {
    const h = this.menu.game.save.hero;
    const rank = h.passives[p.id] ?? 0;
    if (rank >= p.maxRank) return 'Maxed out.';
    if (p.requires && (h.passives[p.requires] ?? 0) <= 0)
      return `Requires ${PASSIVE_BY_ID[p.requires].name}.`;
    if (h.skillPoints <= 0) return 'No skill points.';
    return null;
  }

  update(): 'close' | void {
    const g = this.menu.game;
    const input = g.app.input;
    let moved = false;
    if (input.repeat('left')) {
      this.col = (this.col + 2) % 3;
      moved = true;
    }
    if (input.repeat('right')) {
      this.col = (this.col + 1) % 3;
      moved = true;
    }
    if (input.repeat('up')) {
      this.row = Math.max(0, this.row - 1);
      moved = true;
    }
    if (input.repeat('down')) {
      this.row = Math.min(5, this.row + 1);
      moved = true;
    }
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
    }
    if (moved) audio.playSfx('ui_move');
    if (input.pressed('confirm') || click) {
      const p = this.node(this.col, this.row);
      if (!p) return;
      const why = this.canRank(p);
      if (why) {
        audio.playSfx('ui_error');
        g.toast(why, 'ui_lock', 0, UI.bad);
      } else {
        const h = g.save.hero;
        h.skillPoints--;
        h.passives[p.id] = (h.passives[p.id] ?? 0) + 1;
        g.invalidateStats();
        audio.playSfx('upgrade_success');
      }
    }
    if (input.pressed('cancel')) return 'close';
  }

  hints(): [string, string][] {
    return [['confirm', 'Learn']];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const h = this.menu.game.save.hero;
    this.rects = [];
    drawText(
      ctx,
      `Skill points: {cyan}${h.skillPoints}{/}  {gray}(shared with Skills • Elder Maren can reset talents){/}`,
      r.x + 2,
      r.y + 2,
    );
    const treeW = Math.min(300, r.w - 150);
    const colW = Math.floor(treeW / 3);
    const top = r.y + 18;
    const rowH = Math.min(30, Math.floor((r.h - 34) / 6));
    BRANCHES.forEach((b, ci) => {
      const info = BRANCH_INFO[b];
      const cx = r.x + ci * colW + 16;
      drawText(ctx, info.name, cx - 10, top, { color: info.color });
      for (let row = 0; row < 6; row++) {
        const p = this.node(ci, row);
        if (!p) continue;
        const x = Math.round(cx - 10);
        const y = top + 12 + row * rowH;
        const rank = h.passives[p.id] ?? 0;
        const avail = !p.requires || (h.passives[p.requires] ?? 0) > 0;
        if (row > 0) {
          ctx.fillStyle = avail ? info.color : UI.bg2;
          ctx.fillRect(Math.round(cx) - 1, y - rowH + 20, 2, rowH - 20);
        }
        const sel = this.col === ci && this.row === row;
        ctx.fillStyle = sel ? UI.sel : UI.bg;
        ctx.fillRect(x, y, 20, 20);
        ctx.strokeStyle = sel ? UI.accent : rank > 0 ? info.color : UI.border;
        ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
        drawIcon(ctx, info.icon, x + 2, y + 2, 0, avail ? (rank > 0 ? 1 : 0.6) : 0.2);
        drawText(ctx, ellipsize(p.name, colW - 34), x + 24, y + 1, { color: avail ? '#c0cbdc' : UI.dim });
        drawText(ctx, `${rank}/${p.maxRank}`, x + 24, y + 11, {
          color: rank >= p.maxRank ? UI.accent : rank > 0 ? '#ffffff' : UI.dim,
        });
        this.rects.push({ r: { x, y, w: 20, h: 20 }, col: ci, row });
      }
    });
    const p = this.node(this.col, this.row);
    if (p) {
      const rank = h.passives[p.id] ?? 0;
      const lines = [
        `{gold}${p.name}{/}`,
        `{gray}${BRANCH_INFO[p.branch].name} • Rank ${rank}/${p.maxRank}{/}`,
        '',
      ];
      lines.push(rank > 0 ? `Current: ${p.desc(rank)}` : 'Not learned.');
      if (rank < p.maxRank) lines.push('', `{cyan}Next:{/} ${p.desc(rank + 1)}`);
      if (p.requires) lines.push('', `{gray}Requires ${ellipsize(PASSIVE_BY_ID[p.requires].name, 120)}{/}`);
      drawTooltip(ctx, lines, r.x + treeW + 8, r.y + 16, r.w - treeW - 8);
    }
  }
}

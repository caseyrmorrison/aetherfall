/** Talents tab: three passive trees (Blade / Arcane / Guardian), each with two columns. */
import { audio } from '../../audio';
import { BRANCH_INFO, PASSIVES, PASSIVE_BY_ID, type Branch, type PassiveDef } from '../../data/skills';
import { drawText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import { drawIcon, drawTooltip, ellipsize, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

const BRANCHES: Branch[] = ['blade', 'arcane', 'guard'];
const COLS = BRANCHES.length * 2;

export class TalentsTab implements TabView {
  readonly label = 'Talents';
  private col = 0;
  private row = 0;
  private rects: { r: Rect; col: number; row: number }[] = [];

  constructor(private menu: MenuScene) {}

  badge(): boolean {
    return this.menu.game.save.hero.skillPoints > 0;
  }

  /** Six columns: two per branch. */
  private node(col: number, row: number): PassiveDef | undefined {
    return PASSIVES.find((p) => p.branch === BRANCHES[col >> 1] && p.col === col % 2 && p.row === row);
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
      this.col = (this.col + COLS - 1) % COLS;
      moved = true;
    }
    if (input.repeat('right')) {
      this.col = (this.col + 1) % COLS;
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
    const treeW = Math.min(300, r.w - 140);
    const colW = Math.floor(treeW / COLS);
    const top = r.y + 18;
    const rowH = Math.min(32, Math.floor((r.h - 34) / 6));
    BRANCHES.forEach((b, bi) => {
      const info = BRANCH_INFO[b];
      drawText(ctx, info.name, r.x + bi * colW * 2 + colW, top, { color: info.color, align: 'center' });
      for (let sub = 0; sub < 2; sub++) {
        const ci = bi * 2 + sub;
        const cx = r.x + ci * colW + Math.floor(colW / 2);
        for (let row = 0; row < 6; row++) {
          const p = this.node(ci, row);
          if (!p) continue;
          const x = cx - 10;
          const y = top + 12 + row * rowH;
          const rank = h.passives[p.id] ?? 0;
          const avail = !p.requires || (h.passives[p.requires] ?? 0) > 0;
          if (row > 0) {
            ctx.fillStyle = avail ? info.color : UI.bg2;
            ctx.fillRect(cx - 1, y - rowH + 25, 2, rowH - 25);
          }
          const sel = this.col === ci && this.row === row;
          const capstone = p.maxRank === 1;
          ctx.fillStyle = sel ? UI.sel : UI.bg;
          ctx.fillRect(x, y, 20, 20);
          ctx.strokeStyle = sel ? UI.accent : rank > 0 ? info.color : capstone ? '#8b9bb4' : UI.border;
          ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
          drawIcon(ctx, info.icon, x + 2, y + 2, 0, avail ? (rank > 0 ? 1 : 0.6) : 0.2);
          // rank pips under the node
          const pw = p.maxRank > 3 ? 3 : 5;
          const px0 = cx - Math.round((p.maxRank * (pw + 1) - 1) / 2);
          for (let k = 0; k < p.maxRank; k++) {
            ctx.fillStyle = k < rank ? (rank >= p.maxRank ? UI.accent : '#ffffff') : UI.bg2;
            ctx.fillRect(px0 + k * (pw + 1), y + 22, pw, 2);
          }
          this.rects.push({ r: { x, y, w: 20, h: 20 }, col: ci, row });
        }
      }
    });
    const p = this.node(this.col, this.row);
    if (p) {
      const rank = h.passives[p.id] ?? 0;
      const lines = [
        `{gold}${p.name}{/}${p.maxRank === 1 ? ' {gray}(capstone){/}' : ''}`,
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

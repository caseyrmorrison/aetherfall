/** Hero tab: character stats, equipment slots and the bag grid with comparisons. */
import { getSprite } from '../../art/pixel';
import { audio } from '../../audio';
import { SLOT_ICON, SLOT_LABEL } from '../../data/items';
import { drawText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import { xpToNext } from '../../game/balance';
import { itemScore, RARITY_INDEX } from '../../game/items';
import { equipItem, INVENTORY_SIZE, unequip } from '../../game/state';
import { powerRating } from '../../game/stats';
import type { Item, Slot } from '../../game/types';
import { SLOTS } from '../../game/types';
import { drawItemCell, drawTooltip, itemTooltipLines, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

const COLS = 8;
const CELL = 19;

export class HeroTab implements TabView {
  readonly label = 'Hero';
  /** -1 = equipment column. */
  private col = 0;
  private row = 0;
  private scroll = 0;
  private rowsVisible = 8;
  private cellRects: { r: Rect; col: number; row: number }[] = [];
  private t = 0;

  constructor(private menu: MenuScene) {}

  private get save() {
    return this.menu.game.save;
  }

  private selectedItem(): Item | null {
    if (this.col < 0) return this.save.equipment[SLOTS[this.row]] ?? null;
    return this.save.inventory[this.row * COLS + this.col] ?? null;
  }

  badge(): boolean {
    return this.save.inventory.some((i) => i.isNew);
  }

  update(dt: number): 'close' | void {
    this.t += dt;
    const g = this.menu.game;
    const input = g.app.input;
    const bagRows = Math.ceil(INVENTORY_SIZE / COLS);
    let moved = false;
    if (input.repeat('left')) {
      if (this.col === 0) {
        this.col = -1;
        this.row = Math.min(this.row - this.scroll, SLOTS.length - 1);
      } else if (this.col > 0) this.col--;
      moved = true;
    }
    if (input.repeat('right')) {
      if (this.col === -1) {
        this.col = 0;
        this.row = this.scroll + this.row;
      } else if (this.col < COLS - 1) this.col++;
      moved = true;
    }
    if (input.repeat('up')) {
      this.row = Math.max(0, this.row - 1);
      moved = true;
    }
    if (input.repeat('down')) {
      this.row = Math.min(this.col < 0 ? SLOTS.length - 1 : bagRows - 1, this.row + 1);
      moved = true;
    }
    // mouse
    const m = input.mouse;
    for (const c of this.cellRects) {
      if (!pointInRect(m.x, m.y, c.r)) continue;
      if (m.moved && (c.col !== this.col || c.row !== this.row)) {
        this.col = c.col;
        this.row = c.row;
        moved = true;
      }
      if (m.clicked) {
        const same = c.col === this.col && c.row === this.row;
        this.col = c.col;
        this.row = c.row;
        if (same) this.activate();
        return;
      }
      if (m.rightClicked) {
        this.col = c.col;
        this.row = c.row;
        this.toggleLock();
        return;
      }
    }
    if (m.wheel && this.col >= 0)
      this.scroll = Math.max(0, Math.min(bagRows - this.rowsVisible, this.scroll + m.wheel));
    if (moved) {
      audio.playSfx('ui_move');
      if (this.col >= 0) {
        if (this.row < this.scroll) this.scroll = this.row;
        if (this.row >= this.scroll + this.rowsVisible) this.scroll = this.row - this.rowsVisible + 1;
      }
      const it = this.selectedItem();
      if (it?.isNew) it.isNew = false;
    }
    if (input.pressed('confirm')) this.activate();
    if (input.pressed('menuAlt')) this.toggleLock();
    if (input.pressed('menuAlt2')) this.sortBag();
    if (input.pressed('cancel')) return 'close';
  }

  private activate(): void {
    const g = this.menu.game;
    const it = this.selectedItem();
    if (!it) return;
    if (this.col < 0) {
      if (unequip(this.save, it.slot)) {
        audio.playSfx('equip');
        g.invalidateStats();
      } else {
        audio.playSfx('ui_error');
        g.toast('Bag is full.', 'ui_lock', 0, UI.bad);
      }
      return;
    }
    equipItem(this.save, it.uid);
    audio.playSfx('equip');
    g.invalidateStats();
    this.menu.ws.world.player.syncFromSave(this.menu.ws.world);
  }

  private toggleLock(): void {
    const it = this.selectedItem();
    if (!it) return;
    it.locked = !it.locked;
    audio.playSfx('ui_select');
  }

  private sortBag(): void {
    const order: Record<Slot, number> = { weapon: 0, helm: 1, armor: 2, boots: 3, ring: 4, amulet: 5 };
    this.save.inventory.sort(
      (a, b) =>
        order[a.slot] - order[b.slot] ||
        RARITY_INDEX[b.rarity] - RARITY_INDEX[a.rarity] ||
        itemScore(b) - itemScore(a),
    );
    audio.playSfx('ui_tab');
    this.menu.game.toast('Bag sorted', 'ui_check');
  }

  hints(): [string, string][] {
    const it = this.selectedItem();
    const h: [string, string][] = [];
    if (it) h.push(['confirm', this.col < 0 ? 'Unequip' : 'Equip']);
    if (it) h.push(['menuAlt', it.locked ? 'Unlock' : 'Lock']);
    h.push(['menuAlt2', 'Sort']);
    return h;
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const g = this.menu.game;
    const s = this.save;
    const st = g.stats();
    this.cellRects = [];
    const showStats = r.w >= 420;
    let x = r.x;
    // ---- stats column
    if (showStats) {
      const hero = getSprite('hero', 'idle', Math.floor(this.t * 2) % 2, 'down');
      ctx.drawImage(hero, x + 4, r.y + 2, hero.width * 2, hero.height * 2);
      drawText(ctx, s.hero.name, x + 40, r.y + 4, { color: UI.accent });
      drawText(ctx, `Level ${s.hero.level}`, x + 40, r.y + 14);
      const need = xpToNext(s.hero.level);
      drawText(ctx, Number.isFinite(need) ? `XP ${s.hero.xp}/${need}` : 'MAX LEVEL', x + 40, r.y + 24, {
        color: UI.dim,
      });
      drawText(ctx, `Power {gold}${powerRating(st)}{/}`, x + 40, r.y + 34);
      const pct = (v: number, sign = '+'): string =>
        Math.round(v * 100) === 0 ? '0%' : `${sign}${Math.round(v * 100)}%`;
      const rows: [string, string][] = [
        ['HP', `${st.maxHp}`],
        ['MP', `${st.maxMp}`],
        ['Attack', `${Math.round(st.atk)}`],
        ['Magic', `${Math.round(st.mag)}`],
        ['Defense', `${Math.round(st.def)}`],
        ['Crit', `${Math.round(st.crit * 100)}%`],
        ['Crit Dmg', pct(st.critDmg)],
        ['Atk Speed', pct(st.atkSpeed)],
        ['Move', pct(st.moveSpeed)],
        ['Lifesteal', `${Math.round(st.lifesteal * 100)}%`],
        ['Cooldown', pct(st.cdr, '-')],
        ['Skill Dmg', pct(st.skillDmg)],
        ['Gold Find', pct(st.goldFind)],
        ['Magic Find', pct(st.magicFind)],
        ['HP Regen', `${st.hpRegen.toFixed(1)}/s`],
      ];
      let y = r.y + 48;
      for (const [k, v] of rows) {
        if (y > r.y + r.h - 12) break;
        drawText(ctx, k, x + 4, y, { color: UI.dim });
        drawText(ctx, v, x + 112, y, { align: 'right' });
        y += 10;
      }
      x += 120;
    }
    // ---- equipment column
    drawText(ctx, 'Gear', x + 2, r.y + 2, { color: UI.dim });
    SLOTS.forEach((slot, i) => {
      const cx = x + 2;
      const cy = r.y + 14 + i * 22;
      const sel = this.col === -1 && this.row === i;
      drawItemCell(ctx, s.equipment[slot], cx, cy, sel, SLOT_ICON[slot === 'weapon' ? 'sword' : slot]);
      this.cellRects.push({ r: { x: cx, y: cy, w: 18, h: 18 }, col: -1, row: i });
      if (!s.equipment[slot]) drawText(ctx, SLOT_LABEL[slot][0], cx + 21, cy + 5, { color: UI.dim });
    });
    x += 30;
    // ---- bag grid
    drawText(ctx, `Bag ${s.inventory.length}/${INVENTORY_SIZE}`, x, r.y + 2, {
      color: s.inventory.length >= INVENTORY_SIZE ? UI.bad : UI.dim,
    });
    this.rowsVisible = Math.max(3, Math.floor((r.h - 30) / CELL));
    const bagRows = Math.ceil(INVENTORY_SIZE / COLS);
    for (let row = this.scroll; row < Math.min(bagRows, this.scroll + this.rowsVisible); row++) {
      for (let c = 0; c < COLS; c++) {
        const idx = row * COLS + c;
        if (idx >= INVENTORY_SIZE) break;
        const cx = x + c * CELL;
        const cy = r.y + 14 + (row - this.scroll) * CELL;
        drawItemCell(ctx, s.inventory[idx] ?? null, cx, cy, this.col === c && this.row === row);
        this.cellRects.push({ r: { x: cx, y: cy, w: 18, h: 18 }, col: c, row });
      }
    }
    if (bagRows > this.rowsVisible) {
      const th = this.rowsVisible * CELL;
      const bh = (th * this.rowsVisible) / bagRows;
      ctx.fillStyle = UI.bg2;
      ctx.fillRect(x + COLS * CELL + 1, r.y + 14, 2, th);
      ctx.fillStyle = UI.border;
      ctx.fillRect(
        x + COLS * CELL + 1,
        r.y + 14 + Math.round(((th - bh) * this.scroll) / (bagRows - this.rowsVisible)),
        2,
        Math.round(bh),
      );
    }
    x += COLS * CELL + 8;
    // ---- tooltip
    const tipW = r.x + r.w - x;
    const it = this.selectedItem();
    if (it && tipW > 90) {
      const compare = this.col < 0 ? null : s.equipment[it.slot];
      const lines = itemTooltipLines(it, compare, { price: 'sell' });
      if (compare && this.col >= 0) lines.push('', '{gray}Compared to equipped{/}');
      drawTooltip(ctx, lines, x, r.y + 2, tipW, r.h - 16);
    } else if (tipW > 90) {
      drawText(ctx, 'Select an item', x + 4, r.y + 6, { color: UI.dim });
    }
  }
}

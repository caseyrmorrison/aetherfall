/**
 * The stash chest in town (shared by every save slot): your bag on the left, a tabbed
 * stash on the right.
 * Move items across with Confirm (or a click), rearrange with Move (or drag and drop),
 * deposit everything at once, and buy more tabs.
 */
import { audio } from '../audio';
import type { Scene } from '../engine/app';
import { drawText, measureText } from '../engine/font';
import { pointInRect, type Rect } from '../engine/math';
import { MAX_STASH_TABS, STASH_TAB_SIZE, stashTabCost } from '../game/balance';
import type { Game } from '../game/game';
import { itemScore, RARITY_INDEX } from '../game/items';
import { bagSize, moveInList } from '../game/state';
import type { Item } from '../game/types';
import { drawHints, drawItemCell, drawPanel, drawTooltip, itemTooltipLines, UI } from '../ui/widgets';
import { ConfirmScene } from './confirm';

const COLS = 8;
const CELL = 19;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

type Side = 'bag' | 'stash';
interface Slot {
  side: Side;
  i: number;
}
const sameSlot = (a: Slot, b: Slot): boolean => a.side === b.side && a.i === b.i;

export class StashScene implements Scene {
  readonly opaque = false;
  private tab = 0;
  private sel: Slot = { side: 'bag', i: 0 };
  private held: Slot | null = null;
  private press: { slot: Slot; x: number; y: number; wasSelected: boolean; dragging: boolean } | null = null;
  private bagScroll = 0;
  private bagRows = 6;
  private cells: { slot: Slot; rect: Rect }[] = [];
  private tabRects: { i: number; rect: Rect }[] = [];
  private t = 0;

  constructor(private game: Game) {}

  private get save() {
    return this.game.save;
  }

  private list(side: Side): Item[] {
    return side === 'bag' ? this.save.inventory : this.game.stash.tabs[this.tab];
  }

  private capacity(side: Side): number {
    return side === 'bag' ? bagSize(this.save) : STASH_TAB_SIZE;
  }

  /** The "+" tab past the last owned tab (buying a new one). */
  private get onBuyTab(): boolean {
    return this.tab >= this.game.stash.tabs.length;
  }

  private itemAt(slot: Slot): Item | null {
    if (slot.side === 'stash' && this.onBuyTab) return null;
    return this.list(slot.side)[slot.i] ?? null;
  }

  // ---------------------------------------------------------------- update ----

  update(dt: number): void {
    this.t += dt;
    const input = this.game.app.input;
    const tabs = this.game.stash.tabs.length + (this.game.stash.tabs.length < MAX_STASH_TABS ? 1 : 0);
    if (input.repeat('tabPrev') || input.repeat('tabNext')) {
      this.tab = (this.tab + (input.repeat('tabNext') ? 1 : tabs - 1)) % tabs;
      if (this.sel.side === 'stash') this.sel = { side: 'stash', i: 0 };
      if (this.held?.side === 'stash') this.held = null;
      audio.playSfx('ui_tab');
      return;
    }
    const m = input.mouse;
    for (const tr of this.tabRects)
      if (m.clicked && pointInRect(m.x, m.y, tr.rect) && tr.i !== this.tab) {
        this.tab = tr.i;
        audio.playSfx('ui_tab');
        return;
      }
    let moved = false;
    if (input.repeat('left')) moved = this.move(-1, 0);
    if (input.repeat('right')) moved = this.move(1, 0) || moved;
    if (input.repeat('up')) moved = this.move(0, -1) || moved;
    if (input.repeat('down')) moved = this.move(0, 1) || moved;
    if (this.handleMouse()) return;
    if (m.wheel) {
      const rows = Math.ceil(bagSize(this.save) / COLS);
      this.bagScroll = Math.max(0, Math.min(rows - this.bagRows, this.bagScroll + m.wheel));
    }
    if (moved) {
      audio.playSfx('ui_move');
      this.keepVisible();
    }
    if (this.onBuyTab && this.sel.side === 'stash') {
      if (input.pressed('confirm')) this.buyTab();
      if (input.pressed('cancel')) this.close();
      return;
    }
    if (this.held) {
      if (input.pressed('confirm') || input.pressed('menuAlt3')) {
        const from = this.held;
        this.held = null;
        this.drop(from, this.sel);
      } else if (input.pressed('cancel')) {
        this.held = null;
        audio.playSfx('ui_back');
      }
      return;
    }
    if (input.pressed('confirm')) this.transfer(this.sel);
    if (input.pressed('menuAlt3') && this.itemAt(this.sel)) {
      this.held = { ...this.sel };
      audio.playSfx('ui_select');
    }
    if (input.pressed('menuAlt')) this.depositAll();
    if (input.pressed('menuAlt2')) this.sortTab();
    if (input.pressed('cancel')) this.close();
  }

  private handleMouse(): boolean {
    const m = this.game.app.input.mouse;
    const hover = this.cells.find((c) => pointInRect(m.x, m.y, c.rect));
    if (hover && m.moved && !this.press?.dragging && !sameSlot(hover.slot, this.sel)) this.sel = hover.slot;
    if (hover && m.clicked) {
      this.press = {
        slot: hover.slot,
        x: m.x,
        y: m.y,
        wasSelected: sameSlot(hover.slot, this.sel),
        dragging: false,
      };
      this.sel = hover.slot;
    }
    if (this.press && m.down && Math.hypot(m.x - this.press.x, m.y - this.press.y) > 3)
      this.press.dragging = !!this.itemAt(this.press.slot);
    if (this.press && m.released) {
      const p = this.press;
      this.press = null;
      if (p.dragging && hover) this.drop(p.slot, hover.slot);
      else if (!p.dragging && p.wasSelected && hover && sameSlot(hover.slot, p.slot)) {
        if (this.onBuyTab && p.slot.side === 'stash') this.buyTab();
        else this.transfer(p.slot);
      }
      return true;
    }
    return false;
  }

  /** Grid navigation; moving right off the bag enters the stash and vice versa. */
  private move(dx: number, dy: number): boolean {
    const s = this.sel;
    const cap = this.capacity(s.side);
    const col = s.i % COLS;
    const row = Math.floor(s.i / COLS);
    if (dx) {
      const nc = col + dx;
      if (nc < 0) {
        if (s.side === 'stash') {
          this.sel = {
            side: 'bag',
            i: Math.min(bagSize(this.save) - 1, (this.bagScroll + row) * COLS + COLS - 1),
          };
          return true;
        }
        return false;
      }
      if (nc >= COLS) {
        if (s.side === 'bag') {
          this.sel = { side: 'stash', i: Math.min(STASH_TAB_SIZE - 1, (row - this.bagScroll) * COLS) };
          return true;
        }
        return false;
      }
      this.sel = { side: s.side, i: s.i + dx };
      return true;
    }
    const ni = s.i + dy * COLS;
    if (ni < 0 || ni >= cap) return false;
    this.sel = { side: s.side, i: ni };
    return true;
  }

  private keepVisible(): void {
    if (this.sel.side !== 'bag') return;
    const row = Math.floor(this.sel.i / COLS);
    if (row < this.bagScroll) this.bagScroll = row;
    if (row >= this.bagScroll + this.bagRows) this.bagScroll = row - this.bagRows + 1;
  }

  /** Send an item to the other side (to the first free slot). */
  private transfer(slot: Slot): void {
    const it = this.itemAt(slot);
    if (!it) return;
    const to: Side = slot.side === 'bag' ? 'stash' : 'bag';
    const src = this.list(slot.side);
    const dst = this.list(to);
    if (this.onBuyTab) return this.fail('Buy this stash tab first.');
    if (dst.length >= this.capacity(to))
      return this.fail(to === 'bag' ? 'Your bag is full.' : 'This stash tab is full.');
    src.splice(slot.i, 1);
    dst.push(it);
    it.isNew = false;
    audio.playSfx('equip');
    this.afterChange();
  }

  /** Drop a carried item onto a slot: rearrange within a side, or move across to that spot. */
  private drop(from: Slot, to: Slot): void {
    const it = this.itemAt(from);
    if (!it || (this.onBuyTab && (from.side === 'stash' || to.side === 'stash'))) return;
    if (from.side === to.side) {
      if (moveInList(this.list(from.side), from.i, to.i)) {
        audio.playSfx('equip');
        this.sel = { side: to.side, i: Math.min(to.i, this.list(to.side).length - 1) };
        this.afterChange();
      }
      return;
    }
    const src = this.list(from.side);
    const dst = this.list(to.side);
    const other = dst[to.i];
    if (!other && dst.length >= this.capacity(to.side))
      return this.fail(to.side === 'bag' ? 'Your bag is full.' : 'This stash tab is full.');
    if (other) {
      // swap the two items across
      src[from.i] = other;
      dst[to.i] = it;
    } else {
      src.splice(from.i, 1);
      dst.push(it);
    }
    it.isNew = false;
    audio.playSfx('equip');
    this.sel = { side: to.side, i: other ? to.i : dst.length - 1 };
    this.afterChange();
  }

  /** Put every unlocked item that isn't a charm into the current tab (and following tabs). */
  private depositAll(): void {
    const s = this.save;
    const moving = s.inventory.filter((i) => !i.locked && i.slot !== 'charm');
    if (!moving.length) return this.fail('Nothing to deposit (locked items and charms stay in your bag).');
    let n = 0;
    for (const it of moving) {
      const tab = [this.tab, ...this.game.stash.tabs.keys()].find(
        (k) => k < this.game.stash.tabs.length && this.game.stash.tabs[k].length < STASH_TAB_SIZE,
      );
      if (tab === undefined) break;
      this.game.stash.tabs[tab].push(it);
      s.inventory.splice(s.inventory.indexOf(it), 1);
      it.isNew = false;
      n++;
    }
    if (!n) return this.fail('Your stash is full.');
    audio.playSfx('chest_open');
    this.game.toast(
      `Deposited ${n} item${n > 1 ? 's' : ''}${n < moving.length ? ' (stash full)' : ''}`,
      'ui_chest',
    );
    this.afterChange();
  }

  private sortTab(): void {
    if (this.onBuyTab) return;
    this.list('stash').sort(
      (a, b) =>
        a.slot.localeCompare(b.slot) ||
        RARITY_INDEX[b.rarity] - RARITY_INDEX[a.rarity] ||
        itemScore(b) - itemScore(a),
    );
    audio.playSfx('ui_tab');
    this.game.toast('Stash tab sorted', 'ui_check');
  }

  private buyTab(): void {
    const s = this.save;
    const cost = stashTabCost(this.game.stash.tabs.length);
    this.game.app.push(
      new ConfirmScene(
        this.game,
        `Buy stash tab ${ROMAN[this.game.stash.tabs.length]} for ${cost} gold?`,
        () => {
          if (s.hero.gold < cost) return this.fail('Not enough gold.');
          s.hero.gold -= cost;
          this.game.stash.tabs.push([]);
          this.game.saveStash();
          audio.playSfx('upgrade_success');
          this.game.toast(`Stash tab ${ROMAN[this.game.stash.tabs.length - 1]} unlocked!`, 'ui_chest');
        },
      ),
    );
  }

  /** Save the stash and the character together; charms moving in or out change stats. */
  private afterChange(): void {
    this.game.invalidateStats();
    this.game.saveStash();
  }

  private fail(msg: string): void {
    audio.playSfx('ui_error');
    this.game.toast(msg, 'ui_lock', 0, UI.bad);
  }

  private close(): void {
    audio.playSfx('ui_close');
    this.game.app.remove(this);
  }

  // ---------------------------------------------------------------- render ----

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    const s = this.save;
    this.cells = [];
    this.tabRects = [];
    ctx.fillStyle = 'rgba(11,10,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    const gridW = COLS * CELL;
    const w = Math.min(W - 8, gridW * 2 + 26 + (W >= 470 ? 150 : 0));
    const h = H - 30;
    const x = Math.round((W - w) / 2);
    const y = 14;
    drawPanel(ctx, x, y, w, h, { title: 'Stash' });
    drawText(ctx, '{gray}shared by all save slots{/}', x + measureText('Stash') + 16, y + 3);
    drawText(ctx, `${s.hero.gold}g`, x + w - 8, y + 3, { align: 'right', color: UI.accent });

    // bag
    const bx = x + 8;
    const top = y + 30;
    const size = bagSize(s);
    drawText(ctx, `Bag ${s.inventory.length}/${size}`, bx, y + 18, {
      color: s.inventory.length >= size ? UI.bad : UI.dim,
    });
    // on wide screens the tooltip sits to the right, so the bag can use the full height
    const wide = w >= gridW * 2 + 26 + 120;
    const room = wide ? y + h - 20 - top : h - 110;
    this.bagRows = Math.max(3, Math.min(Math.ceil(size / COLS), Math.floor(room / CELL)));
    this.drawGrid(ctx, 'bag', bx, top, this.bagScroll, this.bagRows);

    // stash tabs
    const sx = bx + gridW + 10;
    let tx = sx;
    const tabs = this.game.stash.tabs.length;
    for (let i = 0; i < tabs + (tabs < MAX_STASH_TABS ? 1 : 0); i++) {
      const label = i < tabs ? ROMAN[i] : '+';
      const tw = measureText(label) + 8;
      const sel = i === this.tab;
      ctx.fillStyle = sel ? UI.accent : UI.bg2;
      ctx.fillRect(tx, y + 17, tw, 11);
      drawText(ctx, label, tx + 4, y + 18, {
        color: sel ? UI.bg : i < tabs ? UI.dim : UI.good,
        shadow: false,
      });
      this.tabRects.push({ i, rect: { x: tx, y: y + 17, w: tw, h: 11 } });
      tx += tw + 2;
    }
    if (this.onBuyTab) {
      const cost = stashTabCost(tabs);
      const r = { x: sx, y: top, w: gridW, h: (STASH_TAB_SIZE / COLS) * CELL };
      drawPanel(ctx, r.x, r.y, r.w, r.h, { border: this.sel.side === 'stash' ? UI.accent : UI.border });
      drawText(ctx, `New stash tab`, r.x + r.w / 2, r.y + 20, { align: 'center', color: UI.accent });
      drawText(ctx, `${STASH_TAB_SIZE} more slots`, r.x + r.w / 2, r.y + 34, {
        align: 'center',
        color: UI.dim,
      });
      drawText(ctx, `${cost}g`, r.x + r.w / 2, r.y + 52, {
        align: 'center',
        color: s.hero.gold >= cost ? UI.accent : UI.bad,
      });
      this.cells.push({ slot: { side: 'stash', i: 0 }, rect: r });
    } else {
      const list = this.list('stash');
      drawText(ctx, `${list.length}/${STASH_TAB_SIZE}`, sx + gridW, y + 18, {
        align: 'right',
        color: UI.dim,
      });
      this.drawGrid(ctx, 'stash', sx, top, 0, STASH_TAB_SIZE / COLS);
    }

    // carried item
    const carried = this.held ?? (this.press?.dragging ? this.press.slot : null);
    const cit = carried ? this.itemAt(carried) : null;
    if (carried && cit) {
      const src = this.cells.find((c) => sameSlot(c.slot, carried));
      if (src) {
        ctx.fillStyle = 'rgba(24,20,37,0.6)';
        ctx.fillRect(src.rect.x, src.rect.y, 18, 18);
      }
      const m = this.game.app.input.mouse;
      const cur = this.cells.find((c) => sameSlot(c.slot, this.sel));
      const at = this.press?.dragging
        ? { x: m.x - 9, y: m.y - 9 }
        : cur
          ? { x: cur.rect.x - 4, y: cur.rect.y - 6 }
          : null;
      if (at) drawItemCell(ctx, cit, at.x, at.y + Math.round(Math.sin(this.t * 6)), true);
    }

    // tooltip: to the right when there's room, else under the grids
    const it = this.itemAt(this.sel);
    const tipX = wide ? sx + gridW + 8 : bx;
    const tipY = wide ? top : top + this.bagRows * CELL + 6;
    const tipW = wide ? x + w - tipX - 6 : w - 16;
    if (it) drawTooltip(ctx, itemTooltipLines(it, null), tipX, tipY, tipW, y + h - 18 - tipY);

    const input = this.game.app.input;
    const hints: [string, string][] = this.held
      ? [
          ['menuAlt3', 'Drop here'],
          ['cancel', 'Put back'],
        ]
      : this.onBuyTab && this.sel.side === 'stash'
        ? [
            ['confirm', 'Buy tab'],
            ['cancel', 'Close'],
          ]
        : [
            ['confirm', this.sel.side === 'bag' ? 'Store' : 'Take'],
            ['menuAlt3', 'Move'],
            ['menuAlt', 'Deposit all'],
            ['menuAlt2', 'Sort tab'],
            ['tabNext', 'Tabs'],
            ['cancel', 'Close'],
          ];
    drawHints(ctx, input, hints, x + w - 6, y + h - 13);
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    side: Side,
    x: number,
    y: number,
    scroll: number,
    rows: number,
  ): void {
    const list = this.list(side);
    const cap = this.capacity(side);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < COLS; c++) {
        const i = (scroll + r) * COLS + c;
        if (i >= cap) return;
        const cx = x + c * CELL;
        const cy = y + r * CELL;
        const slot = { side, i };
        drawItemCell(ctx, list[i] ?? null, cx, cy, sameSlot(slot, this.sel));
        this.cells.push({ slot, rect: { x: cx, y: cy, w: 18, h: 18 } });
      }
  }
}

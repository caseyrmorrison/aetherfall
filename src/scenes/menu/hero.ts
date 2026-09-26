/**
 * Hero tab: a paper doll (gear slots sit on the hero's body), the bag grid with
 * charms, and item tooltips with comparisons.
 */
import { getIcon, getSprite, spriteInfo } from '../../art/pixel';
import { audio } from '../../audio';
import { SLOT_ICON } from '../../data/items';
import { drawText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import { activeCharms, compareTarget, itemScore, RARITY_INDEX } from '../../game/items';
import { totalGems } from '../../game/gems';
import { bagSize, charmLimit, equipItem, moveInList, unequip } from '../../game/state';
import { deriveStats, equipDelta, powerRating } from '../../game/stats';
import type { EquipSlot, Item, Slot } from '../../game/types';
import { EQUIP_SLOTS, equipSlotsFor } from '../../game/types';
import { drawItemCell, drawTooltip, itemTooltipLines, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

const COLS = 8;
const CELL = 19;
/** Doll scale: the hero sprite is drawn this many times larger. */
const S = 6;

/** Where each gear slot sits on the hero sprite (sprite pixel coordinates). */
const DOLL: Record<EquipSlot, [number, number]> = {
  helm: [8, 5],
  amulet: [8, 10.8],
  armor: [8, 14.6],
  belt: [8, 18.3],
  boots: [8, 22.2],
  gloves: [0.4, 15.2],
  ring1: [0.4, 19.4],
  weapon: [15.6, 15.2],
  ring2: [15.6, 19.4],
};

const DOLL_LABEL: Record<EquipSlot, string> = {
  helm: 'Head',
  amulet: 'Neck',
  armor: 'Chest',
  belt: 'Waist',
  boots: 'Feet',
  gloves: 'Hands',
  ring1: 'Left Ring',
  weapon: 'Main Hand',
  ring2: 'Right Ring',
};

const PLACEHOLDER: Record<EquipSlot, Slot> = {
  helm: 'helm',
  amulet: 'amulet',
  armor: 'armor',
  belt: 'belt',
  boots: 'boots',
  gloves: 'gloves',
  ring1: 'ring',
  weapon: 'weapon',
  ring2: 'ring',
};

type Sel = { kind: 'doll'; slot: EquipSlot } | { kind: 'bag'; i: number };

interface Cell {
  sel: Sel;
  rect: Rect;
}

const same = (a: Sel, b: Sel): boolean =>
  a.kind === 'doll' ? b.kind === 'doll' && a.slot === b.slot : b.kind === 'bag' && a.i === b.i;

export class HeroTab implements TabView {
  readonly label = 'Hero';
  private sel: Sel = { kind: 'bag', i: 0 };
  private cells: Cell[] = [];
  private scroll = 0;
  private rowsVisible = 8;
  private t = 0;
  /** Keyboard/gamepad move: the bag index of the item being carried to a new slot. */
  private held: number | null = null;
  /** Mouse press on a cell (becomes a drag once the mouse moves). */
  private press: { sel: Sel; x: number; y: number; wasSelected: boolean; dragging: boolean } | null = null;

  constructor(private menu: MenuScene) {}

  private get save() {
    return this.menu.game.save;
  }

  private selectedItem(): Item | null {
    return this.sel.kind === 'doll'
      ? this.save.equipment[this.sel.slot]
      : (this.save.inventory[this.sel.i] ?? null);
  }

  badge(): boolean {
    return this.save.inventory.some((i) => i.isNew);
  }

  /** Move the selection to the nearest cell in a direction (works across doll and bag). */
  private navigate(dx: number, dy: number): boolean {
    const cur = this.cells.find((c) => same(c.sel, this.sel));
    if (!cur) {
      this.sel = { kind: 'bag', i: 0 };
      return true;
    }
    const cx = cur.rect.x + cur.rect.w / 2;
    const cy = cur.rect.y + cur.rect.h / 2;
    let best: Cell | null = null;
    let bestScore = Infinity;
    for (const c of this.cells) {
      if (c === cur) continue;
      const ox = c.rect.x + c.rect.w / 2 - cx;
      const oy = c.rect.y + c.rect.h / 2 - cy;
      const along = ox * dx + oy * dy;
      if (along <= 2) continue;
      const across = Math.abs(ox * dy - oy * dx);
      if (across > along * 2.2) continue;
      const score = along + across * 2;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    // scroll the bag when moving past the visible rows
    if (!best && this.sel.kind === 'bag') {
      const size = bagSize(this.save);
      const row = Math.floor(this.sel.i / COLS);
      const bagRows = Math.ceil(size / COLS);
      if (dy > 0 && row < bagRows - 1) {
        this.sel = { kind: 'bag', i: Math.min(size - 1, this.sel.i + COLS) };
        return true;
      }
      if (dy < 0 && row > 0) {
        this.sel = { kind: 'bag', i: this.sel.i - COLS };
        return true;
      }
    }
    if (!best) return false;
    this.sel = best.sel;
    return true;
  }

  update(dt: number): 'close' | void {
    this.t += dt;
    const g = this.menu.game;
    const input = g.app.input;
    let moved = false;
    if (input.repeat('left')) moved = this.navigate(-1, 0);
    if (input.repeat('right')) moved = this.navigate(1, 0) || moved;
    if (input.repeat('up')) moved = this.navigate(0, -1) || moved;
    if (input.repeat('down')) moved = this.navigate(0, 1) || moved;
    const m = input.mouse;
    const hover = this.cells.find((c) => pointInRect(m.x, m.y, c.rect));
    if (hover && m.moved && !same(hover.sel, this.sel) && !this.press?.dragging) {
      this.sel = hover.sel;
      moved = true;
    }
    if (hover && m.clicked) {
      this.press = {
        sel: hover.sel,
        x: m.x,
        y: m.y,
        wasSelected: same(hover.sel, this.sel),
        dragging: false,
      };
      this.sel = hover.sel;
    }
    if (this.press && m.down && Math.hypot(m.x - this.press.x, m.y - this.press.y) > 3) {
      const from = this.press.sel;
      this.press.dragging = from.kind === 'bag' && !!this.save.inventory[from.i];
    }
    if (this.press && m.released) {
      const p = this.press;
      this.press = null;
      if (p.dragging && hover) this.drop(p.sel, hover.sel);
      else if (!p.dragging && p.wasSelected && hover && same(hover.sel, p.sel)) this.activate();
      return;
    }
    if (hover && m.rightClicked) {
      this.sel = hover.sel;
      this.toggleLock();
      return;
    }
    const bagRows = Math.ceil(bagSize(this.save) / COLS);
    if (m.wheel) this.scroll = Math.max(0, Math.min(bagRows - this.rowsVisible, this.scroll + m.wheel));
    if (moved) {
      audio.playSfx('ui_move');
      if (this.sel.kind === 'bag') {
        const row = Math.floor(this.sel.i / COLS);
        if (row < this.scroll) this.scroll = row;
        if (row >= this.scroll + this.rowsVisible) this.scroll = row - this.rowsVisible + 1;
      }
      const it = this.selectedItem();
      if (it?.isNew) it.isNew = false;
    }
    if (this.held !== null) {
      // carrying an item: drop it with Confirm or Move, put it back with Cancel
      if (input.pressed('confirm') || input.pressed('menuAlt3')) {
        const from: Sel = { kind: 'bag', i: this.held };
        this.held = null;
        this.drop(from, this.sel);
      } else if (input.pressed('cancel')) {
        this.held = null;
        audio.playSfx('ui_back');
      }
      return;
    }
    if (input.pressed('confirm')) this.activate();
    if (input.pressed('menuAlt')) this.toggleLock();
    if (input.pressed('menuAlt2')) this.sortBag();
    if (input.pressed('menuAlt3') && this.sel.kind === 'bag' && this.save.inventory[this.sel.i]) {
      this.held = this.sel.i;
      audio.playSfx('ui_select');
    }
    if (input.pressed('cancel')) return 'close';
  }

  /** Carrying an item to a new slot: Escape puts it back instead of closing the menu. */
  busy(): boolean {
    return this.held !== null;
  }

  /** Drop a bag item onto a bag slot (reorder / swap) or onto a body slot (equip there). */
  private drop(from: Sel, to: Sel): void {
    if (from.kind !== 'bag') return;
    const g = this.menu.game;
    const s = this.save;
    const it = s.inventory[from.i];
    if (!it) return;
    if (to.kind === 'doll') {
      if (!equipSlotsFor(it.slot).includes(to.slot)) {
        audio.playSfx('ui_error');
        return;
      }
      equipItem(s, it.uid, to.slot);
      this.sel = to;
      audio.playSfx('equip');
      g.invalidateStats();
      this.menu.ws.world.player.syncFromSave(this.menu.ws.world);
      return;
    }
    if (!moveInList(s.inventory, from.i, to.i)) return;
    this.sel = { kind: 'bag', i: Math.min(to.i, s.inventory.length - 1) };
    audio.playSfx('equip');
    // moving charms changes which ones are active
    g.invalidateStats();
  }

  private activate(): void {
    const g = this.menu.game;
    const it = this.selectedItem();
    if (!it) return;
    if (this.sel.kind === 'doll') {
      if (unequip(this.save, this.sel.slot)) {
        audio.playSfx('equip');
        g.invalidateStats();
      } else {
        audio.playSfx('ui_error');
        g.toast('Bag is full.', 'ui_lock', 0, UI.bad);
      }
      return;
    }
    if (it.slot === 'charm') {
      audio.playSfx('ui_error');
      g.toast('Charms work from your bag — no need to equip them.', 'icon_charm_small', it.tier);
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
    const order: Record<Slot, number> = {
      charm: 0,
      weapon: 1,
      helm: 2,
      armor: 3,
      gloves: 4,
      belt: 5,
      boots: 6,
      ring: 7,
      amulet: 8,
    };
    // charms first (best first, so they stay active), then gear by type/rarity/power
    this.save.inventory.sort(
      (a, b) =>
        order[a.slot] - order[b.slot] ||
        RARITY_INDEX[b.rarity] - RARITY_INDEX[a.rarity] ||
        itemScore(b) - itemScore(a),
    );
    this.menu.game.invalidateStats();
    audio.playSfx('ui_tab');
    this.menu.game.toast('Bag sorted (charms first)', 'ui_check');
  }

  hints(): [string, string][] {
    const it = this.selectedItem();
    const h: [string, string][] = [];
    if (it && it.slot !== 'charm') h.push(['confirm', this.sel.kind === 'doll' ? 'Unequip' : 'Equip']);
    if (it) h.push(['menuAlt', it.locked ? 'Unlock' : 'Lock']);
    if (this.held !== null) return [['menuAlt3', 'Drop here']];
    h.push(['menuAlt2', 'Sort']);
    if (it && this.sel.kind === 'bag') h.push(['menuAlt3', 'Move']);
    return h;
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const s = this.save;
    this.cells = [];
    const dollW = 124;
    this.renderDoll(ctx, { x: r.x, y: r.y, w: dollW, h: r.h });

    // ---- bag grid
    const bx = r.x + dollW + 6;
    const charms = activeCharms(s);
    const charmCount = s.inventory.filter((i) => i.slot === 'charm').length;
    const size = bagSize(s);
    const limit = charmLimit(s);
    drawText(ctx, `Bag ${s.inventory.length}/${size}`, bx, r.y + 2, {
      color: s.inventory.length >= size ? UI.bad : UI.dim,
    });
    if (charmCount) {
      drawText(ctx, `Charms ${Math.min(charmCount, limit)}/${limit}`, bx + COLS * CELL - 2, r.y + 2, {
        align: 'right',
        color: charmCount > limit ? UI.accent : UI.cyan,
      });
    }
    this.rowsVisible = Math.max(3, Math.floor((r.h - 30) / CELL));
    const bagRows = Math.ceil(size / COLS);
    const activeSet = new Set(charms.map((c) => c.uid));
    for (let row = this.scroll; row < Math.min(bagRows, this.scroll + this.rowsVisible); row++) {
      for (let c = 0; c < COLS; c++) {
        const idx = row * COLS + c;
        if (idx >= size) break;
        const cx = bx + c * CELL;
        const cy = r.y + 14 + (row - this.scroll) * CELL;
        const it = s.inventory[idx] ?? null;
        const target = it && it.slot !== 'charm' ? compareTarget(s, it) : null;
        const better = !!it && it.slot !== 'charm' && itemScore(it) > (target ? itemScore(target) : 0);
        drawItemCell(ctx, it, cx, cy, this.sel.kind === 'bag' && this.sel.i === idx, undefined, better);
        if (it?.slot === 'charm') this.charmBadge(ctx, it, cx, cy, activeSet.has(it.uid));
        this.cells.push({ sel: { kind: 'bag', i: idx }, rect: { x: cx, y: cy, w: 18, h: 18 } });
      }
    }

    // ---- an item being moved: a ghost over its old slot, a copy on the cursor
    const carried =
      this.held ?? (this.press?.dragging && this.press.sel.kind === 'bag' ? this.press.sel.i : null);
    if (carried !== null && s.inventory[carried]) {
      const src = this.cells.find((c) => c.sel.kind === 'bag' && c.sel.i === carried);
      if (src) {
        ctx.fillStyle = 'rgba(24,20,37,0.6)';
        ctx.fillRect(src.rect.x, src.rect.y, 18, 18);
      }
      const m = this.menu.game.app.input.mouse;
      const at = this.press?.dragging
        ? { x: m.x - 9, y: m.y - 9 }
        : (() => {
            const c = this.cells.find((cc) => same(cc.sel, this.sel));
            return c ? { x: c.rect.x - 4, y: c.rect.y - 6 } : null;
          })();
      if (at) {
        const bob = Math.round(Math.sin(this.t * 6));
        drawItemCell(ctx, s.inventory[carried], at.x, at.y + bob, true);
      }
    }

    // ---- tooltip (drawn over the doll on narrow screens)
    const tx = bx + COLS * CELL + 8;
    const tipW = r.x + r.w - tx;
    const narrow = tipW < 110;
    const it = this.selectedItem();
    if (it) {
      drawTooltip(
        ctx,
        this.tooltip(it, activeSet.has(it.uid)),
        narrow ? r.x : tx,
        r.y + 2,
        narrow ? dollW : tipW,
        r.h - 16,
      );
    } else if (!narrow) {
      const label = this.sel.kind === 'doll' ? `${DOLL_LABEL[this.sel.slot]} — empty` : 'Select an item';
      drawText(ctx, label, tx + 4, r.y + 6, { color: UI.dim });
      if (this.sel.kind === 'doll')
        drawText(ctx, 'Equip gear from your bag.', tx + 4, r.y + 18, { color: UI.dim });
    }
  }

  private tooltip(it: Item, active: boolean): string[] {
    if (it.slot === 'charm') {
      const lines = itemTooltipLines(it, null, { price: 'sell' });
      lines.push('');
      lines.push(
        active
          ? '{cyan}Active{/} {gray}— works from your bag{/}'
          : `{gray}Inactive — only the first ${charmLimit(this.save)} charms in your bag are active. Move a charm earlier in the bag to activate it, or buy a Charm Satchel from Mira.{/}`,
      );
      if (it.cursed) lines.push('{red}Cursed: great power, at a price.{/}');
      return lines;
    }
    const compare = this.sel.kind === 'doll' ? null : compareTarget(this.save, it);
    const lines = itemTooltipLines(it, compare, { price: 'sell' });
    if (it.sockets?.some((g) => !g) && totalGems(this.save) > 0)
      lines.push('{gray}Socket gems from the Gems tab.{/}');
    if (this.sel.kind === 'bag') {
      const d = equipDelta(this.save, it, this.menu.game.buffs);
      if (d) {
        const fmt = (label: string, v: number, p?: number): string => {
          const sign = v >= 0 ? '+' : '-';
          const col = Math.abs(v) < 0.5 ? 'gray' : v > 0 ? 'green' : 'red';
          const pctTxt =
            p !== undefined && Math.abs(p) >= 0.001 ? ` (${sign}${Math.abs(p * 100).toFixed(1)}%)` : '';
          return `{${col}}${sign}${Math.abs(Math.round(v))} ${label}${pctTxt}{/}`;
        };
        lines.push(
          '',
          '{gray}If equipped:{/}',
          fmt('DPS', d.dps, d.dpsPct),
          fmt('Toughness', d.toughness, d.toughPct),
          fmt('Recovery', d.recovery),
        );
      }
    }
    return lines;
  }

  private charmBadge(ctx: CanvasRenderingContext2D, it: Item, x: number, y: number, active: boolean): void {
    if (!active) {
      ctx.fillStyle = 'rgba(24,20,37,0.55)';
      ctx.fillRect(x + 1, y + 1, 16, 16);
    } else if (Math.floor(this.t * 2) % 2 === 0) {
      ctx.fillStyle = UI.cyan;
      ctx.fillRect(x + 14, y + 14, 2, 2);
    }
    if (it.cursed) {
      ctx.fillStyle = '#e43b44';
      ctx.fillRect(x + 1, y + 14, 3, 3);
      ctx.fillRect(x + 1, y + 13, 1, 1);
    }
  }

  private renderDoll(ctx: CanvasRenderingContext2D, r: Rect): void {
    const g = this.menu.game;
    const s = this.save;
    const info = spriteInfo('hero');
    const frame = getSprite('hero', 'idle', Math.floor(this.t * 4) % (info.anims.idle?.frames ?? 1), 'down');
    const cxMid = r.x + r.w / 2;
    const ox = Math.round(cxMid - (info.w * S) / 2);
    const oy = r.y + 2;
    // backdrop: a soft glow and a pedestal shadow
    const glow = ctx.createRadialGradient(cxMid, oy + 70, 4, cxMid, oy + 70, 74);
    glow.addColorStop(0, 'rgba(44,232,245,0.18)');
    glow.addColorStop(1, 'rgba(44,232,245,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(r.x, oy, r.w, info.h * S + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cxMid, oy + info.h * S - 2, 36, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(frame, ox, oy, info.w * S, info.h * S);
    ctx.globalAlpha = 1;
    // gear sockets placed on the body
    for (const slot of EQUIP_SLOTS) {
      const [px, py] = DOLL[slot];
      const cx = Math.round(ox + px * S - 9);
      const cy = Math.round(oy + py * S - 9);
      const item = s.equipment[slot];
      const sel = this.sel.kind === 'doll' && this.sel.slot === slot;
      if (!item) {
        // translucent socket so the body shows through
        ctx.fillStyle = 'rgba(24,20,37,0.45)';
        ctx.fillRect(cx, cy, 18, 18);
        ctx.strokeStyle = sel ? UI.accent : 'rgba(139,155,180,0.7)';
        ctx.strokeRect(cx + 0.5, cy + 0.5, 17, 17);
        const ph = PLACEHOLDER[slot];
        ctx.globalAlpha = 0.35;
        ctx.drawImage(getIcon(SLOT_ICON[ph === 'weapon' ? 'sword' : ph], 0), cx + 1, cy + 1);
        ctx.globalAlpha = 1;
      } else {
        drawItemCell(ctx, item, cx, cy, sel);
      }
      this.cells.push({ sel: { kind: 'doll', slot }, rect: { x: cx, y: cy, w: 18, h: 18 } });
    }
    // summary under the doll
    const st = g.stats();
    const d = deriveStats(s.hero.level, st, s.equipment.weapon?.kind ?? 'sword');
    let y = oy + info.h * S + 6;
    const label =
      this.sel.kind === 'doll' ? DOLL_LABEL[this.sel.slot] : `${s.hero.name} • Lv ${s.hero.level}`;
    drawText(ctx, label, cxMid, y, { align: 'center', color: UI.accent });
    y += 11;
    drawText(ctx, `Power {gold}${powerRating(st)}{/}  DPS {red}${Math.round(d.dps)}{/}`, cxMid, y, {
      align: 'center',
    });
    y += 10;
    drawText(ctx, `Toughness {green}${Math.round(d.toughness)}{/}`, cxMid, y, { align: 'center' });
  }
}

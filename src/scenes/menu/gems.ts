/**
 * Gems tab: the gem pouch (combine three gems into one of the next quality) and
 * socketing gems into gear. Works anywhere, like modern ARPGs.
 *
 * Flows:
 *  - pick a gem, then the item (and the socket, if the item's sockets are all full)
 *  - pick an item, then a socket, then the gem
 */
import { getIcon } from '../../art/pixel';
import { audio } from '../../audio';
import { GEM_COMBINE_GOLD, GEM_INFO, GEM_TYPES, GEMS_PER_COMBINE, MAX_GEM_QUALITY } from '../../data/gems';
import { drawText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import {
  combineAll,
  combineGem,
  gemCount,
  gemEffect,
  gemIcon,
  gemLabel,
  gemName,
  returnGems,
  socketGem,
  socketGroup,
  totalGems,
  unsocketGem,
} from '../../game/gems';
import { displayName, formatStat, itemTypeLabel } from '../../game/items';
import { setFlag } from '../../game/state';
import type { Gem, Item, SocketGroup } from '../../game/types';
import { EQUIP_SLOTS } from '../../game/types';
import { drawItemCell, drawTooltip, ellipsize, itemTooltipLines, socketLines, UI } from '../../ui/widgets';
import { ConfirmScene } from '../confirm';
import type { MenuScene, TabView } from './menu';

const CELL = 19;
const ROW_H = 21;
const GROUPS: { group: SocketGroup; label: string }[] = [
  { group: 'weapon', label: 'Weapon' },
  { group: 'helm', label: 'Helm' },
  { group: 'armor', label: 'Other gear' },
];

type Mode =
  | { kind: 'browse' }
  /** A gem is chosen; pick the item to put it in. */
  | { kind: 'pickItem'; gem: Gem }
  /** An item is chosen; pick a socket (to fill with `gem`, or to choose a gem for). */
  | { kind: 'pickSocket'; uid: string; gem: Gem | null }
  /** An item and socket are chosen; pick the gem. */
  | { kind: 'pickGem'; uid: string; socket: number };

type Focus = { area: 'pouch'; col: number; row: number } | { area: 'gear'; i: number };

export class GemsTab implements TabView {
  readonly label = 'Gems';
  private mode: Mode = { kind: 'browse' };
  private focus: Focus = { area: 'pouch', col: 0, row: 0 };
  /** Where the cursor was before leaving browse mode (restored when coming back). */
  private browseFocus: Focus = this.focus;
  private socketSel = 0;
  private scroll = 0;
  private rowsVisible = 5;
  private cellRects: { col: number; row: number; rect: Rect }[] = [];
  private gearRects: { i: number; rect: Rect }[] = [];
  private socketRects: { i: number; rect: Rect }[] = [];

  constructor(private menu: MenuScene) {}

  private get save() {
    return this.menu.game.save;
  }

  /** Mid-way through socketing: Escape steps back instead of closing the menu. */
  busy(): boolean {
    return this.mode.kind !== 'browse';
  }

  /** Hidden until the hero has been to the Abyss or owns gems or socketed gear. */
  visible(): boolean {
    return this.save.stats.abyssBest > 0 || totalGems(this.save) > 0 || this.gear().length > 0;
  }

  /** Gear with sockets: equipped first, then the bag. */
  private gear(): Item[] {
    const s = this.save;
    const worn = EQUIP_SLOTS.map((sl) => s.equipment[sl]).filter((i): i is Item => !!i?.sockets?.length);
    return [...worn, ...s.inventory.filter((i) => i.sockets?.length)];
  }

  private equipped(it: Item): boolean {
    return EQUIP_SLOTS.some((sl) => this.save.equipment[sl]?.uid === it.uid);
  }

  private item(uid: string): Item | undefined {
    return this.gear().find((i) => i.uid === uid);
  }

  private focusedGem(): Gem | null {
    return this.focus.area === 'pouch' ? { type: GEM_TYPES[this.focus.row], q: this.focus.col } : null;
  }

  private focusedItem(): Item | null {
    return this.focus.area === 'gear' ? (this.gear()[this.focus.i] ?? null) : null;
  }

  // ---------------------------------------------------------------- update ----

  update(): 'close' | void {
    const input = this.menu.game.app.input;
    const gear = this.gear();
    if (this.focus.area === 'gear' && this.focus.i >= gear.length)
      this.focus = gear.length ? { area: 'gear', i: gear.length - 1 } : { area: 'pouch', col: 0, row: 0 };
    const m = this.mode;
    if ((m.kind === 'pickSocket' || m.kind === 'pickGem') && !this.item(m.uid)) this.toBrowse();

    if (input.pressed('cancel')) {
      if (this.mode.kind === 'browse') return 'close';
      this.back();
      return;
    }
    if (this.handleMouse()) return;

    if (this.mode.kind === 'pickSocket') {
      const it = this.item(this.mode.uid)!;
      const n = it.sockets!.length;
      if (input.repeat('left') || input.repeat('up')) {
        this.socketSel = (this.socketSel - 1 + n) % n;
        audio.playSfx('ui_move');
      }
      if (input.repeat('right') || input.repeat('down')) {
        this.socketSel = (this.socketSel + 1) % n;
        audio.playSfx('ui_move');
      }
      if (input.pressed('confirm')) this.confirm();
      if (input.pressed('menuAlt')) this.remove(it, this.socketSel);
      return;
    }
    let moved = false;
    if (input.repeat('left')) moved = this.move(-1, 0);
    if (input.repeat('right')) moved = this.move(1, 0) || moved;
    if (input.repeat('up')) moved = this.move(0, -1) || moved;
    if (input.repeat('down')) moved = this.move(0, 1) || moved;
    if (moved) audio.playSfx('ui_move');
    if (input.pressed('confirm')) this.confirm();
    if (this.mode.kind === 'browse') {
      if (input.pressed('menuAlt')) this.alt();
      if (input.pressed('menuAlt2')) this.combineEverything();
    }
  }

  private handleMouse(): boolean {
    const m = this.menu.game.app.input.mouse;
    if (this.mode.kind === 'pickSocket') {
      for (const s of this.socketRects) {
        if (!pointInRect(m.x, m.y, s.rect)) continue;
        if (m.moved) this.socketSel = s.i;
        if (m.clicked) {
          this.socketSel = s.i;
          this.confirm();
          return true;
        }
      }
      return false;
    }
    const pouchOk = this.mode.kind !== 'pickItem';
    const gearOk = this.mode.kind === 'browse' || this.mode.kind === 'pickItem';
    const hits: { focus: Focus; rect: Rect }[] = [
      ...(pouchOk
        ? this.cellRects.map((c) => ({
            focus: { area: 'pouch', col: c.col, row: c.row } as Focus,
            rect: c.rect,
          }))
        : []),
      ...(gearOk
        ? this.gearRects.map((g) => ({ focus: { area: 'gear', i: g.i } as Focus, rect: g.rect }))
        : []),
    ];
    for (const h of hits) {
      if (!pointInRect(m.x, m.y, h.rect)) continue;
      const same = JSON.stringify(h.focus) === JSON.stringify(this.focus);
      if (m.moved && !same) this.focus = h.focus;
      if (m.clicked) {
        this.focus = h.focus;
        if (same) this.confirm();
        return true;
      }
    }
    if (m.wheel && gearOk) {
      const max = Math.max(0, this.gear().length - this.rowsVisible);
      this.scroll = Math.max(0, Math.min(max, this.scroll + m.wheel));
    }
    return false;
  }

  /** Move the cursor; the pouch grid and gear list sit side by side. */
  private move(dx: number, dy: number): boolean {
    const gear = this.gear();
    const pouchOk = this.mode.kind !== 'pickItem';
    const gearOk = this.mode.kind === 'browse' || this.mode.kind === 'pickItem';
    const f = this.focus;
    if (f.area === 'pouch') {
      if (dx) {
        const col = f.col + dx;
        if (col < 0) return false;
        if (col > MAX_GEM_QUALITY) {
          if (!gearOk || !gear.length) return false;
          const i = Math.min(gear.length - 1, this.scroll + Math.min(f.row, this.rowsVisible - 1));
          this.focus = { area: 'gear', i };
          return true;
        }
        this.focus = { ...f, col };
        return true;
      }
      const row = f.row + dy;
      if (row < 0 || row >= GEM_TYPES.length) return false;
      this.focus = { ...f, row };
      return true;
    }
    if (dx < 0 && pouchOk) {
      this.focus = {
        area: 'pouch',
        col: MAX_GEM_QUALITY,
        row: Math.min(GEM_TYPES.length - 1, f.i - this.scroll),
      };
      return true;
    }
    if (!dy) return false;
    const i = f.i + dy;
    if (i < 0 || i >= gear.length) return false;
    this.focus = { area: 'gear', i };
    if (i < this.scroll) this.scroll = i;
    if (i >= this.scroll + this.rowsVisible) this.scroll = i - this.rowsVisible + 1;
    return true;
  }

  private leaveBrowse(): void {
    if (this.mode.kind === 'browse') this.browseFocus = this.focus;
  }

  private toBrowse(): void {
    this.mode = { kind: 'browse' };
    this.focus = this.browseFocus;
  }

  private back(): void {
    audio.playSfx('ui_back');
    const m = this.mode;
    if (m.kind === 'pickGem') {
      this.mode = { kind: 'pickSocket', uid: m.uid, gem: null };
    } else if (m.kind === 'pickSocket' && m.gem) {
      const i = this.gear().findIndex((g) => g.uid === m.uid);
      this.mode = { kind: 'pickItem', gem: m.gem };
      this.focus = { area: 'gear', i: Math.max(0, i) };
    } else this.toBrowse();
  }

  private confirm(): void {
    const s = this.save;
    const m = this.mode;
    switch (m.kind) {
      case 'browse': {
        if (this.focus.area === 'pouch') {
          const gem = this.focusedGem()!;
          if (gemCount(s, gem) < 1) return this.fail(`You have no ${gemName(gem)}.`);
          const gear = this.gear();
          if (!gear.length) return this.fail('You have no gear with sockets yet.');
          this.leaveBrowse();
          const empty = gear.findIndex((i) => i.sockets!.some((g) => !g));
          this.mode = { kind: 'pickItem', gem };
          this.focus = { area: 'gear', i: Math.max(0, empty) };
        } else {
          const it = this.focusedItem();
          if (!it) return;
          this.leaveBrowse();
          this.mode = { kind: 'pickSocket', uid: it.uid, gem: null };
          this.socketSel = Math.max(
            0,
            it.sockets!.findIndex((g) => !g),
          );
        }
        audio.playSfx('ui_select');
        return;
      }
      case 'pickItem': {
        const it = this.focusedItem();
        if (!it) return;
        const empty = it.sockets!.findIndex((g) => !g);
        if (empty >= 0) {
          this.place(it, empty, m.gem);
          this.toBrowse();
        } else {
          this.mode = { kind: 'pickSocket', uid: it.uid, gem: m.gem };
          this.socketSel = 0;
          audio.playSfx('ui_select');
        }
        return;
      }
      case 'pickSocket': {
        const it = this.item(m.uid)!;
        if (m.gem) {
          this.place(it, this.socketSel, m.gem);
          this.toBrowse();
          return;
        }
        this.mode = { kind: 'pickGem', uid: it.uid, socket: this.socketSel };
        const owned = this.firstOwned();
        if (owned) this.focus = owned;
        audio.playSfx('ui_select');
        return;
      }
      case 'pickGem': {
        const gem = this.focusedGem();
        if (!gem) return;
        if (gemCount(s, gem) < 1) return this.fail(`You have no ${gemName(gem)}.`);
        const it = this.item(m.uid)!;
        this.place(it, m.socket, gem);
        this.mode = { kind: 'pickSocket', uid: it.uid, gem: null };
        return;
      }
    }
  }

  /** The best gem you own (highest quality first), as a pouch cursor position. */
  private firstOwned(): Focus | null {
    for (let q = MAX_GEM_QUALITY; q >= 0; q--)
      for (let row = 0; row < GEM_TYPES.length; row++)
        if (gemCount(this.save, { type: GEM_TYPES[row], q }) > 0) return { area: 'pouch', col: q, row };
    return null;
  }

  private place(it: Item, index: number, gem: Gem): void {
    const prev = it.sockets![index];
    if (!socketGem(this.save, it, index, gem)) return this.fail('That gem is not in your pouch.');
    audio.playSfx('equip');
    this.menu.game.toast(
      `${gemLabel(gem)} → {${it.rarity}}${ellipsize(displayName(it), 120)}{/}${prev ? ` (${gemName(prev)} returned)` : ''}`,
      gemIcon(gem),
    );
    this.refresh(it);
  }

  private remove(it: Item, index: number): void {
    const g = unsocketGem(this.save, it, index);
    if (!g) return this.fail('That socket is empty.');
    audio.playSfx('pickup');
    this.menu.game.toast(`${gemLabel(g)} returned to your pouch`, gemIcon(g));
    this.refresh(it);
  }

  /** Socketed gems changed: update hero stats if the item is worn. */
  private refresh(it: Item): void {
    if (!this.equipped(it)) return;
    const g = this.menu.game;
    g.invalidateStats();
    this.menu.ws.world.player.syncFromSave(this.menu.ws.world);
  }

  private alt(): void {
    const s = this.save;
    if (this.focus.area === 'gear') {
      const it = this.focusedItem();
      if (!it) return;
      const n = returnGems(s, it);
      if (!n) return this.fail('This item has no gems to remove.');
      audio.playSfx('pickup');
      this.menu.game.toast(`${n} gem${n > 1 ? 's' : ''} returned to your pouch`, 'ui_check');
      this.refresh(it);
      return;
    }
    const gem = this.focusedGem()!;
    const r = combineGem(s, gem);
    if (r === 'max') return this.fail('Royal gems are already the highest quality.');
    if (r === 'few') return this.fail(`You need ${GEMS_PER_COMBINE} ${gemName(gem)} to combine.`);
    if (r === 'gold') return this.fail(`Combining costs ${GEM_COMBINE_GOLD[gem.q]} gold.`);
    const made = { type: gem.type, q: gem.q + 1 };
    if (made.q === MAX_GEM_QUALITY) setFlag(s, 'gem_royal');
    audio.playSfx('upgrade_success');
    this.menu.game.toast(`Created ${gemLabel(made)}!`, gemIcon(made));
  }

  private combineEverything(): void {
    const s = this.save;
    const plan = combineAll(s, true);
    if (!plan.combines || !plan.best) {
      const any = GEM_TYPES.some((type) =>
        Array.from({ length: MAX_GEM_QUALITY }, (_, q) => gemCount(s, { type, q })).some(
          (n) => n >= GEMS_PER_COMBINE,
        ),
      );
      return this.fail(
        any ? 'Not enough gold to combine.' : `Nothing to combine (need ${GEMS_PER_COMBINE} of a kind).`,
      );
    }
    const best = plan.best;
    this.menu.game.app.push(
      new ConfirmScene(
        this.menu.game,
        `Combine all gems? ${plan.combines} combine${plan.combines > 1 ? 's' : ''} for ${plan.gold}g. Best result: ${gemLabel(best)}.`,
        () => {
          combineAll(s);
          if (best.q === MAX_GEM_QUALITY) setFlag(s, 'gem_royal');
          audio.playSfx('upgrade_success');
          this.menu.game.toast(`Gems combined! Best: ${gemLabel(best)}`, gemIcon(best));
        },
      ),
    );
  }

  private fail(msg: string): void {
    audio.playSfx('ui_error');
    this.menu.game.toast(msg, 'ui_lock', 0, UI.bad);
  }

  hints(): [string, string][] {
    const m = this.mode;
    switch (m.kind) {
      case 'browse':
        if (this.focus.area === 'pouch')
          return [
            ['confirm', 'Socket'],
            ['menuAlt', 'Combine'],
            ['menuAlt2', 'Combine all'],
          ];
        return [
          ['confirm', 'Sockets'],
          ['menuAlt', 'Remove gems'],
          ['menuAlt2', 'Combine all'],
        ];
      case 'pickItem':
        return [['confirm', 'Socket here']];
      case 'pickSocket':
        return m.gem
          ? [['confirm', 'Replace']]
          : [
              ['confirm', 'Choose gem'],
              ['menuAlt', 'Remove'],
            ];
      case 'pickGem':
        return [['confirm', 'Socket']];
    }
  }

  // ---------------------------------------------------------------- render ----

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    this.cellRects = [];
    this.gearRects = [];
    this.socketRects = [];
    const gridW = (MAX_GEM_QUALITY + 1) * CELL - 1;
    this.renderPouch(ctx, { x: r.x, y: r.y, w: gridW, h: r.h });
    const rx = r.x + gridW + 8;
    const right = { x: rx, y: r.y, w: r.x + r.w - rx, h: r.h };
    if (this.mode.kind === 'pickSocket' || this.mode.kind === 'pickGem') this.renderSockets(ctx, right);
    else this.renderGear(ctx, right);
  }

  private renderPouch(ctx: CanvasRenderingContext2D, r: Rect): void {
    const s = this.save;
    const active = this.mode.kind === 'browse' || this.mode.kind === 'pickGem';
    drawText(ctx, this.mode.kind === 'pickGem' ? '{gold}Choose a gem{/}' : 'Gem Pouch', r.x, r.y + 2, {
      color: UI.dim,
    });
    drawText(ctx, `${s.hero.gold}g`, r.x + r.w, r.y + 2, { align: 'right', color: UI.accent });
    const gy = r.y + 14;
    GEM_TYPES.forEach((type, row) => {
      for (let col = 0; col <= MAX_GEM_QUALITY; col++) {
        const gem = { type, q: col };
        const n = gemCount(s, gem);
        const x = r.x + col * CELL;
        const y = gy + row * CELL;
        const sel = active && this.focus.area === 'pouch' && this.focus.col === col && this.focus.row === row;
        ctx.fillStyle = sel ? UI.sel : '#1d1a2e';
        ctx.fillRect(x, y, 18, 18);
        ctx.globalAlpha = active ? 1 : 0.5;
        ctx.drawImage(this.icon(gem), x + 1, y + 1);
        ctx.globalAlpha = 1;
        if (!n) {
          ctx.fillStyle = 'rgba(24,20,37,0.72)';
          ctx.fillRect(x, y, 18, 18);
        } else drawText(ctx, String(n), x + 18, y + 10, { align: 'right', outline: UI.bg });
        if (sel) {
          ctx.strokeStyle = UI.accent;
          ctx.strokeRect(x - 0.5, y - 0.5, 19, 19);
        }
        this.cellRects.push({ col, row, rect: { x, y, w: 18, h: 18 } });
      }
    });
    const iy = gy + GEM_TYPES.length * CELL + 3;
    const gem = this.focus.area === 'pouch' ? this.focusedGem() : null;
    if (gem && active) drawTooltip(ctx, this.gemLines(gem), r.x, iy, r.w, r.y + r.h - iy);
    else
      drawTooltip(
        ctx,
        [
          '{gray}Gems drop only in the Abyss. Deeper floors drop better gems.{/}',
          '',
          `{gray}Combine ${GEMS_PER_COMBINE} of a kind into the next quality.{/}`,
        ],
        r.x,
        iy,
        r.w,
        r.y + r.h - iy,
      );
  }

  private icon(gem: Gem): CanvasImageSource {
    return getIcon(gemIcon(gem));
  }

  /** Tooltip for a pouch gem: what it does in each kind of gear and what combining costs. */
  private gemLines(gem: Gem): string[] {
    const s = this.save;
    const n = gemCount(s, gem);
    const lines = [`${gemLabel(gem)} {gray}×${n}{/}`];
    const m = this.mode;
    if (m.kind === 'pickGem') {
      const it = this.item(m.uid);
      if (it) {
        const e = gemEffect(gem, socketGroup(it.slot));
        lines.push(`{green}${formatStat(e.stat, e.value)}{/} {gray}here{/}`);
        const prev = it.sockets![m.socket];
        if (prev) lines.push(`{gray}Replaces ${gemName(prev)}{/}`);
        return lines;
      }
    }
    for (const { group, label } of GROUPS) {
      const e = gemEffect(gem, group);
      lines.push(`{gray}${label}:{/} ${formatStat(e.stat, e.value)}`);
    }
    if (gem.q < MAX_GEM_QUALITY) {
      const next = { type: gem.type, q: gem.q + 1 };
      const cost = GEM_COMBINE_GOLD[gem.q];
      const ready = n >= GEMS_PER_COMBINE && s.hero.gold >= cost;
      lines.push(`${ready ? '{gold}' : '{gray}'}${GEMS_PER_COMBINE} → ${gemName(next)}: ${cost}g{/}`);
    } else lines.push('{gold}Highest quality!{/}');
    return lines;
  }

  private renderGear(ctx: CanvasRenderingContext2D, r: Rect): void {
    const gear = this.gear();
    const m = this.mode;
    drawText(
      ctx,
      m.kind === 'pickItem' ? `Socket ${gemLabel(m.gem)} into...` : 'Socketed Gear',
      r.x,
      r.y + 2,
      { color: m.kind === 'pickItem' ? UI.text : UI.dim },
    );
    if (!gear.length) {
      drawTooltip(
        ctx,
        [
          '{gray}No socketed gear yet.{/}',
          '',
          '{abyssal}Abyssal{/} items always have sockets, and other gear found in the Abyss sometimes does.',
        ],
        r.x,
        r.y + 14,
        r.w,
      );
      return;
    }
    const detailH = 58;
    this.rowsVisible = Math.max(2, Math.floor((r.h - 16 - detailH) / ROW_H));
    this.scroll = Math.max(0, Math.min(this.scroll, gear.length - this.rowsVisible));
    const top = r.y + 14;
    for (let k = 0; k < this.rowsVisible; k++) {
      const i = this.scroll + k;
      const it = gear[i];
      if (!it) break;
      const y = top + k * ROW_H;
      const sel = this.focus.area === 'gear' && this.focus.i === i;
      if (sel) {
        ctx.fillStyle = UI.sel;
        ctx.fillRect(r.x, y - 1, r.w, ROW_H - 1);
      }
      drawItemCell(ctx, it, r.x + 1, y, false);
      const nameW = r.w - 34;
      drawText(ctx, `{${it.rarity}}${ellipsize(displayName(it), nameW)}{/}`, r.x + 22, y + 1);
      const pips = it.sockets!.map((g) => (g ? `{${GEM_INFO[g.type].markup}}◆{/}` : '{gray}◇{/}')).join('');
      drawText(ctx, `${pips} {gray}${itemTypeLabel(it)}{/}`, r.x + 22, y + 10);
      if (this.equipped(it)) drawText(ctx, 'E', r.x + r.w - 3, y + 1, { align: 'right', color: UI.good });
      this.gearRects.push({ i, rect: { x: r.x, y: y - 1, w: r.w, h: ROW_H - 1 } });
    }
    if (gear.length > this.rowsVisible)
      drawText(
        ctx,
        `${this.scroll + 1}-${Math.min(gear.length, this.scroll + this.rowsVisible)} of ${gear.length}`,
        r.x + r.w,
        r.y + 2,
        { align: 'right', color: UI.dim },
      );
    const it = this.focusedItem();
    if (it) {
      const shown = Math.min(this.rowsVisible, gear.length - this.scroll);
      const dy = top + shown * ROW_H + 2;
      drawTooltip(ctx, socketLines(it), r.x, dy, r.w, r.y + r.h - dy);
    }
  }

  /** One item's sockets as big slots, plus its full tooltip. */
  private renderSockets(ctx: CanvasRenderingContext2D, r: Rect): void {
    const m = this.mode as Extract<Mode, { kind: 'pickSocket' | 'pickGem' }>;
    const it = this.item(m.uid);
    if (!it) return;
    const title =
      m.kind === 'pickGem'
        ? 'Choose a gem from your pouch'
        : m.gem
          ? `Replace which gem with ${gemLabel(m.gem)}?`
          : 'Choose a socket';
    drawText(ctx, title, r.x, r.y + 2);
    const y = r.y + 14;
    const sel = m.kind === 'pickSocket' ? this.socketSel : m.socket;
    it.sockets!.forEach((g, i) => {
      const x = r.x + i * 24;
      ctx.fillStyle = i === sel ? UI.sel : '#1d1a2e';
      ctx.fillRect(x, y, 20, 20);
      ctx.strokeStyle = g ? GEM_INFO[g.type].color : '#5a6988';
      ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
      if (g) ctx.drawImage(this.icon(g), x + 2, y + 2);
      else drawText(ctx, '◇', x + 10, y + 7, { align: 'center', color: UI.dim });
      if (i === sel) {
        ctx.strokeStyle = UI.accent;
        ctx.strokeRect(x - 0.5, y - 0.5, 21, 21);
      }
      this.socketRects.push({ i, rect: { x, y, w: 20, h: 20 } });
    });
    const ty = y + 26;
    drawTooltip(ctx, itemTooltipLines(it, null), r.x, ty, r.w, r.y + r.h - ty);
  }
}

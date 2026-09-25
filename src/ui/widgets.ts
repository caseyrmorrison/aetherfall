/** Reusable pixel UI primitives: panels, bars, key prompts, list views and item tooltips. */
import { RARITY_COLORS } from '../art/palette';
import { getIcon } from '../art/pixel';
import type { IconId } from '../art/pixel/types';
import { audio } from '../audio';
import { LEGENDARIES, SLOT_ICON } from '../data/items';
import { drawText, LINE_HEIGHT, measureText, wrapText } from '../engine/font';
import type { Action, Input } from '../engine/input';
import { pointInRect, type Rect } from '../engine/math';
import { sellPrice } from '../game/balance';
import {
  displayName,
  formatStat,
  itemScore,
  itemStats,
  itemTypeLabel,
  RARITY_INDEX,
  statDiff,
} from '../game/items';
import type { Item, StatKey } from '../game/types';
import { STAT_INFO } from '../game/types';

export const UI = {
  bg: '#181425',
  bg2: '#262b44',
  border: '#5a6988',
  borderHi: '#8b9bb4',
  sel: '#3a4466',
  accent: '#feae34',
  text: '#ffffff',
  dim: '#8b9bb4',
  good: '#63c74d',
  bad: '#e43b44',
  mana: '#0099db',
  cyan: '#2ce8f5',
};

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { alpha?: number; border?: string; fill?: string; title?: string } = {},
): void {
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  ctx.globalAlpha = opts.alpha ?? 0.94;
  ctx.fillStyle = opts.fill ?? UI.bg;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = opts.border ?? UI.border;
  ctx.fillRect(x + 2, y, w - 4, 1);
  ctx.fillRect(x + 2, y + h - 1, w - 4, 1);
  ctx.fillRect(x, y + 2, 1, h - 4);
  ctx.fillRect(x + w - 1, y + 2, 1, h - 4);
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + w - 2, y + 1, 1, 1);
  ctx.fillRect(x + 1, y + h - 2, 1, 1);
  ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  ctx.fillStyle = UI.bg2;
  ctx.fillRect(x + 2, y + 1, w - 4, 1);
  if (opts.title) {
    ctx.fillStyle = UI.bg2;
    ctx.fillRect(x + 2, y + 2, w - 4, 11);
    drawText(ctx, opts.title, x + 6, y + 3, { color: UI.accent });
  }
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string,
  opts: { ghost?: number; bg?: string; border?: string; shine?: boolean } = {},
): void {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = opts.border ?? UI.bg;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = opts.bg ?? '#3e2731';
  ctx.fillRect(x, y, w, h);
  const f = Math.max(0, Math.min(1, frac));
  if (opts.ghost !== undefined && opts.ghost > f) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, Math.round(w * Math.min(1, opts.ghost)), h);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * f), h);
  if (opts.shine !== false && h >= 3) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, Math.round(w * f), 1);
    ctx.globalAlpha = 1;
  }
}

/** Draw a key-cap style prompt, returns width used. */
export function drawKey(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): number {
  const w = Math.max(9, measureText(label) + 5);
  ctx.fillStyle = '#c0cbdc';
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = '#8b9bb4';
  ctx.fillRect(x, y + 9, w, 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 1, y, w - 2, 1);
  drawText(ctx, label, x + Math.round((w - measureText(label)) / 2), y + 1, { color: UI.bg, shadow: false });
  return w;
}

/** Row of "[key] Label" hints aligned right or left. Returns total width. */
export function drawHints(
  ctx: CanvasRenderingContext2D,
  input: Input,
  hints: [Action | string, string][],
  x: number,
  y: number,
  align: 'left' | 'right' = 'right',
): number {
  const parts = hints.map(([a, label]) => ({
    key: a.length <= 6 && /^[A-Z0-9]/.test(a) ? a : input.label(a as Action),
    label,
  }));
  let total = 0;
  for (const p of parts) total += Math.max(9, measureText(p.key) + 5) + 3 + measureText(p.label) + 8;
  let cx = align === 'right' ? x - total : x;
  for (const p of parts) {
    cx += drawKey(ctx, p.key, cx, y) + 3;
    drawText(ctx, p.label, cx, y + 1, { color: UI.dim });
    cx += measureText(p.label) + 8;
  }
  return total;
}

export function drawIcon(
  ctx: CanvasRenderingContext2D,
  id: IconId,
  x: number,
  y: number,
  tier = 0,
  alpha = 1,
): void {
  ctx.globalAlpha = alpha;
  ctx.drawImage(getIcon(id, tier), Math.round(x), Math.round(y));
  ctx.globalAlpha = 1;
}

export function itemIcon(item: Item): IconId {
  return SLOT_ICON[item.slot === 'weapon' ? (item.kind ?? 'sword') : item.slot];
}

/** Item slot square with rarity frame. */
export function drawItemCell(
  ctx: CanvasRenderingContext2D,
  item: Item | null,
  x: number,
  y: number,
  selected: boolean,
  placeholder?: IconId,
): void {
  ctx.fillStyle = selected ? UI.sel : '#1d1a2e';
  ctx.fillRect(x, y, 18, 18);
  ctx.fillStyle = item ? RARITY_COLORS[item.rarity] : '#3a4466';
  ctx.globalAlpha = item ? 0.9 : 0.6;
  ctx.fillRect(x, y, 18, 1);
  ctx.fillRect(x, y + 17, 18, 1);
  ctx.fillRect(x, y, 1, 18);
  ctx.fillRect(x + 17, y, 1, 18);
  ctx.globalAlpha = 1;
  if (item) {
    drawIcon(ctx, itemIcon(item), x + 1, y + 1, item.tier);
    if (item.locked) {
      ctx.fillStyle = UI.accent;
      ctx.fillRect(x + 14, y + 2, 2, 2);
    }
    if (item.isNew) {
      ctx.fillStyle = UI.cyan;
      ctx.fillRect(x + 2, y + 2, 2, 2);
    }
    if (item.upgrade > 0)
      drawText(ctx, `+${item.upgrade}`, x + 17, y + 10, { align: 'right', color: UI.accent, outline: UI.bg });
  } else if (placeholder) {
    drawIcon(ctx, placeholder, x + 1, y + 1, 0, 0.25);
  }
  if (selected) {
    ctx.strokeStyle = UI.accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, 19, 19);
  }
}

/** Tooltip lines for an item, with comparison against `compare`. */
export function itemTooltipLines(
  item: Item,
  compare: Item | null,
  opts: { price?: 'sell' | number } = {},
): string[] {
  const lines: string[] = [];
  lines.push(`{${item.rarity}}${displayName(item)}{/}`);
  const rarityName = item.rarity[0].toUpperCase() + item.rarity.slice(1);
  lines.push(`{gray}${rarityName} ${itemTypeLabel(item)} • iLvl ${item.ilvl}{/}`);
  const power = itemScore(item);
  if (compare && compare !== item) {
    const d = power - itemScore(compare);
    lines.push(`Power ${power} ${d >= 0 ? `{green}▲${d}{/}` : `{red}▼${-d}{/}`}`);
  } else lines.push(`Power ${power}`);
  lines.push('');
  const st = itemStats(item);
  const diff = compare && compare !== item ? statDiff(item, compare) : null;
  for (const [k, v] of Object.entries(st) as [StatKey, number][]) {
    let line = formatStat(k, v);
    if (diff && diff[k] !== undefined && Math.abs(diff[k]!) > 1e-6) {
      const d = diff[k]!;
      const txt = STAT_INFO[k].pct
        ? `${Math.round(Math.abs(d) * 100)}%`
        : `${Math.abs(d) < 10 && !Number.isInteger(d) ? Math.abs(d).toFixed(1) : Math.round(Math.abs(d))}`;
      line += d > 0 ? ` {green}(+${txt}){/}` : ` {red}(-${txt}){/}`;
    }
    lines.push(line);
  }
  if (diff) {
    for (const [k, d] of Object.entries(diff) as [StatKey, number][]) {
      if (st[k] !== undefined) continue;
      lines.push(`{red}${formatStat(k, d)}{/}`);
    }
  }
  if (item.legendary) {
    const def = LEGENDARIES.find((l) => l.id === item.legendary);
    if (def) {
      lines.push('');
      lines.push(`{legendary}★ ${def.power}{/}`);
    }
  }
  if (item.locked) lines.push('{gold}Locked{/}');
  if (opts.price === 'sell')
    lines.push(`{gold}Sell: ${sellPrice(item.ilvl, RARITY_INDEX[item.rarity], item.upgrade)}g{/}`);
  else if (typeof opts.price === 'number') lines.push(`{gold}Price: ${opts.price}g{/}`);
  return lines;
}

/** Draw a tooltip panel of wrapped lines. Returns its height. */
export function drawTooltip(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  w: number,
  maxH = 999,
): number {
  const wrapped: string[] = [];
  for (const l of lines) {
    if (!l) wrapped.push('');
    else wrapped.push(...wrapText(l, w - 10));
  }
  const h = Math.min(maxH, wrapped.length * LINE_HEIGHT + 8);
  drawPanel(ctx, x, y, w, h, { alpha: 0.97 });
  let cy = y + 5;
  for (const l of wrapped) {
    if (cy + LINE_HEIGHT > y + h) break;
    if (l) drawText(ctx, l, x + 5, cy);
    cy += l ? LINE_HEIGHT : 5;
  }
  return h;
}

/**
 * Vertical list with keyboard/gamepad navigation, auto-repeat, mouse hover/click
 * and wheel scrolling.
 */
export class ListView<T> {
  index = 0;
  scroll = 0;
  private rects: { rect: Rect; i: number }[] = [];
  private region: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    public items: T[],
    public rowH = 12,
    public visibleRows = 10,
    public wrap = true,
  ) {}

  get selected(): T | undefined {
    return this.items[this.index];
  }

  setItems(items: T[]): void {
    this.items = items;
    this.index = Math.max(0, Math.min(this.index, items.length - 1));
    this.clampScroll();
  }

  private clampScroll(): void {
    if (this.index < this.scroll) this.scroll = this.index;
    if (this.index >= this.scroll + this.visibleRows) this.scroll = this.index - this.visibleRows + 1;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this.items.length - this.visibleRows)));
  }

  /** Handle input. Returns 'confirm' / 'cancel' / 'move' / null. */
  update(
    input: Input,
    opts: { enabled?: (item: T) => boolean; noCancel?: boolean } = {},
  ): 'confirm' | 'cancel' | 'move' | null {
    const n = this.items.length;
    let moved = false;
    if (n > 0) {
      if (input.repeat('up')) {
        this.index = this.wrap ? (this.index - 1 + n) % n : Math.max(0, this.index - 1);
        moved = true;
      }
      if (input.repeat('down')) {
        this.index = this.wrap ? (this.index + 1) % n : Math.min(n - 1, this.index + 1);
        moved = true;
      }
      const m = input.mouse;
      if (m.wheel !== 0 && pointInRect(m.x, m.y, this.region)) {
        this.scroll = Math.max(0, Math.min(Math.max(0, n - this.visibleRows), this.scroll + m.wheel));
      }
      for (const r of this.rects) {
        if (pointInRect(m.x, m.y, r.rect)) {
          if (m.moved && this.index !== r.i) {
            this.index = r.i;
            moved = true;
          }
          if (m.clicked) {
            this.index = r.i;
            const it = this.items[r.i];
            if (opts.enabled && !opts.enabled(it)) {
              audio.playSfx('ui_error');
              return null;
            }
            audio.playSfx('ui_select');
            return 'confirm';
          }
        }
      }
    }
    if (moved) {
      this.clampScroll();
      audio.playSfx('ui_move');
      return 'move';
    }
    if (input.pressed('confirm') && n > 0) {
      const it = this.items[this.index];
      if (opts.enabled && !opts.enabled(it)) {
        audio.playSfx('ui_error');
        return null;
      }
      audio.playSfx('ui_select');
      return 'confirm';
    }
    if (!opts.noCancel && (input.pressed('cancel') || input.mouse.rightClicked)) {
      audio.playSfx('ui_back');
      return 'cancel';
    }
    return null;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    row: (item: T, x: number, y: number, selected: boolean, i: number) => void,
  ): void {
    this.rects = [];
    this.region = { x, y, w, h: this.visibleRows * this.rowH };
    const end = Math.min(this.items.length, this.scroll + this.visibleRows);
    for (let i = this.scroll; i < end; i++) {
      const ry = y + (i - this.scroll) * this.rowH;
      const sel = i === this.index;
      if (sel) {
        ctx.fillStyle = UI.sel;
        ctx.fillRect(x, ry, w, this.rowH);
        ctx.fillStyle = UI.accent;
        ctx.fillRect(x, ry, 2, this.rowH);
      }
      row(this.items[i], x + 4, ry + Math.floor((this.rowH - 8) / 2), sel, i);
      this.rects.push({ rect: { x, y: ry, w, h: this.rowH }, i });
    }
    // scrollbar
    if (this.items.length > this.visibleRows) {
      const th = this.visibleRows * this.rowH;
      const bh = Math.max(6, (th * this.visibleRows) / this.items.length);
      const by = y + ((th - bh) * this.scroll) / Math.max(1, this.items.length - this.visibleRows);
      ctx.fillStyle = UI.bg2;
      ctx.fillRect(x + w + 2, y, 2, th);
      ctx.fillStyle = UI.border;
      ctx.fillRect(x + w + 2, Math.round(by), 2, Math.round(bh));
    }
  }
}

/** Fit text with ellipsis. */
export function ellipsize(text: string, maxW: number): string {
  if (measureText(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && measureText(t + '..') > maxW) t = t.slice(0, -1);
  return t + '..';
}

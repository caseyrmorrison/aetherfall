/** Items tab: consumables (usable) and crafting/quest materials. */
import { audio } from '../../audio';
import { CONSUMABLES, MATERIALS } from '../../data/items';
import { drawText } from '../../engine/font';
import type { Rect } from '../../engine/math';
import { addConsumable } from '../../game/state';
import type { ConsumableId, MaterialId } from '../../game/types';
import { drawIcon, drawTooltip, ListView, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

type Row = { kind: 'c'; id: ConsumableId } | { kind: 'm'; id: MaterialId };

export class ItemsTab implements TabView {
  readonly label = 'Items';
  private list = new ListView<Row>([], 14, 12, false);

  constructor(private menu: MenuScene) {}

  private rows(): Row[] {
    const s = this.menu.game.save;
    const out: Row[] = [];
    for (const id of Object.keys(CONSUMABLES) as ConsumableId[])
      if ((s.consumables[id] ?? 0) > 0) out.push({ kind: 'c', id });
    for (const id of Object.keys(MATERIALS) as MaterialId[])
      if ((s.materials[id] ?? 0) > 0) out.push({ kind: 'm', id });
    return out;
  }

  update(): 'close' | void {
    this.list.setItems(this.rows());
    const r = this.list.update(this.menu.game.app.input);
    if (r === 'cancel') return 'close';
    if (r === 'confirm' && this.list.selected?.kind === 'c') this.use(this.list.selected.id);
  }

  private use(id: ConsumableId): void {
    const g = this.menu.game;
    const world = this.menu.ws.world;
    const p = world.player;
    switch (id) {
      case 'elixir':
        if (p.hp >= p.maxHp && p.mp >= p.maxMp) {
          audio.playSfx('ui_error');
          return;
        }
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        audio.playSfx('heal');
        break;
      case 'tonic_might':
        g.buffs.might = 180;
        g.invalidateStats();
        audio.playSfx('potion');
        break;
      case 'tonic_guard':
        g.buffs.guard = 180;
        g.invalidateStats();
        audio.playSfx('potion');
        break;
      case 'phoenix':
        audio.playSfx('ui_error');
        g.toast('Phoenix Feathers activate automatically when you fall.', 'icon_phoenix');
        return;
    }
    addConsumable(g.save, id, -1);
    g.toast(`Used ${CONSUMABLES[id].name}`, CONSUMABLES[id].icon);
  }

  hints(): [string, string][] {
    return this.list.selected?.kind === 'c' ? [['confirm', 'Use']] : [];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const s = this.menu.game.save;
    const listW = Math.min(200, r.w / 2);
    this.list.visibleRows = Math.floor((r.h - 20) / 14);
    if (!this.list.items.length)
      drawText(
        ctx,
        'No items yet. Buy supplies from Mira, or collect materials from monsters.',
        r.x + 6,
        r.y + 6,
        { color: UI.dim },
      );
    this.list.draw(ctx, r.x, r.y + 2, listW, (row, x, y) => {
      if (row.kind === 'c') {
        const d = CONSUMABLES[row.id];
        drawIcon(ctx, d.icon, x, y - 4);
        drawText(ctx, d.name, x + 18, y);
        drawText(ctx, `×${s.consumables[row.id]}`, x + listW - 10, y, { align: 'right', color: UI.accent });
      } else {
        const d = MATERIALS[row.id];
        drawIcon(ctx, d.icon, x, y - 4);
        drawText(ctx, d.name, x + 18, y, { color: '#c0cbdc' });
        drawText(ctx, `×${s.materials[row.id]}`, x + listW - 10, y, { align: 'right', color: UI.accent });
      }
    });
    const row = this.list.selected;
    if (row) {
      const lines =
        row.kind === 'c'
          ? [`{gold}${CONSUMABLES[row.id].name}{/}`, '', CONSUMABLES[row.id].desc]
          : [`{light}${MATERIALS[row.id].name}{/}`, '{gray}Material{/}', '', MATERIALS[row.id].desc];
      drawTooltip(ctx, lines, r.x + listW + 12, r.y + 2, r.w - listW - 12);
    }
    const g = this.menu.game;
    let y = r.y + r.h - 30;
    if (g.buffs.might > 0) {
      drawText(ctx, `Might: ${Math.ceil(g.buffs.might)}s`, r.x + listW + 16, y, { color: UI.bad });
      y += 10;
    }
    if (g.buffs.guard > 0)
      drawText(ctx, `Guarding: ${Math.ceil(g.buffs.guard)}s`, r.x + listW + 16, y, { color: UI.mana });
  }
}

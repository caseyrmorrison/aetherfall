/**
 * Crafting panel shared by Mira's shop (alchemy) and Brom's forge (forging):
 * a recipe list with material checks, and an item picker for Socket Punch.
 */
import { audio } from '../audio';
import { CONSUMABLES, MATERIALS } from '../data/items';
import { recipesFor, type Recipe, type Station } from '../data/recipes';
import { drawText } from '../engine/font';
import { rng } from '../engine/rng';
import { CRAFT_ILVL_BONUS, craft, craftBlocker, socketTargets } from '../game/crafting';
import type { Game } from '../game/game';
import { displayName, itemIcon, tierForLevel } from '../game/items';
import type { Item, MaterialId } from '../game/types';
import { drawIcon, drawTooltip, ellipsize, itemTooltipLines, ListView, UI } from '../ui/widgets';

interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class CraftView {
  private list: ListView<Recipe>;
  /** Choosing the item for a Socket Punch. */
  private picker: { recipe: Recipe; list: ListView<Item> } | null = null;

  constructor(
    private game: Game,
    station: Station,
  ) {
    this.list = new ListView(recipesFor(station), 14, 10, false);
  }

  reset(): void {
    this.picker = null;
  }

  /** Returns 'cancel' when backing out of the whole panel. */
  update(): 'cancel' | void {
    const input = this.game.app.input;
    if (this.picker) {
      const r = this.picker.list.update(input);
      if (r === 'cancel') {
        audio.playSfx('ui_back');
        this.picker = null;
      } else if (r === 'confirm' && this.picker.list.selected)
        this.make(this.picker.recipe, this.picker.list.selected);
      return;
    }
    const r = this.list.update(input);
    if (r === 'cancel') return 'cancel';
    if (r !== 'confirm' || !this.list.selected) return;
    const recipe = this.list.selected;
    const why = craftBlocker(this.game.save, recipe);
    if (why) return this.fail(why);
    if (recipe.result.kind === 'socket') {
      audio.playSfx('ui_select');
      this.picker = { recipe, list: new ListView(socketTargets(this.game.save), 12, 12, false) };
      return;
    }
    this.make(recipe);
  }

  private make(recipe: Recipe, target?: Item): void {
    const g = this.game;
    const res = craft(g.save, recipe, rng, target);
    if (!res) return this.fail(craftBlocker(g.save, recipe) ?? 'Could not craft that.');
    this.picker = null;
    g.invalidateStats();
    g.events.emit('materialsChanged', undefined);
    switch (res.kind) {
      case 'item':
        audio.playSfx(
          res.item.rarity === 'common' || res.item.rarity === 'uncommon' ? 'upgrade_success' : 'pickup_rare',
        );
        g.toast(`Crafted {${res.item.rarity}}${displayName(res.item)}{/}`, itemIcon(res.item), res.item.tier);
        break;
      case 'consumable':
        audio.playSfx('potion');
        g.toast(`Brewed ${CONSUMABLES[res.id].name}`, CONSUMABLES[res.id].icon);
        break;
      case 'material':
        audio.playSfx('salvage');
        g.toast(`+${res.count} ${MATERIALS[res.id].name}`, MATERIALS[res.id].icon);
        break;
      case 'socket':
        audio.playSfx('upgrade_success');
        g.toast(`Socket added to {${res.item.rarity}}${displayName(res.item)}{/}`, 'icon_void');
        break;
    }
  }

  private fail(msg: string): void {
    audio.playSfx('ui_error');
    this.game.toast(msg, 'ui_lock', 0, UI.bad);
  }

  hints(): [string, string][] {
    return this.picker
      ? [
          ['confirm', 'Add socket'],
          ['cancel', 'Back'],
        ]
      : [['confirm', 'Craft']];
  }

  render(ctx: CanvasRenderingContext2D, f: Frame): void {
    const s = this.game.save;
    const listW = Math.min(220, f.w - 150);
    const tipX = f.x + listW + 14;
    const tipW = f.w - listW - 20;
    if (this.picker) {
      const list = this.picker.list;
      list.visibleRows = Math.floor((f.h - 30) / 12);
      drawText(ctx, 'Add a socket to which item?', f.x + 8, f.y + 4, { color: UI.dim });
      list.draw(ctx, f.x + 4, f.y + 16, listW, (it, x, y) => {
        drawIcon(ctx, itemIcon(it), x, y - 4, it.tier);
        drawText(ctx, `{${it.rarity}}${ellipsize(displayName(it), listW - 30)}{/}`, x + 18, y);
      });
      if (list.selected)
        drawTooltip(ctx, itemTooltipLines(list.selected, null), tipX, f.y + 4, tipW, f.h - 30);
      return;
    }
    this.list.visibleRows = Math.floor((f.h - 30) / 14);
    const tier = tierForLevel(s.hero.level);
    this.list.draw(ctx, f.x + 4, f.y + 4, listW, (r, x, y) => {
      const ok = !craftBlocker(s, r);
      drawIcon(ctx, r.icon, x, y - 4, tier, ok ? 1 : 0.5);
      drawText(ctx, ellipsize(r.name, listW - 70), x + 18, y, { color: ok ? '#ffffff' : UI.dim });
      const gold = r.gold(s.hero.level);
      drawText(ctx, `${gold}g`, x + listW - 10, y, {
        align: 'right',
        color: gold > s.hero.gold ? UI.bad : UI.accent,
      });
    });
    const r = this.list.selected;
    if (!r) return;
    const lines = [`{gold}${r.name}{/}`, '', r.desc, ''];
    if (r.result.kind === 'gear')
      lines.push(`{gray}Rare or better • Item level ${s.hero.level + CRAFT_ILVL_BONUS}{/}`, '');
    lines.push('Needs:');
    for (const [id, n] of Object.entries(r.materials) as [MaterialId, number][]) {
      const have = s.materials[id] ?? 0;
      lines.push(`${have >= n ? '{green}' : '{red}'}${MATERIALS[id].name} ×${n}{/} {gray}(have ${have}){/}`);
    }
    const gold = r.gold(s.hero.level);
    lines.push(`${s.hero.gold >= gold ? '{gold}' : '{red}'}${gold} gold{/}`);
    const why = craftBlocker(s, r);
    if (why) lines.push('', `{gray}${why}{/}`);
    drawTooltip(ctx, lines, tipX, f.y + 4, tipW, f.h - 30);
  }
}

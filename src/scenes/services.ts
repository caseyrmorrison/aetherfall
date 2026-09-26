/** Town services: Mira's shop, Brom's forge, the bounty board, the inn and talent respec. */
import { audio } from '../audio';
import { CONSUMABLES } from '../data/items';
import { ENEMIES } from '../data/enemies';
import type { Service } from '../data/npcs';
import { ZONES } from '../data/zones';
import type { Scene } from '../engine/app';
import { drawText, measureText } from '../engine/font';
import { rng } from '../engine/rng';
import {
  buyPrice,
  flaskUpgradeCost,
  MAX_FLASK_UPGRADES,
  MAX_UPGRADE,
  respecCost,
  salvageYield,
  sellPrice,
  upgradeCost,
} from '../game/balance';
import type { Game } from '../game/game';
import {
  compareTarget,
  displayName,
  generateCharm,
  generateItem,
  itemIcon,
  itemScore,
  RARITY_INDEX,
} from '../game/items';
import { returnGems } from '../game/gems';
import { addConsumable, addItem, addMaterial, inventoryFull, removeItem, type Bounty } from '../game/state';
import type { ConsumableId, Item } from '../game/types';
import { EQUIP_SLOTS, GEAR_SLOTS } from '../game/types';
import {
  drawHints,
  drawIcon,
  drawPanel,
  drawTooltip,
  ellipsize,
  itemTooltipLines,
  ListView,
  UI,
} from '../ui/widgets';
import { ConfirmScene } from './confirm';
import type { WorldScene } from './world-scene';

export function openService(game: Game, ws: WorldScene, kind: Service): void {
  const app = game.app;
  switch (kind) {
    case 'shop':
      app.push(new ShopScene(game));
      break;
    case 'smith':
      app.push(new SmithScene(game));
      break;
    case 'board':
      app.push(new BoardScene(game));
      break;
    case 'inn':
      app.push(
        new ConfirmScene(
          game,
          'Rest at the Sleeping Griffin? (Restores HP, MP and flasks, and saves your game.)',
          () => {
            void app.transition(() => {
              const st = game.stats();
              ws.world.player.hp = st.maxHp;
              ws.world.player.mp = st.maxMp;
              ws.world.player.clearStatuses();
              game.save.hero.flaskHp = st.flaskHpMax;
              game.save.hero.flaskMp = st.flaskMpMax;
              game.save.respawn = { map: 'town', x: -1, y: -1 };
              game.saveNow();
              audio.playSfx('save');
              game.toast('You feel refreshed. Game saved.', 'ui_save');
            }, 0.6);
          },
        ),
      );
      break;
    case 'respec': {
      const cost = respecCost(game.save.hero.level);
      const spent = Object.values(game.save.hero.passives).reduce((a, b) => a + b, 0);
      if (spent === 0) {
        game.toast('You have no talents to reset.', 'ui_star');
        return;
      }
      app.push(
        new ConfirmScene(game, `Reset all ${spent} talent points for ${cost} gold?`, () => {
          if (game.save.hero.gold < cost) {
            audio.playSfx('ui_error');
            game.toast('Not enough gold.', 'ui_coin', 0, UI.bad);
            return;
          }
          game.save.hero.gold -= cost;
          game.save.hero.skillPoints += spent;
          game.save.hero.passives = {};
          game.invalidateStats();
          audio.playSfx('upgrade_success');
          game.toast(`Talents reset. +${spent} points.`, 'ui_star');
        }),
      );
      break;
    }
  }
}

/** Base class with tabs + the standard frame. */
abstract class TabbedService implements Scene {
  readonly opaque = false;
  tab = 0;
  abstract tabs: string[];
  abstract title: string;
  constructor(protected game: Game) {}

  protected handleTabs(): boolean {
    const input = this.game.app.input;
    if (input.repeat('tabPrev') || input.repeat('left')) {
      this.tab = (this.tab - 1 + this.tabs.length) % this.tabs.length;
      audio.playSfx('ui_tab');
      this.onTab();
      return true;
    }
    if (input.repeat('tabNext') || input.repeat('right')) {
      this.tab = (this.tab + 1) % this.tabs.length;
      audio.playSfx('ui_tab');
      this.onTab();
      return true;
    }
    return false;
  }

  protected onTab(): void {}

  protected frame(ctx: CanvasRenderingContext2D): { x: number; y: number; w: number; h: number } {
    const W = this.game.app.width;
    const H = this.game.app.height;
    ctx.fillStyle = 'rgba(11,10,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    const w = Math.min(W - 16, 460);
    const h = H - 40;
    const x = Math.round((W - w) / 2);
    const y = 16;
    drawPanel(ctx, x, y, w, h, { title: this.title });
    // tabs
    let tx = x + measureText(this.title) + 18;
    this.tabs.forEach((t, i) => {
      const tw = measureText(t) + 10;
      ctx.fillStyle = i === this.tab ? UI.accent : UI.bg;
      ctx.fillRect(tx, y + 2, tw, 11);
      drawText(ctx, t, tx + 5, y + 3, { color: i === this.tab ? UI.bg : UI.dim, shadow: false });
      tx += tw + 3;
    });
    drawText(ctx, `${this.game.save.hero.gold}g`, x + w - 8, y + 3, { align: 'right', color: UI.accent });
    return { x, y: y + 16, w, h: h - 16 };
  }

  protected close(): void {
    audio.playSfx('ui_close');
    this.game.app.remove(this);
  }

  abstract update(dt: number): void;
  abstract render(ctx: CanvasRenderingContext2D): void;
}

/** Reminder in sell/salvage prompts that socketed gems are kept. */
const gemNote = (it: Item): string =>
  it.sockets?.some((g) => g) ? ' (Its gems go back to your pouch.)' : '';

// ------------------------------------------------------------------ shop ----
type SupplyRow = { kind: 'consumable'; id: ConsumableId } | { kind: 'flask' } | { kind: 'charm' };

/** Price of a Mystery Charm (a gamble: any size, may be cursed). */
export const mysteryCharmPrice = (level: number): number => 120 + level * 35;

export class ShopScene extends TabbedService {
  tabs = ['Buy', 'Sell', 'Supplies'];
  title = "Mira's Curios";
  private buy: ListView<Item>;
  private sell: ListView<Item>;
  private supplies: ListView<SupplyRow>;

  constructor(game: Game) {
    super(game);
    this.refreshStock();
    this.buy = new ListView(game.save.shop.stock, 12, 14, false);
    this.sell = new ListView(this.sellable(), 12, 14, false);
    this.supplies = new ListView<SupplyRow>(
      [
        { kind: 'flask' },
        { kind: 'charm' },
        ...(Object.keys(CONSUMABLES) as ConsumableId[]).map((id) => ({ kind: 'consumable' as const, id })),
      ],
      14,
      8,
      false,
    );
  }

  private refreshStock(): void {
    const s = this.game.save;
    if (s.shop.stock.length && s.playTime - s.shop.refreshedAt < 600) return;
    const lvl = s.hero.level;
    const stock: Item[] = [];
    for (let i = 0; i < 8; i++) {
      const rarity = rng.weighted([
        ['common', 3],
        ['uncommon', 4],
        ['rare', 2.5],
        ['epic', 0.5],
      ] as const);
      stock.push({
        ...generateItem(rng, Math.max(1, lvl + rng.int(-1, 1)), {
          rarity,
          slot: GEAR_SLOTS[i % GEAR_SLOTS.length],
        }),
        isNew: false,
      });
    }
    s.shop = { stock, refreshedAt: s.playTime };
  }

  private sellable(): Item[] {
    return this.game.save.inventory.filter((i) => !i.locked);
  }

  update(): void {
    const input = this.game.app.input;
    if (this.handleTabs()) return;
    const s = this.game.save;
    if (this.tab === 0) {
      const r = this.buy.update(input);
      if (r === 'cancel') return this.close();
      if (r === 'confirm' && this.buy.selected) {
        const it = this.buy.selected;
        const price = buyPrice(it.ilvl, RARITY_INDEX[it.rarity]);
        if (s.hero.gold < price) return this.fail('Not enough gold.');
        if (inventoryFull(s)) return this.fail('Your bag is full.');
        s.hero.gold -= price;
        addItem(s, { ...it, isNew: true });
        s.shop.stock = s.shop.stock.filter((x) => x !== it);
        this.buy.setItems(s.shop.stock);
        audio.playSfx('shop_buy');
        this.game.toast(`Bought {${it.rarity}}${it.name}{/}`, 'ui_coin');
      }
    } else if (this.tab === 1) {
      this.sell.setItems(this.sellable());
      const r = this.sell.update(input);
      if (r === 'cancel') return this.close();
      if (r === 'confirm' && this.sell.selected) this.sellItem(this.sell.selected);
      if (input.pressed('menuAlt')) {
        const junk = this.sellable().filter((i) => RARITY_INDEX[i.rarity] <= 1 && i.slot !== 'charm');
        if (!junk.length) return this.fail('No common or uncommon items to sell.');
        const total = junk.reduce((n, i) => n + sellPrice(i.ilvl, RARITY_INDEX[i.rarity], i.upgrade), 0);
        this.game.app.push(
          new ConfirmScene(
            this.game,
            `Sell ${junk.length} common & uncommon items for ${total}g? (Locked items and charms are kept.)`,
            () => {
              for (const i of junk) {
                returnGems(s, i);
                removeItem(s, i.uid);
              }
              this.game.giveGold(total, true);
              audio.playSfx('shop_sell');
              this.game.toast(`Sold ${junk.length} items for ${total}g`, 'ui_coin');
            },
          ),
        );
      }
    } else {
      const r = this.supplies.update(input);
      if (r === 'cancel') return this.close();
      if (r === 'confirm' && this.supplies.selected) {
        const row = this.supplies.selected;
        if (row.kind === 'flask') {
          if (s.hero.flaskUpgrades >= MAX_FLASK_UPGRADES)
            return this.fail('Your flask belt is fully upgraded.');
          const cost = flaskUpgradeCost(s.hero.flaskUpgrades);
          if (s.hero.gold < cost) return this.fail('Not enough gold.');
          s.hero.gold -= cost;
          s.hero.flaskUpgrades++;
          this.game.invalidateStats();
          audio.playSfx('upgrade_success');
          this.game.toast('Flask belt upgraded! +1 charge', 'icon_potion_hp');
        } else if (row.kind === 'charm') {
          const price = mysteryCharmPrice(s.hero.level);
          if (s.hero.gold < price) return this.fail('Not enough gold.');
          if (inventoryFull(s)) return this.fail('Your bag is full.');
          s.hero.gold -= price;
          const c = generateCharm(rng, s.hero.level);
          addItem(s, c);
          this.game.invalidateStats();
          audio.playSfx(c.cursed ? 'void_pulse' : 'pickup_rare');
          this.game.toast(`${c.cursed ? 'Uh oh! ' : ''}{${c.rarity}}${c.name}{/}`, itemIcon(c), c.tier);
        } else {
          const def = CONSUMABLES[row.id];
          if (s.hero.gold < def.price) return this.fail('Not enough gold.');
          s.hero.gold -= def.price;
          addConsumable(s, row.id, 1);
          audio.playSfx('shop_buy');
          this.game.toast(`Bought ${def.name}`, def.icon);
        }
      }
    }
  }

  private sellItem(it: Item): void {
    const s = this.game.save;
    const price = sellPrice(it.ilvl, RARITY_INDEX[it.rarity], it.upgrade);
    const doSell = (): void => {
      if (returnGems(s, it)) this.game.toast('Socketed gems returned to your pouch', 'ui_check');
      removeItem(s, it.uid);
      this.game.giveGold(price, true);
      audio.playSfx('shop_sell');
    };
    if (RARITY_INDEX[it.rarity] >= 3)
      this.game.app.push(
        new ConfirmScene(this.game, `Sell {${it.rarity}}${it.name}{/} for ${price}g?${gemNote(it)}`, doSell),
      );
    else doSell();
  }

  private fail(msg: string): void {
    audio.playSfx('ui_error');
    this.game.toast(msg, 'ui_lock', 0, UI.bad);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const f = this.frame(ctx);
    const s = this.game.save;
    const listW = Math.min(220, f.w - 150);
    const input = this.game.app.input;
    const tipX = f.x + listW + 14;
    const tipW = f.w - listW - 20;
    if (this.tab === 0 || this.tab === 1) {
      const list = this.tab === 0 ? this.buy : this.sell;
      list.visibleRows = Math.floor((f.h - 30) / 12);
      if (!list.items.length)
        drawText(
          ctx,
          this.tab === 0 ? 'Sold out! Check back later.' : 'Nothing to sell.',
          f.x + 10,
          f.y + 8,
          { color: UI.dim },
        );
      list.draw(ctx, f.x + 4, f.y + 4, listW, (it, x, y, sel) => {
        drawIcon(ctx, itemIcon(it), x, y - 4, it.tier);
        drawText(ctx, `{${it.rarity}}${ellipsize(displayName(it), listW - 70)}{/}`, x + 18, y);
        const price =
          this.tab === 0
            ? buyPrice(it.ilvl, RARITY_INDEX[it.rarity])
            : sellPrice(it.ilvl, RARITY_INDEX[it.rarity], it.upgrade);
        drawText(ctx, `${price}g`, x + listW - 10, y, {
          align: 'right',
          color: this.tab === 0 && price > s.hero.gold ? UI.bad : UI.accent,
        });
        void sel;
      });
      const it = list.selected;
      if (it) drawTooltip(ctx, itemTooltipLines(it, compareTarget(s, it)), tipX, f.y + 4, tipW, f.h - 30);
      const hints: [string, string][] =
        this.tab === 0
          ? [['confirm', 'Buy']]
          : [
              ['confirm', 'Sell'],
              ['menuAlt', 'Sell all junk'],
            ];
      drawHints(
        ctx,
        input,
        [...hints, ['tabNext', 'Tab'], ['cancel', 'Leave']] as [string, string][],
        f.x + f.w - 6,
        f.y + f.h - 14,
      );
    } else {
      this.supplies.draw(ctx, f.x + 4, f.y + 4, listW, (row, x, y) => {
        if (row.kind === 'charm') {
          drawIcon(ctx, 'icon_charm_grand', x, y - 4, Math.min(5, Math.floor(s.hero.level / 6)));
          drawText(ctx, 'Mystery Charm', x + 18, y);
          const price = mysteryCharmPrice(s.hero.level);
          drawText(ctx, `${price}g`, x + listW - 10, y, {
            align: 'right',
            color: price > s.hero.gold ? UI.bad : UI.accent,
          });
        } else if (row.kind === 'flask') {
          drawIcon(ctx, 'icon_potion_hp', x, y - 4);
          const maxed = s.hero.flaskUpgrades >= MAX_FLASK_UPGRADES;
          drawText(ctx, 'Flask Belt Expansion', x + 18, y);
          drawText(ctx, maxed ? 'MAX' : `${flaskUpgradeCost(s.hero.flaskUpgrades)}g`, x + listW - 10, y, {
            align: 'right',
            color: UI.accent,
          });
        } else {
          const def = CONSUMABLES[row.id];
          drawIcon(ctx, def.icon, x, y - 4);
          drawText(ctx, `${def.name} {gray}(${s.consumables[row.id] ?? 0}){/}`, x + 18, y);
          drawText(ctx, `${def.price}g`, x + listW - 10, y, {
            align: 'right',
            color: def.price > s.hero.gold ? UI.bad : UI.accent,
          });
        }
      });
      const row = this.supplies.selected;
      if (row) {
        const lines =
          row.kind === 'charm'
            ? [
                '{gold}Mystery Charm{/}',
                '',
                'A sealed charm of unknown power. Charms work while they sit in your bag (up to 10 at once).',
                '',
                '{red}30% are cursed:{/} much stronger bonuses, but with a drawback. Feeling lucky?',
              ]
            : row.kind === 'flask'
              ? [
                  '{gold}Flask Belt Expansion{/}',
                  '',
                  `Adds a Health Flask charge (and a Mana Flask charge every other upgrade).`,
                  '',
                  `Upgrades: ${s.hero.flaskUpgrades}/${MAX_FLASK_UPGRADES}`,
                ]
              : [
                  `{gold}${CONSUMABLES[row.id].name}{/}`,
                  '',
                  CONSUMABLES[row.id].desc,
                  '',
                  'Use from the Items tab in your menu.',
                ];
        drawTooltip(ctx, lines, tipX, f.y + 4, tipW);
      }
      drawHints(
        ctx,
        input,
        [
          ['confirm', 'Buy'],
          ['tabNext', 'Tab'],
          ['cancel', 'Leave'],
        ],
        f.x + f.w - 6,
        f.y + f.h - 14,
      );
    }
  }
}

// ----------------------------------------------------------------- smith ----
export class SmithScene extends TabbedService {
  tabs = ['Upgrade', 'Salvage', 'Reforge'];
  title = "Brom's Forge";
  private list: ListView<Item>;

  constructor(game: Game) {
    super(game);
    this.list = new ListView(this.items(), 12, 14, false);
  }

  private items(): Item[] {
    const s = this.game.save;
    const equipped = EQUIP_SLOTS.map((sl) => s.equipment[sl]).filter((i): i is Item => !!i);
    if (this.tab === 1) return s.inventory.filter((i) => !i.locked);
    const bag = this.tab === 0 ? s.inventory.filter((i) => i.slot !== 'charm') : s.inventory;
    return [...equipped, ...bag];
  }

  protected override onTab(): void {
    this.list.setItems(this.items());
  }

  private fail(msg: string): void {
    audio.playSfx('ui_error');
    this.game.toast(msg, 'ui_lock', 0, UI.bad);
  }

  update(): void {
    const input = this.game.app.input;
    if (this.handleTabs()) return;
    this.list.setItems(this.items());
    const r = this.list.update(input);
    if (r === 'cancel') return this.close();
    const s = this.game.save;
    const it = this.list.selected;
    if (r === 'confirm' && it) {
      const ri = RARITY_INDEX[it.rarity];
      if (this.tab === 0) {
        if (it.slot === 'charm')
          return this.fail('Charms cannot be upgraded \u2014 try reforging them instead.');
        if (it.upgrade >= MAX_UPGRADE) return this.fail('This item is fully upgraded.');
        const c = upgradeCost(it.ilvl, it.upgrade, ri);
        if (s.hero.gold < c.gold) return this.fail('Not enough gold.');
        if ((s.materials.dust ?? 0) < c.dust)
          return this.fail('Not enough Aether Dust. Salvage items to get more.');
        s.hero.gold -= c.gold;
        addMaterial(s, 'dust', -c.dust);
        it.upgrade++;
        this.game.invalidateStats();
        audio.playSfx('upgrade_success');
        this.game.toast(`{${it.rarity}}${displayName(it)}{/}!`, 'ui_star');
      } else if (this.tab === 1) {
        const doIt = (): void => {
          if (returnGems(s, it)) this.game.toast('Socketed gems returned to your pouch', 'ui_check');
          removeItem(s, it.uid);
          const dust = salvageYield(it.ilvl, ri);
          addMaterial(s, 'dust', dust);
          audio.playSfx('salvage');
          this.game.toast(`+${dust} Aether Dust`, 'icon_dust');
        };
        if (ri >= 3)
          this.game.app.push(
            new ConfirmScene(this.game, `Salvage {${it.rarity}}${it.name}{/}?${gemNote(it)}`, doIt),
          );
        else doIt();
      } else {
        if (!it.affixes.length || it.legendary)
          return this.fail(
            it.legendary ? 'Legendary items cannot be reforged.' : 'This item has no affixes to reforge.',
          );
        const cost = this.reforgeCost(it);
        if (s.hero.gold < cost.gold) return this.fail('Not enough gold.');
        if ((s.materials.dust ?? 0) < cost.dust) return this.fail('Not enough Aether Dust.');
        s.hero.gold -= cost.gold;
        addMaterial(s, 'dust', -cost.dust);
        const fresh =
          it.slot === 'charm'
            ? generateCharm(rng, it.ilvl, { size: it.charmSize })
            : generateItem(rng, it.ilvl, { slot: it.slot, kind: it.kind, rarity: it.rarity });
        // sockets (and any gems in them) are kept
        it.affixes = fresh.affixes;
        it.name = fresh.name;
        it.cursed = fresh.cursed;
        this.game.invalidateStats();
        audio.playSfx('upgrade_success');
        this.game.toast('Affixes reforged!', 'ui_star');
      }
    }
    if (this.tab === 1 && input.pressed('menuAlt')) {
      const junk = s.inventory.filter((i) => !i.locked && RARITY_INDEX[i.rarity] <= 1 && i.slot !== 'charm');
      if (!junk.length) return this.fail('No common or uncommon items to salvage.');
      const dust = junk.reduce((n, i) => n + salvageYield(i.ilvl, RARITY_INDEX[i.rarity]), 0);
      this.game.app.push(
        new ConfirmScene(
          this.game,
          `Salvage ${junk.length} common & uncommon items for ${dust} Aether Dust? (Charms are kept.)`,
          () => {
            for (const i of junk) {
              returnGems(s, i);
              removeItem(s, i.uid);
            }
            addMaterial(s, 'dust', dust);
            audio.playSfx('salvage');
            this.game.toast(`+${dust} Aether Dust`, 'icon_dust');
          },
        ),
      );
    }
  }

  private reforgeCost(it: Item): { gold: number; dust: number } {
    const ri = RARITY_INDEX[it.rarity];
    return { gold: Math.round((30 + it.ilvl * 12) * (1 + ri)), dust: 4 + ri * 4 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const f = this.frame(ctx);
    const s = this.game.save;
    const input = this.game.app.input;
    const listW = Math.min(220, f.w - 150);
    this.list.visibleRows = Math.floor((f.h - 44) / 12);
    const equipped = new Set(EQUIP_SLOTS.map((sl) => s.equipment[sl]?.uid));
    drawText(ctx, `Aether Dust: {cyan}${s.materials.dust ?? 0}{/}`, f.x + 8, f.y + f.h - 28);
    if (!this.list.items.length) drawText(ctx, 'Nothing here.', f.x + 10, f.y + 8, { color: UI.dim });
    this.list.draw(ctx, f.x + 4, f.y + 4, listW, (it, x, y) => {
      drawIcon(ctx, itemIcon(it), x, y - 4, it.tier);
      drawText(ctx, `{${it.rarity}}${ellipsize(displayName(it), listW - 50)}{/}`, x + 18, y);
      if (equipped.has(it.uid)) drawText(ctx, 'E', x + listW - 10, y, { align: 'right', color: UI.good });
    });
    const it = this.list.selected;
    const tipX = f.x + listW + 14;
    const tipW = f.w - listW - 20;
    if (it) {
      const lines = itemTooltipLines(it, null);
      const ri = RARITY_INDEX[it.rarity];
      lines.push('');
      if (this.tab === 0) {
        if (it.slot === 'charm') lines.push('{gray}Charms cannot be upgraded.{/}');
        else if (it.upgrade >= MAX_UPGRADE) lines.push('{gold}Fully upgraded!{/}');
        else {
          const c = upgradeCost(it.ilvl, it.upgrade, ri);
          lines.push(`{gold}Upgrade to +${it.upgrade + 1}{/} (base stats +10%)`);
          lines.push(`Cost: ${c.gold}g, ${c.dust} dust`);
          lines.push(`Power after: ~${itemScore({ ...it, upgrade: it.upgrade + 1 })}`);
        }
      } else if (this.tab === 1) lines.push(`{cyan}Salvage for ${salvageYield(it.ilvl, ri)} Aether Dust{/}`);
      else {
        const c = this.reforgeCost(it);
        lines.push(
          it.slot === 'charm'
            ? '{gold}Reforge{/}: reroll this charm (the curse may come or go!).'
            : '{gold}Reforge{/}: reroll all random affixes.',
        );
        lines.push(`Cost: ${c.gold}g, ${c.dust} dust`);
      }
      drawTooltip(ctx, lines, tipX, f.y + 4, tipW, f.h - 30);
    }
    const hints: [string, string][] =
      this.tab === 0
        ? [['confirm', 'Upgrade']]
        : this.tab === 1
          ? [
              ['confirm', 'Salvage'],
              ['menuAlt', 'Salvage junk'],
            ]
          : [['confirm', 'Reforge']];
    drawHints(
      ctx,
      input,
      [...hints, ['tabNext', 'Tab'], ['cancel', 'Leave']] as [string, string][],
      f.x + f.w - 6,
      f.y + f.h - 14,
    );
  }
}

// ----------------------------------------------------------------- board ----
export class BoardScene extends TabbedService {
  tabs = ['Bounties'];
  title = 'Quest Board';
  private list: ListView<Bounty>;

  constructor(game: Game) {
    super(game);
    this.list = new ListView(game.quests.bountyOffers(), 34, 3, false);
  }

  update(): void {
    const r = this.list.update(this.game.app.input);
    if (r === 'cancel') return this.close();
    if (r === 'confirm' && this.list.selected) {
      if (this.game.quests.acceptBounty(this.list.selected)) {
        this.game.toast('Bounty accepted!', 'ui_skull');
        this.list.setItems(this.game.quests.bountyOffers());
      } else {
        audio.playSfx('ui_error');
        this.game.toast('You can hold 3 bounties (one per monster type).', 'ui_lock', 0, UI.bad);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const f = this.frame(ctx);
    const s = this.game.save;
    drawText(ctx, 'Available bounties (rewards paid automatically on completion):', f.x + 8, f.y + 4, {
      color: UI.dim,
    });
    this.list.draw(ctx, f.x + 4, f.y + 16, f.w - 14, (b, x, y) => {
      const e = ENEMIES[b.enemy];
      drawText(ctx, `Slay ${b.count} × {gold}${e.name}{/}`, x + 2, y - 10);
      drawText(ctx, `in ${ZONES[b.zone].name}`, x + 2, y, { color: UI.dim });
      drawText(ctx, `${b.gold}g  •  ${b.xp} XP  •  ${b.dust} dust`, x + 2, y + 10, { color: UI.accent });
    });
    let y = f.y + 16 + 3 * 34 + 10;
    drawText(ctx, `Active bounties (${s.bounties.length}/3):`, f.x + 8, y, { color: UI.dim });
    y += 12;
    for (const b of s.bounties) {
      drawText(
        ctx,
        `${ENEMIES[b.enemy].name}: ${b.progress}/${b.count}  {gray}(${ZONES[b.zone].name}){/}`,
        f.x + 12,
        y,
      );
      y += 11;
    }
    if (!s.bounties.length) drawText(ctx, 'None', f.x + 12, y, { color: UI.dim });
    drawHints(
      ctx,
      this.game.app.input,
      [
        ['confirm', 'Accept'],
        ['cancel', 'Leave'],
      ],
      f.x + f.w - 6,
      f.y + f.h - 14,
    );
  }
}

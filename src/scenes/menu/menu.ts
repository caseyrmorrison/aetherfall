/** Tabbed pause/game menu (Hero, Stats, Items, Skills, Talents, Quests, Map, Bestiary, Records, System). */
import { audio } from '../../audio';
import type { Scene } from '../../engine/app';
import { drawText, measureText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import type { Game } from '../../game/game';
import { drawHints, drawPanel, UI } from '../../ui/widgets';
import type { WorldScene } from '../world-scene';
import { BestiaryTab } from './bestiary';
import { HeroTab } from './hero';
import { ItemsTab } from './items';
import { MapTab } from './map';
import { QuestsTab } from './quests';
import { RecordsTab } from './records';
import { SkillsTab } from './skills';
import { StatsTab } from './stats';
import { SystemTab } from './system';
import { TalentsTab } from './talents';

export type MenuTab =
  'hero' | 'stats' | 'items' | 'skills' | 'talents' | 'quests' | 'map' | 'bestiary' | 'records' | 'system';

export interface TabView {
  readonly label: string;
  /** Return 'close' to close the whole menu. */
  update(dt: number): 'close' | void;
  render(ctx: CanvasRenderingContext2D, r: Rect): void;
  hints(): [string, string][];
  /** Badge (e.g. unspent points). */
  badge?(): boolean;
}

const ORDER: MenuTab[] = [
  'hero',
  'stats',
  'items',
  'skills',
  'talents',
  'quests',
  'map',
  'bestiary',
  'records',
  'system',
];

export class MenuScene implements Scene {
  readonly opaque = false;
  private tabs: Record<MenuTab, TabView>;
  private cur: number;
  private tabRects: { r: Rect; i: number }[] = [];
  private t = 0;

  constructor(
    readonly game: Game,
    readonly ws: WorldScene,
    tab: MenuTab,
  ) {
    this.tabs = {
      hero: new HeroTab(this),
      stats: new StatsTab(this),
      items: new ItemsTab(this),
      skills: new SkillsTab(this),
      talents: new TalentsTab(this),
      quests: new QuestsTab(this),
      map: new MapTab(this),
      bestiary: new BestiaryTab(this),
      records: new RecordsTab(this),
      system: new SystemTab(this),
    };
    this.cur = ORDER.indexOf(tab);
  }

  close(): void {
    audio.playSfx('ui_close');
    this.game.app.remove(this);
  }

  update(dt: number): void {
    this.t += dt;
    const input = this.game.app.input;
    const m = input.mouse;
    for (const tr of this.tabRects) {
      if (m.clicked && pointInRect(m.x, m.y, tr.r) && tr.i !== this.cur) {
        this.cur = tr.i;
        audio.playSfx('ui_tab');
        return;
      }
    }
    if (input.repeat('tabPrev')) {
      this.cur = (this.cur - 1 + ORDER.length) % ORDER.length;
      audio.playSfx('ui_tab');
      return;
    }
    if (input.repeat('tabNext')) {
      this.cur = (this.cur + 1) % ORDER.length;
      audio.playSfx('ui_tab');
      return;
    }
    // quick-close with the key that opened menus
    if (
      this.t > 0.1 &&
      (input.pressed('menu') || input.pressed('pause') || (input.pressed('map') && ORDER[this.cur] === 'map'))
    ) {
      this.close();
      return;
    }
    const r = this.tabs[ORDER[this.cur]].update(dt);
    if (r === 'close') this.close();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    ctx.fillStyle = 'rgba(11,10,18,0.72)';
    ctx.fillRect(0, 0, W, H);
    const w = Math.min(W - 8, 476);
    const h = H - 30;
    const x = Math.round((W - w) / 2);
    const y = 18;
    // tab bar
    this.tabRects = [];
    const input = this.game.app.input;
    let tx = x + 2;
    const keyW = drawHintsKey(ctx, input.label('tabPrev'), tx, 4);
    tx += keyW + 3;
    // abbreviate tab labels when the screen is narrow
    const full = ORDER.reduce((n, id) => n + measureText(this.tabs[id].label) + 12, 30);
    const short = full > W - 8;
    ORDER.forEach((id, i) => {
      const tab = this.tabs[id];
      const label = short && i !== this.cur ? tab.label.slice(0, 3) : tab.label;
      const tw = measureText(label) + (short ? 6 : 10);
      const sel = i === this.cur;
      ctx.fillStyle = sel ? UI.accent : UI.bg;
      ctx.globalAlpha = sel ? 1 : 0.85;
      ctx.fillRect(tx, 3, tw, 13);
      ctx.globalAlpha = 1;
      drawText(ctx, label, tx + (short ? 3 : 5), 5, { color: sel ? UI.bg : UI.dim, shadow: false });
      if (tab.badge?.()) {
        ctx.fillStyle = UI.cyan;
        ctx.fillRect(tx + tw - 3, 3, 3, 3);
      }
      this.tabRects.push({ r: { x: tx, y: 3, w: tw, h: 13 }, i });
      tx += tw + 2;
    });
    drawHintsKey(ctx, input.label('tabNext'), tx + 1, 4);
    drawPanel(ctx, x, y, w, h);
    const tab = this.tabs[ORDER[this.cur]];
    const content: Rect = { x: x + 6, y: y + 6, w: w - 12, h: h - 22 };
    tab.render(ctx, content);
    drawHints(ctx, input, [...tab.hints(), ['cancel', 'Back']], x + w - 6, y + h - 13);
  }
}

function drawHintsKey(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): number {
  const w = Math.max(9, measureText(label) + 5);
  ctx.fillStyle = '#c0cbdc';
  ctx.fillRect(x, y, w, 10);
  drawText(ctx, label, x + Math.round((w - measureText(label)) / 2), y + 1, { color: UI.bg, shadow: false });
  return w;
}

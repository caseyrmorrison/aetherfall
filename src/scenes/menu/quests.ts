/** Quests tab: journal with objectives, rewards and tracking. */
import { audio } from '../../audio';
import { QUESTS } from '../../data/quests';
import { drawText } from '../../engine/font';
import type { Rect } from '../../engine/math';
import type { QuestState } from '../../game/state';
import { drawTooltip, ellipsize, ListView, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

export class QuestsTab implements TabView {
  readonly label = 'Quests';
  private list = new ListView<QuestState>([], 12, 14, false);

  constructor(private menu: MenuScene) {}

  private rows(): QuestState[] {
    const qs = Object.values(this.menu.game.save.quests);
    const rank = (q: QuestState): number => (q.done ? 2 : QUESTS[q.id]?.main ? 0 : 1);
    return qs.filter((q) => QUESTS[q.id]).sort((a, b) => rank(a) - rank(b));
  }

  update(): 'close' | void {
    this.list.setItems(this.rows());
    const r = this.list.update(this.menu.game.app.input);
    if (r === 'cancel') return 'close';
    if (r === 'confirm' && this.list.selected && !this.list.selected.done) {
      this.menu.game.quests.setTracked(this.list.selected.id);
      audio.playSfx('quest_accept');
    }
  }

  hints(): [string, string][] {
    return this.list.selected && !this.list.selected.done ? [['confirm', 'Track']] : [];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const listW = Math.min(180, r.w / 2 - 10);
    this.list.visibleRows = Math.floor((r.h - 8) / 12);
    if (!this.list.items.length) drawText(ctx, 'No quests yet.', r.x + 4, r.y + 4, { color: UI.dim });
    this.list.draw(ctx, r.x, r.y + 2, listW, (q, x, y) => {
      const def = QUESTS[q.id];
      const col = q.done ? UI.dim : def.main ? UI.accent : '#ffffff';
      const mark = q.done ? '✓ ' : q.tracked ? '▶ ' : '';
      drawText(ctx, ellipsize(`${mark}${def.name}`, listW - 8), x, y, { color: col });
    });
    const q = this.list.selected;
    if (!q) return;
    const def = QUESTS[q.id];
    const lines: string[] = [
      `{gold}${def.name}{/}`,
      `{gray}${def.main ? 'Main Story' : 'Side Quest'}{/}`,
      '',
      def.summary,
      '',
    ];
    def.objectives.forEach((o, i) => {
      if (q.done || i < q.stage) lines.push(`{green}✓{/} {gray}${o.text}{/}`);
      else if (i === q.stage) {
        const prog = this.menu.game.quests.progressText(q);
        lines.push(`{gold}▶{/} ${o.text}${prog ? ` (${prog})` : ''}`);
      }
    });
    const rw = def.reward;
    const rewards: string[] = [];
    if (rw.xp) rewards.push(`${rw.xp} XP`);
    if (rw.gold) rewards.push(`${rw.gold}g`);
    if (rw.skillPoints) rewards.push(`${rw.skillPoints} SP`);
    if (rw.item) rewards.push(`{${rw.item.rarity}}${rw.item.rarity} item{/}`);
    if (rw.elixirs) rewards.push(`${rw.elixirs} Elixir`);
    if (rw.flaskUpgrade) rewards.push('Flask upgrade');
    if (rw.dust) rewards.push(`${rw.dust} dust`);
    lines.push('', `Rewards: ${rewards.join(', ')}`);
    drawTooltip(ctx, lines, r.x + listW + 12, r.y + 2, r.w - listW - 12, r.h - 4);
  }
}
